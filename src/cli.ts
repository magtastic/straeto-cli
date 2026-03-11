#!/usr/bin/env bun
import chalk from "chalk";
import { program } from "commander";
import { alertsCommand } from "./commands/alerts";
import { planCommand } from "./commands/plan";
import { routeCommand } from "./commands/route";
import { AlertsOpts, PlanOpts, RouteOpts, StopsOpts } from "./commands/schemas";
import { stopCommand } from "./commands/stop";
import { stopsCommand } from "./commands/stops";
import { writeErr } from "./terminal";

function handleError(error: unknown) {
	const msg = error instanceof Error ? error.message : String(error);
	writeErr(`${chalk.red("Error:")} ${msg}`);
	process.exit(1);
}

program
	.name("straeto")
	.description("Strætó — Icelandic bus system CLI")
	.version("0.1.0", "-v, --version");

program
	.command("route")
	.description("Show buses on a route, or detail a specific bus (e.g. route 3 A)")
	.argument("<route>", "Route number")
	.argument("[bus]", "Bus letter for detail view (e.g. A)")
	.option("-w, --watch", "Live-track with updates every second")
	.option("-i, --interval <ms>", "Poll interval in ms (with --watch)", "1000")
	.action(async (route: string, busLetter: string | undefined, rawOpts) => {
		try {
			await routeCommand(route, busLetter, RouteOpts.parse(rawOpts));
		} catch (error) {
			handleError(error);
		}
	});

program
	.command("stops")
	.description("List all bus stops")
	.option("-r, --route <route>", "Filter by route number")
	.option("-s, --search <query>", "Search stops by name")
	.option("-n, --limit <n>", "Limit results", "10")
	.option("-a, --all", "Show all results")
	.action(async (rawOpts) => {
		try {
			await stopsCommand(StopsOpts.parse(rawOpts));
		} catch (error) {
			handleError(error);
		}
	});

program
	.command("stop")
	.description("Show details for a specific stop (by ID or name)")
	.argument("<query...>", "Stop ID or name")
	.action(async (parts: string[]) => {
		try {
			await stopCommand(parts);
		} catch (error) {
			handleError(error);
		}
	});

program
	.command("alerts")
	.description("Show active service alerts")
	.option("-l, --lang <lang>", "Language (IS or EN)", "IS")
	.action(async (rawOpts) => {
		try {
			await alertsCommand(AlertsOpts.parse(rawOpts));
		} catch (error) {
			handleError(error);
		}
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
	.action(async (rawOpts) => {
		try {
			await planCommand(PlanOpts.parse(rawOpts));
		} catch (error) {
			handleError(error);
		}
	});

program.parse();
