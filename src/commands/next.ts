import chalk from "chalk";
import type { z } from "zod/v4";
import * as api from "../api";
import { writeLn } from "../terminal";
import type { NextOpts } from "./schemas";

interface Arrival {
	routeNr: string;
	headsign: string;
	busId: string;
	waitingTime: number;
	stopsAway: number;
}

export async function nextCommand(parts: string[], opts: z.infer<typeof NextOpts>) {
	const input = parts.join(" ");
	const stops = await api.getStops();
	const query = input.toLowerCase();

	// Find matching stops
	let matches = stops.filter((s) => s.name.toLowerCase() === query);
	if (matches.length === 0) {
		matches = stops.filter((s) => s.name.toLowerCase().includes(query));
	}
	if (matches.length === 0) throw new Error(`No stops matching "${input}".`);

	// Collect all route numbers serving matched stops
	const stopNames = new Set(matches.map((s) => s.name.toLowerCase()));
	const allRoutes = [...new Set(matches.flatMap((s) => s.routes))];

	// Filter by route if specified
	const routes = opts.route ? allRoutes.filter((r) => r === opts.route) : allRoutes;
	if (routes.length === 0) throw new Error(`Route ${opts.route} does not serve "${input}".`);

	// Fetch bus locations for all relevant routes
	const data = await api.getBusLocations(routes);

	// Find buses heading to this stop
	const arrivals: Arrival[] = [];
	for (const bus of data.results) {
		for (let i = 0; i < bus.nextStops.length; i++) {
			const nextStop = bus.nextStops[i];
			if (!nextStop?.stop) continue;
			if (!stopNames.has(nextStop.stop.name.toLowerCase())) continue;

			// Filter by direction/headsign if specified
			if (opts.direction) {
				const dir = opts.direction.toLowerCase();
				if (!bus.headsign.toLowerCase().includes(dir)) continue;
			}

			arrivals.push({
				routeNr: bus.routeNr,
				headsign: bus.headsign,
				busId: bus.busId,
				waitingTime: nextStop.waitingTime,
				stopsAway: i + 1,
			});
			break;
		}
	}

	// Sort by arrival time
	arrivals.sort((a, b) => a.waitingTime - b.waitingTime);

	const stopLabel = matches[0]?.name ?? input;

	if (arrivals.length === 0) {
		writeLn(chalk.dim(`No upcoming arrivals at ${stopLabel}.`));
		return;
	}

	const limit = opts.limit ? parseInt(opts.limit, 10) : 10;
	const shown = arrivals.slice(0, limit);

	writeLn(`${chalk.bold.underline(stopLabel)} ${chalk.dim(`— ${arrivals.length} upcoming`)}\n`);

	for (const a of shown) {
		const route = chalk.bold.yellow(a.routeNr.padEnd(4));
		const headsign = chalk.cyan(a.headsign.padEnd(20));
		const time =
			a.waitingTime <= 1 ? chalk.green.bold("< 1 mín") : chalk.green.bold(`${a.waitingTime} mín`);
		const stops = chalk.dim(`${a.stopsAway} stop${a.stopsAway !== 1 ? "s" : ""} away`);
		writeLn(`  ${route}${headsign}  ${time}  ${stops}`);
	}
}
