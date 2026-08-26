package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type kindDefinition struct {
	name       string
	topLevel   string
	identity   string
	narrative  []string
	indexField string
}

var kindDefinitions = []kindDefinition{
	{name: "document", topLevel: "documents", identity: "id", narrative: []string{"title", "path", "summary", "status"}, indexField: "document_ids"},
	{name: "decision", topLevel: "decisions", identity: "id", narrative: []string{"decision", "rationale", "status"}, indexField: "decision_ids"},
	{name: "change", topLevel: "design_changes", identity: "id", narrative: []string{"subject", "reason", "status", "actor"}, indexField: "design_change_ids"},
	{name: "incident", topLevel: "incidents", identity: "id", narrative: []string{"summary", "resolution"}, indexField: "incident_ids"},
	{name: "open_issue", topLevel: "open_issues", identity: "id", narrative: []string{"description", "next_step", "status"}, indexField: "open_issue_ids"},
	// Operational lessons: what a session learned the hard way, kept queryable
	// so the next dispatch reuses it instead of rediscovering it. The status
	// vocabulary mirrors the canon's Lesson aggregate (AG-12): raw observations
	// distill, get verified against evidence, and either become evergreen or
	// retire. Deliberately NOT a ddd_* kind — `kbctl reset ddd` must not wipe
	// operational knowledge.
	{name: "lesson", topLevel: "lessons", identity: "id", narrative: []string{"lesson", "status"}, indexField: "lesson_ids"},
	{name: "roadmap", topLevel: "roadmap", identity: "stage", narrative: []string{"output", "status"}, indexField: "roadmap_stages"},
	{name: "workpacket", identity: "id", narrative: []string{"status"}, indexField: "mvp_v1_work_packet_ids"},
	// Domain-modelling records; see ddd.go for their vocabularies and checks.
	{name: "scenario", topLevel: "ddd_scenarios", identity: "id", narrative: []string{"title", "status", "outcome", "importance"}, indexField: "ddd_scenario_ids"},
	{name: "rule", topLevel: "ddd_rules", identity: "id", narrative: []string{"statement", "scenario", "status"}, indexField: "ddd_rule_ids"},
	{name: "question", topLevel: "ddd_questions", identity: "id", narrative: []string{"question", "source", "status"}, indexField: "ddd_question_ids"},
	{name: "delta", topLevel: "ddd_metaphor_deltas", identity: "id", narrative: []string{"metaphor", "domain", "mismatch", "axis"}, indexField: "ddd_delta_ids"},
	{name: "term", topLevel: "ddd_terms", identity: "id", narrative: []string{"doc", "definition", "not_a"}, indexField: "ddd_term_ids"},
	{name: "metaphor", topLevel: "ddd_metaphors", identity: "id", narrative: []string{"area", "status"}, indexField: "ddd_metaphor_ids"},
	{name: "mapping", topLevel: "ddd_metaphor_mappings", identity: "id", narrative: []string{"metaphor", "domain", "meaning", "confidence"}, indexField: "ddd_mapping_ids"},
	{name: "event", topLevel: "ddd_events", identity: "id", narrative: []string{"name", "scenario"}, indexField: "ddd_event_ids"},
	{name: "command", topLevel: "ddd_commands", identity: "id", narrative: []string{"name", "actor", "scenario"}, indexField: "ddd_command_ids"},
	// Steps 12-14 and 18 of the protocol, marked "(예정)" there until a store
	// existed for them. An aggregate is a consistency boundary derived from
	// invariants; a use case is a command walked through Given/When/Then.
	{name: "aggregate", topLevel: "ddd_aggregates", identity: "id", narrative: []string{"name", "context", "consistency"}, indexField: "ddd_aggregate_ids"},
	{name: "usecase", topLevel: "ddd_usecases", identity: "id", narrative: []string{"name", "command", "scenario"}, indexField: "ddd_usecase_ids"},
}

var waveDefinition = kindDefinition{
	name: "wave", identity: "wave", narrative: []string{"goal", "parallelism"},
}

var allowedWorkPacketStatuses = map[string]struct{}{
	"not_started": {},
	"in_progress": {},
	"complete":    {},
	"blocked":     {},
	"superseded":  {},
}

// Human Review Gate states are orthogonal to the work packet lifecycle status.
// A completed implementation may still be waiting for human review before it
// becomes commit-ready or done.
var allowedReviewGateStatuses = map[string]struct{}{
	"IMPLEMENTING":           {},
	"AI_VERIFYING":           {},
	"READY_FOR_HUMAN_REVIEW": {},
	"HUMAN_REWORK":           {},
	"HUMAN_ACCEPTED":         {},
	"COMMIT_READY":           {},
	"DONE":                   {},
}

type fieldEdit struct {
	name  string
	value string
}

type record struct {
	span  byteSpan
	value map[string]any
}

type kbIndex struct {
	TopLevelKeys       []string `json:"top_level_keys"`
	DocumentIDs        []string `json:"document_ids,omitempty"`
	DecisionIDs        []string `json:"decision_ids"`
	DesignChangeIDs    []string `json:"design_change_ids,omitempty"`
	IncidentIDs        []string `json:"incident_ids"`
	OpenIssueIDs       []string `json:"open_issue_ids"`
	RoadmapStages      []string `json:"roadmap_stages"`
	MVPV1WorkPacketIDs []string `json:"mvp_v1_work_packet_ids"`
	DDDScenarioIDs     []string `json:"ddd_scenario_ids,omitempty"`
	DDDRuleIDs         []string `json:"ddd_rule_ids,omitempty"`
	DDDQuestionIDs     []string `json:"ddd_question_ids,omitempty"`
	DDDDeltaIDs        []string `json:"ddd_delta_ids,omitempty"`
	DDDTermIDs         []string `json:"ddd_term_ids,omitempty"`
	DDDMetaphorIDs     []string `json:"ddd_metaphor_ids,omitempty"`
	DDDMappingIDs      []string `json:"ddd_mapping_ids,omitempty"`
	DDDEventIDs        []string `json:"ddd_event_ids,omitempty"`
	DDDCommandIDs      []string `json:"ddd_command_ids,omitempty"`
	DDDAggregateIDs    []string `json:"ddd_aggregate_ids,omitempty"`
	DDDUsecaseIDs      []string `json:"ddd_usecase_ids,omitempty"`
	LessonIDs          []string `json:"lesson_ids,omitempty"`
}

func definitionFor(name string) (kindDefinition, error) {
	if name == waveDefinition.name {
		return waveDefinition, nil
	}
	for _, definition := range kindDefinitions {
		if definition.name == name {
			return definition, nil
		}
	}
	return kindDefinition{}, fmt.Errorf("unknown kind %q", name)
}

func isOptionalKind(name string) bool {
	return isDDDKind(name) || name == "lesson" || name == "change"
}

func readKB(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read KB: %w", err)
	}
	if !json.Valid(data) {
		return nil, fmt.Errorf("invalid JSON in %s", path)
	}
	return data, nil
}

func commandSetProjectName(path, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("project name must be non-empty")
	}
	data, err := readKB(path)
	if err != nil {
		return err
	}
	root, err := rootSpan(data)
	if err != nil {
		return err
	}
	meta, err := memberByKey(data, root, "meta")
	if err != nil {
		return fmt.Errorf("project meta: %w", err)
	}
	updated, err := patchObjectFields(data, meta.valueSpan, []fieldEdit{{name: "name", value: name}})
	if err != nil {
		return err
	}
	updated, err = regenerateIndex(updated)
	if err != nil {
		return err
	}
	return atomicWrite(path, updated, nil)
}

func rootSpan(data []byte) (byteSpan, error) {
	start := skipWhitespace(data, 0)
	end, err := scanValue(data, start)
	if err != nil {
		return byteSpan{}, err
	}
	if start >= len(data) || data[start] != '{' || skipWhitespace(data, end) != len(data) {
		return byteSpan{}, fmt.Errorf("KB root must be one JSON object")
	}
	return byteSpan{start: start, end: end}, nil
}

func recordSpans(data []byte, definition kindDefinition) ([]byteSpan, error) {
	root, err := rootSpan(data)
	if err != nil {
		return nil, err
	}
	if definition.name != "workpacket" && definition.name != "wave" {
		section, err := memberByKey(data, root, definition.topLevel)
		if err != nil {
			return nil, err
		}
		return parseArrayElements(data, section.valueSpan)
	}

	roadmap, err := memberByKey(data, root, "mvp_v1_parallel_roadmap")
	if err != nil {
		return nil, err
	}
	waves, err := memberByKey(data, roadmap.valueSpan, "waves")
	if err != nil {
		return nil, err
	}
	waveSpans, err := parseArrayElements(data, waves.valueSpan)
	if err != nil {
		return nil, err
	}
	if definition.name == "wave" {
		return waveSpans, nil
	}
	var packets []byteSpan
	for _, wave := range waveSpans {
		member, err := memberByKey(data, wave, "work_packets")
		if err != nil {
			return nil, err
		}
		elements, err := parseArrayElements(data, member.valueSpan)
		if err != nil {
			return nil, err
		}
		packets = append(packets, elements...)
	}
	return packets, nil
}

func recordsFor(data []byte, definition kindDefinition) ([]record, error) {
	spans, err := recordSpans(data, definition)
	if err != nil {
		return nil, err
	}
	records := make([]record, 0, len(spans))
	for _, span := range spans {
		var value map[string]any
		if err := json.Unmarshal(data[span.start:span.end], &value); err != nil {
			return nil, fmt.Errorf("decode %s record: %w", definition.name, err)
		}
		records = append(records, record{span: span, value: value})
	}
	return records, nil
}

func findRecord(data []byte, definition kindDefinition, identity string) (record, error) {
	records, err := recordsFor(data, definition)
	if err != nil {
		return record{}, err
	}
	for _, candidate := range records {
		if value, ok := candidate.value[definition.identity].(string); ok && value == identity {
			return candidate, nil
		}
	}
	return record{}, fmt.Errorf("not_found: %s %q", definition.name, identity)
}

func writeJSON(output io.Writer, value any) error {
	encoder := json.NewEncoder(output)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

func rawRecords(data []byte, records []record) []json.RawMessage {
	result := make([]json.RawMessage, 0, len(records))
	for _, item := range records {
		result = append(result, json.RawMessage(data[item.span.start:item.span.end]))
	}
	return result
}

func commandGet(path, kind, identity string, output io.Writer) error {
	definition, err := definitionFor(kind)
	if err != nil {
		return err
	}
	data, err := readKB(path)
	if err != nil {
		return err
	}
	item, err := findRecord(data, definition, identity)
	if err != nil {
		return err
	}
	if definition.name == "wave" {
		summary, err := summarizeWave(data, item)
		if err != nil {
			return err
		}
		return writeJSON(output, summary)
	}
	_, err = fmt.Fprintln(output, string(data[item.span.start:item.span.end]))
	return err
}

func commandList(path, kind string, filters []fieldEdit, output io.Writer) error {
	definition, err := definitionFor(kind)
	if err != nil {
		return err
	}
	data, err := readKB(path)
	if err != nil {
		return err
	}
	items, err := recordsFor(data, definition)
	if err != nil {
		return err
	}
	matched := items[:0]
	for _, item := range items {
		matches := true
		for _, filter := range filters {
			value, ok := item.value[filter.name].(string)
			if !ok || value != filter.value {
				matches = false
				break
			}
		}
		if matches {
			matched = append(matched, item)
		}
	}
	if len(matched) == 0 {
		return fmt.Errorf("not_found: no %s records matched", kind)
	}
	if definition.name == "wave" {
		summaries := make([]waveSummary, 0, len(matched))
		for _, item := range matched {
			summary, err := summarizeWave(data, item)
			if err != nil {
				return err
			}
			summaries = append(summaries, summary)
		}
		return writeJSON(output, summaries)
	}
	return writeJSON(output, rawRecords(data, matched))
}

type waveWorkpacketSummary struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

type waveSummary struct {
	Wave        string                  `json:"wave"`
	Parallelism string                  `json:"parallelism"`
	Goal        string                  `json:"goal"`
	WorkPackets []waveWorkpacketSummary `json:"work_packets"`
}

func summarizeWave(data []byte, item record) (waveSummary, error) {
	stringField := func(name string) (string, error) {
		value, ok := item.value[name].(string)
		if !ok || value == "" {
			return "", fmt.Errorf("wave %q must be a non-empty string", name)
		}
		return value, nil
	}
	wave, err := stringField("wave")
	if err != nil {
		return waveSummary{}, err
	}
	parallelism, err := stringField("parallelism")
	if err != nil {
		return waveSummary{}, err
	}
	goal, err := stringField("goal")
	if err != nil {
		return waveSummary{}, err
	}
	member, err := memberByKey(data, item.span, "work_packets")
	if err != nil {
		return waveSummary{}, err
	}
	packetSpans, err := parseArrayElements(data, member.valueSpan)
	if err != nil {
		return waveSummary{}, err
	}
	packets := make([]waveWorkpacketSummary, 0, len(packetSpans))
	for _, span := range packetSpans {
		var packet struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		}
		if err := json.Unmarshal(data[span.start:span.end], &packet); err != nil {
			return waveSummary{}, fmt.Errorf("decode workpacket summary in wave %q: %w", wave, err)
		}
		if packet.ID == "" {
			return waveSummary{}, fmt.Errorf("workpacket in wave %q is missing a non-empty id", wave)
		}
		if _, ok := allowedWorkPacketStatuses[packet.Status]; !ok {
			return waveSummary{}, fmt.Errorf("workpacket %q in wave %q has invalid status %q", packet.ID, wave, packet.Status)
		}
		packets = append(packets, waveWorkpacketSummary{ID: packet.ID, Status: packet.Status})
	}
	return waveSummary{Wave: wave, Parallelism: parallelism, Goal: goal, WorkPackets: packets}, nil
}

func commandSearch(path, query, selectedKinds string, output io.Writer) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	definitions, err := selectedDefinitions(selectedKinds)
	if err != nil {
		return err
	}
	needle := strings.ToLower(query)
	var matches []json.RawMessage
	for _, definition := range definitions {
		items, err := recordsFor(data, definition)
		if err != nil {
			// A modelling kind with no container yet holds nothing to match.
			// Searching every kind must not fail because one is unused.
			if isOptionalKind(definition.name) {
				continue
			}
			return err
		}
		for _, item := range items {
			for _, field := range definition.narrative {
				value, ok := item.value[field].(string)
				if ok && strings.Contains(strings.ToLower(value), needle) {
					matches = append(matches, json.RawMessage(data[item.span.start:item.span.end]))
					break
				}
			}
		}
	}
	if len(matches) == 0 {
		return fmt.Errorf("not_found: no records matched query %q", query)
	}
	return writeJSON(output, matches)
}

func selectedDefinitions(value string) ([]kindDefinition, error) {
	if value == "" {
		return append([]kindDefinition(nil), kindDefinitions...), nil
	}
	parts := strings.Split(value, ",")
	definitions := make([]kindDefinition, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		name := strings.TrimSpace(part)
		definition, err := definitionFor(name)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		definitions = append(definitions, definition)
	}
	return definitions, nil
}

func parseAssignments(values []string, loadFiles bool) ([]fieldEdit, error) {
	edits := make([]fieldEdit, 0, len(values))
	for _, value := range values {
		name, text, found := strings.Cut(value, "=")
		if !found || name == "" {
			return nil, fmt.Errorf("%q must use name=value", value)
		}
		if loadFiles && strings.HasPrefix(text, "@") {
			if len(text) == 1 {
				return nil, fmt.Errorf("%q has an empty file path", value)
			}
			contents, err := os.ReadFile(strings.TrimPrefix(text, "@"))
			if err != nil {
				return nil, fmt.Errorf("read field %q: %w", name, err)
			}
			text = string(contents)
		}
		edits = append(edits, fieldEdit{name: name, value: text})
	}
	return edits, nil
}

func parseJSONStringArrayArgument(name, value string) ([]string, error) {
	if strings.HasPrefix(value, "@") {
		if len(value) == 1 {
			return nil, fmt.Errorf("%s has an empty file path", name)
		}
		contents, err := os.ReadFile(strings.TrimPrefix(value, "@"))
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", name, err)
		}
		value = string(contents)
	}
	var result []string
	if err := json.Unmarshal([]byte(value), &result); err != nil || result == nil {
		return nil, fmt.Errorf("%s must be a JSON array of strings", name)
	}
	seen := make(map[string]struct{}, len(result))
	for _, item := range result {
		if item == "" {
			return nil, fmt.Errorf("%s entries must be non-empty strings", name)
		}
		if _, exists := seen[item]; exists {
			return nil, fmt.Errorf("%s contains duplicate entry %q", name, item)
		}
		seen[item] = struct{}{}
	}
	return result, nil
}

// commandCreate appends a brand-new record to a top-level array kind
// (decision/incident/open_issue). Roadmap/workpacket records live nested
// under mvp_v1_parallel_roadmap.waves[] with no unambiguous "which wave"
// default, so create deliberately refuses those kinds rather than guessing.
// All field values are written as JSON strings (matching commandUpdate's own
// --field contract) -- richer array-valued fields (e.g. an incident's
// timeline/lessons) still require editing by hand.
func commandCreate(path, kind, identity string, fields []fieldEdit) error {
	return commandCreateRecord(path, kind, identity, fields, false)
}

func commandCreateRecord(path, kind, identity string, fields []fieldEdit, allowChange bool) error {
	definition, err := definitionFor(kind)
	if err != nil {
		return err
	}
	if definition.topLevel == "" {
		return fmt.Errorf("create does not support kind %q: it is structurally nested, not a flat top-level array -- add it by hand", kind)
	}
	if definition.name == "change" && !allowChange {
		return fmt.Errorf("change records are immutable audit entries; use kbctl change create")
	}
	if identity == "" {
		return fmt.Errorf("create requires a non-empty <id>")
	}
	fields = collapseEdits(fields)
	for _, edit := range fields {
		if edit.name == definition.identity {
			return fmt.Errorf("do not pass --field %s=...; the identity is the positional <id> argument", definition.identity)
		}
	}

	data, err := readKB(path)
	if err != nil {
		return err
	}
	// Seed the container before anything reads it: a kind added after this store
	// was written has no array yet, and every read below would fail on that.
	data, err = ensureContainer(data, definition)
	if err != nil {
		return err
	}

	if _, err := findRecord(data, definition, identity); err == nil {
		return fmt.Errorf("%s %q already exists; use update, not create", definition.name, identity)
	} else if !strings.HasPrefix(err.Error(), "not_found:") {
		return err
	}

	merged := make(map[string]any, len(fields)+1)
	merged[definition.identity] = identity
	for _, edit := range fields {
		merged[edit.name] = edit.value
	}
	if err := validateRecord(definition, merged); err != nil {
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
	elements, err := parseArrayElements(data, container.valueSpan)
	if err != nil {
		return err
	}
	// An empty array carries no record to copy indentation from, so derive it
	// from the container key: it sits one level below the root, which makes its
	// own indent one indentation unit.
	if len(elements) == 0 {
		containerIndent := memberIndent(data, container.keySpan.start)
		unit := containerIndent
		if len(unit) == 0 {
			unit = []byte("  ")
		}
		elemIndent := append(append([]byte(nil), containerIndent...), unit...)
		fieldIndent := append(append([]byte(nil), elemIndent...), unit...)
		object, err := buildRecordObject(definition, identity, fields, elemIndent, fieldIndent)
		if err != nil {
			return err
		}

		var seeded bytes.Buffer
		seeded.WriteString("[\n")
		seeded.Write(elemIndent)
		seeded.Write(object)
		seeded.WriteString("\n")
		seeded.Write(containerIndent)
		seeded.WriteString("]")

		updated, err := applyReplacements(data, []replacement{{
			start: container.valueSpan.start,
			end:   container.valueSpan.end,
			value: seeded.Bytes(),
		}})
		if err != nil {
			return err
		}
		updated, err = regenerateIndex(updated)
		if err != nil {
			return err
		}
		return atomicWrite(path, updated, nil)
	}

	firstMembers, err := parseObjectMembers(data, elements[0])
	if err != nil {
		return err
	}
	if len(firstMembers) == 0 {
		return fmt.Errorf("cannot infer field indentation from an empty %s record", definition.name)
	}

	elemIndent := memberIndent(data, elements[0].start)
	fieldIndent := memberIndent(data, firstMembers[0].keySpan.start)
	object, err := buildRecordObject(definition, identity, fields, elemIndent, fieldIndent)
	if err != nil {
		return err
	}

	var addition bytes.Buffer
	addition.WriteString(",\n")
	addition.Write(elemIndent)
	addition.Write(object)

	last := elements[len(elements)-1]
	updated, err := applyReplacements(data, []replacement{{start: last.end, end: last.end, value: addition.Bytes()}})
	if err != nil {
		return err
	}
	updated, err = regenerateIndex(updated)
	if err != nil {
		return err
	}
	return atomicWrite(path, updated, nil)
}

func commandCreateWave(path, id, goal, parallelism string) error {
	if id == "" {
		return fmt.Errorf("wave create requires a non-empty <wave>")
	}
	if goal == "" || parallelism == "" {
		return fmt.Errorf("wave create requires non-empty --goal and --parallelism")
	}
	data, err := readKB(path)
	if err != nil {
		return err
	}
	if _, err := findRecord(data, waveDefinition, id); err == nil {
		return fmt.Errorf("wave %q already exists; use set, not create", id)
	} else if !strings.HasPrefix(err.Error(), "not_found:") {
		return err
	}

	root, err := rootSpan(data)
	if err != nil {
		return err
	}
	roadmap, err := memberByKey(data, root, "mvp_v1_parallel_roadmap")
	if err != nil {
		return err
	}
	wavesMember, err := memberByKey(data, roadmap.valueSpan, "waves")
	if err != nil {
		return err
	}
	elements, err := parseArrayElements(data, wavesMember.valueSpan)
	if err != nil {
		return err
	}
	if len(elements) == 0 {
		return fmt.Errorf("cannot create the first wave automatically; add one by hand, then create can append further waves")
	}
	firstMembers, err := parseObjectMembers(data, elements[0])
	if err != nil {
		return err
	}
	if len(firstMembers) == 0 {
		return fmt.Errorf("cannot infer field indentation from an empty wave record")
	}

	elemIndent := memberIndent(data, elements[0].start)
	fieldIndent := memberIndent(data, firstMembers[0].keySpan.start)

	object, err := buildWaveObject(id, goal, parallelism, elemIndent, fieldIndent)
	if err != nil {
		return err
	}

	var addition bytes.Buffer
	addition.WriteString(",\n")
	addition.Write(elemIndent)
	addition.Write(object)

	last := elements[len(elements)-1]
	updated, err := applyReplacements(data, []replacement{{start: last.end, end: last.end, value: addition.Bytes()}})
	if err != nil {
		return err
	}
	updated, err = regenerateIndex(updated)
	if err != nil {
		return err
	}
	return atomicWrite(path, updated, nil)
}

func buildWaveObject(id, goal, parallelism string, elemIndent, fieldIndent []byte) ([]byte, error) {
	fields := []struct {
		key   string
		value string
	}{
		{"wave", id},
		{"parallelism", parallelism},
		{"goal", goal},
	}
	var buffer bytes.Buffer
	buffer.WriteString("{\n")
	for i, field := range fields {
		key, err := encodeString(field.key)
		if err != nil {
			return nil, err
		}
		value, err := encodeString(field.value)
		if err != nil {
			return nil, err
		}
		if i > 0 {
			buffer.WriteString(",\n")
		}
		buffer.Write(fieldIndent)
		buffer.Write(key)
		buffer.WriteString(": ")
		buffer.Write(value)
	}
	buffer.WriteString(",\n")
	buffer.Write(fieldIndent)
	buffer.WriteString(`"work_packets": []`)
	buffer.WriteString("\n")
	buffer.Write(elemIndent)
	buffer.WriteString("}")
	return buffer.Bytes(), nil
}

type workpacketCreateFields struct {
	dependsOn          []string
	exclusiveFileLease []string
	delivers           string
	doneWhen           string
	status             string
}

func commandCreateWorkpacket(path, waveID, identity string, fields workpacketCreateFields) error {
	if waveID == "" {
		return fmt.Errorf("workpacket create requires a non-empty <wave>")
	}
	if identity == "" {
		return fmt.Errorf("workpacket create requires a non-empty <id>")
	}
	if _, ok := allowedWorkPacketStatuses[fields.status]; !ok {
		return fmt.Errorf("invalid workpacket status %q", fields.status)
	}
	if fields.delivers == "" {
		return fmt.Errorf("workpacket required narrative field %q must be a non-empty string", "delivers")
	}
	if fields.doneWhen == "" {
		return fmt.Errorf("workpacket required narrative field %q must be a non-empty string", "done_when")
	}

	data, err := readKB(path)
	if err != nil {
		return err
	}
	workPackets, err := workpacketArrayForWave(data, waveID)
	if err != nil {
		return err
	}
	definition, _ := definitionFor("workpacket")
	items, err := recordsFor(data, definition)
	if err != nil {
		return err
	}
	known := make(map[string]struct{}, len(items))
	for _, item := range items {
		id, ok := item.value[definition.identity].(string)
		if !ok || id == "" {
			return fmt.Errorf("workpacket record missing string identity %q", definition.identity)
		}
		if id == identity {
			return fmt.Errorf("workpacket %q already exists; use workpacket set, not create", identity)
		}
		known[id] = struct{}{}
	}
	for _, dependency := range fields.dependsOn {
		if dependency == identity {
			return fmt.Errorf("workpacket %q cannot depend on itself", identity)
		}
		if _, exists := known[dependency]; !exists {
			return fmt.Errorf("invalid dependency %q: workpacket does not exist", dependency)
		}
	}

	elements, err := parseArrayElements(data, workPackets.valueSpan)
	if err != nil {
		return err
	}
	packetIndent, fieldIndent, err := workpacketIndentation(data, workPackets, elements)
	if err != nil {
		return err
	}
	object, err := buildWorkpacketObject(identity, fields, packetIndent, fieldIndent)
	if err != nil {
		return err
	}

	var insertionPoint int
	var addition bytes.Buffer
	if len(elements) == 0 {
		insertionPoint = workPackets.valueSpan.start + 1
		addition.WriteByte('\n')
		addition.Write(packetIndent)
		addition.Write(object)
		addition.WriteByte('\n')
		addition.Write(memberIndent(data, workPackets.keySpan.start))
	} else {
		insertionPoint = elements[len(elements)-1].end
		addition.WriteString(",\n")
		addition.Write(packetIndent)
		addition.Write(object)
	}
	updated, err := applyReplacements(data, []replacement{{start: insertionPoint, end: insertionPoint, value: addition.Bytes()}})
	if err != nil {
		return err
	}
	updated, err = regenerateIndex(updated)
	if err != nil {
		return err
	}
	return atomicWrite(path, updated, nil)
}

func commandRewireWorkpacket(path, identity string, dependsOn []string) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	definition, _ := definitionFor("workpacket")
	items, err := recordsFor(data, definition)
	if err != nil {
		return err
	}
	known := make(map[string]struct{}, len(items))
	for _, candidate := range items {
		id, ok := candidate.value["id"].(string)
		if !ok || id == "" {
			return fmt.Errorf("workpacket record missing string identity %q", "id")
		}
		known[id] = struct{}{}
	}
	for _, dependency := range dependsOn {
		if dependency == identity {
			return fmt.Errorf("workpacket %q cannot depend on itself", identity)
		}
		if _, ok := known[dependency]; !ok {
			return fmt.Errorf("invalid dependency %q: workpacket does not exist", dependency)
		}
	}
	item, err := findRecord(data, definition, identity)
	if err != nil {
		return err
	}
	members, err := parseObjectMembers(data, item.span)
	if err != nil {
		return err
	}
	var dependencyMember *objectMember
	for index := range members {
		if members[index].key == "depends_on" {
			dependencyMember = &members[index]
			break
		}
	}
	if dependencyMember == nil {
		return fmt.Errorf("workpacket %q has no depends_on field", identity)
	}
	encoded, err := encodeCompactJSON(dependsOn)
	if err != nil {
		return err
	}
	updated, err := applyReplacements(data, []replacement{{start: dependencyMember.valueSpan.start, end: dependencyMember.valueSpan.end, value: encoded}})
	if err != nil {
		return err
	}
	updated, err = regenerateIndex(updated)
	if err != nil {
		return err
	}
	return atomicWrite(path, updated, nil)
}

func workpacketArrayForWave(data []byte, waveID string) (objectMember, error) {
	root, err := rootSpan(data)
	if err != nil {
		return objectMember{}, err
	}
	roadmap, err := memberByKey(data, root, "mvp_v1_parallel_roadmap")
	if err != nil {
		return objectMember{}, err
	}
	waves, err := memberByKey(data, roadmap.valueSpan, "waves")
	if err != nil {
		return objectMember{}, err
	}
	waveSpans, err := parseArrayElements(data, waves.valueSpan)
	if err != nil {
		return objectMember{}, err
	}
	for _, wave := range waveSpans {
		identity, err := memberByKey(data, wave, "wave")
		if err != nil {
			return objectMember{}, err
		}
		var value string
		if err := json.Unmarshal(data[identity.valueSpan.start:identity.valueSpan.end], &value); err != nil {
			return objectMember{}, fmt.Errorf("decode wave identity: %w", err)
		}
		if value == waveID {
			return memberByKey(data, wave, "work_packets")
		}
	}
	return objectMember{}, fmt.Errorf("not_found: wave %q", waveID)
}

func workpacketIndentation(data []byte, workPackets objectMember, elements []byteSpan) ([]byte, []byte, error) {
	if len(elements) == 0 {
		containerIndent := memberIndent(data, workPackets.keySpan.start)
		packetIndent := append(append([]byte(nil), containerIndent...), ' ', ' ')
		fieldIndent := append(append([]byte(nil), packetIndent...), ' ', ' ')
		return packetIndent, fieldIndent, nil
	}
	members, err := parseObjectMembers(data, elements[0])
	if err != nil {
		return nil, nil, err
	}
	if len(members) == 0 {
		return nil, nil, fmt.Errorf("cannot infer workpacket indentation from an empty record")
	}
	return memberIndent(data, elements[0].start), memberIndent(data, members[0].keySpan.start), nil
}

func buildWorkpacketObject(identity string, fields workpacketCreateFields, packetIndent, fieldIndent []byte) ([]byte, error) {
	values := []struct {
		name  string
		value any
	}{
		{name: "id", value: identity},
		{name: "depends_on", value: fields.dependsOn},
		{name: "exclusive_file_lease", value: fields.exclusiveFileLease},
		{name: "delivers", value: fields.delivers},
		{name: "done_when", value: fields.doneWhen},
		{name: "status", value: fields.status},
	}
	var buffer bytes.Buffer
	buffer.WriteString("{\n")
	for index, field := range values {
		if index != 0 {
			buffer.WriteString(",\n")
		}
		key, err := encodeString(field.name)
		if err != nil {
			return nil, err
		}
		value, err := encodeCompactJSON(field.value)
		if err != nil {
			return nil, err
		}
		buffer.Write(fieldIndent)
		buffer.Write(key)
		buffer.WriteString(": ")
		buffer.Write(value)
	}
	buffer.WriteByte('\n')
	buffer.Write(packetIndent)
	buffer.WriteByte('}')
	return buffer.Bytes(), nil
}

func encodeCompactJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}

func buildRecordObject(definition kindDefinition, identity string, fields []fieldEdit, elemIndent, fieldIndent []byte) ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteString("{\n")
	idKey, err := encodeString(definition.identity)
	if err != nil {
		return nil, err
	}
	idValue, err := encodeString(identity)
	if err != nil {
		return nil, err
	}
	buffer.Write(fieldIndent)
	buffer.Write(idKey)
	buffer.WriteString(": ")
	buffer.Write(idValue)
	for _, edit := range fields {
		key, err := encodeString(edit.name)
		if err != nil {
			return nil, err
		}
		value, err := encodeString(edit.value)
		if err != nil {
			return nil, err
		}
		buffer.WriteString(",\n")
		buffer.Write(fieldIndent)
		buffer.Write(key)
		buffer.WriteString(": ")
		buffer.Write(value)
	}
	buffer.WriteString("\n")
	buffer.Write(elemIndent)
	buffer.WriteString("}")
	return buffer.Bytes(), nil
}

func commandUpdate(path, kind, identity string, edits []fieldEdit) error {
	definition, err := definitionFor(kind)
	if err != nil {
		return err
	}
	if definition.name == "wave" {
		return fmt.Errorf("wave queries are read-only; update workpackets individually")
	}
	if definition.name == "change" {
		return fmt.Errorf("change records are immutable; create a new CHG-n record")
	}
	data, err := readKB(path)
	if err != nil {
		return err
	}
	item, err := findRecord(data, definition, identity)
	if err != nil {
		return err
	}
	edits = collapseEdits(edits)
	merged := make(map[string]any, len(item.value)+len(edits))
	for key, value := range item.value {
		merged[key] = value
	}
	for _, edit := range edits {
		merged[edit.name] = edit.value
	}
	if err := validateRecord(definition, merged); err != nil {
		return err
	}
	allUnchanged := true
	for _, edit := range edits {
		if current, ok := item.value[edit.name].(string); !ok || current != edit.value {
			allUnchanged = false
			break
		}
	}
	if allUnchanged {
		return nil
	}

	updated, err := patchObjectFields(data, item.span, edits)
	if err != nil {
		return err
	}
	updated, err = regenerateIndex(updated)
	if err != nil {
		return err
	}
	return atomicWrite(path, updated, nil)
}

func commandSetWave(path, identity string, edits []fieldEdit) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	item, err := findRecord(data, waveDefinition, identity)
	if err != nil {
		return err
	}
	merged := make(map[string]any, len(item.value)+len(edits))
	for key, value := range item.value {
		merged[key] = value
	}
	for _, edit := range edits {
		if edit.name != "goal" && edit.name != "parallelism" {
			return fmt.Errorf("wave set supports only goal and parallelism")
		}
		merged[edit.name] = edit.value
	}
	if err := validateRecord(waveDefinition, merged); err != nil {
		return err
	}
	updated, err := patchObjectFields(data, item.span, collapseEdits(edits))
	if err != nil {
		return err
	}
	updated, err = regenerateIndex(updated)
	if err != nil {
		return err
	}
	return atomicWrite(path, updated, nil)
}

func collapseEdits(edits []fieldEdit) []fieldEdit {
	positions := make(map[string]int, len(edits))
	result := make([]fieldEdit, 0, len(edits))
	for _, edit := range edits {
		if position, ok := positions[edit.name]; ok {
			result[position].value = edit.value
			continue
		}
		positions[edit.name] = len(result)
		result = append(result, edit)
	}
	return result
}

func validateRecord(definition kindDefinition, value map[string]any) error {
	for _, field := range definition.narrative {
		text, ok := value[field].(string)
		if !ok || text == "" {
			return fmt.Errorf("%s required narrative field %q must be a non-empty string", definition.name, field)
		}
	}
	if definition.name == "workpacket" {
		status, _ := value["status"].(string)
		if _, ok := allowedWorkPacketStatuses[status]; !ok {
			return fmt.Errorf("invalid workpacket status %q", status)
		}
		if raw, present := value["review_status"]; present {
			reviewStatus, ok := raw.(string)
			if !ok || reviewStatus == "" {
				return fmt.Errorf("workpacket review_status must be a non-empty string")
			}
			if _, ok := allowedReviewGateStatuses[reviewStatus]; !ok {
				return fmt.Errorf("invalid workpacket review_status %q", reviewStatus)
			}
		}
		if err := validateWorkpacketPlanningFields(value); err != nil {
			return err
		}
	}
	if definition.name == "lesson" {
		if err := validateLessonRecord(value); err != nil {
			return err
		}
	}
	if definition.name == "change" {
		if err := validateChangeRecord(value); err != nil {
			return err
		}
	}
	if isDDDKind(definition.name) {
		if err := validateDDDRecord(definition.name, value); err != nil {
			return err
		}
	}
	if definition.name == "roadmap" && value["status"] == "complete" {
		evidence, ok := value["evidence"].(string)
		if !ok || evidence == "" {
			return fmt.Errorf("roadmap status complete requires evidence")
		}
	}
	return nil
}

type replacement struct {
	start int
	end   int
	value []byte
}

func patchObjectFields(data []byte, object byteSpan, edits []fieldEdit) ([]byte, error) {
	members, err := parseObjectMembers(data, object)
	if err != nil {
		return nil, err
	}
	byName := make(map[string]objectMember, len(members))
	for _, member := range members {
		byName[member.key] = member
	}
	var replacements []replacement
	var missing []fieldEdit
	for _, edit := range edits {
		encoded, err := encodeString(edit.value)
		if err != nil {
			return nil, err
		}
		if member, ok := byName[edit.name]; ok {
			valueStart := skipWhitespace(data, member.valueSpan.start)
			if valueStart < member.valueSpan.end && (data[valueStart] == '[' || data[valueStart] == '{') {
				return nil, fmt.Errorf("--field cannot target array/object-valued field %q", edit.name)
			}
			replacements = append(replacements, replacement{start: member.valueSpan.start, end: member.valueSpan.end, value: encoded})
		} else {
			missing = append(missing, edit)
		}
	}
	if len(missing) > 0 {
		if len(members) == 0 {
			return nil, fmt.Errorf("cannot append fields to an empty compact object")
		}
		indent := memberIndent(data, members[0].keySpan.start)
		var addition bytes.Buffer
		for _, edit := range missing {
			addition.WriteString(",\n")
			addition.Write(indent)
			key, _ := encodeString(edit.name)
			value, _ := encodeString(edit.value)
			addition.Write(key)
			addition.WriteString(": ")
			addition.Write(value)
		}
		last := members[len(members)-1]
		replacements = append(replacements, replacement{start: last.valueSpan.end, end: last.valueSpan.end, value: addition.Bytes()})
	}
	return applyReplacements(data, replacements)
}

func memberIndent(data []byte, keyStart int) []byte {
	lineStart := bytes.LastIndexByte(data[:keyStart], '\n') + 1
	return append([]byte(nil), data[lineStart:keyStart]...)
}

func encodeString(value string) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}

func applyReplacements(data []byte, replacements []replacement) ([]byte, error) {
	sort.Slice(replacements, func(i, j int) bool {
		return replacements[i].start > replacements[j].start
	})
	result := append([]byte(nil), data...)
	lastStart := len(data) + 1
	for _, item := range replacements {
		if item.start < 0 || item.end < item.start || item.end > len(data) || item.end > lastStart {
			return nil, fmt.Errorf("overlapping or invalid byte replacement %d:%d", item.start, item.end)
		}
		result = append(result[:item.start], append(item.value, result[item.end:]...)...)
		lastStart = item.start
	}
	return result, nil
}

func buildIndex(data []byte) (kbIndex, error) {
	root, err := rootSpan(data)
	if err != nil {
		return kbIndex{}, err
	}
	members, err := parseObjectMembers(data, root)
	if err != nil {
		return kbIndex{}, err
	}
	index := kbIndex{}
	for _, member := range members {
		if member.key != "_index" {
			index.TopLevelKeys = append(index.TopLevelKeys, member.key)
		}
	}
	for _, definition := range kindDefinitions {
		items, err := recordsFor(data, definition)
		if err != nil {
			// A kind whose container has not been created yet indexes as empty.
			// Failing here instead would make every command in the tool refuse
			// to run against a store written before the kind existed.
			if isOptionalKind(definition.name) {
				continue
			}
			return kbIndex{}, err
		}
		identities := make([]string, 0, len(items))
		for _, item := range items {
			identity, ok := item.value[definition.identity].(string)
			if !ok {
				return kbIndex{}, fmt.Errorf("%s record missing string identity %q", definition.name, definition.identity)
			}
			identities = append(identities, identity)
		}
		switch definition.indexField {
		case "document_ids":
			index.DocumentIDs = identities
		case "decision_ids":
			index.DecisionIDs = identities
		case "design_change_ids":
			index.DesignChangeIDs = identities
		case "incident_ids":
			index.IncidentIDs = identities
		case "open_issue_ids":
			index.OpenIssueIDs = identities
		case "roadmap_stages":
			index.RoadmapStages = identities
		case "mvp_v1_work_packet_ids":
			index.MVPV1WorkPacketIDs = identities
		case "ddd_scenario_ids":
			index.DDDScenarioIDs = identities
		case "ddd_rule_ids":
			index.DDDRuleIDs = identities
		case "ddd_question_ids":
			index.DDDQuestionIDs = identities
		case "ddd_delta_ids":
			index.DDDDeltaIDs = identities
		case "ddd_term_ids":
			index.DDDTermIDs = identities
		case "ddd_metaphor_ids":
			index.DDDMetaphorIDs = identities
		case "ddd_mapping_ids":
			index.DDDMappingIDs = identities
		case "ddd_event_ids":
			index.DDDEventIDs = identities
		case "ddd_command_ids":
			index.DDDCommandIDs = identities
		case "ddd_aggregate_ids":
			index.DDDAggregateIDs = identities
		case "ddd_usecase_ids":
			index.DDDUsecaseIDs = identities
		case "lesson_ids":
			index.LessonIDs = identities
		}
	}
	return index, nil
}

func regenerateIndex(data []byte) ([]byte, error) {
	expected, err := buildIndex(data)
	if err != nil {
		return nil, err
	}
	root, _ := rootSpan(data)
	member, err := memberByKey(data, root, "_index")
	if err != nil {
		return nil, err
	}
	formatted, err := formatIndex(expected)
	if err != nil {
		return nil, err
	}
	return applyReplacements(data, []replacement{{start: member.valueSpan.start, end: member.valueSpan.end, value: formatted}})
}

func formatIndex(index kbIndex) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(index); err != nil {
		return nil, err
	}
	formatted := bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))
	return bytes.ReplaceAll(formatted, []byte("\n"), []byte("\n  ")), nil
}

func commandVerify(path string, output io.Writer) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	expected, err := buildIndex(data)
	if err != nil {
		return err
	}
	root, _ := rootSpan(data)
	member, err := memberByKey(data, root, "_index")
	if err != nil {
		return err
	}
	var actual kbIndex
	if err := json.Unmarshal(data[member.valueSpan.start:member.valueSpan.end], &actual); err != nil {
		return fmt.Errorf("decode _index: %w", err)
	}
	mismatches := compareIndexes(expected, actual)
	if len(mismatches) > 0 {
		return errors.New(strings.Join(mismatches, "; "))
	}
	if err := verifyWorkpacketPlanningContracts(data); err != nil {
		return err
	}
	// The index only proves the store lists what it holds. Reference integrity
	// between modelling records is a separate question and is reported rather
	// than returned as an error, so `verify` stays usable as a progress read
	// while the model is deliberately incomplete.
	findings, err := dddVerify(data)
	if err != nil {
		return err
	}
	changeFindings, err := changeVerify(data)
	if err != nil {
		return err
	}
	findings = append(findings, changeFindings...)
	for _, finding := range findings {
		if _, err := fmt.Fprintln(output, finding); err != nil {
			return err
		}
	}
	if len(findings) > 0 {
		return fmt.Errorf("%d verification finding(s)", len(findings))
	}
	_, err = fmt.Fprintln(output, "ok")
	return err
}

// ensureContainer adds an empty top-level array for a kind whose container does
// not exist yet. Without it the first record of a newly added kind could only be
// placed by editing the store by hand, which is the one thing this tool exists
// to make unnecessary.
func ensureContainer(data []byte, definition kindDefinition) ([]byte, error) {
	root, err := rootSpan(data)
	if err != nil {
		return nil, err
	}
	if _, err := memberByKey(data, root, definition.topLevel); err == nil {
		return data, nil
	}
	members, err := parseObjectMembers(data, root)
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, fmt.Errorf("cannot seed %q into an empty KB root", definition.topLevel)
	}
	last := members[len(members)-1]
	indent := memberIndent(data, members[0].keySpan.start)
	key, err := encodeString(definition.topLevel)
	if err != nil {
		return nil, err
	}
	var addition bytes.Buffer
	addition.WriteString(",\n")
	addition.Write(indent)
	addition.Write(key)
	addition.WriteString(": []")
	return applyReplacements(data, []replacement{{
		start: last.valueSpan.end, end: last.valueSpan.end, value: addition.Bytes(),
	}})
}

func compareIndexes(live, indexed kbIndex) []string {
	fields := []struct {
		name          string
		live, indexed []string
	}{
		{"top_level_keys", live.TopLevelKeys, indexed.TopLevelKeys},
		{"document_ids", live.DocumentIDs, indexed.DocumentIDs},
		{"decision_ids", live.DecisionIDs, indexed.DecisionIDs},
		{"design_change_ids", live.DesignChangeIDs, indexed.DesignChangeIDs},
		{"incident_ids", live.IncidentIDs, indexed.IncidentIDs},
		{"open_issue_ids", live.OpenIssueIDs, indexed.OpenIssueIDs},
		{"roadmap_stages", live.RoadmapStages, indexed.RoadmapStages},
		{"mvp_v1_work_packet_ids", live.MVPV1WorkPacketIDs, indexed.MVPV1WorkPacketIDs},
		{"ddd_scenario_ids", live.DDDScenarioIDs, indexed.DDDScenarioIDs},
		{"ddd_rule_ids", live.DDDRuleIDs, indexed.DDDRuleIDs},
		{"ddd_question_ids", live.DDDQuestionIDs, indexed.DDDQuestionIDs},
		{"ddd_delta_ids", live.DDDDeltaIDs, indexed.DDDDeltaIDs},
		{"ddd_term_ids", live.DDDTermIDs, indexed.DDDTermIDs},
		{"ddd_metaphor_ids", live.DDDMetaphorIDs, indexed.DDDMetaphorIDs},
		{"ddd_mapping_ids", live.DDDMappingIDs, indexed.DDDMappingIDs},
		{"ddd_event_ids", live.DDDEventIDs, indexed.DDDEventIDs},
		{"ddd_command_ids", live.DDDCommandIDs, indexed.DDDCommandIDs},
		{"ddd_aggregate_ids", live.DDDAggregateIDs, indexed.DDDAggregateIDs},
		{"ddd_usecase_ids", live.DDDUsecaseIDs, indexed.DDDUsecaseIDs},
		{"lesson_ids", live.LessonIDs, indexed.LessonIDs},
	}
	var mismatches []string
	for _, field := range fields {
		if equalStrings(field.live, field.indexed) {
			continue
		}
		liveOnly, indexOnly := sideDifferences(field.live, field.indexed)
		mismatches = append(mismatches, fmt.Sprintf("%s mismatch: live_only=%q index_only=%q", field.name, liveOnly, indexOnly))
	}
	return mismatches
}

func equalStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func sideDifferences(live, indexed []string) ([]string, []string) {
	liveCounts := make(map[string]int, len(live))
	indexCounts := make(map[string]int, len(indexed))
	for _, value := range live {
		liveCounts[value]++
	}
	for _, value := range indexed {
		indexCounts[value]++
	}
	var liveOnly, indexOnly []string
	for _, value := range live {
		if indexCounts[value] > 0 {
			indexCounts[value]--
		} else {
			liveOnly = append(liveOnly, value)
		}
	}
	for _, value := range indexed {
		if liveCounts[value] > 0 {
			liveCounts[value]--
		} else {
			indexOnly = append(indexOnly, value)
		}
	}
	return liveOnly, indexOnly
}

func atomicWrite(path string, data []byte, observe func(tempPath, finalPath string)) (returnErr error) {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("stat KB: %w", err)
	}
	directory := filepath.Dir(path)
	if !json.Valid(data) {
		return fmt.Errorf("refuse to write invalid JSON to %s", path)
	}
	temporary, err := os.CreateTemp(directory, "."+filepath.Base(path)+".tmp-*")
	if err != nil {
		return fmt.Errorf("create temporary KB: %w", err)
	}
	temporaryPath := temporary.Name()
	defer func() {
		if returnErr != nil {
			_ = os.Remove(temporaryPath)
		}
	}()
	if temporaryPath == path {
		_ = temporary.Close()
		return fmt.Errorf("temporary path must differ from final path")
	}
	if observe != nil {
		observe(temporaryPath, path)
	}
	if err := temporary.Chmod(info.Mode().Perm()); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("set temporary KB mode: %w", err)
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return fmt.Errorf("write temporary KB: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary KB: %w", err)
	}
	if err := os.Rename(temporaryPath, path); err != nil {
		return fmt.Errorf("rename temporary KB: %w", err)
	}
	return nil
}
