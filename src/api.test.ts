import { describe, expect, test } from "bun:test";
import * as api from "./api";

describe("getBusLocations", () => {
	test("returns valid bus locations for a known route", async () => {
		const data = await api.getBusLocations(["1"]);

		expect(data.lastUpdate).toBeString();
		expect(Array.isArray(data.results)).toBe(true);

		for (const bus of data.results) {
			expect(bus.busId).toBeString();
			expect(bus.routeNr).toBe("1");
			expect(bus.headsign).toBeString();
			expect(bus.lat).toBeNumber();
			expect(bus.lng).toBeNumber();
			expect(bus.direction).toBeNumber();
			expect(Array.isArray(bus.nextStops)).toBe(true);

			for (const nextStop of bus.nextStops) {
				expect(nextStop.arrival).toBeString();
				expect(nextStop.waitingTime).toBeNumber();
				if (nextStop.stop !== null) {
					expect(nextStop.stop.name).toBeString();
				}
			}
		}
	});

	test("returns empty results for nonexistent route", async () => {
		const data = await api.getBusLocations(["99999"]);

		expect(data.lastUpdate).toBeString();
		expect(data.results).toEqual([]);
	});
});

describe("getStops", () => {
	test("returns a list of stops with required fields", async () => {
		const stops = await api.getStops();

		expect(stops.length).toBeGreaterThan(100);

		const stop = stops[0];
		expect(stop).toBeDefined();
		if (!stop) return;

		expect(stop.id).toBeNumber();
		expect(stop.name).toBeString();
		expect(stop.lat).toBeNumber();
		expect(stop.lon).toBeNumber();
		expect(stop.type).toBeNumber();
		expect(stop.code === null || typeof stop.code === "string").toBe(true);
		expect(typeof stop.isTerminal).toBe("boolean");
		expect(Array.isArray(stop.routes)).toBe(true);
	});

	test("contains known stops", async () => {
		const stops = await api.getStops();
		const names = stops.map((stop) => stop.name);

		expect(names).toContain("Hamraborg");
		expect(names).toContain("Mjódd A");
	});
});

describe("getStop", () => {
	test("returns details for a known stop", async () => {
		const stops = await api.getStops();
		const hamraborg = stops.find((stop) => stop.name === "Hamraborg");
		expect(hamraborg).toBeDefined();
		if (!hamraborg) return;

		const stop = await api.getStop(String(hamraborg.id));
		expect(stop).not.toBeNull();
		if (!stop) return;

		expect(stop.name).toBe("Hamraborg");
		expect(stop.lat).toBeNumber();
		expect(stop.lon).toBeNumber();
		expect(Array.isArray(stop.routes)).toBe(true);
		expect(Array.isArray(stop.routes)).toBe(true);
	});

	test("returns null for nonexistent stop", async () => {
		const stop = await api.getStop("0");
		expect(stop).toBeNull();
	});
});

describe("getAlerts", () => {
	test("returns alerts in Icelandic", async () => {
		const alerts = await api.getAlerts("IS");

		expect(Array.isArray(alerts)).toBe(true);

		for (const alert of alerts) {
			expect(alert.id).toBeString();
			expect(alert.cause).toBeString();
			expect(alert.effect).toBeString();
			expect(alert.title).toBeString();
			expect(alert.text).toBeString();
			expect(alert.dateStart).toBeString();
			expect(Array.isArray(alert.routes)).toBe(true);
		}
	});

	test("returns alerts in English", async () => {
		const alerts = await api.getAlerts("EN");
		expect(Array.isArray(alerts)).toBe(true);
	});
});

describe("geocode", () => {
	test("finds results for a known location", async () => {
		const results = await api.geocode("Hlemmur");

		expect(results.length).toBeGreaterThan(0);

		const first = results[0];
		expect(first).toBeDefined();
		if (!first) return;

		expect(first.id).toBeString();
		expect(first.name).toBeString();
		expect(first.lat).toBeNumber();
		expect(first.lon).toBeNumber();
		expect(first.address).toBeString();
		expect(first.type).toBeString();
		expect(first.subType).toBeString();
	});

	test("returns empty for gibberish query", async () => {
		const results = await api.geocode("xyzxyzxyz123456");
		expect(results).toEqual([]);
	});
});

describe("planTrip", () => {
	test("plans a trip between two known locations", async () => {
		// Hlemmur → Mjódd (common route)
		const trips = await api.planTrip({
			from: "64.1426,-21.9009",
			to: "64.1117,-21.8437",
			date: new Date().toISOString().slice(0, 10),
			time: "08:00",
			arrivalBy: false,
		});

		expect(trips.length).toBeGreaterThan(0);

		const trip = trips[0];
		expect(trip).toBeDefined();
		if (!trip) return;

		expect(trip.id).toBeString();
		expect(trip.duration.total).toBeNumber();
		expect(trip.duration.walk).toBeNumber();
		expect(trip.duration.bus).toBeNumber();
		expect(trip.time.from).toBeString();
		expect(trip.time.to).toBeString();
		expect(trip.legs.length).toBeGreaterThan(0);

		for (const leg of trip.legs) {
			expect(["WALK", "BUS"]).toContain(leg.type);
			expect(leg.duration).toBeNumber();
			expect(leg.distance).toBeNumber();
			expect(leg.time.from).toBeString();
			expect(leg.time.to).toBeString();
			expect(leg.from.lat).toBeNumber();
			expect(leg.from.lon).toBeNumber();
			expect(leg.to.lat).toBeNumber();
			expect(leg.to.lon).toBeNumber();

			if (leg.type === "BUS") {
				expect(leg.trip).toBeDefined();
				expect(leg.trip?.routeNr).toBeString();
				expect(leg.trip?.headsign).toBeString();
			}
		}
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
