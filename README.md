# STARSTACK - Mobile Astrophotography Stacker

## 🚀 Deploy to GitHub Pages (5 minutes)

### Step 1: Create a new repo
1. Go to github.com/new
2. Name it: `starstack` (or whatever you want)
3. Make it **Public**
4. Click "Create repository"

### Step 2: Upload the file
1. Click "uploading an existing file"
2. Drag `starstack.html` into the browser
3. Rename it to `index.html` (IMPORTANT!)
4. Click "Commit changes"

### Step 3: Enable GitHub Pages
1. Go to Settings > Pages
2. Source: "Deploy from a branch"
3. Branch: `main` / `root`
4. Click Save

### Step 4: Access your app
Your app will be live at:
`https://yourusername.github.io/starstack/`

(Replace `yourusername` with your GitHub username)

---

## 📱 Features

✨ **Three Stacking Modes:**
- **Star Trails**: Lighten blend mode for light trails
- **Deep Sky**: Averaging for noise reduction
- **Median Stack**: Remove satellites & artifacts

🎯 **Processing Options:**
- Auto star alignment (recommended)
- Brightness boost
- Contrast adjustment
- Saturation control

💫 **Mobile-Optimized:**
- Touch-friendly interface
- Direct camera/gallery access
- Responsive design
- Your Dark Glassmorphism aesthetic

---

## 🎨 How to Use

1. **Upload Images**: Tap the upload zone or drag 2+ astrophotography images
2. **Choose Mode**: Select your stacking mode (Star Trails, Deep Sky, or Median)
3. **Adjust Settings**: Fine-tune brightness, contrast, saturation
4. **Process**: Hit the PROCESS STACK button
5. **Download**: Save your stacked result

---

## 🔧 Technical Details

- **100% client-side** - no server needed
- **Pure HTML/CSS/JavaScript** - single file deployment
- **Canvas-based processing** - fast on modern phones
- **Progressive loading** - handles large image sets
- **Smart alignment** - detects brightest points (stars) for alignment

---

## 📊 Performance Tips

- **Image size**: Works best with 2-10 images
- **Resolution**: Phone camera resolution (12-50MP) works great
- **File size**: Keep under 50MB total for smooth processing
- **Processing time**: 5-30 seconds depending on image count/size

---

## 🎯 Workflow Examples

### Star Trails
1. Upload 20-50 short exposures (15-30 seconds each)
2. Select "Star Trails" mode
3. Enable auto-align
4. Process
5. Download epic star trail composite

### Deep Sky / Milky Way
1. Upload 5-15 exposures of same target
2. Select "Deep Sky" mode
3. Enable auto-align
4. Boost brightness slightly (+10-20%)
5. Process for noise-reduced result

### Meteor/Satellite Removal
1. Upload your image set
2. Select "Median Stack" mode
3. Enable auto-align
4. Median will remove transient objects
5. Download clean result

---

## 📝 Notes

- **Legal & Original**: Completely new code, no Sequator restrictions
- **Your Design**: Custom Dark Glassmorphism / Deep Space Dev aesthetic
- **Portable**: Works on ANY device with a browser
- **Offline-capable**: Once loaded, works without internet

---

## 🎨 Customization

Want to tweak the colors or fonts? Edit the CSS variables in the `<style>` section:

```css
:root {
    --accent-purple: #a78bfa;  /* Change to your preferred accent */
    --accent-blue: #3b82f6;    /* Secondary accent */
    --bg-deep: #0a0e27;        /* Background color */
}
```

---

## 🐛 Issues?

If processing fails:
- Try with fewer/smaller images first
- Check browser console (F12) for errors
- Make sure images are actual photos (not corrupted)

---

**Built with 💫 for mobile astrophotography**
