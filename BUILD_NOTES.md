# Build Notes — v0.2.2

## Source comparison
This pass was based on direct comparison between:
- the user's current WoodPrep screen recording
- the supplied Woodturning reference recording

## Root causes corrected

### Tool contact
Previous version:
finger requests deeper handle position → wood collision clamps tip → handle/tip movement can feel resisted.

New version:
finger moves complete rigid chisel → cutter tip defines the removal envelope → wood is immediately reduced toward the tool shape.

This is closer to the supplied reference, where the tool stays visually connected to the user's motion and the workpiece disappears at the cutting edge.

### Rotation
Previous version had an internal rotation angle but weak visual cues.

New version makes that angle control several visible surface features so even at a glance the workpiece reads as spinning.

### Missing controls
`100vh` and an absolutely positioned control group could extend under Android Chrome UI.

The control dock is now fixed to the visual viewport and uses `100dvh`.

## Test
1. Chisel tray must remain visible throughout the entire session.
2. RPM knob must remain visible throughout the entire session.
3. Move the fixed-size chisel horizontally and vertically.
4. The wood should disappear exactly where the cutter engages, without the tip fighting the surface.
5. Hold the tool in one location and move it deeper: the profile should deepen smoothly.
6. Move side-to-side at fixed depth: the cut should remain smooth rather than leaving extreme saw teeth.
7. Change RPM from low to high: surface motion should become visibly faster.
8. End-cap spokes, highlights, grain bands, and bark surface should all visibly rotate/change.
