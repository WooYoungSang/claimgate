package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadCommandsSuccessAndNotFound(t *testing.T) {
	path := copyFixtureKB(t)
	tests := []struct {
		name       string
		args       []string
		wantCode   int
		wantOutput string
	}{
		{
			name:       "get existing decision",
			args:       []string{"get", "decision", "sample-decision-alpha", "--kb", path},
			wantOutput: `"id": "sample-decision-alpha"`,
		},
		{
			name:       "get missing decision",
			args:       []string{"get", "decision", "does-not-exist", "--kb=" + path},
			wantCode:   1,
			wantOutput: `not_found: decision "does-not-exist"`,
		},
		{
			name:       "list exact filter",
			args:       []string{"list", "roadmap", "--filter", "stage=P0", "--filter", "status=complete", "--kb", path},
			wantOutput: `"stage": "P0"`,
		},
		{
			name:       "list no matches",
			args:       []string{"list", "roadmap", "--filter", "stage=does-not-exist", "--kb", path},
			wantCode:   1,
			wantOutput: "not_found: no roadmap records matched",
		},
		{
			name:       "search narrative case insensitive",
			args:       []string{"search", "PREVENTS THE ROSTER FILTER", "--kind", "decision", "--kb", path},
			wantOutput: `"id": "sample-decision-alpha"`,
		},
		{
			name:       "search no matches",
			args:       []string{"search", "definitely-no-such-narrative-9f3a", "--kb", path},
			wantCode:   1,
			wantOutput: "not_found: no records matched query",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			stdout, stderr, code := invoke(t, test.args...)
			if code != test.wantCode {
				t.Fatalf("exit code = %d, want %d; stdout=%s stderr=%s", code, test.wantCode, stdout, stderr)
			}
			combined := stdout + stderr
			if !strings.Contains(combined, test.wantOutput) {
				t.Fatalf("output %q does not contain %q", combined, test.wantOutput)
			}
		})
	}
}

func TestUpdateIsSurgicalAndKeepsIndexExact(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	definition, _ := definitionFor("decision")
	beforeRecord, err := findRecord(before, definition, "sample-decision-alpha")
	if err != nil {
		t.Fatal(err)
	}

	stdout, stderr, code := invoke(t,
		"update", "decision", "sample-decision-alpha",
		"--field", "status=reviewed-in-test",
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("update failed: stdout=%s stderr=%s", stdout, stderr)
	}

	after := readFile(t, path)
	afterRecord, err := findRecord(after, definition, "sample-decision-alpha")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(before[:beforeRecord.span.start], after[:afterRecord.span.start]) {
		t.Fatal("bytes before the target record changed")
	}
	if !bytes.Equal(before[beforeRecord.span.end:], after[afterRecord.span.end:]) {
		t.Fatal("bytes after the target record changed")
	}
	if afterRecord.value["status"] != "reviewed-in-test" {
		t.Fatalf("status = %#v", afterRecord.value["status"])
	}
	assertIndexMatchesLiveData(t, after)
}

func TestUpdateRepeatableFieldAndFileInput(t *testing.T) {
	path := copyFixtureKB(t)
	fieldPath := filepath.Join(t.TempDir(), "status.txt")
	if err := os.WriteFile(fieldPath, []byte("resolved-from-file\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	_, stderr, code := invoke(t,
		"update", "open_issue", "sample-open-issue-beta",
		"--field", "status=ignored-first-value",
		"--field", "status=@"+fieldPath,
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("update failed: %s", stderr)
	}
	data := readFile(t, path)
	definition, _ := definitionFor("open_issue")
	item, err := findRecord(data, definition, "sample-open-issue-beta")
	if err != nil {
		t.Fatal(err)
	}
	if item.value["status"] != "resolved-from-file\n" {
		t.Fatalf("file field value = %#v", item.value["status"])
	}
}

func TestUpdateRejectsMissingRequiredNarrativeWithoutWriting(t *testing.T) {
	path := copyFixtureKB(t)
	data := readFile(t, path)
	definition, _ := definitionFor("decision")
	item, err := findRecord(data, definition, "sample-decision-alpha")
	if err != nil {
		t.Fatal(err)
	}
	corrupt := removeObjectMember(t, data, item.span, "rationale")
	writeFile(t, path, corrupt)
	before := readFile(t, path)

	_, stderr, code := invoke(t,
		"update", "decision", "sample-decision-alpha",
		"--field", "status=resolved", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, `required narrative field "rationale"`) {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
	if after := readFile(t, path); !bytes.Equal(before, after) {
		t.Fatal("rejected update wrote to the KB")
	}
}

func TestRoadmapCompleteRequiresEvidence(t *testing.T) {
	for _, stage := range []string{"P0", "P2", "P9"} {
		t.Run(stage, func(t *testing.T) {
			path := copyFixtureKB(t)
			// The canonical roadmap may already have reached complete. Put the
			// isolated fixture into a nonterminal state so this test exercises
			// the guarded transition rather than the idempotent complete no-op.
			if _, stderr, code := invoke(t, "roadmap", "set", stage, "--status", "in_progress", "--evidence=", "--kb", path); code != 0 {
				t.Fatalf("fixture setup failed: %s", stderr)
			}
			before := readFile(t, path)
			_, stderr, code := invoke(t, "roadmap", "set", stage, "--status", "complete", "--kb", path)
			if code == 0 || !strings.Contains(stderr, "requires evidence") {
				t.Fatalf("code=%d stderr=%q", code, stderr)
			}
			if !bytes.Equal(before, readFile(t, path)) {
				t.Fatal("rejected roadmap update wrote to the KB")
			}
		})
	}
}

func TestRoadmapSetAcceptsEvidenceAndNote(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"roadmap", "set", "P0", "--status", "complete",
		"--evidence", "test evidence", "--note", "test note", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("roadmap set failed: %s", stderr)
	}
	data := readFile(t, path)
	definition, _ := definitionFor("roadmap")
	item, err := findRecord(data, definition, "P0")
	if err != nil {
		t.Fatal(err)
	}
	if item.value["evidence"] != "test evidence" || item.value["note"] != "test note" {
		t.Fatalf("roadmap fields = %#v", item.value)
	}
}

func TestWorkpacketSetAndCommittedMigration(t *testing.T) {
	realData := readFile(t, fixtureKBPath())
	definition, _ := definitionFor("workpacket")
	items, err := recordsFor(realData, definition)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 6 {
		t.Fatalf("work packet count = %d, want 6", len(items))
	}
	for _, item := range items {
		status, ok := item.value["status"].(string)
		if !ok {
			t.Fatalf("work packet %v has no string status", item.value["id"])
		}
		if _, allowed := allowedWorkPacketStatuses[status]; !allowed {
			t.Fatalf("work packet %v has invalid status %q", item.value["id"], status)
		}
		raw := string(realData[item.span.start:item.span.end])
		assertInlineArrayField(t, raw, "depends_on")
		assertInlineArrayField(t, raw, "exclusive_file_lease")
	}
	first, err := findRecord(realData, definition, "PKT-WA-CONTRACT")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(realData[first.span.start:first.span.end]), `"depends_on": []`) {
		t.Fatal("PKT-WA-CONTRACT depends_on is not the literal single-line []")
	}

	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"workpacket", "set", "PKT-WA-CONTRACT", "--status", "in_progress",
		"--evidence", "fresh evidence", "--next-step", "fresh next step", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("workpacket set failed: %s", stderr)
	}
	updated := readFile(t, path)
	item, err := findRecord(updated, definition, "PKT-WA-CONTRACT")
	if err != nil {
		t.Fatal(err)
	}
	if item.value["status"] != "in_progress" {
		t.Fatalf("status = %#v", item.value["status"])
	}
	if item.value["evidence"] != "fresh evidence" || item.value["next_step"] != "fresh next step" {
		t.Fatalf("workpacket fields = %#v", item.value)
	}
	if !strings.Contains(string(updated[item.span.start:item.span.end]), `"depends_on": []`) {
		t.Fatal("workpacket update expanded the empty depends_on array")
	}
}

func TestWorkpacketSetSupportsSupersededAuditState(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"workpacket", "set", "PKT-WA-CONTRACT", "--status", "superseded", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("workpacket set superseded failed: %s", stderr)
	}
	data := readFile(t, path)
	definition, _ := definitionFor("workpacket")
	item, err := findRecord(data, definition, "PKT-WA-CONTRACT")
	if err != nil {
		t.Fatal(err)
	}
	if item.value["status"] != "superseded" {
		t.Fatalf("status = %v, want superseded", item.value["status"])
	}
}

func TestWritePreservesHTMLSensitiveCharacters(t *testing.T) {
	path := copyFixtureKB(t)
	before := bytes.Count(readFile(t, path), []byte(">"))
	_, stderr, code := invoke(t,
		"update", "decision", "sample-decision-alpha", "--field", "status=superseded", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("update failed: %s", stderr)
	}
	data := readFile(t, path)
	// Compared against the pre-write count, not a hardcoded magic number: the
	// real KB's literal `>` count grows over time as more narrative text is
	// added, so pinning an absolute count makes this test rot independently
	// of kbctl's own correctness (observed 2026-08-09: 83 -> 91 in one
	// session). A single-record update must never change the total.
	if count := bytes.Count(data, []byte(">")); count != before {
		t.Fatalf("literal > count = %d, want %d (unchanged from before the write)", count, before)
	}
	if bytes.Contains(data, []byte(`\u003`)) {
		t.Fatal("write introduced a \\u003 escape")
	}
}

func TestNoOpWriteIsWholeFileByteIdentical(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"update", "decision", "sample-decision-alpha", "--field", "status=superseded", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("update failed: %s", stderr)
	}
	if after := readFile(t, path); !bytes.Equal(before, after) {
		t.Fatal("no-op-shaped update changed bytes in the real KB copy")
	}
}

func TestUnknownUpdateDoesNotCreateRecord(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	definition, _ := definitionFor("decision")
	beforeRecords, err := recordsFor(before, definition)
	if err != nil {
		t.Fatal(err)
	}
	_, stderr, code := invoke(t,
		"update", "decision", "does-not-exist", "--field", "status=active", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "not_found") {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
	after := readFile(t, path)
	afterRecords, err := recordsFor(after, definition)
	if err != nil {
		t.Fatal(err)
	}
	if len(afterRecords) != len(beforeRecords) || !bytes.Equal(before, after) {
		t.Fatal("unknown update changed the KB or record count")
	}
}

func TestInvalidJSONAbortsWithoutWriting(t *testing.T) {
	path := filepath.Join(t.TempDir(), "invalid.json")
	before := []byte("{not-json\n")
	writeFile(t, path, before)
	_, stderr, code := invoke(t,
		"update", "decision", "anything", "--field", "status=active", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "invalid JSON") {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("invalid JSON file was modified")
	}
}

func invoke(t *testing.T, args ...string) (string, string, int) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := run(args, &stdout, &stderr)
	return stdout.String(), stderr.String(), code
}

// fixtureKBPath is the store the tests run against. It used to be the project's
// live knowledge base, which coupled this tool's tests to the project's data:
// emptying that store for the 2026-08-15 rebuild broke eight tests that had
// nothing wrong with them. The fixture is synthetic and self-contained, so the
// tool can be exercised without a project around it.
func fixtureKBPath() string {
	return filepath.Join("testdata", "kb.json")
}

// liveKBPath is only for the one test that asserts the project's real store
// still parses. Nothing else may read it.
func liveKBPath() string {
	return filepath.Join("..", "..", "governance", "knowledge", "claimgate-kb.json")
}

func copyFixtureKB(t *testing.T) string {
	t.Helper()
	data := readFile(t, fixtureKBPath())
	path := filepath.Join(t.TempDir(), "kb.json")
	writeFile(t, path, data)
	return path
}

func readFile(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func writeFile(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertInlineArrayField(t *testing.T, raw, field string) {
	t.Helper()
	for _, line := range strings.Split(raw, "\n") {
		if strings.Contains(line, `"`+field+`":`) {
			if !strings.Contains(line, "[") || !strings.Contains(line, "]") {
				t.Fatalf("%s is not a single-line array: %q", field, line)
			}
			return
		}
	}
	t.Fatalf("record has no %s field", field)
}

func assertIndexMatchesLiveData(t *testing.T, data []byte) {
	t.Helper()
	expected, err := buildIndex(data)
	if err != nil {
		t.Fatal(err)
	}
	root, err := rootSpan(data)
	if err != nil {
		t.Fatal(err)
	}
	member, err := memberByKey(data, root, "_index")
	if err != nil {
		t.Fatal(err)
	}
	var actual kbIndex
	if err := json.Unmarshal(data[member.valueSpan.start:member.valueSpan.end], &actual); err != nil {
		t.Fatal(err)
	}
	if mismatches := compareIndexes(expected, actual); len(mismatches) != 0 {
		t.Fatalf("index mismatches: %v", mismatches)
	}
}

func removeObjectMember(t *testing.T, data []byte, object byteSpan, field string) []byte {
	t.Helper()
	members, err := parseObjectMembers(data, object)
	if err != nil {
		t.Fatal(err)
	}
	for index, member := range members {
		if member.key != field {
			continue
		}
		if index == len(members)-1 {
			if index == 0 {
				t.Fatalf("cannot remove the only member from an object")
			}
			start := members[index-1].valueSpan.end
			return append(append([]byte(nil), data[:start]...), data[member.valueSpan.end:]...)
		}
		start := bytes.LastIndexByte(data[:member.keySpan.start], '\n') + 1
		end := skipWhitespace(data, member.valueSpan.end)
		if end >= len(data) || data[end] != ',' {
			t.Fatalf("field %q is not followed by a comma", field)
		}
		end++
		if end < len(data) && data[end] == '\n' {
			end++
		}
		return append(append([]byte(nil), data[:start]...), data[end:]...)
	}
	t.Fatalf("object has no field %q", field)
	return nil
}
