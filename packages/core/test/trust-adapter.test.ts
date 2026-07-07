import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createExtractedClaim, attachAnchor, transitionClaim, VerificationError, type SourceAnchor } from '../src/index.js';
import {
  createMockTrustAdapter,
  credentialRef,
  TRUST_SIGNAL_CONTEXT_ONLY_NOTICE,
  type MockTrustCredential
} from '../src/trust-adapter.js';

const anchor: SourceAnchor = {
  kind: 'dataset-row',
  sourceId: 'fixture:civic-budget',
  dataset: 'civic-budget',
  row: 7,
  column: 'budget_total'
};

const reviewer = { id: 'reviewer-1', displayName: 'Reviewer One' };
const now = () => '2026-07-07T00:00:00.000Z';

describe('TrustAdapter optional mock boundary', () => {
  it('evaluates mock credentials offline and surfaces context-only trust signals', () => {
    const adapter = createMockTrustAdapter([
      {
        id: 'mock-vc:agency:seoul-open-data',
        issuer: 'did:mock:gov-root',
        subject: {
          id: 'did:mock:agency:seoul-open-data',
          role: 'issuer',
          name: 'Seoul Open Data Office'
        },
        issuedAt: '2026-01-01T00:00:00.000Z',
        claims: { dataset: 'civic-budget' },
        proof: { type: 'mock-signature', value: 'mock-proof-seoul-open-data' }
      }
    ]);

    const signal = adapter.evaluate({ credentialId: 'mock-vc:agency:seoul-open-data', now: '2026-07-07T00:00:00.000Z' });

    expect(signal).toMatchObject({
      credentialRef: 'mock-vc:agency:seoul-open-data',
      level: 'mock-credential-valid',
      subjectRole: 'issuer',
      nonAuthorityNotice: TRUST_SIGNAL_CONTEXT_ONLY_NOTICE
    });
    expect(signal.authority).toBe('context-only');
    expect(signal.canVerifyClaim).toBe(false);
    expect(signal.canChangeRisk).toBe(false);
    expect(signal.canBypassAnchor).toBe(false);
  });

  it('can attach a credential reference to audit events without replacing reviewer or anchor guards', () => {
    const extracted = createExtractedClaim({ id: 'claim-1', text: 'Budget is 10', aiValue: 10, now });
    const anchored = attachAnchor(extracted, {
      anchor,
      sourceValue: 10,
      actor: { kind: 'reviewer', id: 'anchor-reviewer' },
      trustCredentialRef: credentialRef('mock-vc:agency:seoul-open-data'),
      now
    });
    const needsEvidence = transitionClaim(anchored, { to: 'needs-evidence', now });

    expect(anchored.audit.at(-1)?.trustCredentialRef).toBe('mock-vc:agency:seoul-open-data');

    expect(() =>
      transitionClaim(needsEvidence, {
        to: 'verified',
        trustCredentialRef: credentialRef('mock-vc:verifier:review-board'),
        now
      })
    ).toThrow(new VerificationError('E_NO_REVIEWER', 'Terminal verification decisions require a reviewer.'));

    const verified = transitionClaim(needsEvidence, {
      to: 'verified',
      reviewer,
      trustCredentialRef: credentialRef('mock-vc:verifier:review-board'),
      now
    });

    expect(verified.audit.at(-1)).toMatchObject({
      actor: { kind: 'reviewer', id: reviewer.id },
      trustCredentialRef: 'mock-vc:verifier:review-board',
      anchorId: 'fixture%3Acivic-budget:dataset:name=civic-budget:row=7:column=budget_total'
    });
  });

  it('keeps DID optional: missing, expired, or revoked credentials never become verification authority', () => {
    const credentials: MockTrustCredential[] = [
      {
        id: 'mock-vc:expired',
        issuer: 'did:mock:gov-root',
        subject: { id: 'did:mock:agency:expired', role: 'issuer' },
        issuedAt: '2025-01-01T00:00:00.000Z',
        expiresAt: '2025-12-31T00:00:00.000Z',
        claims: {},
        proof: { type: 'mock-signature', value: 'mock-proof-expired' }
      },
      {
        id: 'mock-vc:revoked',
        issuer: 'did:mock:gov-root',
        subject: { id: 'did:mock:agency:revoked', role: 'issuer' },
        issuedAt: '2026-01-01T00:00:00.000Z',
        revokedAt: '2026-06-01T00:00:00.000Z',
        claims: {},
        proof: { type: 'mock-signature', value: 'mock-proof-revoked' }
      }
    ];
    const adapter = createMockTrustAdapter(credentials);

    expect(adapter.evaluate({ credentialId: 'missing', now: '2026-07-07T00:00:00.000Z' })).toMatchObject({
      level: 'missing',
      canVerifyClaim: false
    });
    expect(adapter.evaluate({ credentialId: 'mock-vc:expired', now: '2026-07-07T00:00:00.000Z' })).toMatchObject({
      level: 'mock-credential-expired',
      canChangeRisk: false
    });
    expect(adapter.evaluate({ credentialId: 'mock-vc:revoked', now: '2026-07-07T00:00:00.000Z' })).toMatchObject({
      level: 'mock-credential-revoked',
      canBypassAnchor: false
    });
  });

  it('ships deterministic offline fixture credentials without private data fields', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../examples/fixtures/mock-credentials.json', import.meta.url), 'utf8')) as {
      credentials: MockTrustCredential[];
    };

    expect(fixture.credentials).toHaveLength(2);
    expect(fixture.credentials.map((item) => item.subject.role).sort()).toEqual(['issuer', 'verifier']);
    expect(JSON.stringify(fixture)).not.toMatch(/privateKey|seed|mnemonic|accessToken|refreshToken/i);
  });
});
