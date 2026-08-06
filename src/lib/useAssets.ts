"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { fetchAssets, type Clip } from "@/app/api/clips";
import { COPY, ERROR_CONTEXT } from "./copy";
import { removeByIds } from "./removal";
import { messageFrom, type Result } from "./result";

/**
 * The gallery's view of a clip.
 *
 * The `Clip` interface in the starter is hand-written and drifts from what the
 * API actually sends: `workspaceName` and `workspaceImage` are typed as required
 * strings but never arrive, and `title` is typed `string | undefined` but comes
 * back as `null`. Normalizing once at this boundary means no render site has to
 * know that, and keeps the objects small when 761 are alive at once.
 */
export interface Asset {
  id: string;
  width: number;
  height: number;
  title: string;
  image: string;
  previewVideo?: string;
  type: Clip["type"];
  duration: number;
  ext: string;
  /**
   * Precomputed "JPG · 1.5 MB · 5616 x 3744" for the hover overlay.
   *
   * Built once as the asset enters rather than on every render: a cell
   * re-renders whenever the window moves or its selection flips, and formatting
   * the same immutable string each time is work with no possible different
   * answer.
   */
  meta: string;
}

interface AssetPage {
  assets: Asset[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

const normalize = (clip: Clip): Asset => {
  // A quarter-turn means the intrinsic dimensions describe the pre-rotation
  // image, so the layout needs them swapped or the cell is laid out sideways.
  const turned = clip.rotation === 90 || clip.rotation === 270;
  const width = (turned ? clip.height : clip.width) || 1;
  const height = (turned ? clip.width : clip.height) || 1;

  return {
    id: clip.id,
    width,
    height,
    title: clip.title ?? clip.importedName ?? COPY.untitledAsset,
    image: clip.assets?.image ?? "",
    previewVideo: clip.assets?.previewVideo,
    type: clip.type,
    duration: clip.duration ?? 0,
    ext: clip.ext ?? "",
    meta: COPY.assetMeta(clip.ext ?? "", clip.size, width, height),
  };
};

/** Defensive at the boundary: the endpoint is public and unversioned. */
const loadPage = async (cursor: string | null): Promise<Result<AssetPage>> => {
  try {
    const response = await fetchAssets({ cursor });
    const clips = response?.data?.clips ?? [];
    const nextCursor = response?.pagination?.cursor ?? null;

    return {
      success: true,
      data: {
        assets: clips.filter((clip) => Boolean(clip?.id)).map(normalize),
        cursor: nextCursor,
        hasMore: Boolean(response?.pagination?.hasMore && nextCursor),
        total: response?.data?.total ?? 0,
      },
    };
  } catch (error) {
    return { success: false, error: messageFrom(error, ERROR_CONTEXT.fetchAssets) };
  }
};

export interface UseAssetsResult {
  assets: Asset[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  retry: () => void;
  /** Drop assets locally and keep `total` in step. Returns how many left. */
  removeAssets: (ids: readonly string[]) => number;
  setAssets: Dispatch<SetStateAction<Asset[]>>;
  setTotal: Dispatch<SetStateAction<number>>;
}

/**
 * Cursor pagination over the clips endpoint.
 *
 * The API returns an opaque `pagination.cursor`; feeding it into the next
 * request walks the board. Requests serialize through `inFlightRef` so a fast
 * scroll cannot fan out into a dozen overlapping fetches.
 */
export const useAssets = (): UseAssetsResult => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cursorRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const exhaustedRef = useRef(false);
  const cancelledRef = useRef(false);
  const seenRef = useRef(new Set<string>());

  // Mirrored so a removal can read the current list and count without closing
  // over them, which would rebuild the callback on every loaded page.
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const totalRef = useRef(total);
  totalRef.current = total;

  const loadMore = useCallback((): void => {
    if (inFlightRef.current || exhaustedRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    void loadPage(cursorRef.current).then((result) => {
      inFlightRef.current = false;
      if (cancelledRef.current) return;
      setLoading(false);

      if (!result.success) {
        // Leave the cursor untouched so retry resumes from the same page.
        setError(result.error);
        return;
      }

      const page = result.data;
      if (!page) return;

      cursorRef.current = page.cursor;
      exhaustedRef.current = !page.hasMore;
      setTotal(page.total);
      setHasMore(page.hasMore);

      // A cursor can straddle a page boundary and repeat an item. Dropping
      // duplicates keeps React keys unique and the layout stable.
      const fresh = page.assets.filter((asset) => !seenRef.current.has(asset.id));
      if (fresh.length === 0) return;
      fresh.forEach((asset) => seenRef.current.add(asset.id));
      setAssets((previous) => previous.concat(fresh));
    });
  }, []);

  const retry = useCallback((): void => {
    setError(null);
    loadMore();
  }, [loadMore]);

  /**
   * Drop assets from the loaded list, and move `total` with them.
   *
   * `total` is the board's count from the API, and the section header renders
   * it, so a removal that touches only the array leaves the header reporting a
   * number the wall no longer matches.
   *
   * Read through refs and computed before either setter, so both updaters stay
   * pure: React invokes an updater twice under StrictMode, which would double
   * any counting done inside one.
   *
   * Removed ids stay in `seenRef` on purpose. A later cursor page can still
   * carry an asset removed here, and forgetting it would let that page put the
   * asset back.
   */
  const removeAssets = useCallback((ids: readonly string[]): number => {
    const current = assetsRef.current;
    const next = removeByIds(current, totalRef.current, ids);
    if (next.items === current) return 0;

    setAssets(next.items);
    setTotal(next.total);
    return current.length - next.items.length;
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    loadMore();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadMore]);

  return { assets, total, hasMore, loading, error, loadMore, removeAssets, retry, setAssets, setTotal };
};
