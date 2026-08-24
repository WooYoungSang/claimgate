package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
)

type fakeRunner struct {
	mu        sync.Mutex
	responses map[string][]byte
	errors    map[string]error
	calls     []string
}

func (r *fakeRunner) Run(_ context.Context, name string, args ...string) ([]byte, error) {
	key := name + " " + strings.Join(args, " ")
	r.mu.Lock()
	r.calls = append(r.calls, key)
	r.mu.Unlock()
	if err := r.errors[key]; err != nil {
		return nil, err
	}
	if value, ok := r.responses[key]; ok {
		return value, nil
	}
	if name == "python3" {
		return []byte("OK\n"), nil
	}
	if name == "git" {
		switch args[0] {
		case "rev-parse":
			return []byte("master\n"), nil
		case "log":
			return []byte("abc123 test\n"), nil
		case "status":
			return []byte(""), nil
		}
	}
	return nil, fmt.Errorf("unexpected command: %s", key)
}

func baseRunner() *fakeRunner {
	runner := &fakeRunner{responses: map[string][]byte{}, errors: map[string]error{}}
	for _, kind := range append(append([]string{}, modelKinds...), "workpacket", "open_issue", "question") {
		runner.responses["kbctl list "+kind+" --kb kb.json"] = []byte("[]")
	}
	runner.responses["kbctl verify --kb kb.json"] = []byte("ok\n")
	return runner
}

func TestProviderLoadsOperationalProjectionOnlyThroughKBCTL(t *testing.T) {
	runner := baseRunner()
	runner.responses["kbctl list event --kb kb.json"] = []byte(`[{"id":"EVT-1"},{"id":"EVT-2"}]`)
	runner.responses["kbctl list workpacket --kb kb.json"] = []byte(`[
		{"id":"WP-SELFTEST-PENDING","status":"complete","review_status":"READY_FOR_HUMAN_REVIEW"},
		{"id":"WP-S1-1","status":"partial","review_status":"AI_VERIFYING","delivers":"live"}
	]`)
	runner.responses["kbctl list open_issue --kb kb.json"] = []byte(`[
		{"id":"OI-1","status":"open","description":"live"},
		{"id":"OI-2","status":"closed","description":"done"}
	]`)
	data := provider{runner: runner, repo: ".", kbctl: "kbctl", kb: "kb.json"}

	snap, err := data.load(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if snap.ModelCounts["event"] != 2 {
		t.Fatalf("event count = %d, want 2", snap.ModelCounts["event"])
	}
	if len(snap.WorkPackets) != 1 || snap.WorkPackets[0].ID != "WP-S1-1" {
		t.Fatalf("operational workpackets = %#v", snap.WorkPackets)
	}
	if snap.FixtureCount != 1 || snap.Review["AI_VERIFYING"] != 1 {
		t.Fatalf("fixture/review projection = %d / %#v", snap.FixtureCount, snap.Review)
	}
	if len(snap.OpenIssues) != 1 {
		t.Fatalf("open issues = %d, want 1", len(snap.OpenIssues))
	}
	for _, call := range runner.calls {
		if strings.Contains(call, "cat ") || strings.Contains(call, "claimgate-kb.json") {
			t.Fatalf("direct KB read leaked into command path: %s", call)
		}
	}
}

func TestProviderFailsClosedOnPartiallyWeakenedKBCTLShape(t *testing.T) {
	runner := baseRunner()
	runner.responses["kbctl list workpacket --kb kb.json"] = []byte(`{"id":"WP-X"}`)
	data := provider{runner: runner, kbctl: "kbctl", kb: "kb.json"}

	_, err := data.load(context.Background())
	if err == nil || !strings.Contains(err.Error(), "invalid JSON array") {
		t.Fatalf("error = %v, want invalid JSON array", err)
	}
}

func TestProviderFailsClosedWhenKBCTLCommandFails(t *testing.T) {
	runner := baseRunner()
	key := "kbctl list question --kb kb.json"
	runner.errors[key] = errors.New("kbctl unavailable")
	data := provider{runner: runner, kbctl: "kbctl", kb: "kb.json"}

	_, err := data.load(context.Background())
	if err == nil || !strings.Contains(err.Error(), "kbctl unavailable") {
		t.Fatalf("error = %v, want kbctl failure", err)
	}
}
