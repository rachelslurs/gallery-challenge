"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useSelectionContainer, type Box } from "@air/react-drag-to-select";
import type { Board } from "@/app/api/boards";
import { COPY } from "@/lib/copy";
import { cellsInBox } from "@/lib/geometry";
import { buildRows, metricsFor, type SectionId, type VRow } from "@/lib/rows";
import { useAssets } from "@/lib/useAssets";
import { useSelection } from "@/lib/useSelection";
import { useContainerWidth, useVirtualRange } from "@/lib/useVirtualRange";
import AssetCell from "./AssetCell";
import BoardCard from "./BoardCard";
import SectionHeader from "./SectionHeader";

const OVERSCAN = 3;
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

  const { assets, total, hasMore, loading, error, loadMore, retry } = useAssets();
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

  const { scrollRef, range, onScroll } = useVirtualRange(rows, OVERSCAN);

  // Read geometry through a ref so the marquee callbacks keep a stable identity
  // and are not rebound on every loaded page.
  const assetRowsRef = useRef(assetRows);
  assetRowsRef.current = assetRows;
  // A marquee ends with a mouseup that also fires a click. Without this the
  // background click handler would immediately clear what was just selected.
  const marqueeMovedRef = useRef(false);

  const shouldStartSelecting = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    if (!scrollRef.current?.contains(target)) return false;
    // Cards own the pointer-down gesture so drag-to-reorder stays available.
    return target.closest("[data-asset-id], [data-board-id]") === null;
  }, [scrollRef]);

  const handleSelectionStart = useCallback(
    (event: MouseEvent | globalThis.MouseEvent): void => {
      marqueeMovedRef.current = false;
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
      const origin = content.getBoundingClientRect();
      const hits = cellsInBox(assetRowsRef.current, {
        left: box.left - origin.left,
        top: box.top - origin.top,
        width: box.width,
        height: box.height,
      });

      marqueeMovedRef.current = true;
      applyMarquee(hits.map((cell) => cell.item.id));
    },
    [applyMarquee, contentRef],
  );

  const { DragSelection } = useSelectionContainer({
    isEnabled: marqueeEnabled,
    shouldStartSelecting,
    onSelectionStart: handleSelectionStart,
    onSelectionChange: handleSelectionChange,
    selectionProps: {
      style: {
        border: "1px solid rgb(59 130 246)",
        background: "rgba(59, 130, 246, 0.16)",
        borderRadius: 2,
      },
    },
  });

  const toggleSection = useCallback((section: SectionId): void => {
    setCollapsed((previous) => ({ ...previous, [section]: !previous[section] }));
  }, []);

  // One delegated handler rather than a callback prop on each of 761 cells,
  // which would defeat their memoization.
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (marqueeMovedRef.current) {
        marqueeMovedRef.current = false;
        return;
      }
      if (!(event.target instanceof Element)) return;

      const cell = event.target.closest("[data-asset-id]");
      if (!(cell instanceof HTMLElement)) {
        clear();
        return;
      }

      const id = cell.dataset.assetId;
      if (!id) return;

      if (event.shiftKey) extendTo(id);
      else if (event.metaKey || event.ctrlKey) toggle(id);
      else selectOnly(id);
    },
    [clear, extendTo, toggle, selectOnly],
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
      if (event.key === "Escape") {
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

  const visible = rows.slice(range[0], range[1]);

  return (
    <div className="flex h-[100dvh] flex-col bg-white text-neutral-900">
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-200 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight">{boardTitle}</h1>
          <p className="mt-0.5 text-xs tabular-nums text-neutral-500">
            {total > 0 ? COPY.assetCount(total) : COPY.loadingAssets}
            {initialBoards.length > 0 && ` · ${COPY.boardCount(initialBoards.length)}`}
          </p>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium tabular-nums text-white transition-colors hover:bg-blue-700"
          >
            {COPY.selectedCount(count)}
          </button>
        )}
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="px-3 py-3 sm:px-6 sm:py-4">
          <DragSelection />
          <div
            ref={contentRef}
            onClick={handleClick}
            className="relative w-full select-none"
            style={{ height }}
          >
            {visible.map((row) => {
              // A switch narrows the row union exhaustively with no casts. A
              // lookup keyed by `kind` would need one to re-widen the argument.
              switch (row.kind) {
                case "header":
                  return (
                    <div
                      key={row.id}
                      className="absolute left-0 right-0"
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
                        gap: metrics.gap,
                      }}
                    >
                      {row.boards.map((board) => (
                        <BoardCard
                          key={board.id}
                          board={board}
                          width={row.cardWidth}
                          height={row.h}
                          priority={row.index < EAGER_BOARD_ROWS}
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
                      className="absolute left-0 right-0 flex items-center justify-center text-sm text-neutral-500"
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
