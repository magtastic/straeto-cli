import chalk from "chalk";
import type { Alert, BusLocation, GeoResult, NextStop, Stop, TripItinerary } from "./api";

const routeColor = chalk.bold.yellow;
const stopColor = chalk.cyan;
const dimText = chalk.dim;
const heading = chalk.bold.underline;

export function currentDate(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function currentTime(): string {
	const now = new Date();
	return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.trim();
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString("is-IS", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatDuration(seconds: number): string {
	const mins = Math.round(seconds / 60);
	if (mins < 60) return `${mins} mín`;
	const hours = Math.floor(mins / 60);
	return `${hours}h ${mins % 60}m`;
}

function busLetter(busId: string): string {
	return busId.split("-").pop() ?? busId;
}

function nearestStopLabel(nextStops: NextStop[]): string {
	const valid = nextStops.filter((nextStop) => nextStop.stop != null);
	if (valid.length === 0) return dimText("—");
	const first = valid[0];
	if (!first) return dimText("—");
	const mins = first.waitingTime;
	const name = first.stop?.name ?? "?";
	if (mins <= 1) return `at ${stopColor(name)}`;
	return `near ${stopColor(name)} ${dimText(`(${mins} mín)`)}`;
}

export function formatBusOverview(route: string, buses: BusLocation[], lastUpdate: string): string {
	if (buses.length === 0) return dimText("No buses currently running on this route.");

	// Find the longest headsign for alignment
	const maxHeadsign = Math.max(...buses.map((bus) => bus.headsign.length));

	const lines = [
		`${routeColor(`Route ${route}`)} ${dimText(`— ${buses.length} bus${buses.length !== 1 ? "es" : ""}`)}${" ".repeat(Math.max(0, maxHeadsign + 20 - route.length))}${dimText(formatTime(lastUpdate))}`,
		"",
	];

	for (const bus of buses) {
		const letter = chalk.bold(busLetter(bus.busId));
		const headsign = bus.headsign.padEnd(maxHeadsign);
		const location = nearestStopLabel(bus.nextStops);
		lines.push(`  ${letter}  ${dimText("→")} ${stopColor(headsign)}  ${location}`);
	}

	return lines.join("\n");
}

export function formatBusDetail(bus: BusLocation, lastUpdate: string, lastStop?: string): string {
	const valid = bus.nextStops.filter((nextStop) => nextStop.stop != null);

	const lines = [
		`${routeColor(`Bus ${bus.busId}`)} ${dimText("→")} ${stopColor(bus.headsign)}${" ".repeat(20)}${dimText(formatTime(lastUpdate))}`,
		"",
	];

	if (lastStop) {
		lines.push(`  ${dimText("✓")} ${dimText(lastStop.padEnd(22))} ${dimText("passed")}`);
	}

	if (valid.length === 0) {
		lines.push(`  ${dimText("No upcoming stops")}`);
		return lines.join("\n");
	}

	for (let i = 0; i < valid.length; i++) {
		const nextStop = valid[i];
		if (!nextStop) continue;
		const stopName = (nextStop.stop?.name ?? "?").padEnd(22);
		const mins = nextStop.waitingTime;
		const time = mins <= 1 ? dimText("< 1 mín") : dimText(`~${mins} mín`);
		const isNext = i === 0;
		const marker = isNext ? chalk.cyan("▸") : dimText("○");
		const name = isNext ? chalk.bold.cyan(stopName) : stopColor(stopName);
		lines.push(`  ${marker} ${name} ${time}`);
	}

	return lines.join("\n");
}

export function formatStops(stops: Stop[]): string {
	const lines = [heading(`Bus stops`) + dimText(` (${stops.length} total)`), ""];

	for (const stop of stops) {
		const routes =
			stop.routes.length > 0
				? ` ${stop.routes.map((route) => routeColor(route)).join(dimText(", "))}`
				: "";
		const terminal = stop.isTerminal ? chalk.magenta(" ◉") : "";
		lines.push(`  ${stopColor(stop.name)}${terminal}${routes}  ${dimText(`#${stop.id}`)}`);
	}

	return lines.join("\n");
}

export function formatStop(stop: Stop & { streetView?: { iframeUrl: string } | null }): string {
	const lines = [
		heading(stop.name) + (stop.isTerminal ? chalk.magenta(" Terminal") : ""),
		"",
		`  ${dimText("ID:")}      ${stop.id}`,
		`  ${dimText("Coords:")}  ${stop.lat}, ${stop.lon}`,
		`  ${dimText("Routes:")}  ${stop.routes.length > 0 ? stop.routes.map((route) => routeColor(route)).join(", ") : "none"}`,
	];

	return lines.join("\n");
}

export function formatAlerts(alerts: Alert[]): string {
	if (alerts.length === 0) return dimText("No active alerts.");

	const lines = [heading(`Alerts`) + dimText(` (${alerts.length})`), ""];

	for (const alert of alerts) {
		const routes = alert.routes.map((route) => routeColor(route)).join(", ");
		lines.push(`  ${chalk.red("!")} ${chalk.bold(alert.title)}`);
		lines.push(
			`    ${dimText("Routes:")} ${routes}  ${dimText("Cause:")} ${alert.cause.toLowerCase().replace(/_/g, " ")}`,
		);
		lines.push(`    ${stripHtml(alert.text)}`);
		lines.push("");
	}

	return lines.join("\n");
}

export function formatGeocode(results: GeoResult[]): string {
	if (results.length === 0) return dimText("No results found.");

	const lines = [heading(`Search results`), ""];

	for (const result of results) {
		lines.push(`  ${chalk.bold(result.name)}`);
		lines.push(
			`    ${dimText(result.address)}  ${dimText(`(${result.type})`)}  ${dimText(`${result.lat}, ${result.lon}`)}`,
		);
	}

	return lines.join("\n");
}

export function formatTrips(trips: TripItinerary[]): string {
	if (trips.length === 0) return dimText("No trips found.");

	// Limit to best 5 options
	const shown = trips.slice(0, 5);
	const lines: string[] = [];

	for (let i = 0; i < shown.length; i++) {
		const trip = shown[i];
		if (!trip) continue;
		const start = formatTime(trip.time.from);
		const end = formatTime(trip.time.to);
		const dur = formatDuration(trip.duration.total);
		const busLegs = trip.legs.filter((leg) => leg.type === "BUS");
		const transfers = Math.max(0, busLegs.length - 1);

		// Header line: time range and duration
		const transferLabel =
			transfers === 0
				? chalk.green("Direct")
				: `${transfers} transfer${transfers !== 1 ? "s" : ""}`;

		lines.push(`  ${chalk.bold(start)} → ${chalk.bold(end)}  ${dimText(dur)}  ${transferLabel}`);

		// Journey visualization
		for (const leg of trip.legs) {
			const fromName = leg.from.stop?.name ?? "";
			const toName = leg.to.stop?.name ?? "";

			if (leg.type === "WALK") {
				const walkMins = formatDuration(leg.duration);
				if (toName) {
					lines.push(`  ${dimText("│")} ${dimText(`Walk ${walkMins} to ${toName}`)}`);
				} else if (walkMins !== "0 mín") {
					lines.push(`  ${dimText("│")} ${dimText(`Walk ${walkMins}`)}`);
				}
			} else {
				const routeNr = leg.trip?.routeNr ?? "?";
				const headsign = leg.trip?.headsign ?? toName;
				const depTime = formatTime(leg.time.from);
				const arrTime = formatTime(leg.time.to);
				const stopCount = leg.stops?.length ?? 0;
				const stopsLabel = stopCount > 0 ? dimText(` · ${stopCount} stops`) : "";

				lines.push(`  ${routeColor(routeNr)} ${stopColor(fromName)}  ${depTime}`);
				lines.push(`  ${dimText("│")} ${dimText(`→ ${headsign}`)}${stopsLabel}`);
				lines.push(`  ${routeColor(routeNr)} ${stopColor(toName)}  ${arrTime}`);
			}
		}

		if (i < shown.length - 1) lines.push("");
	}

	return lines.join("\n");
}
