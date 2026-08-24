package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestVerifyConsistentAndCorruptedIndex(t *testing.T) {
	path := copyFixtureKB(t)
	stdout, stderr, code := invoke(t, "verify", "--kb", path)
	if code != 0 || stdout != "ok\n" {
		t.Fatalf("consistent verify: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}

	data := readFile(t, path)
	corrupted, removedID := removeFirstIndexID(t, data, "decision_ids")
	writeFile(t, path, corrupted)
	stdout, stderr, code = invoke(t, "verify", "--kb", path)
	if code != 1 {
		t.Fatalf("corrupt verify exit=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	want := `decision_ids mismatch: live_only=["` + removedID + `"] index_only=[]`
	if !strings.Contains(stderr, want) {
		t.Fatalf("corrupt verify stderr=%q, want %q", stderr, want)
	}
}

func TestEveryWriteRegeneratesAllIndexArrays(t *testing.T) {
	path := copyFixtureKB(t)
	data := readFile(t, path)
	corrupted, _ := removeFirstIndexID(t, data, "incident_ids")
	writeFile(t, path, corrupted)

	_, stderr, code := invoke(t,
		"update", "decision", "sample-decision-alpha", "--field", "status=active", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("update failed: %s", stderr)
	}
	updated := readFile(t, path)
	assertIndexMatchesLiveData(t, updated)
	stdout, stderr, code := invoke(t, "verify", "--kb", path)
	if code != 0 || stdout != "ok\n" {
		t.Fatalf("verify after regeneration: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}

func TestAtomicWriteUsesDistinctTemporaryPathAndRename(t *testing.T) {
	path := filepath.Join(t.TempDir(), "kb.json")
	writeFile(t, path, []byte("{}\n"))
	var temporaryPath, finalPath string
	err := atomicWrite(path, []byte("{\"updated\":true}\n"), func(temporary, final string) {
		temporaryPath = temporary
		finalPath = final
	})
	if err != nil {
		t.Fatal(err)
	}
	if temporaryPath == "" || temporaryPath == finalPath || finalPath != path {
		t.Fatalf("temporary=%q final=%q", temporaryPath, finalPath)
	}
	if data := readFile(t, path); string(data) != "{\"updated\":true}\n" {
		t.Fatalf("final contents = %q", data)
	}
	if _, err := os.Stat(temporaryPath); !os.IsNotExist(err) {
		t.Fatalf("temporary path still exists or stat failed unexpectedly: %v", err)
	}
}

func TestAtomicWriteRejectsInvalidJSONWithoutChangingTarget(t *testing.T) {
	path := filepath.Join(t.TempDir(), "kb.json")
	before := []byte("{\"unchanged\":true}\n")
	writeFile(t, path, before)
	observed := false

	err := atomicWrite(path, []byte("{\"broken\":]"), func(_, _ string) {
		observed = true
	})
	if err == nil || !strings.Contains(err.Error(), "invalid JSON") {
		t.Fatalf("error = %v, want an invalid-JSON rejection", err)
	}
	if observed {
		t.Fatal("invalid JSON reached temporary-file creation")
	}
	if data := readFile(t, path); !bytes.Equal(data, before) {
		t.Fatalf("target changed after rejected write: got %q want %q", data, before)
	}
}

func TestUpdateRejectsExistingStructuredField(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	definition, err := definitionFor("incident")
	if err != nil {
		t.Fatal(err)
	}
	item, err := findRecord(before, definition, "sample-incident-alpha")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := item.value["lessons"].([]any); !ok {
		t.Fatalf("fixture lessons type = %T, want array", item.value["lessons"])
	}

	_, stderr, code := invoke(t,
		"update", "incident", "sample-incident-alpha", "--field", "lessons=clobbered", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, `--field cannot target array/object-valued field "lessons"`) {
		t.Fatalf("code=%d stderr=%q, want a structured-field rejection", code, stderr)
	}
	if data := readFile(t, path); !bytes.Equal(data, before) {
		t.Fatal("rejected structured-field update changed the KB")
	}
}

func TestUpdateExistingStringFieldStillSucceeds(t *testing.T) {
	path := copyFixtureKB(t)
	const updatedSummary = "Updated scalar field from kbctl regression test."

	_, stderr, code := invoke(t,
		"update", "incident", "sample-incident-alpha", "--field", "summary="+updatedSummary, "--kb", path,
	)
	if code != 0 {
		t.Fatalf("string-field update failed: code=%d stderr=%q", code, stderr)
	}
	stdout, stderr, code := invoke(t, "get", "incident", "sample-incident-alpha", "--kb", path)
	if code != 0 || !strings.Contains(stdout, `"summary": "`+updatedSummary+`"`) {
		t.Fatalf("get after string update: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}

func TestUpdateNewFieldStillSucceeds(t *testing.T) {
	path := copyFixtureKB(t)

	_, stderr, code := invoke(t,
		"update", "incident", "sample-incident-alpha", "--field", "kbctl_regression=new field", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("new-field update failed: code=%d stderr=%q", code, stderr)
	}
	stdout, stderr, code := invoke(t, "get", "incident", "sample-incident-alpha", "--kb", path)
	if code != 0 || !strings.Contains(stdout, `"kbctl_regression": "new field"`) {
		t.Fatalf("get after new-field update: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}

func TestSearchUsesOnlyEnumeratedNarrativeFields(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"search", "sample-decision-alpha", "--kind", "decision", "--kb", path,
	)
	if code != 1 || !strings.Contains(stderr, "not_found") {
		t.Fatalf("identity-only search should not match: code=%d stderr=%q", code, stderr)
	}
}

func TestWorkpacketStatusValidation(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"workpacket", "set", "PKT-WA-CONTRACT", "--status", "almost_done", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, `invalid workpacket status "almost_done"`) {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("invalid status changed the KB")
	}
}

func TestCreateAppendsRecordAndRegeneratesIndex(t *testing.T) {
	path := copyFixtureKB(t)
	stdout, stderr, code := invoke(t,
		"create", "open_issue", "kbctl-create-test-record",
		"--field", "description=Created by a test, safe to ignore.",
		"--field", "next_step=None; test fixture only.",
		"--field", "status=open",
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("create failed: stdout=%q stderr=%q", stdout, stderr)
	}

	updated := readFile(t, path)
	assertIndexMatchesLiveData(t, updated)
	stdout, stderr, code = invoke(t, "verify", "--kb", path)
	if code != 0 || stdout != "ok\n" {
		t.Fatalf("verify after create: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}

	stdout, stderr, code = invoke(t, "get", "open_issue", "kbctl-create-test-record", "--kb", path)
	if code != 0 {
		t.Fatalf("get after create: stdout=%q stderr=%q", stdout, stderr)
	}
	for _, want := range []string{
		`"id": "kbctl-create-test-record"`,
		`"description": "Created by a test, safe to ignore."`,
		`"next_step": "None; test fixture only."`,
		`"status": "open"`,
	} {
		if !strings.Contains(stdout, want) {
			t.Fatalf("get output missing %q; got %q", want, stdout)
		}
	}
}

func TestCreateRejectsDuplicateIdentity(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"create", "open_issue", "sample-open-issue-alpha",
		"--field", "description=x", "--field", "next_step=y", "--field", "status=open",
		"--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "already exists") {
		t.Fatalf("code=%d stderr=%q, want an already-exists error", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("rejected create still modified the KB")
	}
}

func TestCreateRejectsMissingRequiredNarrativeField(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"create", "open_issue", "kbctl-create-missing-field-test",
		"--field", "description=only one field",
		"--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, `required narrative field "next_step"`) {
		t.Fatalf("code=%d stderr=%q, want a missing-narrative-field error", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("rejected create still modified the KB")
	}
}

func TestCreateRejectsNestedKind(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"create", "workpacket", "PKT-NEW-PACKET",
		"--field", "status=not_started",
		"--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "structurally nested") {
		t.Fatalf("code=%d stderr=%q, want a structurally-nested rejection", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("rejected create still modified the KB")
	}
}

func TestCreateRejectsIdentityPassedAsField(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"create", "open_issue", "kbctl-create-identity-field-test",
		"--field", "id=kbctl-create-identity-field-test",
		"--field", "description=x", "--field", "next_step=y", "--field", "status=open",
		"--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "positional <id> argument") {
		t.Fatalf("code=%d stderr=%q, want an identity-as-field rejection", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("rejected create still modified the KB")
	}
}

func removeFirstIndexID(t *testing.T, data []byte, field string) ([]byte, string) {
	t.Helper()
	root, err := rootSpan(data)
	if err != nil {
		t.Fatal(err)
	}
	indexMember, err := memberByKey(data, root, "_index")
	if err != nil {
		t.Fatal(err)
	}
	fieldMember, err := memberByKey(data, indexMember.valueSpan, field)
	if err != nil {
		t.Fatal(err)
	}
	elements, err := parseArrayElements(data, fieldMember.valueSpan)
	if err != nil {
		t.Fatal(err)
	}
	if len(elements) < 2 {
		t.Fatalf("%s has fewer than two ids", field)
	}
	removed := strings.Trim(string(data[elements[0].start:elements[0].end]), `"`)
	return append(append([]byte(nil), data[:elements[0].start]...), data[elements[1].start:]...), removed
}

// TestLiveStoreStaysParseable is the only test that reads the project's real
// knowledge base. Every other test runs against testdata/kb.json, because
// coupling the tool's tests to the project's data meant that emptying the store
// for the 2026-08-15 rebuild broke eight tests that had nothing wrong with them.
// This one stays so the live store cannot silently become unreadable: it asserts
// that kbctl can load it and that its index agrees with its contents, without
// caring what records are in it.
func TestLiveStoreStaysParseable(t *testing.T) {
	stdout, stderr, code := invoke(t, "verify", "--kb", liveKBPath())
	if code != 0 {
		t.Fatalf("live store failed verify: stdout=%q stderr=%q", stdout, stderr)
	}
}

func TestCreateSeedsAnEmptyRecordArray(t *testing.T) {
	path := copyFixtureKB(t)
	data := readFile(t, path)
	emptied := bytes.Replace(data,
		[]byte("\"open_issues\": ["),
		[]byte("\"open_issues\": [],\n  \"unused_open_issues\": ["),
		1)
	if bytes.Equal(emptied, data) {
		t.Fatal("fixture no longer has an open_issues array to empty")
	}
	writeFile(t, path, emptied)

	_, stderr, code := invoke(t,
		"create", "open_issue", "seeded-issue",
		"--field", "date=2026-08-16",
		"--field", "status=open",
		"--field", "title=seeded",
		"--field", "description=seeded into an empty array",
		"--field", "next_step=none",
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("seeding create failed: code=%d stderr=%s", code, stderr)
	}

	seeded := readFile(t, path)
	assertIndexMatchesLiveData(t, seeded)
	stdout, stderr, code := invoke(t, "verify", "--kb", path)
	if code != 0 || stdout != "ok\n" {
		t.Fatalf("verify after seeding: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}

	stdout, stderr, code = invoke(t, "get", "open_issue", "seeded-issue", "--kb", path)
	if code != 0 || !strings.Contains(stdout, "seeded into an empty array") {
		t.Fatalf("get after seeding: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}

	// A second create must append beside the seeded record, not replace it.
	if _, stderr, code = invoke(t,
		"create", "open_issue", "second-issue",
		"--field", "date=2026-08-16",
		"--field", "status=open",
		"--field", "title=second",
		"--field", "description=appended after the seed",
		"--field", "next_step=none",
		"--kb", path,
	); code != 0 {
		t.Fatalf("append after seeding failed: code=%d stderr=%s", code, stderr)
	}
	if stdout, _, _ = invoke(t, "get", "open_issue", "seeded-issue", "--kb", path); !strings.Contains(stdout, "seeded") {
		t.Fatalf("seeded record lost after append: %q", stdout)
	}
}
