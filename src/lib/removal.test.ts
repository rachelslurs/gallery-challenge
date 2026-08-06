import { describe, expect, it } from "vitest";
import { removeByIds } from "./removal";

const items = (...ids: string[]) => ids.map((id) => ({ id }));
const LIST = items("a", "b", "c", "d");

describe("removeByIds", () => {
  it("removes the ids and decrements the total by that many", () => {
    const result = removeByIds(LIST, 761, ["b", "d"]);
    expect(result.items.map((i) => i.id)).toEqual(["a", "c"]);
    expect(result.total).toBe(759);
  });

  /*
   * The regression this exists for. The section header reads the total, which
   * only ever came from the API response, so removing an asset locally left the
   * header reporting the server's count: nine moved out of 761 and it still
   * read 761.
   */
  it("keeps the total and the list in step for any subset", () => {
    // Worked out twice: the total must fall by exactly the number of items
    // that left, for every subset of the list.
    const subsets = [[], ["a"], ["a", "b"], ["b", "c", "d"], ["a", "b", "c", "d"]];
    for (const ids of subsets) {
      const result = removeByIds(LIST, 761, ids);
      expect(761 - result.total).toBe(LIST.length - result.items.length);
    }
  });

  it("leaves both numbers alone for an id that is not in the list", () => {
    const result = removeByIds(LIST, 761, ["nope"]);
    expect(result.total).toBe(761);
    // By reference, so a removal that removes nothing cannot re-render the wall.
    expect(result.items).toBe(LIST);
  });

  it("returns the list by reference when asked to remove nothing", () => {
    expect(removeByIds(LIST, 761, []).items).toBe(LIST);
  });

  it("counts a repeated id once", () => {
    const result = removeByIds(LIST, 761, ["b", "b", "b"]);
    expect(result.items.map((i) => i.id)).toEqual(["a", "c", "d"]);
    expect(result.total).toBe(760);
  });

  it("mixes present and absent ids without over-counting", () => {
    const result = removeByIds(LIST, 10, ["a", "ghost", "c"]);
    expect(result.items.map((i) => i.id)).toEqual(["b", "d"]);
    expect(result.total).toBe(8);
  });

  it("floors the total at zero rather than going negative", () => {
    // A total lower than the loaded list should not be reachable, but a stale
    // total from a failed page would make it so, and a negative count would
    // render.
    expect(removeByIds(LIST, 2, ["a", "b", "c"]).total).toBe(0);
  });
});
