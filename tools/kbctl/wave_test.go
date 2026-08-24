package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestGetWaveReturnsWorkpacketStatusSummary(t *testing.T) {
	stdout, stderr, code := invoke(t, "get", "wave", "WB", "--kb", fixtureKBPath())
	if code != 0 {
		t.Fatalf("get wave failed: stdout=%q stderr=%q", stdout, stderr)
	}
	var summary waveSummary
	if err := json.Unmarshal([]byte(stdout), &summary); err != nil {
		t.Fatal(err)
	}
	if summary.Wave != "WB" || summary.Parallelism == "" || summary.Goal == "" {
		t.Fatalf("wave summary metadata = %#v", summary)
	}
	if len(summary.WorkPackets) == 0 {
		t.Fatal("WB summary has no workpackets")
	}
	for _, packet := range summary.WorkPackets {
		if packet.ID == "" {
			t.Fatal("wave summary contains an empty workpacket id")
		}
		if _, ok := allowedWorkPacketStatuses[packet.Status]; !ok {
			t.Fatalf("workpacket %q has invalid status %q", packet.ID, packet.Status)
		}
	}
	if strings.Contains(stdout, "exclusive_file_lease") || strings.Contains(stdout, "done_when") {
		t.Fatalf("wave query returned full workpacket bodies instead of a summary: %s", stdout)
	}
}

func TestListWaveReturnsAllNestedWaveSummaries(t *testing.T) {
	stdout, stderr, code := invoke(t, "list", "wave", "--kb", fixtureKBPath())
	if code != 0 {
		t.Fatalf("list wave failed: stdout=%q stderr=%q", stdout, stderr)
	}
	var summaries []waveSummary
	if err := json.Unmarshal([]byte(stdout), &summaries); err != nil {
		t.Fatal(err)
	}
	if len(summaries) < 3 {
		t.Fatalf("wave summary count = %d, want at least 3", len(summaries))
	}
	foundWB := false
	for _, summary := range summaries {
		if summary.Wave == "WB" {
			foundWB = true
		}
	}
	if !foundWB {
		t.Fatal("list wave did not include WB")
	}
}

func TestListWaveSupportsExactFiltersAndNotFound(t *testing.T) {
	stdout, stderr, code := invoke(t,
		"list", "wave", "--filter", "wave=WB", "--kb", fixtureKBPath(),
	)
	if code != 0 {
		t.Fatalf("filtered list failed: stdout=%q stderr=%q", stdout, stderr)
	}
	var summaries []waveSummary
	if err := json.Unmarshal([]byte(stdout), &summaries); err != nil {
		t.Fatal(err)
	}
	if len(summaries) != 1 || summaries[0].Wave != "WB" {
		t.Fatalf("filtered summaries = %#v", summaries)
	}

	_, stderr, code = invoke(t, "get", "wave", "W-NOT-FOUND", "--kb", fixtureKBPath())
	if code == 0 || !strings.Contains(stderr, `not_found: wave "W-NOT-FOUND"`) {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
}

func TestWaveKindIsReadOnly(t *testing.T) {
	path := copyFixtureKB(t)
	before := readFile(t, path)
	_, stderr, code := invoke(t,
		"update", "wave", "WB", "--field", "goal=must not change", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "wave queries are read-only") {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
	if !bytes.Equal(before, readFile(t, path)) {
		t.Fatal("rejected wave update modified the KB")
	}
}

func TestWaveCreateAppendsNewWaveWithEmptyWorkpackets(t *testing.T) {
	path := copyFixtureKB(t)
	stdout, stderr, code := invoke(t,
		"wave", "create", "TEST-NEW-WAVE",
		"--goal", "a brand new wave for testing",
		"--parallelism", "serial",
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("wave create failed: stdout=%q stderr=%q", stdout, stderr)
	}
	stdout, stderr, code = invoke(t, "get", "wave", "TEST-NEW-WAVE", "--kb", path)
	if code != 0 {
		t.Fatalf("get new wave failed: stdout=%q stderr=%q", stdout, stderr)
	}
	var summary waveSummary
	if err := json.Unmarshal([]byte(stdout), &summary); err != nil {
		t.Fatal(err)
	}
	if summary.Goal != "a brand new wave for testing" || summary.Parallelism != "serial" {
		t.Fatalf("new wave metadata = %#v", summary)
	}
	if len(summary.WorkPackets) != 0 {
		t.Fatalf("new wave should start with no workpackets, got %#v", summary.WorkPackets)
	}

	stdout, stderr, code = invoke(t, "list", "wave", "--kb", path)
	if code != 0 {
		t.Fatalf("list wave failed: stdout=%q stderr=%q", stdout, stderr)
	}
	var summaries []waveSummary
	if err := json.Unmarshal([]byte(stdout), &summaries); err != nil {
		t.Fatal(err)
	}
	found := false
	for _, s := range summaries {
		if s.Wave == "TEST-NEW-WAVE" {
			found = true
		}
	}
	if !found {
		t.Fatal("list wave did not include the newly created wave")
	}

	_, stderr, code = invoke(t, "verify", "--kb", path)
	if code != 0 {
		t.Fatalf("kbctl verify failed after wave create: stderr=%q", stderr)
	}
}

func TestWaveCreateRejectsDuplicateAndEmptyFields(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"wave", "create", "WB",
		"--goal", "x", "--parallelism", "y", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, `wave "WB" already exists`) {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}

	_, stderr, code = invoke(t,
		"wave", "create", "TEST-EMPTY-GOAL",
		"--parallelism", "y", "--kb", path,
	)
	if code == 0 || !strings.Contains(stderr, "wave create requires exactly one wave and both --goal and --parallelism") {
		t.Fatalf("code=%d stderr=%q", code, stderr)
	}
}

func TestWaveSetUpdatesOnlyRoadmapMetadata(t *testing.T) {
	path := copyFixtureKB(t)
	stdout, stderr, code := invoke(t,
		"wave", "set", "WB",
		"--goal", "new canonical goal",
		"--parallelism", "one contract lane then disjoint implementation lanes",
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("wave set failed: stdout=%q stderr=%q", stdout, stderr)
	}
	stdout, stderr, code = invoke(t, "get", "wave", "WB", "--kb", path)
	if code != 0 {
		t.Fatalf("get updated wave failed: stdout=%q stderr=%q", stdout, stderr)
	}
	var summary waveSummary
	if err := json.Unmarshal([]byte(stdout), &summary); err != nil {
		t.Fatal(err)
	}
	if summary.Goal != "new canonical goal" || summary.Parallelism != "one contract lane then disjoint implementation lanes" {
		t.Fatalf("updated wave metadata = %#v", summary)
	}
	if len(summary.WorkPackets) == 0 {
		t.Fatal("wave set removed workpackets")
	}
}
