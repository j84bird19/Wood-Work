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


## v0.3.4 — Universal Contact Behavior

The approved landscape UI is unchanged. This build implements one working rule for all active tools: **the exact contact area is the only area affected.**

- Chisel removes material under its cutter profile.
- Sandpaper can now be grabbed and moved; it locally smooths/removes tiny amounts and creates dust.
- Paint/stain no longer recolors the entire blank when selected. The brush can be grabbed and applies finish only where its loaded tip touches.
- Paint builds more opaque than stain.
- Chiseling or sanding can locally disturb an existing finish.
- All active tools stay fixed-size.
- Speed and tool-rest adjustment behavior is preserved.


## v0.3.4 — Tool Visibility Hotfix

Corrected a regression where replacement selections could become active in state
without being positioned visibly in the lathe workspace.

After selecting:
- a chisel -> selected chisel is immediately placed onscreen
- sandpaper -> selected pad is immediately placed onscreen
- paint/stain -> selected-color brush is immediately placed onscreen

Each tool now has its own safe visible home position and remains completely inside
the lathe canvas when first activated.


## v0.3.4 — Chisel Drag Hotfix

Only the chisel input subsystem was changed.

### Root cause
On shorter landscape phone viewports, the old chisel home/movement limits could
invert. That could place the center of the handle's invisible grab target outside
the canvas or collapse the available vertical drag range.

### Fix
- Chisel handle home position is always inside the visible canvas.
- Handle/ferrule receives a larger phone-friendly invisible grab area.
- Chisel now has a guaranteed horizontal and vertical movement range.
- Pointer capture is backed up by window-level pointer events for Android browsers.
- Cutting depth remains bounded by the existing contact model.
- Chisel remains fixed-size.
- Sandpaper, finish, speed, tool rest, and layout were not changed.


## v0.3.5 — Reach + Popup Panels + Chisel Rack Refinement

This build keeps all approved working systems and patches only the requested areas.

### 1) Tool reach
- Active tools can now travel a little past the physical blank ends visually, while
  contact still clamps safely to the real workpiece.
- Vertical movement ranges were loosened so the working tools can comfortably reach
  more of the blank.
- Default tool home positions were rebalanced lower for easier reach.

### 2) Lower selector panels
- The lower sandpaper / chisel / finish selector area is shorter.
- Panels sit more like popup trays and block less of the active tool handle area.
- The chisel panel is the shortest of the three so the handle is easier to grab.

### 3) Chisel rack visuals and behavior
- Bottom selector-rack chisel tips now look more visibly different from each other.
- Roughing, spindle, bowl, skew, parting, and scraper silhouettes are easier to tell apart.
- Chisel cutting response is tuned so the tool types feel more different:
  roughing = broader/aggressive
  spindle = narrower detail
  bowl = stronger center-biased curve
  skew = angled/asymmetric
  parting = narrow groove
  scraper = broader/shallow smoothing
