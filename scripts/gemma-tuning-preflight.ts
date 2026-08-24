import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { assertGemmaTuningJsonlCandidateOnly } from '@claimgate/ai-local';

export interface GpuSnapshot {
  readonly detected: boolean;
  readonly name: string;
  readonly memoryTotalMiB: number | null;
  readonly memoryFreeMiB: number | null;
  readonly driverVersion: string;
}

export interface PythonDependencySnapshot {
  readonly checked: boolean;
  readonly ready: boolean;
  readonly python: string;
  readonly versions: Readonly<Record<string, string>>;
  readonly missingOrBroken: readonly string[];
}

export interface GemmaTuningPreflightReport {
  readonly status: 'PASS' | 'FAIL';
  readonly gpuReady: boolean;
  readonly datasetReady: boolean;
  readonly pythonDepsReady: boolean;
  readonly trainingReady: 'ready' | 'blocked';
  readonly gpu: GpuSnapshot;
  readonly minFreeVramMiB: number;
  readonly pythonDeps: PythonDependencySnapshot;
  readonly baseModel: string;
  readonly baseModelReady: 'local-path-present' | 'remote-model-available' | 'external-or-not-checked' | 'missing-local-path';
  readonly errors: readonly string[];
  readonly nextCommand: string;
}

const DEFAULT_MIN_FREE_VRAM_MIB = 18_000;
const REQUIRED_PYTHON_MODULES = Object.freeze(['torch', 'transformers', 'peft', 'datasets', 'accelerate', 'bitsandbytes']);
const OPTIONAL_PYTHON_MODULES = Object.freeze(['trl', 'unsloth']);

export function runGemmaTuningPreflight(
  input: {
    datasetPath?: string;
    nvidiaSmiOutput?: string;
    minFreeVramMiB?: number;
    skipPythonDeps?: boolean;
    python?: string;
    baseModel?: string;
  } = {}
): GemmaTuningPreflightReport {
  const errors: string[] = [];
  const minFreeVramMiB = input.minFreeVramMiB ?? DEFAULT_MIN_FREE_VRAM_MIB;
  const nvidiaSmiOutput = input.nvidiaSmiOutput ?? readNvidiaSmi();
  const gpu = parseNvidiaSmi(nvidiaSmiOutput);

  const isRtx4090 = /RTX\s*4090/i.test(gpu.name);
  const has24GbClassVram = (gpu.memoryTotalMiB ?? 0) >= 23_000;
  const hasTrainingHeadroom = (gpu.memoryFreeMiB ?? 0) >= minFreeVramMiB;
  const gpuReady = gpu.detected && isRtx4090 && has24GbClassVram && hasTrainingHeadroom;
  if (!gpu.detected) {
    errors.push('nvidia-smi did not return a detectable GPU.');
  } else {
    if (!isRtx4090) errors.push(`Expected RTX 4090, detected: ${gpu.name || 'unknown GPU'}.`);
    if (!has24GbClassVram) errors.push(`Expected roughly 24GB VRAM, detected total=${gpu.memoryTotalMiB ?? 'unknown'} MiB.`);
    if (!hasTrainingHeadroom) {
      errors.push(
        `Not enough free VRAM for a Gemma 12B LoRA run: free=${gpu.memoryFreeMiB ?? 'unknown'} MiB, required>=${minFreeVramMiB} MiB.`
      );
    }
  }

  let datasetReady = false;
  if (!input.datasetPath) {
    errors.push('No tuning dataset path was provided.');
  } else if (!existsSync(input.datasetPath)) {
    errors.push(`Tuning dataset does not exist: ${input.datasetPath}`);
  } else {
    assertGemmaTuningJsonlCandidateOnly(readFileSync(input.datasetPath, 'utf8'));
    datasetReady = true;
  }

  const pythonDeps = input.skipPythonDeps
    ? skippedPythonDependencies(input.python ?? 'python3')
    : readPythonDependencies(input.python ?? 'python3');
  if (!pythonDeps.ready) {
    errors.push(`Missing or broken Python training dependencies: ${pythonDeps.missingOrBroken.join(', ')}.`);
  }

  const baseModel = input.baseModel ?? '<not-provided>';
  const baseModelReady = classifyBaseModel(baseModel, input.python ?? 'python3');
  if (!input.baseModel) {
    errors.push('No Gemma 12B base model path or Hugging Face model id was provided.');
  } else if (baseModelReady === 'missing-local-path') {
    errors.push(`Base model local path does not exist: ${baseModel}`);
  } else if (baseModelReady === 'external-or-not-checked') {
    errors.push(`Base model could not be verified as a local path or reachable Hugging Face model id: ${baseModel}`);
  }

  const status: 'PASS' | 'FAIL' = errors.length === 0 ? 'PASS' : 'FAIL';
  return Object.freeze({
    status,
    gpuReady,
    datasetReady,
    pythonDepsReady: pythonDeps.ready,
    trainingReady: status === 'PASS' ? 'ready' : 'blocked',
    gpu,
    minFreeVramMiB,
    pythonDeps,
    baseModel,
    baseModelReady,
    errors: Object.freeze(errors),
    nextCommand:
      'artifacts/local-ai/gemma-train-venv/bin/python scripts/train-gemma-candidate-lora.py --dataset artifacts/local-ai/gemma-candidate-tuning.jsonl --base-model google/gemma-4-12B-it --out artifacts/local-ai/gemma-candidate-lora'
  });
}

export function parseNvidiaSmi(output: string): GpuSnapshot {
  const line = output
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean);
  if (!line) {
    return Object.freeze({ detected: false, name: '', memoryTotalMiB: null, memoryFreeMiB: null, driverVersion: '' });
  }
  const [name = '', total = '', free = '', driver = ''] = line.split(',').map((item) => item.trim());
  return Object.freeze({
    detected: true,
    name,
    memoryTotalMiB: parseMiB(total),
    memoryFreeMiB: parseMiB(free),
    driverVersion: driver
  });
}

function parseMiB(value: string): number | null {
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  return Math.round(Number(match[0]));
}

function readNvidiaSmi(): string {
  try {
    return execFileSync(
      'nvidia-smi',
      ['--query-gpu=name,memory.total,memory.free,driver_version', '--format=csv,noheader,nounits'],
      { encoding: 'utf8' }
    );
  } catch {
    return '';
  }
}

function skippedPythonDependencies(python: string): PythonDependencySnapshot {
  return Object.freeze({
    checked: false,
    ready: true,
    python,
    versions: Object.freeze({}),
    missingOrBroken: Object.freeze([])
  });
}

function readPythonDependencies(python: string): PythonDependencySnapshot {
  const modules = [...REQUIRED_PYTHON_MODULES, ...OPTIONAL_PYTHON_MODULES];
  const probe = `
import importlib, json
mods = ${JSON.stringify(modules)}
out = {}
for mod in mods:
    try:
        module = importlib.import_module(mod)
        out[mod] = getattr(module, '__version__', 'installed')
    except Exception as exc:
        out[mod] = 'ERROR: ' + exc.__class__.__name__ + ': ' + str(exc)
print(json.dumps(out, ensure_ascii=False))
`;
  try {
    const raw = execFileSync(python, ['-c', probe], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const versions = JSON.parse(raw.trim()) as Record<string, string>;
    const missingOrBroken = REQUIRED_PYTHON_MODULES.filter((module) => /^ERROR:/.test(versions[module] ?? 'ERROR'));
    return Object.freeze({
      checked: true,
      ready: missingOrBroken.length === 0,
      python,
      versions: Object.freeze(versions),
      missingOrBroken: Object.freeze(missingOrBroken)
    });
  } catch (error) {
    return Object.freeze({
      checked: true,
      ready: false,
      python,
      versions: Object.freeze({}),
      missingOrBroken: Object.freeze([...REQUIRED_PYTHON_MODULES, `probe-failed:${error instanceof Error ? error.message : String(error)}`])
    });
  }
}

function classifyBaseModel(baseModel: string, python: string): GemmaTuningPreflightReport['baseModelReady'] {
  if (baseModel === '<not-provided>') return 'external-or-not-checked';
  if (baseModel.startsWith('/') || baseModel.startsWith('.') || baseModel.startsWith('~')) {
    return existsSync(baseModel.replace(/^~/, process.env.HOME ?? '~')) ? 'local-path-present' : 'missing-local-path';
  }
  return remoteModelExists(baseModel, python) ? 'remote-model-available' : 'external-or-not-checked';
}

function remoteModelExists(baseModel: string, python: string): boolean {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+$/.test(baseModel)) return false;
  const probe = `
from huggingface_hub import model_info
model_info(${JSON.stringify(baseModel)})
print('ok')
`;
  try {
    const output = execFileSync(python, ['-c', probe], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return output.trim().endsWith('ok');
  } catch {
    return false;
  }
}

function parseArgs(argv: readonly string[]): {
  datasetPath?: string;
  nvidiaSmiOutput?: string;
  minFreeVramMiB?: number;
  skipPythonDeps?: boolean;
  python?: string;
  baseModel?: string;
} {
  const parsed: {
    datasetPath?: string;
    nvidiaSmiOutput?: string;
    minFreeVramMiB?: number;
    skipPythonDeps?: boolean;
    python?: string;
    baseModel?: string;
  } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--dataset') parsed.datasetPath = argv[++index];
    else if (arg.startsWith('--dataset=')) parsed.datasetPath = arg.slice('--dataset='.length);
    else if (arg === '--nvidia-smi-output') parsed.nvidiaSmiOutput = argv[++index];
    else if (arg.startsWith('--nvidia-smi-output=')) parsed.nvidiaSmiOutput = arg.slice('--nvidia-smi-output='.length);
    else if (arg === '--min-free-vram-mib') parsed.minFreeVramMiB = Number(argv[++index]);
    else if (arg.startsWith('--min-free-vram-mib=')) parsed.minFreeVramMiB = Number(arg.slice('--min-free-vram-mib='.length));
    else if (arg === '--skip-python-deps') parsed.skipPythonDeps = true;
    else if (arg === '--python') parsed.python = argv[++index];
    else if (arg.startsWith('--python=')) parsed.python = arg.slice('--python='.length);
    else if (arg === '--base-model') parsed.baseModel = argv[++index];
    else if (arg.startsWith('--base-model=')) parsed.baseModel = arg.slice('--base-model='.length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return parsed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = runGemmaTuningPreflight(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exit(1);
}
