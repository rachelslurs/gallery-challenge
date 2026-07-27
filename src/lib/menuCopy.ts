export const MENU_COPY = {
  openLabel: "Open",
  downloadOne: "Download",
  downloadMany: (n: number): string => `Download ${n} assets`,
  moveOne: "Move to board…",
  moveMany: (n: number): string => `Move ${n} assets to board…`,
  removeOne: "Remove from board",
  removeMany: (n: number): string => `Remove ${n} assets from board`,
  copyLink: "Copy link",
  renameBoard: "Rename board",
  openBoard: "Open board",
  assetMenuLabel: "Asset actions",
  boardMenuLabel: "Board actions",
} as const;
