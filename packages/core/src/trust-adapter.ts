export type TrustCredentialRef = `mock-vc:${string}` | string;

export type TrustCredentialRole = 'issuer' | 'verifier';

export type TrustSignalLevel = 'missing' | 'mock-credential-valid' | 'mock-credential-expired' | 'mock-credential-revoked';

export type TrustSignalAuthority = 'context-only';

export const TRUST_SIGNAL_CONTEXT_ONLY_NOTICE =
  'Trust signals are review context only; Source Anchors, deterministic risk rules, and human reviewer decisions remain authoritative.' as const;

export interface MockTrustCredentialSubject {
  readonly id: string;
  readonly role: TrustCredentialRole;
  readonly name?: string;
}

export interface MockTrustCredentialProof {
  readonly type: 'mock-signature';
  readonly value: string;
}

export interface MockTrustCredential {
  readonly id: TrustCredentialRef;
  readonly issuer: string;
  readonly subject: MockTrustCredentialSubject;
  readonly issuedAt: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly claims: Readonly<Record<string, string | number | boolean>>;
  readonly proof: MockTrustCredentialProof;
}

export interface TrustSignal {
  readonly credentialRef: TrustCredentialRef;
  readonly level: TrustSignalLevel;
  readonly subjectId?: string;
  readonly subjectRole?: TrustCredentialRole;
  readonly issuer?: string;
  readonly authority: TrustSignalAuthority;
  readonly nonAuthorityNotice: typeof TRUST_SIGNAL_CONTEXT_ONLY_NOTICE;
  readonly canVerifyClaim: false;
  readonly canChangeRisk: false;
  readonly canBypassAnchor: false;
  readonly warnings: readonly string[];
}

export interface TrustEvaluationInput {
  readonly credentialId: TrustCredentialRef;
  readonly now?: string;
}

export interface TrustAdapter {
  readonly id: string;
  readonly mode: 'offline-mock';
  evaluate(input: TrustEvaluationInput): TrustSignal;
  listCredentials(): readonly MockTrustCredential[];
}

export function credentialRef(value: TrustCredentialRef): TrustCredentialRef {
  return value;
}

export function createMockTrustAdapter(credentials: readonly MockTrustCredential[], id = 'claimgate-offline-mock-trust-adapter'): TrustAdapter {
  const frozenCredentials = Object.freeze(credentials.map(freezeCredential));
  const byId = new Map<TrustCredentialRef, MockTrustCredential>(frozenCredentials.map((credential) => [credential.id, credential]));

  return Object.freeze({
    id,
    mode: 'offline-mock' as const,
    evaluate(input: TrustEvaluationInput): TrustSignal {
      const credential = byId.get(input.credentialId);
      if (!credential) {
        return createSignal(input.credentialId, 'missing', ['No matching offline mock credential was found.']);
      }

      if (credential.revokedAt) {
        return createSignal(credential.id, 'mock-credential-revoked', [`Mock credential was revoked at ${credential.revokedAt}.`], credential);
      }

      if (credential.expiresAt && input.now && Date.parse(credential.expiresAt) <= Date.parse(input.now)) {
        return createSignal(credential.id, 'mock-credential-expired', [`Mock credential expired at ${credential.expiresAt}.`], credential);
      }

      return createSignal(
        credential.id,
        'mock-credential-valid',
        credential.expiresAt && !input.now ? ['Expiration was not evaluated because no deterministic evaluation time was provided.'] : [],
        credential
      );
    },
    listCredentials(): readonly MockTrustCredential[] {
      return frozenCredentials;
    }
  });
}

function createSignal(
  credentialRefValue: TrustCredentialRef,
  level: TrustSignalLevel,
  warnings: readonly string[],
  credential?: MockTrustCredential
): TrustSignal {
  return Object.freeze({
    credentialRef: credentialRefValue,
    level,
    ...(credential
      ? {
          subjectId: credential.subject.id,
          subjectRole: credential.subject.role,
          issuer: credential.issuer
        }
      : {}),
    authority: 'context-only' as const,
    nonAuthorityNotice: TRUST_SIGNAL_CONTEXT_ONLY_NOTICE,
    canVerifyClaim: false as const,
    canChangeRisk: false as const,
    canBypassAnchor: false as const,
    warnings: Object.freeze([...warnings])
  });
}

function freezeCredential(credential: MockTrustCredential): MockTrustCredential {
  return Object.freeze({
    ...credential,
    subject: Object.freeze({ ...credential.subject }),
    claims: Object.freeze({ ...credential.claims }),
    proof: Object.freeze({ ...credential.proof })
  });
}
