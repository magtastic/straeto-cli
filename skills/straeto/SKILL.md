---
name: straeto
description: Query the Icelandic bus system Strætó. Use when the user asks about buses in Iceland, Reykjavík bus routes, bus stops, service alerts, or trip planning in the Reykjavík capital area.
allowed-tools: Bash, Read
---

You have access to the `straeto` CLI for querying the Icelandic bus system Strætó in real time. Use `bunx straeto` (or `npx straeto`) to run commands.

## Available commands

### Real-time arrivals at a stop
```bash
bunx straeto next <stop>              # all upcoming arrivals
bunx straeto next <stop> -r <route>   # filter by route
bunx straeto next <stop> -d <direction>  # filter by direction/headsign
```

### Check buses on a route
```bash
bunx straeto route <number>        # overview of all active buses
bunx straeto route <number> <letter>  # detail for a specific bus (e.g. route 3 A)
```

### List and search stops
```bash
bunx straeto stops                  # list stops (first 10)
bunx straeto stops -s <name>        # search by name
bunx straeto stops -r <route>       # filter by route number
bunx straeto stops --all            # show all stops
```

### Look up a specific stop
```bash
bunx straeto stop <name or id>     # e.g. "Hlemmur" or "10000802"
```

### Service alerts
```bash
bunx straeto alerts                # alerts in Icelandic (default)
bunx straeto alerts -l EN          # alerts in English
```

### Plan a trip
```bash
bunx straeto plan -f <place> -t <place>        # place names or coordinates
bunx straeto plan -f <place> -t <place> --at 08:30  # depart at time
bunx straeto plan -f <place> -t <place> --by 17:00  # arrive by time
```

## Guidelines

- Always add `FORCE_COLOR=0` as an env variable when running commands so the output is readable.
- When the user asks "when is the next bus" or about arrivals at a stop, use `straeto next <stop>`.
- When the user asks about a bus route, start with `straeto route <number>` to show active buses.
- When the user asks "how do I get from X to Y", use `straeto plan -f <place> -t <place>`. Place names are supported directly.
- Present the CLI output to the user in a clean, readable format. Summarize key information rather than dumping raw output.
- Strætó operates in the Reykjavík capital area in Iceland. If the user asks about buses elsewhere, let them know this only covers Strætó.
- The correct Icelandic spelling is **Strætó** (with æ and ó).
