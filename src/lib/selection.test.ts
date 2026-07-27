import { describe, expect, it } from "vitest";
import {
  mergeMarquee,
  rangeBetween,
  resolveClick,
  toggled,
  type ClickContext,
} from "./selection";

const NO_MODIFIERS = { shiftKey: false, metaKey: false, ctrlKey: false };

const ctx = (overrides: Partial<ClickContext> = {}): ClickContext => ({
  marqueeMoved: false,
  onControl: false,
  assetId: "a",
  modifiers: NO_MODIFIERS,
  ...overrides,
});

describe("resolveClick", () => {
  it("replaces the selection on a plain click", () => {
    expect(resolveClick(ctx())).toEqual({ kind: "replace", id: "a" });
  });

  it("extends on shift and toggles on meta or ctrl", () => {
    expect(resolveClick(ctx({ modifiers: { ...NO_MODIFIERS, shiftKey: true } }))).toEqual({
      kind: "extend",
      id: "a",
    });
    expect(resolveClick(ctx({ modifiers: { ...NO_MODIFIERS, metaKey: true } }))).toEqual({
      kind: "toggle",
      id: "a",
    });
    expect(resolveClick(ctx({ modifiers: { ...NO_MODIFIERS, ctrlKey: true } }))).toEqual({
      kind: "toggle",
      id: "a",
    });
  });

  it("clears when the click lands on background", () => {
    expect(resolveClick(ctx({ assetId: null }))).toEqual({ kind: "clear" });
  });

  // Regression: collapsing a section wiped the selection, because the section
  // header sits inside the delegated click target and read as background.
  it("ignores clicks on controls instead of clearing", () => {
    expect(resolveClick(ctx({ onControl: true, assetId: null }))).toEqual({ kind: "ignore" });
    expect(resolveClick(ctx({ onControl: true, assetId: "a" }))).toEqual({ kind: "ignore" });
  });

  // Regression: the click that ends a marquee must not clear what it selected.
  it("ignores the click that terminates a marquee", () => {
    expect(resolveClick(ctx({ marqueeMoved: true, assetId: null }))).toEqual({ kind: "ignore" });
    expect(resolveClick(ctx({ marqueeMoved: true, assetId: "a" }))).toEqual({ kind: "ignore" });
  });

  // Regression: selecting an image right after a marquee took two clicks,
  // because the flag survived the gesture. With the flag cleared on mousedown,
  // the very next click must select normally.
  it("selects normally once the marquee flag has been cleared", () => {
    expect(resolveClick(ctx({ marqueeMoved: false, assetId: "b" }))).toEqual({
      kind: "replace",
      id: "b",
    });
  });
});

describe("rangeBetween", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("is inclusive and direction-agnostic", () => {
    expect(rangeBetween(ids, "b", "d")).toEqual(["b", "c", "d"]);
    expect(rangeBetween(ids, "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("returns the single item when both anchors match", () => {
    expect(rangeBetween(ids, "c", "c")).toEqual(["c"]);
  });

  it("returns nothing when an anchor is unknown", () => {
    expect(rangeBetween(ids, "zz", "c")).toEqual([]);
    expect(rangeBetween(ids, "c", "zz")).toEqual([]);
    expect(rangeBetween([], "a", "b")).toEqual([]);
  });
});

describe("toggled", () => {
  it("adds when absent and removes when present", () => {
    expect(Array.from(toggled(new Set(["a"]), "b")).sort()).toEqual(["a", "b"]);
    expect(Array.from(toggled(new Set(["a", "b"]), "a"))).toEqual(["b"]);
  });

  it("does not mutate the input", () => {
    const original = new Set(["a"]);
    toggled(original, "b");
    expect(Array.from(original)).toEqual(["a"]);
  });
});

describe("mergeMarquee", () => {
  it("unions the marquee snapshot with the current hits", () => {
    const result = mergeMarquee(new Set(["a"]), ["b", "c"], new Set());
    expect(Array.from(result).sort()).toEqual(["a", "b", "c"]);
  });

  it("replaces rather than accumulates across frames", () => {
    const base = new Set(["a"]);
    const frameOne = mergeMarquee(base, ["b", "c"], new Set());
    // The pointer moved back: c is no longer inside the box.
    const frameTwo = mergeMarquee(base, ["b"], frameOne);
    expect(Array.from(frameTwo).sort()).toEqual(["a", "b"]);
  });

  // This identity guarantee is what keeps a marquee from re-rendering the wall
  // on every animation frame. Losing it would be a silent performance
  // regression, invisible in behavior.
  it("returns the previous set by reference when nothing changed", () => {
    const previous = new Set(["a", "b"]);
    expect(mergeMarquee(new Set(["a"]), ["b"], previous)).toBe(previous);
  });

  it("returns a new set when membership changed", () => {
    const previous = new Set(["a", "b"]);
    expect(mergeMarquee(new Set(["a"]), ["c"], previous)).not.toBe(previous);
  });

  // Same size, different members: a size-only check would wrongly bail out here.
  it("does not mistake an equal-sized but different set for no change", () => {
    const previous = new Set(["a", "x"]);
    const result = mergeMarquee(new Set(["a"]), ["b"], previous);
    expect(result).not.toBe(previous);
    expect(Array.from(result).sort()).toEqual(["a", "b"]);
  });

  it("handles overlap between the snapshot and the hits", () => {
    const result = mergeMarquee(new Set(["a", "b"]), ["b", "c"], new Set());
    expect(Array.from(result).sort()).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the base snapshot", () => {
    const base = new Set(["a"]);
    mergeMarquee(base, ["b"], new Set());
    expect(Array.from(base)).toEqual(["a"]);
  });
});
