import { describe, expect, it } from "vitest";
import {
  cellsInBox,
  firstRowAtOrBelow,
  firstRowBelow,
  toContentRect,
  visibleRange,
  type Rect,
  type Span,
} from "./geometry";
import { justify, type JustifiedRow, type Sized } from "./justify";

/** Deterministic PRNG (mulberry32) so failures reproduce byte for byte. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Sorted, non-overlapping spans, the shape the binary searches require. */
const makeSpans = (count: number, rand: () => number): Span[] => {
  const spans: Span[] = [];
  let y = Math.floor(rand() * 40);
  for (let i = 0; i < count; i += 1) {
    const h = 1 + Math.floor(rand() * 300);
    spans.push({ y, h });
    y += h + Math.floor(rand() * 20);
  }
  return spans;
};

const bruteFirstRowBelow = (rows: readonly Span[], edge: number): number => {
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].y + rows[i].h > edge) return i;
  }
  return rows.length;
};

const bruteFirstRowAtOrBelow = (rows: readonly Span[], edge: number): number => {
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].y >= edge) return i;
  }
  return rows.length;
};

describe("firstRowBelow / firstRowAtOrBelow", () => {
  it("agree with a brute-force linear scan across random row lists and probes", () => {
    const rand = mulberry32(0xb15ec7);
    for (let trial = 0; trial < 200; trial += 1) {
      const rows = makeSpans(Math.floor(rand() * 40), rand);
      const probes: number[] = [-50, 0];
      for (const row of rows) {
        // Exact edges are where an off-by-one in the search would hide.
        probes.push(row.y, row.y + row.h, row.y - 1, row.y + row.h + 1);
      }
      const total = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].h : 0;
      probes.push(total, total + 100, rand() * (total + 200) - 50);

      for (const edge of probes) {
        expect(firstRowBelow(rows, edge)).toBe(bruteFirstRowBelow(rows, edge));
        expect(firstRowAtOrBelow(rows, edge)).toBe(bruteFirstRowAtOrBelow(rows, edge));
      }
    }
  });
});

describe("visibleRange", () => {
  it("covers every intersecting row, stays in bounds, and never inverts", () => {
    const rand = mulberry32(0x5c011);
    for (let trial = 0; trial < 200; trial += 1) {
      const rows = makeSpans(Math.floor(rand() * 40), rand);
      const total = rows.length > 0 ? rows[rows.length - 1].y + rows[rows.length - 1].h : 0;
      const scrollTop = rand() * (total + 400) - 200;
      const viewportHeight = rand() * 900;

      for (const overscan of [0, 2, 5]) {
        const [start, end] = visibleRange(rows, scrollTop, viewportHeight, overscan);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeLessThanOrEqual(rows.length);
        expect(start).toBeLessThanOrEqual(end);
        for (let i = 0; i < rows.length; i += 1) {
          const intersects =
            rows[i].y < scrollTop + viewportHeight && rows[i].y + rows[i].h > scrollTop;
          if (intersects) {
            expect(i).toBeGreaterThanOrEqual(start);
            expect(i).toBeLessThan(end);
          }
        }
      }
    }
  });

  it("with zero overscan returns exactly the intersecting rows", () => {
    const rand = mulberry32(0xe4ac7);
    for (let trial = 0; trial < 100; trial += 1) {
      const rows = makeSpans(1 + Math.floor(rand() * 30), rand);
      const total = rows[rows.length - 1].y + rows[rows.length - 1].h;
      const scrollTop = rand() * total;
      const viewportHeight = 1 + rand() * 600;
      const [start, end] = visibleRange(rows, scrollTop, viewportHeight, 0);
      for (let i = start; i < end; i += 1) {
        expect(rows[i].y).toBeLessThan(scrollTop + viewportHeight);
        expect(rows[i].y + rows[i].h).toBeGreaterThan(scrollTop);
      }
    }
  });

  it("returns [0, 0] for an empty row list", () => {
    expect(visibleRange([], 100, 500, 3)).toEqual([0, 0]);
  });
});

interface TestItem extends Sized {
  id: number;
}

describe("cellsInBox", () => {
  const rand = mulberry32(0xce115);
  const items: TestItem[] = [];
  for (let i = 0; i < 500; i += 1) {
    const portrait = rand() < 0.5;
    const long = 800 + Math.floor(rand() * 1200);
    const short = Math.floor(long / (1.2 + rand() * 1.3));
    items.push({ id: i, width: portrait ? short : long, height: portrait ? long : short });
  }
  const rows: JustifiedRow<TestItem>[] = justify(items, {
    containerWidth: 768,
    targetHeight: 168,
    gap: 6,
    maxHeight: 240,
  });
  const last = rows[rows.length - 1];
  const totalHeight = last.y + last.h;

  const bruteHits = (box: Rect): Set<TestItem> => {
    const hits = new Set<TestItem>();
    for (const row of rows) {
      for (const cell of row.cells) {
        if (
          cell.x < box.left + box.width &&
          box.left < cell.x + cell.w &&
          cell.y < box.top + box.height &&
          box.top < cell.y + cell.h
        ) {
          hits.add(cell.item);
        }
      }
    }
    return hits;
  };

  const check = (box: Rect): void => {
    const got = cellsInBox(rows, box);
    const gotItems = new Set(got.map((cell) => cell.item));
    // Duplicate hits would double-select on marquee drag.
    expect(gotItems.size).toBe(got.length);
    expect(gotItems).toEqual(bruteHits(box));
  };

  it("matches a brute-force scan over many random boxes", () => {
    for (let trial = 0; trial < 300; trial += 1) {
      check({
        left: rand() * 900 - 100,
        top: rand() * (totalHeight + 400) - 200,
        width: rand() * 500,
        height: rand() * 500,
      });
    }
  });

  it("returns nothing for empty and fully-outside boxes", () => {
    check({ left: 100, top: 100, width: 0, height: 0 });
    check({ left: 100, top: 100, width: 0, height: 300 });
    check({ left: 100, top: 100, width: 300, height: 0 });
    check({ left: -500, top: -500, width: 100, height: 100 });
    check({ left: 10_000, top: 50, width: 100, height: 100 });
    check({ left: 50, top: totalHeight + 100, width: 100, height: 100 });
    expect(cellsInBox(rows, { left: -500, top: -500, width: 100, height: 100 })).toEqual([]);
  });

  it("returns every cell for a box covering the whole layout", () => {
    const got = cellsInBox(rows, { left: -10, top: -10, width: 1000, height: totalHeight + 20 });
    expect(got.length).toBe(items.length);
  });
});

describe("toContentRect", () => {
  it("subtracts the content element's origin and preserves size", () => {
    const box: Rect = { left: 300, top: 400, width: 120, height: 80 };
    expect(toContentRect(box, { left: 24, top: 112 })).toEqual({
      left: 276,
      top: 288,
      width: 120,
      height: 80,
    });
  });

  it("maps a box at the origin to zero", () => {
    const box: Rect = { left: 24, top: 112, width: 10, height: 10 };
    expect(toContentRect(box, { left: 24, top: 112 })).toEqual({
      left: 0,
      top: 0,
      width: 10,
      height: 10,
    });
  });

  /*
   * A live getBoundingClientRect already moves with the scroll container, so a
   * scrolled origin has a negative top and the conversion must not add scrollTop
   * on top of it. Double-counting here is exactly what drew the marquee box
   * thousands of pixels away from the cursor.
   */
  it("handles a scrolled origin without double-counting the offset", () => {
    const box: Rect = { left: 100, top: 300, width: 50, height: 50 };
    expect(toContentRect(box, { left: 24, top: -2500 })).toEqual({
      left: 76,
      top: 2800,
      width: 50,
      height: 50,
    });
  });
});
