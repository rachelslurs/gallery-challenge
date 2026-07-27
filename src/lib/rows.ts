import type { Board } from "@/app/api/boards";
import { COPY } from "./copy";
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
  /** Height of the section label row itself, snug to the text. */
  headerHeight: number;
  /** Space below a section label before its first row of content. */
  headerGap: number;
  /** Space above a section label when content precedes it. */
  sectionGap: number;
  /** Board cards use their own gap and a fixed height, unlike the asset wall. */
  boardGap: number;
  boardCardHeight: number;
}

/**
 * Board grid, matching the reference: columns are filled to a minimum width
 * rather than divided evenly, so four boards on a wide screen sit at their
 * natural size and left-align instead of stretching across the viewport. Card
 * height is fixed, so a card is wider than tall on a tablet and taller than
 * wide on a desktop.
 */
const BOARD_MIN_WIDTH = 184;

const boardGridFor = (width: number): { boardGap: number; boardColumns: number; boardCardHeight: number } => {
  if (width < 480) return { boardGap: 8, boardColumns: 2, boardCardHeight: 160 };
  const boardGap = 16;
  return {
    boardGap,
    boardColumns: Math.max(1, Math.floor((width + boardGap) / (BOARD_MIN_WIDTH + boardGap))),
    boardCardHeight: 196,
  };
};

/**
 * Vertical rhythm around section labels, measured from the reference gallery at
 * 1440px: 15px beneath a label and 39px above the next one, measured from image
 * edge to label. SECTION_GAP is smaller than 39 because a board card carries a
 * title strip beneath its thumbnail that already contributes vertical space. The
 * asymmetry is what groups a label with the content it introduces rather than
 * leaving it floating between two sections.
 */
const HEADER_GAP = 15;
const SECTION_GAP = 20;

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
    return { targetHeight: 230, maxHeight: 290, gap: 0, headerHeight: 30, headerGap: HEADER_GAP, sectionGap: SECTION_GAP, ...boardGridFor(width) };
  }
  if (width < 768) {
    return { targetHeight: 240, maxHeight: 300, gap: 8, headerHeight: 30, headerGap: HEADER_GAP, sectionGap: SECTION_GAP, ...boardGridFor(width) };
  }
  if (width < 1280) {
    return { targetHeight: 255, maxHeight: 320, gap: 8, headerHeight: 30, headerGap: HEADER_GAP, sectionGap: SECTION_GAP, ...boardGridFor(width) };
  }
  return { targetHeight: 260, maxHeight: 325, gap: 8, headerHeight: 30, headerGap: HEADER_GAP, sectionGap: SECTION_GAP, ...boardGridFor(width) };
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
  const { gap, headerHeight, headerGap, sectionGap, boardColumns, boardGap, boardCardHeight, targetHeight, maxHeight } = metrics;
  const rows: VRow[] = [];
  let y = 0;

  // Spacing is a property of the transition, not of the row: a label sits close
  // to the content it introduces and far from whatever precedes it.
  const push = (row: Unpositioned<VRow>, spacingAfter: number = gap) => {
    rows.push({ ...row, y } as VRow);
    y += row.h + spacingAfter;
  };

  if (boards.length > 0) {
    push(
      { kind: "header", id: "h-boards", h: headerHeight, section: "boards", title: COPY.boardsSection, count: boards.length },
      collapsed.boards ? sectionGap : headerGap,
    );

    if (!collapsed.boards) {
      const columns = Math.max(1, boardColumns);
      const cardWidth = (containerWidth - boardGap * (columns - 1)) / columns;
      for (let i = 0; i < boards.length; i += columns) {
        push({
          kind: "boards",
          id: `boards-${i}`,
          index: i / columns,
          h: boardCardHeight,
          boards: boards.slice(i, i + columns),
          cardWidth,
        });
      }
      // The final board row is followed by a section break, not a row gap.
      y += sectionGap - gap;
    }
  }

  push(
    {
      kind: "header",
      id: "h-assets",
      h: headerHeight,
      section: "assets",
      title: COPY.assetsSection,
      count: total || assets.length,
    },
    headerGap,
  );

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
