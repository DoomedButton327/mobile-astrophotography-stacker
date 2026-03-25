# 🌌 Sequator — Astrophotography Image Stacking

> A free, powerful Windows desktop application for aligning and stacking astrophotography frames.
> This repository hosts the **official website** for the Sequator application.

---

## 📸 What is Sequator?

**Sequator** is a free Windows application developed by **Yi-Ruei Wu** that automates the most critical steps in astrophotography post-processing:

- **Star alignment** across multiple frames using pattern-matching algorithms
- **Image stacking** to dramatically reduce noise and reveal faint detail
- **Sky gradient removal** to correct light pollution and uneven illumination
- **Foreground/background composition** for Milky Way landscape shots
- **Hot pixel and artifact removal** from long-exposure frames
- **16-bit TIFF output** for maximum dynamic range in post-processing

---

## 🖥️ Website Overview

This repository contains the full source code for the Sequator website:

| File | Description |
|------|-------------|
| `index.html` | Main HTML structure — hero, features, formats, workflow, download |
| `style.css` | Full stylesheet — dark cosmic aesthetic with CSS animations |
| `app.js` | JavaScript — starfield canvas, tabs, scroll reveal, cursor effects |
| `README.md` | This file |
| `Sequator162r2.zip` | The Sequator application ZIP (place in root for download link to work) |

---

## ✨ Website Features

- **Animated starfield** background with shooting stars rendered on HTML5 Canvas
- **Tabbed format browser** showing all 30+ supported image formats
- **Scroll-reveal animations** with staggered delays
- **Cursor glow effect** on desktop
- **Subtle card tilt** on feature cards (desktop)
- **Fully responsive** layout for mobile and tablet
- **No dependencies** — pure HTML, CSS, and vanilla JavaScript

---

## 📁 Supported Image Formats

Sequator supports virtually every format used in astrophotography:

### RAW Formats (via LibRaw)
`CR2` `CR3` `NEF` `NRW` `ARW` `SRF` `SR2` `RAF` `ORF` `PEF` `DNG` `RW2` `RWL` `3FR` `MRW` `X3F` `ERF` `K25` `KDC` `DCR` `IIQ`

### Standard Formats (via LibTiff & wxWidgets)
`TIFF` `TIF` `JPG` `JPEG` `PNG` `BMP` `GIF` `PPM` `PGM`

### Specialty / Astronomical Formats
`FITS` `FIT` `FTS` `SER` `AVI`

---

## 🔧 Application Requirements

- **OS**: Windows x64
- **Runtime**: [Visual C++ 2015 Redistributable x64](https://www.microsoft.com/en-US/download/details.aspx?id=48145)
- **Version**: 1.6.2 r2 (released Aug 18, 2024)

---

## 🚀 Workflow

1. **Load Frames** — Add light, dark, flat, and bias frames in any mix of formats
2. **Configure** — Choose stacking algorithm (Mean, Median, Kappa-Sigma, Weighted Average)
3. **Align & Stack** — Sequator registers frames using star patterns and blends them
4. **Export** — Save as 16-bit TIFF for processing in Lightroom, Photoshop, or PixInsight

---

## 📄 License & Credits

Sequator is developed by **Yi-Ruei Wu** and is free for **non-commercial use only**.

> - Redistribution is allowed but must include all original files and this notice
> - Commercial use, modification, and derivative works are prohibited
> - See `README.txt` inside the application ZIP for full license terms

### Libraries Used

| Library | License | Use |
|---------|---------|-----|
| [LibRaw](http://www.libraw.org/) | LGPL 2.1 / CDDL 1.0 | RAW image decoding |
| [LibTiff](http://www.libtiff.org/) | BSD-style | TIFF read/write |
| [wxWidgets](http://www.wxwidgets.org/) | wxWindows Library Licence | GUI framework |

---

## 🌐 Official Site

[https://sites.google.com/view/sequator/](https://sites.google.com/view/sequator/)

---

*Website designed for GitHub Pages. Place `Sequator162r2.zip` in the root directory for the download button to function correctly.*
