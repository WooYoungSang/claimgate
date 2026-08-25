import { assertCandidateClaims, normalizeCandidateClaim, type CandidateClaim, type ClaimExtractor, type ClaimExtractorSource } from '@claimgate/core';

export const DEFAULT_LOCAL_GEMMA_MODEL = 'gemma4:12b';
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export const DEMO_GRADE_LEXICAL_RAG_MODE = 'demo-grade lexical fixture retrieval; production vector retrieval 아님';
export const LOCAL_SPARSE_VECTOR_RAG_MODE = 'repo-local persistent sparse-vector RAG index; no external vector DB';
export const NO_REPO_TUNING_ARTIFACT_STATUS = 'committed production tuning artifact 없음; local smoke/prototype LoRA adapters are pipeline evidence only';
export const LOCAL_GEMMA_TUNING_DATASET_VERSION = 'claimgate-local-gemma-candidate-only-v0';

export const LOCAL_GEMMA_TUNING_CARD = `ClaimGate local Gemma extractor tuning card v0:
- Role: propose candidate public-data claims only.
- Authority boundary: never verify truth, never score risk, never attach final anchors, never make reviewer decisions, never create Evidence Packs/reports/graphs.
- Use RAG context as grounding snippets. If a candidate conflicts with RAG context, still output the AI candidate value; ClaimGate will classify the conflict.
- Output strict JSON only: {"candidates":[{"id":"ai-candidate-001","text":"...","subject":"...","state":"extracted","aiValue":"..."}]}.`;

export interface RagDocument {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

export interface RagHit extends RagDocument {
  readonly score: number;
}

export interface RagChunk {
  readonly id: string;
  readonly documentId: string;
  readonly title: string;
  readonly text: string;
  readonly tokenCounts: Readonly<Record<string, number>>;
}

export interface RagIndex {
  readonly id: string;
  readonly version: string;
  readonly retrievalMode: typeof LOCAL_SPARSE_VECTOR_RAG_MODE;
  readonly documents: readonly RagDocument[];
  readonly chunks: readonly RagChunk[];
  readonly documentFrequency: Readonly<Record<string, number>>;
  readonly createdAt: string;
}

export interface BuildRagIndexInput {
  readonly id: string;
  readonly documents: readonly RagDocument[];
  readonly chunkTokenSize?: number;
  readonly createdAt?: string;
}

export interface SearchRagIndexInput {
  readonly index: RagIndex;
  readonly query: string;
  readonly limit: number;
}


export interface CandidateJsonParseResult {
  readonly candidates: readonly CandidateClaim[];
  readonly strictJsonOnly: boolean;
  readonly trailingText: string;
}

export interface GemmaTuningExample {
  readonly id: string;
  readonly instruction: string;
  readonly input: string;
  readonly output: {
    readonly candidates: readonly CandidateClaim[];
  };
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface GemmaTuningDataset {
  readonly version: typeof LOCAL_GEMMA_TUNING_DATASET_VERSION;
  readonly examples: readonly GemmaTuningExample[];
}

export type RagNoHitPolicy = 'fail-extraction' | 'create-needs-evidence-candidate';
export type RagGroundingStatus = 'hit' | 'no-hit' | 'conflict';
export type RagGroundingDecision = 'continue-extraction' | 'fail-extraction' | 'create-needs-evidence-candidate' | 'retain-candidate-for-risk-review';

export interface RagGroundingAssessment {
  readonly status: RagGroundingStatus;
  readonly decision: RagGroundingDecision;
  readonly ragDocumentIds: readonly string[];
  readonly notes: readonly string[];
}

export interface AssessRagGroundingInput {
  readonly ragHits: readonly RagHit[];
  readonly noHitPolicy?: RagNoHitPolicy;
  readonly conflict?: boolean;
  readonly conflictReason?: string;
}

export interface NoHitNeedsEvidenceCandidateInput extends Omit<CandidateClaim, 'state' | 'proposedAnchor' | 'fixtureNotes'> {
  readonly fixtureNotes?: readonly string[];
}

export function assessRagGrounding(input: AssessRagGroundingInput): RagGroundingAssessment {
  const ragDocumentIds = Object.freeze(input.ragHits.map((hit) => hit.id));

  if (input.ragHits.length === 0) {
    const policy = input.noHitPolicy ?? 'fail-extraction';
    return Object.freeze({
      status: 'no-hit' as const,
      decision: policy,
      ragDocumentIds,
      notes: Object.freeze(['rag:no-hit', `rag-policy:${policy}`])
    });
  }

  if (input.conflict) {
    return Object.freeze({
      status: 'conflict' as const,
      decision: 'retain-candidate-for-risk-review' as const,
      ragDocumentIds,
      notes: Object.freeze(['rag:conflict', ...(input.conflictReason ? [input.conflictReason] : [])])
    });
  }

  return Object.freeze({
    status: 'hit' as const,
    decision: 'continue-extraction' as const,
    ragDocumentIds,
    notes: Object.freeze(['rag:hit'])
  });
}

export function assertRagGroundingForExtraction(assessment: RagGroundingAssessment): void {
  if (assessment.decision === 'fail-extraction') {
    throw new Error('RAG retrieval returned no hits; ClaimGate will not treat a no-hit candidate as grounded evidence.');
  }
}

export function createNoHitNeedsEvidenceCandidate(input: NoHitNeedsEvidenceCandidateInput): CandidateClaim {
  if (typeof input === 'object' && input !== null && Object.prototype.hasOwnProperty.call(input, 'proposedAnchor')) {
    throw new Error('RAG no-hit needs-evidence candidates cannot carry proposed anchors.');
  }

  return normalizeCandidateClaim({
    ...input,
    state: 'extracted' as const,
    fixtureNotes: [...(input.fixtureNotes ?? []), 'rag:no-hit', 'rag-policy:needs-evidence']
  });
}

export function retainRagConflictCandidate(candidate: CandidateClaim, reason: string): CandidateClaim {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new Error('RAG conflict retention requires a non-empty reason.');
  }

  return normalizeCandidateClaim({
    ...candidate,
    fixtureNotes: [...(candidate.fixtureNotes ?? []), 'rag:conflict', trimmed]
  });
}

export interface OllamaGemmaExtractorOptions {
  readonly model?: string;
  readonly ragHits: readonly RagHit[];
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly tuningCard?: string;
  readonly sourceTextFallback?: string;
}

export function retrieveLexicalRagContext(query: string, corpus: readonly RagDocument[], limit: number): readonly RagHit[] {
  const queryTokens = tokenize(query);
  const hits = corpus.map((document) => {
    const documentTokens = tokenize(`${document.title}\n${document.text}`);
    const score = [...queryTokens].reduce((sum, token) => sum + (documentTokens.has(token) ? 1 : 0), 0);
    return Object.freeze({ ...document, score });
  });
  return Object.freeze(hits.filter((hit) => hit.score > 0).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)).slice(0, limit));
}

export function buildPersistentRagIndex(input: BuildRagIndexInput): RagIndex {
  const chunkTokenSize = Math.max(16, Math.floor(input.chunkTokenSize ?? 96));
  const chunks = input.documents.flatMap((document) => chunkDocument(document, chunkTokenSize));
  const documentFrequency = new Map<string, number>();

  for (const chunk of chunks) {
    for (const token of Object.keys(chunk.tokenCounts)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  return deepFreezeRagIndex({
    id: requireNonEmpty(input.id, 'RAG index id'),
    version: '1',
    retrievalMode: LOCAL_SPARSE_VECTOR_RAG_MODE,
    documents: input.documents.map((document) => freezeRagDocument(document)),
    chunks,
    documentFrequency: Object.fromEntries([...documentFrequency.entries()].sort(([left], [right]) => left.localeCompare(right))),
    createdAt: input.createdAt ?? new Date().toISOString()
  });
}

export function searchPersistentRagIndex(input: SearchRagIndexInput): readonly RagHit[] {
  if (input.limit <= 0) return Object.freeze([]);
  const queryTokens = tokenize(input.query);
  if (queryTokens.size === 0) return Object.freeze([]);

  const queryCounts = countTokens([...queryTokens]);
  const scored = input.index.chunks
    .map((chunk) => {
      const score = sparseCosineSimilarity(queryCounts, chunk.tokenCounts, input.index.documentFrequency, input.index.chunks.length);
      return Object.freeze({
        id: chunk.documentId,
        title: chunk.title,
        text: chunk.text,
        score
      });
    })
    .filter((hit) => hit.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id) || left.text.localeCompare(right.text));

  const deduped: RagHit[] = [];
  const seen = new Set<string>();
  for (const hit of scored) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    deduped.push(hit);
    if (deduped.length >= input.limit) break;
  }
  return Object.freeze(deduped);
}

export function ragIndexToJson(index: RagIndex): string {
  return JSON.stringify(index, null, 2);
}

export function ragIndexFromJson(json: string): RagIndex {
  const parsed = JSON.parse(json) as RagIndex;
  return deepFreezeRagIndex(parsed);
}

export function buildGemmaTuningJsonl(dataset: GemmaTuningDataset): string {
  if (dataset.version !== LOCAL_GEMMA_TUNING_DATASET_VERSION) {
    throw new Error(`Gemma tuning dataset version must be ${LOCAL_GEMMA_TUNING_DATASET_VERSION}.`);
  }

  return dataset.examples.map((example) => JSON.stringify(normalizeGemmaTuningExample(example))).join('\n') + '\n';
}

export function assertGemmaTuningJsonlCandidateOnly(jsonl: string): GemmaTuningDataset {
  const examples = jsonl
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => normalizeGemmaTuningExample(JSON.parse(line) as GemmaTuningExample));

  return Object.freeze({
    version: LOCAL_GEMMA_TUNING_DATASET_VERSION,
    examples: Object.freeze(examples)
  });
}

export function parseCandidateJsonResponse(responseText: string): CandidateJsonParseResult {
  const jsonText = extractFirstJsonObjectText(responseText);
  const parsed = JSON.parse(jsonText.value) as { readonly candidates?: readonly CandidateClaim[] };
  if (!Array.isArray(parsed.candidates)) throw new Error('Ollama/Gemma response did not contain candidates[].');
  for (const [index, candidate] of parsed.candidates.entries()) {
    assertSupportedCandidateFields(candidate, index);
  }
  const candidates = assertCandidateClaims(parsed.candidates);

  return Object.freeze({
    candidates,
    strictJsonOnly: jsonText.leadingText.length === 0 && jsonText.trailingText.length === 0,
    trailingText: jsonText.trailingText
  });
}

const MODEL_CANDIDATE_FIELDS = new Set(['id', 'text', 'subject', 'state', 'aiValue', 'proposedAnchor', 'fixtureNotes']);
const MODEL_AUTHORITY_FIELDS = new Set(['anchor', 'sourceValue', 'riskScore', 'riskLevel', 'riskTrace', 'reviewerDecision', 'verified', 'corrected', 'projected', 'evidencePack']);

function assertSupportedCandidateFields(candidate: CandidateClaim, index: number): void {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) return;
  const unsupported = Object.keys(candidate).filter((field) => !MODEL_CANDIDATE_FIELDS.has(field) && !MODEL_AUTHORITY_FIELDS.has(field));
  if (unsupported.length > 0) {
    throw new Error(`Ollama/Gemma response candidate ${index} contains unsupported candidate fields: ${unsupported.sort().join(', ')}.`);
  }
}

export function createOllamaGemmaClaimExtractor(options: OllamaGemmaExtractorOptions): ClaimExtractor {
  const model = options.model ?? DEFAULT_LOCAL_GEMMA_MODEL;
  assertLocalModelTag(model);
  const baseUrl = assertLocalOllamaEndpoint(options.baseUrl ?? DEFAULT_OLLAMA_BASE_URL);
  const fetcher = options.fetchImpl ?? globalThis.fetch;
  if (!fetcher) throw new Error('Ollama Gemma extractor requires fetch support.');
  return Object.freeze({
    id: 'claimgate-local-gemma4-12b-rag-extractor',
    mode: 'llm-adapter-boundary' as const,
    async extractClaims(source: ClaimExtractorSource): Promise<readonly CandidateClaim[]> {
      const prompt = buildGemmaPrompt(options.sourceTextFallback ?? source.id, options.ragHits, options.tuningCard ?? LOCAL_GEMMA_TUNING_CARD);
      const response = await fetcher(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false, format: 'json', options: { temperature: 0.1 } })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama/Gemma candidate extraction failed: ${response.status} ${errorText}`);
      }
      const payload = await response.json() as { readonly response?: string };
      if (typeof payload.response !== 'string' || payload.response.trim().length === 0) {
        throw new Error('Ollama/Gemma response did not include JSON text.');
      }
      return parseCandidateJsonResponse(payload.response).candidates;
    }
  });
}

export function assertLocalModelTag(model: string): string {
  const trimmed = model.trim();
  if (trimmed.length === 0) {
    throw new Error('Local Gemma model tag must be non-empty.');
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new Error('Local Gemma model tag must not be a URL; use an Ollama local model tag such as gemma4:12b.');
  }
  if (/\s/.test(trimmed)) {
    throw new Error('Local Gemma model tag must not contain whitespace.');
  }
  return trimmed;
}

export function assertLocalOllamaEndpoint(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('Ollama endpoint must be a valid local http URL.');
  }

  if (parsed.protocol !== 'http:') {
    throw new Error('Ollama endpoint must be local http, not an external or hosted API URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalhost = hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
  if (!isLocalhost) {
    throw new Error('Ollama endpoint must be local: use localhost, 127.0.0.1, or ::1.');
  }

  return parsed.toString().replace(/\/$/, '');
}

export function buildGemmaPrompt(sourceText: string, ragHits: readonly RagHit[], tuningCard = LOCAL_GEMMA_TUNING_CARD): string {
  const ragContext = ragHits.map((hit, index) => `[#${index + 1} ${hit.id} | ${hit.title}]\n${hit.text}`).join('\n\n');
  return [
    tuningCard,
    'RAG context:',
    ragContext,
    'Input AI answer and source text:',
    sourceText,
    'Return JSON only.'
  ].join('\n\n');
}


interface ExtractedJsonText {
  readonly value: string;
  readonly leadingText: string;
  readonly trailingText: string;
}

function extractFirstJsonObjectText(responseText: string): ExtractedJsonText {
  if (typeof responseText !== 'string' || responseText.trim().length === 0) {
    throw new Error('Ollama/Gemma response did not include JSON text.');
  }

  const text = stripResponseWrapper(responseText);
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    const end = findJsonObjectEnd(text, start);
    if (end === -1) continue;
    const value = text.slice(start, end + 1);
    try {
      JSON.parse(value);
    } catch {
      continue;
    }
    return Object.freeze({
      value,
      leadingText: text.slice(0, start).trim(),
      trailingText: text.slice(end + 1).trim()
    });
  }

  throw new Error('Ollama/Gemma response did not contain a JSON object.');
}

function stripResponseWrapper(responseText: string): string {
  let text = responseText.trim();
  if (text.startsWith('Output:')) {
    text = text.slice('Output:'.length).trim();
  }
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    text = fenced[1].trim();
  }
  return text;
}

function findJsonObjectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) return -1;
    }
  }

  return -1;
}

function tokenize(value: string): ReadonlySet<string> {
  return new Set(value.toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((token) => token.length >= 2));
}

function chunkDocument(document: RagDocument, chunkTokenSize: number): RagChunk[] {
  const tokens = [...tokenize(`${document.title}\n${document.text}`)];
  const windows = tokens.length === 0 ? [[]] : chunkArray(tokens, chunkTokenSize);

  return windows.map((windowTokens, index) => {
    const text = windowTokens.length === 0 ? document.text : windowTokens.join(' ');
    return Object.freeze({
      id: `${document.id}#${index + 1}`,
      documentId: requireNonEmpty(document.id, 'RAG document id'),
      title: requireNonEmpty(document.title, 'RAG document title'),
      text,
      tokenCounts: Object.freeze(countTokens(windowTokens))
    });
  });
}

function chunkArray<T>(items: readonly T[], size: number): readonly T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push([...items.slice(index, index + size)]);
  }
  return chunks;
}

function countTokens(tokens: Iterable<string>): Readonly<Record<string, number>> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function sparseCosineSimilarity(
  queryCounts: Readonly<Record<string, number>>,
  chunkCounts: Readonly<Record<string, number>>,
  documentFrequency: Readonly<Record<string, number>>,
  chunkCount: number
): number {
  let dot = 0;
  let queryNorm = 0;
  let chunkNorm = 0;
  const tokens = new Set([...Object.keys(queryCounts), ...Object.keys(chunkCounts)]);

  for (const token of tokens) {
    const idf = Math.log(1 + chunkCount / (1 + (documentFrequency[token] ?? 0)));
    const queryWeight = (queryCounts[token] ?? 0) * idf;
    const chunkWeight = (chunkCounts[token] ?? 0) * idf;
    dot += queryWeight * chunkWeight;
    queryNorm += queryWeight * queryWeight;
    chunkNorm += chunkWeight * chunkWeight;
  }

  if (queryNorm === 0 || chunkNorm === 0) return 0;
  return Number((dot / (Math.sqrt(queryNorm) * Math.sqrt(chunkNorm))).toFixed(6));
}

function freezeRagDocument(document: RagDocument): RagDocument {
  return Object.freeze({
    id: requireNonEmpty(document.id, 'RAG document id'),
    title: requireNonEmpty(document.title, 'RAG document title'),
    text: requireNonEmpty(document.text, 'RAG document text')
  });
}

function deepFreezeRagIndex(index: RagIndex): RagIndex {
  return Object.freeze({
    id: requireNonEmpty(index.id, 'RAG index id'),
    version: requireNonEmpty(index.version, 'RAG index version'),
    retrievalMode: index.retrievalMode,
    documents: Object.freeze(index.documents.map((document) => freezeRagDocument(document))),
    chunks: Object.freeze(
      index.chunks.map((chunk) =>
        Object.freeze({
          id: requireNonEmpty(chunk.id, 'RAG chunk id'),
          documentId: requireNonEmpty(chunk.documentId, 'RAG chunk documentId'),
          title: requireNonEmpty(chunk.title, 'RAG chunk title'),
          text: requireNonEmpty(chunk.text, 'RAG chunk text'),
          tokenCounts: Object.freeze({ ...chunk.tokenCounts })
        })
      )
    ),
    documentFrequency: Object.freeze({ ...index.documentFrequency }),
    createdAt: requireNonEmpty(index.createdAt, 'RAG index createdAt')
  });
}

function normalizeGemmaTuningExample(example: GemmaTuningExample): GemmaTuningExample {
  const candidates = assertCandidateClaims(example.output?.candidates ?? []);
  return Object.freeze({
    id: requireNonEmpty(example.id, 'Gemma tuning example id'),
    instruction: requireNonEmpty(example.instruction, 'Gemma tuning example instruction'),
    input: requireNonEmpty(example.input, 'Gemma tuning example input'),
    output: Object.freeze({ candidates }),
    ...(example.metadata ? { metadata: Object.freeze({ ...example.metadata }) } : {})
  });
}

function requireNonEmpty(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty.`);
  }
  return value.trim();
}
