# Air gallery challenge

A gallery view of a public Air board: 761 assets and 4 sub-boards in collapsible sections, with infinite scroll and marquee selection.

Live: https://gallery-challenge-one.vercel.app

## Run it

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # 118 tests, ~400ms
```

## Requirements status

| Requirement | Status |
| --- | --- |
| Match or improve the design | Done |
| Fetch boards and assets, collapsible sections, infinite scroll | Done |
| Marquee selection | Done, via `@air/react-drag-to-select` |
| Drag to reorder | Done |
| Drag assets into a sub-board | Done, local only: the API has no write endpoint |
| Ellipsis menu on hover | Done, reflects the selection count |
| Context menu on right click | Done, same menu and count |

All seven landed. Reordering and moving are local: the endpoints are read-only, so
there is nothing to persist to.

Both drag gestures are told apart by selection. Pressing an already-selected tile
moves it; pressing anything else draws a marquee. A marquee can start anywhere,
including on top of an image, which is how the reference gallery behaves, so a card
cannot also own pointer-down.

## Architecture

Every clip from the Air API carries intrinsic `width` and `height`. That one fact drives the whole design.

1. `src/lib/justify.ts` computes a justified-rows layout in one O(n) pass over those dimensions. No DOM measurement, no reflow. A full relayout of all 761 items costs 0.066ms.
2. `src/lib/useVirtualRange.ts` windows the list by binary-searching the cumulative row offsets. State updates only when the visible row range changes, so a continuous scroll triggers one re-render per row boundary crossed instead of one per frame.
3. `src/lib/geometry.ts` hit-tests the marquee (`cellsInBox`) against the same precomputed array. `@air/react-drag-to-select` hands you a box and leaves hit-testing to you, so selection costs O(log n + k) and touches zero DOM nodes.

Points 2 and 3 are the same binary search over the same array.

## Measured performance

Taken with Chrome DevTools against a local production build, with all 761
assets loaded.

| Measurement | Result |
| --- | --- |
| DOM with all 761 assets loaded | 41 rendered cells, 307 DOM nodes, for 43,051px of content |
| Scroll at 6x CPU throttle, 3000px/s flick | 14ms median frame gap; 22 of 118 frames over 32ms |
| Marquee sweep at 6x CPU throttle | 8ms median frame gap; p95 11ms; 0 of 88 frames over 32ms |
| Video elements at rest | 0; a preview mounts on hover and unmounts on leave, one at most |
| Cumulative layout shift | 0.00; every cell's height is known before its image loads |
| Sample photo payload | 1.4MB original; 541KB at imgix defaults; 30KB at `w=400` |
| LCP, unthrottled local production build | 278ms and 415ms on two runs of the same build |
| LCP, Lighthouse mobile simulation | 4.4s. Different methodology, not a contradiction: Lighthouse projects the hydrate-then-fetch chain onto 4x CPU and a 150ms RTT |
| Production TTFB | 2-3ms; the route is statically prerendered with `revalidate = 300` |

## Decisions

**Hand-rolled windowing instead of a virtualization library.** The justify pass already produces exact row offsets, so windowing reduces to a binary search and a slice, and the same structure serves marquee hit-testing.

**Plain `<img>` with imgix params instead of `next/image`.** imgix already resizes and negotiates format at the CDN edge; `next/image` would add a proxy hop per tile. Thumbnail widths snap to a small ladder so different viewports hit the same CDN cache entries.

**The marquee starts anywhere, including on an image.** That matches the reference gallery, and it means a card cannot also own pointer-down. The two gestures are told apart by selection instead: pressing an already-selected tile moves it, pressing anything else draws a box.

**Hover state lives in the cell, not the wall.** Video previews mount on hover. Lifting that state to the gallery would re-render every mounted tile on each pointer move between tiles; kept local, only the tile entered and the tile left re-render, and exactly one video is ever mounted.

**Decoration is pseudo-elements, not nodes.** The selection ring and the hover
tint are `::before` and `::after` rather than two extra divs per cell, and the
ellipsis is one path rather than three circles. That is 6 DOM nodes per tile
instead of 11, and 307 in the document instead of 471, with nothing rendering
differently.

**One menu and one action bar, not one per tile.** Both are driven by a target descriptor at the root. Mounting either per cell would mean 761 of them. The ellipsis is marked with a data attribute rather than given an onClick, so cells still take no callback props and keep their memoization.

**Selection is a `Set` of ids, and cells are memoized on a boolean.** A marquee sweep re-renders only the tiles whose membership changed.

**No data-fetching library.** The reorder and move-to-board requirements make the asset list client-owned mutable state, and TanStack Query is a server-state cache. It earns its ~13kB only if the list stays read-only.

**Design values measured from the reference board with devtools**, then expressed in the standard Tailwind scale: 16px between images, a 28px outer gutter, roughly 250px rows at every breakpoint, 12px radii, 15px below a section label and 39px above the next one. A narrow viewport gets fewer images per row at the same row height.

The board grid fills columns to a 184px minimum rather than dividing the width
evenly, so four boards on a wide screen sit at their natural size and
left-align instead of stretching. Card height is fixed, which is why a card is
wider than tall on a tablet and taller than wide on a desktop. Reproduced
exactly at three viewports: 2 columns at 179x160 with 8px gaps on a phone, 3 at
227x196 with 16px on a tablet, 7 at 184x196 on a desktop.

## Beyond the brief

- 110 unit tests over the pure geometry, using differential oracles: the binary searches and marquee hit-testing are checked against brute-force scans rather than fixed expectations, so a wrong oracle fails loudly. The suite caught a real bug where a stranded panorama rendered 2112px wide inside a 320px column. It is also mutation-checked: flipping the justify lookback comparison, dropping the windowing overscan, loosening rectangle edge ownership, miscounting gaps in the board grid, or swapping modifier precedence each fail a named test. All five passed silently before those tests existed.
- GitHub Actions CI runs typecheck, lint, tests, and build. A Lighthouse workflow gates on accessibility plus two deterministic performance audits, `cumulative-layout-shift` and `dom-size`. The dom-size budget is the cheapest regression test for the virtualization: un-windowing the list would blow past it, and no unit test would notice.
- Keyboard and modifier selection: shift for ranges, cmd to toggle, cmd+A, Escape. Only marquee selection was asked for.
- Rotation-aware dimension swapping for assets rotated 90 or 270 degrees.
- Duplicate-id dedup across cursor page boundaries.
- Marquee disabled on coarse pointers.
- Video previews play on hover, using the `previewVideo` asset the API already returns alongside the poster frame.
- Filename and specifications appear over a gradient on hover, matched to the reference down to type size, weight, tracking and padding.
- Tiles animate to their new positions after a reorder. Positions are content coordinates, so scrolling never changes a transform and only a reorder or a resize triggers the transition.
- Boards are selectable alongside assets, and their rects are derived from the row model rather than measured.
- Dragging a board onto a board is refused visibly: the destination turns red and the action bar explains why, rather than the gesture silently doing nothing. A mixed selection moves only its assets.
- One floating action bar owns everything transient, so the selection count, the undo after a move, and a refusal can never stack or fight for the same corner.
- An accessibility pass: the wall is one focus stop with keyboard scrolling, section labels are real headings, menus return focus to whatever opened them and close on Tab, boards gained the keyboard-reachable menu trigger assets already had, focus reveals a tile's filename overlay as hover does, animation is gated on `prefers-reduced-motion`, and two text colours that failed WCAG AA against the canvas were corrected (neutral-400 measured 2.31:1, neutral-500 4.35:1, both now neutral-600 at 7.17:1).
- The action bar names each kind when a selection mixes them, and says what that limits: boards can be selected but not moved, so "4 boards and 9 assets selected" carries "Dragging moves the assets; boards stay put".
- `.nvmrc` moved from the starter's 18.17.0 to 22.20.0, a deliberate deviation: vitest 4 requires Node 20 or later, so a CI run honoring the starter's pin would have failed before running a single test.

## Known gaps

- No per-tile keyboard navigation. The wall takes focus as one region and scrolls with the arrow keys, but selecting a specific tile needs a pointer. Doing it properly means roving tabindex or `aria-activedescendant`, both of which have to force the virtual window to include the focused index and then imperatively focus a newly mounted node. That is not a partial job, so it is not started.
- Shift-click ranges and cmd+A cover assets only. The selection holds both kinds but the ordered list behind ranges is the asset list, so a range spanning a board and an asset does nothing sensible.
- Download and Share were removed from the action bar rather than left inert: neither has an endpoint behind it.
- No drag preview follows the cursor. The insertion point is shown instead and the tile stays put until release.
- Lighthouse performance scores 85. The entire deficit is LCP: TBT is 20ms, CLS 0.001, FCP 0.8s, Speed Index 1.3s, all scoring 1.00. LCP is 4.4s and 81% of that is load delay, because the prerendered HTML contains no `<img>` tags for the preload scanner to find. Preloading the first tiles in `<head>` would reach roughly 90; passing that needs the first row server-rendered against an assumed viewport. I left it alone because the stated grading criterion is interaction under a 6x CPU throttle, and TBT at 4x is already 24ms. Air's own app prerenders no tiles either: its initial HTML contains one img, a workspace logo.
