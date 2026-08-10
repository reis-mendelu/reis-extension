# Dev webapp: auto-switch to phone layout on narrow viewport

**Date:** 2026-08-03
**Status:** Implemented — `fd8e4331` (resolver + tests), `d65fd306` (wiring)

## Problem

Setting the browser pane's Mobile preset (375×812) on `localhost:3000` resizes the
viewport but leaves the app in the desktop layout — squeezed sidebar, week grid cut
off at Friday. Reaching the phone UI requires manually appending `?mobile=1`.

The cause is deliberate. `resolvePhoneViewport` decides phone-ness as:

```ts
return isTouch && isNarrow;
```

`isNarrow` tracks width and updates on resize. `isTouch` comes from
`matchMedia('(pointer: coarse)')`, which a resized desktop browser never satisfies —
that needs touch emulation, which the viewport preset does not provide. So the
narrow-width half flips and the touch half never does, and the app stays desktop.

The strictness is intentional and stays: a narrow desktop window should keep the
desktop UI, and a tablet should keep the desktop UI. Only the dev webapp's
developer-facing affordance changes.

## Scope

Dev webapp only. The shipped extension keeps the strict `isTouch && isNarrow` rule
and its behavior is unchanged.

"Dev webapp only" is not the same as "nothing else is affected" — `npm run
verify:ui` drives the dev webapp, so it is downstream of this change. `shot.ts`
builds its Playwright context with no `hasTouch`, and its three widths
(320/390/430) are all below the 767px breakpoint, so its runs previously measured
the desktop tree squeezed narrow and now measure the phone shell. That is the more
useful measurement for a mobile-width check, but it does invalidate baselines from
earlier runs. Documented in `.claude/skills/verify-ui/SKILL.md`, along with
`?mobile=0` as the way to measure the narrow desktop tree.

## Design

### Pure decision function

New `src/utils/resolveDevPhoneOverride.ts`, alongside the existing
`resolvePhoneViewport.ts` and following the same pattern — pure, DOM-free, testable:

```ts
export interface DevPhoneOverrideInput {
  /** The `?mobile=` query param value, or null when absent. */
  param: string | null;
  isNarrow: boolean;
}

export function resolveDevPhoneOverride({ param, isNarrow }: DevPhoneOverrideInput): boolean {
  if (param === '1') return true;
  if (param === '0') return false;
  return isNarrow;
}
```

An explicit `?mobile=1` / `?mobile=0` pins the layout and wins over width. This is
load-bearing in two ways:

- `e2e/serenity/specs/mobile-shell.spec.ts:122` drives the phone branch with
  `?mobile=1`. Pinning keeps that spec passing.
- It preserves the manual escape hatch for forcing desktop at a narrow width.

Unpinned and wide returns `null`, the store's "defer to the viewport" value, not
`false`. The two are behaviourally identical — the wide case implies
`isNarrow === false`, so the `isTouch && isNarrow` fallback is false regardless —
but `null` states what is meant. `false` would assert a desktop override nobody
asked for, which is a latent trap if a future reader ever distinguishes the two.

### Wiring

`dev/phoneOverride.ts` changes from a one-shot param read to:

1. Read the `?mobile=` param once at module load.
2. Set `devPhoneOverride` from `resolveDevPhoneOverride({ param, isNarrow })`, taking
   `isNarrow` from the store's current state.
3. When no param pins the value, `useAppStore.subscribe` to `isNarrow` and re-apply
   the resolver on every change.

Subscribing to the store rather than adding a fourth
`matchMedia('(max-width: 767px)')` call is deliberate: `isNarrow` is already seeded
synchronously at store creation (`createViewportSlice.ts:17`) and kept live by
`AppShell.tsx:23`. This introduces no new media query and no new copy of the 767px
threshold to drift from the other three.

The file stays `import.meta.env.DEV`-guarded and stays imported only by
`dev/main.web.tsx`, the standalone-webapp entry.

### Resulting behavior

| Viewport preset | Layout |
|---|---|
| Mobile (375×812) | Phone |
| Tablet (768×1024) | Desktop — consistent with the existing "a tablet stays desktop" intent |
| Responsive / wide | Desktop |

Switching between presets updates live; no reload needed.

## Production safety

The only new file that could reach the extension bundle is the pure resolver, which
the extension entry never imports and which tree-shakes out. `resolvePhoneViewport`
is untouched.

## Testing

Unit tests for the resolver, written first, covering its three branches:

- `param: '1'` returns true regardless of `isNarrow`
- `param: '0'` returns false regardless of `isNarrow`
- `param: null` falls through to `isNarrow` in both directions

Tests live in `src/utils/__tests__/` — vitest's `include` covers `src/**` and
`scripts/**` only, so a test placed in `dev/` would silently never run. This is the
reason the resolver lives in `src/utils/` rather than beside its wiring in `dev/`.

Manual verification: load `localhost:3000` at the Mobile preset with no query param
and confirm the phone shell (bottom tab bar) renders.
