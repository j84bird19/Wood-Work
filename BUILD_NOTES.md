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
