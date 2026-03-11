import chalk from "chalk";
import * as api from "../api";
import * as fmt from "../format";
import { writeLn } from "../terminal";

export async function stopCommand(parts: string[]) {
	const input = parts.join(" ");
	const isId = /^\d+$/.test(input);

	if (isId) {
		const stop = await api.getStop(input);
		if (!stop) throw new Error(`Stop "${input}" not found.`);
		writeLn(fmt.formatStop(stop));
		return;
	}

	const stops = await api.getStops();
	const query = input.toLowerCase();
	const matches = stops.filter((stop) => stop.name.toLowerCase() === query);

	if (matches.length === 0) {
		const fuzzy = stops.filter((stop) => stop.name.toLowerCase().includes(query));
		if (fuzzy.length === 0) throw new Error(`No stops matching "${input}".`);
		writeLn(chalk.dim(`No exact match. Did you mean:\n`));
		writeLn(fmt.formatStops(fuzzy.slice(0, 10)));
		return;
	}

	if (matches.length === 1) {
		const stop = await api.getStop(String(matches[0]?.id));
		if (!stop) throw new Error(`Stop "${input}" not found.`);
		writeLn(fmt.formatStop(stop));
	} else {
		writeLn(chalk.dim(`Multiple stops named "${input}":\n`));
		writeLn(fmt.formatStops(matches));
	}
}
