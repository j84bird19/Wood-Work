# Build Notes — v0.2.1

## Root cause

In v0.2.0 the tip was clamped to the wood surface while the handle remained at the finger position. The distance between them therefore changed, visually stretching and shrinking the chisel.

## Correction

The chisel is now a rigid body.

- Fixed tip-to-handle distance
- Fixed shaft width
- Fixed ferrule dimensions
- Fixed handle dimensions
- Constant 1.16 visual scale

When contact occurs, the current wood surface clamps the entire tool. The user's finger may continue requesting a deeper position, but the tool itself only advances as the wood is actually removed.

## Test

1. Move the chisel through open space — its size should never change.
2. Move left/right — its size should never change.
3. Push into the wood — the shaft should not stretch.
4. Hold pressure — the wood should cut away and the whole chisel should gradually advance.
5. Pull away — the whole tool should withdraw together.
