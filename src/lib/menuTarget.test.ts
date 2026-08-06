import { describe, expect, it } from "vitest";
import { menuScope } from "./menuTarget";

const ASSETS = new Set(["a1", "a2", "a3", "a4"]);
const BOARDS = ["b1", "b2"];

/** Four boards' worth of ids is overkill; two prove the split. */
const mixed = new Set([...BOARDS, "a1", "a2", "a3"]);

describe("menuScope", () => {
  it("scopes an unselected target to itself, however much else is selected", () => {
    expect(menuScope("asset", "a4", mixed, ASSETS)).toEqual({ count: 1, ids: ["a4"] });
    expect(menuScope("board", "b3", mixed, ASSETS)).toEqual({ count: 1, ids: ["b3"] });
  });

  it("scopes a selected target to the whole selection when it is all one kind", () => {
    const assetsOnly = new Set(["a1", "a2", "a3"]);
    const scope = menuScope("asset", "a2", assetsOnly, ASSETS);
    expect(scope.count).toBe(3);
    expect(scope.ids.sort()).toEqual(["a1", "a2", "a3"]);
  });

  /*
   * The regression this exists for. With boards and assets in one selection the
   * menu counted both kinds, so an asset menu read "Remove 5 assets" and removed
   * three, and Download handed the board ids to a URL builder that returned
   * board page links rather than skipping them.
   */
  it("counts and acts on only the target's own kind in a mixed selection", () => {
    const asset = menuScope("asset", "a1", mixed, ASSETS);
    expect(asset.count).toBe(3);
    expect(asset.ids.sort()).toEqual(["a1", "a2", "a3"]);

    const board = menuScope("board", "b1", mixed, ASSETS);
    expect(board.count).toBe(2);
    expect(board.ids.sort()).toEqual(["b1", "b2"]);
  });

  it("keeps count and ids in agreement for every target in a mixed selection", () => {
    // The defect was a label naming N while the action touched a different N,
    // so the invariant worth asserting is that the two never disagree.
    mixed.forEach((id) => {
      const scope = menuScope(ASSETS.has(id) ? "asset" : "board", id, mixed, ASSETS);
      expect(scope.ids).toHaveLength(scope.count);
      expect(scope.ids).toContain(id);
    });

    // Worked out the other way round: the two kinds must exhaust the selection
    // between them, with no id counted twice and none dropped.
    const assets = menuScope("asset", "a1", mixed, ASSETS);
    const boards = menuScope("board", "b1", mixed, ASSETS);
    expect(assets.count + boards.count).toBe(mixed.size);
    expect(new Set(assets.ids.concat(boards.ids))).toEqual(mixed);
  });

  it("never returns an empty scope, even against a stale asset list", () => {
    // A menu opened while a page load is in flight could see an asset id that
    // the id set has not caught up with. One item is the right fallback; a
    // count of zero would render "Remove 0 assets".
    const scope = menuScope("asset", "a9", new Set(["a9"]), ASSETS);
    expect(scope).toEqual({ count: 1, ids: ["a9"] });
  });

  it("treats an empty selection as a scope of one", () => {
    expect(menuScope("asset", "a1", new Set(), ASSETS)).toEqual({ count: 1, ids: ["a1"] });
  });
});
