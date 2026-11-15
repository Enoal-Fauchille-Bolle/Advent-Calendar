import { describe, expect, it } from "vitest";
import { LoginThrottle } from "./throttle.ts";

function setup() {
  let time = 1_000_000;
  const throttle = new LoginThrottle(() => time);
  return {
    throttle,
    wait: (seconds: number) => {
      time += seconds * 1000;
    },
    /** Takes `times` tries and returns what each one answered. */
    take: (times: number) =>
      Array.from({ length: times }, () => throttle.take()),
  };
}

describe("LoginThrottle", () => {
  it("allows five tries with no wait", () => {
    const { throttle, take } = setup();
    expect(take(5)).toEqual([0, 0, 0, 0, 0]);
    expect(throttle.take()).toBe(60);
  });

  it("waits 1 minute, then 5, then 15, and stays at 15", () => {
    const { throttle, wait, take } = setup();
    take(5);
    expect(throttle.take()).toBe(60);
    wait(60);
    expect(throttle.take()).toBe(0);
    expect(throttle.take()).toBe(300);
    wait(300);
    expect(throttle.take()).toBe(0);
    expect(throttle.take()).toBe(900);
    wait(900);
    expect(throttle.take()).toBe(0);
    expect(throttle.take()).toBe(900);
  });

  it("counts down as time passes", () => {
    const { throttle, wait, take } = setup();
    take(5);
    wait(45);
    expect(throttle.take()).toBe(15);
    wait(14.5);
    expect(throttle.take()).toBe(1);
  });

  it("does not count a refused try", () => {
    const { throttle, wait, take } = setup();
    take(5);
    expect(take(3)).toEqual([60, 60, 60]);
    wait(60);
    expect(throttle.take()).toBe(0);
    // One more counted try, so the next step and not a later one.
    expect(throttle.take()).toBe(300);
  });

  it("lifts the wait when the last free try was right", () => {
    const { throttle, take } = setup();
    take(5);
    throttle.recordSuccess();
    expect(throttle.take()).toBe(0);
  });

  it("starts again from zero after a successful login", () => {
    const { throttle, wait, take } = setup();
    take(5);
    wait(60);
    take(1);
    wait(300);
    throttle.recordSuccess();
    expect(take(5)).toEqual([0, 0, 0, 0, 0]);
    expect(throttle.take()).toBe(60);
  });
});
