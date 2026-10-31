# Valley Art Direction Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user has authorized implementation in this session.

**Goal:** Establish a richer spring station, bridge and valley visual baseline while preserving the two-page story.

**Architecture:** Keep deterministic procedural scenery and common paper materials. Add a focused scenery-detail module and explicit hinged skyline panels; clip static meshes at the gutter. Refine the Blender station within existing joints.

**Tech Stack:** Three.js r180, ES modules, Blender 5.2.2, Python and Node.

**Spec:** `docs/superpowers/specs/2026-10-31-valley-art-direction-design.md`

## Global Constraints

- Two pages; buildless and local; preserve user files and Sites identity; no publish.
- Synchronize Blender source and GLB; retain 15 existing station hinges.
- Do not equate geometry tests with browser visual acceptance.

## Review Focus

- Gutter intersections: no triangles extend into the opposite page; interpolated UVs remain continuous.
- Panel folds: no vertical scaling; reversible poses and correct page ownership.
- New details: no invalid geometry, no lost click or animation targets, bounded draw calls.
- Autumn: identical geographic anchor for hero tree; readable station and letter scene.
- Local rebuild: palette and named station hinges survive localized Blender export.

## Task 1: Geometry and paper mechanisms

- [x] Add regression checks for clipped area, UV interpolation and reversible mountain panels; observe failure.
- [x] Replace center-based splitting with plane clipping; register independent paper panels in folding carriers and curved-page follow.
- [x] Build six layered mountain half-panels with a central valley and paper-cut facets.
- [x] Run geometry and story checks.

## Task 2: Visual baseline and Blender details

- [x] Refine clustered trees, hero placement, river/bridge/retaining-wall details in `dist/diorama.js` and `dist/valley-details.js`.
- [x] Adjust lighting, camera and paper grain in `dist/app.js` and `dist/paper-style.js`.
- [x] Add station details under existing Blender hinges; regenerate source and runtime asset; run export, geometry and story checks.

## Task 3: Browser verification and review

- [x] Capture actual WebGL spring, close-up, autumn and controlled fold/turn views; iterate on visible defects.
- [x] Review changes independently, resolve important findings and rerun affected checks.
- [x] Document evidence, known remaining approximations and local usage; commit only task files.

## Execution notes

Reusing the current checkout on `codex/paper-valley-art-direction` as required by the desktop workspace preference. Existing untracked handoff files and the previously added export checker remain intact. No new worktree, publication or dependency installation is needed.

## Completion ledger

- Task 1 complete: RED gutter regression observed; exact clipping and reversible panel mechanisms pass.
- Task 2 complete: Blender assets regenerated, original material colors preserved, story and geometry checks pass.
- Task 3 complete: WebGL desktop/portrait and controlled intermediate poses inspected; independent review findings fixed with RED/GREEN normal-alignment checks.
- Ruling: Portrait cropping found during browser QA was corrected with adaptive framing, fog and clipping distance; projection checks added for 390×844 and 320×1200. This supports the approved camera-quality scope.
- Remaining approximations and measured rendering cost are recorded in docs/visual-baseline-2026-10-31.md.
