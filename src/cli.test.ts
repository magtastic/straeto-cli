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

describe("cli --help", () => {
	test("shows usage and all commands", async () => {
		const { stdout, exitCode } = await run("--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage: straeto");
		expect(stdout).toContain("route");
		expect(stdout).toContain("stops");
		expect(stdout).toContain("stop");
		expect(stdout).toContain("next");
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

describe("cli unknown command", () => {
	test("shows error for unknown command", async () => {
		const { stderr, exitCode } = await run("foobar");
		expect(exitCode).toBe(1);
		expect(stderr).toContain("unknown command");
	});
});

describe("cli route (help/args)", () => {
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

describe("cli next (help/args)", () => {
	test("shows help for next command", async () => {
		const { stdout, exitCode } = await run("next", "--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("--route");
		expect(stdout).toContain("--direction");
		expect(stdout).toContain("--limit");
	});

	test("fails without stop argument", async () => {
		const { stderr, exitCode } = await run("next");
		expect(exitCode).toBe(1);
		expect(stderr).toContain("missing required argument");
	});
});

describe("cli plan (help/args)", () => {
	test("shows help for plan command", async () => {
		const { stdout, exitCode } = await run("plan", "--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("--from");
		expect(stdout).toContain("--to");
		expect(stdout).toContain("--at");
		expect(stdout).toContain("--by");
		expect(stdout).toContain("--interactive");
	});

	test("fails without from/to in non-interactive mode", async () => {
		const { stderr, exitCode } = await run("plan", "-f", "64.14,-21.90");
		expect(exitCode).toBe(1);
		expect(stderr).toContain("Missing --from and --to");
	});
});
