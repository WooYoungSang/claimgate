#!/usr/bin/env python3
"""Candidate-only Gemma LoRA training entrypoint.

This trains extraction format only. It must never teach ClaimGate to verify,
score risk, attach final anchors, make reviewer decisions, or project evidence.

Typical local run after preflight is clean:

python scripts/train-gemma-candidate-lora.py \
  --dataset artifacts/local-ai/gemma-candidate-tuning.jsonl \
  --base-model <local-or-hf-gemma-12b-base> \
  --out artifacts/local-ai/gemma-candidate-lora
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


FORBIDDEN = {
    "anchor",
    "sourceValue",
    "riskScore",
    "riskLevel",
    "riskTrace",
    "reviewerDecision",
    "verified",
    "corrected",
    "projected",
    "evidencePack",
}
ALLOWED_CANDIDATE_FIELDS = {"id", "text", "subject", "state", "aiValue"}


def validate_dataset(path: Path) -> list[dict]:
    examples: list[dict] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        example = json.loads(line)
        candidates = example.get("output", {}).get("candidates")
        if not isinstance(candidates, list):
            raise SystemExit(f"line {line_no}: output.candidates must be a list")
        for candidate in candidates:
            leaked = FORBIDDEN.intersection(candidate)
            if leaked:
                raise SystemExit(f"line {line_no}: candidate leaks forbidden authority fields: {sorted(leaked)}")
            if candidate.get("state") != "extracted":
                raise SystemExit(f"line {line_no}: candidates must remain state=extracted")
            unsupported = set(candidate).difference(ALLOWED_CANDIDATE_FIELDS)
            if unsupported:
                raise SystemExit(f"line {line_no}: candidate contains unsupported fields: {sorted(unsupported)}")
        if example.get("metadata", {}).get("split") not in (None, "train"):
            raise SystemExit(f"line {line_no}: training dataset may only contain split=train examples")
        examples.append(example)
    if not examples:
        raise SystemExit("dataset is empty")
    return examples


def build_prompt(example: dict) -> str:
    return (
        "Instruction: Extract candidate public-data claims only. "
        "Return exactly one JSON object and stop. "
        "Never verify, score risk, attach final anchors, make reviewer decisions, or project evidence.\n\n"
        f"Input:\n{example['input']}\n\n"
        "Output:\n"
    )


def build_training_texts(examples: list[dict]) -> list[dict[str, str]]:
    return [
        {
            "prompt": build_prompt(example),
            "completion": json.dumps(example["output"], ensure_ascii=False, separators=(",", ":")),
        }
        for example in examples
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--base-model", required=True)
    parser.add_argument("--out", default="artifacts/local-ai/gemma-candidate-lora")
    parser.add_argument("--max-steps", type=int, default=60)
    parser.add_argument("--max-seq-length", type=int, default=2048)
    parser.add_argument("--no-4bit", action="store_true", help="disable 4-bit loading; normally not recommended on 24GB GPUs")
    parser.add_argument("--dry-run", action="store_true", help="validate dataset, dependencies, config, tokenizer, and model loader without downloading weights")
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    examples = validate_dataset(dataset_path)

    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from transformers import (
            AutoConfig,
            AutoModelForCausalLM,
            AutoModelForImageTextToText,
            AutoTokenizer,
            BitsAndBytesConfig,
            DataCollatorForSeq2Seq,
            Trainer,
            TrainingArguments,
        )
    except ImportError as exc:
        raise SystemExit(
            "Missing optional training dependencies. Install/provide a compatible local stack first: "
            "torch, transformers, peft, datasets, accelerate, and bitsandbytes."
        ) from exc

    config = AutoConfig.from_pretrained(args.base_model)
    model_loader = AutoModelForImageTextToText if getattr(config, "model_type", "") == "gemma4_unified" else AutoModelForCausalLM

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quantization_config = None
    if not args.no_4bit:
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )

    if args.dry_run:
        print(
            json.dumps(
                {
                    "status": "DRY_RUN_PASS",
                    "examples": len(examples),
                    "base_model": args.base_model,
                    "model_type": getattr(config, "model_type", ""),
                    "model_loader": getattr(model_loader, "__name__", str(model_loader)),
                    "tokenizer": type(tokenizer).__name__,
                    "authority": "candidate-only",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    model = model_loader.from_pretrained(
        args.base_model,
        device_map="auto",
        quantization_config=quantization_config,
    )
    if not args.no_4bit:
        model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora)

    dataset = Dataset.from_list(build_training_texts(examples))

    def tokenize(batch: dict) -> dict:
        prompt_ids = tokenizer(batch["prompt"], add_special_tokens=True)["input_ids"]
        full_text = batch["prompt"] + batch["completion"] + (tokenizer.eos_token or "")
        tokenized = tokenizer(
            full_text,
            truncation=True,
            max_length=args.max_seq_length,
            padding=False,
        )
        prompt_length = min(len(prompt_ids), len(tokenized["input_ids"]))
        tokenized["labels"] = [-100] * prompt_length + list(tokenized["input_ids"])[prompt_length:]
        return tokenized

    tokenized_dataset = dataset.map(tokenize, remove_columns=["prompt", "completion"])
    training_args = TrainingArguments(
        output_dir=args.out,
        max_steps=args.max_steps,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        logging_steps=5,
        save_steps=args.max_steps,
        report_to=[],
        bf16=True,
    )
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        data_collator=DataCollatorForSeq2Seq(tokenizer=tokenizer, padding=True, label_pad_token_id=-100),
    )
    train_output = trainer.train()
    trainer.save_model(args.out)
    tokenizer.save_pretrained(args.out)
    report = {
        "status": "TRAINED",
        "trainedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "baseModel": args.base_model,
        "dataset": str(dataset_path),
        "output": args.out,
        "examples": len(examples),
        "datasetSha256": hashlib.sha256(dataset_path.read_bytes()).hexdigest(),
        "responseOnlyLoss": True,
        "completionTerminatedWithEos": True,
        "maxSteps": args.max_steps,
        "maxSeqLength": args.max_seq_length,
        "authority": "candidate-only",
        "productionQuality": False,
        "metrics": train_output.metrics,
        "notes": "Candidate-only LoRA training artifact. This does not grant verification, risk, anchoring, reviewer, or projection authority."
    }
    Path(args.out).mkdir(parents=True, exist_ok=True)
    (Path(args.out) / "training-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"candidate-only Gemma LoRA adapter written: {args.out}")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
