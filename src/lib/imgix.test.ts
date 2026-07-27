import { describe, expect, it } from "vitest";
import { thumbnail, thumbnailSrcSet } from "./imgix";

const SRC = "https://air-prod.imgix.net/photo.jpg";

const widthParam = (url: string): number => {
  const value = new URL(url).searchParams.get("w");
  expect(value).not.toBeNull();
  return Number(value);
};

describe("thumbnail", () => {
  it("snaps requested widths up to the ladder", () => {
    expect(widthParam(thumbnail(SRC, 100, 1))).toBe(160);
    expect(widthParam(thumbnail(SRC, 160, 1))).toBe(160);
    expect(widthParam(thumbnail(SRC, 161, 1))).toBe(240);
    expect(widthParam(thumbnail(SRC, 399, 1))).toBe(400);
    expect(widthParam(thumbnail(SRC, 401, 1))).toBe(560);
  });

  it("multiplies by dpr before snapping", () => {
    // ceil(300 * 2) = 600, which snaps up to 720.
    expect(widthParam(thumbnail(SRC, 300, 2))).toBe(720);
    expect(widthParam(thumbnail(SRC, 300, 1))).toBe(320);
  });

  it("clamps widths above the largest rung to it", () => {
    expect(widthParam(thumbnail(SRC, 3000, 1))).toBe(1600);
    expect(widthParam(thumbnail(SRC, 1600, 2))).toBe(1600);
  });

  it("joins with ? when the src has no query string", () => {
    const url = thumbnail(SRC, 100, 1);
    expect(url).toBe(`${SRC}?w=160&auto=format&fit=max`);
  });

  it("joins with & when the src already has a query string", () => {
    const src = `${SRC}?rotate=90`;
    const url = thumbnail(src, 100, 1);
    expect(url).toBe(`${src}&w=160&auto=format&fit=max`);
    // Exactly one ? proves the URL stayed well-formed.
    expect(url.split("?").length).toBe(2);
  });

  it("returns an empty src unchanged", () => {
    expect(thumbnail("", 300, 2)).toBe("");
  });

  it("defaults dpr to 1 without a window and does not throw", () => {
    // Vitest runs in node, so this exercises the SSR branch of pixelRatio.
    expect(typeof window).toBe("undefined");
    expect(() => thumbnail(SRC, 100)).not.toThrow();
    expect(thumbnail(SRC, 100)).toBe(thumbnail(SRC, 100, 1));
  });
});

describe("thumbnailSrcSet", () => {
  it("emits 1x and 2x descriptors built from the same src", () => {
    const srcSet = thumbnailSrcSet(SRC, 300);
    const entries = srcSet.split(", ");
    expect(entries.length).toBe(2);
    expect(entries[0]).toBe(`${thumbnail(SRC, 300, 1)} 1x`);
    expect(entries[1]).toBe(`${thumbnail(SRC, 300, 2)} 2x`);
  });

  it("returns an empty string for an empty src", () => {
    expect(thumbnailSrcSet("", 300)).toBe("");
  });
});
