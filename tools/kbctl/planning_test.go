package main

import (
	"bytes"
	"strings"
	"testing"
)

const validAEC = `{"schema":"claimgate.aec/v1","agent_assignment":{"role":"executor"},"work_order":"implement one bounded slice","ownership_boundary":{"repo":"product","exclusive_file_lease":["fixture/a.go"]},"expected_touched_files":["fixture/a.go"],"done_criteria":["behavior works"],"acceptance_criteria_refs":["AC-1"],"coordination_rule":"no shared files","uow_mapping":["PKT-WA-CONTRACT"],"no_go_kill_condition":["scope expansion"]}`
const validAC = `{"schema":"claimgate.ac/v1","criteria":[{"id":"AC-1","behavior":"behavior works","proof_command":"go test ./...","expected":"rc=0"}],"negative_controls":[{"id":"NEG-1","mutation":"remove the behavior","proof_command":"go test ./...","expected_failure":"rc!=0"}]}`
const validPlan = `{"schema":"claimgate.implementation-plan/v1","patterns":["hexagonal architecture"],"steps":[{"order":1,"action":"implement","outputs":["fixture/a.go"],"verify":["go test ./..."]}],"handoff":"READY_FOR_HUMAN_REVIEW"}`

func TestWorkpacketPlanningTripleIsValidatedAtomically(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"update", "workpacket", "PKT-WA-CONTRACT",
		"--field", "aec="+validAEC,
		"--field", "acceptance_criteria="+validAC,
		"--field", "implementation_plan="+validPlan,
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("valid planning triple rejected: %s", stderr)
	}
	stdout, stderr, code := invoke(t, "verify", "--kb", path)
	if code != 0 || stdout != "ok\n" {
		t.Fatalf("verify after valid planning update: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}

func TestWorkpacketPlanningTripleRejectsPartialRegistration(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"update", "workpacket", "PKT-WA-CONTRACT", "--field", "aec="+validAEC, "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "planning fields must be registered together") {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("partial planning registration changed KB")
	}
}

func TestVerifyCatchesPartiallyWeakenedAEC(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"update", "workpacket", "PKT-WA-CONTRACT",
		"--field", "aec="+validAEC,
		"--field", "acceptance_criteria="+validAC,
		"--field", "implementation_plan="+validPlan,
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("valid planning triple rejected: %s", stderr)
	}
	data := readFile(t, path)
	weakened := bytes.Replace(data, []byte(`no_go_kill_condition`), []byte(`removed_kill_condition`), 1)
	if bytes.Equal(data, weakened) {
		t.Fatal("negative probe did not mutate AEC")
	}
	writeFile(t, path, weakened)
	_, stderr, code = invoke(t, "verify", "--kb", path)
	if code == 0 || !strings.Contains(stderr, "no_go_kill_condition") {
		t.Fatalf("verify did not catch weakened AEC: code=%d stderr=%q", code, stderr)
	}
}

func TestWorkpacketReviewStatusValidation(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"update", "workpacket", "PKT-WA-CONTRACT",
		"--field", "review_status=READY_FOR_HUMAN_REVIEW", "--kb", path,
	)
	if code != 0 {
		t.Fatalf("valid review status rejected: %s", stderr)
	}

	before := readFile(t, path)
	_, stderr, code = invoke(t,
		"update", "workpacket", "PKT-WA-CONTRACT",
		"--field", "review_status=SKIP_HUMAN_REVIEW", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "invalid workpacket review_status") {
		t.Fatalf("invalid review status accepted: code=%d stderr=%q", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("invalid review status changed KB")
	}
}
