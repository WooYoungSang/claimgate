package main

import (
	"encoding/json"
	"strings"
	"testing"
)

// seedScenario puts one ACTIVE scenario in place, which most modelling records
// need to reference. It also exercises container bootstrapping: the fixture
// store predates these kinds and has no ddd_scenarios array at all.
func seedScenario(t *testing.T, path, id string) {
	t.Helper()
	_, stderr, code := invoke(t, "create", "scenario", id, "--kb", path,
		"--field", "title=판정 하나를 지시서로 확정한다",
		"--field", "status=ACTIVE",
		"--field", "outcome=여섯 값이 확정되어 프로세스 밖에 남는다",
		"--field", "importance=사전 확정이 이 시스템의 본질이다",
	)
	if code != 0 {
		t.Fatalf("seed scenario %s: %s", id, stderr)
	}
}

func TestCreateBootstrapsModellingContainerAndIndexes(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")

	stdout, stderr, code := invoke(t, "get", "scenario", "S-6", "--kb", path)
	if code != 0 {
		t.Fatalf("get after create: %s", stderr)
	}
	if !strings.Contains(stdout, `"status": "ACTIVE"`) {
		t.Fatalf("stored scenario = %q", stdout)
	}

	data := readFile(t, path)
	if !strings.Contains(string(data), `"ddd_scenario_ids"`) {
		t.Fatal("index does not list the newly created kind")
	}
	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify after bootstrap: stdout=%q stderr=%q", stdout, stderr)
	}
}

// A store that has no modelling records must round-trip byte-identically, so
// adding these kinds cannot rewrite every existing knowledge base on first use.
func TestUnusedModellingKindsLeaveIndexUntouched(t *testing.T) {
	path := copyFixtureKB(t)
	before := string(readFile(t, path))
	if _, stderr, code := invoke(t, "update", "decision", "sample-decision-alpha",
		"--field", "status=active", "--kb", path); code != 0 {
		t.Fatalf("update: %s", stderr)
	}
	after := string(readFile(t, path))
	if strings.Contains(after, "ddd_") {
		t.Fatal("index gained modelling keys with no modelling records present")
	}
	if strings.Count(before, "\n") != strings.Count(after, "\n") {
		t.Fatal("index layout changed on a store with no modelling records")
	}
}

// The guards below are the point of the whole lane: an unknown must be recorded
// rather than filled, a claim of fact must carry its source, and the metaphor
// must not follow the design into the code's vocabulary.
func TestModellingRecordsRejectUnsupportedClaims(t *testing.T) {
	path := copyFixtureKB(t)

	// The production leak-word list starts empty, so the mechanism is armed here
	// with a test-scoped word instead.
	restore := metaphorLeakWords
	metaphorLeakWords = []string{"Fare"}
	defer func() { metaphorLeakWords = restore }()
	seedScenario(t, path, "S-6")

	cases := []struct {
		name string
		args []string
		want string
	}{
		{
			name: "fact without evidence",
			args: []string{"create", "rule", "R-1", "--field", "statement=x",
				"--field", "scenario=S-6", "--field", "status=KNOWN"},
			want: "needs evidence",
		},
		{
			name: "evidence field saying none",
			args: []string{"create", "rule", "R-2", "--field", "statement=x",
				"--field", "scenario=S-6", "--field", "status=KNOWN", "--field", "evidence=없음"},
			want: "needs evidence",
		},
		{
			name: "unknown without a question",
			args: []string{"create", "rule", "R-3", "--field", "statement=x",
				"--field", "scenario=S-6", "--field", "status=UNKNOWN"},
			want: "needs a question",
		},
		{
			name: "conflicted without a question",
			args: []string{"create", "rule", "R-4", "--field", "statement=x",
				"--field", "scenario=S-6", "--field", "status=CONFLICTED"},
			want: "needs a question",
		},
		{
			name: "unknown rule status",
			args: []string{"create", "rule", "R-5", "--field", "statement=x",
				"--field", "scenario=S-6", "--field", "status=PROBABLY"},
			want: "invalid rule status",
		},
		{
			name: "spec key that is not a canon key",
			args: []string{"create", "rule", "R-6", "--field", "statement=x",
				"--field", "scenario=S-6", "--field", "status=KNOWN",
				"--field", "evidence=spec.md", "--field", "spec_key=RULE-9"},
			want: "must be INV-n, CON-n or OPEN-n",
		},
		{
			name: "question that is a statement",
			args: []string{"create", "question", "KG-1", "--field", "question=목표는 시스템의 규칙이다.",
				"--field", "source=R-1", "--field", "status=OPEN"},
			want: "not interrogative",
		},
		{
			name: "answered question with no answer",
			args: []string{"create", "question", "KG-2", "--field", "question=사건인가?",
				"--field", "source=R-1", "--field", "status=ANSWERED"},
			want: "carries no answer",
		},
		{
			name: "metaphor word in a Go identifier",
			args: []string{"create", "term", "T-1", "--field", "doc=뱃삯", "--field", "go=Fare",
				"--field", "definition=왕복 비용", "--field", "not_a=세금이 아니다"},
			want: "borrow the structure, not the vocabulary",
		},
		{
			name: "anemic suffix",
			args: []string{"create", "term", "T-2", "--field", "doc=판정", "--field", "go=VerdictService",
				"--field", "definition=산다 또는 기권", "--field", "not_a=주문이 아니다"},
			want: "behaviour leaks out of an aggregate",
		},
		{
			name: "delta axis outside the six",
			args: []string{"create", "delta", "M-1", "--field", "metaphor=a", "--field", "domain=b",
				"--field", "mismatch=c", "--field", "axis=기타", "--field", "question=KG-9"},
			want: "invalid delta axis",
		},
		{
			name: "identity that does not match its kind",
			args: []string{"create", "scenario", "SCENARIO-1", "--field", "title=x",
				"--field", "status=WAITING", "--field", "outcome=y", "--field", "importance=z"},
			want: "must match",
		},
		{
			name: "term without what it is not",
			args: []string{"create", "term", "T-3", "--field", "doc=지시서", "--field", "go=TradePlan",
				"--field", "definition=여섯 값의 묶음"},
			want: `"not_a"`,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			args := append(append([]string{}, testCase.args...), "--kb", path)
			_, stderr, code := invoke(t, args...)
			if code == 0 {
				t.Fatalf("accepted %v", testCase.args)
			}
			if !strings.Contains(stderr, testCase.want) {
				t.Fatalf("stderr = %q, want it to mention %q", stderr, testCase.want)
			}
		})
	}
}

func TestModellingRecordsAcceptSupportedClaims(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")

	steps := [][]string{
		{"create", "question", "KG-10",
			"--field", "question=판정은 그 봉 한 번의 사건인가, 지속되는 상태인가?",
			"--field", "source=R-50", "--field", "status=ANSWERED",
			"--field", "answer=사건이다", "--field", "blocks=S-6"},
		{"create", "rule", "R-50",
			"--field", "statement=앞 봉의 판정은 다음 봉으로 넘어오지 않는다",
			"--field", "scenario=S-6", "--field", "status=VERIFIED",
			"--field", "evidence=운영자 2026-08-16", "--field", "question=KG-10",
			"--field", "spec_key=INV-6"},
		{"create", "rule", "R-35",
			"--field", "statement=전략은 판정하는 그 봉 이후의 값을 볼 수 없다",
			"--field", "scenario=S-6", "--field", "status=KNOWN",
			"--field", "evidence=spec.md INV-6", "--field", "spec_key=INV-6"},
		{"create", "term", "T-1", "--field", "doc=지시서", "--field", "go=TradePlan",
			"--field", "kind=aggregate-root", "--field", "definition=주문 전에 확정되는 여섯 값의 묶음",
			"--field", "not_a=항구에 제출된 주문이 아니다"},
	}
	for _, step := range steps {
		args := append(append([]string{}, step...), "--kb", path)
		if _, stderr, code := invoke(t, args...); code != 0 {
			t.Fatalf("%v rejected: %s", step, stderr)
		}
	}

	stdout, stderr, code := invoke(t, "list", "rule", "--kb", path, "--filter", "status=KNOWN")
	if code != 0 {
		t.Fatalf("list: %s", stderr)
	}
	if !strings.Contains(stdout, "R-35") || strings.Contains(stdout, "R-50") {
		t.Fatalf("filtered list = %q, want only the KNOWN rule", stdout)
	}
	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: stdout=%q stderr=%q", stdout, stderr)
	}
}

func TestMetaphorMappingRecordsRenderAndVerify(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	invokeOK(t, path, "create", "metaphor", "MET-1",
		"--field", "area=목표 수심 맞추기", "--field", "status=ACTIVE", "--field", "valid_for=상태 정렬",
		"--field", "attack_state=부분 상태")
	invokeOK(t, path, "create", "mapping", "MAP-1",
		"--field", "metaphor_id=MET-1", "--field", "metaphor=목표 수심",
		"--field", "domain=목표 포지션", "--field", "meaning=도달할 상태",
		"--field", "confidence=HIGH", "--field", "mismatch=부호 상태",
		"--field", "question=허용 값은 무엇인가?")

	stdout, stderr, code := invoke(t, "render", "metaphor", "--kb", path)
	if code != 0 {
		t.Fatalf("render: %s", stderr)
	}
	for _, want := range []string{"## 매핑", "MAP-1", "목표 수심", "목표 포지션", "HIGH", "## 공격 기록", "부분 상태"} {
		if !strings.Contains(stdout, want) {
			t.Fatalf("rendered mapping lacks %q: %s", want, stdout)
		}
	}
	assertIndexContains(t, path, "ddd_mapping_ids", "MAP-1")
	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: stdout=%q stderr=%q", stdout, stderr)
	}

	if _, stderr, code := invoke(t, "create", "mapping", "MAP-2", "--kb", path,
		"--field", "metaphor_id=MET-1", "--field", "metaphor=x", "--field", "domain=y",
		"--field", "meaning=z", "--field", "confidence=VERY_HIGH"); code == 0 || !strings.Contains(stderr, "HIGH|MEDIUM|LOW") {
		t.Fatalf("invalid confidence accepted: code=%d stderr=%q", code, stderr)
	}
}

// These are the checks no single record can make, so they land in verify rather
// than in create.
func TestVerifyReportsCrossRecordDefects(t *testing.T) {
	t.Run("dangling question reference", func(t *testing.T) {
		path := copyFixtureKB(t)
		seedScenario(t, path, "S-6")
		if _, stderr, code := invoke(t, "create", "delta", "M-1", "--kb", path,
			"--field", "metaphor=화물은 실리거나 안 실린다",
			"--field", "domain=항구가 주문의 일부만 채울 수 있다",
			"--field", "mismatch=절반이라는 상태가 은유에 없다",
			"--field", "axis=상태", "--field", "question=KG-777"); code != 0 {
			t.Fatalf("create delta: %s", stderr)
		}
		stdout, _, code := invoke(t, "verify", "--kb", path)
		if code == 0 || !strings.Contains(stdout, "KG-777 does not exist") {
			t.Fatalf("verify stdout=%q code=%d", stdout, code)
		}
	})

	t.Run("two active scenarios", func(t *testing.T) {
		path := copyFixtureKB(t)
		seedScenario(t, path, "S-6")
		seedScenario(t, path, "S-7")
		stdout, _, code := invoke(t, "verify", "--kb", path)
		if code == 0 || !strings.Contains(stdout, "2 ACTIVE") {
			t.Fatalf("verify stdout=%q code=%d", stdout, code)
		}
	})

	t.Run("glossary stops being a bijection", func(t *testing.T) {
		path := copyFixtureKB(t)
		for _, id := range []string{"T-1", "T-2"} {
			if _, stderr, code := invoke(t, "create", "term", id, "--kb", path,
				"--field", "doc=개념"+id, "--field", "go=TradePlan",
				"--field", "definition=x", "--field", "not_a=y"); code != 0 {
				t.Fatalf("create %s: %s", id, stderr)
			}
		}
		stdout, _, code := invoke(t, "verify", "--kb", path)
		if code == 0 || !strings.Contains(stdout, `Go name "TradePlan" already used`) {
			t.Fatalf("verify stdout=%q code=%d", stdout, code)
		}
	})

	t.Run("rule pointing at a scenario that does not exist", func(t *testing.T) {
		path := copyFixtureKB(t)
		seedScenario(t, path, "S-6")
		if _, stderr, code := invoke(t, "create", "rule", "R-1", "--kb", path,
			"--field", "statement=x", "--field", "scenario=S-9",
			"--field", "status=KNOWN", "--field", "evidence=spec.md"); code != 0 {
			t.Fatalf("create rule: %s", stderr)
		}
		stdout, _, code := invoke(t, "verify", "--kb", path)
		if code == 0 || !strings.Contains(stdout, "scenario S-9 does not exist") {
			t.Fatalf("verify stdout=%q code=%d", stdout, code)
		}
	})
}

func TestStringsOfReadsOneOrManyReferences(t *testing.T) {
	cases := map[string][]string{
		"KG-7":          {"KG-7"},
		"KG-7 KG-13":    {"KG-7", "KG-13"},
		"KG-7, KG-13":   {"KG-7", "KG-13"},
		"INV-1 · INV-2": {"INV-1", "INV-2"},
		"   ":           nil,
		"":              nil,
	}
	for input, want := range cases {
		got := stringsOf(map[string]any{"f": input}, "f")
		if len(got) != len(want) {
			t.Fatalf("stringsOf(%q) = %v, want %v", input, got, want)
		}
		for i := range want {
			if got[i] != want[i] {
				t.Fatalf("stringsOf(%q) = %v, want %v", input, got, want)
			}
		}
	}
	array := stringsOf(map[string]any{"f": []any{"S-6", "S-7"}}, "f")
	if len(array) != 2 || array[0] != "S-6" || array[1] != "S-7" {
		t.Fatalf("array form = %v", array)
	}
}

func TestRenderWritesDerivedViewsAndSkipsEmptyOnes(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-2")
	if _, stderr, code := invoke(t, "create", "scenario", "S-10", "--kb", path,
		"--field", "title=집행 충실도를 잰다", "--field", "status=WAITING",
		"--field", "outcome=지시서와 체결이 함께 남는다",
		"--field", "importance=이것이 없으면 이탈을 잴 수 없다"); code != 0 {
		t.Fatalf("create S-10: %s", stderr)
	}

	root := t.TempDir()
	stdout, stderr, code := invoke(t, "render", "all", "--out", root, "--kb", path)
	if code != 0 {
		t.Fatalf("render: %s", stderr)
	}
	// A view of a kind with no records must not be written: the destination may
	// still hold hand-authored content that has not been migrated yet.
	if !strings.Contains(stdout, "skip glossary") || !strings.Contains(stdout, "skip rules") {
		t.Fatalf("render report = %q, want empty views skipped", stdout)
	}

	rendered := string(readFile(t, root+"/docs/design/ddd/00-problem/scenarios.md"))
	if !strings.Contains(rendered, "status: generated") ||
		!strings.Contains(rendered, "이 파일은 생성물이다") {
		t.Fatal("rendered view carries no generated-by banner")
	}
	// S-2 before S-10: a plain string sort puts S-10 first.
	if strings.Index(rendered, "| S-2 |") > strings.Index(rendered, "| S-10 |") {
		t.Fatal("scenarios are ordered as strings rather than by number")
	}
}

func TestRenderQuestionsIncludesDecisionQuestionnaire(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-1")
	invokeOK(t, path, "create", "question", "KG-1",
		"--field", "question=어떤 정책을 선택하는가?", "--field", "source=metaphor delta",
		"--field", "status=OPEN", "--field", "blocks=S-1", "--field", "priority=P0",
		"--field", "options=A. 느슨하게 처리\nB. 엄격하게 처리",
		"--field", "recommendation=B", "--field", "recommendation_reason=실패를 조용히 통과시키지 않는다")

	stdout, stderr, code := invoke(t, "render", "questions", "--kb", path)
	if code != 0 {
		t.Fatalf("render: %s", stderr)
	}
	for _, want := range []string{"## 결정 질문지", "### KG-1", "A. 느슨하게 처리", "**추천:** B", "실패를 조용히"} {
		if !strings.Contains(stdout, want) {
			t.Fatalf("questionnaire lacks %q: %s", want, stdout)
		}
	}
}

func TestRenderGlossaryUsesDomainLanguageInsteadOfMetaphorLanguage(t *testing.T) {
	path := copyFixtureKB(t)
	invokeOK(t, path, "create", "term", "T-1",
		"--field", "doc=목표 포지션", "--field", "go=TargetPosition",
		"--field", "kind=value-object", "--field", "definition=도달할 포지션",
		"--field", "not_a=목표 수심이 아니다")

	stdout, stderr, code := invoke(t, "render", "glossary", "--kb", path)
	if code != 0 {
		t.Fatalf("render: %s", stderr)
	}
	if !strings.Contains(stdout, "같은 Ubiquitous Language") || strings.Contains(stdout, "문서는 은유어") {
		t.Fatalf("glossary guidance is stale: %s", stdout)
	}
}

// A rule's key is fixed the moment another record cites it, so the rules of one
// scenario end up scattered through the key order. The view has to gather them:
// grouping on a changing value emitted the same heading once per run.
func TestRenderGroupsEachScenarioRulesUnderOneHeading(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-2")
	seedScenario(t, path, "S-10")
	for _, rule := range []struct{ id, scenario string }{
		{"R-1", "S-10"}, {"R-2", "S-2"}, {"R-3", "S-10"},
	} {
		if _, stderr, code := invoke(t, "create", "rule", rule.id, "--kb", path,
			"--field", "statement=정본이 말하는 것", "--field", "scenario="+rule.scenario,
			"--field", "status=KNOWN", "--field", "evidence=spec.md §2"); code != 0 {
			t.Fatalf("create %s: %s", rule.id, stderr)
		}
	}

	root := t.TempDir()
	if _, stderr, code := invoke(t, "render", "rules", "--out", root, "--kb", path); code != 0 {
		t.Fatalf("render: %s", stderr)
	}
	rendered := string(readFile(t, root+"/docs/design/ddd/01-discovery/rules.md"))
	if got := strings.Count(rendered, "\n## S-10\n"); got != 1 {
		t.Fatalf("S-10 heading appears %d times, want 1", got)
	}
	// S-2 before S-10: a plain string sort puts S-10 first.
	if strings.Index(rendered, "\n## S-2\n") > strings.Index(rendered, "\n## S-10\n") {
		t.Fatal("scenario headings are ordered as strings rather than by number")
	}
	section := rendered[strings.Index(rendered, "\n## S-10\n"):]
	if strings.Index(section, "| R-1 |") > strings.Index(section, "| R-3 |") {
		t.Fatal("rules inside a scenario lost their key order")
	}
}

func TestRenderRejectsUnknownView(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t, "render", "aggregates", "--kb", path)
	if code == 0 || !strings.Contains(stderr, "unknown view") {
		t.Fatalf("stderr = %q code = %d", stderr, code)
	}
}

// TestResetDDDEmptiesAllSixKindsAndLeavesOtherRecordsAlone exercises the
// operator-requested restart: every modelling record gone, nothing else
// touched, and the store still verifies clean afterward.
func TestResetDDDEmptiesAllSixKindsAndLeavesOtherRecordsAlone(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	if _, stderr, code := invoke(t, "create", "rule", "R-1", "--kb", path,
		"--field", "statement=정본이 말하는 것", "--field", "scenario=S-6",
		"--field", "status=KNOWN", "--field", "evidence=spec.md §2"); code != 0 {
		t.Fatalf("create rule: %s", stderr)
	}
	if _, stderr, code := invoke(t, "create", "question", "KG-1", "--kb", path,
		"--field", "question=답이 있는가?", "--field", "source=Step 2",
		"--field", "status=OPEN"); code != 0 {
		t.Fatalf("create question: %s", stderr)
	}
	if _, stderr, code := invoke(t, "create", "command", "CMD-1", "--kb", path,
		"--field", "name=시작한다", "--field", "actor=사용자", "--field", "scenario=S-6",
		"--field", "produces=EVT-1"); code != 0 {
		t.Fatalf("create command: %s", stderr)
	}
	if _, stderr, code := invoke(t, "create", "event", "EVT-1", "--kb", path,
		"--field", "name=시작됐다", "--field", "scenario=S-6", "--field", "command=CMD-1"); code != 0 {
		t.Fatalf("create event: %s", stderr)
	}

	before := readFile(t, fixtureKBPath())
	var beforeDecoded map[string]any
	if err := json.Unmarshal(before, &beforeDecoded); err != nil {
		t.Fatal(err)
	}

	if stdout, stderr, code := invoke(t, "reset", "ddd", "--kb", path); code != 0 {
		t.Fatalf("reset ddd: stdout=%q stderr=%q", stdout, stderr)
	}

	var decoded map[string]any
	if err := json.Unmarshal(readFile(t, path), &decoded); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"ddd_scenarios", "ddd_rules", "ddd_questions",
		"ddd_metaphor_deltas", "ddd_terms", "ddd_metaphors", "ddd_metaphor_mappings", "ddd_events", "ddd_commands"} {
		list, ok := decoded[key].([]any)
		if !ok {
			t.Fatalf("%s is not an array after reset: %v", key, decoded[key])
		}
		if len(list) != 0 {
			t.Fatalf("%s has %d records after reset, want 0", key, len(list))
		}
	}
	if decisions, ok := decoded["decisions"].([]any); !ok || len(decisions) != len(beforeDecoded["decisions"].([]any)) {
		t.Fatal("reset ddd touched non-DDD records")
	}
	if openIssues, ok := decoded["open_issues"].([]any); !ok || len(openIssues) != len(beforeDecoded["open_issues"].([]any)) {
		t.Fatal("reset ddd touched non-DDD records")
	}

	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify after reset: stdout=%q stderr=%q", stdout, stderr)
	}
	if _, stderr, code := invoke(t, "get", "scenario", "S-6", "--kb", path); code == 0 || !strings.Contains(stderr, "not_found") {
		t.Fatalf("scenario S-6 still readable after reset: stderr=%q", stderr)
	}
}

func TestResetRejectsUnknownKind(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t, "reset", "roadmap", "--kb", path)
	if code == 0 || !strings.Contains(stderr, "usage: kbctl reset ddd") {
		t.Fatalf("stderr = %q code = %d", stderr, code)
	}
}

// TestCommandProducesEventRoundTrips exercises Step 11's whole point: a
// command names the event it produces, and verify confirms both ends exist
// and agree with each other.
func TestCommandProducesEventRoundTrips(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	if _, stderr, code := invoke(t, "create", "command", "CMD-1", "--kb", path,
		"--field", "name=지시서를 확정한다", "--field", "actor=시스템", "--field", "scenario=S-6",
		"--field", "precondition=판정이 났다", "--field", "produces=EVT-1"); code != 0 {
		t.Fatalf("create command: %s", stderr)
	}
	if _, stderr, code := invoke(t, "create", "event", "EVT-1", "--kb", path,
		"--field", "name=지시서가 확정됐다", "--field", "scenario=S-6", "--field", "command=CMD-1"); code != 0 {
		t.Fatalf("create event: %s", stderr)
	}
	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: stdout=%q stderr=%q", stdout, stderr)
	}
	stdout, stderr, code := invoke(t, "get", "event", "EVT-1", "--kb", path)
	if code != 0 {
		t.Fatalf("get event: %s", stderr)
	}
	if !strings.Contains(stdout, "지시서가 확정됐다") {
		t.Fatalf("stored event = %q", stdout)
	}
}

// TestCommandWithoutProducesFailsVerify guards Step 11's actual discipline --
// a command that never names its event is a command whose effect was never
// pinned down, and that has to surface as a verify finding, not silence.
func TestCommandWithoutProducesFailsVerify(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	if _, stderr, code := invoke(t, "create", "command", "CMD-1", "--kb", path,
		"--field", "name=지시서를 확정한다", "--field", "actor=시스템", "--field", "scenario=S-6"); code != 0 {
		t.Fatalf("create command: %s", stderr)
	}
	stdout, _, code := invoke(t, "verify", "--kb", path)
	if code == 0 {
		t.Fatal("verify passed with a command that produces no event")
	}
	if !strings.Contains(stdout, "CMD-1: produces no event") {
		t.Fatalf("stdout = %q, want a produces-no-event finding", stdout)
	}
}

// TestEventCommandDanglingReferencesFailVerify covers both directions: a
// command pointing at an event that does not exist, and an event pointing at
// a command that does not exist.
func TestEventCommandDanglingReferencesFailVerify(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	if _, stderr, code := invoke(t, "create", "command", "CMD-1", "--kb", path,
		"--field", "name=지시서를 확정한다", "--field", "actor=시스템", "--field", "scenario=S-6",
		"--field", "produces=EVT-404"); code != 0 {
		t.Fatalf("create command: %s", stderr)
	}
	stdout, _, code := invoke(t, "verify", "--kb", path)
	if code == 0 || !strings.Contains(stdout, "CMD-1: produces EVT-404, which does not exist") {
		t.Fatalf("stdout = %q code = %d, want a dangling produces finding", stdout, code)
	}
}

func TestEventAndCommandRejectEmptyName(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	if _, stderr, code := invoke(t, "create", "command", "CMD-1", "--kb", path,
		"--field", "actor=시스템", "--field", "scenario=S-6"); code == 0 || !strings.Contains(stderr, `required narrative field "name"`) {
		t.Fatalf("stderr = %q code = %d", stderr, code)
	}
	if _, stderr, code := invoke(t, "create", "event", "EVT-1", "--kb", path,
		"--field", "scenario=S-6"); code == 0 || !strings.Contains(stderr, `required narrative field "name"`) {
		t.Fatalf("stderr = %q code = %d", stderr, code)
	}
}

func TestRenderEventsShowsCommandsAndEvents(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	if _, stderr, code := invoke(t, "create", "command", "CMD-1", "--kb", path,
		"--field", "name=지시서를 확정한다", "--field", "actor=시스템", "--field", "scenario=S-6",
		"--field", "produces=EVT-1"); code != 0 {
		t.Fatalf("create command: %s", stderr)
	}
	if _, stderr, code := invoke(t, "create", "event", "EVT-1", "--kb", path,
		"--field", "name=지시서가 확정됐다", "--field", "scenario=S-6", "--field", "command=CMD-1"); code != 0 {
		t.Fatalf("create event: %s", stderr)
	}
	root := t.TempDir()
	if _, stderr, code := invoke(t, "render", "events", "--out", root, "--kb", path); code != 0 {
		t.Fatalf("render: %s", stderr)
	}
	rendered := string(readFile(t, root+"/docs/design/ddd/05-events/events.md"))
	if !strings.Contains(rendered, "지시서를 확정한다") || !strings.Contains(rendered, "지시서가 확정됐다") {
		t.Fatalf("rendered events view missing content: %q", rendered)
	}
}

// TestCommandCanProduceMultipleEvents covers the case a real S-1 trigger
// needed: one command (losing sight of the market) both enters the shared
// halt state and starts immediate liquidation -- two distinct events, one
// cause. Both must resolve and both directions of the reference must hold.
func TestCommandCanProduceMultipleEvents(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	if _, stderr, code := invoke(t, "create", "command", "CMD-1", "--kb", path,
		"--field", "name=연결이 끊긴 걸 감지한다", "--field", "actor=시스템", "--field", "scenario=S-6",
		"--field", "produces=EVT-1 EVT-2"); code != 0 {
		t.Fatalf("create command: %s", stderr)
	}
	if _, stderr, code := invoke(t, "create", "event", "EVT-1", "--kb", path,
		"--field", "name=멈춤 상태에 들어갔다", "--field", "scenario=S-6", "--field", "command=CMD-1"); code != 0 {
		t.Fatalf("create event EVT-1: %s", stderr)
	}
	if _, stderr, code := invoke(t, "create", "event", "EVT-2", "--kb", path,
		"--field", "name=즉시정리가 시도됐다", "--field", "scenario=S-6", "--field", "command=CMD-1"); code != 0 {
		t.Fatalf("create event EVT-2: %s", stderr)
	}
	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: stdout=%q stderr=%q", stdout, stderr)
	}
}

// TestEventCanNameMultipleProducingCommands covers the other direction: one
// event (halt state entered) that three independent triggers can each cause
// on their own. A dangling command in the list must still be caught.
func TestEventCanNameMultipleProducingCommands(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")
	for _, id := range []string{"CMD-1", "CMD-2"} {
		if _, stderr, code := invoke(t, "create", "command", id, "--kb", path,
			"--field", "name=방아쇠", "--field", "actor=시스템", "--field", "scenario=S-6",
			"--field", "produces=EVT-1"); code != 0 {
			t.Fatalf("create command %s: %s", id, stderr)
		}
	}
	if _, stderr, code := invoke(t, "create", "event", "EVT-1", "--kb", path,
		"--field", "name=멈춤 상태에 들어갔다", "--field", "scenario=S-6",
		"--field", "command=CMD-1 CMD-2"); code != 0 {
		t.Fatalf("create event: %s", stderr)
	}
	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: stdout=%q stderr=%q", stdout, stderr)
	}

	if _, stderr, code := invoke(t, "update", "event", "EVT-1", "--kb", path,
		"--field", "command=CMD-1 CMD-404"); code != 0 {
		t.Fatalf("update event: %s", stderr)
	}
	stdout, _, code := invoke(t, "verify", "--kb", path)
	if code == 0 || !strings.Contains(stdout, "EVT-1: command CMD-404 does not exist") {
		t.Fatalf("stdout = %q code = %d, want a dangling command finding", stdout, code)
	}
}

// Aggregate and use-case records implement protocol steps 12-14 and 18.
func TestAggregateAndUsecaseRecords(t *testing.T) {
	path := copyFixtureKB(t)
	seedScenario(t, path, "S-6")

	reject := [][2]string{
		{"aggregate with no protected rule",
			"create aggregate AGG-1 --field name=Bet --field context=BC-04 --field consistency=c --field states=captured"},
		{"aggregate with no states",
			"create aggregate AGG-1 --field name=Bet --field context=BC-04 --field consistency=c --field protects=R-1"},
		{"usecase without then",
			"create usecase UC-1 --field name=x --field command=CMD-1 --field scenario=S-6 --field given=g --field when=w"},
		{"bad aggregate id shape",
			"create aggregate AG-01 --field name=Bet --field context=BC-04 --field consistency=c --field protects=R-1 --field states=captured"},
	}
	for _, testCase := range reject {
		t.Run(testCase[0], func(t *testing.T) {
			args := append(strings.Fields(testCase[1]), "--kb", path)
			if _, _, code := invoke(t, args...); code == 0 {
				t.Fatalf("accepted %v", testCase[1])
			}
		})
	}

	steps := []string{
		"create rule R-1 --field statement=s --field scenario=S-6 --field status=KNOWN --field evidence=canon",
		"create event EVT-1 --field name=BetOpened --field scenario=S-6",
		"create command CMD-1 --field name=OpenBet --field actor=agent --field scenario=S-6 --field produces=EVT-1",
		"create aggregate AGG-1 --field name=Bet --field context=BC-04 --field consistency=one-transaction --field protects=R-1 --field states=captured,shaping",
		"create usecase UC-1 --field name=OpenBet --field command=CMD-1 --field scenario=S-6 --field aggregate=AGG-1 --field invariants=R-1 --field given=no-bet --field when=OpenBet --field then=captured+BetOpened",
	}
	for _, step := range steps {
		args := append(strings.Fields(step), "--kb", path)
		if _, stderr, code := invoke(t, args...); code != 0 {
			t.Fatalf("%s: %s", step, stderr)
		}
	}
	if _, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: %s", stderr)
	}
	assertIndexContains(t, path, "ddd_aggregate_ids", "AGG-1")
	assertIndexContains(t, path, "ddd_usecase_ids", "UC-1")

	// Dangling references must be reported by verify.
	invokeOK(t, path, "create", "usecase", "UC-2", "--field", "name=y",
		"--field", "command=CMD-99", "--field", "scenario=S-6",
		"--field", "given=g", "--field", "when=w", "--field", "then=t")
	stdout, _, _ := invoke(t, "verify", "--kb", path)
	if !strings.Contains(stdout, "CMD-99") {
		t.Fatalf("verify did not report the dangling command ref: %q", stdout)
	}
}

func invokeOK(t *testing.T, path string, args ...string) {
	t.Helper()
	full := append(append([]string{}, args...), "--kb", path)
	if _, stderr, code := invoke(t, full...); code != 0 {
		t.Fatalf("%v: %s", args, stderr)
	}
}

func assertIndexContains(t *testing.T, path, field, want string) {
	t.Helper()
	var root struct {
		Index map[string][]string `json:"_index"`
	}
	if err := json.Unmarshal(readFile(t, path), &root); err != nil {
		t.Fatal(err)
	}
	for _, got := range root.Index[field] {
		if got == want {
			return
		}
	}
	t.Fatalf("_index.%s = %v, want %q", field, root.Index[field], want)
}

// Operational lessons use the Lesson aggregate status vocabulary.
func TestLessonRecords(t *testing.T) {
	path := copyFixtureKB(t)

	reject := [][2]string{
		{"bad status", "create lesson L-1 --field lesson=x --field status=learned --field reuse=r"},
		{"verified without evidence", "create lesson L-1 --field lesson=x --field status=verified --field reuse=r"},
		{"no reuse recipe", "create lesson L-1 --field lesson=x --field status=raw"},
		{"bad id shape", "create lesson LESSON-1 --field lesson=x --field status=raw --field reuse=r"},
	}
	for _, testCase := range reject {
		t.Run(testCase[0], func(t *testing.T) {
			args := append(strings.Fields(testCase[1]), "--kb", path)
			if _, _, code := invoke(t, args...); code == 0 {
				t.Fatalf("accepted %v", testCase[1])
			}
		})
	}

	steps := []string{
		"create lesson L-1 --field lesson=check-pwd-before-dispatch --field status=raw --field reuse=run-pwd-first",
		"create lesson L-2 --field lesson=deps-ripple-both-ways --field status=verified --field reuse=update-registry --field evidence=gate-bit-on-shrink",
	}
	for _, step := range steps {
		args := append(strings.Fields(step), "--kb", path)
		if _, stderr, code := invoke(t, args...); code != 0 {
			t.Fatalf("%s: %s", step, stderr)
		}
	}
	if _, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: %s", stderr)
	}
	assertIndexContains(t, path, "lesson_ids", "L-1")
	assertIndexContains(t, path, "lesson_ids", "L-2")
	stdout, _, code := invoke(t, "list", "lesson", "--filter", "status=verified", "--kb", path)
	if code != 0 || !strings.Contains(stdout, "L-2") || strings.Contains(stdout, "L-1") {
		t.Fatalf("filtered list wrong: %q", stdout)
	}
	// reset ddd must NOT wipe lessons.
	if _, stderr, code := invoke(t, "reset", "ddd", "--kb", path); code != 0 {
		t.Fatalf("reset ddd: %s", stderr)
	}
	stdout, _, code = invoke(t, "get", "lesson", "L-2", "--kb", path)
	if code != 0 || !strings.Contains(stdout, "deps-ripple-both-ways") {
		t.Fatalf("lesson lost after reset ddd: %q", stdout)
	}
}
