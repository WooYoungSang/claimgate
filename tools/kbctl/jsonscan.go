package main

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type byteSpan struct {
	start int
	end   int
}

type objectMember struct {
	key       string
	keySpan   byteSpan
	valueSpan byteSpan
}

func skipWhitespace(data []byte, offset int) int {
	for offset < len(data) {
		switch data[offset] {
		case ' ', '\t', '\r', '\n':
			offset++
		default:
			return offset
		}
	}
	return offset
}

func scanString(data []byte, start int) (int, error) {
	if start >= len(data) || data[start] != '"' {
		return 0, fmt.Errorf("expected JSON string at byte %d", start)
	}
	for i := start + 1; i < len(data); i++ {
		switch data[i] {
		case '\\':
			i++
		case '"':
			return i + 1, nil
		}
	}
	return 0, fmt.Errorf("unterminated JSON string at byte %d", start)
}

func scanValue(data []byte, start int) (int, error) {
	start = skipWhitespace(data, start)
	if start >= len(data) {
		return 0, fmt.Errorf("expected JSON value at end of input")
	}
	if data[start] == '"' {
		return scanString(data, start)
	}
	if data[start] != '{' && data[start] != '[' {
		i := start
		for i < len(data) && !bytes.ContainsRune([]byte(",]} \t\r\n"), rune(data[i])) {
			i++
		}
		if i == start {
			return 0, fmt.Errorf("invalid JSON value at byte %d", start)
		}
		return i, nil
	}

	stack := []byte{data[start]}
	for i := start + 1; i < len(data); i++ {
		switch data[i] {
		case '"':
			end, err := scanString(data, i)
			if err != nil {
				return 0, err
			}
			i = end - 1
		case '{', '[':
			stack = append(stack, data[i])
		case '}', ']':
			opening := stack[len(stack)-1]
			if (opening == '{' && data[i] != '}') || (opening == '[' && data[i] != ']') {
				return 0, fmt.Errorf("mismatched JSON delimiter at byte %d", i)
			}
			stack = stack[:len(stack)-1]
			if len(stack) == 0 {
				return i + 1, nil
			}
		}
	}
	return 0, fmt.Errorf("unterminated JSON value at byte %d", start)
}

func parseObjectMembers(data []byte, object byteSpan) ([]objectMember, error) {
	if object.start < 0 || object.end > len(data) || object.start >= object.end || data[object.start] != '{' {
		return nil, fmt.Errorf("invalid object span %d:%d", object.start, object.end)
	}
	i := skipWhitespace(data, object.start+1)
	var members []objectMember
	for i < object.end && data[i] != '}' {
		keyStart := i
		keyEnd, err := scanString(data, keyStart)
		if err != nil {
			return nil, err
		}
		var key string
		if err := json.Unmarshal(data[keyStart:keyEnd], &key); err != nil {
			return nil, fmt.Errorf("decode object key: %w", err)
		}
		i = skipWhitespace(data, keyEnd)
		if i >= object.end || data[i] != ':' {
			return nil, fmt.Errorf("expected colon after %q", key)
		}
		valueStart := skipWhitespace(data, i+1)
		valueEnd, err := scanValue(data, valueStart)
		if err != nil {
			return nil, fmt.Errorf("scan value for %q: %w", key, err)
		}
		members = append(members, objectMember{
			key:       key,
			keySpan:   byteSpan{start: keyStart, end: keyEnd},
			valueSpan: byteSpan{start: valueStart, end: valueEnd},
		})
		i = skipWhitespace(data, valueEnd)
		if i < object.end && data[i] == ',' {
			i = skipWhitespace(data, i+1)
			continue
		}
		if i >= object.end || data[i] != '}' {
			return nil, fmt.Errorf("expected comma or object end after %q", key)
		}
	}
	return members, nil
}

func parseArrayElements(data []byte, array byteSpan) ([]byteSpan, error) {
	if array.start < 0 || array.end > len(data) || array.start >= array.end || data[array.start] != '[' {
		return nil, fmt.Errorf("invalid array span %d:%d", array.start, array.end)
	}
	i := skipWhitespace(data, array.start+1)
	var elements []byteSpan
	for i < array.end && data[i] != ']' {
		end, err := scanValue(data, i)
		if err != nil {
			return nil, err
		}
		elements = append(elements, byteSpan{start: i, end: end})
		i = skipWhitespace(data, end)
		if i < array.end && data[i] == ',' {
			i = skipWhitespace(data, i+1)
			continue
		}
		if i >= array.end || data[i] != ']' {
			return nil, fmt.Errorf("expected comma or array end at byte %d", i)
		}
	}
	return elements, nil
}

func memberByKey(data []byte, object byteSpan, key string) (objectMember, error) {
	members, err := parseObjectMembers(data, object)
	if err != nil {
		return objectMember{}, err
	}
	for _, member := range members {
		if member.key == key {
			return member, nil
		}
	}
	return objectMember{}, fmt.Errorf("missing JSON member %q", key)
}
