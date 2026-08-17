# Build Notes — v0.1.1

## Corrected packaging rule

Bird requested GitHub-ready ZIPs with **no folders inside the ZIP**. This build follows that rule exactly: every project file is at ZIP root.

## Current subsystem

CORE CUTTING ENGINE — prototype

Do not add sanding, wood species, finish coats, stencils, or multiple chisels until the basic cut behavior is accepted.

## Test

1. Open the app.
2. Change RPM and confirm the grain motion changes speed.
3. Touch/drag along the wood.
4. Push upward into the blank to remove material.
5. Move across the piece while maintaining depth.
6. Release and confirm removed material does not return.
7. Reset the blank.
8. Confirm position and diameter readouts update.

## Next after approval

- lock core profile/cutting logic
- add 6–8 chisel geometries
- add side-to-side and up/down chisel angles
