package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"
)

var changeIDPattern = regexp.MustCompile(`^CHG-\d+$`)

var changeStatuses = map[string]struct{}{
	"proposed": {}, "accepted": {}, "applied": {}, "rolled_back": {},
}

type changeCreateInput struct {
	subject     string
	supersedes  string
	affected    []string
	reason      string
	migration   string
	rollout     string
	rollback    string
	evidence    string
	actor       string
	effectiveAt string
	status      string
}

type globalRecord struct {
	definition kindDefinition
	record     record
	snapshot   string
}

func compactSnapshot(data []byte, item record) (string, error) {
	var buffer bytes.Buffer
	if err := json.Compact(&buffer, data[item.span.start:item.span.end]); err != nil {
		return "", err
	}
	return buffer.String(), nil
}

func snapshotHash(snapshot string) string {
	digest := sha256.Sum256([]byte(snapshot))
	return hex.EncodeToString(digest[:])
}

func findGlobalRecord(data []byte, identity string) (globalRecord, error) {
	var matches []globalRecord
	for _, definition := range kindDefinitions {
		items, err := recordsFor(data, definition)
		if err != nil {
			if isOptionalKind(definition.name) {
				continue
			}
			return globalRecord{}, err
		}
		for _, item := range items {
			value, ok := item.value[definition.identity].(string)
			if !ok || value != identity {
				continue
			}
			snapshot, err := compactSnapshot(data, item)
			if err != nil {
				return globalRecord{}, err
			}
			matches = append(matches, globalRecord{definition: definition, record: item, snapshot: snapshot})
		}
	}
	if len(matches) == 0 {
		return globalRecord{}, fmt.Errorf("record %q does not exist", identity)
	}
	if len(matches) > 1 {
		kinds := make([]string, 0, len(matches))
		for _, match := range matches {
			kinds = append(kinds, match.definition.name)
		}
		return globalRecord{}, fmt.Errorf("record %q is ambiguous across kinds %s", identity, strings.Join(kinds, ","))
	}
	return matches[0], nil
}

func validateChangeRecord(value map[string]any) error {
	id := text(value, "id")
	if !changeIDPattern.MatchString(id) {
		return fmt.Errorf("change id %q must be CHG-<n>", id)
	}
	if _, ok := changeStatuses[text(value, "status")]; !ok {
		return fmt.Errorf("invalid change status %q (proposed|accepted|applied|rolled_back)", text(value, "status"))
	}
	for _, field := range []string{
		"subject_kind", "affected_records", "migration", "rollout", "rollback", "evidence",
		"recorded_at", "effective_at", "subject_snapshot", "after_hash",
	} {
		if text(value, field) == "" {
			return fmt.Errorf("change %s needs %s", id, field)
		}
	}
	for _, field := range []string{"recorded_at", "effective_at"} {
		if _, err := time.Parse(time.RFC3339Nano, text(value, field)); err != nil {
			return fmt.Errorf("change %s %s must be RFC3339: %w", id, field, err)
		}
	}
	if !json.Valid([]byte(text(value, "subject_snapshot"))) {
		return fmt.Errorf("change %s subject_snapshot is not JSON", id)
	}
	if err := validateSHA256(text(value, "after_hash")); err != nil {
		return fmt.Errorf("change %s after_hash: %w", id, err)
	}
	if text(value, "supersedes") != "" {
		if text(value, "superseded_snapshot") == "" || text(value, "before_hash") == "" {
			return fmt.Errorf("change %s with supersedes needs superseded_snapshot and before_hash", id)
		}
		if !json.Valid([]byte(text(value, "superseded_snapshot"))) {
			return fmt.Errorf("change %s superseded_snapshot is not JSON", id)
		}
		if err := validateSHA256(text(value, "before_hash")); err != nil {
			return fmt.Errorf("change %s before_hash: %w", id, err)
		}
	}
	if len(stringsOf(value, "affected_records")) == 0 {
		return fmt.Errorf("change %s affects no records", id)
	}
	return nil
}

func validateSHA256(value string) error {
	decoded, err := hex.DecodeString(value)
	if err != nil || len(decoded) != sha256.Size {
		return fmt.Errorf("must be a 64-character SHA-256 hex digest")
	}
	return nil
}

func commandCreateChange(path, id string, input changeCreateInput) error {
	if !changeIDPattern.MatchString(id) {
		return fmt.Errorf("change id %q must be CHG-<n>", id)
	}
	data, err := readKB(path)
	if err != nil {
		return err
	}
	subject, err := findGlobalRecord(data, input.subject)
	if err != nil {
		return err
	}
	if input.supersedes == input.subject && input.supersedes != "" {
		return fmt.Errorf("change subject and supersedes must differ")
	}

	affected := append([]string(nil), input.affected...)
	affected = appendUnique(affected, input.subject)
	if input.supersedes != "" {
		affected = appendUnique(affected, input.supersedes)
	}
	for _, ref := range affected {
		if _, err := findGlobalRecord(data, ref); err != nil {
			return err
		}
	}

	recordedAt := time.Now().UTC()
	effectiveAt := recordedAt
	if input.effectiveAt != "" {
		effectiveAt, err = time.Parse(time.RFC3339Nano, input.effectiveAt)
		if err != nil {
			return fmt.Errorf("--effective-at must be RFC3339: %w", err)
		}
	}
	fields := []fieldEdit{
		{name: "subject", value: input.subject},
		{name: "subject_kind", value: subject.definition.name},
		{name: "affected_records", value: strings.Join(affected, " ")},
		{name: "reason", value: input.reason},
		{name: "migration", value: input.migration},
		{name: "rollout", value: input.rollout},
		{name: "rollback", value: input.rollback},
		{name: "evidence", value: input.evidence},
		{name: "actor", value: input.actor},
		{name: "recorded_at", value: recordedAt.Format(time.RFC3339Nano)},
		{name: "effective_at", value: effectiveAt.UTC().Format(time.RFC3339Nano)},
		{name: "status", value: input.status},
		{name: "subject_snapshot", value: subject.snapshot},
		{name: "after_hash", value: snapshotHash(subject.snapshot)},
	}
	if input.supersedes != "" {
		prior, err := findGlobalRecord(data, input.supersedes)
		if err != nil {
			return err
		}
		fields = append(fields,
			fieldEdit{name: "supersedes", value: input.supersedes},
			fieldEdit{name: "supersedes_kind", value: prior.definition.name},
			fieldEdit{name: "superseded_snapshot", value: prior.snapshot},
			fieldEdit{name: "before_hash", value: snapshotHash(prior.snapshot)},
		)
	}
	return commandCreateRecord(path, "change", id, fields, true)
}

func appendUnique(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func changeRecords(data []byte) ([]record, error) {
	definition, _ := definitionFor("change")
	root, err := rootSpan(data)
	if err != nil {
		return nil, err
	}
	if _, err := memberByKey(data, root, definition.topLevel); err != nil {
		if strings.Contains(err.Error(), `missing JSON member "`+definition.topLevel+`"`) {
			return nil, nil
		}
		return nil, err
	}
	items, err := recordsFor(data, definition)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func commandChangeHistory(path, reference string, output io.Writer) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	items, err := changeRecords(data)
	if err != nil {
		return err
	}
	matched := make([]record, 0)
	for _, item := range items {
		if text(item.value, "subject") == reference || text(item.value, "supersedes") == reference || containsString(stringsOf(item.value, "affected_records"), reference) {
			matched = append(matched, item)
		}
	}
	if len(matched) == 0 {
		return fmt.Errorf("not_found: no change history for %q", reference)
	}
	return writeJSON(output, rawRecords(data, matched))
}

func containsString(values []string, want string) bool {
	for _, value := range values {
		if value == want {
			return true
		}
	}
	return false
}

type impactRecord struct {
	Reference string          `json:"reference"`
	Role      string          `json:"role"`
	Kind      string          `json:"kind"`
	Current   json.RawMessage `json:"current"`
}

func commandChangeImpact(path, id string, output io.Writer) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	definition, _ := definitionFor("change")
	item, err := findRecord(data, definition, id)
	if err != nil {
		return err
	}
	roles := map[string][]string{}
	roles[text(item.value, "subject")] = append(roles[text(item.value, "subject")], "subject")
	if prior := text(item.value, "supersedes"); prior != "" {
		roles[prior] = append(roles[prior], "supersedes")
	}
	for _, ref := range stringsOf(item.value, "affected_records") {
		roles[ref] = appendUnique(roles[ref], "affected")
	}
	refs := make([]string, 0, len(roles))
	for ref := range roles {
		refs = append(refs, ref)
	}
	sort.Strings(refs)
	result := make([]impactRecord, 0, len(refs))
	for _, ref := range refs {
		resolved, err := findGlobalRecord(data, ref)
		if err != nil {
			return err
		}
		result = append(result, impactRecord{
			Reference: ref,
			Role:      strings.Join(roles[ref], ","),
			Kind:      resolved.definition.name,
			Current:   json.RawMessage(resolved.snapshot),
		})
	}
	return writeJSON(output, result)
}

type changeFieldDiff struct {
	Field  string `json:"field"`
	Before any    `json:"before"`
	After  any    `json:"after"`
}

type changeDiffReport struct {
	From        string            `json:"from"`
	To          string            `json:"to"`
	FromSubject string            `json:"from_subject"`
	ToSubject   string            `json:"to_subject"`
	Changes     []changeFieldDiff `json:"changes"`
}

func commandChangeDiff(path, fromID, toID string, output io.Writer) error {
	data, err := readKB(path)
	if err != nil {
		return err
	}
	definition, _ := definitionFor("change")
	from, err := findRecord(data, definition, fromID)
	if err != nil {
		return err
	}
	to, err := findRecord(data, definition, toID)
	if err != nil {
		return err
	}
	fromSnapshot, err := snapshotObject(from.value, "subject_snapshot")
	if err != nil {
		return fmt.Errorf("change %s: %w", fromID, err)
	}
	toSnapshot, err := snapshotObject(to.value, "subject_snapshot")
	if err != nil {
		return fmt.Errorf("change %s: %w", toID, err)
	}
	keys := map[string]struct{}{}
	for key := range fromSnapshot {
		keys[key] = struct{}{}
	}
	for key := range toSnapshot {
		keys[key] = struct{}{}
	}
	sortedKeys := make([]string, 0, len(keys))
	for key := range keys {
		sortedKeys = append(sortedKeys, key)
	}
	sort.Strings(sortedKeys)
	changes := make([]changeFieldDiff, 0)
	for _, key := range sortedKeys {
		before, beforeOK := fromSnapshot[key]
		after, afterOK := toSnapshot[key]
		if beforeOK == afterOK && reflect.DeepEqual(before, after) {
			continue
		}
		changes = append(changes, changeFieldDiff{Field: key, Before: before, After: after})
	}
	return writeJSON(output, changeDiffReport{
		From:        fromID,
		To:          toID,
		FromSubject: text(from.value, "subject"),
		ToSubject:   text(to.value, "subject"),
		Changes:     changes,
	})
}

func snapshotObject(value map[string]any, field string) (map[string]any, error) {
	raw := text(value, field)
	var object map[string]any
	if err := json.Unmarshal([]byte(raw), &object); err != nil {
		return nil, fmt.Errorf("decode %s: %w", field, err)
	}
	return object, nil
}

func changeVerify(data []byte) ([]string, error) {
	items, err := changeRecords(data)
	if err != nil || len(items) == 0 {
		return nil, err
	}
	definition, _ := definitionFor("change")
	var findings []string
	latestBySubject := map[string]record{}
	for _, item := range items {
		id := text(item.value, "id")
		if err := validateRecord(definition, item.value); err != nil {
			findings = append(findings, fmt.Sprintf("change %s: %v", id, err))
			continue
		}
		if got := snapshotHash(text(item.value, "subject_snapshot")); got != text(item.value, "after_hash") {
			findings = append(findings, fmt.Sprintf("change %s: after_hash does not match subject_snapshot", id))
		}
		if text(item.value, "supersedes") != "" {
			if got := snapshotHash(text(item.value, "superseded_snapshot")); got != text(item.value, "before_hash") {
				findings = append(findings, fmt.Sprintf("change %s: before_hash does not match superseded_snapshot", id))
			}
		}
		for _, ref := range append([]string{text(item.value, "subject"), text(item.value, "supersedes")}, stringsOf(item.value, "affected_records")...) {
			if ref == "" {
				continue
			}
			if _, err := findGlobalRecord(data, ref); err != nil {
				findings = append(findings, fmt.Sprintf("change %s: %v", id, err))
			}
		}
		latestBySubject[text(item.value, "subject")] = item
	}
	for subject, item := range latestBySubject {
		current, err := findGlobalRecord(data, subject)
		if err != nil {
			continue
		}
		if snapshotHash(current.snapshot) != text(item.value, "after_hash") {
			findings = append(findings, fmt.Sprintf("change %s: untracked mutation of %s after recorded snapshot", text(item.value, "id"), subject))
		}
	}
	return findings, nil
}
