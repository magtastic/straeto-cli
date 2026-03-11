import type { z } from "zod/v4";
import * as api from "../api";
import * as fmt from "../format";
import { writeLn } from "../terminal";
import type { AlertsOpts } from "./schemas";

export async function alertsCommand(opts: z.infer<typeof AlertsOpts>) {
	const alerts = await api.getAlerts(opts.lang);
	writeLn(fmt.formatAlerts(alerts));
}
