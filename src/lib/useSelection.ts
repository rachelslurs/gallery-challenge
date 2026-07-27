"use client";

import { useCallback, useRef, useState } from "react";
import { mergeMarquee, rangeBetween, toggled } from "./selection";

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
 * Held as a Set of ids rather than a flag on each asset, so a marquee update
 * touches one piece of state instead of rewriting the asset array. Cells take a
 * boolean and are memoized on it, so a sweep re-renders only the tiles whose
 * membership changed.
 *
 * The decisions themselves live in `selection.ts` as pure functions; this hook
 * only owns the React state and the shift-anchor.
 */
export const useSelection = (orderedIds: readonly string[]): UseSelectionResult => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(EMPTY);

  // Anchor for shift-extend, and the pre-marquee snapshot to union against.
  const anchorRef = useRef<string | null>(null);
  const marqueeBaseRef = useRef<ReadonlySet<string>>(EMPTY);

  const selectOnly = useCallback((id: string): void => {
    anchorRef.current = id;
    setSelected(new Set([id]));
  }, []);

  const toggle = useCallback((id: string): void => {
    anchorRef.current = id;
    setSelected((previous) => toggled(previous, id));
  }, []);

  const extendTo = useCallback(
    (id: string): void => {
      const anchor = anchorRef.current;
      if (anchor === null) {
        anchorRef.current = id;
        setSelected(new Set([id]));
        return;
      }

      const range = rangeBetween(orderedIds, anchor, id);
      if (range.length > 0) setSelected(new Set(range));
    },
    [orderedIds],
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
    setSelected((previous) => mergeMarquee(marqueeBaseRef.current, ids, previous));
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
