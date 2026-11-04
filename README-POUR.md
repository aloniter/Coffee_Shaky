# Coffee Shaky — animated pour menu

Local experiment on `feature/coffee-pour-menu`. This download had no `.git` directory, so `main` is a local snapshot of the supplied application (`4c04127`), authored as Codex. There is no configured remote and nothing has been deployed.

## See it

```sh
python3 tools/preview.py
```

Open **http://127.0.0.1:4175/**. The default is the animated menu. Use **התפריט הקלאסי** to compare the original cards, or open **http://127.0.0.1:4175/?menu=classic**. Both modes use the same ordering sheet. The preview server replaces Firebase with the existing in-memory kitchen; orders never reach production and disappear when that server stops. Run this preview server to try orders locally.

The generated assets are included, so previewing does not require Node or an install.

## What changed

- The supplied Coffee Pour Menu is adapted to Hebrew and the six existing coffees: house, espresso, macchiato, americano, flat white and latte. Its SVG vessels, liquid simulation, springs, splashes, crema, foam and latte art are retained.
- Selecting a drink previews it. The explicit **תכינו לי…** button opens the existing order sheet. Selection alone never creates an order. Names and notes survive changing drinks; closing or sending clears the draft as before.
- Tea and custom orders keep their existing cards and validation. The animated view can be swapped for the complete original menu without reloading.
- Touch targets, RTL arrow keys, Home/End, one radio-group tab stop, Hebrew screen-reader labels and focus return are supported. Hover does not silently change a drink. Reduced motion fills the vessel without the pouring sequence. Unmounting the animated view cancels its animation loop.
- If the React bundle is missing or rendering fails, the original eight-card menu remains usable. Existing barista behavior and Firebase modules are unchanged.

Recipes are visual interpretations of existing menu descriptions, not measured kitchen recipes. They introduce no claimed serving volumes. The warm paper panel deliberately follows the supplied component while retaining Coffee Shaky's existing Rubik, wordmark, dark background and family photograph.

## Source and build

The static application now uses a React island for this feature. It is not necessary to migrate the order or barista screens.

- `components/ui/coffee-pour-menu.tsx`: reusable supplied component, adapted for the app.
- `components/coffee-pour-demo.tsx`: supplied four-drink example and creator attribution.
- `src/coffee-pour.tsx`: Hebrew drink data, display switch and order bridge.
- `styles/coffee-pour.css`: feature styles plus Tailwind utilities. Utilities use the `cp:` prefix and omit Preflight so they do not reset the existing app.
- `lib/utils.ts`: shadcn-compatible `cn` helper, with the Tailwind prefix configured.
- `components.json`: shadcn aliases and TypeScript configuration. `@/components/ui` is the canonical reusable component path, so copied components and future shadcn additions resolve consistently. No shadcn initialization or framework migration is required.
- `tools/build-pour.mjs`: esbuild creates the self-contained browser bundle. No React, Motion or Tailwind CDN is used.
- `assets/coffee-pour.{js,css}` and the generated legal notice are checked in for static preview/delivery. Rebuild after editing source.

```sh
npm ci
npm run typecheck
npm run build
```

The JavaScript bundle is about 415 KB uncompressed / 130 KB gzip. Production testing should include a real iPhone; browser emulation is used here.

## Verification

Verified on 2026-11-04: TypeScript and build pass; all 14 pour scenarios pass; the complete Chrome/WebKit barista regression passes, including both phone widths and offline duplicate prevention. Browser runs recorded zero production Firebase traffic. Screenshots were inspected at phone, tablet and desktop widths. An earlier WebKit run hit an intermittent localhost request rejection during reload; the complete final rerun passed without changing application behavior.

With the local preview server running:

```sh
npm run test:pour
npm run test:barista
```

`test:pour` uses intercepted in-memory database calls in Chrome and WebKit at 375×667, 390×844, 430×932, 1440×900 and 844×390. It covers real rendered liquid/vessel changes, selection without ordering, the submitted drink/name/note, draft preservation, focus return, RTL keyboard controls, rapid selection, classic view, custom-order validation, touch sizes, horizontal bounds, reduced motion and missing-bundle fallback. Results and screenshots are written to `artifacts/pour-*`.

`test:barista` uses the local preview kitchen across real menu/barista pages. It exercises the original classic menu using `?menu=classic` and covers alerts, audio, ready/undo/collected transitions, cancellation, reload and offline handling. Neither suite permits production Firebase traffic.

The taste-skill layout inspection uses the Framed sheet direction (seed 2069817677), scoped to the new selector. The screen's question is “Which coffee do I want?” Its identifying element is the house drink poured into the supplied vessel. The existing phone-sized shell and requested pour illustration take precedence over desktop dashboard proportions. The inspection allows existing gradient/button styling; remaining visual warnings refer to retained branding, the phone-width desktop shell and small secondary labels. New controls have at least 44px touch targets. The source linter's shadow warnings are SVG cup shadows in the supplied illustration.

Original component: **Coffee Pour Menu, designed and built by Aakash Mehra**, as supplied in the attached brief. Reference: https://aakashmehra.com/ref/coffeepourmenu. No stock assets were necessary: the provided SVG and existing drink artwork cover the feature.
