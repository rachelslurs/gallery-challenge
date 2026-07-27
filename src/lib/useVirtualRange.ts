"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { visibleRange, type Span } from "./geometry";

export interface VirtualRange {
  scrollRef: RefObject<HTMLDivElement>;
  range: [number, number];
  onScroll: () => void;
  recompute: () => void;
}

/**
 * Windowing over a precomputed row list.
 *
 * The scroll handler runs every frame but only calls `setState` when the
 * visible row range actually changes, so a continuous scroll re-renders once
 * per row boundary crossed rather than once per frame. That distinction is what
 * keeps the gallery responsive under a 6x CPU throttle.
 */
export const useVirtualRange = (rows: readonly Span[], overscan = 3): VirtualRange => {
  const [range, setRange] = useState<[number, number]>([0, 0]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  // Read through refs inside the scroll handler so it never needs re-binding.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const rangeRef = useRef(range);

  const recompute = useCallback((): void => {
    const element = scrollRef.current;
    if (!element) return;

    const next = visibleRange(rowsRef.current, element.scrollTop, element.clientHeight, overscan);
    const [currentStart, currentEnd] = rangeRef.current;
    if (next[0] === currentStart && next[1] === currentEnd) return;

    rangeRef.current = next;
    setRange(next);
  }, [overscan]);

  const onScroll = useCallback((): void => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      recompute();
    });
  }, [recompute]);

  // Rows change on resize, collapse, reorder, and every loaded page. Recompute
  // before paint so the window never renders a stale slice.
  useLayoutEffect(() => {
    recompute();
  }, [rows, recompute]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return { scrollRef, range, onScroll, recompute };
};

export interface ContainerWidth<T extends HTMLElement> {
  ref: RefObject<T>;
  width: number;
}

/** Container width, tracked with a ResizeObserver and rounded to whole pixels. */
export const useContainerWidth = <T extends HTMLElement>(): ContainerWidth<T> => {
  const [width, setWidth] = useState(0);

  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0].contentRect.width);
      // Sub-pixel jitter would otherwise rebuild the entire layout mid-resize.
      setWidth((previous) => (Math.abs(previous - next) >= 1 ? next : previous));
    });

    observer.observe(element);
    setWidth(Math.floor(element.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return { ref, width };
};
