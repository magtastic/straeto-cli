import chalk from "chalk";
import type { GeoResult } from "./api";
import { currentTime } from "./format";
import { ANSI, write, clearLines, enableRaw, disableRaw, readKey } from "./terminal";

const MAX_SUGGESTIONS = 6;
const DEBOUNCE_MS = 200;
const MIN_QUERY_LEN = 2;

function dedupeResults(results: GeoResult[], limit: number): GeoResult[] {
  const seen = new Set<string>();
  const unique: GeoResult[] = [];
  for (const r of results) {
    const key = `${r.name}|${r.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
    if (unique.length >= limit) break;
  }
  return unique;
}

// --- Location prompt with autocomplete ---

function renderLocationFrame(
  label: string,
  input: string,
  suggestions: GeoResult[],
  selected: number
): string {
  let buf = `${ANSI.carriageReturn}${ANSI.clearLine}${chalk.bold(`${label}:`)} ${input}`;
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i];
    const addr = s.address ? chalk.dim(` — ${s.address}`) : "";
    const prefix = i === selected ? chalk.cyan("  ▸ ") : "    ";
    const name = i === selected ? chalk.cyan.bold(s.name) : s.name;
    buf += `\n${ANSI.clearLine}${prefix}${name}${addr}`;
  }
  return buf;
}

export async function promptLocation(
  label: string,
  geocode: (q: string) => Promise<GeoResult[]>
): Promise<{ lat: number; lon: number; name: string }> {
  enableRaw();

  let input = "";
  let suggestions: GeoResult[] = [];
  let selected = 0;
  let prevLines = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingQuery = "";

  const draw = async () => {
    await clearLines(prevLines);
    const frame = renderLocationFrame(label, input, suggestions, selected);
    await write(frame);
    if (suggestions.length > 0) await write(ANSI.moveUp(suggestions.length));
    const col = label.length + 2 + input.length;
    await write(`${ANSI.carriageReturn}${ANSI.moveToCol(col + 1)}`);
    prevLines = suggestions.length;
  };

  const scheduleSearch = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (input.length < MIN_QUERY_LEN) {
      suggestions = [];
      selected = 0;
      return;
    }
    pendingQuery = input;
    debounceTimer = setTimeout(async () => {
      const q = pendingQuery;
      try {
        const results = await geocode(q);
        if (pendingQuery === q) {
          suggestions = dedupeResults(results, MAX_SUGGESTIONS);
          selected = 0;
          await draw();
        }
      } catch {}
    }, DEBOUNCE_MS);
  };

  const finish = async (r: GeoResult) => {
    await clearLines(prevLines);
    await write(`${ANSI.carriageReturn}${ANSI.clearLine}${chalk.bold(`${label}:`)} ${chalk.cyan(r.name)}\n`);
    disableRaw();
    return { lat: r.lat, lon: r.lon, name: r.name };
  };

  await draw();

  while (true) {
    const key = await readKey();

    if (key[0] === 3) { await clearLines(prevLines); await write("\n"); disableRaw(); process.exit(0); }

    if (key[0] === 13) {
      if (suggestions.length > 0 && selected >= 0 && selected < suggestions.length) {
        return finish(suggestions[selected]);
      }
      if (input.length >= MIN_QUERY_LEN && suggestions.length === 0) {
        try {
          const results = await geocode(input);
          suggestions = dedupeResults(results, MAX_SUGGESTIONS);
          selected = 0;
          if (suggestions.length === 1) return finish(suggestions[0]);
          await draw();
        } catch {}
      }
      continue;
    }

    if (key[0] === 9) {
      if (suggestions.length > 0 && selected >= 0) {
        input = suggestions[selected].name;
        scheduleSearch();
        await draw();
      }
      continue;
    }

    if (key[0] === 127 || key[0] === 8) {
      if (input.length > 0) { input = input.slice(0, -1); scheduleSearch(); await draw(); }
      continue;
    }

    if (key[0] === 27 && key[1] === 91) {
      if (key[2] === 65 && suggestions.length > 0) { selected = (selected - 1 + suggestions.length) % suggestions.length; await draw(); }
      if (key[2] === 66 && suggestions.length > 0) { selected = (selected + 1) % suggestions.length; await draw(); }
      continue;
    }

    if (key[0] === 27 || key[0] < 32) continue;

    input += key.toString("utf-8");
    scheduleSearch();
    await draw();
  }
}

// --- Time mode prompt ---

export interface TimeMode {
  time: string;
  arrivalBy: boolean;
}

export async function promptTimeMode(): Promise<TimeMode> {
  enableRaw();

  const options = [
    { label: "Leave now", time: currentTime(), arrivalBy: false },
    { label: "Depart at…", needsInput: true, arrivalBy: false },
    { label: "Arrive by…", needsInput: true, arrivalBy: true },
  ];

  let selected = 0;

  const draw = async () => {
    let buf = `${ANSI.carriageReturn}${ANSI.clearLine}${chalk.bold("When:")}`;
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (i === selected) {
        buf += `  ${chalk.cyan.bold(opt.label)}`;
      } else {
        buf += `  ${chalk.dim(opt.label)}`;
      }
    }
    buf += chalk.dim("  ←/→ to pick, enter to confirm");
    await write(buf);
  };

  await draw();

  while (true) {
    const key = await readKey();

    if (key[0] === 3) { await write("\n"); disableRaw(); process.exit(0); }

    // Enter
    if (key[0] === 13) {
      const opt = options[selected];
      if (!opt.needsInput) {
        await write(`${ANSI.carriageReturn}${ANSI.clearLine}${chalk.bold("When:")} ${chalk.cyan(opt.label)}\n`);
        disableRaw();
        return { time: opt.time!, arrivalBy: opt.arrivalBy };
      }

      // Need time input
      await write(`${ANSI.carriageReturn}${ANSI.clearLine}${chalk.bold(opt.label.replace("…", ":"))} `);
      disableRaw();

      const timeInput = (prompt("") ?? "").trim();
      if (/^\d{1,2}:\d{2}$/.test(timeInput)) {
        return { time: timeInput, arrivalBy: opt.arrivalBy };
      }
      // Invalid, re-prompt
      enableRaw();
      await draw();
      continue;
    }

    // Left/Right arrows
    if (key[0] === 27 && key[1] === 91) {
      if (key[2] === 68) selected = (selected - 1 + options.length) % options.length; // Left
      if (key[2] === 67) selected = (selected + 1) % options.length; // Right
      await draw();
      continue;
    }

    // Tab cycles right
    if (key[0] === 9) {
      selected = (selected + 1) % options.length;
      await draw();
      continue;
    }
  }
}
