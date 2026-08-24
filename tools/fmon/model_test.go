package main

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func TestModelSwitchesTabsAndRendersFailClosedState(t *testing.T) {
	m := newModel(provider{}, time.Second)
	m.width, m.height = 100, 30
	m.resizeViewport()
	m.err = errors.New("kbctl contract failed")
	m.loading = false
	m.syncViewport()
	if !strings.Contains(m.View(), "No direct JSON fallback was used") {
		t.Fatalf("fail-closed explanation missing: %s", m.View())
	}

	updated, _ := m.Update(tea.KeyMsg{Type: tea.KeyTab})
	next := updated.(model)
	if next.tab != tabWork {
		t.Fatalf("tab = %d, want %d", next.tab, tabWork)
	}
}

func TestPacketRankPrioritizesHumanReview(t *testing.T) {
	ready := packetRank(workPacket{Status: "complete", ReviewStatus: "READY_FOR_HUMAN_REVIEW"})
	partial := packetRank(workPacket{Status: "partial", ReviewStatus: "UNSET"})
	if ready >= partial {
		t.Fatalf("ready rank %d must precede partial rank %d", ready, partial)
	}
}

func TestSegmentMeterKeepsRequestedDisplayWidth(t *testing.T) {
	meter := segmentMeter(24, []meterSegment{
		{Status: "complete", Value: 7},
		{Status: "in_progress", Value: 2},
		{Status: "blocked", Value: 1},
	})
	if got := visibleWidth(meter); got != 24 {
		t.Fatalf("meter width = %d, want 24: %q", got, meter)
	}
}

func TestBtopOverviewKeepsTabsAndAddsDenseStatusPanels(t *testing.T) {
	m := newModel(provider{}, time.Second)
	m.width, m.height = 120, 40
	m.snapshot = snapshot{
		LoadedAt:     time.Now(),
		ModelCounts:  map[string]int{"scenario": 10, "rule": 98, "event": 157},
		Lifecycle:    map[string]int{"complete": 47, "partial": 1},
		Review:       map[string]int{"HUMAN_ACCEPTED": 6, "UNSET": 42},
		WorkPackets:  make([]workPacket, 48),
		FixtureCount: 2,
		Checks:       []checkResult{{Name: "kbctl verify", OK: true}},
	}
	m.resizeViewport()
	m.syncViewport()
	view := m.View()
	for _, want := range []string{"OVERVIEW", "WORK PACKETS", "DOMAIN MODEL", "IMPLEMENTATION / REVIEW FLOW", "SYSTEM"} {
		if !strings.Contains(view, want) {
			t.Fatalf("btop view missing %q: %s", want, view)
		}
	}
}

func TestAutomaticRefreshDoesNotExposeIntermediateLoadingFrame(t *testing.T) {
	m := newModel(provider{}, time.Second)
	m.loading = false
	m.snapshot.LoadedAt = time.Now()
	before := m.View()

	updated, _ := m.Update(tickMsg(time.Now()))
	next := updated.(model)
	if next.View() != before {
		t.Fatalf("automatic refresh changed visible frame before a complete snapshot arrived")
	}
}

func TestCompletedRefreshPreservesViewportOffset(t *testing.T) {
	m := newModel(provider{}, time.Second)
	m.width, m.height = 80, 14
	m.tab = tabGovernance
	for index := 0; index < 12; index++ {
		m.snapshot.OpenIssues = append(m.snapshot.OpenIssues, issue{
			ID:          fmt.Sprintf("OI-%02d", index),
			Status:      "open",
			Description: strings.Repeat("long issue description ", 6),
		})
	}
	m.snapshot.LoadedAt = time.Now()
	m.resizeViewport()
	m.syncViewport()
	m.viewport.SetYOffset(5)

	updated, _ := m.Update(loadedMsg{snapshot: m.snapshot})
	next := updated.(model)
	if next.viewport.YOffset != 5 {
		t.Fatalf("viewport offset = %d, want 5 after refresh", next.viewport.YOffset)
	}
}

func TestEquivalentCompletedRefreshProducesNoVisibleChange(t *testing.T) {
	m := newModel(provider{}, time.Second)
	m.width, m.height = 100, 30
	m.loading = true
	m.snapshot = snapshot{
		LoadedAt:    time.Unix(100, 0),
		ModelCounts: map[string]int{"event": 2},
		Lifecycle:   map[string]int{"complete": 1},
		Review:      map[string]int{"UNSET": 1},
		Checks:      []checkResult{{Name: "kbctl verify", OK: true, Detail: "ok", Duration: time.Millisecond}},
	}
	m.resizeViewport()
	m.syncViewport()
	before := m.View()

	incoming := m.snapshot
	incoming.LoadedAt = time.Unix(200, 0)
	incoming.Checks = []checkResult{{Name: "kbctl verify", OK: true, Detail: "ok", Duration: 99 * time.Millisecond}}
	updated, _ := m.Update(loadedMsg{snapshot: incoming})
	next := updated.(model)
	if next.View() != before {
		t.Fatalf("equivalent refresh changed visible frame")
	}
	if !next.snapshot.LoadedAt.Equal(time.Unix(100, 0)) {
		t.Fatalf("equivalent refresh replaced stable snapshot timestamp")
	}
}

func TestMeaningfulRefreshStillSwapsSnapshot(t *testing.T) {
	m := newModel(provider{}, time.Second)
	m.snapshot = snapshot{LoadedAt: time.Unix(100, 0), ModelCounts: map[string]int{"event": 2}}
	incoming := snapshot{LoadedAt: time.Unix(200, 0), ModelCounts: map[string]int{"event": 3}}

	updated, _ := m.Update(loadedMsg{snapshot: incoming})
	next := updated.(model)
	if next.snapshot.ModelCounts["event"] != 3 {
		t.Fatalf("meaningful refresh was suppressed: %#v", next.snapshot.ModelCounts)
	}
}
