/**
 * Pure logic for drag-to-reorder and drag-into-a-board, kept free of React and
 * the DOM so the pointer wiring stays thin and this can be tested directly.
 */

export interface Positioned {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a drop would land relative to the cell under the pointer. */
export type DropSide = "before" | "after";

export interface DropTarget {
  id: string;
  side: DropSide;
  /** Index into the ordered id list where the moved items should be inserted. */
  index: number;
}

/**
 * Containment is half-open: left and top edges belong to the cell, right and
 * bottom to its neighbour, so two adjacent cells never both claim a shared
 * edge point.
 */
export const cellAtPoint = (
  cells: readonly Positioned[],
  x: number,
  y: number,
): Positioned | null => {
  for (const cell of cells) {
    if (x >= cell.x && x < cell.x + cell.w && y >= cell.y && y < cell.y + cell.h) {
      return cell;
    }
  }
  return null;
};

/**
 * The before test is a strict `<` against the midpoint, so a pointer exactly
 * on the midline always resolves to "after" rather than flickering between
 * sides at the boundary.
 */
export const dropTargetAt = (
  orderedIds: readonly string[],
  cells: readonly Positioned[],
  x: number,
  y: number,
): DropTarget | null => {
  const cell = cellAtPoint(cells, x, y);
  if (cell === null) return null;

  const cellIndex = orderedIds.indexOf(cell.id);
  // A cell missing from the order list has no insertion point, so the drop
  // behaves like a miss.
  if (cellIndex === -1) return null;

  return x < cell.x + cell.w / 2
    ? { id: cell.id, side: "before", index: cellIndex }
    : { id: cell.id, side: "after", index: cellIndex + 1 };
};

/**
 * Move the ids in `movingIds` so they sit contiguously at `insertIndex`,
 * keeping their relative order from `orderedIds` and the order of everything
 * else. `insertIndex` addresses the ORIGINAL array; once the moving items are
 * pulled out, the slot shifts left by however many of them sat before it, and
 * that shift is applied here so callers can pass the index straight from
 * `dropTargetAt`.
 */
export const moveItems = (
  orderedIds: readonly string[],
  movingIds: readonly string[],
  insertIndex: number,
): string[] => {
  const present = new Set(orderedIds);
  // Building the set from movingIds handles duplicates once; the presence
  // check drops ids that are not in the order at all.
  const moving = new Set<string>();
  for (const id of movingIds) {
    if (present.has(id)) moving.add(id);
  }
  if (moving.size === 0) return orderedIds.slice();

  const clamped = Math.max(0, Math.min(insertIndex, orderedIds.length));

  const moved: string[] = [];
  const rest: string[] = [];
  let removedBefore = 0;
  orderedIds.forEach((id, i) => {
    if (moving.has(id)) {
      moved.push(id);
      if (i < clamped) removedBefore += 1;
    } else {
      rest.push(id);
    }
  });

  const slot = clamped - removedBefore;
  return rest.slice(0, slot).concat(moved, rest.slice(slot));
};

/** For dropping assets onto a board: the order without those ids. */
export const removeItems = (
  orderedIds: readonly string[],
  removingIds: readonly string[],
): string[] => {
  const removing = new Set(removingIds);
  return orderedIds.filter((id) => !removing.has(id));
};
