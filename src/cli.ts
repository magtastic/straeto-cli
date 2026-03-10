#!/usr/bin/env bun
import chalk from "chalk";
import { program } from "commander";
import * as api from "./api";
import * as fmt from "./format";
import { ANSI, write, writeLn, writeErr } from "./terminal";

function handleError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  writeErr(`${chalk.red("Error:")} ${msg}`);
  process.exit(1);
}

program
  .name("bus")
  .description("Straetó — Icelandic bus system CLI")
  .version("0.1.0", "-v, --version");

program
  .command("route")
  .description("Show buses on a route, or detail a specific bus (e.g. route 3 A)")
  .argument("<route>", "Route number")
  .argument("[bus]", "Bus letter for detail view (e.g. A)")
  .option("-w, --watch", "Live-track with updates every second")
  .option("-i, --interval <ms>", "Poll interval in ms (with --watch)", "1000")
  .action(async (route: string, bus: string | undefined, opts) => {
    // Cache stops list for detail view (reused across watch polls)
    let allStops: api.Stop[] | null = null;
    const getStops = async () => {
      if (!allStops) allStops = await api.getStops();
      return allStops;
    };

    const render = async () => {
      const data = await api.getBusLocations([route]);
      if (bus) {
        const match = api.findBus(data.results, route, bus);
        if (!match) {
          if (opts.watch) return chalk.dim(`Bus ${route}-${bus.toUpperCase()} not currently active.`);
          handleError(`Bus ${route}-${bus.toUpperCase()} not found.`);
          return "";
        }
        const stops = await getStops();
        const lastStop = api.findLastStop(match, stops);
        return fmt.formatBusDetail(match, data.lastUpdate, lastStop);
      }
      return fmt.formatBusOverview(route, data.results, data.lastUpdate);
    };

    if (opts.watch) {
      const interval = parseInt(opts.interval);
      const label = bus ? `bus ${route}-${bus.toUpperCase()}` : `route ${route}`;
      const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let prevLineCount = 0;
      let tick = 0;
      let lastOutput = "";

      const drawFrame = async () => {
        const dot = chalk.cyan(spinner[tick++ % spinner.length]);
        const footer = `\n  ${dot} ${chalk.dim(`Live · ${label} · Ctrl+C to stop`)}`;
        const frame = lastOutput + footer;
        const lines = frame.split("\n");

        let buf = prevLineCount > 0 ? ANSI.moveToStart(prevLineCount) : "";
        for (const line of lines) buf += line + ANSI.clearLine + "\n";
        for (let i = lines.length; i < prevLineCount; i++) buf += ANSI.clearLine + "\n";
        await write(buf);
        prevLineCount = Math.max(lines.length, prevLineCount);
      };

      const fetchData = async () => {
        try {
          lastOutput = await render();
        } catch {
          // silently retry on transient errors
        }
      };

      await write(ANSI.hideCursor);
      process.on("SIGINT", async () => {
        await write(ANSI.showCursor);
        process.exit(0);
      });

      await fetchData();

      // Data polling in background
      (async () => {
        while (true) {
          await Bun.sleep(interval);
          await fetchData();
        }
      })();

      // Fast spinner render loop
      while (true) {
        await drawFrame();
        await Bun.sleep(80);
      }
    } else {
      try {
        writeLn(await render());
      } catch (e) { handleError(e); }
    }
  });

program
  .command("stops")
  .description("List all bus stops")
  .option("-r, --route <route>", "Filter by route number")
  .option("-s, --search <query>", "Search stops by name")
  .option("-n, --limit <n>", "Limit results", "10")
  .option("-a, --all", "Show all results")
  .action(async (opts) => {
    try {
      let stops = await api.getStops();

      if (opts.route) {
        stops = stops.filter((s) => s.routes.includes(opts.route));
      }

      if (opts.search) {
        const q = opts.search.toLowerCase();
        stops = stops.filter((s) => s.name.toLowerCase().includes(q));
      }

      const total = stops.length;
      if (!opts.all) {
        stops = stops.slice(0, parseInt(opts.limit));
      }

      writeLn(fmt.formatStops(stops));
      if (!opts.all && total > stops.length) {
        writeLn(chalk.dim(`\n  … and ${total - stops.length} more (use --all to show all)`));
      }
    } catch (e) { handleError(e); }
  });

program
  .command("stop")
  .description("Show details for a specific stop (by ID or name)")
  .argument("<query...>", "Stop ID or name")
  .action(async (parts: string[]) => {
    try {
      const input = parts.join(" ");
      const isId = /^\d+$/.test(input);

      if (isId) {
        const stop = await api.getStop(input);
        if (!stop) return handleError(`Stop "${input}" not found.`);
        writeLn(fmt.formatStop(stop));
      } else {
        const stops = await api.getStops();
        const q = input.toLowerCase();
        const matches = stops.filter((s) => s.name.toLowerCase() === q);
        if (matches.length === 0) {
          const fuzzy = stops.filter((s) => s.name.toLowerCase().includes(q));
          if (fuzzy.length === 0) return handleError(`No stops matching "${input}".`);
          writeLn(chalk.dim(`No exact match. Did you mean:\n`));
          writeLn(fmt.formatStops(fuzzy.slice(0, 10)));
          return;
        }
        if (matches.length === 1) {
          const stop = await api.getStop(String(matches[0].id));
          if (!stop) return handleError(`Stop "${input}" not found.`);
          writeLn(fmt.formatStop(stop));
        } else {
          writeLn(chalk.dim(`Multiple stops named "${input}":\n`));
          writeLn(fmt.formatStops(matches));
        }
      }
    } catch (e) { handleError(e); }
  });

program
  .command("alerts")
  .description("Show active service alerts")
  .option("-l, --lang <lang>", "Language (IS or EN)", "IS")
  .action(async (opts) => {
    try {
      const alerts = await api.getAlerts(opts.lang);
      writeLn(fmt.formatAlerts(alerts));
    } catch (e) { handleError(e); }
  });

program
  .command("plan")
  .description("Plan a trip between two locations")
  .option("-f, --from <coords>", "Origin as lat,lon")
  .option("-t, --to <coords>", "Destination as lat,lon")
  .option("-i, --interactive", "Interactive mode — search for places by name")
  .option("-d, --date <date>", "Date (YYYY-MM-DD, defaults to today)")
  .option("--at <time>", "Depart at time (HH:MM, defaults to now)")
  .option("--by <time>", "Arrive by time (HH:MM)")
  .action(async (opts) => {
    const date = opts.date ?? fmt.currentDate();
    let arrivalBy = !!opts.by;
    let time = opts.by ?? opts.at ?? fmt.currentTime();

    try {
      let from = opts.from;
      let to = opts.to;

      if (opts.interactive || (!from && !to)) {
        const { promptLocation, promptTimeMode } = await import("./prompt");
        writeLn("");
        const origin = await promptLocation("From", api.geocode);
        const dest = await promptLocation("To", api.geocode);
        from = `${origin.lat},${origin.lon}`;
        to = `${dest.lat},${dest.lon}`;

        // Only prompt for time if not already set via flags
        if (!opts.at && !opts.by) {
          const mode = await promptTimeMode();
          time = mode.time;
          arrivalBy = mode.arrivalBy;
        }

        writeLn("");
      }

      if (!from || !to) return handleError("Missing --from and --to (or use -i for interactive mode)");

      const trips = await api.planTrip({
        from,
        to,
        date,
        time,
        arrivalBy,
      });
      writeLn(fmt.formatTrips(trips));
    } catch (e) { handleError(e); }
  });

program.parse();
