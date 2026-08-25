import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

function extractEvidencePackJson(output) {
  const match = output.match(/--- Evidence Pack JSON ---\n(?<json>[\s\S]*?)\n--- Report Markdown ---/);
  assert.ok(match?.groups?.json, 'demo output must include an Evidence Pack JSON section');
  return JSON.parse(match.groups.json);
}

function runWithStubbedLocalOllama(candidates) {
  const code = `
    import { formatAiClaimDemo, runAiClaimDemo } from './scripts/ai-claim-demo.ts';

    const candidates = ${JSON.stringify(candidates)};
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ response: JSON.stringify({ candidates }) }),
      text: async () => ''
    });

    (async () => {
      const summary = await runAiClaimDemo({
        provider: 'ollama',
        model: 'gemma4:12b',
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        fetchImpl
      });
      console.log(formatAiClaimDemo(summary));
      console.log('\\n--- Evidence Pack JSON ---');
      console.log(summary.evidenceJson);
      console.log('\\n--- Report Markdown ---');
      console.log(summary.reportMarkdown);
    })().catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `;

  return execFileSync('pnpm', ['exec', 'tsx', '--eval', code], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CLAIMGATE_LOCAL_LLM_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:11434' }
  });
}

const mofaSafetyCandidate = {
  id: 'ai-candidate-001',
  text: '협력국 A는 제한 없는 현장 활동이 가능한 안전·안정 상태입니다.',
  subject: '협력국 A 안전 상태',
  state: 'extracted',
  aiValue: '안전·안정'
};

test('Local Gemma/Ollama RAG path transforms a candidate-only response into reviewed Evidence Pack output', () => {
  const output = runWithStubbedLocalOllama([mofaSafetyCandidate]);

  assert.match(output, /ClaimGate Local Gemma 4 12B RAG 데모/);
  assert.match(output, /로컬 후보 추출기: ollama \(gemma4:12b\)/);
  assert.match(output, /RAG 회수 문서: .*mofa-country-safety-information/);
  assert.match(output, /RAG 구현: repo-local persistent sparse-vector RAG index; no external vector DB/);
  assert.ok(output.includes('튜닝 산출물: committed production tuning artifact 없음; local smoke/prototype LoRA adapters are pipeline evidence only'));
  assert.match(output, /결정론적 규칙: mofa\.country-safety-mismatch => 위험\/충돌/);
  assert.match(output, /AI 권한: 후보 제안 전용/);
  assert.match(output, /검토자 판정: 정정 완료/);
  assert.match(output, /근거 묶음 항목: 1/);
  assert.match(output, /"aiAuthority": "candidate-only"/);

  const pack = extractEvidencePackJson(output);
  assert.equal(pack.items[0].claimText, '협력국 A는 제한 없는 현장 활동이 가능한 안전·안정 상태입니다.');
  assert.equal(pack.items[0].reviewerDecision, 'corrected');
  assert.equal(pack.items[0].normalizedValue, '특별여행주의보·신변안전 유의');
  assert.equal(pack.items[0].correctionHistory[0].originalAiValue, '안전·안정');
  assert.equal(pack.items[0].correctionHistory[0].correctedValue, '특별여행주의보·신변안전 유의');
  assert.equal(pack.metadata.aiAuthority, 'candidate-only');
  assert.equal(pack.metadata.ragRetrievalMode, 'repo-local persistent sparse-vector RAG index; no external vector DB');
  assert.equal(pack.metadata.promptVersion, 'claimgate-local-gemma-candidate-only-v0');
  assert.equal(pack.metadata.tuningArtifactStatus, 'committed production tuning artifact 없음; local smoke/prototype LoRA adapters are pipeline evidence only');
  assert.equal('riskLevel' in pack.metadata, false);
  assert.equal('verified' in pack.metadata, false);
  assert.equal('projected' in pack.metadata, false);
});

test('explicit serving-ready LoRA adapter path replaces Ollama candidate generation without gaining judge authority', () => {
  const code = `
    import { formatAiClaimDemo, runAiClaimDemo } from './scripts/ai-claim-demo.ts';
    (async () => {
      const summary = await runAiClaimDemo({
        provider: 'ollama',
        adapterPath: 'artifacts/local-ai/gemma-candidate-lora-serving-ready',
        loraInferImpl: async () => (${JSON.stringify([mofaSafetyCandidate])})
      });
      console.log(formatAiClaimDemo(summary));
      console.log(summary.evidenceJson);
    })().catch((error) => { console.error(error); process.exit(1); });
  `;
  const output = execFileSync('pnpm', ['exec', 'tsx', '--eval', code], { cwd: process.cwd(), encoding: 'utf8' });
  assert.match(output, /로컬 후보 추출기: lora/);
  assert.match(output, /gemma-candidate-lora-serving-ready/);
  assert.match(output, /bounded holdout 3\/3/);
  assert.match(output, /AI 권한: 후보 제안 전용/);
  assert.match(output, /"aiAuthority": "candidate-only"/);
});

test('Ollama provider fails loud when local Gemma server is unavailable', () => {
  assert.throws(
    () => execFileSync('pnpm', ['exec', 'tsx', 'scripts/ai-claim-demo.ts', '--provider=ollama', '--ollama-base-url=http://127.0.0.1:1'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CLAIMGATE_LOCAL_LLM_PROVIDER: 'ollama' },
      stdio: 'pipe'
    }),
    /ClaimGate Local Gemma RAG demo failed: fetch failed|ECONNREFUSED|candidate extraction failed/
  );
});

test('Ollama provider rejects non-local endpoints before any model call', () => {
  assert.throws(
    () => execFileSync('pnpm', ['exec', 'tsx', 'scripts/ai-claim-demo.ts', '--provider=ollama', '--ollama-base-url=https://api.example.com'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CLAIMGATE_LOCAL_LLM_PROVIDER: 'ollama' },
      stdio: 'pipe'
    }),
    /Ollama endpoint must be local/
  );
});

test('Ollama provider rejects empty or URL-like model tags before any model call', () => {
  assert.throws(
    () => execFileSync('pnpm', ['exec', 'tsx', 'scripts/ai-claim-demo.ts', '--provider=ollama', '--model='], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CLAIMGATE_LOCAL_LLM_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:11434' },
      stdio: 'pipe'
    }),
    /Local Gemma model tag must be non-empty/
  );

  assert.throws(
    () => execFileSync('pnpm', ['exec', 'tsx', 'scripts/ai-claim-demo.ts', '--provider=ollama', '--model=https://api.example.com/model'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CLAIMGATE_LOCAL_LLM_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:11434' },
      stdio: 'pipe'
    }),
    /Local Gemma model tag must not be a URL/
  );
});

test('Ollama provider does not auto-promote AI-proposed anchors into Evidence Pack source anchors', () => {
  const output = runWithStubbedLocalOllama([
    {
      ...mofaSafetyCandidate,
      id: 'ai-candidate-ollama',
      proposedAnchor: {
        kind: 'text-span',
        sourceId: 'ai-made-up-source',
        startOffset: 0,
        endOffset: 3
      }
    }
  ]);

  const pack = extractEvidencePackJson(output);
  assert.equal(pack.items[0].sourceAnchor.sourceId, 'mofa-country-safety-information');
  assert.equal(JSON.stringify(pack).includes('ai-made-up-source'), false);
  assert.equal(pack.metadata.aiAuthority, 'candidate-only');
});

test('Ollama provider fails loud instead of attaching MOFA safety anchor to an unrelated candidate', () => {
  assert.throws(
    () => runWithStubbedLocalOllama([
      {
        id: 'ai-candidate-unrelated',
        text: 'KOICA는 국가 B에서 농촌 식수 사업을 수행합니다.',
        subject: 'KOICA 협력사업',
        state: 'extracted',
        aiValue: '국가-b|2022-2026|koica'
      }
    ]),
    /No MOFA safety candidate matched RAG safety scenario/
  );
});

test('Ollama provider fails loud when RAG retrieval has no lexical hits', () => {
  assert.throws(
    () => execFileSync('pnpm', ['exec', 'tsx', 'scripts/ai-claim-demo.ts', '--provider=ollama', '--text=zzzz qqqq xxxx'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, CLAIMGATE_LOCAL_LLM_PROVIDER: 'ollama', OLLAMA_BASE_URL: 'http://127.0.0.1:11434' },
      stdio: 'pipe'
    }),
    /RAG retrieval returned no hits/
  );
});
