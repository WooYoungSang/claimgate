package main

// Derived views.
//
// The modelling records are canon and these markdown files are generated from
// them. The direction matters: for a while the markdown was the original and a
// python script parsed it back, which meant every integrity rule was enforced
// against a rendering of the data rather than the data. Rendering one way only
// removes the class of drift where the document and the store disagree and
// neither is obviously wrong.
//
// A rendered file carries a generated-by banner so nobody edits it by hand and
// expects the edit to survive.

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type renderView struct {
	name        string
	destination string
	title       string
	// requires names the kind the view is a view OF. A view with no records
	// would render an empty document, and writing that over a file still holding
	// hand-authored content that has not been migrated yet would destroy it. So
	// an empty view is skipped on write rather than emitted.
	requires string
	render   func(*bytes.Buffer, map[string][]map[string]any)
}

var renderViews = []renderView{
	{"changes", "docs/design/changes.md", "설계 변경 이력", "change", renderChanges},
	{"scenarios", "docs/design/ddd/00-problem/scenarios.md", "비즈니스 시나리오", "scenario", renderScenarios},
	{"stories", "docs/design/ddd/01-discovery/domain-stories.md", "도메인 스토리", "scenario", renderStories},
	{"rules", "docs/design/ddd/01-discovery/rules.md", "규칙과 가정 원장", "rule", renderRules},
	{"metaphor", "docs/design/ddd/02-metaphor/metaphor.md", "은유 원장과 델타", "metaphor", renderMetaphor},
	{"questions", "docs/design/ddd/03-knowledge/knowledge-gaps.md", "도메인 질문 백로그", "question", renderQuestions},
	{"glossary", "docs/design/ddd/04-language/glossary.md", "편재 언어 용어집", "term", renderGlossary},
	{"events", "docs/design/ddd/05-events/events.md", "명령과 사건", "command", renderEvents},
}

func viewFor(name string) (renderView, error) {
	for _, view := range renderViews {
		if view.name == name {
			return view, nil
		}
	}
	names := make([]string, 0, len(renderViews))
	for _, view := range renderViews {
		names = append(names, view.name)
	}
	return renderView{}, fmt.Errorf("unknown view %q (%s|all)", name, strings.Join(names, "|"))
}

// numericSuffix orders S-2 before S-10, which a plain string sort does not.
func numericSuffix(id string) int {
	index := strings.LastIndex(id, "-")
	if index < 0 {
		return 0
	}
	value, err := strconv.Atoi(id[index+1:])
	if err != nil {
		return 0
	}
	return value
}

func loadModellingRecords(data []byte) (map[string][]map[string]any, error) {
	out := map[string][]map[string]any{}
	for _, kind := range []string{"change", "scenario", "rule", "question", "delta", "term", "metaphor", "mapping", "event", "command"} {
		definition, err := definitionFor(kind)
		if err != nil {
			return nil, err
		}
		items, err := recordsFor(data, definition)
		if err != nil {
			out[kind] = nil
			continue
		}
		values := make([]map[string]any, 0, len(items))
		for _, item := range items {
			values = append(values, item.value)
		}
		sort.Slice(values, func(i, j int) bool {
			left, _ := values[i]["id"].(string)
			right, _ := values[j]["id"].(string)
			if numericSuffix(left) != numericSuffix(right) {
				return numericSuffix(left) < numericSuffix(right)
			}
			return left < right
		})
		out[kind] = values
	}
	return out, nil
}

func renderChanges(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("변경 레코드는 append-only다. 현재 설계만이 아니라 왜, 누가, 무엇을 바꾸었고 어떻게 배포·복구하는지 보존한다.\n\n")
	buffer.WriteString("| 변경 | 대상 | 대체 대상 | 상태 | 행위자 | 기록 시각 | 적용 시각 | 영향 레코드 | 이유 |\n|---|---|---|---|---|---|---|---|---|\n")
	for _, item := range records["change"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "subject"), cell(item, "supersedes"), cell(item, "status"),
			cell(item, "actor"), cell(item, "recorded_at"), cell(item, "effective_at"),
			cell(item, "affected_records"), cell(item, "reason"))
	}
	for _, item := range records["change"] {
		fmt.Fprintf(buffer, "\n## %s · %s\n\n", id(item), cell(item, "subject"))
		for _, row := range []struct{ label, field string }{
			{"상태", "status"}, {"대체 대상", "supersedes"}, {"영향 레코드", "affected_records"},
			{"이유", "reason"}, {"마이그레이션", "migration"}, {"롤아웃", "rollout"},
			{"롤백", "rollback"}, {"근거", "evidence"}, {"행위자", "actor"},
			{"기록 시각", "recorded_at"}, {"적용 시각", "effective_at"},
			{"변경 전 해시", "before_hash"}, {"변경 후 해시", "after_hash"},
		} {
			if value := cell(item, row.field); value != "" {
				fmt.Fprintf(buffer, "- **%s:** %s\n", row.label, value)
			}
		}
	}
}

func commandRender(path, name, outDir string, output io.Writer) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	records, err := loadModellingRecords(data)
	if err != nil {
		return err
	}

	views := renderViews
	if name != "all" {
		view, err := viewFor(name)
		if err != nil {
			return err
		}
		views = []renderView{view}
	}

	for _, view := range views {
		if outDir != "" && len(records[view.requires]) == 0 {
			fmt.Fprintf(output, "skip %s: no %s records yet\n", view.name, view.requires)
			continue
		}
		var buffer bytes.Buffer
		writeFrontmatter(&buffer, view)
		view.render(&buffer, records)
		if outDir == "" {
			if _, err := output.Write(buffer.Bytes()); err != nil {
				return err
			}
			continue
		}
		destination := filepath.Join(outDir, view.destination)
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(destination, buffer.Bytes(), 0o644); err != nil {
			return err
		}
		if _, err := fmt.Fprintln(output, destination); err != nil {
			return err
		}
	}
	return nil
}

func writeFrontmatter(buffer *bytes.Buffer, view renderView) {
	fmt.Fprintf(buffer, "---\nid: ddd-%s\ntitle: %s\nstatus: generated\ntype: ddd-view\n---\n\n",
		view.name, view.title)
	fmt.Fprintf(buffer, "# %s\n\n", view.title)
	buffer.WriteString("> 🤖 **이 파일은 생성물이다.** 정본은 `governance/knowledge/claimgate-kb.json`이고\n")
	fmt.Fprintf(buffer, "> `./kbctl render %s`가 다시 만든다. 손으로 고치면 다음 생성 때 사라진다.\n\n", view.name)
}

// cell keeps a value inside one markdown table cell: a newline would end the row
// and a pipe would open a column that is not there.
func cell(value map[string]any, field string) string {
	out := text(value, field)
	out = strings.ReplaceAll(out, "|", "\\|")
	return strings.Join(strings.Fields(out), " ")
}

func id(value map[string]any) string {
	return text(value, "id")
}

func renderScenarios(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("**한 번에 하나만 `ACTIVE`다.** 나머지는 진술만 적어 두고 모델링하지 않는다.\n\n")
	buffer.WriteString("| 키 | 시나리오 | 상태 | 나르는 불변식 |\n|---|---|---|---|\n")
	for _, item := range records["scenario"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s |\n",
			id(item), cell(item, "title"), cell(item, "status"), cell(item, "invariants"))
	}
	for _, item := range records["scenario"] {
		fmt.Fprintf(buffer, "\n## %s · %s\n\n", id(item), cell(item, "title"))
		fmt.Fprintf(buffer, "| | |\n|---|---|\n")
		for _, row := range []struct{ label, field string }{
			{"상태", "status"}, {"행위자", "actor"}, {"방아쇠", "trigger"},
			{"바라는 결과", "outcome"}, {"비즈니스 중요성", "importance"},
			{"범위 밖", "out_of_scope"}, {"나르는 불변식", "invariants"},
		} {
			if value := cell(item, row.field); value != "" {
				fmt.Fprintf(buffer, "| **%s** | %s |\n", row.label, value)
			}
		}
	}
}

func renderStories(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("DDD 용어를 붙이지 않고 평범한 말로, 실제로 무슨 일이 일어나는지 적은 것이다.\n\n")
	for _, item := range records["scenario"] {
		story := text(item, "story")
		if story == "" {
			continue
		}
		fmt.Fprintf(buffer, "## %s · %s\n\n```\n%s\n```\n\n", id(item), cell(item, "title"), story)
	}
}

func renderRules(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("사실과 추측을 가른 것이다. `KNOWN`·`VERIFIED`는 근거를, ")
	buffer.WriteString("`ASSUMED`·`UNKNOWN`·`CONFLICTED`는 질문을 반드시 갖는다.\n\n")
	if len(records["rule"]) == 0 {
		buffer.WriteString("아직 규칙 레코드가 없다.\n")
		return
	}
	counts := map[string]int{}
	for _, item := range records["rule"] {
		counts[text(item, "status")]++
	}
	buffer.WriteString("| 상태 | 건수 |\n|---|---|\n")
	for _, status := range []string{"KNOWN", "VERIFIED", "ASSUMED", "UNKNOWN", "CONFLICTED", "REJECTED"} {
		if counts[status] > 0 {
			fmt.Fprintf(buffer, "| %s | %d |\n", status, counts[status])
		}
	}
	// Rules arrive sorted by key, and a key is fixed the moment another record
	// cites it, so the rules of one scenario are not adjacent in that order.
	// Grouping has to collect them: reading the heading off a changing value
	// emitted one section per *run* of the same scenario, which put the same
	// heading in the document several times.
	grouped := map[string][]map[string]any{}
	scenarios := []string{}
	for _, item := range records["rule"] {
		scenario := text(item, "scenario")
		if _, seen := grouped[scenario]; !seen {
			scenarios = append(scenarios, scenario)
		}
		grouped[scenario] = append(grouped[scenario], item)
	}
	sort.Slice(scenarios, func(i, j int) bool {
		if numericSuffix(scenarios[i]) != numericSuffix(scenarios[j]) {
			return numericSuffix(scenarios[i]) < numericSuffix(scenarios[j])
		}
		return scenarios[i] < scenarios[j]
	})
	for _, scenario := range scenarios {
		fmt.Fprintf(buffer, "\n## %s\n\n| 키 | 규칙 문장 | 상태 | 근거 | 질문 | spec |\n|---|---|---|---|---|---|\n", scenario)
		for _, item := range grouped[scenario] {
			fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s |\n",
				id(item), cell(item, "statement"), cell(item, "status"),
				cell(item, "evidence"), cell(item, "question"), cell(item, "spec_key"))
		}
	}
}

func renderMetaphor(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("**은유는 도메인 모델이 아니라 그것을 찾기 위한 임시 가설이다.**\n")
	buffer.WriteString("`RETIRED`가 된 영역은 설계 근거로 인용할 수 없다.\n\n")
	buffer.WriteString("## 은퇴 원장\n\n| 키 | 영역 | 상태 | 유효한 곳 | 무효한 곳 | 델타 |\n|---|---|---|---|---|---|\n")
	for _, item := range records["metaphor"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "area"), cell(item, "status"),
			cell(item, "valid_for"), cell(item, "invalid_for"), cell(item, "deltas"))
	}
	buffer.WriteString("\n## 매핑 — 빌려온 구조\n\n")
	buffer.WriteString("이 표는 대응 가설이며 Domain Model이나 Ubiquitous Language가 아니다.\n\n")
	buffer.WriteString("| 키 | 메타포 | 도메인 | 의미 | 신뢰도 | 불일치 후보 | 질문 후보 |\n|---|---|---|---|---|---|---|\n")
	for _, item := range records["mapping"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "metaphor"), cell(item, "domain"), cell(item, "meaning"),
			cell(item, "confidence"), cell(item, "mismatch"), cell(item, "question"))
	}
	buffer.WriteString("\n## 공격 기록 — 어디서 깨지는가\n\n")
	buffer.WriteString("여섯 축의 내용은 Delta로 확정되기 전의 공격 결과다.\n\n")
	buffer.WriteString("| 메타포 | 상태 | 시간 | 동시성 | 권한 | 일관성 | 실패 |\n|---|---|---|---|---|---|---|\n")
	for _, item := range records["metaphor"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "attack_state"), cell(item, "attack_time"),
			cell(item, "attack_concurrency"), cell(item, "attack_authority"),
			cell(item, "attack_consistency"), cell(item, "attack_failure"))
	}
	buffer.WriteString("\n## 델타 — 은유가 깨진 자리\n\n")
	buffer.WriteString("잘 맞는 부분보다 안 맞는 부분이 값지다. 모든 행이 질문으로 이어진다.\n\n")
	buffer.WriteString("| 키 | 은유가 말하는 것 | 도메인이 실제로 | 불일치 | 축 | 질문 |\n|---|---|---|---|---|---|\n")
	for _, item := range records["delta"] {
		axis := cell(item, "axes_all")
		if axis == "" {
			axis = cell(item, "axis")
		}
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "metaphor"), cell(item, "domain"),
			cell(item, "mismatch"), axis, cell(item, "question"))
	}
}

func renderEvents(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("명령이 도메인 행위를 부르고, 그 행위가 성공하면 과거형 사건이 남는다.\n\n")
	buffer.WriteString("```\nCommand\n   ↓\nDomain Logic\n   ↓\nEvent\n```\n\n")
	buffer.WriteString("## 명령\n\n| 키 | 명령 | 행위자 | 시나리오 | 선행조건 | 만드는 사건 | spec |\n|---|---|---|---|---|---|---|\n")
	for _, item := range records["command"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "name"), cell(item, "actor"), cell(item, "scenario"),
			cell(item, "precondition"), cell(item, "produces"), cell(item, "spec_key"))
	}
	buffer.WriteString("\n## 사건\n\n| 키 | 사건(과거형) | 시나리오 | 만든 명령 | 설명 | spec |\n|---|---|---|---|---|---|\n")
	for _, item := range records["event"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "name"), cell(item, "scenario"),
			cell(item, "command"), cell(item, "description"), cell(item, "spec_key"))
	}
}

func renderQuestions(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("모르는 것은 메우지 않고 질문으로 남긴다.\n\n")
	buffer.WriteString("```\nUNKNOWN → 도메인 질문 → 답 → 도메인 규칙 → 모델 갱신\n```\n\n")
	open, answered := 0, 0
	for _, item := range records["question"] {
		if text(item, "status") == "OPEN" {
			open++
		} else {
			answered++
		}
	}
	fmt.Fprintf(buffer, "**열린 질문 %d · 답한 질문 %d**\n\n", open, answered)
	buffer.WriteString("| 키 | 질문 | 출처 | 상태 | 우선순위 | 추천 | 막는 시나리오 | 답 |\n|---|---|---|---|---|---|---|---|\n")
	for _, item := range records["question"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "question"), cell(item, "source"),
			cell(item, "status"), cell(item, "priority"), cell(item, "recommendation"),
			cell(item, "blocks"), cell(item, "answer"))
	}

	buffer.WriteString("\n## 결정 질문지\n\n")
	buffer.WriteString("추천안은 확정 규칙이 아니다. 선택된 답만 `ANSWERED`로 전환한다.\n\n")
	for _, item := range records["question"] {
		fmt.Fprintf(buffer, "### %s\n\n%s\n\n", id(item), text(item, "question"))
		if priority := text(item, "priority"); priority != "" {
			fmt.Fprintf(buffer, "**우선순위:** %s\n\n", priority)
		}
		if options := text(item, "options"); options != "" {
			buffer.WriteString("**선택지**\n\n")
			buffer.WriteString(options)
			buffer.WriteString("\n\n")
		}
		if recommendation := text(item, "recommendation"); recommendation != "" {
			fmt.Fprintf(buffer, "**추천:** %s\n\n", recommendation)
		}
		if rationale := text(item, "recommendation_reason"); rationale != "" {
			fmt.Fprintf(buffer, "**추천 근거:** %s\n\n", rationale)
		}
		if answer := text(item, "answer"); answer != "" {
			fmt.Fprintf(buffer, "**확정 답:** %s\n\n", answer)
		}
	}
}

func renderGlossary(buffer *bytes.Buffer, records map[string][]map[string]any) {
	buffer.WriteString("문서와 Go 식별자는 같은 Ubiquitous Language를 사용한다. 발견용 메타포 어휘는 Production Model에 넣지 않는다.\n")
	buffer.WriteString("**「무엇이 아닌가」가 정의만큼 중요하다.**\n\n")
	if len(records["term"]) == 0 {
		buffer.WriteString("아직 용어 레코드가 없다.\n")
		return
	}
	buffer.WriteString("| 키 | 문서어 | Go | 종류 | 정의 | 무엇이 아닌가 | spec |\n|---|---|---|---|---|---|---|\n")
	for _, item := range records["term"] {
		fmt.Fprintf(buffer, "| %s | %s | %s | %s | %s | %s | %s |\n",
			id(item), cell(item, "doc"), cell(item, "go"), cell(item, "kind"),
			cell(item, "definition"), cell(item, "not_a"), cell(item, "spec"))
	}
}
