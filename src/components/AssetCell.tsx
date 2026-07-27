"use client";

import { memo, useState } from "react";
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
  // Hover lives in the cell rather than the wall. Lifting it would re-render
  // every mounted tile on each pointer move between tiles; kept local, only the
  // tile entered and the tile left re-render, and exactly one video is ever
  // mounted.
  const [previewing, setPreviewing] = useState(false);

  const isVideo = asset.type === "video";
  const preview = isVideo ? asset.previewVideo : undefined;
  // The image is inset, so it renders narrower than the cell it occupies.
  const imageWidth = Math.max(1, w - IMAGE_INSET * 2);

  return (
    <div
      data-asset-id={asset.id}
      className={clsx(
        "group absolute left-0 top-0",
        // The ring sits on the cell edge while the image is inset, so the 4px
        // margin reads as a gap between photo and ring. Its radius is the
        // image's 12px plus that inset, keeping the two curves concentric.
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:content-['']",
        "before:transition-[box-shadow] before:duration-150",
        selected ? "before:shadow-[inset_0_0_0_2px_#3b82f6]" : "before:shadow-none",
      )}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)`, width: w, height: h }}
      {...(preview && {
        onMouseEnter: () => setPreviewing(true),
        onMouseLeave: () => setPreviewing(false),
      })}
    >
      <div
        className={clsx(
          "absolute inset-1 overflow-hidden rounded-xl transition-colors duration-150",
          // The tint and the ring are decoration, so they are pseudo-elements
          // rather than nodes. Two divs per cell is 80-odd elements across a
          // full window for something that paints identically either way.
          "after:pointer-events-none after:absolute after:inset-0 after:transition-colors after:duration-150 after:content-['']",
          selected
            ? "bg-neutral-300 after:bg-blue-500/10"
            : "bg-neutral-200 group-hover:after:bg-black/5",
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

        {previewing && preview && (
          /*
             Mounted only while hovered, so nothing preloads and one video at
             most is ever decoding. The poster frame stays underneath, which is
             what the viewer keeps seeing until the first frame arrives.
          */
          <video
            src={preview}
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}

        {isVideo && asset.duration > 0 && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-sm bg-black/80 px-1 text-[10px] font-medium leading-4 tracking-[0.1px] text-white">
            {formatDuration(asset.duration)}
          </div>
        )}

        {/*
          Filename and specifications over a gradient, revealed on hover. The
          gradient carries the text rather than sitting behind it as a separate
          layer, which keeps this to three nodes.
        */}
        <div
          className={clsx(
            "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end gap-0.5 p-2",
            // Arbitrary values on purpose: this project pins Tailwind 3.3,
            // where min-h-24 does not exist and the gradient-stop utilities
            // silently produced no background-image.
            "min-h-[84px] bg-[linear-gradient(to_top,rgba(0,0,0,0.85),transparent)]",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          )}
        >
          <p className="truncate text-xs font-medium leading-4 text-white">{asset.title}</p>
          <p className="truncate text-[11px] leading-4 text-white/70">
            {asset.meta}
          </p>
        </div>

        {/*
          Marked with a data attribute rather than given an onClick, so the one
          delegated listener on the wall handles it and the cell keeps taking no
          callback props. A callback would change identity per render and defeat
          the memo across all 761 cells.
        */}
        <button
          type="button"
          data-menu-trigger="asset"
          aria-label={COPY.assetActions}
          className={clsx(
            "absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded",
            "bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          )}
        >
          <svg viewBox="0 0 16 16" className="pointer-events-none h-4 w-4 fill-current" aria-hidden>
            <path d="M2.1 8a1.4 1.4 0 112.8 0 1.4 1.4 0 01-2.8 0zm4.5 0a1.4 1.4 0 112.8 0 1.4 1.4 0 01-2.8 0zm4.5 0a1.4 1.4 0 112.8 0 1.4 1.4 0 01-2.8 0z" />
          </svg>
        </button>
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
