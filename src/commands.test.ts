import { describe, expect, test } from "bun:test";
import type { Alert, BusLocation, Stop, StopDetail, TripItinerary } from "./api";
import { findBus, findLastStop } from "./api";
import * as fmt from "./format";

// --- Mock data ---

const mockBuses: BusLocation[] = [
	{
		busId: "1-A",
		tripId: "t1",
		routeNr: "3",
		tag: null,
		headsign: "Hlemmur",
		lat: 64.14,
		lng: -21.92,
		direction: 90,
		nextStops: [{ arrival: "2026-01-01T10:05:00", waitingTime: 3, stop: { name: "Hamraborg" } }],
	},
	{
		busId: "2-B",
		tripId: "t2",
		routeNr: "3",
		tag: null,
		headsign: "Seltjarnarnes",
		lat: 64.15,
		lng: -21.95,
		direction: 270,
		nextStops: [{ arrival: "2026-01-01T10:10:00", waitingTime: 5, stop: { name: "Grandi" } }],
	},
];

const mockStops: Stop[] = [
	{
		id: 10001,
		name: "Hamraborg",
		lat: 64.11,
		lon: -21.88,
		type: 1,
		code: "HB",
		isTerminal: true,
		routes: ["1", "2", "3"],
	},
	{
		id: 10002,
		name: "Mjódd A",
		lat: 64.1,
		lon: -21.84,
		type: 1,
		code: null,
		isTerminal: true,
		routes: ["1", "3", "6"],
	},
	{
		id: 10003,
		name: "Hlemmur",
		lat: 64.14,
		lon: -21.9,
		type: 1,
		code: null,
		isTerminal: false,
		routes: ["1", "3", "6"],
	},
	{
		id: 10004,
		name: "Grandi",
		lat: 64.15,
		lon: -21.95,
		type: 1,
		code: null,
		isTerminal: false,
		routes: ["3"],
	},
];

const mockStopDetail: StopDetail = {
	id: 10001,
	name: "Hamraborg",
	lat: 64.11,
	lon: -21.88,
	type: 1,
	code: "HB",
	isTerminal: true,
	routes: ["1", "2", "3"],
	streetView: null,
};

const mockAlerts: Alert[] = [
	{
		id: "a1",
		cause: "CONSTRUCTION",
		effect: "DETOUR",
		routes: ["3"],
		title: "Route 3 detour",
		text: "Due to construction near Hamraborg",
		dateStart: "2026-01-01",
		dateEnd: null,
	},
];

const mockTrips: TripItinerary[] = [
	{
		id: "trip1",
		duration: { walk: 300, bus: 600, total: 900 },
		time: { from: "2026-01-01T10:00:00", to: "2026-01-01T10:15:00" },
		legs: [
			{
				type: "WALK",
				duration: 120,
				distance: 150,
				time: { from: "2026-01-01T10:00:00", to: "2026-01-01T10:02:00" },
				from: { lat: 64.14, lon: -21.9, depature: null, stop: null },
				to: {
					lat: 64.14,
					lon: -21.9,
					arrival: null,
					stop: { id: "10003", name: "Hlemmur", lat: 64.14, lon: -21.9 },
				},
			},
			{
				type: "BUS",
				duration: 600,
				distance: 3000,
				time: { from: "2026-01-01T10:02:00", to: "2026-01-01T10:12:00" },
				from: {
					lat: 64.14,
					lon: -21.9,
					depature: "2026-01-01T10:02:00",
					stop: { id: "10003", name: "Hlemmur", lat: 64.14, lon: -21.9 },
				},
				to: {
					lat: 64.1,
					lon: -21.84,
					arrival: "2026-01-01T10:12:00",
					stop: { id: "10002", name: "Mjódd A", lat: 64.1, lon: -21.84 },
				},
				trip: { routeNr: "3", headsign: "Mjódd" },
				stops: [
					{ id: "10003", name: "Hlemmur" },
					{ id: "10001", name: "Hamraborg" },
				],
			},
			{
				type: "WALK",
				duration: 180,
				distance: 200,
				time: { from: "2026-01-01T10:12:00", to: "2026-01-01T10:15:00" },
				from: {
					lat: 64.1,
					lon: -21.84,
					depature: null,
					stop: { id: "10002", name: "Mjódd A", lat: 64.1, lon: -21.84 },
				},
				to: { lat: 64.1, lon: -21.84, arrival: null, stop: null },
			},
		],
	},
];

// --- Format function tests ---

describe("formatBusOverview", () => {
	test("shows route and buses", () => {
		const output = fmt.formatBusOverview("3", mockBuses, "2026-01-01T10:00:00");
		expect(output).toContain("Route 3");
		expect(output).toContain("Hlemmur");
		expect(output).toContain("Seltjarnarnes");
	});

	test("shows no buses message for empty list", () => {
		const output = fmt.formatBusOverview("999", [], "2026-01-01T10:00:00");
		expect(output).toContain("No buses");
	});
});

describe("formatBusDetail", () => {
	test("shows bus detail with next stops", () => {
		const bus = mockBuses[0];
		expect(bus).toBeDefined();
		if (!bus) return;
		const output = fmt.formatBusDetail(bus, "2026-01-01T10:00:00");
		expect(output).toContain("Bus 1-A");
		expect(output).toContain("Hamraborg");
	});

	test("shows last stop when provided", () => {
		const bus = mockBuses[0];
		expect(bus).toBeDefined();
		if (!bus) return;
		const output = fmt.formatBusDetail(bus, "2026-01-01T10:00:00", "Grandi");
		expect(output).toContain("Grandi");
		expect(output).toContain("passed");
	});
});

describe("formatStops", () => {
	test("lists all stops", () => {
		const output = fmt.formatStops(mockStops);
		expect(output).toContain("Bus stops");
		expect(output).toContain("Hamraborg");
		expect(output).toContain("Mjódd A");
		expect(output).toContain("Hlemmur");
		expect(output).toContain("Grandi");
	});

	test("shows terminal indicator", () => {
		const output = fmt.formatStops(mockStops);
		// Hamraborg is a terminal
		expect(output).toContain("◉");
	});
});

describe("formatStop", () => {
	test("shows stop detail", () => {
		const output = fmt.formatStop(mockStopDetail);
		expect(output).toContain("Hamraborg");
		expect(output).toContain("10001");
		expect(output).toContain("Terminal");
	});
});

describe("formatAlerts", () => {
	test("shows alerts", () => {
		const output = fmt.formatAlerts(mockAlerts);
		expect(output).toContain("Route 3 detour");
		expect(output).toContain("construction");
	});

	test("shows no alerts message", () => {
		const output = fmt.formatAlerts([]);
		expect(output).toContain("No active alerts");
	});
});

describe("formatTrips", () => {
	test("shows trip plan", () => {
		const output = fmt.formatTrips(mockTrips);
		expect(output).toContain("→");
		expect(output).toContain("Hlemmur");
		expect(output).toContain("Mjódd");
	});

	test("shows no trips message", () => {
		const output = fmt.formatTrips([]);
		expect(output).toContain("No trips found");
	});
});

// --- Helper function tests ---

describe("findBus", () => {
	test("finds a bus by route and letter", () => {
		const found = findBus(mockBuses, "3", "b");
		expect(found).toBeDefined();
		expect(found?.busId).toBe("2-B");

		expect(findBus(mockBuses, "3", "c")).toBeUndefined();
		expect(findBus(mockBuses, "5", "a")).toBeUndefined();
	});
});

describe("findLastStop", () => {
	test("returns closest stop not in nextStops", () => {
		const bus = mockBuses[0];
		expect(bus).toBeDefined();
		if (!bus) return;
		// Hamraborg is in nextStops, so it should find the closest non-next stop
		const result = findLastStop(bus, mockStops);
		expect(result).toBeDefined();
		expect(result).not.toBe("Hamraborg");
	});

	test("returns undefined when no route stops exist", () => {
		const bus: BusLocation = {
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
		expect(findLastStop(bus, [])).toBeUndefined();
	});
});

// --- Stop filtering logic (mirrors stops/stop commands) ---

describe("stop filtering", () => {
	test("filters by route", () => {
		const route6 = mockStops.filter((s) => s.routes.includes("6"));
		expect(route6.map((s) => s.name)).toContain("Mjódd A");
		expect(route6.map((s) => s.name)).toContain("Hlemmur");
		expect(route6.map((s) => s.name)).not.toContain("Grandi");
	});

	test("filters by search", () => {
		const query = "hamra";
		const results = mockStops.filter((s) => s.name.toLowerCase().includes(query));
		expect(results).toHaveLength(1);
		expect(results[0]?.name).toBe("Hamraborg");
	});

	test("exact match lookup", () => {
		const query = "hamraborg";
		const matches = mockStops.filter((s) => s.name.toLowerCase() === query);
		expect(matches).toHaveLength(1);
	});

	test("fuzzy suggestions for partial match", () => {
		const query = "hamra";
		const exact = mockStops.filter((s) => s.name.toLowerCase() === query);
		expect(exact).toHaveLength(0);
		const fuzzy = mockStops.filter((s) => s.name.toLowerCase().includes(query));
		expect(fuzzy.length).toBeGreaterThan(0);
	});
});
