import { describe, expect, it } from "vitest";
import type { Board } from "../app/api/boards";
import {
  buildRows,
  metricsFor,
  type BuildRowsInput,
  type VRow,
} from "./rows";
import type { Asset } from "./useAssets";

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

const makeBoard = (i: number): Board => ({
  id: `board-${i}`,
  parentId: null,
  creatorId: "creator",
  workspaceId: "workspace",
  title: `Board ${i}`,
  description: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  hasCurrentUser: false,
  pos: i,
});

const makeAssets = (count: number, seed: number): Asset[] => {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const portrait = rand() < 0.5;
    const long = 800 + Math.floor(rand() * 1200);
    const short = Math.floor(long / (1.2 + rand() * 1.3));
    return {
      id: `asset-${i}`,
      width: portrait ? short : long,
      height: portrait ? long : short,
      title: `Asset ${i}`,
      image: `https://air-prod.imgix.net/${i}.jpg`,
      type: "photo",
      duration: 0,
      ext: "jpg",
      meta: "JPG · 1.4 MB · 1200 x 800",
    };
  });
};

const baseInput = (overrides: Partial<BuildRowsInput> = {}): BuildRowsInput => ({
  boards: Array.from({ length: 7 }, (_, i) => makeBoard(i)),
  assets: makeAssets(60, 0x0a55e7),
  containerWidth: 768,
  metrics: metricsFor(768),
  collapsed: { boards: false, assets: false },
  total: 60,
  hasMore: false,
  loading: false,
  ...overrides,
});

const statusRows = (rows: VRow[]): Extract<VRow, { kind: "status" }>[] =>
  rows.filter((row): row is Extract<VRow, { kind: "status" }> => row.kind === "status");

describe("buildRows layout", () => {
  const input = baseInput();
  const { gap } = input.metrics;
  const { rows, height } = buildRows(input);

  // Spacing varies by transition: a label hugs the content beneath it and sits
  // further from the section above. So the invariant is that rows stack without
  // overlapping, with the row gap as the floor, not that every step is equal.
  it("stacks rows in order without overlapping, never tighter than the row gap", () => {
    expect(rows.length).toBeGreaterThan(3);
    expect(rows[0].y).toBe(0);
    for (let i = 1; i < rows.length; i += 1) {
      const previousBottom = rows[i - 1].y + rows[i - 1].h;
      expect(rows[i].y).toBeGreaterThan(rows[i - 1].y);
      expect(rows[i].y).toBeGreaterThanOrEqual(previousBottom + gap - 1e-6);
    }
  });

  it("puts more space above a section label than below it", () => {
    const assetsHeader = rows.findIndex((r) => r.kind === "header" && r.id === "h-assets");
    expect(assetsHeader).toBeGreaterThan(0);
    const above = rows[assetsHeader].y - (rows[assetsHeader - 1].y + rows[assetsHeader - 1].h);
    const below = rows[assetsHeader + 1].y - (rows[assetsHeader].y + rows[assetsHeader].h);
    expect(above).toBeGreaterThan(below);
  });

  it("reports height as the last row's bottom edge", () => {
    const last = rows[rows.length - 1];
    expect(height).toBeCloseTo(last.y + last.h, 6);
  });

  it("numbers board rows and asset rows independently from 0", () => {
    const boardRows = rows.filter(
      (row): row is Extract<VRow, { kind: "boards" }> => row.kind === "boards",
    );
    const assetRows = rows.filter(
      (row): row is Extract<VRow, { kind: "assets" }> => row.kind === "assets",
    );
    // 768px of content fits 3 board columns, so 7 boards take 3 grid rows.
    expect(boardRows.length).toBe(3);
    expect(assetRows.length).toBeGreaterThan(2);
    boardRows.forEach((row, i) => expect(row.index).toBe(i));
    assetRows.forEach((row, i) => expect(row.index).toBe(i));
  });

  it("re-anchors asset cells so each cell's y matches its row", () => {
    for (const row of rows) {
      if (row.kind !== "assets") continue;
      for (const cell of row.cells) {
        expect(cell.y).toBeCloseTo(row.y, 6);
        expect(cell.h).toBeCloseTo(row.h, 6);
      }
    }
  });
});

describe("buildRows collapsing", () => {
  const headerSections = (rows: VRow[]): string[] =>
    rows.filter((row) => row.kind === "header").map((row) => (row.kind === "header" ? row.section : ""));

  it("collapsing boards removes board rows but keeps both headers", () => {
    const { rows } = buildRows(baseInput({ collapsed: { boards: true, assets: false } }));
    expect(rows.some((row) => row.kind === "boards")).toBe(false);
    expect(rows.some((row) => row.kind === "assets")).toBe(true);
    expect(headerSections(rows)).toEqual(["boards", "assets"]);
  });

  it("collapsing assets removes asset and status rows but keeps both headers", () => {
    const { rows } = buildRows(baseInput({ collapsed: { boards: false, assets: true } }));
    expect(rows.some((row) => row.kind === "assets")).toBe(false);
    expect(statusRows(rows)).toEqual([]);
    expect(rows.some((row) => row.kind === "boards")).toBe(true);
    expect(headerSections(rows)).toEqual(["boards", "assets"]);
  });
});

describe("buildRows status row", () => {
  it("shows 'empty' when there are no assets and nothing is loading", () => {
    const { rows } = buildRows(baseInput({ assets: [], total: 0, loading: false, hasMore: false }));
    const status = statusRows(rows);
    expect(status.length).toBe(1);
    expect(status[0].state).toBe("empty");
  });

  it("shows 'loading' while more pages remain", () => {
    const { rows } = buildRows(baseInput({ hasMore: true }));
    const status = statusRows(rows);
    expect(status.length).toBe(1);
    expect(status[0].state).toBe("loading");
  });

  it("shows 'end' when all assets are loaded", () => {
    const { rows } = buildRows(baseInput({ hasMore: false }));
    const status = statusRows(rows);
    expect(status.length).toBe(1);
    expect(status[0].state).toBe("end");
  });
});

describe("metricsFor", () => {
  it("uses a smaller row target on phones than on desktops", () => {
    expect(metricsFor(320).targetHeight).toBeLessThan(metricsFor(1440).targetHeight);
  });

  it("never returns fewer than 1 board column", () => {
    for (const width of [0, 1, 319, 320, 479, 480, 767, 768, 1279, 1280, 1440, 5000]) {
      expect(metricsFor(width).boardColumns).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps maxHeight at or above targetHeight so justify's ceiling holds", () => {
    for (const width of [320, 768, 1440]) {
      const metrics = metricsFor(width);
      expect(metrics.maxHeight).toBeGreaterThanOrEqual(metrics.targetHeight);
    }
  });

  // A zero gap is legitimate: each cell insets its image by 4px on every side,
  // so adjacent images are still 8px apart with no gap between the cells. What
  // must never happen is a negative gap, which would overlap the layout.
  it("never returns a negative gap", () => {
    for (const width of [0, 1, 319, 320, 479, 480, 767, 768, 1279, 1280, 1440, 5000]) {
      expect(metricsFor(width).gap).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("board grid", () => {
  it("fills columns to a minimum width rather than dividing evenly", () => {
    // Four boards on a wide viewport sit at their natural size and leave the
    // rest of the row empty, instead of stretching across it.
    expect(metricsFor(1384).boardColumns).toBeGreaterThan(4);
    expect(metricsFor(712).boardColumns).toBe(3);
  });

  it("uses a shorter card and a tighter gap on phones", () => {
    expect(metricsFor(366).boardCardHeight).toBeLessThan(metricsFor(1384).boardCardHeight);
    expect(metricsFor(366).boardGap).toBeLessThan(metricsFor(1384).boardGap);
  });

  it("never returns fewer than one column", () => {
    for (const width of [0, 1, 100, 320, 480, 1440, 5000]) {
      expect(metricsFor(width).boardColumns).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("board card sizing", () => {
  it("cards plus their gaps fill the container exactly", () => {
    const input = baseInput();
    const row = buildRows(input).rows.find((r) => r.kind === "boards");
    if (row?.kind !== "boards") throw new Error("expected a board row");
    const columns = input.metrics.boardColumns;
    expect(columns * row.cardWidth + (columns - 1) * input.metrics.boardGap).toBeCloseTo(
      input.containerWidth,
      6,
    );
  });

  it("reports the server total in the assets header, falling back to what is loaded", () => {
    const header = (input: Partial<BuildRowsInput>) =>
      buildRows(baseInput(input)).rows.find((r) => r.kind === "header" && r.id === "h-assets");
    const withTotal = header({ total: 500 });
    const withoutTotal = header({ total: 0 });
    expect(withTotal?.kind === "header" && withTotal.count).toBe(500);
    expect(withoutTotal?.kind === "header" && withoutTotal.count).toBe(60);
  });
});
