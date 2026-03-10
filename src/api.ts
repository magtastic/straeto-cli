import { currentDate } from "./format";

const API_URL = "https://api.straeto.is/graphql";

const HEADERS = {
  "Content-Type": "application/json",
  Origin: "https://www.straeto.is",
};

async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ query: gql, variables }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors && !json.data) throw new Error(json.errors.map((e) => e.message).join(", "));
  return json.data!;
}

// --- Types ---

export interface NextStop {
  arrival: string;
  waitingTime: number;
  stop: { name: string } | null;
}

export interface BusLocation {
  busId: string;
  tripId: string;
  routeNr: string;
  tag: string | null;
  headsign: string;
  lat: number;
  lng: number;
  direction: number;
  nextStops: NextStop[];
}

export interface Stop {
  id: number;
  name: string;
  lat: number;
  lon: number;
  type: string;
  code: string;
  isTerminal: boolean;
  routes: string[];
}

export interface Alert {
  id: string;
  cause: string;
  effect: string;
  routes: string[];
  title: string;
  text: string;
  dateStart: string;
  dateEnd: string | null;
}

export interface GeoResult {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  type: string;
  subType: string;
}

export interface TripStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TripLeg {
  type: string;
  duration: number;
  distance: number;
  time: { from: string; to: string };
  from: { lat: number; lon: number; depature: string; stop: TripStop | null };
  to: { lat: number; lon: number; arrival: string; stop: TripStop | null };
  trip?: { routeNr: string; headsign: string };
  stops?: { id: string; name: string }[];
}

export interface TripItinerary {
  id: string;
  duration: { walk: number; bus: number; total: number };
  time: { from: string; to: string };
  legs: TripLeg[];
}

// --- Helpers ---

function distSq(lat1: number, lon1: number, lat2: number, lon2: number) {
  return (lat1 - lat2) ** 2 + (lon1 - lon2) ** 2;
}

export function findBus(buses: BusLocation[], route: string, letter: string) {
  const upper = letter.toUpperCase();
  return buses.find((b) => {
    const l = b.busId.split("-").pop()?.toUpperCase();
    return b.routeNr === route && l === upper;
  });
}

export function findLastStop(bus: BusLocation, stops: Stop[]): string | undefined {
  const nextNames = new Set(
    bus.nextStops.filter((s) => s.stop).map((s) => s.stop!.name)
  );
  const routeStops = stops.filter(
    (s) => s.routes.includes(bus.routeNr) && !nextNames.has(s.name)
  );
  if (routeStops.length === 0) return undefined;
  // Find closest to bus position (note: BusLocation uses lng, Stop uses lon)
  let closest = routeStops[0];
  let minDist = distSq(bus.lat, bus.lng, closest.lat, closest.lon);
  for (let i = 1; i < routeStops.length; i++) {
    const d = distSq(bus.lat, bus.lng, routeStops[i].lat, routeStops[i].lon);
    if (d < minDist) { minDist = d; closest = routeStops[i]; }
  }
  return closest.name;
}

// --- Queries ---

export async function getBusLocations(routes: string[]) {
  const data = await query<{
    BusLocationByRoute: { lastUpdate: string; results: BusLocation[] };
  }>(
    `query BusLocationByRoute($routes: [String!]!) {
      BusLocationByRoute(routes: $routes) {
        lastUpdate
        results {
          busId tripId routeNr tag headsign lat lng direction
          nextStops { arrival waitingTime stop { name } }
        }
      }
    }`,
    { routes }
  );
  return data.BusLocationByRoute;
}

export async function getStops() {
  const data = await query<{ GtfsStops: { results: Stop[] } }>(
    `{ GtfsStops { results { id name lat lon type code isTerminal routes } } }`
  );
  return data.GtfsStops.results;
}

export async function getStop(id: string) {
  const today = currentDate();
  const data = await query<{
    GtfsStop: Stop & { streetView: { iframeUrl: string } | null } | null;
  }>(
    `query Stop($id: String!, $date: String) {
      GtfsStop(id: $id, date: $date) {
        id name lat lon type code isTerminal routes
        streetView { iframeUrl }
      }
    }`,
    { id, date: today }
  );
  return data.GtfsStop;
}

export async function getAlerts(language: string = "IS") {
  const data = await query<{ Alerts: { results: Alert[] } }>(
    `query Alerts($language: AlertLanguage) {
      Alerts(language: $language) {
        results { id cause effect routes title text dateStart dateEnd }
      }
    }`,
    { language }
  );
  return data.Alerts.results;
}

export async function geocode(placesQuery: string) {
  const data = await query<{ Geocode: { results: GeoResult[] } }>(
    `query Geocode($placesQuery: String!) {
      Geocode(query: $placesQuery) {
        results { id name lat lon address type subType }
      }
    }`,
    { placesQuery }
  );
  return data.Geocode.results;
}

export async function planTrip(opts: {
  from: string;
  to: string;
  date: string;
  time: string;
  arrivalBy?: boolean;
}) {
  const data = await query<{
    TripPlanner: { results: TripItinerary[] };
  }>(
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
    opts
  );
  return data.TripPlanner.results;
}
