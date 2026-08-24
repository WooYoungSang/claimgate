package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func seedDecision(t *testing.T, path, id, decision string) {
	t.Helper()
	invokeOK(t, path, "create", "decision", id,
		"--field", "decision="+decision,
		"--field", "rationale=test rationale",
		"--field", "status=accepted")
}

func createChange(t *testing.T, path, id, subject, supersedes string, affected []string) {
	t.Helper()
	rawAffected, err := json.Marshal(affected)
	if err != nil {
		t.Fatal(err)
	}
	args := []string{
		"change", "create", id,
		"--subject", subject,
		"--affected", string(rawAffected),
		"--reason", "design changed",
		"--migration", "migrate safely",
		"--rollout", "paper then live",
		"--rollback", "disable live",
		"--evidence", "test evidence",
		"--actor", "tester",
		"--effective-at", "2026-08-17T00:00:00Z",
		"--status", "accepted",
		"--kb", path,
	}
	if supersedes != "" {
		args = append(args, "--supersedes", supersedes)
	}
	if _, stderr, code := invoke(t, args...); code != 0 {
		t.Fatalf("create change %s: %s", id, stderr)
	}
}

func TestChangeCreateCapturesSnapshotsAndSupportsQueries(t *testing.T) {
	path := copyFixtureKB(t)
	seedDecision(t, path, "D-100", "paper execution")
	seedDecision(t, path, "D-101", "live execution")

	createChange(t, path, "CHG-1", "D-100", "", []string{"D-100"})
	stdout, stderr, code := invoke(t, "change", "get", "CHG-1", "--kb", path)
	if code != 0 {
		t.Fatalf("get change: %s", stderr)
	}
	for _, want := range []string{"recorded_at", "after_hash", "subject_snapshot", "D-100"} {
		if !strings.Contains(stdout, want) {
			t.Fatalf("change record lacks %q: %s", want, stdout)
		}
	}

	if _, stderr, code := invoke(t, "update", "change", "CHG-1", "--field", "status=applied", "--kb", path); code == 0 || !strings.Contains(stderr, "immutable") {
		t.Fatalf("change update was not rejected: code=%d stderr=%q", code, stderr)
	}
	if _, stderr, code := invoke(t, "create", "change", "CHG-2", "--field", "subject=D-100", "--kb", path); code == 0 || !strings.Contains(stderr, "change create") {
		t.Fatalf("generic change create was not rejected: code=%d stderr=%q", code, stderr)
	}

	stdout, stderr, code = invoke(t, "change", "history", "D-100", "--kb", path)
	if code != 0 || !strings.Contains(stdout, "CHG-1") {
		t.Fatalf("history: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	stdout, stderr, code = invoke(t, "change", "impact", "CHG-1", "--kb", path)
	if code != 0 || !strings.Contains(stdout, `"role": "subject,affected"`) || !strings.Contains(stdout, "D-100") {
		t.Fatalf("impact: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	stdout, stderr, code = invoke(t, "render", "changes", "--kb", path)
	if code != 0 || !strings.Contains(stdout, "설계 변경 이력") || !strings.Contains(stdout, "CHG-1") || !strings.Contains(stdout, "migrate safely") {
		t.Fatalf("render changes: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}

	createChange(t, path, "CHG-2", "D-101", "D-100", []string{"D-100", "D-101"})
	stdout, stderr, code = invoke(t, "change", "diff", "CHG-1", "CHG-2", "--kb", path)
	if code != 0 || !strings.Contains(stdout, "paper execution") || !strings.Contains(stdout, "live execution") {
		t.Fatalf("diff: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	assertIndexContains(t, path, "design_change_ids", "CHG-1")
	assertIndexContains(t, path, "design_change_ids", "CHG-2")
	if stdout, stderr, code := invoke(t, "verify", "--kb", path); code != 0 {
		t.Fatalf("verify: stdout=%q stderr=%q", stdout, stderr)
	}
}

func TestChangeCreateRejectsMissingReference(t *testing.T) {
	path := copyFixtureKB(t)
	raw := `[]`
	_, stderr, code := invoke(t,
		"change", "create", "CHG-1", "--subject", "D-404", "--affected", raw,
		"--reason", "x", "--migration", "x", "--rollout", "x", "--rollback", "x",
		"--evidence", "x", "--actor", "tester", "--status", "accepted", "--kb", path)
	if code == 0 || !strings.Contains(stderr, `record "D-404" does not exist`) {
		t.Fatalf("missing reference accepted: code=%d stderr=%q", code, stderr)
	}
}

func TestVerifyReportsUntrackedMutationOfTrackedSubject(t *testing.T) {
	path := copyFixtureKB(t)
	seedDecision(t, path, "D-100", "paper execution")
	createChange(t, path, "CHG-1", "D-100", "", []string{"D-100"})
	invokeOK(t, path, "update", "decision", "D-100", "--field", "decision=mutated without change")

	stdout, _, code := invoke(t, "verify", "--kb", path)
	if code == 0 || !strings.Contains(stdout, "untracked mutation") || !strings.Contains(stdout, "D-100") {
		t.Fatalf("verify did not report untracked mutation: code=%d stdout=%q", code, stdout)
	}
}
