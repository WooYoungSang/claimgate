# ClaimGate MOFA ODA Video Preflight

This preflight is the recording gate for the OSS contest video. It does not mark the video complete; it proves the local machine and repository are ready to record.

## Product boundary to say on camera

ClaimGate is an offline / deterministic / fixture-first claim review framework. RTX 4090 Local Gemma proposes candidate claims only. Deterministic rules and a human reviewer decide risk disposition and terminal review status. Evidence Pack JSON is the primary output, and Report Markdown / graph JSON are projections from reviewed claims only.

No AI mock product path is allowed for the submission video. Automated tests may use test doubles, but public recording must use the real local Ollama/Gemma path or explicitly say the runtime is unavailable and block recording.

No-Go boundary: live OpenAPI, hosted LLM/LLM-as-judge, OCR, server, database, auth, production accuracy, and external submission without operator approval remain future/no-go. RTX 4090 Local Gemma is candidate-only; it is not a truth judge.

## Required runtime evidence before recording

Run these commands from the repository root and keep their terminal output available for the recording checklist.

```bash
nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader
CLAIMGATE_LOCAL_LLM_MODEL=gemma4:12b pnpm demo:ai:gemma
pnpm demo
pnpm test:submission-evidence
```

Expected Local Gemma output must include:

- `NVIDIA GeForce RTX 4090`
- `provider=ollama`
- `model=gemma4:12b`
- `aiAuthority=candidate-only`
- `Evidence Pack JSON`
- `Report Markdown`

## Recording sequence

1. Capture or mention the RTX 4090 and `gemma4:12b` Local Gemma preflight.
2. Show `pnpm demo:ai:gemma` producing candidate-only Evidence Pack JSON and Report Markdown.
3. Switch to the 3-minute UI runbook in `docs/demo/mofa-oda-3-minute-runbook.md`.
4. Follow the storyboard in `docs/demo/mofa-oda-submission-video-storyboard.md`.
5. Do not mark `claim-three-minute-video` verified until two real rehearsals and final recording files exist.

## Status rule

`actualRecording remains pending until operator evidence exists`. Rehearsal rows remain pending until a human records measured durations between 165 and 195 seconds and confirms expected state matching.
