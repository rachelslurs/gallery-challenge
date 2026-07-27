/**
 * Binary searches and rectangle math over a precomputed layout.
 *
 * Two features share every function here: windowing asks "which rows are on
 * screen", and marquee selection asks "which cells are under this box". Both
 * are answered from the geometry array, so neither touches the DOM.
 */

import type { Cell, JustifiedRow } from "./justify";

export interface Span {
  y: number;
  h: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Index of the first row whose bottom edge falls past `edge`.
 * Rows are sorted and non-overlapping, so this is a plain lower bound.
 */
export function firstRowBelow(rows: readonly Span[], edge: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].y + rows[mid].h <= edge) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index of the first row that starts at or past `edge`, usable as an exclusive end. */
export function firstRowAtOrBelow(rows: readonly Span[], edge: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].y < edge) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Half-open range of rows intersecting the viewport, padded by `overscan` rows. */
export function visibleRange(
  rows: readonly Span[],
  scrollTop: number,
  viewportHeight: number,
  overscan: number,
): [number, number] {
  if (rows.length === 0) return [0, 0];
  const start = firstRowBelow(rows, scrollTop);
  const end = firstRowAtOrBelow(rows, scrollTop + viewportHeight);
  return [Math.max(0, start - overscan), Math.min(rows.length, end + overscan)];
}

function overlaps(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && bMin < aMax;
}

/**
 * Cells intersecting `box`, where `box` is in content coordinates.
 *
 * Costs O(log n + k) for k hit rows: binary search to the first candidate row,
 * then walk rows until we pass the bottom of the box. Cell counts per row are
 * small enough that scanning a row linearly beats another binary search.
 */
export function cellsInBox<T>(
  rows: readonly JustifiedRow<T>[],
  box: Rect,
): Cell<T>[] {
  const top = box.top;
  const bottom = box.top + box.height;
  const left = box.left;
  const right = box.left + box.width;

  const hits: Cell<T>[] = [];
  for (let i = firstRowBelow(rows, top); i < rows.length; i += 1) {
    const row = rows[i];
    if (row.y >= bottom) break;
    for (const cell of row.cells) {
      if (
        overlaps(cell.x, cell.x + cell.w, left, right) &&
        overlaps(cell.y, cell.y + cell.h, top, bottom)
      ) {
        hits.push(cell);
      }
    }
  }
  return hits;
}

/**
 * Convert a box in viewport coordinates into the content element's coordinate
 * space, so it can be compared against layout geometry directly.
 *
 * No scroll offset is applied on purpose. `originRect` is expected to come from
 * a live `getBoundingClientRect()`, which already moves with the scroll
 * container, so adding scrollTop would double-count it.
 */
export function toContentRect(box: Rect, originRect: { left: number; top: number }): Rect {
  return {
    left: box.left - originRect.left,
    top: box.top - originRect.top,
    width: box.width,
    height: box.height,
  };
}
