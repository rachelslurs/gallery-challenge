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
  // No plural form: Open acts on the clicked item however many are selected, so
  // a counted label would promise something the action does not do.
  openBoard: "Open board",
  copyLinks: (n: number): string => `Copy ${n} links`,
  assetMenuLabel: "Asset actions",
  boardMenuLabel: "Board actions",
} as const;
