package main

import "github.com/charmbracelet/lipgloss"

var (
	colorBg      = lipgloss.Color("#0B0F14")
	colorPanel   = lipgloss.Color("#111821")
	colorPanelHi = lipgloss.Color("#151F2C")
	colorBorder  = lipgloss.Color("#30435E")
	colorText    = lipgloss.Color("#D8E2F0")
	colorMuted   = lipgloss.Color("#70819B")
	colorCyan    = lipgloss.Color("#5DE4C7")
	colorBlue    = lipgloss.Color("#7AA2F7")
	colorGreen   = lipgloss.Color("#9ECE6A")
	colorYellow  = lipgloss.Color("#E0AF68")
	colorRed     = lipgloss.Color("#F7768E")
	colorMagenta = lipgloss.Color("#BB9AF7")

	appStyle    = lipgloss.NewStyle().Background(colorBg).Foreground(colorText)
	headerStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorBg).
			Background(colorCyan).
			Padding(0, 1)
	brandStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorMagenta)
	subtitleStyle = lipgloss.NewStyle().Foreground(colorMuted)
	activeTab     = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorBg).
			Background(colorMagenta).
			Padding(0, 1)
	inactiveTab = lipgloss.NewStyle().
			Foreground(colorMuted).
			Background(colorPanel).
			Padding(0, 1)
	panelStyle = lipgloss.NewStyle().
			Background(colorPanel).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(colorBorder).
			Padding(0, 1)
	panelHotStyle = panelStyle.Copy().
			Background(colorPanelHi).
			BorderForeground(colorBlue)
	panelTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorBlue)
	metricValue = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorCyan)
	mutedStyle = lipgloss.NewStyle().Foreground(colorMuted)
	errorStyle = lipgloss.NewStyle().Bold(true).Foreground(colorRed)
	helpStyle  = lipgloss.NewStyle().
			Foreground(colorMuted).
			Background(colorPanel).
			Padding(0, 1)
)

func statusStyle(status string) lipgloss.Style {
	color := colorMuted
	switch status {
	case "complete", "DONE", "HUMAN_ACCEPTED", "COMMIT_READY", "ok":
		color = colorGreen
	case "in_progress", "partial", "IMPLEMENTING", "AI_VERIFYING", "loading":
		color = colorYellow
	case "READY_FOR_HUMAN_REVIEW":
		color = colorCyan
	case "blocked", "HUMAN_REWORK", "failed":
		color = colorRed
	case "UNSET":
		color = colorMagenta
	}
	return lipgloss.NewStyle().Bold(true).Foreground(color)
}

func badgeStyle(status string) lipgloss.Style {
	base := statusStyle(status)
	return base.Copy().Background(colorPanelHi).Padding(0, 1)
}
