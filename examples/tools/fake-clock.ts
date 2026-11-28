// Moves the clock of the screenshot server to the moment in SCREENSHOT_NOW (an
// ISO date), so the header shows that day. make-screenshot.ts loads it with
// `--import` into its own test server only; the clock keeps ticking from there.

const target = Date.parse(process.env.SCREENSHOT_NOW ?? "");
if (Number.isNaN(target)) {
  throw new Error("SCREENSHOT_NOW must be an ISO date");
}
const RealDate = Date;
const offset = target - RealDate.now();

class ShiftedDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(RealDate.now() + offset);
    } else {
      super(...(args as [number]));
    }
  }

  static override now(): number {
    return RealDate.now() + offset;
  }
}

globalThis.Date = ShiftedDate as DateConstructor;
