import { describe, expect, it } from 'vitest';
import {
  buildExtractionProvenanceMetadata,
  createExtractedClaimFromCandidate,
  extractionProvenanceActorId,
  extractionProvenanceAuditReason
} from '../src/index.js';

const provenance = {
  provider: 'ollama',
  model: 'gemma4:12b',
  adapterId: 'claimgate-local-gemma4-12b-rag-extractor',
  promptVersion: 'local-gemma-tuning-card-v0',
  ragDocumentIds: ['koica-country-cooperation-projects', 'mofa-country-safety-information'],
  ragRetrievalMode: 'demo-grade lexical fixture retrieval; production vector retrieval 아님',
  tuningArtifactStatus: 'committed production tuning artifact 없음; local smoke/prototype LoRA adapters are pipeline evidence only'
} as const;

describe('extraction provenance', () => {
  it('normalizes Local Gemma/RAG provenance into candidate-only Evidence Pack metadata', () => {
    const metadata = buildExtractionProvenanceMetadata(provenance);

    expect(metadata).toEqual({
      provider: 'ollama',
      model: 'gemma4:12b',
      adapterId: 'claimgate-local-gemma4-12b-rag-extractor',
      promptVersion: 'local-gemma-tuning-card-v0',
      ragDocumentIds: 'koica-country-cooperation-projects,mofa-country-safety-information',
      ragRetrievalMode: 'demo-grade lexical fixture retrieval; production vector retrieval 아님',
      tuningArtifactStatus: 'committed production tuning artifact 없음; local smoke/prototype LoRA adapters are pipeline evidence only',
      aiAuthority: 'candidate-only'
    });
    expect(Object.isFrozen(metadata)).toBe(true);
  });

  it('formats provenance for Claim creation audit without granting AI authority', () => {
    const claim = createExtractedClaimFromCandidate(
      {
        id: 'ai-candidate-001',
        text: 'AI proposed a public-data claim.',
        state: 'extracted',
        aiValue: 'candidate'
      },
      {
        actor: { kind: 'system', id: extractionProvenanceActorId(provenance) },
        reason: extractionProvenanceAuditReason(provenance),
        now: () => '2026-08-17T00:00:00.000Z'
      }
    );

    expect(claim.audit[0]).toMatchObject({
      action: 'create',
      actor: { kind: 'system', id: 'extractor:ollama:gemma4:12b' },
      reason:
        'Candidate claim extracted by ollama/gemma4:12b via claimgate-local-gemma4-12b-rag-extractor; prompt=local-gemma-tuning-card-v0; rag=koica-country-cooperation-projects,mofa-country-safety-information; aiAuthority=candidate-only.'
    });
  });

  it('fails loud when required provenance fields are blank', () => {
    expect(() => buildExtractionProvenanceMetadata({ ...provenance, model: '   ' })).toThrow(
      'Extraction provenance model must be non-empty.'
    );
    expect(() => extractionProvenanceActorId({ ...provenance, provider: 'hosted api' })).toThrow(
      'Extraction provenance provider must not contain whitespace.'
    );
  });
});
