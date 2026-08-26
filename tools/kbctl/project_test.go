package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestProjectSetNameUpdatesMetaAndKeepsKBValid(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t, "project", "set-name", "claimgate", "--kb", path)
	if code != 0 {
		t.Fatalf("project set-name failed: %s", stderr)
	}

	var root struct {
		Meta struct {
			Name string `json:"name"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(readFile(t, path), &root); err != nil {
		t.Fatal(err)
	}
	if root.Meta.Name != "claimgate" {
		t.Fatalf("meta.name = %q, want claimgate", root.Meta.Name)
	}

	stdout, stderr, code := invoke(t, "verify", "--kb", path)
	if code != 0 || stdout != "ok\n" {
		t.Fatalf("verify after rename: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}

func TestProjectSetNameRejectsBlankName(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t, "project", "set-name", "   ", "--kb", path)
	if code == 0 || !strings.Contains(stderr, "non-empty") {
		t.Fatalf("blank project name: code=%d stderr=%q", code, stderr)
	}
}
