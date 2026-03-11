import { describe, expect, test } from "bun:test";

const CLI = ["bun", "run", "src/cli.ts"];

async function run(
	...args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn([...CLI, ...args], {
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, FORCE_COLOR: "0" },
	});
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const exitCode = await proc.exited;
	return { stdout, stderr, exitCode };
}

async function runWithRetry(
	args: string[],
	retries = 3,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	for (let i = 0; i < retries; i++) {
		const result = await run(...args);
		if (result.exitCode === 0) return result;
		if (i < retries - 1) await Bun.sleep(1000);
	}
	return run(...args);
}

describe("cli --help", () => {
	test("shows usage and all commands", async () => {
		const { stdout, exitCode } = await run("--help");

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage: straeto");
		expect(stdout).toContain("route");
		expect(stdout).toContain("stops");
		expect(stdout).toContain("stop");
		expect(stdout).toContain("alerts");
		expect(stdout).toContain("plan");
	});
});

describe("cli --version", () => {
	test("prints version matching package.json", async () => {
		const pkg = await Bun.file("package.json").json();
		const { stdout, exitCode } = await run("--version");

		expect(exitCode).toBe(0);
		expect(stdout.trim()).toBe(pkg.version);
	});

	test("works with -v shorthand", async () => {
		const { stdout, exitCode } = await run("-v");

		expect(exitCode).toBe(0);
		expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
	});
});

describe("cli route", () => {
	test("shows bus overview for a route", async () => {
		const { stdout, exitCode } = await runWithRetry(["route", "3"]);

		expect(exitCode).toBe(0);
		// Either shows active buses or a "No buses" message
		expect(stdout.includes("Route 3") || stdout.includes("No buses")).toBe(true);
	});

	test("shows help for route command", async () => {
		const { stdout, exitCode } = await run("route", "--help");

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Route number");
		expect(stdout).toContain("--watch");
		expect(stdout).toContain("--interval");
	});

	test("fails without route argument", async () => {
		const { stderr, exitCode } = await run("route");

		expect(exitCode).toBe(1);
		expect(stderr).toContain("missing required argument");
	});
});

describe("cli stops", () => {
	test("lists stops with default limit", async () => {
		const { stdout, exitCode } = await runWithRetry(["stops"]);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Bus stops");
		expect(stdout).toContain("more");
	});

	test("filters stops by search", async () => {
		const { stdout, exitCode } = await runWithRetry(["stops", "-s", "Hamraborg"]);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Hamraborg");
	});

	test("respects -n limit flag", async () => {
		const { stdout, exitCode } = await runWithRetry(["stops", "-n", "3"]);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Bus stops");
		// Should show "and N more" since 3 is less than total
		expect(stdout).toContain("more");
	});
});

describe("cli stop", () => {
	test("looks up a stop by name", async () => {
		const { stdout, exitCode } = await runWithRetry(["stop", "Hamraborg"]);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Hamraborg");
	});

	test("shows suggestions for partial match", async () => {
		const { stdout, exitCode } = await runWithRetry(["stop", "Hamra"]);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Hamraborg");
	});

	test("fails for nonexistent stop", async () => {
		const { stderr, exitCode } = await run("stop", "xyznonexistent123");

		expect(exitCode).toBe(1);
		expect(stderr).toContain("No stops matching");
	});
});

describe("cli alerts", () => {
	test("shows alerts in Icelandic by default", async () => {
		const { stdout, exitCode } = await runWithRetry(["alerts"]);

		expect(exitCode).toBe(0);
		// May have 0 alerts, but should still show the header or "No active alerts"
		expect(stdout.length).toBeGreaterThan(0);
	});

	test("shows alerts in English with -l EN", async () => {
		const { stdout, exitCode } = await runWithRetry(["alerts", "-l", "EN"]);

		expect(exitCode).toBe(0);
		expect(stdout.length).toBeGreaterThan(0);
	});
});

describe("cli plan", () => {
	test("plans a trip with coordinates", async () => {
		// Use tomorrow to avoid time-of-day edge cases
		const tomorrow = new Date(Date.now() + 86400000);
		const date = tomorrow.toISOString().slice(0, 10);
		const { stdout, exitCode } = await runWithRetry([
			"plan",
			"-f",
			"64.1426,-21.9009",
			"-t",
			"64.1117,-21.8437",
			"--at",
			"10:00",
			"-d",
			date,
		]);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("→");
	});

	test("fails without from/to in non-interactive mode", async () => {
		const { stderr, exitCode } = await run("plan", "-f", "64.14,-21.90");

		expect(exitCode).toBe(1);
		expect(stderr).toContain("Missing --from and --to");
	});

	test("shows help for plan command", async () => {
		const { stdout, exitCode } = await run("plan", "--help");

		expect(exitCode).toBe(0);
		expect(stdout).toContain("--from");
		expect(stdout).toContain("--to");
		expect(stdout).toContain("--at");
		expect(stdout).toContain("--by");
		expect(stdout).toContain("--interactive");
	});
});

describe("cli unknown command", () => {
	test("shows error for unknown command", async () => {
		const { stderr, exitCode } = await run("foobar");

		expect(exitCode).toBe(1);
		expect(stderr).toContain("unknown command");
	});
});
