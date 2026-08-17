# WoodPrep Lathe Simulator

## Next Build Target: v0.3.0 — Locked Landscape UI Foundation

WoodPrep is a **woodturning learning, prep, and simulation app** for private use. It is not a game.

This build phase replaces the temporary/mobile test interface with the new locked landscape-only interface based on the approved layout.

---

## Core Purpose

The app is designed to let the user:

- practice woodturning workflow
- select turning tools
- adjust lathe settings
- select sanding grits
- select stains/paints
- preview active selections in the main workspace
- prepare and practice before working on real wood

There are **no game mechanics**.

Do not add:

- levels
- scores
- coins
- stars
- unlocks
- rewards
- ads
- win/lose screens
- progression gates

---

# LOCKED UI FOUNDATION

## Orientation

The app is **landscape-only**.

Portrait mode is not supported.

The entire working interface must fit inside the landscape viewport without scrolling.

---

## Main Screen Layout

The main interface is divided into five fixed interactive areas:

1. **Lathe Speed Knob**
2. **Lathe Tool Rest**
3. **Sandpaper**
4. **Chisels**
5. **Paint / Stain**

The main lathe/workpiece remains visible in the primary workspace.

The app navigation must also remain fixed and visible.

No important control may move off-screen or require vertical scrolling.

---

## Fixed Visibility Rule

The following are always visible on the main screen:

- lathe
- current wood/workpiece
- speed control
- tool rest
- sandpaper area
- chisel area
- paint/stain area
- fixed app navigation

All navigation and major selection areas are fixed-position interface elements.

---

# UNIVERSAL TAP / CLICK BEHAVIOR

When the user taps or clicks one of the five interactive areas:

1. The selected area **slightly enlarges**
2. Its popup / selection window opens
3. The user makes a selection or adjustment
4. The popup closes
5. The main screen returns to normal size
6. The new selection or setting becomes active
7. The interface visibly reflects the new active state

Only one popup may be open at a time.

---

# POPUP TYPES

There are two popup behavior classes.

## Type A — Replacement Selection

These replace the currently active item:

- Sandpaper
- Chisels
- Paint / Stain

After the user makes a selection:

- popup closes
- selected item becomes active
- selected item is displayed in its main-screen area
- simulator uses that selection

---

## Type B — Adjustment

These change a setting without replacing the active tool:

- Lathe Speed Knob
- Lathe Tool Rest

After adjustment:

- popup closes
- new setting remains active
- previously active chisel/tool remains active
- main workspace returns to the same tool state

---

# AREA BEHAVIOR

## 1. Lathe Speed Knob

### Main Screen
- Speed knob remains visible at all times
- Current RPM is displayed
- Knob visually reflects current setting

### Tap
- Knob slightly enlarges
- Speed adjustment popup opens

### Adjustment
- User rotates/adjusts RPM

### Close
- Popup closes
- Updated RPM remains active
- Active chisel/tool does not change

---

## 2. Lathe Tool Rest

### Main Screen
- Tool rest remains visible in the lathe scene

### Tap
- Tool rest slightly enlarges/highlights
- Tool-rest adjustment popup opens

### Adjustment
Tool-rest controls will eventually support:
- position
- distance from workpiece
- height / cutting relationship as defined by simulator logic

### Close
- Popup closes
- New tool-rest setting is applied
- Active chisel/tool remains unchanged

---

## 3. Sandpaper

### Main Screen
- Current selected sandpaper/grit is displayed

### Tap
- Sandpaper area slightly enlarges
- Sandpaper selection popup opens

### Selection
Planned grit set may include:

- P80
- P120
- P150
- P180
- P220
- P320
- P400
- P600
- P800
- P1000
- P1500
- P2000
- P3000

### Close
- Popup closes
- Selected sandpaper becomes active
- Active sandpaper is shown in the main UI

---

## 4. Chisels

### Main Screen
- Current chisel is displayed
- Current chisel is the active cutting tool

### Tap
- Chisel area slightly enlarges
- Chisel selection popup opens

### Planned Standard Tool Set
Target: 6–8 standard turning tools.

Initial planned set:

- Roughing gouge
- Spindle gouge
- Bowl gouge
- Parting tool
- Skew chisel
- Round-nose scraper
- Square scraper
- Detail / point tool

### Close
- Popup closes
- Selected chisel becomes active
- Main scene displays the selected chisel
- Cutting logic switches to that chisel profile

---

## 5. Paint / Stain

### Main Screen
- Current finish selection is displayed

### Tap
- Paint/stain area slightly enlarges
- Finish selection popup opens

### Selection Categories
Planned finish options include:

- wood stains
- paints
- clear finishes
- custom colors
- decorative stencil finishes

### Close
- Popup closes
- Selected finish becomes active
- Main-screen finish area displays the active finish

---

# ACTIVE STATE MODEL

The app must persist and display:

- active chisel
- active sandpaper
- active paint/stain
- current RPM
- current tool-rest setting

Main UI must always match current app state.

No popup may change unrelated active state.

---

# ACTIVE TOOL RULE

The active working tool may be:

- chisel
- sandpaper
- finish applicator / paint tool

When adjusting:

- speed
- tool rest

the current active working tool must remain active.

---

# VISUAL STYLE

The approved layout is the structural reference.

The final graphics should be:

- more realistic
- sharper
- cleaner
- higher quality
- woodworking-shop themed
- easy to read on a phone in landscape mode

Preserve the approved relative sizing and placement of:

- lathe
- workpiece
- speed control
- tool rest
- sandpaper area
- chisel area
- paint/stain area

Do not redesign the screen layout unless explicitly requested.

---

# INTERACTION FEEDBACK

When an area is selected:

- slightly enlarge it
- highlight it
- open its popup

After closing:

- return area to normal size
- keep the selected state visible
- update the simulator state

Recommended feedback methods:

- subtle scale-up
- border highlight
- shadow
- glow
- selected slot emphasis

Avoid large animations that obscure the lathe workspace.

---

# SIMULATOR HOOKUP ORDER

The next build should be implemented in this order:

1. Landscape-only app shell
2. Fixed main-screen layout
3. Fixed navigation
4. Five interactive areas
5. Slight enlarge-on-tap behavior
6. Popup framework
7. Active-state storage
8. Speed adjustment popup
9. Tool-rest adjustment popup
10. Chisel replacement popup
11. Sandpaper replacement popup
12. Paint/stain replacement popup
13. Hook UI state into simulator behavior

---

# ACCEPTANCE CRITERIA FOR v0.3.0

The UI foundation is accepted only if:

- app opens in landscape
- layout matches approved relative placement
- no main controls are off-screen
- screen does not scroll
- navigation remains fixed
- all five interactive areas remain visible
- tapping an area slightly enlarges it
- correct popup opens
- only one popup is open at a time
- popup closes cleanly after action
- replacement selections visibly update
- speed adjustment does not replace active tool
- tool-rest adjustment does not replace active tool
- active selections remain visible on main screen
- main lathe/workpiece area remains visible during normal use

---

# LOCKED BUILD RULES

Use the established Boss Lady development rules:

- preserve working systems
- modify only requested areas
- one subsystem at a time
- lock confirmed working systems
- do not change locked behavior without explicit instruction
- fix root causes rather than stacking patches
- keep code modular
- verify generated files
- keep builds GitHub-ready
- provide flat ZIP packages with no unnecessary wrapper folders

---

## Status

**UI / interaction specification: LOCKED**

Next implementation target:

**WoodPrep v0.3.0 — Landscape UI Foundation**
