"use client";

import clsx from "clsx";
import type { Board } from "@/app/api/boards";
import { COPY } from "@/lib/copy";
import { thumbnail } from "@/lib/imgix";

export interface BoardCardProps {
  board: Board;
  width: number;
  height: number;
  /** Board rows sit at the top of the page, so the first one loads eagerly. */
  priority: boolean;
  /** True while a drag hovers this board, so the drop destination is obvious. */
  highlighted?: boolean;
  selected?: boolean;
  /** True when a drag is hovering here but cannot be dropped. */
  blocked?: boolean;
}

const BoardCard = ({ board, width, height, priority, highlighted = false, selected = false, blocked = false }: BoardCardProps) => {
  const cover = board.thumbnails?.[0];

  return (
    <div
      data-board-id={board.id}
      className="group"
      style={{ width, height }}
    >
      <div
        className={clsx(
          "relative h-full w-full overflow-hidden rounded-xl bg-neutral-200",
          "transition-shadow duration-150",
          blocked
            ? "ring-2 ring-red-500 ring-offset-2 ring-offset-neutral-100"
            : highlighted || selected
              ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-100"
              : "ring-1 ring-black/5 group-hover:ring-black/15",
        )}
      >
        {cover ? (
          // Same reasoning as AssetCell: imgix resizes at the edge.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail(cover, width)}
            alt=""
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-neutral-400" fill="currentColor" aria-hidden>
              <path d="M3 6a2 2 0 012-2h3.6a2 2 0 011.4.6L11.8 6H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
            </svg>
          </div>
        )}

        <button
          type="button"
          data-menu-trigger="board"
          aria-label={COPY.boardActions}
          className={clsx(
            "absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded",
            "bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          )}
        >
          <svg viewBox="0 0 16 16" className="pointer-events-none h-4 w-4 fill-current" aria-hidden>
            <path d="M2.1 8a1.4 1.4 0 112.8 0 1.4 1.4 0 01-2.8 0zm4.5 0a1.4 1.4 0 112.8 0 1.4 1.4 0 01-2.8 0zm4.5 0a1.4 1.4 0 112.8 0 1.4 1.4 0 01-2.8 0z" />
          </svg>
        </button>

        {/*
          The title sits on the image over a gradient, as the reference does,
          rather than on a label strip below it. That is what lets the card be a
          fixed height at every width.
        */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.75),transparent)] px-2 pb-2 pt-6">
          <p className="truncate text-lg font-semibold leading-6 tracking-[-0.014em] text-white">
            {board.title}
          </p>
        </div>
      </div>

    </div>
  );
};

export default BoardCard;
