/**
 * What a menu names, and what it acts on.
 *
 * Boards and assets share one selection set, so "how many are selected" is the
 * wrong question for a menu: an asset menu can only ever act on assets. Deriving
 * the count and the id list together, from one function, is what stops the label
 * promising more than the action delivers.
 *
 * The bug this exists for: with four boards and nine assets selected, an asset
 * menu read "Remove 13 assets from board" and removed nine, and Download passed
 * the four board ids to a URL builder that happily returned board page links.
 */

export type MenuKind = "asset" | "board";

export interface MenuScope {
  /** How many items the menu should name. */
  count: number;
  /** The ids it acts on, always of the target's own kind. */
  ids: string[];
}

/**
 * Scope a menu to its target.
 *
 * A target outside the selection scopes to itself alone, which is what every
 * file manager does with a right click on an unselected item. A target inside
 * the selection scopes to everything selected of the same kind.
 */
export const menuScope = (
  kind: MenuKind,
  id: string,
  selected: ReadonlySet<string>,
  assetIds: ReadonlySet<string>,
): MenuScope => {
  if (!selected.has(id)) return { count: 1, ids: [id] };

  const ids: string[] = [];
  // forEach rather than for..of: the starter pins target es5, where iterating a
  // Set needs downlevelIteration.
  selected.forEach((candidate) => {
    if (assetIds.has(candidate) === (kind === "asset")) ids.push(candidate);
  });

  // The target is in the selection, so it is always in `ids`. Guarding anyway
  // keeps a caller that passes a stale asset list from producing an empty menu.
  if (ids.length === 0) return { count: 1, ids: [id] };

  return { count: ids.length, ids };
};
