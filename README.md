# WoodPrep Lathe — v0.3.1

## Interface Rebuild

This build uses the user's composite mockup as the **authoritative spatial blueprint**, rather than treating it as a loose visual reference.

### Locked Landscape Layout

- Landscape only
- No scrolling
- Lathe fills the upper/main portion of the screen
- Speed control is embedded at the left/headstock
- Tool rest is centered below the workpiece
- Sandpaper panel is fixed lower-left
- Chisel panel is fixed lower-center
- Paint/Stain panel is fixed lower-right
- All five interactive areas remain visible simultaneously
- Compact app navigation remains fixed without displacing the approved layout

### Popup Behavior

Every interactive area slightly enlarges before its popup opens.

Replacement popups:
- Sandpaper
- Chisels
- Paint/Stain

Adjustment popups:
- Speed
- Tool Rest

Speed and Tool Rest changes preserve the active tool.

### Preserved Simulator Behavior

- Fixed-size rigid chisel
- Handle is the chisel grab point
- Workpiece rotation tied to RPM
- Visible rotation cues
- Direct cutting geometry
- Target profile
- Live position / diameter

### This Build Does Not Add

- levels
- scoring
- ads
- unlocking
- rewards
- missions

The next pass should tune proportions/graphics only if the user requests changes to this approved layout.


## v0.3.2 — Visual Selection Windows

The approved landscape layout from v0.3.1 is preserved.

Selection popups were upgraded from text-only choices to visual catalogs:

### Sandpaper
Each option now shows:
- abrasive image / grit texture
- abrasive color
- grit number
- short use description

### Chisels
Each option now shows:
- enlarged cutting-tip illustration
- distinct tip/profile geometry
- chisel name
- short purpose description
- approximate cutter width

### Paint / Stain
Each option now shows:
- large finish swatch
- stain swatches with visible wood-grain pattern
- paint swatches as opaque color
- finish type
- finish name
- short description

Selecting an option still:
1. updates the active state
2. updates the main UI
3. closes the popup
4. returns the source section to normal size

Speed and Tool Rest remain adjustment popups and continue to preserve the active working tool.
