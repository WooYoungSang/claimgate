package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestDocumentKindQueriesClaimGateDocs(t *testing.T) {
	stdout, stderr, code := invoke(t, "get", "document", "DOC-TEST", "--kb", fixtureKBPath())
	if code != 0 {
		t.Fatalf("get document failed: stdout=%q stderr=%q", stdout, stderr)
	}
	var doc map[string]any
	if err := json.Unmarshal([]byte(stdout), &doc); err != nil {
		t.Fatal(err)
	}
	if doc["path"] != "docs/test.md" || doc["status"] != "fixture" {
		t.Fatalf("document record = %#v", doc)
	}

	stdout, stderr, code = invoke(t, "search", "Synthetic document", "--kind", "document", "--kb", fixtureKBPath())
	if code != 0 || !strings.Contains(stdout, "DOC-TEST") {
		t.Fatalf("search document: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
}
