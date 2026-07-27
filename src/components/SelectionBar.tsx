"use client";

import clsx from "clsx";
import { COPY } from "@/lib/copy";

const iconButton = clsx(
  "relative grid h-6 w-6 shrink-0 place-items-center rounded text-neutral-50",
  "transition-colors hover:bg-white/10 active:bg-white/20",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
);

const pillButton = clsx(
  "relative flex h-6 shrink-0 items-center rounded px-2 text-xs font-semibold",
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
);

/** Visually hidden, still announced. */
const srOnly = "absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0,0,0,0)]";

export interface SelectionBarProps {
  count: number;
  boardTitle: string;
  /** Set while a move can still be undone; takes over the bar. */
  moved: { count: number; board: string } | null;
  /** A refusal to explain, which outranks everything else the bar could say. */
  notice: string | null;
  onClear: () => void;
  onUndo: () => void;
}

/**
 * One bar owns everything transient: the selection count, the undo after a
 * move, and a refusal.
 *
 * The three states share a fixed skeleton rather than each laying itself out.
 * Only the selection state has a clear button, so without a reserved slot the
 * message would start 40px further left in the other two and the bar would
 * appear to jump as it changed what it was saying.
 */
const SelectionBar = ({ count, boardTitle, moved, notice, onClear, onUndo }: SelectionBarProps) => {
  if (!notice && !moved && count === 0) return null;

  const showClear = !notice && !moved && count > 0;

  return (
    <div className="pointer-events-none fixed inset-x-2 bottom-2 z-50">
      <div
        role="status"
        className={clsx(
          "pointer-events-auto flex w-full min-w-0 items-center justify-between gap-4 overflow-hidden",
          // A dark translucent slab over the wall rather than an opaque bar, so
          // the images stay visible underneath while it is open.
          "rounded-lg bg-neutral-900/80 p-4 text-neutral-50 backdrop-blur-[18px]",
          "animate-[rise_300ms_ease-out]",
        )}
      >
        <div className="flex min-w-0 shrink items-center gap-4">
          {showClear ? (
            <button type="button" onClick={onClear} className={iconButton}>
              <span className={srOnly}>{COPY.clearSelection}</span>
              <svg viewBox="0 0 32 32" className="block h-4 w-4 fill-current" aria-hidden>
                <path d="M7.23 7.23a1.63 1.63 0 012.31 0L16 13.69l6.46-6.46a1.63 1.63 0 112.31 2.31L18.31 16l6.46 6.46a1.63 1.63 0 11-2.31 2.31L16 18.31l-6.46 6.46a1.63 1.63 0 11-2.31-2.31L13.69 16 7.23 9.54a1.63 1.63 0 010-2.31z" />
              </svg>
            </button>
          ) : (
            /* Holds the clear button's place so the message never shifts. */
            <span aria-hidden className="h-6 w-6 shrink-0" />
          )}

          <span className={clsx("min-w-0 truncate text-xs", notice && "text-amber-200")}>
            {notice ?? (moved ? COPY.movedToBoard(moved.count, moved.board) : COPY.itemsSelectedFrom(count, boardTitle))}
          </span>
        </div>

        {moved && !notice && (
          <button type="button" onClick={onUndo} className={clsx(pillButton, "bg-white/15 hover:bg-white/25")}>
            {COPY.undo}
          </button>
        )}
      </div>
    </div>
  );
};

export default SelectionBar;
