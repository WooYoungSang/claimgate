import { describe, expect, test } from 'vitest';
import type { CandidateClaim } from '@claimgate/core';
import {
  assessRagGrounding,
  assertRagGroundingForExtraction,
  assertGemmaTuningJsonlCandidateOnly,
  buildGemmaTuningJsonl,
  buildPersistentRagIndex,
  createNoHitNeedsEvidenceCandidate,
  retainRagConflictCandidate,
  createOllamaGemmaClaimExtractor,
  parseCandidateJsonResponse,
  LOCAL_GEMMA_TUNING_DATASET_VERSION,
  LOCAL_SPARSE_VECTOR_RAG_MODE,
  ragIndexFromJson,
  ragIndexToJson,
  retrieveLexicalRagContext,
  searchPersistentRagIndex,
  assertLocalModelTag,
  assertLocalOllamaEndpoint,
  DEMO_GRADE_LEXICAL_RAG_MODE,
  NO_REPO_TUNING_ARTIFACT_STATUS
} from '../src/index';

const corpus = [
  { id: 'mofa', title: '외교부 안전정보', text: '협력국 A 특별여행주의보 안전정보' },
  { id: 'koica', title: 'KOICA 협력사업', text: '국가 A 2021 2025 농촌 식수 사업' },
  { id: 'unrelated', title: '무관', text: '전혀 다른 자료' }
] as const;

describe('demo-grade lexical RAG', () => {
  test('retrieves only lexical hits in deterministic score order', () => {
    const hits = retrieveLexicalRagContext('협력국 A 안전정보 KOICA', corpus, 2);
    expect(hits.map((hit) => hit.id)).toEqual(['mofa', 'koica']);
    expect(hits[0]?.score).toBeGreaterThan(0);
    expect(DEMO_GRADE_LEXICAL_RAG_MODE).toContain('demo-grade lexical');
    expect(NO_REPO_TUNING_ARTIFACT_STATUS).toContain('production tuning artifact 없음');
    expect(NO_REPO_TUNING_ARTIFACT_STATUS).toContain('pipeline evidence only');
  });

  test('returns an empty list rather than fabricating grounding evidence', () => {
    expect(retrieveLexicalRagContext('zzzz no hit', corpus, 3)).toEqual([]);
  });
});

describe('repo-local persistent sparse-vector RAG', () => {
  test('builds a deterministic persistent index and retrieves grounded chunks after JSON roundtrip', () => {
    const index = buildPersistentRagIndex({
      id: 'mofa-oda-rag',
      documents: corpus,
      chunkTokenSize: 16,
      createdAt: '2026-08-17T00:00:00.000Z'
    });
    const roundTripped = ragIndexFromJson(ragIndexToJson(index));
    const hits = searchPersistentRagIndex({
      index: roundTripped,
      query: '협력국 A 특별여행주의보 안전정보',
      limit: 2
    });

    expect(index.retrievalMode).toBe(LOCAL_SPARSE_VECTOR_RAG_MODE);
    expect(index.chunks.length).toBeGreaterThanOrEqual(corpus.length);
    expect(Object.isFrozen(roundTripped)).toBe(true);
    expect(hits.map((hit) => hit.id)).toEqual(['mofa']);
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  test('persistent RAG returns no hits instead of fabricating grounding', () => {
    const index = buildPersistentRagIndex({
      id: 'mofa-oda-rag',
      documents: corpus,
      createdAt: '2026-08-17T00:00:00.000Z'
    });

    expect(searchPersistentRagIndex({ index, query: 'zzzz qqqq xxxx', limit: 3 })).toEqual([]);
  });
});

describe('candidate-only Gemma tuning dataset', () => {
  test('serializes and validates tuning JSONL with CandidateClaim[] outputs only', () => {
    const jsonl = buildGemmaTuningJsonl({
      version: LOCAL_GEMMA_TUNING_DATASET_VERSION,
      examples: [
        {
          id: 'mofa-safety-candidate',
          instruction: 'Extract candidate public-data claims only.',
          input: '협력국 A는 안전합니다.',
          output: {
            candidates: [
              {
                id: 'ai-candidate-001',
                text: '협력국 A는 안전합니다.',
                state: 'extracted',
                aiValue: '안전'
              }
            ]
          },
          metadata: { source: 'fixture' }
        }
      ]
    });

    const dataset = assertGemmaTuningJsonlCandidateOnly(jsonl);
    expect(dataset.version).toBe(LOCAL_GEMMA_TUNING_DATASET_VERSION);
    expect(dataset.examples[0]?.output.candidates[0]).toMatchObject({
      id: 'ai-candidate-001',
      state: 'extracted'
    });
    expect(jsonl).toContain('"candidates"');
  });

  test('rejects tuning examples that teach Gemma reviewer/risk authority', () => {
    expect(() =>
      buildGemmaTuningJsonl({
        version: LOCAL_GEMMA_TUNING_DATASET_VERSION,
        examples: [
          {
            id: 'bad-authority',
            instruction: 'Bad example.',
            input: 'Verify this claim.',
            output: {
              candidates: [
                {
                  id: 'bad-candidate',
                  text: 'The claim is verified.',
                  state: 'extracted',
                  reviewerDecision: 'verified'
                } as unknown as CandidateClaim
              ]
            }
          }
        ]
      })
    ).toThrow(/AI extraction candidates may only contain extracted candidates/);
  });
});



describe('Gemma candidate JSON response parser', () => {
  const candidate = { id: 'ai-candidate-001', text: '협력국 A는 안전합니다.', subject: '협력국 A', state: 'extracted', aiValue: '안전' } as const;

  test('parses strict JSON-only candidate output', () => {
    const result = parseCandidateJsonResponse(JSON.stringify({ candidates: [candidate] }));

    expect(result.candidates).toEqual([candidate]);
    expect(result.strictJsonOnly).toBe(true);
    expect(result.trailingText).toBe('');
  });

  test('extracts the first candidate JSON object while flagging trailing model output', () => {
    const result = parseCandidateJsonResponse(`Output:
${JSON.stringify({ candidates: [candidate] })}
{"candidates":[]}`);

    expect(result.candidates).toEqual([candidate]);
    expect(result.strictJsonOnly).toBe(false);
    expect(result.trailingText).toContain('"candidates"');
  });

  test('rejects responses without a JSON object', () => {
    expect(() => parseCandidateJsonResponse('후보를 찾지 못했습니다.')).toThrow(/JSON object/);
  });

  test('rejects authority fields even when the first JSON object parses', () => {
    expect(() =>
      parseCandidateJsonResponse(
        JSON.stringify({
          candidates: [
            {
              id: 'bad-candidate',
              text: '검증됨',
              state: 'extracted',
              reviewerDecision: 'verified'
            }
          ]
        })
      )
    ).toThrow(/AI extraction candidates may only contain extracted candidates/);
  });
});


describe('RAG grounding policy', () => {
  test('classifies no-hit as fail-loud extraction failure by default', () => {
    const assessment = assessRagGrounding({ ragHits: [], noHitPolicy: 'fail-extraction' });

    expect(assessment).toMatchObject({
      status: 'no-hit',
      decision: 'fail-extraction',
      ragDocumentIds: []
    });
    expect(() => assertRagGroundingForExtraction(assessment)).toThrow(/RAG retrieval returned no hits/);
  });

  test('can model no-hit as an extracted needs-evidence candidate without fabricating a source anchor', () => {
    const assessment = assessRagGrounding({ ragHits: [], noHitPolicy: 'create-needs-evidence-candidate' });
    const candidate = createNoHitNeedsEvidenceCandidate({
      id: 'rag-no-hit-candidate',
      text: '출처 검색 결과가 없는 후보 주장입니다.',
      subject: 'no-hit example'
    });

    expect(assessment).toMatchObject({ status: 'no-hit', decision: 'create-needs-evidence-candidate' });
    expect(() => assertRagGroundingForExtraction(assessment)).not.toThrow();
    expect(candidate).toMatchObject({
      id: 'rag-no-hit-candidate',
      text: '출처 검색 결과가 없는 후보 주장입니다.',
      state: 'extracted',
      subject: 'no-hit example'
    });
    expect(candidate.proposedAnchor).toBeUndefined();
    expect(candidate.fixtureNotes).toEqual(['rag:no-hit', 'rag-policy:needs-evidence']);
    expect(candidate).not.toHaveProperty('reviewerDecision');
    expect(candidate).not.toHaveProperty('riskLevel');
  });

  test('keeps RAG conflict as extracted candidate input for deterministic risk/reviewer workflow', () => {
    const candidate: CandidateClaim = {
      id: 'rag-conflict-candidate',
      text: '협력국 A는 안전합니다.',
      state: 'extracted',
      aiValue: '안전'
    };
    const retained = retainRagConflictCandidate(candidate, 'RAG source says travel advisory is active.');
    const assessment = assessRagGrounding({
      ragHits: retrieveLexicalRagContext('협력국 A 안전정보', corpus, 2),
      conflict: true
    });

    expect(assessment).toMatchObject({ status: 'conflict', decision: 'retain-candidate-for-risk-review' });
    expect(() => assertRagGroundingForExtraction(assessment)).not.toThrow();
    expect(retained).toMatchObject({
      id: 'rag-conflict-candidate',
      state: 'extracted',
      aiValue: '안전'
    });
    expect(retained.fixtureNotes).toEqual(['rag:conflict', 'RAG source says travel advisory is active.']);
    expect(retained).not.toHaveProperty('reviewerDecision');
    expect(retained).not.toHaveProperty('riskLevel');
  });

  test('rejects authority fields when creating no-hit needs-evidence candidates', () => {
    expect(() =>
      createNoHitNeedsEvidenceCandidate({
        id: 'bad-rag-no-hit-candidate',
        text: '권한 누수 후보.',
        reviewerDecision: 'verified'
      } as unknown as Parameters<typeof createNoHitNeedsEvidenceCandidate>[0])
    ).toThrow(/AI extraction candidates may only contain extracted candidates/);
  });

  test('rejects proposed anchors on no-hit needs-evidence candidates', () => {
    expect(() =>
      createNoHitNeedsEvidenceCandidate({
        id: 'bad-rag-no-hit-anchor-candidate',
        text: '근거 없는 후보가 앵커를 들고 오면 안 됩니다.',
        proposedAnchor: { kind: 'dataset-row', sourceId: 'missing-source', dataset: 'missing.csv', row: 1 }
      } as unknown as Parameters<typeof createNoHitNeedsEvidenceCandidate>[0])
    ).toThrow(/RAG no-hit needs-evidence candidates cannot carry proposed anchors/);
  });
});

describe('local Ollama guard', () => {
  test('accepts local loopback endpoints only', () => {
    expect(assertLocalOllamaEndpoint('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
    expect(assertLocalOllamaEndpoint('http://localhost:11434/')).toBe('http://localhost:11434');
    expect(() => assertLocalOllamaEndpoint('https://127.0.0.1:11434')).toThrow(/local http/);
    expect(() => assertLocalOllamaEndpoint('http://example.com:11434')).toThrow(/must be local/);
  });

  test('rejects empty, URL-like, or whitespace model tags', () => {
    expect(() => assertLocalModelTag('gemma4:12b')).not.toThrow();
    expect(() => assertLocalModelTag('')).toThrow(/non-empty/);
    expect(() => assertLocalModelTag('https://model.example/gemma')).toThrow(/must not be a URL/);
    expect(() => assertLocalModelTag('gemma 4')).toThrow(/whitespace/);
  });
});

describe('Ollama Gemma ClaimExtractor adapter', () => {
  test('calls local Ollama and returns CandidateClaim[] only', async () => {
    const candidates: readonly CandidateClaim[] = [
      { id: 'ai-candidate-001', text: '협력국 A는 안전합니다.', subject: '협력국 A', state: 'extracted', aiValue: '안전' }
    ];
    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ response: JSON.stringify({ candidates }) }), { status: 200 });
    }) as typeof fetch;

    const extractor = createOllamaGemmaClaimExtractor({
      model: 'gemma4:12b',
      ragHits: retrieveLexicalRagContext('협력국 A 안전정보', corpus, 2),
      baseUrl: 'http://127.0.0.1:11434',
      fetchImpl,
      sourceTextFallback: '협력국 A는 안전합니다.'
    });

    const result = await extractor.extractClaims({ id: 'source' });
    expect(extractor.mode).toBe('llm-adapter-boundary');
    expect(result).toEqual(candidates);
    expect(calls[0]?.url).toBe('http://127.0.0.1:11434/api/generate');
    expect(calls[0]?.body).toMatchObject({ model: 'gemma4:12b', stream: false, format: 'json' });
  });

  test('accepts first candidate JSON object and ignores trailing model chatter', async () => {
    const candidates: readonly CandidateClaim[] = [
      { id: 'ai-candidate-001', text: '협력국 A는 안전합니다.', subject: '협력국 A', state: 'extracted', aiValue: '안전' }
    ];
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ response: `${JSON.stringify({ candidates })}
${JSON.stringify({ candidates: [] })}` }), { status: 200 })) as typeof fetch;
    const extractor = createOllamaGemmaClaimExtractor({
      model: 'gemma4:12b',
      ragHits: retrieveLexicalRagContext('협력국 A 안전정보', corpus, 2),
      baseUrl: 'http://127.0.0.1:11434',
      fetchImpl
    });

    await expect(extractor.extractClaims({ id: 'source' })).resolves.toEqual(candidates);
  });

  test('fails loud on malformed candidate JSON', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ response: '{"notCandidates":[]}' }), { status: 200 })) as typeof fetch;
    const extractor = createOllamaGemmaClaimExtractor({
      model: 'gemma4:12b',
      ragHits: retrieveLexicalRagContext('협력국 A 안전정보', corpus, 2),
      baseUrl: 'http://127.0.0.1:11434',
      fetchImpl
    });
    await expect(extractor.extractClaims({ id: 'source' })).rejects.toThrow(/candidates\[\]/);
  });
});
