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
  itemsSelectedFrom: (count: number, board: string): string =>
    `${count} ${count === 1 ? "item" : "items"} selected${board ? ` from ${board}` : ""}`,
} as const;

/** Context strings for `messageFrom`, so error text reads consistently. */
export const ERROR_CONTEXT = {
  fetchAssets: "error loading assets",
  fetchBoards: "error loading boards",
} as const;
