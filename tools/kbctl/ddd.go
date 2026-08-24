package main

// Domain-modelling records.
//
// The modelling protocol (docs/design/ddd/PROTOCOL.md) used to keep its output
// in a directory of markdown tables with a python script parsing them back out.
// That script was a schema validator wearing a linter's clothes: every rule it
// enforced -- status enums, required evidence, reference integrity -- is a
// property of the records themselves, and markdown was only in the way. These
// kinds put the records in the same store the decisions already live in, so a
// question like "which rules are still UNKNOWN in scenario S-6" is a query
// rather than a grep, and `kbctl verify` answers reference integrity instead of
// a separate tool that has to be remembered.
//
// Prose is not the casualty. A scenario's `story` field holds the Step 1
// narrative verbatim; what changes is that the narrative stops being the place
// integrity is checked.

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// Status vocabularies. These are the protocol's, not this tool's -- changing one
// here without changing PROTOCOL.md puts the checker and the procedure at odds.
var (
	scenarioStatuses = map[string]struct{}{
		"ACTIVE": {}, "WAITING": {}, "DONE": {},
	}
	// KNOWN/ASSUMED/UNKNOWN/CONFLICTED are the four Step 2 states. VERIFIED and
	// REJECTED are where an ASSUMED or UNKNOWN lands once it has an answer; they
	// are kept distinct from KNOWN so that "the canon says so" and "we asked and
	// were told" stay separable evidence.
	ruleStatuses = map[string]struct{}{
		"KNOWN": {}, "ASSUMED": {}, "UNKNOWN": {}, "CONFLICTED": {},
		"VERIFIED": {}, "REJECTED": {},
	}
	ruleNeedsQuestion = map[string]struct{}{
		"ASSUMED": {}, "UNKNOWN": {}, "CONFLICTED": {},
	}
	ruleNeedsEvidence = map[string]struct{}{
		"KNOWN": {}, "VERIFIED": {}, "REJECTED": {},
	}
	questionStatuses = map[string]struct{}{
		"OPEN": {}, "ANSWERED": {},
	}
	// A metaphor is a hypothesis for finding the model, not the model. It is
	// expected to retire: ACTIVE means it may still be cited as a design reason,
	// RETIRED means citing it is a defect, and PARTIAL means it holds somewhere
	// and has already broken somewhere else -- which is only informative if the
	// broken half is named.
	metaphorStatuses = map[string]struct{}{
		"ACTIVE": {}, "PARTIAL": {}, "RETIRED": {},
	}
	mappingConfidences = map[string]struct{}{
		"HIGH": {}, "MEDIUM": {}, "LOW": {},
	}
	deltaAxes = map[string]struct{}{
		"상태": {}, "시간": {}, "동시성": {}, "권한": {}, "일관성": {}, "실패": {},
	}
)

// Romanised or literally translated metaphor words, banned from Go identifiers
// by the 2026-08-16 hybrid-vocabulary decision. `Sign` and `Sea` are absent on
// purpose: they false-positive on Signal and Search. `Port` is absent because it
// is hexagonal-architecture vocabulary, not the harbour metaphor.
// Lesson statuses mirror the canon's AG-12 Lesson aggregate states. A lesson
// claiming verification carries its evidence; a lesson without a reuse recipe
// is an anecdote, not a lesson.
var lessonStatuses = map[string]struct{}{
	"raw": {}, "distilled": {}, "verified": {}, "evergreen": {},
	"stale": {}, "retired": {},
}

var lessonNeedsEvidence = map[string]struct{}{
	"verified": {}, "evergreen": {},
}

func validateLessonRecord(value map[string]any) error {
	identity := text(value, "id")
	if !lessonID.MatchString(identity) {
		return fmt.Errorf("lesson id %q must be L-<n>", identity)
	}
	status := text(value, "status")
	if _, ok := lessonStatuses[status]; !ok {
		return fmt.Errorf("invalid lesson status %q (raw|distilled|verified|evergreen|stale|retired)", status)
	}
	if _, ok := lessonNeedsEvidence[status]; ok {
		evidence := text(value, "evidence")
		if evidence == "" || evidence == "없음" || evidence == "none" {
			return fmt.Errorf("lesson %s is %s and needs evidence: a claim of fact carries its source", identity, status)
		}
	}
	if text(value, "reuse") == "" {
		return fmt.Errorf("lesson %s has no reuse recipe: a lesson without a how-to-apply recipe is an anecdote", identity)
	}
	return nil
}

var metaphorLeakWords = []string{
	// Intentionally empty at adoption. Populate this list only when a discovery
	// metaphor is retired (MET-n RETIRED) and its vocabulary must no longer leak
	// into production identifiers.
}

// A Manager/Service/Handler suffix is where behaviour leaks out of an aggregate.
// A genuine domain service declares itself in `kind` and is exempt.
var anemicSuffixes = []string{
	"Manager", "Processor", "Handler", "Util", "Utils", "Helper", "Service",
}

var (
	scenarioID  = regexp.MustCompile(`^S-\d+$`)
	ruleID      = regexp.MustCompile(`^R-\d+$`)
	questionID  = regexp.MustCompile(`^KG-\d+$`)
	deltaID     = regexp.MustCompile(`^M-\d+$`)
	termID      = regexp.MustCompile(`^T-\d+$`)
	metaphorID  = regexp.MustCompile(`^MET-\d+$`)
	mappingID   = regexp.MustCompile(`^MAP-\d+$`)
	eventID     = regexp.MustCompile(`^EVT-\d+$`)
	commandID   = regexp.MustCompile(`^CMD-\d+$`)
	aggregateID = regexp.MustCompile(`^AGG-\d+$`)
	lessonID    = regexp.MustCompile(`^L-\d+$`)
	usecaseID   = regexp.MustCompile(`^UC-\d+$`)
	specKeyRE   = regexp.MustCompile(`^(INV|CON|OPEN)-\d+$`)
)

var dddIdentityShapes = map[string]*regexp.Regexp{
	"scenario":  scenarioID,
	"rule":      ruleID,
	"question":  questionID,
	"delta":     deltaID,
	"term":      termID,
	"metaphor":  metaphorID,
	"mapping":   mappingID,
	"event":     eventID,
	"command":   commandID,
	"aggregate": aggregateID,
	"usecase":   usecaseID,
}

func isDDDKind(name string) bool {
	_, ok := dddIdentityShapes[name]
	return ok
}

func text(value map[string]any, field string) string {
	s, _ := value[field].(string)
	return strings.TrimSpace(s)
}

// stringsOf reads a field holding one reference or several. `create` writes
// every --field as a JSON string, so a list arrives as "KG-7 KG-13" rather than
// an array; splitting here means a caller never has to hand-edit the store to
// record a second reference. Arrays are still read when present, since records
// written by hand or by a later import path may use them.
func stringsOf(value map[string]any, field string) []string {
	switch typed := value[field].(type) {
	case string:
		fields := strings.FieldsFunc(typed, func(r rune) bool {
			return r == ' ' || r == ',' || r == '\t' || r == '\n' || r == '·'
		})
		out := make([]string, 0, len(fields))
		for _, item := range fields {
			if item = strings.TrimSpace(item); item != "" {
				out = append(out, item)
			}
		}
		return out
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				out = append(out, strings.TrimSpace(s))
			}
		}
		return out
	}
	return nil
}

// validateDDDRecord runs the checks that hold for a record on its own. Anything
// needing a second record (does this question exist, is this Go name unique) is
// deliberately left to dddVerify, because create/update sees one record and
// cannot answer it.
func validateDDDRecord(kind string, value map[string]any) error {
	identity := text(value, "id")
	if shape, ok := dddIdentityShapes[kind]; ok && !shape.MatchString(identity) {
		return fmt.Errorf("%s id %q must match %s", kind, identity, shape)
	}

	switch kind {
	case "scenario":
		status := text(value, "status")
		if _, ok := scenarioStatuses[status]; !ok {
			return fmt.Errorf("invalid scenario status %q (ACTIVE|WAITING|DONE)", status)
		}
	case "rule":
		status := text(value, "status")
		if _, ok := ruleStatuses[status]; !ok {
			return fmt.Errorf("invalid rule status %q", status)
		}
		if _, ok := ruleNeedsQuestion[status]; ok {
			if len(stringsOf(value, "question")) == 0 {
				return fmt.Errorf(
					"rule %s is %s and needs a question: an unknown is recorded, never filled",
					identity, status)
			}
		}
		if _, ok := ruleNeedsEvidence[status]; ok {
			evidence := text(value, "evidence")
			if evidence == "" || evidence == "없음" || evidence == "none" {
				return fmt.Errorf("rule %s is %s and needs evidence: a claim of fact carries its source",
					identity, status)
			}
		}
		if key := text(value, "spec_key"); key != "" && !specKeyRE.MatchString(key) {
			return fmt.Errorf("rule %s spec_key %q must be INV-n, CON-n or OPEN-n", identity, key)
		}
	case "question":
		status := text(value, "status")
		if _, ok := questionStatuses[status]; !ok {
			return fmt.Errorf("invalid question status %q (OPEN|ANSWERED)", status)
		}
		question := text(value, "question")
		if !strings.Contains(question, "?") && !strings.Contains(question, "？") {
			return fmt.Errorf("question %s is not interrogative -- a declarative sentence here is a filled gap: %q",
				identity, question)
		}
		if status == "ANSWERED" && text(value, "answer") == "" {
			return fmt.Errorf("question %s is ANSWERED but carries no answer", identity)
		}
	case "delta":
		axis := text(value, "axis")
		if _, ok := deltaAxes[axis]; !ok {
			return fmt.Errorf("invalid delta axis %q (상태|시간|동시성|권한|일관성|실패)", axis)
		}
	case "metaphor":
		status := text(value, "status")
		if _, ok := metaphorStatuses[status]; !ok {
			return fmt.Errorf("invalid metaphor status %q (ACTIVE|PARTIAL|RETIRED)", status)
		}
		if status == "PARTIAL" && text(value, "invalid_for") == "" {
			return fmt.Errorf("metaphor %s is PARTIAL but names nothing it fails to explain: where it broke is the content of that status", identity)
		}
		if status == "ACTIVE" && text(value, "valid_for") == "" {
			return fmt.Errorf("metaphor %s is ACTIVE but names nothing it explains", identity)
		}
	case "mapping":
		if text(value, "metaphor_id") == "" {
			return fmt.Errorf("mapping %s needs metaphor_id", identity)
		}
		confidence := text(value, "confidence")
		if _, ok := mappingConfidences[confidence]; !ok {
			return fmt.Errorf("invalid mapping confidence %q (HIGH|MEDIUM|LOW)", confidence)
		}
	case "aggregate":
		// The boundary is justified by its invariants, not by object affinity:
		// an aggregate that names no rule it protects is a grouping, not a
		// consistency boundary.
		if text(value, "name") == "" || text(value, "context") == "" {
			return fmt.Errorf("aggregate %s needs name and context", identity)
		}
		if len(stringsOf(value, "protects")) == 0 {
			return fmt.Errorf("aggregate %s protects no rule: a consistency boundary is justified by the invariants it guards (Invariant -> Boundary -> Aggregate)", identity)
		}
		if len(stringsOf(value, "states")) == 0 {
			return fmt.Errorf("aggregate %s declares no states", identity)
		}
	case "usecase":
		for _, field := range []string{"name", "command", "scenario", "given", "when", "then"} {
			if text(value, field) == "" {
				return fmt.Errorf("usecase %s needs %s: a use case is a command walked through Given/When/Then", identity, field)
			}
		}
	case "term":
		goName := text(value, "go")
		if goName == "" || goName == "—" {
			return nil // a concept deliberately without a Go name
		}
		for _, word := range metaphorLeakWords {
			if strings.Contains(goName, word) {
				return fmt.Errorf("term %s Go name %q carries metaphor word %q: borrow the structure, not the vocabulary",
					identity, goName, word)
			}
		}
		if !strings.Contains(text(value, "kind"), "domain-service") {
			for _, suffix := range anemicSuffixes {
				if strings.HasSuffix(goName, suffix) {
					return fmt.Errorf("term %s Go name %q ends in %q: that suffix is where behaviour leaks out of an aggregate. If it really is a domain service, say so in kind",
						identity, goName, suffix)
				}
			}
		}
	}
	return nil
}

// dddResetKinds is every DDD record kind, emptied together because they
// reference each other (a rule's question, a delta's question, a metaphor's
// delta) -- clearing one and leaving the others would just relocate the
// dangling references dddVerify already reports.
var dddResetKinds = []string{"scenario", "rule", "question", "delta", "term", "metaphor", "mapping", "event", "command", "aggregate", "usecase"}

// commandResetDDD empties every ddd_* top-level array back to `[]` and
// rebuilds `_index` to match. It exists because the operator asked to restart
// domain modelling from spec.md's essence with nothing carried over --
// including operator-answered questions -- and there was no way to do that
// without hand-editing the KB, which CLAUDE.md reserves for kbctl's own
// implementation and recovery. This is that extension, not a one-off edit.
func commandResetDDD(path string) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	for _, kind := range dddResetKinds {
		definition, err := definitionFor(kind)
		if err != nil {
			return err
		}
		data, err = ensureContainer(data, definition)
		if err != nil {
			return err
		}
		root, err := rootSpan(data)
		if err != nil {
			return err
		}
		container, err := memberByKey(data, root, definition.topLevel)
		if err != nil {
			return err
		}
		data, err = applyReplacements(data, []replacement{{
			start: container.valueSpan.start,
			end:   container.valueSpan.end,
			value: []byte("[]"),
		}})
		if err != nil {
			return err
		}
	}
	data, err = regenerateIndex(data)
	if err != nil {
		return err
	}
	return atomicWrite(path, data, nil)
}

// dddVerify answers the questions no single record can: does this reference
// resolve, is exactly one scenario active, is the glossary still a bijection.
func dddVerify(data []byte) ([]string, error) {
	sets := map[string]map[string]map[string]any{}
	for _, kind := range []string{"scenario", "rule", "question", "delta", "term", "metaphor", "mapping", "event", "command", "aggregate", "usecase"} {
		definition, err := definitionFor(kind)
		if err != nil {
			return nil, err
		}
		items, err := recordsFor(data, definition)
		if err != nil {
			// A store that predates these kinds simply has nothing to check.
			sets[kind] = map[string]map[string]any{}
			continue
		}
		byID := make(map[string]map[string]any, len(items))
		for _, item := range items {
			id, _ := item.value["id"].(string)
			byID[id] = item.value
		}
		sets[kind] = byID
	}

	var findings []string
	report := func(format string, args ...any) {
		findings = append(findings, fmt.Sprintf(format, args...))
	}
	ids := func(kind string) []string {
		out := make([]string, 0, len(sets[kind]))
		for id := range sets[kind] {
			out = append(out, id)
		}
		sort.Strings(out)
		return out
	}

	// Exactly one ACTIVE scenario. Without this the protocol's Phase 0 -- model
	// one slice at a time -- is a sentence nothing enforces.
	var active []string
	for _, id := range ids("scenario") {
		if text(sets["scenario"][id], "status") == "ACTIVE" {
			active = append(active, id)
		}
	}
	if len(sets["scenario"]) > 0 && len(active) != 1 {
		report("scenario: %d ACTIVE (%s); exactly one scenario is modelled at a time",
			len(active), strings.Join(active, " "))
	}

	for _, id := range ids("rule") {
		value := sets["rule"][id]
		scenario := text(value, "scenario")
		if scenario == "" {
			report("rule %s: no scenario", id)
		} else if _, ok := sets["scenario"][scenario]; !ok && len(sets["scenario"]) > 0 {
			report("rule %s: scenario %s does not exist", id, scenario)
		}
		for _, ref := range stringsOf(value, "question") {
			if _, ok := sets["question"][ref]; !ok {
				report("rule %s: question %s does not exist", id, ref)
			}
		}
	}

	// A metaphor recorded as broken must point at the delta that broke it,
	// otherwise the status is an opinion rather than a finding.
	for _, id := range ids("metaphor") {
		value := sets["metaphor"][id]
		if text(value, "status") != "PARTIAL" {
			continue
		}
		refs := stringsOf(value, "deltas")
		if len(refs) == 0 {
			report("metaphor %s: PARTIAL with no delta; what broke it is unrecorded", id)
		}
		for _, ref := range refs {
			if _, ok := sets["delta"][ref]; !ok {
				report("metaphor %s: delta %s does not exist", id, ref)
			}
		}
	}

	for _, id := range ids("mapping") {
		ref := text(sets["mapping"][id], "metaphor_id")
		if _, ok := sets["metaphor"][ref]; !ok {
			report("mapping %s: metaphor %s does not exist", id, ref)
		}
	}

	for _, id := range ids("delta") {
		refs := stringsOf(sets["delta"][id], "question")
		if len(refs) == 0 {
			report("delta %s: no question. A recorded mismatch with no question is filled by the next pass", id)
		}
		for _, ref := range refs {
			if _, ok := sets["question"][ref]; !ok {
				report("delta %s: question %s does not exist", id, ref)
			}
		}
	}

	for _, id := range ids("question") {
		for _, ref := range stringsOf(sets["question"][id], "blocks") {
			if _, ok := sets["scenario"][ref]; !ok {
				report("question %s: blocks %s, which does not exist", id, ref)
			}
		}
	}

	// A command with no event is a command whose effect was never named -- the
	// whole point of Step 11 is connecting the two.
	for _, id := range ids("command") {
		value := sets["command"][id]
		if scenario := text(value, "scenario"); scenario != "" {
			if _, ok := sets["scenario"][scenario]; !ok && len(sets["scenario"]) > 0 {
				report("command %s: scenario %s does not exist", id, scenario)
			}
		}
		produces := stringsOf(value, "produces")
		if len(produces) == 0 {
			report("command %s: produces no event", id)
		}
		for _, ref := range produces {
			if _, ok := sets["event"][ref]; !ok {
				report("command %s: produces %s, which does not exist", id, ref)
			}
		}
	}

	for _, id := range ids("event") {
		value := sets["event"][id]
		if scenario := text(value, "scenario"); scenario != "" {
			if _, ok := sets["scenario"][scenario]; !ok && len(sets["scenario"]) > 0 {
				report("event %s: scenario %s does not exist", id, scenario)
			}
		}
		for _, ref := range stringsOf(value, "command") {
			if _, ok := sets["command"][ref]; !ok {
				report("event %s: command %s does not exist", id, ref)
			}
		}
	}

	for _, id := range ids("aggregate") {
		value := sets["aggregate"][id]
		for _, ref := range stringsOf(value, "protects") {
			if _, ok := sets["rule"][ref]; !ok {
				report("aggregate %s: protects %s, which does not exist", id, ref)
			}
		}
	}

	for _, id := range ids("usecase") {
		value := sets["usecase"][id]
		if ref := text(value, "command"); ref != "" {
			if _, ok := sets["command"][ref]; !ok {
				report("usecase %s: command %s does not exist", id, ref)
			}
		}
		if ref := text(value, "scenario"); ref != "" {
			if _, ok := sets["scenario"][ref]; !ok && len(sets["scenario"]) > 0 {
				report("usecase %s: scenario %s does not exist", id, ref)
			}
		}
		for _, ref := range stringsOf(value, "invariants") {
			if _, ok := sets["rule"][ref]; !ok {
				report("usecase %s: invariant %s does not exist", id, ref)
			}
		}
		if ref := text(value, "aggregate"); ref != "" {
			if _, ok := sets["aggregate"][ref]; !ok {
				report("usecase %s: aggregate %s does not exist", id, ref)
			}
		}
	}

	// The glossary locks document vocabulary to Go identifiers one to one. A Go
	// name serving two document terms is the collision that makes the mapping
	// unusable in the direction that matters at review time: code back to canon.
	byGo := map[string]string{}
	byDoc := map[string]string{}
	for _, id := range ids("term") {
		value := sets["term"][id]
		doc, goName := text(value, "doc"), text(value, "go")
		if doc != "" {
			if prior, clash := byDoc[doc]; clash {
				report("term %s: document term %q already mapped by %s", id, doc, prior)
			}
			byDoc[doc] = id
		}
		if goName == "" || goName == "—" {
			continue
		}
		if prior, clash := byGo[goName]; clash {
			report("term %s: Go name %q already used by %s", id, goName, prior)
		}
		byGo[goName] = id
	}

	return findings, nil
}
