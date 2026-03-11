import type { z } from "zod/v4";
import * as api from "../api";
import * as fmt from "../format";
import { writeLn } from "../terminal";
import type { PlanOpts } from "./schemas";

export async function planCommand(opts: z.infer<typeof PlanOpts>) {
	const date = opts.date ?? fmt.currentDate();
	let arrivalBy = !!opts.by;
	let time = opts.by ?? opts.at ?? fmt.currentTime();

	let from = opts.from;
	let to = opts.to;

	// Geocode place names to coordinates
	const isCoords = (s: string) => /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(s);
	if (from && !isCoords(from)) {
		const results = await api.geocode(from);
		if (results.length === 0) throw new Error(`Could not find location "${from}"`);
		const loc = results[0];
		if (loc) from = `${loc.lat},${loc.lon}`;
	}
	if (to && !isCoords(to)) {
		const results = await api.geocode(to);
		if (results.length === 0) throw new Error(`Could not find location "${to}"`);
		const loc = results[0];
		if (loc) to = `${loc.lat},${loc.lon}`;
	}

	if (opts.interactive || (!from && !to)) {
		const { promptLocation, promptTimeMode } = await import("../prompt");
		writeLn("");
		const origin = await promptLocation("From", api.geocode);
		const dest = await promptLocation("To", api.geocode);
		from = `${origin.lat},${origin.lon}`;
		to = `${dest.lat},${dest.lon}`;

		if (!opts.at && !opts.by) {
			const mode = await promptTimeMode();
			time = mode.time;
			arrivalBy = mode.arrivalBy;
		}

		writeLn("");
	}

	if (!from || !to) throw new Error("Missing --from and --to (or use -i for interactive mode)");

	const trips = await api.planTrip({ from, to, date, time, arrivalBy });
	writeLn(fmt.formatTrips(trips));
}
