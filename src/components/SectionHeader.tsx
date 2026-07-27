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
  <button
    type="button"
    onClick={() => onToggle(section)}
    aria-expanded={!collapsed}
    className="flex h-full w-full items-center gap-1.5 rounded px-1 text-left transition-colors hover:bg-neutral-200/60"
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
    <span className="text-xs font-bold tabular-nums tracking-wider text-neutral-400">
      {count.toLocaleString()}
    </span>
  </button>
);

export default SectionHeader;
