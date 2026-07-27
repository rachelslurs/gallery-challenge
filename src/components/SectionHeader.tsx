"use client";

import clsx from "clsx";
import type { SectionId } from "@/lib/rows";

export interface SectionHeaderProps {
  section: SectionId;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: (section: SectionId) => void;
}

const SectionHeader = ({ section, title, count, collapsed, onToggle }: SectionHeaderProps) => (
  // `contents` keeps the heading semantic without adding a box to the layout.
  <h2 className="contents">
    <button
    type="button"
    onClick={() => onToggle(section)}
    aria-expanded={!collapsed}
    className={clsx(
      // Same radius, easing and duration as a tile, so the header reads as
      // part of the same surface rather than as unrelated chrome.
      // No w-full: the parent row is a flex container, so the button sizes to
      // its label and the hover target stops at the text rather than sweeping
      // the whole width of the wall.
      "inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left",
      "transition-colors duration-150 hover:bg-neutral-200 active:bg-neutral-300",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
    )}
  >
    <svg
      viewBox="0 0 16 16"
      className={clsx(
        "h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform duration-150",
        collapsed && "-rotate-90",
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
    {/* A small, tracked, uppercase label rather than a heading: the images are
        the content here, and the section marker should stay quiet. */}
    <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">{title}</span>
    <span className="text-xs font-bold tabular-nums tracking-wider text-neutral-600">
      {count.toLocaleString()}
    </span>
  </button>
  </h2>
);

export default SectionHeader;
