"use client";

import { useCallback, useMemo, useRef, useState } from "react";

const EMPTY: ReadonlySet<string> = new Set<string>();

export interface UseSelectionResult {
  selected: ReadonlySet<string>;
  count: number;
  selectOnly: (id: string) => void;
  toggle: (id: string) => void;
  extendTo: (id: string) => void;
  selectAll: () => void;
  clear: () => void;
  /** Snapshot the current selection so a marquee can add to it. */
  beginMarquee: (additive: boolean) => void;
  /** Replace the marquee's contribution, preserving the snapshot underneath. */
  applyMarquee: (ids: readonly string[]) => void;
}

/**
 * Selection state for the asset wall.
 *
 * Held as a `Set` of ids rather than a flag on each asset so that marquee
 * updates touch one piece of state instead of rewriting the asset array. Cells
 * receive a boolean and are memoized on it, so a marquee sweep re-renders only
 * the tiles whose membership actually changed.
 */
export const useSelection = (orderedIds: readonly string[]): UseSelectionResult => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(EMPTY);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    orderedIds.forEach((id, index) => map.set(id, index));
    return map;
  }, [orderedIds]);

  // Anchor for shift-extend, and the pre-marquee snapshot to union against.
  const anchorRef = useRef<string | null>(null);
  const marqueeBaseRef = useRef<ReadonlySet<string>>(EMPTY);

  const selectOnly = useCallback((id: string): void => {
    anchorRef.current = id;
    setSelected(new Set([id]));
  }, []);

  const toggle = useCallback((id: string): void => {
    anchorRef.current = id;
    setSelected((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const extendTo = useCallback(
    (id: string): void => {
      const anchor = anchorRef.current;
      if (anchor === null) {
        anchorRef.current = id;
        setSelected(new Set([id]));
        return;
      }

      const from = indexById.get(anchor);
      const to = indexById.get(id);
      if (from === undefined || to === undefined) return;

      const [low, high] = from <= to ? [from, to] : [to, from];
      setSelected(new Set(orderedIds.slice(low, high + 1)));
    },
    [indexById, orderedIds],
  );

  const selectAll = useCallback((): void => {
    setSelected(new Set(orderedIds));
  }, [orderedIds]);

  const clear = useCallback((): void => {
    anchorRef.current = null;
    setSelected((previous) => (previous.size === 0 ? previous : EMPTY));
  }, []);

  const beginMarquee = useCallback(
    (additive: boolean): void => {
      marqueeBaseRef.current = additive ? selected : EMPTY;
      if (!additive) setSelected((previous) => (previous.size === 0 ? previous : EMPTY));
    },
    [selected],
  );

  const applyMarquee = useCallback((ids: readonly string[]): void => {
    const base = marqueeBaseRef.current;
    setSelected((previous) => {
      // Bail out before allocating if nothing changed, so a marquee dragged
      // across empty space does not re-render the wall on every frame.
      if (previous.size === base.size + ids.length) {
        let identical = true;
        for (const id of ids) {
          if (!previous.has(id)) {
            identical = false;
            break;
          }
        }
        if (identical) return previous;
      }

      const next = new Set(base);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  return {
    selected,
    count: selected.size,
    selectOnly,
    toggle,
    extendTo,
    selectAll,
    clear,
    beginMarquee,
    applyMarquee,
  };
};
