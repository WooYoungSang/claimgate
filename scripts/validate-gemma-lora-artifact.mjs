#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const FORBIDDEN = [
  'anchor',
  'sourceValue',
  'riskScore',
  'riskLevel',
  'riskTrace',
  'reviewerDecision',
  'verified',
  'corrected',
  'projected',
  'evidencePack'
];

function parseArgs(argv) {
  const args = {
    adapter: 'artifacts/local-ai/gemma-candidate-lora-smoke',
    dataset: 'artifacts/local-ai/gemma-candidate-tuning.jsonl',
    out: 'artifacts/local-ai/gemma-lora-artifact-eval-latest.json'
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--adapter') args.adapter = argv[++i];
    else if (arg.startsWith('--adapter=')) args.adapter = arg.slice('--adapter='.length);
    else if (arg === '--dataset') args.dataset = argv[++i];
    else if (arg.startsWith('--dataset=')) args.dataset = arg.slice('--dataset='.length);
    else if (arg === '--out') args.out = argv[++i];
    else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function validateDataset(path, errors) {
  if (!existsSync(path)) {
    errors.push(`dataset missing: ${path}`);
    return { examples: 0 };
  }
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => line.trim().length > 0);
  for (const [index, line] of lines.entries()) {
    const example = JSON.parse(line);
    const candidates = example?.output?.candidates;
    if (!Array.isArray(candidates)) {
      errors.push(`dataset line ${index + 1}: output.candidates must be an array`);
      continue;
    }
    for (const candidate of candidates) {
      for (const field of FORBIDDEN) {
        if (Object.prototype.hasOwnProperty.call(candidate, field)) {
          errors.push(`dataset line ${index + 1}: candidate leaks forbidden authority field ${field}`);
        }
      }
      if (candidate.state !== 'extracted') {
        errors.push(`dataset line ${index + 1}: candidate state must stay extracted`);
      }
    }
  }
  return { examples: lines.length };
}

function validateAdapter(adapter, errors) {
  const required = ['adapter_config.json', 'adapter_model.safetensors', 'training-report.json'];
  for (const file of required) {
    if (!existsSync(`${adapter}/${file}`)) errors.push(`adapter artifact missing: ${adapter}/${file}`);
  }
  if (!existsSync(`${adapter}/training-report.json`)) return {};
  const report = readJson(`${adapter}/training-report.json`);
  if (report.authority !== 'candidate-only') errors.push('training report authority must be candidate-only');
  if (report.productionQuality !== false && !/not a quality-tuned production checkpoint|not grant verification/i.test(String(report.notes ?? ''))) {
    errors.push('training report must explicitly avoid production-quality or authority overclaim');
  }
  return report;
}

const args = parseArgs(process.argv.slice(2));
const errors = [];
const dataset = validateDataset(args.dataset, errors);
const report = validateAdapter(args.adapter, errors);
const result = {
  status: errors.length === 0 ? 'PASS' : 'FAIL',
  adapter: args.adapter,
  dataset: args.dataset,
  examples: dataset.examples,
  authority: 'candidate-only',
  productionQuality: false,
  trainingStatus: report.status ?? null,
  maxSteps: report.maxSteps ?? null,
  baseModel: report.baseModel ?? null,
  errors
};

mkdirSync(dirname(resolve(args.out)), { recursive: true });
writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) process.exit(1);
