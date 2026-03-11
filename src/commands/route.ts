import chalk from "chalk";
import type { z } from "zod/v4";
import * as api from "../api";
import * as fmt from "../format";
import { ANSI, write, writeLn } from "../terminal";
import type { RouteOpts } from "./schemas";

export async function routeCommand(
	route: string,
	busLetter: string | undefined,
	opts: z.infer<typeof RouteOpts>,
) {
	let allStops: api.Stop[] | null = null;
	const getStops = async () => {
		if (!allStops) allStops = await api.getStops();
		return allStops;
	};

	const render = async () => {
		const data = await api.getBusLocations([route]);
		if (busLetter) {
			const match = api.findBus(data.results, route, busLetter);
			if (!match) {
				if (opts.watch)
					return chalk.dim(`Bus ${route}-${busLetter.toUpperCase()} not currently active.`);
				throw new Error(`Bus ${route}-${busLetter.toUpperCase()} not found.`);
			}
			const stops = await getStops();
			const lastStop = api.findLastStop(match, stops);
			return fmt.formatBusDetail(match, data.lastUpdate, lastStop);
		}
		return fmt.formatBusOverview(route, data.results, data.lastUpdate);
	};

	if (opts.watch) {
		const interval = parseInt(opts.interval, 10);
		const label = busLetter ? `bus ${route}-${busLetter.toUpperCase()}` : `route ${route}`;
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
			for (const line of lines) buf += `${line + ANSI.clearLine}\n`;
			for (let idx = lines.length; idx < prevLineCount; idx++) buf += `${ANSI.clearLine}\n`;
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
		writeLn(await render());
	}
}
