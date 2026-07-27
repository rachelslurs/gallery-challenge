import type { Board } from "@/app/api/boards";
import { justify, type Cell } from "./justify";
import type { Asset } from "./useAssets";

/**
 * One flat, absolutely-positioned list describes the whole page: section
 * headers, the board grid, and the asset wall. Because every entry carries its
 * own `y` and `h`, windowing is a single binary search that does not care which
 * kind of row it lands on, and collapsing a section is a filter.
 */
export type VRow =
  | { kind: "header"; id: string; y: number; h: number; section: SectionId; title: string; count: number }
  | { kind: "boards"; id: string; y: number; h: number; index: number; boards: Board[]; cardWidth: number }
  | { kind: "assets"; id: string; y: number; h: number; index: number; cells: Cell<Asset>[] }
  | { kind: "status"; id: string; y: number; h: number; state: "loading" | "end" | "empty" };

export type SectionId = "boards" | "assets";

/** `Omit` over a union collapses it to the shared keys, so distribute it by hand. */
type Unpositioned<T> = T extends unknown ? Omit<T, "y"> : never;

export interface Metrics {
  targetHeight: number;
  maxHeight: number;
  gap: number;
  boardColumns: number;
  headerHeight: number;
}

/**
 * Layout constants by container width. Row height shrinks on narrow screens so
 * a phone still shows several rows at once instead of one image per screenful.
 */
export function metricsFor(width: number): Metrics {
  // Row height stays near 240 at every width rather than shrinking on small
  // screens, which is what the reference gallery does: a narrow viewport gets
  // fewer images per row, not smaller ones. Measured there at 247 / 226 / 244
  // for 1440 / 768 / 390.
  //
  // `gap` is the distance between cells. Each cell insets its image by 4px on
  // every side (see AssetCell), so the visible gap between two images is this
  // value plus 8: 16px from 480 up, 8px below it.
  //
  // maxHeight sits close to the target so rows stay visually even. The
  // reference varies by roughly a quarter either side of its target.
  // `targetHeight` is an input to the greedy fill, not the height rows come out
  // at. A row closes as soon as it overflows, so the fitted height is always at
  // or below the target and the median lands roughly 20% under it. These values
  // are therefore set about a quarter above the ~240px the reference gallery
  // actually renders.
  if (width < 480) {
    return { targetHeight: 230, maxHeight: 290, gap: 0, boardColumns: 2, headerHeight: 48 };
  }
  if (width < 768) {
    return { targetHeight: 240, maxHeight: 300, gap: 8, boardColumns: 3, headerHeight: 52 };
  }
  if (width < 1280) {
    return { targetHeight: 255, maxHeight: 320, gap: 8, boardColumns: 4, headerHeight: 56 };
  }
  return { targetHeight: 260, maxHeight: 325, gap: 8, boardColumns: 5, headerHeight: 56 };
}

/** Board cards are a uniform grid: a 4:3 thumbnail plus a fixed label strip. */
export function boardCardHeight(cardWidth: number): number {
  return Math.round(cardWidth * 0.72) + 44;
}

export interface BuildRowsInput {
  boards: Board[];
  assets: Asset[];
  containerWidth: number;
  metrics: Metrics;
  collapsed: Record<SectionId, boolean>;
  total: number;
  hasMore: boolean;
  loading: boolean;
}

export interface BuiltRows {
  rows: VRow[];
  height: number;
}

export function buildRows({
  boards,
  assets,
  containerWidth,
  metrics,
  collapsed,
  total,
  hasMore,
  loading,
}: BuildRowsInput): BuiltRows {
  const { gap, headerHeight, boardColumns, targetHeight, maxHeight } = metrics;
  const rows: VRow[] = [];
  let y = 0;

  const push = (row: Unpositioned<VRow>) => {
    rows.push({ ...row, y } as VRow);
    y += row.h + gap;
  };

  if (boards.length > 0) {
    push({ kind: "header", id: "h-boards", h: headerHeight, section: "boards", title: "Boards", count: boards.length });

    if (!collapsed.boards) {
      const columns = Math.max(1, boardColumns);
      const cardWidth = (containerWidth - gap * (columns - 1)) / columns;
      const cardHeight = boardCardHeight(cardWidth);
      for (let i = 0; i < boards.length; i += columns) {
        push({
          kind: "boards",
          id: `boards-${i}`,
          index: i / columns,
          h: cardHeight,
          boards: boards.slice(i, i + columns),
          cardWidth,
        });
      }
    }
  }

  push({
    kind: "header",
    id: "h-assets",
    h: headerHeight,
    section: "assets",
    title: "Assets",
    count: total || assets.length,
  });

  if (!collapsed.assets) {
    const justified = justify(assets, { containerWidth, targetHeight, gap, maxHeight });
    for (let i = 0; i < justified.length; i += 1) {
      const row = justified[i];
      // `justify` positions rows from zero; re-anchor them below the headers.
      const offset = y - row.y;
      push({
        kind: "assets",
        id: `assets-${i}`,
        index: i,
        h: row.h,
        cells: row.cells.map((cell) => ({ ...cell, y: cell.y + offset })),
      });
    }

    if (assets.length === 0 && !loading) {
      push({ kind: "status", id: "status-empty", h: 120, state: "empty" });
    } else if (hasMore) {
      push({ kind: "status", id: "status-loading", h: 96, state: "loading" });
    } else if (assets.length > 0) {
      push({ kind: "status", id: "status-end", h: 96, state: "end" });
    }
  }

  return { rows, height: Math.max(0, y - gap) };
}
