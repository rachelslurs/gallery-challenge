# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm i            # required first: node_modules is not checked in and not installed
npm run dev      # dev server on http://localhost:3000
npm run build    # production build
npm run lint     # next lint, config is next/core-web-vitals
```

There is no test framework, no test script, and no test files in this repository. There is no command to run a single test until one is added.

## What is built and what is not

This is a take-home challenge scaffold. The data layer is written and working; the UI is not. `src/app/page.tsx` returns an empty `<main>`. Building the gallery is the task.

The Tailwind `content` globs in `tailwind.config.ts` already list `./src/components/**` and `./src/pages/**`. Neither directory exists, which is where new components are expected to go.

## `src/app/api/` holds client-side fetch wrappers

`api/boards.ts` and `api/clips.ts` are plain `fetch` wrappers that components import directly. The App Router only serves files named `route.ts`, so Next.js does not expose these as endpoints. They call `https://api.air.inc/shorturl/...` from wherever they are invoked.

Both hardcode the same two constants, duplicated across the files: board id `c74bbbc8-602b-4c88-be71-9e21b36b0514` and short id `bDkBvnzpB`. The endpoints are public and unauthenticated, so there are no API keys or env vars. The API reflects the request `Origin`, so calling it from the browser on the dev server works without a proxy.

## Response shapes differ between the two endpoints

`fetchBoards()` returns `{ data: Board[], total, pagination }`. `fetchAssets()` returns `{ data: { total, clips: Clip[] }, pagination }`, nesting the array one level deeper under `data.clips`.

## Pagination is where the work is

`fetchBoards()` takes no arguments and hardcodes `cursor: null` with `limit: 30`. The board returns 4 sub-boards with `hasMore: false`, so it is single-page by construction. Paginating boards means editing the function signature.

`fetchAssets({ cursor })` accepts a cursor and requests `limit: 24` against 761 clips, returning `hasMore: true` and an opaque cursor string. Clips are the paginated surface: feed `pagination.cursor` back in to get the next page. Scroll-driven incremental loading needs a client component; a load-more link driven by `searchParams` does not.

## Images

`Clip.assets.image` points at `air-prod.imgix.net` and is present on every clip, including videos, where it serves as the poster frame. Video clips additionally carry `video`, `previewVideo`, and `seekVideo`. Every clip carries `width` and `height`, so a masonry layout can compute aspect ratios without measuring loaded images.

Source files are large: one sample photo is 5616x3744 with a `size` of 1.4 MB. Its imgix URL returns 541 KB at default parameters, and `?w=400&auto=format` brings it to 30 KB. imgix query params work on these URLs, so use them for grid thumbnails.

`next.config.js` is an empty config object. Using `next/image` requires adding the imgix host to `images.remotePatterns` first. A plain `<img>` needs no configuration.

## The TypeScript interfaces are hand-written approximations

`strict: true` is on, and the declared types drift from the live payload in both directions. `workspaceName` and `workspaceImage` are typed as required `string` on `Clip` but are absent from the response, so reading them typechecks and yields `undefined`. `title` and `description` are typed `string | undefined` but come back as `null`. The response also carries fields the interface omits, including `pos`, `tags`, `smartTags`, `displayName`, and `ownerAvatar`.

Check a field against an actual response before relying on its declared optionality.

## Toolchain

`.nvmrc` pins Node 18.17.0. The installed version is 22.20.0. Path alias `@/*` resolves to `./src/*`.

## Measurement gotchas

Every one of these produced a confident, plausible, wrong number in this repo.
The common shape is a measurement that cannot fail: it reports something even
when the thing under test is not running.

**Assert the page hydrated before trusting any browser measurement.** An
unhydrated page still answers `scrollTop`, still runs `requestAnimationFrame`,
and still yields a tidy frame-gap distribution. It is just measuring an empty
document. `document.querySelectorAll('[data-asset-id]').length === 0` means
abort, not "0 cells". The un-hydrated shell here is ~35 nodes and 326px tall.

**`next build` while `next dev` is running clobbers the dev server.** Both write
`.next`. The dev server then serves chunk URLs that no longer exist, the page
never hydrates, and it looks like a code regression. Stop dev before building.

**`next start` fails silently on a busy port.** It logs `EADDRINUSE` to its own
log and exits, leaving whatever already owned the port answering. After a
rebuild that old server serves a stale prerender referencing deleted chunks.
Verify the served build is coherent before measuring:
`curl -s localhost:PORT | grep -o '/_next/static/chunks/webpack-[a-z0-9]*\.js'`
then fetch it and require a 200. A 404 means the numbers are worthless.

**Synthetic mouse events do not trigger CSS `:hover`.** `dispatchEvent(new
MouseEvent('mouseover'))` runs React handlers but never matches `:hover` or
`group-hover`, so anything gated on them appears broken or, worse, appears
fixed. Use a real pointer hover. React's `onMouseLeave` is synthesised from
`mouseout`, not `mouseleave`, so a synthetic `mouseleave` does nothing either.

**Reading an element's resting state proves nothing about its hover state.**
Checking that a hover overlay computes `opacity: 0` while not hovering passes
whether or not the suppression works.

**Viewport emulation resets without saying so.** Closing tabs and reloading
dropped an emulated 1440x900 back to 500x700 here. The gallery then mounted 20
tiles instead of 51 and scrolled beautifully, because it was a quarter of the
work. Assert `window.innerWidth` is what you set before recording anything;
frame timings are meaningless without the viewport they were taken at.

**Machine load dominates frame timings, by more than the code does.** The same
build measured an 8ms median scroll idle and 39ms with a dev server and five
browser tabs alongside it. That is wide enough to invent a regression that does
not exist, and it did: an afternoon went into hunting a paint cost that was a
busy laptop. Stop the dev server and close spare tabs before measuring.

**Repeat every run and check for drift.** Three runs reading 56, 58, 85 are not
a number; three reading 8, 8, 8 are. Monotonic climb across runs means the
machine is the variable. Report a median of repeated runs, never a single one.

**The guard that makes a browser measurement worth reading**, all four before
touching a timer: the viewport is what you set, the page hydrated, the data
finished loading, and the served build is coherent. Return an `aborted` reason
instead of a number when any fails, so a broken run is obvious rather than
plausible.

## Tailwind in this repo

Pinned at 3.3.7, so utilities added in 3.4 silently produce no CSS: `size-*`
and numeric `min-h-<n>` both did nothing here and were replaced with arbitrary
values. When a class appears in the DOM but the computed style is unchanged,
check the version before debugging the component.

Two utilities setting the same property in one class list let the stylesheet
order decide, not the order they are written. `ring-transparent` alongside
`ring-blue-500` rendered nothing while both appeared in `className`. Set such a
property in exactly one branch of the condition.

Tailwind's `group-hover:` resolves at a higher specificity than a plain
attribute selector, so a rule meant to override it needs `!important` or more
specificity.

## Shell

`cd` inside a compound command persists for later commands in the same session.
A `cd node_modules/...` here left a subsequent `npx tsc --noEmit` running in the
wrong directory, where it found nothing and reported success. Prefer absolute
paths, and be suspicious of a check that passes instantly.
