# Coffee Shaky — phone ordering app

The isolated working copy is on branch `design/liquid-glass`. The original downloaded folder is left separate. No deployment or production writes were performed.

## Preview safely

Run `python3 tools/preview.py` from this directory, then open http://127.0.0.1:4175.

This preview replaces both Firebase entry points with an in-memory kitchen. Orders are shared across the menu and barista tabs, survive page reloads, and disappear when the preview server stops. They never reach production. It displays a local-preview notice. The real `firebase-db.js`, `firebase-config.js`, hosting configuration, and rules are unchanged.

## Delivered experience

- Phone-only two-column glass menu, espresso-black surfaces, warm amber lighting, Hebrew RTL, and the original family branding.
- Eight consistent generated drink assets: the original seven menu entries plus latte. Every asset is a permanent, optimized transparent WebP in `assets/drinks/`.
- A frosted bottom sheet with selected-drink artwork, field validation, keyboard-aware placement, safe-area padding, focus containment, and a clear submission button. Changing drinks preserves the entered name and note; closing cancels the draft.
- A separate `barista.html` screen opens in a new tab from the menu. It shows only orders, with All / Ready filters, large Ready and Collected actions, and an option to undo an accidental ready mark. The customer page contains no queue or management controls.
- New confirmed orders trigger a compact name/drink notification. Tapping it opens All and focuses the new ticket, including when Ready is selected. The initial feed, repeated snapshots, and status changes stay silent. A locally synthesized two-note chime (`assets/audio/new-order.wav`, no external audio service) is enabled with one explicit tap per page session for iPhone Safari, with a mute toggle. Alerts work without sound; no lock-screen push or background delivery is promised.
- The existing real-time queue, preparing/ready/collected transitions, cancellation confirmations, offline handoff, and duplicate-pending-order prevention remain in place.
- A taped Polaroid for employee of the month. Pressing it retains the original meow/photo interaction and adds a short PUMA cat pounce with claw trails. Escape or another press dismisses it; it never intercepts ordering taps. Reduced motion uses a small still appearance.
- No Three.js, WebGL, model loader, remote 3D API, or runtime canvas. The generated images provide the dimensional product appearance.
- No new framework, package manager, or build step. The shipped application remains static HTML/CSS/JavaScript.

## Assets

Created using the built-in image generation tool. Full prompts and original reference information are recorded in `assets/asset-provenance.json`. The eight drink assets total about 620 KB; the optional cat cutout is about 215 KB. Existing original artwork files are retained for provenance, but the new menu uses the generated assets.

## Verification

`tests/verify-barista.cjs` is the current split-screen regression: it tests a real popup and shared local orders across two pages in Chrome and WebKit at 390 × 844 and 430 × 932. It covers actual audio playback after a tap, notification batching, silent status changes/reloads, opening an alert from Ready, muting, FIFO ordering, status filters, ready/undo, collected, cancellation, clearing, reloads, menu counts, offline duplicate prevention, images, viewport bounds, and zero Firebase traffic. Screenshots are `artifacts/barista-{engine}-{width}.png` and `artifacts/menu-separate-{engine}-{width}.png`.

Earlier single-page regression (before queue separation) uses `tests/browser-support.cjs` to intercept the database module and block external application traffic. `tests/verify-glass.cjs` covers ordering, validation, state changes, confirmations, keyboard viewport handling, images, reduced motion, and responsive bounds. `tests/verify-final.cjs` covers the final visual states, success messages, cat cleanup, offline handoff, duplicate prevention, and isolation of the user-facing preview.

Chrome and WebKit were run at 390 × 844 and 430 × 932, with additional 375 × 667 and landscape checks. Actual screenshots and machine-readable results are in `artifacts/`. The main regression passed 110 checks; targeted final tests also passed. Drink switching was separately verified in both engines.

The keyboard checks simulate iOS visualViewport shrink. These are real browser tests with phone emulation, not tests on a physical iPhone. Production Firebase persistence/reconnection was preserved in source and was not exercised against the live backend.

The glass fallback is an opaque espresso surface when backdrop filtering is unavailable. The app uses the same narrow phone composition in wider preview windows.
