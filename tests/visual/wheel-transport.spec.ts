import { expect, test } from "@playwright/test";
import { WheelTransport, WHEEL_TRANSPORT_PARAMS } from "../../src/lib/experience/wheel-transport";

test.beforeEach(({}, info) => test.skip(info.project.name !== "1440x900", "viewport-independent controller"));

for (const hz of [30, 60, 120, 144, 240]) {
  test(`wheel: slow intent preserved, extreme input compressed, finite stop at ${hz}Hz`, () => {
    const distances: number[] = [];
    for (const [delta, interval] of [[4, 16], [100, 100], [300, 40]]) {
      const w = new WheelTransport();
      w.reset(1000, 36000);
      let y = 1000, next = 0, delivered = 0;
      for (let i = 0; i < hz * 6; i++) {
        const ms = i * 1000 / hz;
        while (ms < 4000 && next <= ms + 0.001) {
          w.input(delta, y, 36000, next);
          delivered += delta;
          next += interval;
        }
        const prev = y;
        y = w.step(1 / hz);
        const s = w.snapshot();
        expect(y).toBeGreaterThanOrEqual(prev - 1e-8);
        expect(Math.abs(s.velocity)).toBeLessThanOrEqual(WHEEL_TRANSPORT_PARAMS.vMax + 1e-6);
        expect(Math.abs(s.debt)).toBeLessThanOrEqual(WHEEL_TRANSPORT_PARAMS.gapMax + 1e-6);
        if (ms >= 4500) expect(w.settled).toBe(true);
      }
      if (delta === 4) expect(y - 1000).toBeCloseTo(delivered, 3);
      distances.push(y - 1000);
      const still = y;
      for (let i = 0; i < hz; i++) expect(w.step(1 / hz)).toBe(still);
    }
    expect(distances[1]).toBeGreaterThan(distances[0]);
    expect(distances[2]).toBeLessThan(distances[1] * 1.5);
  });

  test(`wheel: reversal brakes through zero; hitch cannot teleport at ${hz}Hz`, () => {
    const w = new WheelTransport(); w.reset(1000, 36000);
    let y = 1000;
    for (let i = 0; i < hz; i++) {
      w.input(100, y, 36000, i * 1000 / hz);
      y = w.step(1 / hz);
    }
    const before = w.snapshot().velocity;
    w.input(-100, y, 36000, 1000);
    expect(w.snapshot().velocity).toBe(before);
    let reversed = false;
    for (let i = 0; i < hz / 5; i++) { y = w.step(1 / hz); reversed ||= w.snapshot().velocity < 0; }
    expect(reversed).toBe(true);
    w.input(60000, y, 36000, 1300);
    const prior = w.presented;
    w.step(2);
    expect(Math.abs(w.presented - prior)).toBeLessThanOrEqual(WHEEL_TRANSPORT_PARAMS.vMax * WHEEL_TRANSPORT_PARAMS.maxDt);
  });
}

test("wheel: external jumps and resized extent discard pending wheel debt", () => {
  const w = new WheelTransport(); w.reset(1000, 36000);
  w.input(60000, 1000, 36000, 0); w.step(1 / 60);
  w.input(4, 20000, 48000, 100);
  expect(w.presented).toBe(20000);
  expect(w.snapshot().target).toBeCloseTo(20004, 6);
  w.reset(7000, 48000);
  expect(w.step(1)).toBe(7000);
});

test("wheel: counter-direction noise ignored, repeated deliberate micro reverse accepted", () => {
  const w = new WheelTransport(); w.reset(1000, 36000);
  w.input(100, 1000, 36000, 0);
  const target = w.snapshot().target;
  w.input(-3, 1000, 36000, 16);
  expect(w.snapshot().target).toBe(target);
  w.input(-3, 1000, 36000, 32);
  expect(w.snapshot().target).toBeLessThan(1000);
});

test("wheel: document endpoints settle without boundary-style endpoint snaps", () => {
  for (const [start, delta, endpoint] of [[5, -100, 0], [35995, 100, 36000]]) {
    const w = new WheelTransport(); w.reset(start, 36000);
    w.input(delta, start, 36000, 0);
    expect(w.presented).toBe(start);
    for (let i = 0; i < 120; i++) w.step(1 / 120);
    expect(w.presented).toBe(endpoint);
    expect(w.settled).toBe(true);
  }
});
