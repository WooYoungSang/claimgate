#!/usr/bin/env python3
"""Evaluate a candidate-only Gemma LoRA adapter without granting authority.

This script loads a local PEFT LoRA adapter on top of the selected Gemma base
model and asks it to emit CandidateClaim JSON for the tuning/eval examples.
The evaluation is intentionally narrow: it checks candidate-only JSON shape and
training-example text recovery. It does not claim truth verification, risk
scoring, anchoring, reviewer decisions, production quality, or projection.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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


def validate_dataset(path: Path) -> list[dict[str, Any]]:
    examples: list[dict[str, Any]] = []
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
        examples.append(example)
    if not examples:
        raise SystemExit("dataset is empty")
    return examples


def read_adapter_report(adapter_path: Path) -> dict[str, Any]:
    report_path = adapter_path / "training-report.json"
    if not report_path.exists():
        raise SystemExit(f"adapter training-report.json missing: {report_path}")
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if report.get("authority") != "candidate-only":
        raise SystemExit("adapter training report authority must be candidate-only")
    if report.get("productionQuality") is not False:
        raise SystemExit("adapter training report must set productionQuality=false")
    for required in ["adapter_config.json", "adapter_model.safetensors"]:
        if not (adapter_path / required).exists():
            raise SystemExit(f"adapter artifact missing: {adapter_path / required}")
    return report


def build_prompt(example: dict[str, Any]) -> str:
    return (
        "Instruction: Extract candidate public-data claims only. "
        "Never verify, score risk, attach final anchors, make reviewer decisions, or project evidence.\n\n"
        f"Input:\n{example['input']}\n\n"
        "Output:\n"
    )


def extract_json_object(text: str) -> tuple[dict[str, Any], bool, str]:
    stripped = text.strip()
    if stripped.startswith("Output:"):
        stripped = stripped[len("Output:") :].strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    decoder = json.JSONDecoder()
    starts = [idx for idx, char in enumerate(stripped) if char == "{"]
    for start in starts:
        try:
            value, end = decoder.raw_decode(stripped[start:])
            if isinstance(value, dict):
                trailing = stripped[start + end :].strip()
                return value, trailing == "", trailing[:300]
        except json.JSONDecodeError:
            continue
    raise ValueError("no JSON object found in generated text")


def validate_generated_candidates(parsed: dict[str, Any]) -> tuple[bool, list[str]]:
    errors: list[str] = []
    candidates = parsed.get("candidates")
    if not isinstance(candidates, list):
        return False, ["generated JSON must contain candidates[]"]
    for idx, candidate in enumerate(candidates):
        if not isinstance(candidate, dict):
            errors.append(f"candidate {idx} is not an object")
            continue
        leaked = FORBIDDEN.intersection(candidate)
        if leaked:
            errors.append(f"candidate {idx} leaks forbidden authority fields: {sorted(leaked)}")
        if candidate.get("state") != "extracted":
            errors.append(f"candidate {idx} state must be extracted")
        if not isinstance(candidate.get("text"), str) or not candidate["text"].strip():
            errors.append(f"candidate {idx} text must be non-empty")
    return len(errors) == 0, errors


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="artifacts/local-ai/gemma-candidate-tuning.jsonl")
    parser.add_argument("--base-model", default="google/gemma-4-12B-it")
    parser.add_argument("--adapter", default="artifacts/local-ai/gemma-candidate-lora-prototype")
    parser.add_argument("--out", default="artifacts/local-ai/gemma-candidate-lora-prototype-infer-eval.json")
    parser.add_argument("--max-examples", type=int, default=3)
    parser.add_argument("--max-new-tokens", type=int, default=256)
    parser.add_argument("--max-seq-length", type=int, default=1024)
    parser.add_argument("--no-4bit", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="validate dataset/adapter/model config without loading weights or generating")
    args = parser.parse_args()

    dataset_path = Path(args.dataset)
    adapter_path = Path(args.adapter)
    examples = validate_dataset(dataset_path)[: args.max_examples]
    adapter_report = read_adapter_report(adapter_path)

    try:
        import torch
        from peft import PeftModel
        from transformers import AutoConfig, AutoModelForCausalLM, AutoModelForImageTextToText, AutoTokenizer, BitsAndBytesConfig
    except ImportError as exc:
        raise SystemExit("Missing inference dependencies: torch, transformers, peft, bitsandbytes.") from exc

    config = AutoConfig.from_pretrained(args.base_model)
    model_loader = AutoModelForImageTextToText if getattr(config, "model_type", "") == "gemma4_unified" else AutoModelForCausalLM
    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    if args.dry_run:
        result = {
            "status": "DRY_RUN_PASS",
            "baseModel": args.base_model,
            "adapter": str(adapter_path),
            "dataset": str(dataset_path),
            "examples": len(examples),
            "modelType": getattr(config, "model_type", ""),
            "modelLoader": getattr(model_loader, "__name__", str(model_loader)),
            "tokenizer": type(tokenizer).__name__,
            "adapterTrainingStatus": adapter_report.get("status"),
            "authority": "candidate-only",
            "productionQuality": False,
        }
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    quantization_config = None
    if not args.no_4bit:
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
        )

    base_model = model_loader.from_pretrained(
        args.base_model,
        device_map="auto",
        quantization_config=quantization_config,
    )
    model = PeftModel.from_pretrained(base_model, str(adapter_path))
    model.eval()

    rows: list[dict[str, Any]] = []
    for example in examples:
        prompt = build_prompt(example)
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=args.max_seq_length)
        device = next(model.parameters()).device
        inputs = {key: value.to(device) for key, value in inputs.items()}
        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=args.max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )
        generated_ids = output_ids[0][inputs["input_ids"].shape[-1] :]
        generated_text = tokenizer.decode(generated_ids, skip_special_tokens=True)
        parsed: dict[str, Any] | None = None
        parse_error = ""
        candidate_only = False
        candidate_errors: list[str] = []
        exact_text_match = False
        strict_json_only = False
        trailing_after_first_json = ""
        try:
            parsed, strict_json_only, trailing_after_first_json = extract_json_object(generated_text)
            candidate_only, candidate_errors = validate_generated_candidates(parsed)
            expected_text = normalize_text(example["output"]["candidates"][0].get("text"))
            generated_candidates = parsed.get("candidates") if isinstance(parsed, dict) else []
            exact_text_match = any(normalize_text(candidate.get("text")) == expected_text for candidate in generated_candidates if isinstance(candidate, dict))
        except Exception as exc:  # noqa: BLE001 - report eval failure instead of crashing the whole run
            parse_error = f"{exc.__class__.__name__}: {exc}"
        rows.append(
            {
                "id": example.get("id"),
                "parseOk": parsed is not None,
                "candidateOnly": candidate_only,
                "exactTextMatch": exact_text_match,
                "strictJsonOnly": strict_json_only,
                "trailingAfterFirstJsonPreview": trailing_after_first_json,
                "errors": [*candidate_errors, *([parse_error] if parse_error else [])],
                "generatedText": generated_text,
                "parsed": parsed,
            }
        )

    parse_pass = sum(1 for row in rows if row["parseOk"])
    candidate_only_pass = sum(1 for row in rows if row["candidateOnly"])
    exact_text_match = sum(1 for row in rows if row["exactTextMatch"])
    strict_json_only_pass = sum(1 for row in rows if row["strictJsonOnly"])
    boundary_pass = parse_pass == len(rows) and candidate_only_pass == len(rows)
    postprocessed_candidate_boundary_ready = boundary_pass
    raw_strict_json_serving_ready = boundary_pass and strict_json_only_pass == len(rows)
    status = "BOUNDARY_PASS_SERVING_READY" if raw_strict_json_serving_ready else "BOUNDARY_PASS_SERVING_BLOCKED" if boundary_pass else "FAIL"
    result = {
        "status": status,
        "evaluatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "baseModel": args.base_model,
        "adapter": str(adapter_path),
        "dataset": str(dataset_path),
        "examples": len(rows),
        "parsePass": parse_pass,
        "candidateOnlyPass": candidate_only_pass,
        "exactTextMatch": exact_text_match,
        "strictJsonOnlyPass": strict_json_only_pass,
        "postprocessedCandidateBoundaryReady": postprocessed_candidate_boundary_ready,
        "rawStrictJsonServingReady": raw_strict_json_serving_ready,
        "servingReady": raw_strict_json_serving_ready,
        "authority": "candidate-only",
        "productionQuality": False,
        "adapterTrainingStatus": adapter_report.get("status"),
        "notes": "Inference eval checks first-JSON/candidate-only behavior on the tiny local dataset. postprocessedCandidateBoundaryReady means a safe first-JSON parser can consume candidates; rawStrictJsonServingReady remains false until the model emits strict JSON only. This is not a production quality or truth-accuracy evaluation.",
        "rows": rows,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not boundary_pass:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
