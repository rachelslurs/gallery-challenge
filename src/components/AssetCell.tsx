"use client";

import { memo } from "react";
import clsx from "clsx";
import { COPY } from "@/lib/copy";
import { thumbnail, thumbnailSrcSet } from "@/lib/imgix";
import type { Asset } from "@/lib/useAssets";

const formatDuration = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export interface AssetCellProps {
  asset: Asset;
  x: number;
  y: number;
  w: number;
  h: number;
  selected: boolean;
  /**
   * True for tiles in the first screenful. Lazy-loading an above-the-fold image
   * hides it from the preload scanner and drops it to Low priority, which shows
   * up directly as LCP load delay.
   */
  priority: boolean;
}

const AssetCell = ({ asset, x, y, w, h, selected, priority }: AssetCellProps) => {
  const isVideo = asset.type === "video";

  return (
    <div
      data-asset-id={asset.id}
      className="absolute left-0 top-0"
      style={{ transform: `translate3d(${x}px, ${y}px, 0)`, width: w, height: h }}
    >
      <div
        className={clsx(
          "group relative flex h-full w-full flex-col overflow-hidden rounded-md",
          "transition-colors duration-150",
          selected ? "bg-neutral-300" : "bg-neutral-200/70",
        )}
      >
        {asset.image ? (
          // imgix already resizes and negotiates format at the CDN edge.
          // Routing through next/image would add a proxy hop per tile and redo
          // work the CDN has done, for no gain on a 761-image wall.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail(asset.image, w)}
            srcSet={thumbnailSrcSet(asset.image, w)}
            sizes={`${Math.ceil(w)}px`}
            alt={asset.title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
            {asset.ext.toUpperCase() || COPY.unknownFileType}
          </div>
        )}

        {isVideo && (
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium leading-none text-white">
            <svg viewBox="0 0 8 10" className="h-2.5 w-2.5 fill-current" aria-hidden>
              <path d="M0 0l8 5-8 5z" />
            </svg>
            {asset.duration > 0 && formatDuration(asset.duration)}
          </div>
        )}

        {/*
          The ring and tint live on an overlay rather than on the container.
          An inset box-shadow paints beneath its own content, so a ring on the
          container is hidden by the image that fills it. A sibling declared
          after the image is what puts the state above the photo.

          The colour is set in exactly one branch: listing ring-transparent and
          ring-blue-500 together would leave the winner to Tailwind's stylesheet
          order rather than to this condition. The 2px is always reserved, so
          selecting changes a colour and never nudges the layout.
        */}
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-0 rounded-md ring-2 ring-inset",
            "transition-[background-color,box-shadow] duration-150",
            selected ? "bg-blue-500/10 ring-blue-500" : "ring-transparent group-hover:bg-black/5",
          )}
        />

      </div>
    </div>
  );
};

/**
 * Memoized on a boolean `selected` rather than on the selection collection, so
 * dragging a marquee across the wall re-renders only the tiles whose state
 * flipped. Without it, every mounted tile re-renders on each pointer move,
 * which is the difference between smooth and unusable at a 6x CPU throttle.
 */
const MemoizedAssetCell = memo(AssetCell);
MemoizedAssetCell.displayName = "AssetCell";

export default MemoizedAssetCell;
