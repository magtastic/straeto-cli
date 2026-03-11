import { z } from "zod/v4";

export const RouteOpts = z.object({
	watch: z.boolean().optional(),
	interval: z.string(),
});

export const StopsOpts = z.object({
	route: z.string().optional(),
	search: z.string().optional(),
	limit: z.string(),
	all: z.boolean().optional(),
});

export const AlertsOpts = z.object({
	lang: z.string(),
});

export const PlanOpts = z.object({
	from: z.string().optional(),
	to: z.string().optional(),
	interactive: z.boolean().optional(),
	date: z.string().optional(),
	at: z.string().optional(),
	by: z.string().optional(),
});
