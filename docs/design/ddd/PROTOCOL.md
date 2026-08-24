# ClaimGate DDD Discovery Protocol

This protocol is the required modelling loop for ClaimGate design work. It deliberately treats a metaphor as a temporary hypothesis for discovering the domain model, not as the domain model itself.

```text
Reality Observation
  -> Domain Story
  -> Metaphor Selection
  -> Metaphor Mapping
  -> Metaphor Destruction
  -> Knowledge Gap
  -> Domain Question
  -> Ubiquitous Language
  -> Domain Event
  -> Bounded Context
  -> Invariant
  -> Aggregate
  -> Use Case
  -> Implementation Model
  -> Code
  -> Feedback -> Reality Observation
```

## Non-negotiable modelling rules

1. Never invent unknown domain rules.
2. Distinguish facts, assumptions, unknowns, and conflicts.
3. Unknown domain behaviour must be recorded as a Knowledge Gap.
4. Metaphors are discovery tools, not authoritative domain models.
5. When a metaphor conflicts with observed behaviour, prefer observed domain behaviour.
6. Production terminology must use Ubiquitous Language rather than metaphor terminology.
7. Aggregate boundaries must be justified by invariants and consistency requirements.
8. Persistence models must not dictate the Domain Model.
9. When implementation reveals ambiguity, create a Domain Question instead of silently making a business decision.

## Loop A — Learn

```text
Observation -> Story -> Metaphor -> Mismatch -> Question -> Knowledge
```

Goal: understand the domain without jumping to classes, repositories, controllers, or tables.

## Loop B — Model

```text
Knowledge -> Language -> Event -> Invariant -> Bounded Context -> Aggregate
```

Goal: compress domain knowledge into a model that can protect business rules.

## Loop C — Implement

```text
Aggregate -> Use Case -> Application -> Repository Port -> Adapter -> API/UI
```

Goal: make one thin vertical slice executable.

## Loop D — Verify

```text
Implementation -> New Question -> Knowledge Gap -> Domain Verification -> Model Update -> Refactoring
```

Goal: let code expose model mistakes, then feed them back into the knowledge base.

## Current canonical store

The canonical DDD records are in `governance/knowledge/claimgate-kb.json` and are queried/updated through `kbctl`:

```bash
./kbctl list scenario
./kbctl list rule
./kbctl list question
./kbctl list metaphor
./kbctl list delta
./kbctl list term
./kbctl list command
./kbctl list event
./kbctl list aggregate
./kbctl list usecase
./kbctl verify
./kbctl render all --out .
```

Generated Markdown views live under `docs/design/ddd/**`. Edit the KB records, not generated files.
