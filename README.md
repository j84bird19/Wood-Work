# WoodPrep Lathe — v0.1.1 Flat GitHub Build

This repository intentionally uses a **flat root structure** so every file can be selected and uploaded directly from a phone. There are **no project folders**.

## Upload these files directly to the GitHub repository root

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `README.md`
- `BUILD_NOTES.md`

## Run

For GitHub Pages:
1. Upload all files to the repository root.
2. Open **Settings → Pages**.
3. Deploy from the main branch/root.
4. Open the generated Pages URL on Android.

## v0.1.1 scope

This first subsystem is intentionally small:
- continuous lathe rotation
- 200–3200 RPM control
- high-resolution 1D radius profile for the blank
- one gouge-like cutting profile
- touch/pointer movement
- real material removal (radius values only decrease)
- live position and diameter readouts
- reset blank
- installable PWA shell

No levels, points, unlocking, ads, or game progression.

## Architecture note

The wood is stored as a sequence of radius samples along its length. A tool contact modifies only the affected samples. This is the same core data model we can later revolve into a true 3D mesh while preserving the cutting logic.
