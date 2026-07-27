/** All user-facing strings. Keeps copy out of JSX and in one place to revise. */
export const COPY = {
  boardsSection: "Boards",
  assetsSection: "Assets",
  galleryFallbackTitle: "Gallery",
  loadingAssets: "Loading assets…",
  loadingMore: "Loading more…",
  endOfBoard: "End of board",
  noAssets: "No assets on this board",
  loadFailed: "Could not load assets.",
  retry: "Retry",
  untitledAsset: "Untitled",
  unknownFileType: "FILE",
  /** "JPG · 1 MB · 5616 x 3744", the shape the reference gallery uses on hover. */
  assetMeta: (ext: string, bytes: number | undefined, width: number, height: number): string => {
    // Guarded rather than trusted: the field is absent on some clips, and an
    // unguarded divide renders the string "NaN KB" straight into the UI.
    const parts = [ext.toUpperCase()];
    if (typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0) {
      const mb = bytes / 1_000_000;
      parts.push(mb >= 1 ? `${mb.toFixed(mb >= 10 ? 0 : 1)} MB` : `${Math.round(bytes / 1000)} KB`);
    }
    if (width > 0 && height > 0) parts.push(`${width} x ${height}`);
    return parts.filter(Boolean).join(" · ");
  },
  assetCount: (count: number): string =>
    `${count.toLocaleString()} ${count === 1 ? "asset" : "assets"}`,
  boardCount: (count: number): string =>
    `${count} ${count === 1 ? "board" : "boards"}`,
  selectedCount: (count: number): string => `${count} selected`,
  assetActions: "Asset actions",
  boardActions: "Board actions",
  movedToBoard: (count: number, board: string): string =>
    `Moved ${count} ${count === 1 ? "asset" : "assets"} to ${board}`,
  removedFromBoard: (count: number): string =>
    `Removed ${count} ${count === 1 ? "asset" : "assets"}`,
  undo: "Undo",
  clearSelection: "Clear selection",
  boardIntoBoard: "Boards cannot be moved into another board",
  itemsSelectedFrom: (count: number, board: string): string =>
    `${count} ${count === 1 ? "item" : "items"} selected${board ? ` from ${board}` : ""}`,
  /**
   * Names each kind when a selection mixes them, because what the selection can
   * do then depends on which kind you mean.
   */
  selectionSummary: (assets: number, boards: number, board: string): string => {
    const asset = `${assets} ${assets === 1 ? "asset" : "assets"}`;
    const brd = `${boards} ${boards === 1 ? "board" : "boards"}`;
    if (boards === 0) return `${asset} selected${board ? ` from ${board}` : ""}`;
    if (assets === 0) return `${brd} selected`;
    return `${brd} and ${asset} selected`;
  },
  mixedSelectionHint: "Dragging moves the assets; boards stay put",
} as const;

/** Context strings for `messageFrom`, so error text reads consistently. */
export const ERROR_CONTEXT = {
  fetchAssets: "error loading assets",
  fetchBoards: "error loading boards",
} as const;
