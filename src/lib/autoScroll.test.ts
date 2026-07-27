import { describe, expect, it } from "vitest";
import { scrollVelocity, type AutoScrollBounds, type AutoScrollOptions } from "./autoScroll";

const bounds: AutoScrollBounds = { top: 100, bottom: 700 };
const options: AutoScrollOptions = { edgeSize: 100, maxSpeed: 1000 };

describe("scrollVelocity", () => {
  it("returns 0 between the edge zones", () => {
    expect(scrollVelocity(400, bounds, options)).toBe(0);
    // The inner boundary of each zone is where the ramp reaches zero, so a
    // pointer exactly edgeSize from an edge must not scroll.
    expect(scrollVelocity(200, bounds, options)).toBe(0);
    expect(scrollVelocity(600, bounds, options)).toBe(0);
  });

  it("is negative in the top zone and positive in the bottom zone", () => {
    expect(scrollVelocity(150, bounds, options)).toBeLessThan(0);
    expect(scrollVelocity(101, bounds, options)).toBeLessThan(0);
    expect(scrollVelocity(650, bounds, options)).toBeGreaterThan(0);
    expect(scrollVelocity(699, bounds, options)).toBeGreaterThan(0);
  });

  it("ramps quadratically from the zone boundary to the edge", () => {
    // Halfway into the zone: ratio 0.5, squared to 0.25 of maxSpeed.
    expect(scrollVelocity(150, bounds, options)).toBe(-250);
    expect(scrollVelocity(650, bounds, options)).toBe(250);
    // Three quarters in: ratio 0.75, squared to 0.5625 of maxSpeed.
    expect(scrollVelocity(125, bounds, options)).toBe(-562.5);
    expect(scrollVelocity(675, bounds, options)).toBe(562.5);
    // One quarter in: ratio 0.25, squared to 0.0625 of maxSpeed.
    expect(scrollVelocity(175, bounds, options)).toBe(-62.5);
    expect(scrollVelocity(625, bounds, options)).toBe(62.5);
  });

  it("increases in magnitude monotonically toward each edge", () => {
    let previous = 0;
    for (let y = 195; y >= 100; y -= 5) {
      const magnitude = Math.abs(scrollVelocity(y, bounds, options));
      expect(magnitude).toBeGreaterThan(previous);
      previous = magnitude;
    }
    previous = 0;
    for (let y = 605; y <= 700; y += 5) {
      const magnitude = Math.abs(scrollVelocity(y, bounds, options));
      expect(magnitude).toBeGreaterThan(previous);
      previous = magnitude;
    }
  });

  it("reaches exactly maxSpeed at the edge itself", () => {
    expect(scrollVelocity(100, bounds, options)).toBe(-1000);
    expect(scrollVelocity(700, bounds, options)).toBe(1000);
  });

  it("clamps to maxSpeed when the pointer is past the edge", () => {
    expect(scrollVelocity(50, bounds, options)).toBe(-1000);
    expect(scrollVelocity(-5000, bounds, options)).toBe(-1000);
    expect(scrollVelocity(750, bounds, options)).toBe(1000);
    expect(scrollVelocity(15_000, bounds, options)).toBe(1000);
  });

  it("never exceeds maxSpeed in magnitude at any pointer position", () => {
    for (let y = -300; y <= 1100; y += 7) {
      expect(Math.abs(scrollVelocity(y, bounds, options))).toBeLessThanOrEqual(1000);
    }
  });

  it("defaults to edgeSize 72 and maxSpeed 1200", () => {
    const tall: AutoScrollBounds = { top: 0, bottom: 1000 };
    expect(scrollVelocity(500, tall)).toBe(0);
    expect(scrollVelocity(72, tall)).toBe(0);
    expect(scrollVelocity(928, tall)).toBe(0);
    // 36 px is half of the default zone: ratio 0.5, squared to 0.25 of 1200.
    expect(scrollVelocity(36, tall)).toBe(-300);
    expect(scrollVelocity(964, tall)).toBe(300);
    expect(scrollVelocity(0, tall)).toBe(-1200);
    expect(scrollVelocity(1000, tall)).toBe(1200);
    expect(scrollVelocity(-50, tall)).toBe(-1200);
  });

  it("lets the nearer edge win in a container shorter than two edge zones", () => {
    // 100 px tall with a 100 px zone: every interior point is inside both
    // zones at once.
    const short: AutoScrollBounds = { top: 0, bottom: 100 };
    for (let y = 0; y < 50; y += 1) {
      expect(scrollVelocity(y, short, options)).toBeLessThan(0);
    }
    for (let y = 51; y <= 100; y += 1) {
      expect(scrollVelocity(y, short, options)).toBeGreaterThan(0);
    }
    // The ramp still measures distance to the winning edge, undiluted by the
    // overlapping opposite zone.
    expect(scrollVelocity(25, short, options)).toBe(-562.5);
    expect(scrollVelocity(75, short, options)).toBe(562.5);
    expect(Math.abs(scrollVelocity(50, short, options))).toBe(250);
    for (let y = -60; y <= 160; y += 1) {
      expect(Math.abs(scrollVelocity(y, short, options))).toBeLessThanOrEqual(1000);
    }
    expect(scrollVelocity(-60, short, options)).toBe(-1000);
    expect(scrollVelocity(160, short, options)).toBe(1000);
  });
});
