# WoodPrep Turning Simulator — v0.2.2

Flat GitHub-ready build. There are no folders inside the ZIP.

## v0.2.2 fixes

### 1. Chisel ↔ wood interaction rebuilt
The chisel remains a fixed-size rigid object, but the cutting geometry now follows the reference-app interaction more closely.

- Handle directly moves the complete chisel.
- Tip position directly defines the cutter envelope.
- Wood is carved toward that envelope immediately while contact is maintained.
- The wood no longer blocks the chisel and creates the "fighting / lagging" effect.
- Tool width and tip shape control the shape of the cut.
- The radius model still makes the cut symmetrical around the spinning workpiece.
- Chips are generated at the actual contact point.

### 2. Wood rotation is now visually obvious
RPM was previously changing the internal rotation value, but the surface did not communicate that motion clearly.

New cues:
- rotating bright reflection
- rotating opposite-side shadow
- animated grain bands
- bark tones/faces cycle as the blank turns
- rotating end-cap spokes
- animation speed remains tied to RPM

### 3. Chisels + speed control are now fixed navigation
The chisel tray and RPM knob use a fixed bottom control dock.

- Always visible above the phone/browser bottom edge
- Uses dynamic viewport height (`100dvh`)
- Does not scroll with the simulator
- Chisel movement is constrained so the handle stays above the dock
- Tool tray and RPM knob remain interactive at all times

## Preserved
- fixed-size chisel
- slightly enlarged chisel
- handle-only grab
- three prototype chisel shapes
- target profile
- rough-to-turned wood appearance
- 200–3200 RPM rotary knob
- live position and diameter
- no levels, points, unlocking, rewards, or ads
