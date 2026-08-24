# ClaimGate FMON

```yaml
purpose: "btop-style Bubble Tea TUI for the ClaimGate knowledge and review-gate read model"
data_authority: "./kbctl JSON stdout"
direct_kb_read: false
architecture:
  - "CQRS read-model projection"
  - "Bubble Tea Model/Update/View"
  - "fail-closed adapter boundary"
dependencies:
  bubbletea: "v1.3.4 (Go 1.22 compatible)"
  bubbles: "v0.20.0"
  lipgloss: "v1.0.0"
```

## Run

```bash
./fmon
./fmon --refresh 10s
./fmon --once
```

## Visual layout

- Persistent four-tab navigation with a compact system header.
- btop-style dense panels, segmented lifecycle/review meters, scalar DDD bars, and health timing bars.
- Responsive two-column overview at wide sizes and one-column stacking on narrow terminals.
- Status glyphs and colors remain distinguishable when layout density increases.
- Automatic refresh atomically swaps completed snapshots, preserves scroll offset, and emits no
  terminal repaint when operational values are unchanged.

## Keys

| Key | Action |
|---|---|
| `Tab`, `←`, `→`, `h`, `l` | Switch panel |
| `j`, `k`, `PgUp`, `PgDn`, mouse wheel | Scroll |
| `r` | Refresh through `kbctl` |
| `q`, `Esc`, `Ctrl-C` | Quit |

## Data contract

Every operational record is obtained by executing `kbctl list <kind> --kb <path>` and decoding
its JSON stdout. The monitor never opens `claimgate-kb.json`. A command failure, non-array response,
`null`, or a work packet without an id produces a fail-closed error view; there is no direct-file
fallback.

The nested work-packet collection remains named `mvp_v1_parallel_roadmap` inside the KB for
historical reasons. FMON does not present it as an execution roadmap. It projects work packets only
as Human Review Gate records, and removes `WP-SELFTEST-*` arming fixtures from operational
counts.
