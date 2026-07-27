"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Board } from "@/app/api/boards";
import { COPY } from "@/lib/copy";
import { buildRows, metricsFor, type SectionId, type VRow } from "@/lib/rows";
import { useAssets } from "@/lib/useAssets";
import { useContainerWidth, useVirtualRange } from "@/lib/useVirtualRange";
import AssetCell from "./AssetCell";
import BoardCard from "./BoardCard";
import SectionHeader from "./SectionHeader";

const OVERSCAN = 3;
/** Start the next page once the window is this many rows from the end. */
const PREFETCH_ROWS = 4;

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
  const [selected] = useState<ReadonlySet<string>>(() => new Set<string>());

  const { assets, total, hasMore, loading, error, loadMore, retry } = useAssets();
  const { ref: contentRef, width } = useContainerWidth<HTMLDivElement>();

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

  const { scrollRef, range, onScroll } = useVirtualRange(rows, OVERSCAN);

  const toggleSection = useCallback((section: SectionId): void => {
    setCollapsed((previous) => ({ ...previous, [section]: !previous[section] }));
  }, []);

  // Depends on `rows.length` as well as the visible range: a scroll that stops
  // exactly at a page boundary changes neither the range nor the scroll position
  // afterwards, and the list would stall with no request in flight.
  useEffect(() => {
    if (!hasMore || loading || error || collapsed.assets) return;
    if (range[1] >= rows.length - PREFETCH_ROWS) loadMore();
  }, [range, rows.length, hasMore, loading, error, collapsed.assets, loadMore]);

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
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="px-3 py-3 sm:px-6 sm:py-4">
          <div ref={contentRef} className="relative w-full" style={{ height }}>
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
                        <BoardCard key={board.id} board={board} width={row.cardWidth} height={row.h} />
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
