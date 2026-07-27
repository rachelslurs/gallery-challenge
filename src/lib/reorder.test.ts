import { describe, expect, it } from "vitest";
import { cellAtPoint, dropTargetAt, moveItems, removeItems, type Positioned } from "./reorder";

// Two cells side by side plus one on a second row, so shared-edge points have
// a neighbour to lose them to.
const cellA: Positioned = { id: "a", x: 0, y: 0, w: 100, h: 50 };
const cellB: Positioned = { id: "b", x: 100, y: 0, w: 80, h: 50 };
const cellC: Positioned = { id: "c", x: 0, y: 50, w: 100, h: 50 };
const cells = [cellA, cellB, cellC];

describe("cellAtPoint", () => {
  it("returns the cell containing the point", () => {
    expect(cellAtPoint(cells, 50, 25)).toBe(cellA);
    expect(cellAtPoint(cells, 150, 10)).toBe(cellB);
  });

  it("returns null when the point is over no cell", () => {
    expect(cellAtPoint(cells, 500, 500)).toBeNull();
    expect(cellAtPoint(cells, 150, 75)).toBeNull();
  });

  it("treats the left and top edges as inside", () => {
    expect(cellAtPoint(cells, 0, 0)).toBe(cellA);
    expect(cellAtPoint(cells, 0, 50)).toBe(cellC);
    // The shared vertical edge belongs to the cell on the right.
    expect(cellAtPoint(cells, 100, 25)).toBe(cellB);
  });

  it("treats the right and bottom edges as outside", () => {
    expect(cellAtPoint([cellB], 180, 25)).toBeNull();
    expect(cellAtPoint([cellA], 50, 50)).toBeNull();
  });

  it("returns null for an empty cell array", () => {
    expect(cellAtPoint([], 10, 10)).toBeNull();
  });
});

describe("dropTargetAt", () => {
  const order = ["a", "b", "c"];

  it("yields before with the cell's index in the left half", () => {
    expect(dropTargetAt(order, cells, 10, 25)).toEqual({ id: "a", side: "before", index: 0 });
    expect(dropTargetAt(order, cells, 110, 25)).toEqual({ id: "b", side: "before", index: 1 });
  });

  it("yields after with index + 1 in the right half", () => {
    expect(dropTargetAt(order, cells, 90, 25)).toEqual({ id: "a", side: "after", index: 1 });
    expect(dropTargetAt(order, cells, 170, 25)).toEqual({ id: "b", side: "after", index: 2 });
  });

  it("resolves the exact midpoint to after", () => {
    // cellA spans x 0..100, midpoint 50.
    expect(dropTargetAt(order, cells, 50, 25)).toEqual({ id: "a", side: "after", index: 1 });
  });

  it("returns null over empty space", () => {
    expect(dropTargetAt(order, cells, 500, 500)).toBeNull();
  });

  it("returns null when the cell's id is not in orderedIds", () => {
    expect(dropTargetAt(["a", "b"], cells, 10, 75)).toBeNull();
  });
});

describe("moveItems", () => {
  const base = ["a", "b", "c", "d", "e"];

  const expectSameIds = (result: string[], input: readonly string[]): void => {
    expect(result).toHaveLength(input.length);
    expect(result.slice().sort()).toEqual(input.slice().sort());
  };

  it("shifts the slot left when the moved item came from before it", () => {
    // insertIndex 4 addresses the original array; removing b makes it slot 3.
    const result = moveItems(base, ["b"], 4);
    expect(result).toEqual(["a", "c", "d", "b", "e"]);
    expectSameIds(result, base);
  });

  it("moves a single item backward", () => {
    const result = moveItems(base, ["d"], 1);
    expect(result).toEqual(["a", "d", "b", "c", "e"]);
    expectSameIds(result, base);
  });

  it("moves a contiguous block forward", () => {
    const result = moveItems(base, ["b", "c"], 5);
    expect(result).toEqual(["a", "d", "e", "b", "c"]);
    expectSameIds(result, base);
  });

  it("moves a contiguous block backward", () => {
    const result = moveItems(base, ["c", "d"], 0);
    expect(result).toEqual(["c", "d", "a", "b", "e"]);
    expectSameIds(result, base);
  });

  it("gathers a non-contiguous selection into one block", () => {
    const result = moveItems(base, ["a", "e"], 2);
    expect(result).toEqual(["b", "a", "e", "c", "d"]);
    expectSameIds(result, base);
  });

  it("keeps relative order from orderedIds even when movingIds disagrees", () => {
    const result = moveItems(base, ["e", "a"], 2);
    expect(result).toEqual(["b", "a", "e", "c", "d"]);
    expectSameIds(result, base);
  });

  it("moves to index 0", () => {
    const result = moveItems(base, ["c"], 0);
    expect(result).toEqual(["c", "a", "b", "d", "e"]);
    expectSameIds(result, base);
  });

  it("moves to the end", () => {
    const result = moveItems(base, ["b"], 5);
    expect(result).toEqual(["a", "c", "d", "e", "b"]);
    expectSameIds(result, base);
  });

  it("clamps insertIndex beyond the end", () => {
    const result = moveItems(base, ["b"], 99);
    expect(result).toEqual(["a", "c", "d", "e", "b"]);
    expectSameIds(result, base);
  });

  it("clamps a negative insertIndex to 0", () => {
    const result = moveItems(base, ["d"], -3);
    expect(result).toEqual(["d", "a", "b", "c", "e"]);
    expectSameIds(result, base);
  });

  it("ignores moving ids not present in orderedIds", () => {
    expect(moveItems(base, ["x"], 3)).toEqual(base);
    const result = moveItems(base, ["x", "b"], 4);
    expect(result).toEqual(["a", "c", "d", "b", "e"]);
    expectSameIds(result, base);
  });

  it("handles duplicate ids in movingIds once", () => {
    const result = moveItems(base, ["b", "b"], 4);
    expect(result).toEqual(["a", "c", "d", "b", "e"]);
    expectSameIds(result, base);
  });

  it("returns the same order for empty movingIds", () => {
    expect(moveItems(base, [], 2)).toEqual(base);
  });

  it("moving a contiguous block to its own position is a no-op in value terms", () => {
    expect(moveItems(base, ["b", "c"], 1)).toEqual(base);
    // insertIndex just past the block lands it back in place too.
    expect(moveItems(base, ["b", "c"], 3)).toEqual(base);
  });

  it("preserves length and id set across a sweep of insert positions", () => {
    const movingCases: string[][] = [["a"], ["c"], ["e"], ["a", "c"], ["b", "d", "e"], base.slice()];
    for (const moving of movingCases) {
      for (let at = -1; at <= base.length + 1; at += 1) {
        expectSameIds(moveItems(base, moving, at), base);
      }
    }
  });

  it("does not mutate its inputs", () => {
    const ids = ["a", "b", "c"];
    const moving = ["a"];
    moveItems(ids, moving, 3);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(moving).toEqual(["a"]);
  });
});

describe("removeItems", () => {
  it("removes the given ids and preserves the order of the rest", () => {
    expect(removeItems(["a", "b", "c", "d"], ["b", "d"])).toEqual(["a", "c"]);
  });

  it("ignores unknown ids", () => {
    expect(removeItems(["a", "b"], ["x", "b"])).toEqual(["a"]);
    expect(removeItems(["a", "b"], [])).toEqual(["a", "b"]);
  });

  it("does not mutate its inputs", () => {
    const ids = ["a", "b", "c"];
    const removing = ["b"];
    removeItems(ids, removing);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(removing).toEqual(["b"]);
  });
});
