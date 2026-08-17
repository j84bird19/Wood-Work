# BUILD NOTES — WoodPrep v0.3.0 UI Foundation

## Build Goal

Create the new approved **landscape-only fixed user interface** before adding additional simulator features.

This is a UI architecture pass.

Do not expand the simulator feature set during this build.

---

# USER-APPROVED SCREEN STRUCTURE

The main screen contains:

- lathe / workpiece
- lathe speed knob
- lathe tool rest
- sandpaper area
- chisel area
- paint/stain area
- fixed app navigation

All major controls remain visible at the same time.

---

# LANDSCAPE-ONLY REQUIREMENT

The app must:

- lock to landscape
- fill the available landscape viewport
- avoid vertical scrolling
- avoid browser/UI overlap where possible
- keep every main control accessible

Use dynamic viewport sizing where required.

---

# FIXED NAVIGATION REQUIREMENT

Navigation is fixed.

The following must never scroll off-screen:

- app navigation
- speed control
- sandpaper selector
- chisel selector
- paint/stain selector

The lathe/workpiece remains the primary scene.

---

# POPUP SYSTEM

Implement a single reusable popup manager.

Only one popup may exist/open at a time.

Required states:

- CLOSED
- OPENING
- OPEN
- CLOSING

Do not create separate unrelated popup frameworks for each category.

---

# ELEMENT ENLARGE BEHAVIOR

On tap/click:

1. target element receives selected state
2. target scales up slightly
3. popup opens
4. background remains visually stable
5. user selects/adjusts
6. popup closes
7. element returns to normal size
8. selected value remains displayed

Suggested scale:

`1.04 – 1.10`

Keep enlargement subtle.

---

# POPUP CLASS A — REPLACEMENT

Applies to:

- Chisels
- Sandpaper
- Paint / Stain

Required logic:

```text
tap area
→ enlarge
→ open selection popup
→ select option
→ update active item
→ update main UI
→ close popup
→ return area to normal size
```

---

# POPUP CLASS B — ADJUSTMENT

Applies to:

- Speed Knob
- Tool Rest

Required logic:

```text
tap area
→ enlarge
→ open adjustment popup
→ adjust setting
→ save new setting
→ preserve active working tool
→ close popup
→ return area to normal size
```

These controls may not overwrite:

- active chisel
- active sandpaper
- active finish tool

---

# REQUIRED APP STATE

Implement a single source of truth for UI state.

Suggested structure:

```text
AppState
├── activeToolMode
├── activeChisel
├── activeSandpaper
├── activeFinish
├── latheRpm
├── toolRest
└── openPopup
```

Do not scatter active selections across unrelated UI components.

---

# ACTIVE TOOL MODE

Suggested modes:

```text
CHISEL
SANDPAPER
FINISH
```

Speed and tool-rest settings are environment settings, not tool modes.

---

# CHISEL STATE

Initial active chisel:

`Roughing Gouge`

Do not add all detailed cutting physics in this UI-only pass unless already working and unaffected.

---

# SANDPAPER STATE

Initial default may be:

`P120`

Selection system must support changing the active grit.

Sandpaper size and pressure belong to later simulator-control hookup.

---

# FINISH STATE

Initial finish may be:

`Natural / None`

The UI must still support opening the paint/stain selector.

---

# LATHE SPEED STATE

Preserve rotary-knob concept.

Required:

- current RPM visible
- adjustment popup uses a larger knob/control
- popup adjustment updates main-screen knob
- main-screen knob reflects current setting
- popup closes without changing active working tool

---

# TOOL REST STATE

Tool rest should be directly tappable in the lathe scene.

When selected:

- visually highlight/enlarge it
- open adjustment popup
- allow tool-rest configuration
- close popup
- preserve current active tool

Actual physical tool-rest simulation can be hooked in after the UI interaction is accepted.

---

# VISUAL PRIORITY

1. Workpiece / lathe
2. Active working tool
3. Bottom selection areas
4. Speed/tool-rest adjustment access
5. Navigation

Avoid covering the workpiece with permanent text or large floating controls.

---

# APPROVED RELATIVE PLACEMENT

Preserve the user's approved mockup proportions:

- lathe across upper/main portion
- speed control at left/headstock area
- tool rest centered beneath workpiece
- sandpaper selection toward lower-left
- chisels centered along lower area
- paint/stain toward lower-right

Do not independently redesign these placements.

---

# GRAPHICS TARGET

Use more realistic graphics than the rough reference mockup.

Target:

- realistic wood grain
- realistic metal lathe surfaces
- realistic chisel materials
- realistic sandpaper
- realistic paint/stain samples
- readable interface labels

Do not use childish/game reward graphics.

---

# DO NOT ADD IN THIS BUILD

Do not add:

- levels
- scoring
- coins
- unlocks
- ads
- missions
- achievements
- reward animations

Also do not expand into:

- full sanding physics
- finish coat physics
- custom stencil upload
- wood-species physics
- advanced chisel angle physics

until the new interface foundation is accepted.

---

# TEST CHECKLIST

## Screen
- [ ] Landscape only
- [ ] No vertical scroll
- [ ] Main lathe visible
- [ ] Workpiece visible
- [ ] Speed control visible
- [ ] Tool rest visible
- [ ] Sandpaper visible
- [ ] Chisels visible
- [ ] Paint/stain visible
- [ ] Navigation visible

## Popups
- [ ] Only one popup opens at a time
- [ ] Selected area enlarges slightly
- [ ] Popup can close
- [ ] Area returns to normal size after close

## Replacement Selection
- [ ] Chisel selection updates active chisel
- [ ] Sandpaper selection updates active grit
- [ ] Paint/stain selection updates active finish
- [ ] Main screen displays new active choice

## Adjustment Selection
- [ ] Speed adjustment changes RPM
- [ ] Speed adjustment preserves active tool
- [ ] Tool-rest adjustment changes tool-rest state
- [ ] Tool-rest adjustment preserves active tool

## Persistence During Session
- [ ] Active selections survive popup changes
- [ ] Changing one category does not reset unrelated categories

---

# LOCK CONDITIONS

After v0.3.0 is accepted, lock:

- landscape orientation
- main layout proportions
- fixed navigation
- five interactive areas
- popup manager
- replacement-vs-adjustment behavior
- active-state model

Do not modify locked UI behavior unless explicitly instructed.

---

## Build Status

**Specification complete.**

Next action:

**Implement WoodPrep v0.3.0 — Landscape UI Foundation**
