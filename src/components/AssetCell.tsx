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

/**
 * Pixels the image is inset inside its layout cell on every side.
 *
 * The cell is what the justified layout positions; the image sits inside it
 * with a margin. That margin is what the selection ring occupies, so a selected
 * tile never draws over its neighbour. It also means the visible gap between
 * two images is the layout gap plus twice this value.
 */
const IMAGE_INSET = 4;

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
  // The image is inset, so it renders narrower than the cell it occupies.
  const imageWidth = Math.max(1, w - IMAGE_INSET * 2);

  return (
    <div
      data-asset-id={asset.id}
      className="group absolute left-0 top-0"
      style={{ transform: `translate3d(${x}px, ${y}px, 0)`, width: w, height: h }}
    >
      <div
        className={clsx(
          "absolute inset-1 overflow-hidden rounded-xl transition-colors duration-150",
          selected ? "bg-neutral-300" : "bg-neutral-200",
        )}
      >
        {asset.image ? (
          // imgix already resizes and negotiates format at the CDN edge.
          // Routing through next/image would add a proxy hop per tile and redo
          // work the CDN has done, for no gain on a 761-image wall.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail(asset.image, imageWidth)}
            srcSet={thumbnailSrcSet(asset.image, imageWidth)}
            sizes={`${Math.ceil(imageWidth)}px`}
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
          <div className="pointer-events-none absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium leading-none tracking-wide text-white">
            <svg viewBox="0 0 8 10" className="h-2.5 w-2.5 fill-current" aria-hidden>
              <path d="M0 0l8 5-8 5z" />
            </svg>
            {asset.duration > 0 && formatDuration(asset.duration)}
          </div>
        )}

        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-0 transition-colors duration-150",
            selected ? "bg-blue-500/10" : "group-hover:bg-black/5",
          )}
        />
      </div>

      {/*
        The ring sits on the cell edge while the image is inset, so the 4px
        margin becomes a gap between photo and ring. Its radius is the image's
        12px plus that 4px inset, which keeps the two curves concentric.

        The colour is set in exactly one branch: listing ring-transparent and
        ring-blue-500 together would leave the winner to Tailwind's stylesheet
        order rather than to this condition.
      */}
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset",
          "transition-[box-shadow] duration-150",
          selected ? "ring-blue-500" : "ring-transparent",
        )}
      />
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
