import { describe, expect, it } from "vitest";
import { resolveBar, type BarInput } from "./selectionBar";

const input = (overrides: Partial<BarInput> = {}): BarInput => ({
  notice: null,
  moved: null,
  assets: 0,
  boards: 0,
  ...overrides,
});

const MOVED = { count: 3, board: "Merch" };

describe("resolveBar", () => {
  it("hides when nothing is selected and nothing has happened", () => {
    expect(resolveBar(input())).toEqual({ kind: "hidden" });
  });

  it("reports a selection, naming both kinds", () => {
    expect(resolveBar(input({ assets: 2, boards: 0 }))).toEqual({
      kind: "selection",
      assets: 2,
      boards: 0,
      mixed: false,
    });
    expect(resolveBar(input({ assets: 2, boards: 1 }))).toEqual({
      kind: "selection",
      assets: 2,
      boards: 1,
      mixed: true,
    });
  });

  it("marks a selection mixed only when both kinds are present", () => {
    expect(resolveBar(input({ assets: 5, boards: 0 })).kind === "selection").toBe(true);
    for (const [assets, boards, mixed] of [
      [5, 0, false],
      [0, 5, false],
      [1, 1, true],
    ] as const) {
      const state = resolveBar(input({ assets, boards }));
      expect(state.kind === "selection" && state.mixed).toBe(mixed);
    }
  });

  it("offers undo after a move while nothing is selected", () => {
    expect(resolveBar(input({ moved: MOVED }))).toEqual({
      kind: "moved",
      count: 3,
      board: "Merch",
    });
  });

  /*
   * The regression this exists for: after a move, selecting something left the
   * bar still offering to undo the move, so it described the previous action
   * while a new selection sat underneath it.
   */
  it("drops the undo offer as soon as something is selected", () => {
    const state = resolveBar(input({ moved: MOVED, assets: 1 }));
    expect(state.kind).toBe("selection");
    expect(state).toEqual({ kind: "selection", assets: 1, boards: 0, mixed: false });
  });

  it("drops the undo offer for a board selection too", () => {
    expect(resolveBar(input({ moved: MOVED, boards: 2 })).kind).toBe("selection");
  });

  it("lets a refusal outrank both a selection and an undo offer", () => {
    const state = resolveBar(input({ notice: "Boards cannot be moved", moved: MOVED, assets: 4 }));
    expect(state).toEqual({ kind: "notice", message: "Boards cannot be moved" });
  });

  it("treats negative counts as empty rather than as a selection", () => {
    expect(resolveBar(input({ assets: -1, boards: -2 }))).toEqual({ kind: "hidden" });
    expect(resolveBar(input({ assets: -1, moved: MOVED })).kind).toBe("moved");
  });
});
