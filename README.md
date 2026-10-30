# 纸间山谷 · 一封迟到的信

A Three.js pop-up storybook with procedural scenery and a locally bundled Blender-authored folding station. Blender is only needed to edit/rebuild the station, not to run the website.

Serve `dist/` with any static HTTP server. All JavaScript dependencies are vendored locally.

Features: orbit and zoom, two seasonal dioramas, animated curved page and folding scenery, moving miniature train, waterwheel, paper birds, planting interaction carried across time, letter ending, optional synthesized ambience. Arrow keys navigate pages.

Source: `dist/app.js`, `dist/style.css`, `dist/index.html`. Three.js r180 (MIT) in `dist/three.*.js`.

Current scope: two-page playable prototype. The station has articulated roof, wall, canopy, bracket and post joints, and foreground trees fold onto their pages. Background scenery still uses a staged compression approximation. This is not a general collision-constrained paper mechanism solver. Pinch zoom and freeform page-corner dragging remain future work.

## v0.2.0 — paper valley detail pass

The diorama now lives in `dist/diorama.js`. The shared, deterministic scenery includes winding layered cardstock banks, shallow river margins, paper mountain silhouettes, two masonry arches, a continuous supported railway, individual carriage tracking, a detailed station with a ridge roof, clock, timber canopy, luggage and postbox, folded foliage, paths, steps, fences, flower beds, watermill and moving steam.

Lighting uses a four-step toon ramp, restrained paper grain, selective edge strokes, cool fill and warm sunlight. Static geometry is merged by material; river ripples use instancing. Moving meshes and interaction targets remain separate.

Validation:

```sh
node --check dist/app.js
node --check dist/diorama.js
node scripts/verify-scene.mjs
```

The scene check constructs both seasons using real Three.js geometry and verifies finite coordinates, book-space bounds, preserved animation/raycast targets, continuous railway height, river bounds and alignment of both bridge crossings. It stubs only canvas text drawing and does not claim GPU or visual validation. The current cloud QA browser cannot create a WebGL context; visual sign-off remains outstanding on a WebGL 2 capable device.


## v0.3.0 — bound paper and articulated station

- `dist/book-body.js`: curved, closed page blocks, recessed gutter, layered fore edges, cloth binding, brass corners, printed rules and curved bookmark. The turning leaf has thickness and an integrated arc-length-preserving curl.
- `assets-source/station.blend`: editable Blender 4.5 source. `scripts/build-station.py` regenerates this source and the bundled `dist/assets/station.glb`. Four walls, two roof sheets, canopy, four posts and four brackets retain 15 named hinges.
- `dist/station-model.js`: GLB loading, shared toon-paper material replacement, batching inside individual joints, and reversible hinge poses.
- `dist/folding.js`: left/right page ownership, staged roof/wall/tree folding, page attachment during turning, and explicit fallback compression for background scenery.
- `dist/paper-style.js`: common print grain, four-step shading and restrained outline colour.
- The 6.4-second page turn pauses moving scenery, folds the station and trees, lifts the outgoing page, and unfolds the destination. The “细看车站” control provides a closer view.

Regenerate the asset with Blender 4.5 or later:

```sh
blender --background --python scripts/build-station.py
```

Run geometry, real GLB parsing, hinge, page curl and story loop checks:

```sh
node scripts/verify-scene.mjs
node scripts/verify-story.mjs
```

The folding checks verify station height reduction without whole-model vertical scaling, joint hierarchy, page ownership, restored poses, finite transforms, paper arc length, forward/backward turns and preserved story state. Blender CPU rendering is used for offline geometry inspection. It is not a substitute for visual verification of Three.js shading in a WebGL-capable browser.
