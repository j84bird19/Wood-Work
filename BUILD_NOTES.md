# Build Notes — v0.2.0

## Why this is a larger revision

The supplied reference video clarified that the desired interaction is a fixed side/profile turning view, not a first-person/perspective lathe scene.

The previous perspective presentation was therefore replaced rather than patched.

## Locked concepts preserved

- Handle is the touch target.
- Material removal is persistent.
- Cutting tip may only take a small bite at the current surface.
- RPM is controlled by a rotary knob.
- No game systems.
- Flat GitHub package.

## Test these specific behaviors

1. The blank should look like a rough horizontal piece of wood against the teal work area.
2. A black target profile should stay visible over the blank.
3. The chisel should stand upright below the blank.
4. Touching anywhere except the handle should NOT grab the chisel.
5. Grab the handle and move left/right: the whole tool should follow.
6. Push the handle upward: the cutting edge should contact the current bottom surface.
7. Hold a deeper position: the wood should remove gradually, not let the steel pass through it.
8. Move horizontally while cutting: a continuous turned profile should form.
9. Cut areas should reveal smoother orange wood.
10. Chips should fall from the actual contact area.
11. Select each tool in the wooden tray; the green selected state should move.
12. Different tools should leave visibly different cut widths/profiles.
13. The RPM knob must still rotate clockwise/counterclockwise and change speed.
