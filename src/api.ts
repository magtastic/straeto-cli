import { z } from "zod/v4";
import { currentDate } from "./format";

const API_URL = "https://api.straeto.is/graphql";

const HEADERS = {
	"Content-Type": "application/json",
	Origin: "https://www.straeto.is",
};

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

async function query<T>(
	gql: string,
	variables: Record<string, unknown> | undefined,
	schema: z.ZodType<T>,
): Promise<T> {
	const start = Date.now();

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		if (Date.now() - start > TIMEOUT_MS) break;

		if (attempt > 0) {
			const delay = 200 * 2 ** (attempt - 1);
			const remaining = TIMEOUT_MS - (Date.now() - start);
			if (remaining <= 0) break;
			await new Promise((r) => setTimeout(r, Math.min(delay, remaining)));
		}

		try {
			const res = await fetch(API_URL, {
				method: "POST",
				headers: HEADERS,
				body: JSON.stringify({ query: gql, variables }),
				signal: AbortSignal.timeout(TIMEOUT_MS - (Date.now() - start)),
			});

			if (!res.ok) throw new Error(`API error: ${res.status}`);

			const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
			if (json.errors && !json.data)
				throw new Error(json.errors.map((error) => error.message).join(", "));
			if (!json.data) throw new Error("No data returned from API");

			const result = schema.safeParse(json.data);
			if (!result.success) {
				const issues = result.error.issues
					.map((i) => `  ${i.path.join(".")}: ${i.message}`)
					.join("\n");
				const firstPath = result.error.issues[0]?.path ?? [];
				let sample: unknown = json.data;
				for (const key of firstPath) {
					if (sample != null && typeof sample === "object")
						sample = (sample as Record<string | number, unknown>)[key as string | number];
				}
				const raw = JSON.stringify(sample, null, 2);
				const preview = raw && raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
				throw new Error(
					`Schema validation failed:\n${issues}\n\nValue at "${firstPath.join(".")}":\n${preview}`,
				);
			}
			return result.data;
		} catch (err) {
			if (attempt === MAX_RETRIES - 1 || Date.now() - start > TIMEOUT_MS) throw err;
		}
	}

	throw new Error("Strætó is not responding — please try again in a moment.");
}

// --- Schemas ---

const NextStopSchema = z.object({
	arrival: z.string(),
	waitingTime: z.number(),
	stop: z.object({ name: z.string() }).nullable(),
});

const BusLocationSchema = z.object({
	busId: z.string(),
	tripId: z.string(),
	routeNr: z.string(),
	tag: z.string().nullable(),
	headsign: z.string(),
	lat: z.number(),
	lng: z.number(),
	direction: z.number(),
	nextStops: z.array(NextStopSchema),
});

const StopSchema = z.object({
	id: z.number(),
	name: z.string(),
	lat: z.number(),
	lon: z.number(),
	type: z.number(),
	code: z.string().nullable(),
	isTerminal: z.boolean(),
	routes: z.array(z.string()),
});

const AlertSchema = z.object({
	id: z.string(),
	cause: z.string(),
	effect: z.string(),
	routes: z.array(z.string()),
	title: z.string(),
	text: z.string(),
	dateStart: z.string(),
	dateEnd: z.string().nullable(),
});

const GeoResultSchema = z.object({
	id: z.string(),
	name: z.string(),
	lat: z.number(),
	lon: z.number(),
	address: z.string(),
	type: z.string(),
	subType: z.string(),
});

const TripStopSchema = z.object({
	id: z.union([z.string(), z.number()]),
	name: z.string(),
	lat: z.number(),
	lon: z.number(),
});

const TripLegSchema = z.object({
	type: z.string(),
	duration: z.number(),
	distance: z.number(),
	time: z.object({ from: z.string(), to: z.string() }),
	from: z.object({
		lat: z.number(),
		lon: z.number(),
		depature: z.string().nullable(),
		stop: TripStopSchema.nullable(),
	}),
	to: z.object({
		lat: z.number(),
		lon: z.number(),
		arrival: z.string().nullable(),
		stop: TripStopSchema.nullable(),
	}),
	trip: z.object({ routeNr: z.string(), headsign: z.string() }).optional(),
	stops: z.array(z.object({ id: z.union([z.string(), z.number()]), name: z.string() })).optional(),
});

const TripItinerarySchema = z.object({
	id: z.string(),
	duration: z.object({ walk: z.number(), bus: z.number(), total: z.number() }),
	time: z.object({ from: z.string(), to: z.string() }),
	legs: z.array(TripLegSchema),
});

// --- Exported types ---

export type NextStop = z.infer<typeof NextStopSchema>;
export type BusLocation = z.infer<typeof BusLocationSchema>;
export type Stop = z.infer<typeof StopSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type GeoResult = z.infer<typeof GeoResultSchema>;
export type TripStop = z.infer<typeof TripStopSchema>;
export type TripLeg = z.infer<typeof TripLegSchema>;
export type TripItinerary = z.infer<typeof TripItinerarySchema>;
export type StopDetail = z.infer<typeof StopDetailSchema>;

// --- Helpers ---

function distSq(lat1: number, lon1: number, lat2: number, lon2: number) {
	return (lat1 - lat2) ** 2 + (lon1 - lon2) ** 2;
}

export function findBus(buses: BusLocation[], route: string, letter: string) {
	const upper = letter.toUpperCase();
	return buses.find((bus) => {
		const busLetter = bus.busId.split("-").pop()?.toUpperCase();
		return bus.routeNr === route && busLetter === upper;
	});
}

export function findLastStop(bus: BusLocation, stops: Stop[]): string | undefined {
	const nextNames = new Set(
		bus.nextStops.filter((nextStop) => nextStop.stop).map((nextStop) => nextStop.stop?.name),
	);
	const routeStops = stops.filter(
		(stop) => stop.routes.includes(bus.routeNr) && !nextNames.has(stop.name),
	);
	const first = routeStops[0];
	if (!first) return undefined;
	// Find closest to bus position (note: BusLocation uses lng, Stop uses lon)
	let closest = first;
	let minDist = distSq(bus.lat, bus.lng, closest.lat, closest.lon);
	for (let i = 1; i < routeStops.length; i++) {
		const stop = routeStops[i];
		if (!stop) continue;
		const dist = distSq(bus.lat, bus.lng, stop.lat, stop.lon);
		if (dist < minDist) {
			minDist = dist;
			closest = stop;
		}
	}
	return closest.name;
}

// --- Response schemas ---

const BusLocationResponseSchema = z.object({
	BusLocationByRoute: z
		.object({
			lastUpdate: z.string(),
			results: z.array(BusLocationSchema),
		})
		.nullable(),
});

const StopsResponseSchema = z.object({
	GtfsStops: z.object({ results: z.array(StopSchema) }).nullable(),
});

const StopDetailSchema = StopSchema.extend({
	streetView: z.object({ iframeUrl: z.string() }).nullable(),
});

const StopResponseSchema = z.object({
	GtfsStop: StopDetailSchema.nullable(),
});

const AlertsResponseSchema = z.object({
	Alerts: z.object({ results: z.array(AlertSchema) }).nullable(),
});

const GeocodeResponseSchema = z.object({
	Geocode: z.object({ results: z.array(GeoResultSchema) }).nullable(),
});

const TripPlannerResponseSchema = z.object({
	TripPlanner: z.object({ results: z.array(TripItinerarySchema) }).nullable(),
});

// --- Queries ---

export async function getBusLocations(routes: string[]) {
	const data = await query(
		`query BusLocationByRoute($routes: [String!]!) {
      BusLocationByRoute(routes: $routes) {
        lastUpdate
        results {
          busId tripId routeNr tag headsign lat lng direction
          nextStops { arrival waitingTime stop { name } }
        }
      }
    }`,
		{ routes },
		BusLocationResponseSchema,
	);
	return data.BusLocationByRoute ?? { lastUpdate: "", results: [] };
}

export async function getStops() {
	const data = await query(
		`{ GtfsStops { results { id name lat lon type code isTerminal routes } } }`,
		undefined,
		StopsResponseSchema,
	);
	return data.GtfsStops?.results ?? [];
}

export async function getStop(id: string) {
	const today = currentDate();
	const data = await query(
		`query Stop($id: String!, $date: String) {
      GtfsStop(id: $id, date: $date) {
        id name lat lon type code isTerminal routes
        streetView { iframeUrl }
      }
    }`,
		{ id, date: today },
		StopResponseSchema,
	);
	return data.GtfsStop;
}

export async function getAlerts(language: string = "IS") {
	const data = await query(
		`query Alerts($language: AlertLanguage) {
      Alerts(language: $language) {
        results { id cause effect routes title text dateStart dateEnd }
      }
    }`,
		{ language },
		AlertsResponseSchema,
	);
	return data.Alerts?.results ?? [];
}

export async function geocode(placesQuery: string) {
	const data = await query(
		`query Geocode($placesQuery: String!) {
      Geocode(query: $placesQuery) {
        results { id name lat lon address type subType }
      }
    }`,
		{ placesQuery },
		GeocodeResponseSchema,
	);
	return data.Geocode?.results ?? [];
}

export async function planTrip(opts: {
	from: string;
	to: string;
	date: string;
	time: string;
	arrivalBy?: boolean;
}) {
	const data = await query(
		`query TripPlanner($time: String!, $date: String!, $from: String!, $to: String!, $arrivalBy: Boolean, $language: Language) {
      TripPlanner(time: $time, date: $date, from: $from, to: $to, arrivalBy: $arrivalBy, language: $language) {
        id
        results {
          id
          duration { walk bus total }
          time { from to }
          legs {
            type duration distance
            time { from to }
            stops { id name }
            from { lon lat depature stop { id name lat lon } }
            to { lon lat arrival stop { id name lat lon } }
            ... on TripPlannerLegBus {
              trip { routeNr headsign }
            }
          }
        }
      }
    }`,
		opts,
		TripPlannerResponseSchema,
	);
	return data.TripPlanner?.results ?? [];
}
