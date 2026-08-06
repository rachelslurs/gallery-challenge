/**
 * Dropping assets from the loaded list.
 *
 * Removal is local by necessity, since the endpoints are read-only. The section
 * header reports the board's total, which arrives from the API, so anything
 * that removes an asset has to move that number too. Without it the header goes
 * on reporting whatever the server last knew: remove nine of 761 and it still
 * reads 761.
 */

export interface Identified {
  id: string;
}

export interface Removal<T> {
  items: T[];
  total: number;
}

/**
 * Remove `ids`, and decrement `total` by however many actually left.
 *
 * Decrementing by `ids.length` would be wrong. An id that is not in the list
 * has to leave the count alone, which is what makes the two numbers stay in
 * agreement after a stale selection or a double drop.
 *
 * Returns `items` by reference when nothing matched, so a removal that removes
 * nothing cannot re-render the wall.
 */
export const removeByIds = <T extends Identified>(
  items: T[],
  total: number,
  ids: readonly string[],
): Removal<T> => {
  if (ids.length === 0) return { items, total };

  const removing = new Set(ids);
  const kept = items.filter((item) => !removing.has(item.id));
  const removed = items.length - kept.length;
  if (removed === 0) return { items, total };

  return { items: kept, total: Math.max(0, total - removed) };
};
