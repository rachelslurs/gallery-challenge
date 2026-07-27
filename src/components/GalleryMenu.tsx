"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

import { MENU_COPY } from "@/lib/menuCopy";

export type MenuAction =
  | "open"
  | "download"
  | "move"
  | "remove"
  | "copyLink"
  | "rename";

export interface MenuTarget {
  kind: "asset" | "board";
  id: string;
  title: string;
  /** Viewport coordinates where the menu should appear. */
  x: number;
  y: number;
  /** How many items are selected. 1 or 0 means act on this target alone. */
  selectionCount: number;
}

export interface GalleryMenuProps {
  target: MenuTarget | null;
  onClose: () => void;
  onAction: (action: MenuAction, target: MenuTarget) => void;
}

interface MenuItemSpec {
  action: MenuAction;
  label: string;
  destructive?: boolean;
}

const VIEWPORT_MARGIN = 8;

/**
 * Context menu for gallery assets and boards. Mount it once at the app root:
 * with 761 grid cells, a per-cell instance would multiply DOM nodes and
 * listeners for a control that shows at most one menu at a time.
 */
const GalleryMenu = ({
  target,
  onClose,
  onAction,
}: GalleryMenuProps): ReactNode => {
  // The portal needs `document`, which does not exist during SSR.
  const [mounted, setMounted] = useState(false);

  const items = useMemo<MenuItemSpec[]>(() => {
    if (target === null) return [];
    const count = target.selectionCount;
    const many = count > 1;

    if (target.kind === "board") {
      return [
        { action: "open", label: many ? MENU_COPY.openBoards(count) : MENU_COPY.openBoard },
        { action: "copyLink", label: many ? MENU_COPY.copyLinks(count) : MENU_COPY.copyLink },
      ];
    }
    return [
      { action: "open", label: MENU_COPY.openLabel },
      {
        action: "download",
        label: many ? MENU_COPY.downloadMany(count) : MENU_COPY.downloadOne,
      },
      { action: "copyLink", label: MENU_COPY.copyLink },
      {
        action: "remove",
        label: many ? MENU_COPY.removeMany(count) : MENU_COPY.removeOne,
        destructive: true,
      },
    ];
  }, [target]);

  const menuRef = useRef<HTMLDivElement | null>(null);

  const handleItemClick = useCallback(
    (action: MenuAction): void => {
      if (target === null) return;
      onAction(action, target);
      onClose();
    },
    [target, onAction, onClose],
  );

  const handleMenuKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      // Tab out closes rather than walking the remaining items and then
      // leaking focus to the page while the menu stays open.
      if (event.key === "Tab") {
        onClose();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const menu = menuRef.current;
      if (menu === null) return;
      const buttons = Array.from(
        menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
      );
      if (buttons.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      const activeIndex = buttons.findIndex(
        (button) => button === document.activeElement,
      );
      const nextIndex =
        activeIndex === -1
          ? step === 1
            ? 0
            : buttons.length - 1
          : (activeIndex + step + buttons.length) % buttons.length;
      buttons[nextIndex]?.focus();
    },
    [onClose],
  );

  /*
    Return focus to whatever opened the menu. Without this, closing leaves
    activeElement on <body>, so a keyboard user who opened the menu from a
    tile's ellipsis is dropped to the top of the tab order.
  */
  useEffect(() => {
    if (!mounted || target === null) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [target, mounted]);

  // Reposition before paint so the flipped placement never flashes at the raw
  // pointer coordinates. Writing styles directly skips a measure-then-set-state
  // render pass.
  useLayoutEffect(() => {
    if (!mounted || target === null) return;
    const menu = menuRef.current;
    if (menu === null) return;
    const { width, height } = menu.getBoundingClientRect();
    let left = target.x;
    let top = target.y;
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) left -= width;
    if (top + height > window.innerHeight - VIEWPORT_MARGIN) top -= height;
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      window.innerWidth - width - VIEWPORT_MARGIN,
    );
    top = Math.min(
      Math.max(top, VIEWPORT_MARGIN),
      window.innerHeight - height - VIEWPORT_MARGIN,
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, [target, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || target === null) return;
    const firstItem =
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [target, mounted]);

  useEffect(() => {
    if (target === null) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      // The document listener runs before the window listener the gallery uses
      // for Escape, so stopping here keeps dismissing the menu from also
      // discarding the selection it was acting on.
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    const handlePointerDown = (event: PointerEvent): void => {
      const menu = menuRef.current;
      if (menu !== null && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      onClose();
    };
    const handleClose = (): void => {
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    // Scroll events do not bubble; the capture phase is the only way a window
    // listener sees scrolling inside the gallery's inner scroll container.
    window.addEventListener("scroll", handleClose, true);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", handleClose, true);
      window.removeEventListener("resize", handleClose);
    };
  }, [target, onClose]);

  if (!mounted || target === null) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={target.kind === "board" ? MENU_COPY.boardMenuLabel : MENU_COPY.assetMenuLabel}
      className="fixed z-50 min-w-[200px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg shadow-black/10"
      style={{ left: target.x, top: target.y }}
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item) => (
        <Fragment key={item.action}>
          {item.destructive ? (
            <div className="my-1 h-px bg-neutral-200" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={clsx(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] focus:bg-neutral-100 focus:outline-none",
              item.destructive
                ? "text-red-600 hover:bg-red-50"
                : "text-neutral-800 hover:bg-neutral-100",
            )}
            onClick={() => handleItemClick(item.action)}
          >
            {item.label}
          </button>
        </Fragment>
      ))}
    </div>,
    document.body,
  );
};

export default GalleryMenu;
