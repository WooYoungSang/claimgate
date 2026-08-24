// Command kbctl reads and surgically updates the canonical project knowledge
// base.
//
// Ported verbatim from warvis-siren cmd/kbctl (commit 9c5ee2fa, 2026-08-16).
// The source was adopted into warvis-claimgate so the tool and its knowledge
// store remain inside this project's context boundary.
package main

import (
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
)

const defaultKBPath = "governance/knowledge/claimgate-kb.json"

type repeatedFlag []string

func (values *repeatedFlag) String() string { return strings.Join(*values, ",") }

func (values *repeatedFlag) Set(value string) error {
	*values = append(*values, value)
	return nil
}

type optionalFlag struct {
	value string
	set   bool
}

func (value *optionalFlag) String() string { return value.value }

func (value *optionalFlag) Set(text string) error {
	value.value = text
	value.set = true
	return nil
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if err := execute(args, stdout); err != nil {
		fmt.Fprintln(stderr, "kbctl:", err)
		return 1
	}
	return 0
}

func execute(args []string, stdout io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: kbctl <get|list|search|create|update|change|render|roadmap|workpacket|wave|verify> ...")
	}

	kbPath, remaining, err := extractKBPath(args[1:])
	if err != nil {
		return err
	}

	switch args[0] {
	case "get":
		if len(remaining) != 2 {
			return fmt.Errorf("usage: kbctl get <document|decision|incident|open_issue|roadmap|workpacket|wave> <id-or-stage> [--kb path]")
		}
		return commandGet(kbPath, remaining[0], remaining[1], stdout)
	case "list":
		return executeList(kbPath, remaining, stdout)
	case "search":
		return executeSearch(kbPath, remaining, stdout)
	case "create":
		return executeCreate(kbPath, remaining)
	case "update":
		return executeUpdate(kbPath, remaining)
	case "change":
		return executeChange(kbPath, remaining, stdout)
	case "roadmap":
		return executeRoadmap(kbPath, remaining)
	case "workpacket":
		return executeWorkpacket(kbPath, remaining)
	case "wave":
		return executeWave(kbPath, remaining)
	case "render":
		return executeRender(kbPath, remaining, stdout)
	case "reset":
		return executeReset(kbPath, remaining)
	case "verify":
		if len(remaining) != 0 {
			return fmt.Errorf("usage: kbctl verify [--kb path]")
		}
		return commandVerify(kbPath, stdout)
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func executeReset(kbPath string, args []string) error {
	if len(args) != 1 || args[0] != "ddd" {
		return fmt.Errorf("usage: kbctl reset ddd [--kb path] -- empties every scenario/rule/question/delta/term/metaphor record")
	}
	return commandResetDDD(kbPath)
}

func executeChange(kbPath string, args []string, stdout io.Writer) error {
	const usage = "usage: kbctl change <create|get|history|impact|diff> ..."
	if len(args) == 0 {
		return fmt.Errorf("%s", usage)
	}
	switch args[0] {
	case "get":
		if len(args) != 2 {
			return fmt.Errorf("usage: kbctl change get <CHG-n> [--kb path]")
		}
		return commandGet(kbPath, "change", args[1], stdout)
	case "history":
		if len(args) != 2 {
			return fmt.Errorf("usage: kbctl change history <record-id> [--kb path]")
		}
		return commandChangeHistory(kbPath, args[1], stdout)
	case "impact":
		if len(args) != 2 {
			return fmt.Errorf("usage: kbctl change impact <CHG-n> [--kb path]")
		}
		return commandChangeImpact(kbPath, args[1], stdout)
	case "diff":
		if len(args) != 3 {
			return fmt.Errorf("usage: kbctl change diff <CHG-n> <CHG-n> [--kb path]")
		}
		return commandChangeDiff(kbPath, args[1], args[2], stdout)
	case "create":
		if len(args) < 2 {
			return fmt.Errorf("usage: kbctl change create <CHG-n> --subject <record-id> --affected <json|@file> --reason text --migration text --rollout text --rollback text --evidence text --actor text --status <proposed|accepted|applied|rolled_back> [--supersedes record-id] [--effective-at RFC3339] [--kb path]")
		}
		fs := newFlagSet("change create")
		subject := fs.String("subject", "", "authoritative record after the change")
		supersedes := fs.String("supersedes", "", "record replaced by the subject")
		var affected optionalFlag
		fs.Var(&affected, "affected", "JSON string array of affected record ids, or @path")
		reason := fs.String("reason", "", "reason for the design change")
		migration := fs.String("migration", "", "migration procedure")
		rollout := fs.String("rollout", "", "rollout procedure")
		rollback := fs.String("rollback", "", "rollback procedure")
		evidence := fs.String("evidence", "", "verification evidence")
		actor := fs.String("actor", "", "decision actor")
		effectiveAt := fs.String("effective-at", "", "RFC3339 effective time; defaults to recorded time")
		status := fs.String("status", "", "proposed|accepted|applied|rolled_back")
		if err := fs.Parse(args[2:]); err != nil {
			return err
		}
		if fs.NArg() != 0 {
			return fmt.Errorf("unexpected change create arguments: %s", strings.Join(fs.Args(), " "))
		}
		if *subject == "" || !affected.set || *reason == "" || *migration == "" || *rollout == "" || *rollback == "" || *evidence == "" || *actor == "" || *status == "" {
			return fmt.Errorf("change create requires subject, affected, reason, migration, rollout, rollback, evidence, actor, and status")
		}
		affectedIDs, err := parseJSONStringArrayArgument("--affected", affected.value)
		if err != nil {
			return err
		}
		return commandCreateChange(kbPath, args[1], changeCreateInput{
			subject:     *subject,
			supersedes:  *supersedes,
			affected:    affectedIDs,
			reason:      *reason,
			migration:   *migration,
			rollout:     *rollout,
			rollback:    *rollback,
			evidence:    *evidence,
			actor:       *actor,
			effectiveAt: *effectiveAt,
			status:      *status,
		})
	default:
		return fmt.Errorf("%s", usage)
	}
}

func executeWave(kbPath string, args []string) error {
	if len(args) < 2 || (args[0] != "set" && args[0] != "create") {
		return fmt.Errorf("usage: kbctl wave <create|set> <wave> [--goal text] [--parallelism text] [--kb path]")
	}
	fs := newFlagSet("wave " + args[0])
	var goal, parallelism optionalFlag
	fs.Var(&goal, "goal", "wave goal")
	fs.Var(&parallelism, "parallelism", "wave parallelism")
	if err := fs.Parse(args[2:]); err != nil {
		return err
	}
	if args[0] == "create" {
		if fs.NArg() != 0 || !goal.set || !parallelism.set {
			return fmt.Errorf("wave create requires exactly one wave and both --goal and --parallelism")
		}
		return commandCreateWave(kbPath, args[1], goal.value, parallelism.value)
	}
	if fs.NArg() != 0 || (!goal.set && !parallelism.set) {
		return fmt.Errorf("wave set requires exactly one wave and at least one of --goal or --parallelism")
	}
	var edits []fieldEdit
	if goal.set {
		edits = append(edits, fieldEdit{name: "goal", value: goal.value})
	}
	if parallelism.set {
		edits = append(edits, fieldEdit{name: "parallelism", value: parallelism.value})
	}
	return commandSetWave(kbPath, args[1], edits)
}

func extractKBPath(args []string) (string, []string, error) {
	path := defaultKBPath
	remaining := make([]string, 0, len(args))
	seen := false
	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "--kb":
			if seen {
				return "", nil, fmt.Errorf("--kb may be specified only once")
			}
			if i+1 >= len(args) {
				return "", nil, fmt.Errorf("--kb requires a path")
			}
			seen = true
			path = args[i+1]
			i++
		case strings.HasPrefix(arg, "--kb="):
			if seen {
				return "", nil, fmt.Errorf("--kb may be specified only once")
			}
			seen = true
			path = strings.TrimPrefix(arg, "--kb=")
		default:
			remaining = append(remaining, arg)
		}
	}
	if path == "" {
		return "", nil, fmt.Errorf("--kb requires a non-empty path")
	}
	return path, remaining, nil
}

func newFlagSet(name string) *flag.FlagSet {
	fs := flag.NewFlagSet(name, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	return fs
}

func executeList(kbPath string, args []string, stdout io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: kbctl list <document|decision|incident|open_issue|roadmap|workpacket|wave> [--filter field=value ...] [--kb path]")
	}
	fs := newFlagSet("list")
	var filters repeatedFlag
	fs.Var(&filters, "filter", "exact field=value filter (repeatable)")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if fs.NArg() != 0 {
		return fmt.Errorf("unexpected list arguments: %s", strings.Join(fs.Args(), " "))
	}
	parsed, err := parseAssignments(filters, false)
	if err != nil {
		return fmt.Errorf("invalid --filter: %w", err)
	}
	return commandList(kbPath, args[0], parsed, stdout)
}

func executeSearch(kbPath string, args []string, stdout io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: kbctl search <query> [--kind k1,k2,...] [--kb path]")
	}
	fs := newFlagSet("search")
	kinds := fs.String("kind", "", "comma-separated kinds")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if fs.NArg() != 0 {
		return fmt.Errorf("unexpected search arguments: %s", strings.Join(fs.Args(), " "))
	}
	return commandSearch(kbPath, args[0], *kinds, stdout)
}

func executeCreate(kbPath string, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("usage: kbctl create <kind> <id> --field name=value [--field name=value ...] [--kb path]")
	}
	fs := newFlagSet("create")
	var fields repeatedFlag
	fs.Var(&fields, "field", "name=value field (repeatable); do not pass the identity field, it's the positional <id>")
	if err := fs.Parse(args[2:]); err != nil {
		return err
	}
	if fs.NArg() != 0 {
		return fmt.Errorf("unexpected create arguments: %s", strings.Join(fs.Args(), " "))
	}
	if len(fields) == 0 {
		return fmt.Errorf("at least one --field name=value is required")
	}
	parsed, err := parseAssignments(fields, true)
	if err != nil {
		return fmt.Errorf("invalid --field: %w", err)
	}
	return commandCreate(kbPath, args[0], args[1], parsed)
}

func executeUpdate(kbPath string, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("usage: kbctl update <kind> <id> --field name=value [--field name=value ...] [--kb path]")
	}
	fs := newFlagSet("update")
	var fields repeatedFlag
	fs.Var(&fields, "field", "name=value update (repeatable)")
	if err := fs.Parse(args[2:]); err != nil {
		return err
	}
	if fs.NArg() != 0 {
		return fmt.Errorf("unexpected update arguments: %s", strings.Join(fs.Args(), " "))
	}
	if len(fields) == 0 {
		return fmt.Errorf("at least one --field name=value is required")
	}
	parsed, err := parseAssignments(fields, true)
	if err != nil {
		return fmt.Errorf("invalid --field: %w", err)
	}
	return commandUpdate(kbPath, args[0], args[1], parsed)
}

func executeRoadmap(kbPath string, args []string) error {
	if len(args) < 2 || args[0] != "set" {
		return fmt.Errorf("usage: kbctl roadmap set <stage> --status value [--evidence text] [--note text] [--kb path]")
	}
	fs := newFlagSet("roadmap set")
	status := fs.String("status", "", "roadmap status")
	var evidence optionalFlag
	var note optionalFlag
	fs.Var(&evidence, "evidence", "roadmap evidence")
	fs.Var(&note, "note", "roadmap note")
	if err := fs.Parse(args[2:]); err != nil {
		return err
	}
	if fs.NArg() != 0 || *status == "" {
		return fmt.Errorf("roadmap set requires exactly one stage and a non-empty --status")
	}
	edits := []fieldEdit{{name: "status", value: *status}}
	if evidence.set {
		edits = append(edits, fieldEdit{name: "evidence", value: evidence.value})
	}
	if note.set {
		edits = append(edits, fieldEdit{name: "note", value: note.value})
	}
	return commandUpdate(kbPath, "roadmap", args[1], edits)
}

func executeWorkpacket(kbPath string, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: kbctl workpacket <create|set> ...")
	}
	if args[0] == "create" {
		return executeWorkpacketCreate(kbPath, args[1:])
	}
	if args[0] == "rewire" {
		return executeWorkpacketRewire(kbPath, args[1:])
	}
	if len(args) < 2 || args[0] != "set" {
		return fmt.Errorf("usage: kbctl workpacket set <id> --status <not_started|in_progress|complete|blocked|superseded> [--evidence text] [--next-step text] [--kb path]")
	}
	fs := newFlagSet("workpacket set")
	status := fs.String("status", "", "work packet status")
	var evidence, nextStep optionalFlag
	fs.Var(&evidence, "evidence", "work packet evidence")
	fs.Var(&nextStep, "next-step", "work packet next step")
	if err := fs.Parse(args[2:]); err != nil {
		return err
	}
	if fs.NArg() != 0 || *status == "" {
		return fmt.Errorf("workpacket set requires exactly one id and a non-empty --status")
	}
	edits := []fieldEdit{{name: "status", value: *status}}
	if evidence.set {
		edits = append(edits, fieldEdit{name: "evidence", value: evidence.value})
	}
	if nextStep.set {
		edits = append(edits, fieldEdit{name: "next_step", value: nextStep.value})
	}
	return commandUpdate(kbPath, "workpacket", args[1], edits)
}

func executeWorkpacketRewire(kbPath string, args []string) error {
	const usage = "usage: kbctl workpacket rewire <id> --depends-on <json|@file> [--kb path]"
	if len(args) < 1 {
		return fmt.Errorf("%s", usage)
	}
	fs := newFlagSet("workpacket rewire")
	var dependsOn optionalFlag
	fs.Var(&dependsOn, "depends-on", "JSON string array, or @path to a JSON file")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if fs.NArg() != 0 || !dependsOn.set {
		return fmt.Errorf("%s", usage)
	}
	parsed, err := parseJSONStringArrayArgument("depends_on", dependsOn.value)
	if err != nil {
		return err
	}
	return commandRewireWorkpacket(kbPath, args[0], parsed)
}

func executeWorkpacketCreate(kbPath string, args []string) error {
	const usage = "usage: kbctl workpacket create <wave> <id> --depends-on <json|@file> --exclusive-file-lease <json|@file> --delivers text --done-when text --status <not_started|in_progress|complete|blocked|superseded> [--kb path]"
	if len(args) < 2 {
		return fmt.Errorf("%s", usage)
	}
	fs := newFlagSet("workpacket create")
	var dependsOn, exclusiveFileLease optionalFlag
	fs.Var(&dependsOn, "depends-on", "JSON string array, or @path to a JSON file")
	fs.Var(&exclusiveFileLease, "exclusive-file-lease", "JSON string array, or @path to a JSON file")
	delivers := fs.String("delivers", "", "workpacket delivery")
	doneWhen := fs.String("done-when", "", "workpacket completion criterion")
	status := fs.String("status", "", "workpacket status")
	if err := fs.Parse(args[2:]); err != nil {
		return err
	}
	if fs.NArg() != 0 {
		return fmt.Errorf("unexpected workpacket create arguments: %s", strings.Join(fs.Args(), " "))
	}
	if !dependsOn.set {
		return fmt.Errorf("workpacket create requires --depends-on")
	}
	if !exclusiveFileLease.set {
		return fmt.Errorf("workpacket create requires --exclusive-file-lease")
	}
	if *delivers == "" {
		return fmt.Errorf("workpacket create requires non-empty --delivers")
	}
	if *doneWhen == "" {
		return fmt.Errorf("workpacket create requires non-empty --done-when")
	}
	if *status == "" {
		return fmt.Errorf("workpacket create requires non-empty --status")
	}
	dependencies, err := parseJSONStringArrayArgument("--depends-on", dependsOn.value)
	if err != nil {
		return err
	}
	leases, err := parseJSONStringArrayArgument("--exclusive-file-lease", exclusiveFileLease.value)
	if err != nil {
		return err
	}
	return commandCreateWorkpacket(kbPath, args[0], args[1], workpacketCreateFields{
		dependsOn:          dependencies,
		exclusiveFileLease: leases,
		delivers:           *delivers,
		doneWhen:           *doneWhen,
		status:             *status,
	})
}

func executeRender(kbPath string, args []string, stdout io.Writer) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: kbctl render <view|all> [--out repo-root] [--kb path]")
	}
	fs := newFlagSet("render")
	outDir := fs.String("out", "", "repository root to write views into; omit to print to stdout")
	// The view name is positional and comes first, so parse what follows it:
	// Go's flag package stops at the first non-flag argument.
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}
	if fs.NArg() != 0 {
		return fmt.Errorf("unexpected render arguments: %s", strings.Join(fs.Args(), " "))
	}
	return commandRender(kbPath, args[0], *outDir, stdout)
}
