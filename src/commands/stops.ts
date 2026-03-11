import chalk from "chalk";
import type { z } from "zod/v4";
import * as api from "../api";
import * as fmt from "../format";
import { writeLn } from "../terminal";
import type { StopsOpts } from "./schemas";

export async function stopsCommand(opts: z.infer<typeof StopsOpts>) {
	let stops = await api.getStops();

	if (opts.route) {
		const routeFilter = opts.route;
		stops = stops.filter((stop) => stop.routes.includes(routeFilter));
	}

	if (opts.search) {
		const query = opts.search.toLowerCase();
		stops = stops.filter((stop) => stop.name.toLowerCase().includes(query));
	}

	const total = stops.length;
	if (!opts.all) {
		stops = stops.slice(0, parseInt(opts.limit, 10));
	}

	writeLn(fmt.formatStops(stops));
	if (!opts.all && total > stops.length) {
		writeLn(chalk.dim(`\n  … and ${total - stops.length} more (use --all to show all)`));
	}
}
