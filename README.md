<p align="center">
  <img src="icon.png" width="120" alt="Strætó logo" />
</p>

<h1 align="center">Strætó</h1>

<p align="center">
  A CLI for the Icelandic bus system <a href="https://www.straeto.is">Strætó</a>, built with <a href="https://bun.sh">Bun</a>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/straeto"><img src="https://img.shields.io/npm/v/straeto" alt="npm version" /></a>
  <a href="https://github.com/magtastic/straeto-cli/actions/workflows/ci.yml"><img src="https://github.com/magtastic/straeto-cli/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/straeto"><img src="https://img.shields.io/npm/dm/straeto" alt="npm downloads" /></a>
  <a href="https://github.com/magtastic/straeto-cli/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/straeto" alt="license" /></a>
</p>

---

## Install

```bash
bun install -g straeto
```

Or run directly without installing:

```bash
bunx straeto alerts
npx straeto route 3
```

## Commands

### `straeto route <number> [bus]`

Show all active buses on a route, or drill into a specific bus by letter.

```bash
straeto route 3        # overview of all buses on route 3
straeto route 3 A      # detail view for bus 3-A (next stops, ETA)
straeto route 3 --watch  # live-track with a spinner, polls every second
```

### `straeto stops`

List bus stops with optional filtering.

```bash
straeto stops                    # first 10 stops
straeto stops -r 6               # stops on route 6
straeto stops -s Hlemmur          # search by name
straeto stops --all               # show all stops
straeto stops -n 20              # show 20 results
```

### `straeto stop <name or id>`

Look up a specific stop by name or numeric ID.

```bash
straeto stop Hlemmur
straeto stop 10000802
```

### `straeto search [query]`

Search for a place by name. Launches interactive mode with autocomplete if no query is provided.

```bash
straeto search Höfðatorg            # search by name
straeto search                      # interactive with autocomplete
```

### `straeto alerts`

Show active service alerts.

```bash
straeto alerts            # alerts in Icelandic (default)
straeto alerts -l EN      # alerts in English
```

### `straeto next <stop>`

Show real-time upcoming arrivals at a stop.

```bash
straeto next Höfðatorg               # all upcoming arrivals
straeto next Höfðatorg -r 14         # only route 14
straeto next Höfðatorg -d Grandi     # filter by direction
straeto next Höfðatorg -r 14 -n 3   # limit to 3 results
```

### `straeto plan`

Plan a trip between two locations. Accepts place names or coordinates. Launches interactive mode by default with autocomplete search and time selection.

```bash
straeto plan                              # interactive mode
straeto plan -f Höfðatorg -t Mýrargata    # place names
straeto plan -f 64.14,-21.90 -t 64.10,-21.94   # coordinates
straeto plan --at 08:30                   # depart at specific time
straeto plan --by 17:00                   # arrive by specific time
```

## Claude Code Plugin

Use Strætó directly inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — ask about bus routes, stops, alerts, or plan trips in natural language.

```
/plugin marketplace add magtastic/straeto-cli
/plugin install straeto@straeto
```

Then type `/straeto` or just ask about buses in Reykjavík.

## Development

```bash
bun install
bun run start           # run the CLI
bun run lint            # check with biome
bun run lint:fix        # auto-fix lint issues
bun run format          # format source files
```

## License

MIT
