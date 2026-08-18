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


## v0.3.3 — Visual Corrections + Active Finish Tool

This update keeps the approved v0.3.1 layout and fixes the issues reported in v0.3.2.

### Sandpaper popup
- Each grit now has a different illustrated sheet color/style.
- The options no longer all look the same.
- Cards still show the grit number and use description.

### Chisel popup
- Chisel cards now use larger illustrated tool drawings with clearer tip forms.

### Active finish behavior
- Selecting a finish now changes the wood color on the lathe.
- Paint finishes appear opaque.
- Stains tint the wood while keeping a wood-like appearance.
- Finish mode now shows a brush tool on-screen with the selected color on the tip.

### Active replacement tools
- Chisel selection makes the chisel the visible active tool.
- Sandpaper selection makes the sandpaper the visible active tool.
- Finish selection makes the brush the visible active tool.
