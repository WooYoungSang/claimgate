package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	repoDefault, err := filepath.Abs(filepath.Join(filepath.Dir(os.Args[0]), "..", ".."))
	if err != nil {
		repoDefault = "."
	}
	if _, err := os.Stat(filepath.Join(repoDefault, "kbctl")); err != nil {
		if cwd, cwdErr := os.Getwd(); cwdErr == nil {
			repoDefault = cwd
		}
	}
	repo := flag.String("repo", repoDefault, "repository root")
	kb := flag.String("kb", "governance/knowledge/claimgate-kb.json", "KB path, passed to kbctl")
	kbctl := flag.String("kbctl", "./kbctl", "kbctl executable")
	refresh := flag.Duration("refresh", 5*time.Second, "automatic refresh interval")
	once := flag.Bool("once", false, "render one non-interactive frame")
	flag.Parse()
	if *refresh <= 0 {
		fmt.Fprintln(os.Stderr, "fmon: --refresh must be greater than zero")
		os.Exit(2)
	}
	absRepo, err := filepath.Abs(*repo)
	if err != nil {
		fmt.Fprintln(os.Stderr, "fmon:", err)
		os.Exit(1)
	}
	kbPath := resolvePath(absRepo, *kb)
	kbctlPath := resolvePath(absRepo, *kbctl)
	data := provider{runner: execRunner{repo: absRepo}, repo: absRepo, kbctl: kbctlPath, kb: kbPath}
	m := newModel(data, *refresh)
	if *once {
		snap, err := data.load(context.Background())
		m.loading, m.err, m.snapshot = false, err, snap
		m.width, m.height = 120, 40
		m.resizeViewport()
		m.syncViewport()
		fmt.Println(m.View())
		if err != nil {
			os.Exit(1)
		}
		return
	}
	program := tea.NewProgram(m, tea.WithAltScreen(), tea.WithMouseCellMotion())
	if _, err := program.Run(); err != nil {
		fmt.Fprintln(os.Stderr, "fmon:", err)
		os.Exit(1)
	}
}
