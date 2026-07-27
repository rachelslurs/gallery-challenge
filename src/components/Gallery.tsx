"use client";

import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSelectionContainer, type Box } from "@air/react-drag-to-select";
import { boardUrl, type Board } from "@/app/api/boards";
import { COPY } from "@/lib/copy";
import { cellsInBox, toContentRect } from "@/lib/geometry";
import { moveItems, type Positioned } from "@/lib/reorder";
import { resolveClick } from "@/lib/selection";
import { buildRows, metricsFor, type SectionId, type VRow } from "@/lib/rows";
import { useAssets, type Asset } from "@/lib/useAssets";
import { useAssetDrag } from "@/lib/useAssetDrag";
import { useSelection } from "@/lib/useSelection";
import { useContainerWidth, useVirtualRange } from "@/lib/useVirtualRange";
import AssetCell from "./AssetCell";
import BoardCard from "./BoardCard";
import GalleryMenu, { type MenuAction, type MenuTarget } from "./GalleryMenu";
import SectionHeader from "./SectionHeader";
import SelectionBar from "./SelectionBar";

const OVERSCAN = 3;
/** How long a move stays undoable before the offer withdraws itself. */
const UNDO_WINDOW_MS = 8000;
/** Start the next page once the window is this many rows from the end. */
const PREFETCH_ROWS = 4;
/**
 * Rows loaded eagerly at high priority because they are on screen at first
 * paint. Everything below stays lazy so the wall still costs almost nothing.
 */
const EAGER_ASSET_ROWS = 2;
const EAGER_BOARD_ROWS = 1;

type AssetRow = Extract<VRow, { kind: "assets" }>;
const isAssetRow = (row: VRow): row is AssetRow => row.kind === "assets";

const STATUS_COPY: Record<Extract<VRow, { kind: "status" }>["state"], string> = {
  loading: COPY.loadingMore,
  end: COPY.endOfBoard,
  empty: COPY.noAssets,
};

export interface GalleryProps {
  initialBoards: Board[];
  boardTitle: string;
}

const Gallery = ({ initialBoards, boardTitle }: GalleryProps) => {
  const [collapsed, setCollapsed] = useState<Record<SectionId, boolean>>({
    boards: false,
    assets: false,
  });
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  const { assets, total, hasMore, loading, error, loadMore, retry, setAssets } = useAssets();
  const { ref: contentRef, width } = useContainerWidth<HTMLDivElement>();

  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const { selected, count, selectOnly, toggle, extendTo, selectAll, clear, beginMarquee, applyMarquee } =
    useSelection(assetIds);

  const metrics = useMemo(() => metricsFor(width), [width]);
  const { rows, height } = useMemo(
    () =>
      buildRows({
        boards: initialBoards,
        assets,
        containerWidth: width,
        metrics,
        collapsed,
        total,
        hasMore,
        loading,
      }),
    [initialBoards, assets, width, metrics, collapsed, total, hasMore, loading],
  );

  const assetRows = useMemo(() => rows.filter(isAssetRow), [rows]);
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const boardTitleById = useMemo(
    () => new Map(initialBoards.map((board) => [board.id, board.title])),
    [initialBoards],
  );

  const { scrollRef, range, onScroll } = useVirtualRange(rows, OVERSCAN);

  // Read geometry through a ref so the marquee callbacks keep a stable identity
  // and are not rebound on every loaded page.
  const assetRowsRef = useRef(assetRows);
  assetRowsRef.current = assetRows;
  // A marquee ends with a mouseup that also fires a click. Without this the
  // background click handler would immediately clear what was just selected.
  const marqueeMovedRef = useRef(false);
  const menuOpenRef = useRef(false);

  /** Flat geometry for hit-testing a single point, as reorder.ts expects. */
  const allCells = useMemo<Positioned[]>(
    () =>
      assetRows.flatMap((row) =>
        row.cells.map((cell) => ({ id: cell.item.id, x: cell.x, y: cell.y, w: cell.w, h: cell.h })),
      ),
    [assetRows],
  );
  /**
   * Board card rects, derived from the row model the same way asset cells are.
   * A board row knows its card width, gap and column index, so the geometry is
   * arithmetic and the marquee can hit-test boards without measuring the DOM.
   */
  const boardCells = useMemo<Positioned[]>(() => {
    const out: Positioned[] = [];
    for (const row of rows) {
      if (row.kind !== "boards") continue;
      row.boards.forEach((board, column) => {
        out.push({
          id: board.id,
          x: column * (row.cardWidth + metrics.boardGap),
          y: row.y,
          w: row.cardWidth,
          h: row.h,
        });
      });
    }
    return out;
  }, [rows, metrics.boardGap]);
  const boardCellsRef = useRef(boardCells);
  boardCellsRef.current = boardCells;

  const allCellsRef = useRef(allCells);
  allCellsRef.current = allCells;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const assetIdsRef = useRef(assetIds);
  assetIdsRef.current = assetIds;

  const [marqueeActive, setMarqueeActive] = useState(false);
  // Snapshot for undo. There is no write endpoint, so a move is a local
  // filter and reversing it means restoring the previous array wholesale.
  const undoRef = useRef<Asset[] | null>(null);
  const [moved, setMoved] = useState<{ count: number; board: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shouldStartSelecting = useCallback(
    (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      // A marquee starts anywhere in the wall, matching the real gallery, with
      // one exception: pressing an already-selected tile means "move this",
      // which is how the two gestures stay distinguishable now that a card no
      // longer owns pointer-down outright.
      const cell = target.closest<HTMLElement>("[data-asset-id]");
      const id = cell?.dataset.assetId;
      if (id && selectedRef.current.has(id)) return false;
      return Boolean(scrollRef.current?.contains(target));
    },
    [scrollRef],
  );

  const handleSelectionStart = useCallback(
    (event: MouseEvent | globalThis.MouseEvent): void => {
      marqueeMovedRef.current = false;
      setMarqueeActive(true);
      beginMarquee(event.shiftKey || event.metaKey || event.ctrlKey);
    },
    [beginMarquee],
  );

  const handleSelectionChange = useCallback(
    (box: Box): void => {
      const content = contentRef.current;
      if (!content) return;

      // getBoundingClientRect is live, so the element's own offset already
      // reflects scroll position. The box arrives in viewport coordinates.
      const contentBox = toContentRect(box, content.getBoundingClientRect());
      const hits = cellsInBox(assetRowsRef.current, contentBox);

      // Boards are few, so a linear scan costs less than the binary search the
      // asset wall needs.
      const boardHits = boardCellsRef.current
        .filter(
          (cell) =>
            cell.x < contentBox.left + contentBox.width &&
            contentBox.left < cell.x + cell.w &&
            cell.y < contentBox.top + contentBox.height &&
            contentBox.top < cell.y + cell.h,
        )
        .map((cell) => cell.id);

      marqueeMovedRef.current = true;
      applyMarquee(hits.map((cell) => cell.item.id).concat(boardHits));
    },
    [applyMarquee, contentRef],
  );

  const { DragSelection } = useSelectionContainer({
    isEnabled: marqueeEnabled,
    shouldStartSelecting,
    onSelectionStart: handleSelectionStart,
    onSelectionEnd: () => setMarqueeActive(false),
    onSelectionChange: handleSelectionChange,
    selectionProps: {
      style: {
        // The library draws the box with position:absolute at viewport
        // coordinates. Absolute resolves against the nearest positioned
        // ancestor, so inside a scrolled container the box renders scrollTop
        // pixels too high. Fixed makes the coordinates mean what they say.
        position: "fixed",
        // The box is a sibling that precedes the scroller in the DOM, so
        // without an explicit layer the tiles paint over it.
        zIndex: 40,
        // Border and fill are the same hue so the box reads as one translucent
        // shape rather than an outline drawn around a separate tint.
        border: "1px solid rgba(59, 130, 246, 0.35)",
        background: "rgba(59, 130, 246, 0.16)",
        borderRadius: 6,
      },
    },
  });

  const toggleSection = useCallback((section: SectionId): void => {
    setCollapsed((previous) => ({ ...previous, [section]: !previous[section] }));
  }, []);

  // Every gesture starts here, so the marquee flag is cleared on mousedown
  // rather than consumed by the next click. Clearing it only when a marquee
  // begins left it set after a marquee ended, which swallowed the following
  // click on a card and made selection need two clicks.
  const drag = useAssetDrag({
    contentRef,
    orderedIds: assetIds,
    cells: allCells,
    selected,
    onReorder: useCallback(
      (movingIds, insertIndex) => {
        // Reordering is local: the API exposes no write endpoint for order.
        const reordered = moveItems(assetIdsRef.current, movingIds, insertIndex);
        setAssets((previous) => {
          const byId = new Map(previous.map((asset) => [asset.id, asset]));
          const next = reordered
            .map((id) => byId.get(id))
            .filter((asset): asset is Asset => asset !== undefined);
          return next.length === previous.length ? next : previous;
        });
      },
      [setAssets],
    ),
    onDropOnBoard: useCallback(
      (boardId, movingIds) => {
        const moving = new Set(movingIds);
        setAssets((previous) => {
          undoRef.current = previous;
          return previous.filter((asset) => !moving.has(asset.id));
        });
        setMoved({ count: movingIds.length, board: boardTitleById.get(boardId) ?? "" });
        clear();
      },
      [setAssets, boardTitleById, clear],
    ),
    onRefused: useCallback(() => setNotice(COPY.boardIntoBoard), []),
    // A drag ends in a click; swallow it so the drop does not reselect.
    onGestureCommitted: useCallback(() => {
      marqueeMovedRef.current = true;
    }, []),
  });

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      marqueeMovedRef.current = false;
      drag.onMouseDown(event);
    },
    [drag],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /*
    An undo offer describes the last thing that happened. Selecting something
    starts a new one, so the offer is stale: keeping it would leave the bar
    ambiguous about which of the two it is describing. It also expires on its
    own, since an offer that never withdraws is not an offer.
  */
  useEffect(() => {
    if (moved === null || count === 0) return;
    // Retire it for good rather than letting it reappear if the selection is
    // cleared again inside the undo window.
    undoRef.current = null;
    setMoved(null);
  }, [moved, count]);

  useEffect(() => {
    if (moved === null) return;
    const timer = window.setTimeout(() => {
      undoRef.current = null;
      setMoved(null);
    }, UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [moved]);

  const blockedDrag = drag.kind === "board";
  // Boards live in the same selection set, so the split has to be derived.
  const selectedAssetCount = useMemo(
    () => assetIds.reduce((total, id) => (selected.has(id) ? total + 1 : total), 0),
    [assetIds, selected],
  );

  /*
    One attribute on <body> drives every drag cursor. Putting it there rather
    than on the wall lets it override the per-tile cursor without giving the
    memoized cells a prop that changes whenever a gesture starts.
  */
  useEffect(() => {
    const gesture =
      drag.kind === "board" && drag.hoverBoardId
        ? "refused"
        : drag.kind === "assets"
          ? drag.hoverBoardId
            ? "drop"
            : "reorder"
          : marqueeActive
            ? "marquee"
            : null;

    if (gesture === null) {
      delete document.body.dataset.gesture;
      return;
    }
    document.body.dataset.gesture = gesture;
    return () => {
      delete document.body.dataset.gesture;
    };
  }, [drag.kind, drag.hoverBoardId, marqueeActive]);

  const dropIndicator = useMemo(() => {
    if (!drag.dropTarget) return null;
    const cell = allCells.find((c) => c.id === drag.dropTarget?.id);
    if (!cell) return null;
    // "after cell N" and "before cell N+1" are the same insertion point, so both
    // must render in the same place. Anchoring to the middle of the gap makes
    // them coincide; offsetting from each cell's own edge made the bar jump by
    // the gap width as the pointer crossed the midline between two tiles.
    const BAR_WIDTH = 3;
    const half = metrics.gap / 2;
    const edge = drag.dropTarget.side === "before" ? cell.x - half : cell.x + cell.w + half;
    return {
      x: Math.max(0, edge - BAR_WIDTH / 2),
      y: cell.y + 2,
      h: cell.h - 4,
    };
  }, [drag.dropTarget, allCells, metrics.gap]);

  /**
   * Build a menu target from whatever the pointer landed on. The count comes
   * from the live selection only when the target is part of it, so
   * right-clicking outside a selection acts on that one item, which is what
   * every file manager does.
   */
  const targetFrom = useCallback(
    (element: Element, x: number, y: number): MenuTarget | null => {
      const assetEl = element.closest<HTMLElement>("[data-asset-id]");
      if (assetEl?.dataset.assetId) {
        const id = assetEl.dataset.assetId;
        const inSelection = selected.has(id);
        return {
          kind: "asset",
          id,
          title: assetEl.querySelector("img")?.alt ?? "",
          x,
          y,
          selectionCount: inSelection ? count : 1,
        };
      }
      const boardEl = element.closest<HTMLElement>("[data-board-id]");
      if (boardEl?.dataset.boardId) {
        const id = boardEl.dataset.boardId;
        return {
          kind: "board",
          id,
          title: boardEl.textContent?.trim() ?? "",
          x,
          y,
          selectionCount: selected.has(id) ? count : 1,
        };
      }
      return null;
    },
    [selected, count],
  );

  // One delegated handler rather than a callback prop on each of 761 cells,
  // which would defeat their memoization.
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (!(event.target instanceof Element)) return;

      // The ellipsis opens the same menu the right-click does, anchored to the
      // button so it appears where the user is looking.
      const trigger = event.target.closest("[data-menu-trigger]");
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const target = targetFrom(trigger, rect.right, rect.bottom + 4);
        if (target) setMenuTarget(target);
        return;
      }

      const boardEl = event.target.closest<HTMLElement>("[data-board-id]");
      const cell = event.target.closest("[data-asset-id]");
      const intent = resolveClick({
        marqueeMoved: marqueeMovedRef.current,
        // Controls inside the wall (section headers today, menu triggers next)
        // are not background, so they must not clear the selection.
        onControl: event.target.closest("button") !== null,
        assetId:
          (cell instanceof HTMLElement ? cell.dataset.assetId : undefined) ??
          boardEl?.dataset.boardId ??
          null,
        modifiers: {
          shiftKey: event.shiftKey,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
        },
      });
      marqueeMovedRef.current = false;

      if (intent.kind === "ignore") return;
      if (intent.kind === "clear") clear();
      else if (intent.kind === "extend") extendTo(intent.id);
      else if (intent.kind === "toggle") toggle(intent.id);
      else selectOnly(intent.id);
    },
    [clear, extendTo, toggle, selectOnly, targetFrom],
  );


  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (!(event.target instanceof Element)) return;
      const target = targetFrom(event.target, event.clientX, event.clientY);
      if (!target) return;
      event.preventDefault();
      // Right-clicking outside the current selection reduces it to that item,
      // so the menu's count and what it acts on can never disagree.
      if (!selected.has(target.id)) selectOnly(target.id);
      setMenuTarget(target);
    },
    [targetFrom, selected, selectOnly],
  );

  const closeMenu = useCallback((): void => setMenuTarget(null), []);

  const handleMenuAction = useCallback(
    (action: MenuAction, target: MenuTarget): void => {
      const targetIds =
        target.selectionCount > 1 && selected.has(target.id) ? Array.from(selected) : [target.id];
      const urlFor = (id: string): string =>
        boardTitleById.has(id) ? boardUrl(id) : (assetById.get(id)?.image ?? "");

      if (action === "copyLink") {
        void navigator.clipboard?.writeText(targetIds.map(urlFor).filter(Boolean).join("\n"));
        setNotice(COPY.linkCopied(targetIds.length));
        return;
      }

      if (action === "open") {
        // Only the clicked item, however many are selected: opening a dozen
        // tabs from one menu click is not what anyone means by "open".
        const url = urlFor(target.id);
        if (url) window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      if (action === "download") {
        targetIds.forEach((id) => {
          const url = urlFor(id);
          if (!url) return;
          const link = document.createElement("a");
          link.href = url;
          link.download = "";
          link.rel = "noopener";
          link.click();
        });
        return;
      }

      if (action !== "remove" || target.kind !== "asset") return;
      // No write endpoint exists on this API, so removal is local by necessity.
      const ids = target.selectionCount > 1 ? Array.from(selected) : [target.id];
      const removing = new Set(ids);
      setAssets((previous) => previous.filter((asset) => !removing.has(asset.id)));
      clear();
    },
    [selected, setAssets, clear, boardTitleById, assetById],
  );

  // Depends on `rows.length` as well as the visible range: a scroll that stops
  // exactly at a page boundary changes neither the range nor the scroll position
  // afterwards, and the list would stall with no request in flight.
  useEffect(() => {
    if (!hasMore || loading || error || collapsed.assets) return;
    if (range[1] >= rows.length - PREFETCH_ROWS) loadMore();
  }, [range, rows.length, hasMore, loading, error, collapsed.assets, loadMore]);

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = (): void => setMarqueeEnabled(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      // The menu owns Escape while it is open, so dismissing it does not also
      // discard the selection it was acting on.
      if (event.key === "Escape") {
        if (menuOpenRef.current) return;
        clear();
        return;
      }
      if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clear, selectAll]);

  menuOpenRef.current = menuTarget !== null;

  const visible = rows.slice(range[0], range[1]);

  return (
    <div className="flex h-[100dvh] flex-col bg-neutral-100 text-neutral-900">
      {/* White chrome over a light grey canvas, so the wall reads as content
          sitting on a surface rather than as images floating on the page. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight text-neutral-800">{boardTitle}</h1>
          <p className="mt-1 text-xs font-medium tabular-nums text-neutral-600">
            {total > 0 ? COPY.assetCount(total) : COPY.loadingAssets}
            {initialBoards.length > 0 && ` · ${COPY.boardCount(initialBoards.length)}`}
          </p>
        </div>
      </header>

      {/*
        Rendered outside the scroll container on purpose. The library offsets
        the box by its parent's bounding rect, so mounting it inside a scrolled
        element added the scroll offset twice and drew the box scrollTop pixels
        away from the cursor. Out here the parent never scrolls, so the viewport
        coordinates it reports mean what they say.
      */}
      <DragSelection />

      <GalleryMenu
        target={menuTarget}
        onClose={closeMenu}
        onAction={handleMenuAction}
      />

      {/*
        One tab stop for the wall. A scrollable region that cannot take focus is
        unreachable by keyboard except as a side effect of tabbing through the
        controls inside it; with tabIndex the browser supplies arrow, page and
        home/end scrolling for free.
      */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        role="region"
        aria-label={COPY.assetsSection}
        className={clsx(
          "flex-1 overflow-x-hidden overflow-y-auto",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
        )}
      >
        {/* Cells inset their images by 4px, so this padding lands the outer
            image edge at 12px on mobile and 28px above it, matching the
            reference gallery's gutters. */}
        <div className="px-2 py-2 sm:px-6 sm:py-4">
          <div
            ref={contentRef}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onContextMenu={handleContextMenu}
            className="relative w-full select-none"
            style={{ height }}
          >
            {dropIndicator && (
              <div
                aria-hidden
                className={clsx(
                  "pointer-events-none absolute z-30 w-1 rounded-full bg-blue-500",
                  // A white hairline lifts it off whatever photograph sits
                  // behind, and the glow makes it findable in peripheral vision
                  // while the eye is on the dragged tile.
                  "shadow-[0_0_0_1.5px_rgba(255,255,255,0.95),0_0_14px_rgba(59,130,246,0.85)]",
                )}
                style={{
                  transform: `translate3d(${dropIndicator.x}px, ${dropIndicator.y}px, 0)`,
                  height: dropIndicator.h,
                }}
              />
            )}

            {visible.map((row) => {
              // A switch narrows the row union exhaustively with no casts. A
              // lookup keyed by `kind` would need one to re-widen the argument.
              switch (row.kind) {
                case "header":
                  return (
                    <div
                      key={row.id}
                      className="absolute left-0 right-0 flex items-center"
                      style={{ transform: `translate3d(0, ${row.y}px, 0)`, height: row.h }}
                    >
                      <SectionHeader
                        section={row.section}
                        title={row.title}
                        count={row.count}
                        collapsed={collapsed[row.section]}
                        onToggle={toggleSection}
                      />
                    </div>
                  );

                case "boards":
                  return (
                    <div
                      key={row.id}
                      className="absolute left-0 top-0 flex"
                      style={{
                        transform: `translate3d(0, ${row.y}px, 0)`,
                        height: row.h,
                        gap: metrics.boardGap,
                      }}
                    >
                      {row.boards.map((board) => (
                        <BoardCard
                          key={board.id}
                          board={board}
                          width={row.cardWidth}
                          height={row.h}
                          priority={row.index < EAGER_BOARD_ROWS}
                          highlighted={drag.hoverBoardId === board.id && !blockedDrag}
                          blocked={drag.hoverBoardId === board.id && blockedDrag}
                          selected={selected.has(board.id)}
                        />
                      ))}
                    </div>
                  );

                case "assets":
                  return row.cells.map((cell) => (
                    <AssetCell
                      key={cell.item.id}
                      asset={cell.item}
                      x={cell.x}
                      y={cell.y}
                      w={cell.w}
                      h={cell.h}
                      selected={selected.has(cell.item.id)}
                      priority={row.index < EAGER_ASSET_ROWS}
                    />
                  ));

                case "status":
                  return (
                    <div
                      key={row.id}
                      className="absolute left-0 right-0 flex items-center justify-center text-sm text-neutral-600"
                      style={{ transform: `translate3d(0, ${row.y}px, 0)`, height: row.h }}
                    >
                      {row.state === "loading" && (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
                      )}
                      <span className={row.state === "loading" ? "ml-2" : undefined}>
                        {STATUS_COPY[row.state]}
                      </span>
                    </div>
                  );
              }
            })}
          </div>
        </div>
      </div>

      <SelectionBar
        notice={notice}
        assetCount={selectedAssetCount}
        boardCount={count - selectedAssetCount}
        boardTitle={boardTitle}
        moved={moved}
        onClear={clear}
        onUndo={() => {
          if (undoRef.current) setAssets(undoRef.current);
          undoRef.current = null;
          setMoved(null);
        }}
      />

      {error && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 sm:px-6">
          <span className="min-w-0 truncate">
            {COPY.loadFailed} {error}
          </span>
          <button
            type="button"
            onClick={retry}
            className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
          >
            {COPY.retry}
          </button>
        </div>
      )}
    </div>
  );
};

export default Gallery;
