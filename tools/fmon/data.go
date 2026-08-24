package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type commandRunner interface {
	Run(context.Context, string, ...string) ([]byte, error)
}

type execRunner struct{ repo string }

func (r execRunner) Run(ctx context.Context, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = r.repo
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, firstLine(string(out)))
	}
	return out, nil
}

type workPacket struct {
	ID           string   `json:"id"`
	Status       string   `json:"status"`
	ReviewStatus string   `json:"review_status"`
	Delivers     string   `json:"delivers"`
	DoneWhen     string   `json:"done_when"`
	Evidence     string   `json:"evidence"`
	NextStep     string   `json:"next_step"`
	DependsOn    []string `json:"depends_on"`
	Wave         string   `json:"-"`
}

type issue struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	NextStep    string `json:"next_step"`
	Status      string `json:"status"`
}

type question struct {
	ID       string `json:"id"`
	Question string `json:"question"`
	Status   string `json:"status"`
}

type checkResult struct {
	Name     string
	OK       bool
	Detail   string
	Duration time.Duration
}

type gitState struct {
	Branch string
	Head   string
	Dirty  []string
}

type snapshot struct {
	LoadedAt      time.Time
	ModelCounts   map[string]int
	WorkPackets   []workPacket
	FixtureCount  int
	Lifecycle     map[string]int
	Review        map[string]int
	OpenIssues    []issue
	OpenQuestions []question
	Checks        []checkResult
	Git           gitState
	KBCTLCalls    int
}

type provider struct {
	runner commandRunner
	repo   string
	kbctl  string
	kb     string
}

var modelKinds = []string{"scenario", "rule", "term", "event", "command", "aggregate", "usecase"}

func (d provider) kbArgs(args ...string) []string {
	return append(args, "--kb", d.kb)
}

func decodeList[T any](raw []byte, kind string) ([]T, error) {
	var records []T
	if err := json.Unmarshal(raw, &records); err != nil {
		return nil, fmt.Errorf("kbctl list %s returned invalid JSON array: %w", kind, err)
	}
	if records == nil {
		return nil, fmt.Errorf("kbctl list %s returned null, want JSON array", kind)
	}
	return records, nil
}

func (d provider) list(ctx context.Context, kind string) ([]byte, error) {
	return d.runner.Run(ctx, d.kbctl, d.kbArgs("list", kind)...)
}

func (d provider) load(ctx context.Context) (snapshot, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	kinds := append(append([]string{}, modelKinds...), "workpacket", "open_issue", "question")
	type result struct {
		kind string
		raw  []byte
		err  error
	}
	results := make(chan result, len(kinds))
	var wg sync.WaitGroup
	for _, kind := range kinds {
		kind := kind
		wg.Add(1)
		go func() {
			defer wg.Done()
			raw, err := d.list(ctx, kind)
			results <- result{kind: kind, raw: raw, err: err}
		}()
	}
	wg.Wait()
	close(results)

	rawByKind := make(map[string][]byte, len(kinds))
	for result := range results {
		if result.err != nil {
			return snapshot{}, result.err
		}
		rawByKind[result.kind] = result.raw
	}

	snap := snapshot{
		LoadedAt:    time.Now(),
		ModelCounts: make(map[string]int),
		Lifecycle:   make(map[string]int),
		Review:      make(map[string]int),
		KBCTLCalls:  len(kinds) + 1,
	}
	for _, kind := range modelKinds {
		items, err := decodeList[map[string]any](rawByKind[kind], kind)
		if err != nil {
			return snapshot{}, err
		}
		snap.ModelCounts[kind] = len(items)
	}

	packets, err := decodeList[workPacket](rawByKind["workpacket"], "workpacket")
	if err != nil {
		return snapshot{}, err
	}
	for _, packet := range packets {
		if packet.ID == "" {
			return snapshot{}, errors.New("kbctl list workpacket returned record without id")
		}
		if strings.HasPrefix(packet.ID, "WP-SELFTEST-") {
			snap.FixtureCount++
			continue
		}
		if packet.ReviewStatus == "" {
			packet.ReviewStatus = "UNSET"
		}
		snap.WorkPackets = append(snap.WorkPackets, packet)
		snap.Lifecycle[packet.Status]++
		snap.Review[packet.ReviewStatus]++
	}
	sort.SliceStable(snap.WorkPackets, func(i, j int) bool {
		return packetRank(snap.WorkPackets[i]) < packetRank(snap.WorkPackets[j])
	})

	issues, err := decodeList[issue](rawByKind["open_issue"], "open_issue")
	if err != nil {
		return snapshot{}, err
	}
	for _, item := range issues {
		if item.Status == "open" {
			snap.OpenIssues = append(snap.OpenIssues, item)
		}
	}
	questions, err := decodeList[question](rawByKind["question"], "question")
	if err != nil {
		return snapshot{}, err
	}
	for _, item := range questions {
		if strings.ToUpper(item.Status) != "ANSWERED" {
			snap.OpenQuestions = append(snap.OpenQuestions, item)
		}
	}

	snap.Checks = d.runChecks(ctx)
	snap.Git = d.loadGit(ctx)
	return snap, nil
}

func packetRank(packet workPacket) int {
	rank := map[string]int{
		"READY_FOR_HUMAN_REVIEW": 0,
		"HUMAN_REWORK":           1,
		"AI_VERIFYING":           2,
		"IMPLEMENTING":           3,
		"in_progress":            4,
		"partial":                5,
		"blocked":                6,
	}
	if value, ok := rank[packet.ReviewStatus]; ok {
		return value
	}
	if value, ok := rank[packet.Status]; ok {
		return value
	}
	return 100
}

func (d provider) runChecks(ctx context.Context) []checkResult {
	checks := []struct {
		name string
		cmd  string
		args []string
	}{
		{"kbctl verify", d.kbctl, d.kbArgs("verify")},
	}
	results := make([]checkResult, 0, len(checks))
	for _, check := range checks {
		started := time.Now()
		raw, err := d.runner.Run(ctx, check.cmd, check.args...)
		detail := firstLine(string(raw))
		if err != nil {
			detail = firstLine(err.Error())
		}
		results = append(results, checkResult{check.name, err == nil, detail, time.Since(started)})
	}
	return results
}

func (d provider) loadGit(ctx context.Context) gitState {
	branch, _ := d.runner.Run(ctx, "git", "rev-parse", "--abbrev-ref", "HEAD")
	head, _ := d.runner.Run(ctx, "git", "log", "-1", "--format=%h %s")
	dirty, _ := d.runner.Run(ctx, "git", "status", "--short")
	return gitState{
		Branch: strings.TrimSpace(string(branch)),
		Head:   strings.TrimSpace(string(head)),
		Dirty:  nonEmptyLines(string(dirty)),
	}
}

func firstLine(value string) string {
	for _, line := range strings.Split(value, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			return line
		}
	}
	return "no output"
}

func nonEmptyLines(value string) []string {
	var lines []string
	for _, line := range strings.Split(value, "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func resolvePath(repo, value string) string {
	if filepath.IsAbs(value) {
		return value
	}
	return filepath.Join(repo, value)
}
