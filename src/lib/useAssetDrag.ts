"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { dropTargetAt, type DropTarget, type Positioned } from "./reorder";

/** Travel before a press becomes a drag, so a plain click still selects. */
const DRAG_THRESHOLD_PX = 5;

interface ArmedDrag {
  kind: "assets" | "board";
  ids: string[];
  startX: number;
  startY: number;
  active: boolean;
}

export interface UseAssetDragOptions {
  /** The element asset cell coordinates are relative to. */
  contentRef: RefObject<HTMLElement>;
  /** Current asset order, which is what a reorder rewrites. */
  orderedIds: readonly string[];
  /** Flat asset geometry, in the same coordinates as `contentRef`. */
  cells: readonly Positioned[];
  /** Everything selected, of either kind. */
  selected: ReadonlySet<string>;
  onReorder: (movingIds: readonly string[], insertIndex: number) => void;
  onDropOnBoard: (boardId: string, movingIds: readonly string[]) => void;
  /** A board was dropped on a board, which is not a thing that can happen. */
  onRefused: () => void;
  /** A completed drag ends in a click that must not be read as a selection. */
  onGestureCommitted: () => void;
}

export interface AssetDrag {
  /** Attach to the wall. Arms a drag when the press lands on a selected item. */
  onMouseDown: (event: MouseEvent<HTMLElement>) => void;
  /** Where a drop would insert, or null when there is no insertion point. */
  dropTarget: DropTarget | null;
  /** The board under the pointer during a drag. */
  hoverBoardId: string | null;
  /** What is being dragged, or null when nothing is. */
  kind: "assets" | "board" | null;
}

/**
 * Drag to reorder assets, and drag them onto a board.
 *
 * Which gesture a press begins is decided by selection rather than by target:
 * pressing an already-selected item drags it, pressing anything else is left
 * for the marquee. A card cannot own pointer-down outright because a marquee
 * can start anywhere, matching the reference gallery.
 *
 * Movement and release are tracked on the window so a gesture survives the
 * pointer leaving the wall. Pointer position stays in refs and only the drop
 * target is state: re-rendering once per target change rather than once per
 * pointer move is what keeps this cheap with tiles mounted.
 */
export const useAssetDrag = ({
  contentRef,
  orderedIds,
  cells,
  selected,
  onReorder,
  onDropOnBoard,
  onRefused,
  onGestureCommitted,
}: UseAssetDragOptions): AssetDrag => {
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [hoverBoardId, setHoverBoardId] = useState<string | null>(null);
  const [kind, setKind] = useState<"assets" | "board" | null>(null);

  const dragRef = useRef<ArmedDrag | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const hoverBoardRef = useRef<string | null>(null);

  // Mirrored so the window listeners never need rebinding as data arrives.
  const orderedIdsRef = useRef(orderedIds);
  orderedIdsRef.current = orderedIds;
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const handlersRef = useRef({ onReorder, onDropOnBoard, onRefused, onGestureCommitted });
  handlersRef.current = { onReorder, onDropOnBoard, onRefused, onGestureCommitted };

  const reset = useCallback((): void => {
    dragRef.current = null;
    dropTargetRef.current = null;
    hoverBoardRef.current = null;
    setKind(null);
    setDropTarget(null);
    setHoverBoardId(null);
  }, []);

  const onMouseDown = useCallback(
    (event: MouseEvent<HTMLElement>): void => {
      // Secondary buttons open the context menu. Without this they also armed a
      // drag, so a right-drag committed a reorder behind the open menu.
      if (event.button !== 0) {
        dragRef.current = null;
        setKind(null);
        return;
      }
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-menu-trigger]")) return;

      const boardId = event.target.closest<HTMLElement>("[data-board-id]")?.dataset.boardId;
      if (boardId && selectedRef.current.has(boardId)) {
        // Armed only so the gesture can be refused visibly. Silently doing
        // nothing reads as broken rather than as disallowed.
        dragRef.current = { kind: "board", ids: [], startX: event.clientX, startY: event.clientY, active: false };
        setKind("board");
        return;
      }

      const id = event.target.closest<HTMLElement>("[data-asset-id]")?.dataset.assetId;
      if (!id || !selectedRef.current.has(id)) return;

      const assets = new Set(orderedIdsRef.current);
      setKind("assets");
      dragRef.current = {
        kind: "assets",
        // Boards can be selected but not dragged, so a mixed selection moves
        // only its assets.
        ids: Array.from(selectedRef.current).filter((selectedId) => assets.has(selectedId)),
        startX: event.clientX,
        startY: event.clientY,
        active: false,
      };
    },
    [],
  );

  useEffect(() => {
    let frame = 0;
    let pending: { x: number; y: number; buttons: number } | null = null;

    const process = (): void => {
      frame = 0;
      const point = pending;
      pending = null;
      if (point === null) return;

      const drag = dragRef.current;
      const content = contentRef.current;
      if (!drag || !content) return;

      // The button was released somewhere this window never saw. Abandon the
      // gesture rather than letting plain movement resume it.
      if ((point.buttons & 1) === 0) {
        reset();
        return;
      }

      if (!drag.active) {
        if (Math.hypot(point.x - drag.startX, point.y - drag.startY) < DRAG_THRESHOLD_PX) return;
        drag.active = true;
      }

      const boardId =
        document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-board-id]")?.dataset
          .boardId ?? null;
      if (boardId !== hoverBoardRef.current) {
        hoverBoardRef.current = boardId;
        setHoverBoardId(boardId);
      }

      // A board under the pointer takes precedence: dropping onto one moves the
      // assets there, so an insertion point would be misleading.
      if (drag.kind === "board" || boardId !== null) {
        if (dropTargetRef.current) {
          dropTargetRef.current = null;
          setDropTarget(null);
        }
        return;
      }

      const origin = content.getBoundingClientRect();
      const next = dropTargetAt(
        orderedIdsRef.current,
        cellsRef.current,
        point.x - origin.left,
        point.y - origin.top,
      );
      const current = dropTargetRef.current;
      if (current?.id === next?.id && current?.side === next?.side) return;
      dropTargetRef.current = next;
      setDropTarget(next);
    };

    // Raw mousemove outruns paint, and each event would otherwise cost a forced
    // hit-test plus a scan of every cell. One frame, one evaluation.
    const onMove = (event: globalThis.MouseEvent): void => {
      if (!dragRef.current) return;
      pending = { x: event.clientX, y: event.clientY, buttons: event.buttons };
      if (frame) return;
      frame = requestAnimationFrame(process);
    };

    const onUp = (): void => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;

      const drag = dragRef.current;
      const target = dropTargetRef.current;
      const boardId = hoverBoardRef.current;
      reset();
      if (!drag?.active) return;

      const { onReorder: reorder, onDropOnBoard: dropOnBoard, onRefused: refused, onGestureCommitted: committed } =
        handlersRef.current;

      if (drag.kind === "board") {
        if (boardId) refused();
        committed();
        return;
      }
      if (boardId) {
        dropOnBoard(boardId, drag.ids);
        committed();
        return;
      }
      if (target) reorder(drag.ids, target.index);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [contentRef, reset]);

  return { onMouseDown, dropTarget, hoverBoardId, kind };
};
