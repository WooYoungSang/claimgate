package main

import (
	"context"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

const (
	tabOverview = iota
	tabWork
	tabGovernance
	tabChecks
)

var tabNames = []string{"OVERVIEW", "WORK PACKETS", "GOVERNANCE", "CHECKS"}

type loadedMsg struct {
	snapshot snapshot
	err      error
}

type tickMsg time.Time

type model struct {
	provider    provider
	snapshot    snapshot
	viewport    viewport.Model
	tab         int
	width       int
	height      int
	loading     bool
	err         error
	refreshRate time.Duration
}

func newModel(data provider, refreshRate time.Duration) model {
	vp := viewport.New(80, 20)
	vp.MouseWheelEnabled = true
	return model{provider: data, viewport: vp, loading: true, refreshRate: refreshRate}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.loadCmd(), tickCmd(m.refreshRate))
}

func (m model) loadCmd() tea.Cmd {
	return func() tea.Msg {
		snap, err := m.provider.load(context.Background())
		return loadedMsg{snapshot: snap, err: err}
	}
}

func tickCmd(rate time.Duration) tea.Cmd {
	return tea.Tick(rate, func(now time.Time) tea.Msg { return tickMsg(now) })
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var commands []tea.Cmd
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c", "esc":
			return m, tea.Quit
		case "tab", "right", "l":
			m.tab = (m.tab + 1) % len(tabNames)
			m.syncViewport()
			return m, nil
		case "shift+tab", "left", "h":
			m.tab = (m.tab + len(tabNames) - 1) % len(tabNames)
			m.syncViewport()
			return m, nil
		case "r":
			if !m.loading {
				m.loading = true
				return m, m.loadCmd()
			}
		}
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.resizeViewport()
		m.refreshViewport()
		return m, nil
	case loadedMsg:
		m.loading = false
		m.err = msg.err
		if msg.err == nil && (m.snapshot.LoadedAt.IsZero() || !sameVisibleSnapshot(m.snapshot, msg.snapshot)) {
			m.snapshot = msg.snapshot
		}
		m.refreshViewport()
		return m, nil
	case tickMsg:
		commands = append(commands, tickCmd(m.refreshRate))
		if !m.loading {
			m.loading = true
			commands = append(commands, m.loadCmd())
		}
	}
	var cmd tea.Cmd
	m.viewport, cmd = m.viewport.Update(msg)
	commands = append(commands, cmd)
	return m, tea.Batch(commands...)
}

// sameVisibleSnapshot ignores sampling metadata that would make an unchanged
// dashboard repaint on every poll. Check duration and poll time are diagnostic
// metadata; a changed result/detail or any changed domain/git value still swaps
// the snapshot atomically.
func sameVisibleSnapshot(left, right snapshot) bool {
	left.LoadedAt = time.Time{}
	right.LoadedAt = time.Time{}
	left.Checks = checksWithoutDuration(left.Checks)
	right.Checks = checksWithoutDuration(right.Checks)
	return reflect.DeepEqual(left, right)
}

func checksWithoutDuration(checks []checkResult) []checkResult {
	result := append([]checkResult(nil), checks...)
	for index := range result {
		result[index].Duration = 0
	}
	return result
}

func (m *model) resizeViewport() {
	width := m.width - 4
	if width < 30 {
		width = 30
	}
	height := m.height - 7
	if height < 6 {
		height = 6
	}
	m.viewport.Width = width
	m.viewport.Height = height
}

func (m *model) syncViewport() {
	m.viewport.SetContent(m.tabContent())
	m.viewport.GotoTop()
}

// refreshViewport swaps a complete frame while preserving the reader's place.
// Automatic polling must not behave like a tab change: jumping to the top every
// few seconds makes a stable terminal look as if it is shaking.
func (m *model) refreshViewport() {
	offset := m.viewport.YOffset
	m.viewport.SetContent(m.tabContent())
	m.viewport.SetYOffset(offset)
}

func (m model) View() string {
	width := m.width
	if width < 60 {
		width = 80
	}
	passed := 0
	for _, check := range m.snapshot.Checks {
		if check.OK {
			passed++
		}
	}
	dirty := fmt.Sprintf("DIRTY %d", len(m.snapshot.Git.Dirty))
	if len(m.snapshot.Git.Dirty) == 0 {
		dirty = "CLEAN"
	}
	brand := lipgloss.JoinHorizontal(lipgloss.Center,
		headerStyle.Render("CLAIMGATE"),
		" ",
		brandStyle.Render("FMON"),
		"  ",
		subtitleStyle.Render("KBCTL READ MODEL"),
	)
	system := lipgloss.JoinHorizontal(lipgloss.Center,
		badgeStyle("ok").Render(fmt.Sprintf("KBCTL %02d", m.snapshot.KBCTLCalls)),
		" ",
		badgeStyle(checkStatus(passed, len(m.snapshot.Checks))).Render(fmt.Sprintf("CHECKS %d/%d", passed, len(m.snapshot.Checks))),
		" ",
		badgeStyle(dirtyStatus(len(m.snapshot.Git.Dirty))).Render(dirty),
		" ",
		mutedStyle.Render(timestamp(m.snapshot.LoadedAt)),
	)
	headerGap := width - lipgloss.Width(brand) - lipgloss.Width(system)
	if headerGap < 1 {
		headerGap = 1
	}
	header := brand + strings.Repeat(" ", headerGap) + system

	var tabs []string
	for index, name := range tabNames {
		style := inactiveTab
		prefix := "  "
		if index == m.tab {
			style = activeTab
			prefix = "▸ "
		}
		tabs = append(tabs, style.Render(prefix+name))
	}
	tabBar := lipgloss.JoinHorizontal(lipgloss.Top, tabs...)
	status := ""
	if m.loading && m.snapshot.LoadedAt.IsZero() {
		status = statusStyle("loading").Render("  ◉ polling kbctl…")
	}
	if m.err != nil {
		status = errorStyle.Render("  ✕ " + m.err.Error())
	}
	body := m.viewport.View()
	footer := helpStyle.Render(" TAB/←→ panels   J/K scroll   PGUP/PGDN page   R refresh   Q quit ")
	content := lipgloss.JoinVertical(lipgloss.Left, header, tabBar+status, body, footer)
	return appStyle.Width(width).Render(content)
}

func checkStatus(passed, total int) string {
	if total == 0 || passed < total {
		return "failed"
	}
	return "ok"
}

func dirtyStatus(count int) string {
	if count == 0 {
		return "ok"
	}
	return "in_progress"
}

func timestamp(value time.Time) string {
	if value.IsZero() {
		return "--:--:--"
	}
	return value.Format("15:04:05")
}

func (m model) tabContent() string {
	if m.err != nil && m.snapshot.LoadedAt.IsZero() {
		return btopPanel("FAIL-CLOSED", "NO FALLBACK", errorStyle.Render(m.err.Error())+
			"\n\n"+mutedStyle.Render("No direct JSON fallback was used. · kbctl contract failed"), max(30, m.viewport.Width-2), true)
	}
	switch m.tab {
	case tabWork:
		return m.workContent()
	case tabGovernance:
		return m.governanceContent()
	case tabChecks:
		return m.checksContent()
	default:
		return m.overviewContent()
	}
}

type meterSegment struct {
	Status string
	Value  int
}

func segmentMeter(width int, segments []meterSegment) string {
	if width <= 0 {
		return ""
	}
	var active []meterSegment
	total := 0
	for _, segment := range segments {
		if segment.Value > 0 {
			active = append(active, segment)
			total += segment.Value
		}
	}
	if total == 0 {
		return mutedStyle.Render(strings.Repeat("░", width))
	}
	remaining := width
	var parts []string
	for index, segment := range active {
		cells := segment.Value * width / total
		if index == len(active)-1 {
			cells = remaining
		}
		if cells > remaining {
			cells = remaining
		}
		remaining -= cells
		if cells == 0 {
			continue
		}
		glyph := "█"
		switch segment.Status {
		case "in_progress", "IMPLEMENTING", "AI_VERIFYING":
			glyph = "▓"
		case "partial", "READY_FOR_HUMAN_REVIEW":
			glyph = "▒"
		case "blocked", "HUMAN_REWORK":
			glyph = "▰"
		case "UNSET":
			glyph = "░"
		}
		parts = append(parts, statusStyle(segment.Status).Render(strings.Repeat(glyph, cells)))
	}
	if remaining > 0 {
		parts = append(parts, mutedStyle.Render(strings.Repeat("░", remaining)))
	}
	return strings.Join(parts, "")
}

func visibleWidth(value string) int { return lipgloss.Width(value) }

func scalarMeter(width, value, maximum int, status string) string {
	if width <= 0 {
		return ""
	}
	filled := 0
	if maximum > 0 {
		filled = value * width / maximum
	}
	if value > 0 && filled == 0 {
		filled = 1
	}
	if filled > width {
		filled = width
	}
	return statusStyle(status).Render(strings.Repeat("━", filled)) +
		mutedStyle.Render(strings.Repeat("─", width-filled))
}

func btopPanel(title, badge, body string, width int, hot bool) string {
	style := panelStyle
	if hot {
		style = panelHotStyle
	}
	titleLine := panelTitle.Render("╼ "+title) + "  " + mutedStyle.Render(badge)
	return style.Width(max(24, width)).Render(titleLine + "\n" + body)
}

func (m model) overviewContent() string {
	width := max(34, m.viewport.Width-2)
	column := width/2 - 2
	maxCount := 1
	for _, value := range m.snapshot.ModelCounts {
		if value > maxCount {
			maxCount = value
		}
	}
	var domainRows []string
	for _, kind := range modelKinds {
		value := m.snapshot.ModelCounts[kind]
		barWidth := max(8, column-24)
		domainRows = append(domainRows, fmt.Sprintf("%-10s %4d  %s", strings.ToUpper(kind), value,
			scalarMeter(barWidth, value, maxCount, "complete")))
	}
	domain := btopPanel("DOMAIN MODEL", fmt.Sprintf("%d RECORDS", sumCounts(m.snapshot.ModelCounts)), strings.Join(domainRows, "\n"), column, true)

	lifecycleSegments := segmentsFromCounts(m.snapshot.Lifecycle)
	reviewSegments := segmentsFromCounts(m.snapshot.Review)
	meterWidth := max(16, column-6)
	flowBody := strings.Join([]string{
		mutedStyle.Render("IMPLEMENTATION"),
		segmentMeter(meterWidth, lifecycleSegments),
		compactCounts(m.snapshot.Lifecycle),
		"",
		mutedStyle.Render("HUMAN REVIEW GATE"),
		segmentMeter(meterWidth, reviewSegments),
		compactCounts(m.snapshot.Review),
	}, "\n")
	flow := btopPanel("IMPLEMENTATION / REVIEW FLOW", fmt.Sprintf("%d WP + %d FIXTURE", len(m.snapshot.WorkPackets), m.snapshot.FixtureCount), flowBody, column, true)

	passed := 0
	for _, check := range m.snapshot.Checks {
		if check.OK {
			passed++
		}
	}
	active := m.snapshot.Lifecycle["in_progress"] + m.snapshot.Lifecycle["partial"]
	systemBody := fmt.Sprintf("%-18s %s   %-18s %s   %-18s %s\n%-18s %s   %-18s %s   %-18s %s",
		"ACTIVE / PARTIAL", statusStyle("in_progress").Render(fmt.Sprint(active)),
		"READY FOR REVIEW", statusStyle("READY_FOR_HUMAN_REVIEW").Render(fmt.Sprint(m.snapshot.Review["READY_FOR_HUMAN_REVIEW"])),
		"OPEN ISSUES", statusStyle("blocked").Render(fmt.Sprint(len(m.snapshot.OpenIssues))),
		"UNANSWERED KG", metricValue.Render(fmt.Sprint(len(m.snapshot.OpenQuestions))),
		"CHECKS", statusStyle(checkStatus(passed, len(m.snapshot.Checks))).Render(fmt.Sprintf("%d/%d", passed, len(m.snapshot.Checks))),
		"GIT", statusStyle(dirtyStatus(len(m.snapshot.Git.Dirty))).Render(fmt.Sprintf("%d dirty", len(m.snapshot.Git.Dirty))),
	)
	system := btopPanel("SYSTEM", m.snapshot.Git.Branch, systemBody, width, false)
	if width < 90 {
		return lipgloss.JoinVertical(lipgloss.Left, domain, flow, system)
	}
	return lipgloss.JoinVertical(lipgloss.Left,
		lipgloss.JoinHorizontal(lipgloss.Top, domain, " ", flow),
		system,
	)
}

func (m model) workContent() string {
	width := max(32, m.viewport.Width-2)
	flowBody := mutedStyle.Render("LIFECYCLE") + "\n" +
		segmentMeter(max(20, width-6), segmentsFromCounts(m.snapshot.Lifecycle)) + "\n" + compactCounts(m.snapshot.Lifecycle) +
		"\n\n" + mutedStyle.Render("REVIEW GATE") + "\n" +
		segmentMeter(max(20, width-6), segmentsFromCounts(m.snapshot.Review)) + "\n" + compactCounts(m.snapshot.Review)
	flow := btopPanel("WORK PACKET FLOW", fmt.Sprintf("%d OPERATIONAL · %d FIXTURE", len(m.snapshot.WorkPackets), m.snapshot.FixtureCount), flowBody, width, true)

	var rows []string
	for _, packet := range m.snapshot.WorkPackets {
		if packetRank(packet) >= 100 && packet.ReviewStatus == "UNSET" {
			continue
		}
		state := statusStyle(packet.Status).Render("● " + packet.Status)
		review := statusStyle(packet.ReviewStatus).Render(packet.ReviewStatus)
		rows = append(rows, fmt.Sprintf("%-13s  %-16s  %s", packet.ID, state, review))
		if packet.Delivers != "" {
			rows = append(rows, mutedStyle.Width(width-6).Render("  "+packet.Delivers), "")
		}
	}
	if len(rows) == 0 {
		rows = append(rows, mutedStyle.Render("No active or review-gated records."))
	}
	queue := btopPanel("FOCUS QUEUE", "HUMAN REVIEW RECORDS · NOT A ROADMAP", strings.Join(rows, "\n"), width, false)
	return lipgloss.JoinVertical(lipgloss.Left, flow, queue)
}

func (m model) governanceContent() string {
	width := max(32, m.viewport.Width-2)
	questionCount := len(m.snapshot.OpenQuestions)
	signal := btopPanel("GOVERNANCE SIGNAL", "OPEN / UNRESOLVED",
		segmentMeter(max(20, width-6), []meterSegment{{Status: "blocked", Value: len(m.snapshot.OpenIssues)}, {Status: "in_progress", Value: questionCount}})+
			"\n"+statusStyle("blocked").Render(fmt.Sprintf("▲ ISSUES %d", len(m.snapshot.OpenIssues)))+
			"   "+statusStyle("in_progress").Render(fmt.Sprintf("? QUESTIONS %d", questionCount)), width, true)
	var issueRows []string
	for index, item := range m.snapshot.OpenIssues {
		issueRows = append(issueRows, fmt.Sprintf("%s %02d  %s", statusStyle("blocked").Render("▲"), index+1, panelTitle.Render(item.ID)))
		issueRows = append(issueRows, lipgloss.NewStyle().Width(width-6).Render(item.Description))
		if item.NextStep != "" {
			issueRows = append(issueRows, mutedStyle.Width(width-6).Render("↳ "+item.NextStep))
		}
		issueRows = append(issueRows, "")
	}
	if len(issueRows) == 0 {
		issueRows = append(issueRows, statusStyle("ok").Render("✓ no open issues"))
	}
	issues := btopPanel("ISSUE FEED", fmt.Sprintf("%d OPEN", len(m.snapshot.OpenIssues)), strings.Join(issueRows, "\n"), width, false)
	var questionRows []string
	for _, item := range m.snapshot.OpenQuestions {
		questionRows = append(questionRows, statusStyle("in_progress").Render("? "+item.ID)+"  "+item.Question)
	}
	if len(questionRows) == 0 {
		questionRows = append(questionRows, statusStyle("ok").Render("✓ all knowledge questions answered"))
	}
	questions := btopPanel("KNOWLEDGE GAPS", fmt.Sprintf("%d UNANSWERED", questionCount), strings.Join(questionRows, "\n"), width, false)
	return lipgloss.JoinVertical(lipgloss.Left, signal, issues, questions)
}

func (m model) checksContent() string {
	width := max(32, m.viewport.Width-2)
	passed := 0
	var rows []string
	for _, check := range m.snapshot.Checks {
		status, icon := "ok", "●"
		if !check.OK {
			status, icon = "failed", "✕"
		} else {
			passed++
		}
		durationWidth := 16
		rows = append(rows, fmt.Sprintf("%s %-22s %4dms  %s", statusStyle(status).Render(icon), check.Name,
			check.Duration.Milliseconds(), scalarMeter(durationWidth, int(check.Duration.Milliseconds()), 100, status)))
		rows = append(rows, mutedStyle.Width(width-6).Render("  "+check.Detail))
	}
	health := btopPanel("HEALTH", fmt.Sprintf("%d/%d GREEN", passed, len(m.snapshot.Checks)),
		segmentMeter(max(20, width-6), []meterSegment{{Status: "ok", Value: passed}, {Status: "failed", Value: len(m.snapshot.Checks) - passed}})+
			"\n\n"+strings.Join(rows, "\n"), width, true)

	dirtyStatusName := dirtyStatus(len(m.snapshot.Git.Dirty))
	gitRows := []string{
		fmt.Sprintf("%-10s %s", "BRANCH", metricValue.Render(m.snapshot.Git.Branch)),
		fmt.Sprintf("%-10s %s", "HEAD", mutedStyle.Render(m.snapshot.Git.Head)),
		fmt.Sprintf("%-10s %s", "STATE", statusStyle(dirtyStatusName).Render(fmt.Sprintf("%d dirty", len(m.snapshot.Git.Dirty)))),
		"",
	}
	gitRows = append(gitRows, m.snapshot.Git.Dirty...)
	if len(m.snapshot.Git.Dirty) == 0 {
		gitRows = append(gitRows, statusStyle("ok").Render("✓ working tree clean"))
	}
	gitPanel := btopPanel("WORKING TREE", "GIT", strings.Join(gitRows, "\n"), width, false)
	return lipgloss.JoinVertical(lipgloss.Left, health, gitPanel)
}

func segmentsFromCounts(counts map[string]int) []meterSegment {
	keys := make([]string, 0, len(counts))
	for key := range counts {
		keys = append(keys, key)
	}
	sort.SliceStable(keys, func(i, j int) bool { return statusOrder(keys[i]) < statusOrder(keys[j]) })
	segments := make([]meterSegment, 0, len(keys))
	for _, key := range keys {
		segments = append(segments, meterSegment{Status: key, Value: counts[key]})
	}
	return segments
}

func statusOrder(status string) int {
	order := map[string]int{
		"complete": 0, "DONE": 0, "HUMAN_ACCEPTED": 0, "COMMIT_READY": 0,
		"in_progress": 1, "IMPLEMENTING": 1, "AI_VERIFYING": 1,
		"partial": 2, "READY_FOR_HUMAN_REVIEW": 2,
		"blocked": 3, "HUMAN_REWORK": 3, "UNSET": 4,
	}
	if rank, ok := order[status]; ok {
		return rank
	}
	return 9
}

func compactCounts(counts map[string]int) string {
	segments := segmentsFromCounts(counts)
	var parts []string
	for _, segment := range segments {
		parts = append(parts, statusStyle(segment.Status).Render(fmt.Sprintf("%s %d", segment.Status, segment.Value)))
	}
	if len(parts) == 0 {
		return mutedStyle.Render("NO DATA")
	}
	return strings.Join(parts, "  ")
}

func sumCounts(counts map[string]int) int {
	total := 0
	for _, value := range counts {
		total += value
	}
	return total
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
