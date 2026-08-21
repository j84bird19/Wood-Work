# BUILD NOTES — v0.3.1

## Root Cause of Previous UI Failure

Previous builds placed the controls into a generic bottom toolbar. That did not follow the user's approved composite layout.

This build is a UI shell replacement.

## Spatial Blueprint

Approximate screen allocation:

- Upper Lathe Zone: 1.2% side margins, 1.8% top, ~67% viewport height
- Speed Module: left/headstock area, ~12.7% width
- Tool Rest: centered under blank
- Lower Selection Zone: ~29% viewport height
- Sandpaper: 29% lower-zone width
- Chisels: 34% lower-zone width
- Paint/Stain: 35% lower-zone width

These ratios are intentional and should not be redesigned without instruction.

## Selection Behavior

Tap/click:
1. source area enlarges to ~1.055 scale
2. one shared modal opens
3. selection/adjustment is made
4. popup closes
5. source returns to normal scale
6. active state persists

## Test Checklist

- [ ] App presents landscape-only prompt in portrait
- [ ] Main layout visibly resembles the approved composite
- [ ] Lathe dominates upper portion
- [ ] Speed control is on left side of lathe
- [ ] Tool rest is centered under the workpiece
- [ ] Sandpaper is lower-left
- [ ] Chisels are lower-center
- [ ] Paint/Stain is lower-right
- [ ] All areas are visible together
- [ ] No vertical scroll
- [ ] Speed popup enlarges and adjusts RPM
- [ ] Tool-rest popup adjusts rest without changing active chisel
- [ ] Sandpaper selection becomes active
- [ ] Chisel selection becomes active
- [ ] Paint/Stain selection becomes active
- [ ] Chisel remains fixed-size while moving
- [ ] Wood visibly rotates
- [ ] Workpiece cuts at chisel contact


## v0.3.2 — Popup Presentation Change

### Locked layout preserved
No main-screen layout or placement changes were made.

### Selection-popup requirement
Replacement popups must show the user what they are selecting, not just a text label.

Required visible information:

- Sandpaper: grit texture/color + grit number + use description
- Chisels: enlarged tip/profile + tool name + purpose
- Paint/Stain: representative finish color + type + name + description

### Acceptance
- [ ] Sandpaper popup contains visual grit cards
- [ ] Chisel popup shows visually different tip shapes
- [ ] Stain popup choices visibly retain wood-grain texture
- [ ] Paint choices look opaque and color-specific
- [ ] Every visual choice includes a name
- [ ] Every visual choice includes a useful short description
- [ ] Selected option is visibly highlighted
- [ ] Selecting a replacement option closes the popup
- [ ] Main-screen active label updates
- [ ] v0.3.1 layout remains unchanged


## v0.3.3 acceptance additions

- [ ] Sandpaper popup cards are visually different from each other
- [ ] Sandpaper cards resemble illustrated paper / abrasive sheets
- [ ] Chisel popup visuals look like illustrated tools rather than abstract icons
- [ ] Selecting a finish changes the workpiece color
- [ ] Finish mode shows a brush with the selected color on its tip
- [ ] Selecting sandpaper makes sandpaper the visible active tool
- [ ] Selecting a chisel makes the selected chisel the visible active tool


## v0.3.4 Contact Engine Test

- [ ] Chisel affects only its contact footprint
- [ ] Sandpaper is directly movable when selected
- [ ] Sandpaper smooths only beneath the pad
- [ ] Coarser grit affects surface more aggressively than fine grit
- [ ] Sanding dust appears at contact
- [ ] Brush is directly movable when finish is selected
- [ ] Selecting a finish does NOT recolor the entire blank
- [ ] Brush applies color only where it touches
- [ ] Paint builds more opaque than stain
- [ ] Unpainted areas remain unchanged
- [ ] Landscape UI remains unchanged
- [ ] Speed and tool-rest popups remain working


## v0.3.4 Tool Visibility Hotfix

Root cause fix:
- active mode and selected item were updating correctly
- all tool types were still sharing positioning assumptions from the chisel prototype
- some tool geometry could therefore start at or beyond the useful canvas area

New functions:
- `activeToolHome(mode)`
- `placeActiveTool(mode)`

Acceptance:
- [ ] Select chisel: chisel is immediately visible and draggable
- [ ] Select sandpaper: sandpaper is immediately visible and draggable
- [ ] Select paint/stain: brush is immediately visible and draggable
- [ ] Active tool remains inside canvas on resize
- [ ] Speed and tool rest behavior unchanged
- [ ] Main landscape layout unchanged
