# 纸间山谷 · 一封迟到的信

A fully procedural Three.js pop-up storybook. No Blender or external models required for this version.

Serve `dist/` with any static HTTP server. All JavaScript dependencies are vendored locally.

Features: orbit and zoom, two seasonal dioramas, animated curved page and folding scenery, moving miniature train, waterwheel, paper birds, planting interaction carried across time, letter ending, optional synthesized ambience. Arrow keys navigate pages.

Source: `dist/app.js`, `dist/style.css`, `dist/index.html`. Three.js r180 (MIT) in `dist/three.*.js`.

Current scope: two-page playable prototype. Folding is a staged visual approximation; scenery compresses vertically while a curved page turns. It is not a physically constrained paper hinge solver. Pinch zoom and freeform page-corner dragging are future work.
