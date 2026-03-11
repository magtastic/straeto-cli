import { describe, expect, test } from "bun:test";
import * as api from "./api";

async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch {
			if (i === retries - 1) throw new Error(`Failed after ${retries} retries`);
			await Bun.sleep(100 * 2 ** i); // 100ms, 200ms, 400ms, 800ms, 1600ms
		}
	}
	throw new Error("unreachable");
}

describe("API schema validation", () => {
	test("getBusLocations parses against schema", async () => {
		const data = await withRetry(() => api.getBusLocations(["1"]));
		expect(data.lastUpdate).toBeString();
		expect(Array.isArray(data.results)).toBe(true);
	});

	test("getBusLocations returns empty for nonexistent route", async () => {
		const data = await withRetry(() => api.getBusLocations(["99999"]));
		expect(data.lastUpdate).toBeString();
		expect(data.results).toEqual([]);
	});

	test("getStops parses against schema", async () => {
		const stops = await withRetry(() => api.getStops());
		expect(stops.length).toBeGreaterThan(100);
	});

	test("getStop parses against schema", async () => {
		const stops = await withRetry(() => api.getStops());
		const hamraborg = stops.find((s) => s.name === "Hamraborg");
		expect(hamraborg).toBeDefined();

		const stop = await withRetry(() => api.getStop(String(hamraborg?.id)));
		expect(stop).not.toBeNull();
		expect(stop?.name).toBe("Hamraborg");
	});

	test("getStop returns null for nonexistent stop", async () => {
		const stop = await withRetry(() => api.getStop("0"));
		expect(stop).toBeNull();
	});

	test("getAlerts parses against schema", async () => {
		const alertsIS = await withRetry(() => api.getAlerts("IS"));
		expect(Array.isArray(alertsIS)).toBe(true);

		const alertsEN = await withRetry(() => api.getAlerts("EN"));
		expect(Array.isArray(alertsEN)).toBe(true);
	});

	test("geocode parses against schema", async () => {
		const results = await withRetry(() => api.geocode("Hlemmur"));
		expect(results.length).toBeGreaterThan(0);
	});

	test("geocode returns empty for gibberish", async () => {
		const results = await withRetry(() => api.geocode("xyzxyzxyz123456"));
		expect(results).toEqual([]);
	});

	test("planTrip parses against schema", async () => {
		const tomorrow = new Date(Date.now() + 86400000);
		const date = tomorrow.toISOString().slice(0, 10);
		const trips = await withRetry(() =>
			api.planTrip({
				from: "64.1426,-21.9009",
				to: "64.1117,-21.8437",
				date,
				time: "08:00",
				arrivalBy: false,
			}),
		);
		expect(trips.length).toBeGreaterThan(0);
	});
});

describe("findBus", () => {
	test("finds a bus by route and letter", () => {
		const buses: api.BusLocation[] = [
			{
				busId: "1-A",
				tripId: "t1",
				routeNr: "3",
				tag: null,
				headsign: "Grandi",
				lat: 64.0,
				lng: -21.0,
				direction: 0,
				nextStops: [],
			},
			{
				busId: "2-B",
				tripId: "t2",
				routeNr: "3",
				tag: null,
				headsign: "Sel/Fell",
				lat: 64.1,
				lng: -21.1,
				direction: 180,
				nextStops: [],
			},
		];

		const found = api.findBus(buses, "3", "b");
		expect(found).toBeDefined();
		expect(found?.busId).toBe("2-B");

		expect(api.findBus(buses, "3", "c")).toBeUndefined();
		expect(api.findBus(buses, "5", "a")).toBeUndefined();
	});
});

describe("findLastStop", () => {
	test("returns closest stop not in nextStops", () => {
		const bus: api.BusLocation = {
			busId: "1-A",
			tripId: "t1",
			routeNr: "3",
			tag: null,
			headsign: "Grandi",
			lat: 64.15,
			lng: -21.95,
			direction: 0,
			nextStops: [{ arrival: "", waitingTime: 2, stop: { name: "NextStop" } }],
		};

		const stops: api.Stop[] = [
			{
				id: 1,
				name: "NextStop",
				lat: 64.16,
				lon: -21.96,
				type: 1,
				code: null,
				isTerminal: false,
				routes: ["3"],
			},
			{
				id: 2,
				name: "PreviousStop",
				lat: 64.149,
				lon: -21.949,
				type: 1,
				code: null,
				isTerminal: false,
				routes: ["3"],
			},
			{
				id: 3,
				name: "FarStop",
				lat: 64.2,
				lon: -22.0,
				type: 1,
				code: null,
				isTerminal: false,
				routes: ["3"],
			},
		];

		expect(api.findLastStop(bus, stops)).toBe("PreviousStop");
	});

	test("returns undefined when no route stops exist", () => {
		const bus: api.BusLocation = {
			busId: "1-A",
			tripId: "t1",
			routeNr: "99",
			tag: null,
			headsign: "Nowhere",
			lat: 64.0,
			lng: -21.0,
			direction: 0,
			nextStops: [],
		};

		expect(api.findLastStop(bus, [])).toBeUndefined();
	});
});
