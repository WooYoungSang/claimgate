package main

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWorkpacketCreateAppendsToNamedWaveAndRegeneratesIndex(t *testing.T) {
	path := copyFixtureKB(t)
	definition, _ := definitionFor("workpacket")
	before := readFile(t, path)
	untouchedID := "PKT-WB-ALPHA"
	untouched, err := findRecord(before, definition, untouchedID)
	if err != nil {
		t.Fatal(err)
	}
	untouchedRaw := append([]byte(nil), before[untouched.span.start:untouched.span.end]...)

	_, stderr, code := invoke(t,
		"workpacket", "create", "WA", "PKT-WA-CREATE-TEST",
		"--depends-on", `["PKT-WA-CONTRACT"]`,
		"--exclusive-file-lease", `["cmd/kbctl/**"]`,
		"--delivers", "A nested workpacket created through kbctl.",
		"--done-when", "The nested record and generated index are consistent.",
		"--status", "not_started",
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("create failed: %s", stderr)
	}

	updated := readFile(t, path)
	item, err := findRecord(updated, definition, "PKT-WA-CREATE-TEST")
	if err != nil {
		t.Fatal(err)
	}
	if got := item.value["depends_on"]; !stringSliceValueEqual(got, []string{"PKT-WA-CONTRACT"}) {
		t.Fatalf("depends_on = %#v", got)
	}
	if got := item.value["exclusive_file_lease"]; !stringSliceValueEqual(got, []string{"cmd/kbctl/**"}) {
		t.Fatalf("exclusive_file_lease = %#v", got)
	}
	raw := string(updated[item.span.start:item.span.end])
	assertInlineArrayField(t, raw, "depends_on")
	assertInlineArrayField(t, raw, "exclusive_file_lease")
	assertIndexMatchesLiveData(t, updated)

	stillUntouched, err := findRecord(updated, definition, untouchedID)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(untouchedRaw, updated[stillUntouched.span.start:stillUntouched.span.end]) {
		t.Fatal("create reformatted an existing workpacket outside the target wave")
	}
}

func TestWorkpacketCreateLoadsArrayFieldsFromFiles(t *testing.T) {
	path := copyFixtureKB(t)
	dir := t.TempDir()
	dependsPath := filepath.Join(dir, "depends.json")
	leasePath := filepath.Join(dir, "leases.json")
	if err := os.WriteFile(dependsPath, []byte(`["PKT-WA-CONTRACT"]`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(leasePath, []byte(`["cmd/kbctl/main.go","cmd/kbctl/kb.go"]`), 0o644); err != nil {
		t.Fatal(err)
	}

	_, stderr, code := invoke(t,
		"workpacket", "create", "WA", "PKT-WA-FILE-TEST",
		"--depends-on", "@"+dependsPath,
		"--exclusive-file-lease", "@"+leasePath,
		"--delivers", "File-backed arrays.",
		"--done-when", "Both arrays decode as JSON string arrays.",
		"--status", "blocked",
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("create failed: %s", stderr)
	}
}

func TestWorkpacketCreateRejectsInvalidInputWithoutWriting(t *testing.T) {
	tests := []struct {
		name string
		args []string
		want string
	}{
		{
			name: "missing wave",
			args: validWorkpacketCreateArgs("W-NOT-FOUND", "PKT-NEW-MISSING-WAVE"),
			want: `not_found: wave "W-NOT-FOUND"`,
		},
		{
			name: "duplicate id",
			args: validWorkpacketCreateArgs("WA", "PKT-WA-CONTRACT"),
			want: "already exists",
		},
		{
			name: "unknown dependency",
			args: replaceArgument(validWorkpacketCreateArgs("WA", "PKT-NEW-BAD-DEP"), "--depends-on", `["PKT-DOES-NOT-EXIST"]`),
			want: `invalid dependency "PKT-DOES-NOT-EXIST"`,
		},
		{
			name: "self dependency",
			args: replaceArgument(validWorkpacketCreateArgs("WA", "PKT-NEW-SELF-DEP"), "--depends-on", `["PKT-NEW-SELF-DEP"]`),
			want: "cannot depend on itself",
		},
		{
			name: "invalid status",
			args: replaceArgument(validWorkpacketCreateArgs("WA", "PKT-NEW-BAD-STATUS"), "--status", "almost_done"),
			want: `invalid workpacket status "almost_done"`,
		},
		{
			name: "invalid dependency json",
			args: replaceArgument(validWorkpacketCreateArgs("WA", "PKT-NEW-BAD-JSON"), "--depends-on", `{"not":"an array"}`),
			want: "--depends-on must be a JSON array of strings",
		},
		{
			name: "missing required field",
			args: removeArgument(validWorkpacketCreateArgs("WA", "PKT-NEW-MISSING-FIELD"), "--done-when"),
			want: "requires non-empty --done-when",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			path := copyFixtureKB(t)
			before := readFile(t, path)
			args := append(append([]string(nil), test.args...), "--kb", path)
			_, stderr, code := invoke(t, args...)
			if code == 0 || !strings.Contains(stderr, test.want) {
				t.Fatalf("code=%d stderr=%q, want %q", code, stderr, test.want)
			}
			if !bytes.Equal(before, readFile(t, path)) {
				t.Fatal("rejected create modified the KB")
			}
		})
	}
}

func TestWorkpacketRewireReplacesTypedDependencies(t *testing.T) {
	path := copyFixtureKB(t)
	_, stderr, code := invoke(t,
		"workpacket", "rewire", "PKT-WC-LIVE",
		"--depends-on", `["PKT-WC-INTEGRATION","PKT-WB-BETA"]`,
		"--kb", path,
	)
	if code != 0 {
		t.Fatalf("workpacket rewire failed: %s", stderr)
	}
	data := readFile(t, path)
	definition, _ := definitionFor("workpacket")
	item, err := findRecord(data, definition, "PKT-WC-LIVE")
	if err != nil {
		t.Fatal(err)
	}
	got, ok := item.value["depends_on"].([]any)
	if !ok || len(got) != 2 || got[1] != "PKT-WB-BETA" {
		t.Fatalf("depends_on = %#v", item.value["depends_on"])
	}
}

func validWorkpacketCreateArgs(wave, id string) []string {
	return []string{
		"workpacket", "create", wave, id,
		"--depends-on", `["PKT-WA-CONTRACT"]`,
		"--exclusive-file-lease", `["cmd/kbctl/**"]`,
		"--delivers", "Test delivery.",
		"--done-when", "Test completion criterion.",
		"--status", "not_started",
	}
}

func replaceArgument(args []string, flag, value string) []string {
	result := append([]string(nil), args...)
	for i := range result {
		if result[i] == flag {
			result[i+1] = value
			return result
		}
	}
	return result
}

func removeArgument(args []string, flag string) []string {
	for i := range args {
		if args[i] == flag {
			return append(append([]string(nil), args[:i]...), args[i+2:]...)
		}
	}
	return append([]string(nil), args...)
}

func stringSliceValueEqual(value any, want []string) bool {
	items, ok := value.([]any)
	if !ok || len(items) != len(want) {
		return false
	}
	for i := range items {
		if items[i] != want[i] {
			return false
		}
	}
	return true
}
