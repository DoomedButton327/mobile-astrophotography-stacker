# 🌌 Sequator Web — Browser Astrophotography Stacker

A fully client-side astrophotography image stacking application — no server, no uploads, all processing happens in your browser using JavaScript.

---

## Features

### Image Loading
- Light frames, dark frames, flat frames, bias frames
- Drag-and-drop or file picker
- Thumbnail previews with lightbox view
- Accepts JPG, PNG, TIFF, BMP, WebP

### Calibration
- Master dark subtraction (with optional exposure scaling)
- Flat field correction (normalised)
- Bias frame subtraction
- Hot pixel / stuck pixel removal (adjustable threshold)

### Star Alignment
- Automatic star detection using background-subtracted peak finding
- Sub-pixel centroid refinement
- Star pattern matching across frames
- 2D similarity transform (rotation + translation + scale)
- Bilinear resampling / warping to reference grid

### Stacking Methods
- **Kappa-Sigma Clipping** — statistical outlier rejection (default)
- **Mean** — simple average
- **Median** — satellite trail removal
- **Winsorized Sigma** — clipping with mean replacement
- **Weighted Average** — better frames weighted higher

### Post-Processing
- Sky gradient / light pollution removal (2D polynomial fit)
- Foreground separation mode for Milky Way landscapes
- Auto midtone stretch
- PNG or JPEG export

---

## Usage

1. Open `index.html` in a modern browser (Chrome, Firefox, Edge)
2. **Step 1 – Load**: Add your light frames (minimum 2). Optionally add dark/flat/bias frames.
3. **Step 2 – Calibrate**: Toggle which calibration types to apply.
4. **Step 3 – Settings**: Choose stacking method, gradient removal, output format.
5. **Step 4 – Stack**: Click "Start Stacking" and wait for processing to complete.
6. Download your result.

---

## RAW Files

This web app processes standard image formats (JPG, PNG, TIFF, BMP, WebP).  
For RAW files (CR2, NEF, ARW, RAF, DNG, etc.), convert them first using:
- [darktable](https://www.darktable.org/) (free)
- [RawTherapee](https://rawtherapee.com/) (free)
- Adobe Lightroom / Camera Raw

Export as 16-bit TIFF for best results before loading here.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | App structure and UI panels |
| `style.css` | Dark cosmic theme, layout, animations |
| `app.js` | Full stacking engine (star detection, alignment, all stacking methods, gradient removal, export) |

---

## Technical Notes

- All processing is in-browser — your images never leave your computer
- Uses `Float32Array` buffers for precision arithmetic
- Star alignment uses a 2D similarity (4-DOF) transform solved via least-squares
- Gradient removal fits a 6-term 2D polynomial to background samples
- Hot pixel detection uses a 3×3 median comparison
- Performance: ~5–15 seconds for 20 frames at 24MP on a modern machine

---

## Based on

Original Sequator desktop application by Yi-Ruei Wu  
https://sites.google.com/view/sequator/
