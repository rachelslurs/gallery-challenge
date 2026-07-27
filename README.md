# Air gallery challenge

A gallery view of a public Air board: 761 assets and 4 sub-boards in collapsible sections, with infinite scroll and marquee selection.

Live: https://gallery-challenge-one.vercel.app
Repo: https://github.com/rachelslurs/gallery-challenge

## Run it

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # 84 tests, ~400ms
```

## Requirements status

| Requirement | Status |
| --- | --- |
| Match or improve the design | Done |
| Fetch boards and assets, collapsible sections, infinite scroll | Done |
| Marquee selection | Done, via `@air/react-drag-to-select` |
| Drag to reorder | Not built |
| Drag assets into a sub-board | Not built |
| Ellipsis buttons and context menus | Built but not wired in: `src/components/GalleryMenu.tsx` exists and `Gallery.tsx` never imports it |

Reordering and the menus are the casualties of the four-hour limit. I spent that time on the layout and selection engine instead.

## Architecture

Every clip from the Air API carries intrinsic `width` and `height`. That one fact drives the whole design.

1. `src/lib/justify.ts` computes a justified-rows layout in one O(n) pass over those dimensions. No DOM measurement, no reflow. A full relayout of all 761 items costs 0.066ms.
2. `src/lib/useVirtualRange.ts` windows the list by binary-searching the cumulative row offsets. State updates only when the visible row range changes, so a continuous scroll triggers one re-render per row boundary crossed instead of one per frame.
3. `src/lib/geometry.ts` hit-tests the marquee (`cellsInBox`) against the same precomputed array. `@air/react-drag-to-select` hands you a box and leaves hit-testing to you, so selection costs O(log n + k) and touches zero DOM nodes.

Points 2 and 3 are the same binary search over the same array.

## Measured performance

Every number below is measured, on the deployed build, with Chrome DevTools.

| Measurement | Result |
| --- | --- |
| DOM with all 761 assets loaded | 51 rendered cells, 211 DOM nodes, for 36,858px of content |
| Scroll at 6x CPU throttle, 3000px/s flick | 9ms median frame gap; 23 of 119 frames over 32ms |
| Marquee sweep at 6x CPU throttle | 8ms median frame gap; p99 12ms; 0 of 88 frames over 32ms |
| Cumulative layout shift | 0.00; every cell's height is known before its image loads |
| Sample photo payload | 1.4MB original; 541KB at imgix defaults; 30KB at `w=400` |
| Production LCP | ~278ms |
| Production TTFB | 2-3ms; the route is statically prerendered with `revalidate = 300` |

## Decisions

**Hand-rolled windowing instead of a virtualization library.** The justify pass already produces exact row offsets, so windowing reduces to a binary search and a slice, and the same structure serves marquee hit-testing.

**Plain `<img>` with imgix params instead of `next/image`.** imgix already resizes and negotiates format at the CDN edge; `next/image` would add a proxy hop per tile. Thumbnail widths snap to a small ladder so different viewports hit the same CDN cache entries.

**The marquee starts anywhere, including on an image.** That matches the reference gallery. It also means drag-to-reorder needs a different trigger than "pointer down on a card": the plan was that dragging an already-selected item moves it and dragging anything else draws a box.

**Selection is a `Set` of ids, and cells are memoized on a boolean.** A marquee sweep re-renders only the tiles whose membership changed.

**No data-fetching library.** The reorder and move-to-board requirements make the asset list client-owned mutable state, and TanStack Query is a server-state cache. It earns its ~13kB only if the list stays read-only.

**Design values measured from the reference board with devtools**, then expressed in the standard Tailwind scale: 16px between images, a 28px outer gutter, roughly 250px rows at every breakpoint, 12px radii, 15px below a section label and 39px above the next one. A narrow viewport gets fewer images per row at the same row height.

**All mutations would be local.** The public API has no write endpoints, so any reordering or moving is optimistic by necessity.

## Beyond the brief

- 84 unit tests over the pure geometry, using differential oracles: the binary searches and marquee hit-testing are checked against brute-force scans rather than fixed expectations, so a wrong oracle fails loudly. The suite caught a real bug where a stranded panorama rendered 2112px wide inside a 320px column.
- GitHub Actions CI runs typecheck, lint, tests, and build. A Lighthouse workflow gates on accessibility plus two deterministic performance audits, `cumulative-layout-shift` and `dom-size`. The dom-size budget is the cheapest regression test for the virtualization: un-windowing the list would blow past it, and no unit test would notice.
- Keyboard and modifier selection: shift for ranges, cmd to toggle, cmd+A, Escape. Only marquee selection was asked for.
- Rotation-aware dimension swapping for assets rotated 90 or 270 degrees.
- Duplicate-id dedup across cursor page boundaries.
- Marquee disabled on coarse pointers.
- `.nvmrc` moved from the starter's 18.17.0 to 22.20.0, a deliberate deviation: vitest 4 requires Node 20 or later, so a CI run honoring the starter's pin would have failed before running a single test.

## Known gaps

- No auto-scroll while a marquee drag passes the viewport edge. `src/lib/autoScroll.ts` exists and is tested but is not wired in.
- Boards are not marquee-selectable; only assets are.
- The prerendered HTML contains no `<img>` tags, because the wall is virtualized and the visible range is empty without a scroll container. Air's own app has the same property: I checked, and its initial HTML contains one img, a workspace logo.
