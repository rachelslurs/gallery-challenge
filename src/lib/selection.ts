/**
 * Pure selection logic, kept out of the hook and the component so it can be
 * tested without a DOM.
 *
 * Everything here was extracted after hand-testing surfaced two defects that
 * unit tests would have caught: a stale marquee flag swallowing the next click,
 * and a section header being mistaken for background and clearing the
 * selection. Those decisions now live in `resolveClick`.
 */

export interface ClickModifiers {
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

export interface ClickContext {
  /** A marquee moved during this gesture, so the trailing click is its own. */
  marqueeMoved: boolean;
  /** The click landed on a control (section header, menu trigger). */
  onControl: boolean;
  /** Asset the click landed on, or null for background. */
  assetId: string | null;
  modifiers: ClickModifiers;
}

export type ClickIntent =
  | { kind: "ignore" }
  | { kind: "clear" }
  | { kind: "replace"; id: string }
  | { kind: "toggle"; id: string }
  | { kind: "extend"; id: string };

/**
 * What a click on the wall should do. Order matters: the marquee's own trailing
 * click is discarded first, then controls are exempted, and only then is a
 * click with no asset under it treated as "clear".
 */
export const resolveClick = ({
  marqueeMoved,
  onControl,
  assetId,
  modifiers,
}: ClickContext): ClickIntent => {
  if (marqueeMoved) return { kind: "ignore" };
  if (onControl) return { kind: "ignore" };
  if (assetId === null) return { kind: "clear" };
  if (modifiers.shiftKey) return { kind: "extend", id: assetId };
  if (modifiers.metaKey || modifiers.ctrlKey) return { kind: "toggle", id: assetId };
  return { kind: "replace", id: assetId };
};

/** Ids between two anchors inclusive, in list order, regardless of drag direction. */
export const rangeBetween = (
  orderedIds: readonly string[],
  anchorId: string,
  targetId: string,
): string[] => {
  const from = orderedIds.indexOf(anchorId);
  const to = orderedIds.indexOf(targetId);
  if (from === -1 || to === -1) return [];
  return from <= to ? orderedIds.slice(from, to + 1) : orderedIds.slice(to, from + 1);
};

/** Add the id if absent, remove it if present. */
export const toggled = (selected: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(selected);
  if (!next.delete(id)) next.add(id);
  return next;
};

/**
 * Union the marquee's current hits with the snapshot taken when it began.
 *
 * Returns `previous` by reference when the result is unchanged. A marquee fires
 * on every animation frame, and most frames add nothing, so preserving identity
 * is what stops the whole wall re-rendering while the pointer moves through
 * empty space. The comparison is done on the built set rather than inferred
 * from sizes, because base and hits can overlap.
 */
export const mergeMarquee = (
  base: ReadonlySet<string>,
  hitIds: readonly string[],
  previous: ReadonlySet<string>,
): ReadonlySet<string> => {
  const next = new Set(base);
  for (const id of hitIds) next.add(id);

  if (next.size === previous.size) {
    // forEach rather than for..of: the starter pins target es5, where iterating
    // a Set needs downlevelIteration.
    let identical = true;
    next.forEach((id) => {
      if (!previous.has(id)) identical = false;
    });
    if (identical) return previous;
  }

  return next;
};
