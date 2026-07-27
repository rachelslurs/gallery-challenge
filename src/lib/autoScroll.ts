"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

export interface AutoScrollBounds {
  top: number;
  bottom: number;
}

export interface AutoScrollOptions {
  /** Distance in px from an edge where scrolling begins. Default 72. */
  edgeSize?: number;
  /** Max scroll speed in px per second at the very edge. Default 1200. */
  maxSpeed?: number;
}

const DEFAULT_EDGE_SIZE = 72;
const DEFAULT_MAX_SPEED = 1200;

/**
 * Signed scroll velocity in px/sec for a pointer at `pointerY`.
 * Negative scrolls up, positive down, 0 when outside both edge zones.
 */
export const scrollVelocity = (
  pointerY: number,
  bounds: AutoScrollBounds,
  options?: AutoScrollOptions,
): number => {
  const edgeSize = options?.edgeSize ?? DEFAULT_EDGE_SIZE;
  const maxSpeed = options?.maxSpeed ?? DEFAULT_MAX_SPEED;

  const topDistance = pointerY - bounds.top;
  const bottomDistance = bounds.bottom - pointerY;

  // The nearer edge wins, so a container shorter than 2 * edgeSize resolves
  // to a single direction instead of the two zones fighting.
  const scrollingUp = topDistance <= bottomDistance;
  const distance = scrollingUp ? topDistance : bottomDistance;
  if (distance >= edgeSize) return 0;

  // A pointer past the edge has a negative distance; cap the ratio there so
  // the magnitude never exceeds maxSpeed.
  const ratio = Math.min(1, 1 - distance / edgeSize);
  // Squaring keeps the ramp shallow near the zone boundary, where precise
  // selection matters, while still reaching full speed at the edge.
  const speed = maxSpeed * ratio * ratio;
  return scrollingUp ? -speed : speed;
};

export interface AutoScroller {
  /** Call with the pointer's clientY on every drag move. */
  update: (pointerY: number) => void;
  /** Stop scrolling and cancel any pending frame. */
  stop: () => void;
}

/**
 * Edge auto-scroll for a marquee drag inside a scrollable container.
 *
 * Each frame scales the scroll step by the real elapsed time since the
 * previous frame, so the px/sec speed holds at any frame rate.
 */
export const useAutoScroll = (
  scrollRef: RefObject<HTMLElement>,
  options?: AutoScrollOptions,
): AutoScroller => {
  const pointerYRef = useRef(0);
  const frameRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  // Read inside the frame loop through a ref so a new options object does not
  // force the loop callbacks to re-bind mid-drag.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stop = useCallback((): void => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
  }, []);

  const step = useCallback(
    (time: number): void => {
      frameRef.current = 0;
      const element = scrollRef.current;
      if (!element) return;

      // The container's rect moves if the page scrolls or layout shifts
      // mid-drag, so read it fresh each frame.
      const rect = element.getBoundingClientRect();
      const velocity = scrollVelocity(
        pointerYRef.current,
        { top: rect.top, bottom: rect.bottom },
        optionsRef.current,
      );
      if (velocity === 0) return;

      // Parking at the scroll limit stops burning frames while the pointer
      // rests at an edge; the next update restarts the loop.
      const maxScrollTop = element.scrollHeight - element.clientHeight;
      const blocked = velocity < 0 ? element.scrollTop <= 0 : element.scrollTop >= maxScrollTop;
      if (blocked) return;

      const deltaSeconds = (time - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = time;
      element.scrollTop += velocity * deltaSeconds;

      frameRef.current = requestAnimationFrame(step);
    },
    [scrollRef],
  );

  const update = useCallback(
    (pointerY: number): void => {
      pointerYRef.current = pointerY;
      const element = scrollRef.current;
      if (!element) {
        stop();
        return;
      }

      const rect = element.getBoundingClientRect();
      const velocity = scrollVelocity(
        pointerY,
        { top: rect.top, bottom: rect.bottom },
        optionsRef.current,
      );
      if (velocity === 0) {
        stop();
        return;
      }
      if (frameRef.current) return;

      // Seed the clock so the first frame's delta spans one frame rather than
      // the idle time since the previous drag.
      lastFrameTimeRef.current = performance.now();
      frameRef.current = requestAnimationFrame(step);
    },
    [scrollRef, step, stop],
  );

  useEffect(() => stop, [stop]);

  return { update, stop };
};
