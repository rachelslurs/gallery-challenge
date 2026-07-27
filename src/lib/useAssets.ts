"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { fetchAssets, type Clip } from "@/app/api/clips";
import { COPY, ERROR_CONTEXT } from "./copy";
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
  setAssets: Dispatch<SetStateAction<Asset[]>>;
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

  useEffect(() => {
    cancelledRef.current = false;
    loadMore();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadMore]);

  return { assets, total, hasMore, loading, error, loadMore, retry, setAssets };
};
