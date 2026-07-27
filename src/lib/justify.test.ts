import { describe, expect, it } from "vitest";
import { justify, rowsHeight, type JustifiedRow, type JustifyOptions, type Sized } from "./justify";

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

interface TestItem extends Sized {
  id: number;
}

/** ~500 items mixing portrait, landscape, square, and the odd panorama. */
const makeItems = (count: number, seed: number): TestItem[] => {
  const rand = mulberry32(seed);
  const items: TestItem[] = [];
  for (let i = 0; i < count; i += 1) {
    const roll = rand();
    let width: number;
    let height: number;
    if (roll < 0.35) {
      // portrait
      width = 800 + Math.floor(rand() * 1200);
      height = Math.floor(width * (1.2 + rand() * 1.3));
    } else if (roll < 0.75) {
      // landscape
      height = 800 + Math.floor(rand() * 1200);
      width = Math.floor(height * (1.2 + rand() * 1.3));
    } else if (roll < 0.95) {
      // square-ish
      width = 900 + Math.floor(rand() * 400);
      height = 900 + Math.floor(rand() * 400);
    } else {
      // panorama
      height = 500 + Math.floor(rand() * 300);
      width = Math.floor(height * (4 + rand() * 6));
    }
    items.push({ id: i, width, height });
  }
  return items;
};

interface Fixture {
  label: string;
  items: TestItem[];
  opts: Required<JustifyOptions>;
  rows: JustifiedRow<TestItem>[];
}

const fixtures: Fixture[] = [
  { containerWidth: 320, targetHeight: 132, gap: 4, maxHeight: 190 },
  { containerWidth: 768, targetHeight: 168, gap: 6, maxHeight: 240 },
  { containerWidth: 1440, targetHeight: 248, gap: 8, maxHeight: 360 },
].map((opts) => {
  const items = makeItems(500, 0xa11ce + opts.containerWidth);
  return { label: `${opts.containerWidth}px`, items, opts, rows: justify(items, opts) };
});

describe.each(fixtures)("justify at $label", ({ items, opts, rows }) => {
  const { containerWidth, gap, maxHeight } = opts;
  const cells = rows.flatMap((row) => row.cells);

  it("places every input item exactly once, in input order", () => {
    expect(cells.length).toBe(items.length);
    for (let i = 0; i < items.length; i += 1) {
      expect(cells[i].item).toBe(items[i]);
    }
  });

  it("spans containerWidth exactly on every row except the last", () => {
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows.slice(0, -1)) {
      const last = row.cells[row.cells.length - 1];
      expect(Math.abs(last.x + last.w - containerWidth)).toBeLessThanOrEqual(0.5);
    }
    // The trailing row is left-aligned at targetHeight and carries no width
    // guarantee: a leftover panorama can legitimately exceed containerWidth.
  });

  it("keeps every row height positive and at most maxHeight", () => {
    for (const row of rows) {
      expect(row.h).toBeGreaterThan(0);
      expect(row.h).toBeLessThanOrEqual(maxHeight + 1e-6);
    }
  });

  it("gives all cells in a row the row's y and h, ordered left to right with the gap between", () => {
    for (const row of rows) {
      expect(row.cells.length).toBeGreaterThan(0);
      for (const cell of row.cells) {
        expect(cell.y).toBe(row.y);
        expect(cell.h).toBe(row.h);
        expect(Number.isFinite(cell.x)).toBe(true);
        expect(cell.w).toBeGreaterThan(0);
      }
      expect(row.cells[0].x).toBe(0);
      for (let i = 1; i < row.cells.length; i += 1) {
        const prev = row.cells[i - 1];
        const next = row.cells[i];
        expect(next.x).toBeGreaterThan(prev.x);
        expect(next.x - (prev.x + prev.w)).toBeCloseTo(gap, 6);
      }
    }
  });

  it("stacks rows downward without overlap", () => {
    expect(rows[0].y).toBe(0);
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1];
      expect(rows[i].y).toBeCloseTo(prev.y + prev.h + gap, 6);
    }
  });

  it("reports rowsHeight as the last row's bottom edge plus the gap", () => {
    const last = rows[rows.length - 1];
    expect(rowsHeight(rows, gap)).toBeCloseTo(last.y + last.h + gap, 6);
  });
});

describe("justify degenerate inputs", () => {
  const opts: Required<JustifyOptions> = { containerWidth: 768, targetHeight: 168, gap: 6, maxHeight: 240 };

  it("returns [] for an empty item list", () => {
    expect(justify([], opts)).toEqual([]);
  });

  it("returns [] for containerWidth 0", () => {
    expect(justify(makeItems(10, 7), { ...opts, containerWidth: 0 })).toEqual([]);
  });

  it("produces finite positive cells for zero, NaN, and negative dimensions", () => {
    const bad: Sized[] = [
      { width: 0, height: 0 },
      { width: NaN, height: 1000 },
      { width: 1000, height: NaN },
      { width: -800, height: 600 },
      { width: 800, height: -600 },
      { width: Infinity, height: 500 },
    ];
    const rows = justify(bad, opts);
    const cells = rows.flatMap((row) => row.cells);
    expect(cells.length).toBe(bad.length);
    for (const cell of cells) {
      expect(Number.isFinite(cell.w)).toBe(true);
      expect(Number.isFinite(cell.h)).toBe(true);
      expect(cell.w).toBeGreaterThan(0);
      expect(cell.h).toBeGreaterThan(0);
    }
  });

  it("fits a lone 8000x500 panorama exactly within containerWidth", () => {
    for (const containerWidth of [320, 768, 1440]) {
      const rows = justify([{ width: 8000, height: 500 }], { ...opts, containerWidth });
      expect(rows.length).toBe(1);
      const [cell] = rows[0].cells;
      expect(Math.abs(cell.x + cell.w - containerWidth)).toBeLessThanOrEqual(0.5);
      expect(rows[0].h).toBeGreaterThan(0);
    }
  });

  it("rowsHeight of an empty list is 0", () => {
    expect(rowsHeight([], 8)).toBe(0);
  });
});
