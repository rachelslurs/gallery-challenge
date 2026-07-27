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
    className="flex h-full w-full items-center gap-2 rounded-md px-1 text-left transition-colors hover:bg-neutral-100"
  >
    <svg
      viewBox="0 0 16 16"
      className={clsx(
        "h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-150",
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
    <span className="text-[15px] font-semibold text-neutral-900">{title}</span>
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-neutral-600">
      {count.toLocaleString()}
    </span>
  </button>
);

export default SectionHeader;
