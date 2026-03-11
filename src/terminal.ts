const ANSI = {
	clearLine: "\x1B[K",
	hideCursor: "\x1B[?25l",
	showCursor: "\x1B[?25h",
	moveUp: (n: number) => `\x1B[${n}A`,
	moveToCol: (col: number) => `\x1B[${col}C`,
	carriageReturn: "\r",
	moveToStart: (n: number) => `\x1B[${n}A\x1B[G`,
};

export { ANSI };

export const write = (s: string) => Bun.write(Bun.stdout, s);
export const writeLn = (s: string) => Bun.write(Bun.stdout, `${s}\n`);
export const writeErr = (s: string) => Bun.write(Bun.stderr, `${s}\n`);

export async function clearLines(count: number) {
	if (count > 0) {
		let buf = "";
		for (let i = 0; i < count; i++) buf += `\n${ANSI.clearLine}`;
		buf += ANSI.moveUp(count);
		await write(buf);
	}
}

export function enableRaw() {
	if (process.stdin.isTTY) process.stdin.setRawMode(true);
	process.stdin.resume();
}

export function disableRaw() {
	if (process.stdin.isTTY) process.stdin.setRawMode(false);
	process.stdin.pause();
}

export function readKey(): Promise<Buffer> {
	return new Promise((resolve) => {
		const onData = (chunk: Buffer) => {
			process.stdin.removeListener("data", onData);
			resolve(chunk);
		};
		process.stdin.on("data", onData);
	});
}
