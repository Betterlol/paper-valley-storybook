# 纸间山谷 · 一封迟到的信

A fully procedural Three.js pop-up storybook. No Blender or external models required for this version.

Serve `dist/` with any static HTTP server. All JavaScript dependencies are vendored locally.

Features: orbit and zoom, two seasonal dioramas, animated curved page and folding scenery, moving miniature train, waterwheel, paper birds, planting interaction carried across time, letter ending, optional synthesized ambience. Arrow keys navigate pages.

Source: `dist/app.js`, `dist/style.css`, `dist/index.html`. Three.js r180 (MIT) in `dist/three.*.js`.

Current scope: two-page playable prototype. Folding is a staged visual approximation; scenery compresses vertically while a curved page turns. It is not a physically constrained paper hinge solver. Pinch zoom and freeform page-corner dragging are future work.

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
