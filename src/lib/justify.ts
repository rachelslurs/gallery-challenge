/**
 * Justified-rows layout, the Flickr/Google Photos wall.
 *
 * Every clip from the API carries its intrinsic width and height, so the entire
 * layout is arithmetic. Nothing here reads the DOM, which is what keeps the
 * gallery cheap at 500+ items: no measure pass, no reflow, no layout thrash.
 */

export interface Sized {
  width: number;
  height: number;
}

export interface Cell<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface JustifiedRow<T> {
  y: number;
  h: number;
  cells: Cell<T>[];
}

export interface JustifyOptions {
  containerWidth: number;
  targetHeight: number;
  gap: number;
  /**
   * Ceiling on row height. The lookback below can otherwise close a row early
   * and leave one or two portrait images filling the whole viewport, which is
   * most visible at 320px where a row would run taller than it is wide.
   */
  maxHeight?: number;
}

/** Aspect ratio, guarded against the zero and NaN dimensions the API occasionally returns. */
function aspectOf(item: Sized): number {
  const { width, height } = item;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }
  return width / height;
}

/**
 * Lay items out into rows that fill `containerWidth` exactly.
 *
 * Greedy with one step of lookback: when adding an item overflows the row, we
 * keep whichever of the two candidate rows lands closer to `targetHeight`.
 * Without the lookback a single panorama drags its whole row far below target.
 *
 * Runs in O(n) and allocates one Cell per item.
 */
export function justify<T extends Sized>(
  items: readonly T[],
  { containerWidth, targetHeight, gap, maxHeight }: JustifyOptions,
): JustifiedRow<T>[] {
  const rows: JustifiedRow<T>[] = [];
  if (containerWidth <= 0 || items.length === 0) return rows;

  const ceiling = maxHeight ?? targetHeight * 1.5;

  let y = 0;
  let start = 0;
  let sumAspect = 0;

  /** Height this run of items needs so that it exactly spans the container. */
  const fittedHeight = (count: number, aspects: number) => {
    const gaps = gap * Math.max(0, count - 1);
    return aspects > 0 ? (containerWidth - gaps) / aspects : targetHeight;
  };

  const emit = (end: number, height: number) => {
    const cells: Cell<T>[] = [];
    let x = 0;
    for (let i = start; i < end; i += 1) {
      const item = items[i];
      // Derive width from the row height so every cell in a row shares an edge.
      const w = aspectOf(item) * height;
      cells.push({ item, x, y, w, h: height });
      x += w + gap;
    }
    rows.push({ y, h: height, cells });
    y += height + gap;
    start = end;
    sumAspect = 0;
  };

  for (let i = 0; i < items.length; i += 1) {
    const aspect = aspectOf(items[i]);
    const withAspect = sumAspect + aspect;
    const count = i - start + 1;
    const naturalWidth = withAspect * targetHeight + gap * (count - 1);

    if (naturalWidth < containerWidth) {
      sumAspect = withAspect;
      continue;
    }

    // The row is full. Decide whether this item belongs to it.
    const heightWith = fittedHeight(count, withAspect);
    const heightWithout = fittedHeight(count - 1, sumAspect);
    const takeItem =
      count === 1 ||
      heightWithout > ceiling ||
      Math.abs(heightWith - targetHeight) <= Math.abs(heightWithout - targetHeight);

    if (takeItem) {
      emit(i + 1, heightWith);
    } else {
      emit(i, heightWithout);
      sumAspect = aspect;
    }
  }

  // Trailing items never reached full width. Left-align them at target height
  // rather than stretching a lone image across the viewport, but never let the
  // row exceed the container: the lookback above can reject a very wide item
  // from the previous row and leave it stranded here, where at targetHeight a
  // 16:1 panorama renders 2112px wide inside a 320px column.
  if (start < items.length) {
    const fitted = fittedHeight(items.length - start, sumAspect);
    emit(items.length, Math.min(targetHeight, fitted));
  }

  return rows;
}

/** Total scrollable height of a row list, ignoring the trailing gap. */
export function rowsHeight<T>(rows: readonly JustifiedRow<T>[], gap: number): number {
  if (rows.length === 0) return 0;
  const last = rows[rows.length - 1];
  return last.y + last.h + gap;
}
