"use client";

import clsx from "clsx";
import type { Board } from "@/app/api/boards";
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
      className="group flex cursor-pointer flex-col gap-2"
      style={{ width, height }}
    >
      <div
        className={clsx(
          "relative flex-1 overflow-hidden rounded bg-neutral-200",
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
      </div>

      <p className="truncate px-0.5 text-[13px] font-medium leading-tight text-neutral-800">
        {board.title}
      </p>
    </div>
  );
};

export default BoardCard;
