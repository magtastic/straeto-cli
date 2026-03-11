import * as api from "../api";
import * as fmt from "../format";
import { writeLn } from "../terminal";

export async function searchCommand(parts: string[], interactive: boolean) {
	if (interactive || parts.length === 0) {
		const { promptLocation } = await import("../prompt");
		writeLn("");
		const result = await promptLocation("Search", api.geocode);
		writeLn(`\n  ${result.name}  ${result.lat}, ${result.lon}`);
		return;
	}

	const query = parts.join(" ");
	const results = await api.geocode(query);
	const limit = 10;
	writeLn(fmt.formatGeocode(results.slice(0, limit)));
	if (results.length > limit) {
		const chalk = (await import("chalk")).default;
		writeLn(chalk.dim(`\n  … and ${results.length - limit} more`));
	}
}
