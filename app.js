'use strict';
/* ================================================================
   SEQUATOR WEB — app.js
   Full astrophotography stacking engine in the browser.
   
   Pipeline:
   1. Load & decode images into ImageData
   2. Build master dark / flat / bias calibration frames
   3. Apply calibration to each light frame
   4. Detect stars in each calibrated frame
   5. Compute homography transform to align frames
   6. Resample each frame onto reference grid
   7. Stack using chosen method (mean/median/kappa-sigma/etc.)
   8. Apply sky gradient removal
   9. Auto-stretch & export
   ================================================================ */

// ----------------------------------------------------------------
//  STATE
// ----------------------------------------------------------------
const State = {
  frames: { light: [], dark: [], flat: [], bias: [] },
  settings: {
    stackMethod:    'kappa-sigma',
    kappa:          2.5,
    kappaIters:     3,
    starSensitivity:6,
    minStars:       10,
    subpixel:       true,
    gradient:       true,
    gradientStrength:5,
    perFrameGradient:true,
    foreground:     false,
    horizonLine:    60,
    fgFrames:       3,
    hotPixel:       true,
    hotPixelThresh: 5,
    useDark:        false,
    useFlat:        false,
    useBias:        false,
    darkScale:      true,
    flatNorm:       true,
    outputFormat:   'png',
    autoStretch:    true,
  },
  result: null,
};

// ----------------------------------------------------------------
//  STARFIELD CANVAS
// ----------------------------------------------------------------
(function starfield() {
  const c = document.getElementById('starfield');
  const ctx = c.getContext('2d');
  let W, H, stars = [];
  const resize = () => { W = c.width = innerWidth; H = c.height = innerHeight; buildStars(); };
  const buildStars = () => {
    stars = Array.from({ length: Math.floor(W*H/5000) }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.4+0.2,
      a: Math.random()*0.8+0.1,
      sp: Math.random()*0.0008+0.0002,
      ph: Math.random()*Math.PI*2,
    }));
  };
  let t = 0;
  const draw = () => {
    ctx.clearRect(0,0,W,H);
    for (const s of stars) {
      const a = s.a*(0.6+0.4*Math.sin(t*s.sp*1000+s.ph));
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle='#fff'; ctx.globalAlpha=a; ctx.fill();
    }
    ctx.globalAlpha=1; t+=0.016; requestAnimationFrame(draw);
  };
  addEventListener('resize', resize);
  resize(); draw();
})();

// ----------------------------------------------------------------
//  PANEL NAVIGATION
// ----------------------------------------------------------------
const panels = { load:'panel-load', calibrate:'panel-calibrate', settings:'panel-settings', stack:'panel-stack' };

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(panels[name]).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t=>{
    t.classList.toggle('active', t.dataset.panel===name);
  });
}

document.querySelectorAll('.nav-tab').forEach(tab=>{
  tab.addEventListener('click', ()=> showPanel(tab.dataset.panel));
});

document.getElementById('btn-to-calibrate').addEventListener('click', ()=> showPanel('calibrate'));
document.getElementById('btn-to-load').addEventListener('click', ()=> showPanel('load'));
document.getElementById('btn-to-settings').addEventListener('click', ()=> showPanel('settings'));
document.getElementById('btn-to-calibrate2').addEventListener('click', ()=> showPanel('calibrate'));
document.getElementById('btn-to-stack').addEventListener('click', ()=> { showPanel('stack'); resetStackUI(); });
document.getElementById('btn-to-settings2').addEventListener('click', ()=> showPanel('settings'));

// ----------------------------------------------------------------
//  FILE LOADING
// ----------------------------------------------------------------
const TYPES = ['light','dark','flat','bias'];

TYPES.forEach(type => {
  const dz = document.getElementById(`dz-${type}`);
  const input = dz.querySelector('input[type=file]');

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', ()=> dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    addFiles(type, e.dataTransfer.files);
  });
  input.addEventListener('change', e => addFiles(type, e.target.files));
});

function addFiles(type, fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(tiff?|bmp|webp)$/i)) continue;
    const existing = State.frames[type].find(f=>f.name===file.name && f.size===file.size);
    if (existing) continue;
    const entry = { file, name:file.name, size:file.size, url: URL.createObjectURL(file), data:null };
    State.frames[type].push(entry);
    addThumb(type, entry);
  }
  updateCounts();
}

function addThumb(type, entry) {
  const list = document.getElementById(`thumbs-${type}`);
  const div = document.createElement('div');
  div.className = 'thumb-item';
  div.dataset.name = entry.name;
  const img = document.createElement('img');
  img.src = entry.url;
  img.title = entry.name;
  const btn = document.createElement('button');
  btn.className = 'thumb-remove';
  btn.innerHTML = '✕';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    State.frames[type] = State.frames[type].filter(f=>f.name!==entry.name);
    div.remove();
    updateCounts();
  });
  img.addEventListener('click', ()=>{
    document.getElementById('lightbox-img').src = entry.url;
    document.getElementById('lightbox-info').textContent = `${entry.name} · ${(entry.size/1024).toFixed(1)} KB · ${type} frame`;
    document.getElementById('lightbox').classList.add('open');
  });
  div.appendChild(img); div.appendChild(btn); list.appendChild(div);
  document.getElementById(`card-${type}`).classList.add('has-files');
}

function updateCounts() {
  TYPES.forEach(t=>{
    const n = State.frames[t].length;
    document.getElementById(`count-${t}`).textContent = n;
    if (!n) document.getElementById(`card-${t}`).classList.remove('has-files');
  });
  const lightN = State.frames.light.length;
  document.getElementById('btn-to-calibrate').disabled = lightN < 2;
  document.getElementById('frame-count').textContent = `${lightN} light frame${lightN!==1?'s':''}`;
}

// lightbox close
document.getElementById('lightbox-bg').addEventListener('click', ()=> document.getElementById('lightbox').classList.remove('open'));
document.getElementById('lightbox-close').addEventListener('click', ()=> document.getElementById('lightbox').classList.remove('open'));

// ----------------------------------------------------------------
//  TOGGLES
// ----------------------------------------------------------------
document.querySelectorAll('.toggle').forEach(tog => {
  tog.addEventListener('click', ()=> {
    tog.classList.toggle('active');
    const id = tog.id.replace('tog-','');
    const map = { dark:'useDark', flat:'useFlat', bias:'useBias', hotpixel:'hotPixel', gradient:'gradient', foreground:'foreground' };
    if (map[id]) State.settings[map[id]] = tog.classList.contains('active');
  });
});

// ----------------------------------------------------------------
//  SLIDERS
// ----------------------------------------------------------------
function bindSlider(id, key, suffix='') {
  const el = document.getElementById(id);
  const disp = document.getElementById(id+'-val') || document.getElementById(id+'-display') || document.getElementById(id.replace('-val','')+'-val');
  if (!el) return;
  el.addEventListener('input', ()=> {
    const v = parseFloat(el.value);
    State.settings[key] = v;
    if (disp) disp.textContent = v+suffix;
  });
}
bindSlider('hotpixel-thresh','hotPixelThresh');
bindSlider('star-sensitivity','starSensitivity');
bindSlider('gradient-strength','gradientStrength');
bindSlider('horizon-line','horizonLine','%');
bindSlider('kappa-val','kappa');
bindSlider('kappa-iters','kappaIters');

document.getElementById('kappa-val').addEventListener('input', e=>{
  document.getElementById('kappa-val-display').textContent = parseFloat(e.target.value).toFixed(1);
});

// ----------------------------------------------------------------
//  CHECKBOXES
// ----------------------------------------------------------------
[['dark-scale','darkScale'],['flat-normalize','flatNorm'],['subpixel','subpixel'],
 ['per-frame-gradient','perFrameGradient'],['auto-stretch','autoStretch'],
 ['preserve-aspect','preserveAspect']].forEach(([id,key])=>{
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', ()=> State.settings[key]=el.checked);
});

document.getElementById('min-stars').addEventListener('change', e=>{
  State.settings.minStars = parseInt(e.target.value)||10;
});
document.getElementById('fg-frames').addEventListener('change', e=>{
  State.settings.fgFrames = parseInt(e.target.value)||3;
});
document.getElementById('output-format').addEventListener('change', e=>{
  State.settings.outputFormat = e.target.value;
});

// ----------------------------------------------------------------
//  RADIO STACKING METHOD
// ----------------------------------------------------------------
document.querySelectorAll('.radio-option').forEach(opt=>{
  opt.addEventListener('click', ()=>{
    document.querySelectorAll('.radio-option').forEach(o=>o.classList.remove('selected'));
    opt.classList.add('selected');
    State.settings.stackMethod = opt.dataset.value;
    document.getElementById('kappa-options').style.display =
      ['kappa-sigma','winsorized'].includes(opt.dataset.value) ? 'block' : 'none';
  });
});

// ----------------------------------------------------------------
//  UTILITY: Load image to ImageData
// ----------------------------------------------------------------
async function loadImageData(entry) {
  if (entry.data) return entry.data;
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img,0,0);
      entry.data = ctx.getImageData(0,0,c.width,c.height);
      entry.w = c.width; entry.h = c.height;
      resolve(entry.data);
    };
    img.onerror = reject;
    img.src = entry.url;
  });
}

// Float32 image buffer helpers
function imgToFloat(imgData) {
  const { data, width, height } = imgData;
  const r=new Float32Array(width*height),
        g=new Float32Array(width*height),
        b=new Float32Array(width*height);
  for (let i=0,p=0; i<data.length; i+=4,p++) {
    r[p]=data[i]/255; g[p]=data[i+1]/255; b[p]=data[i+2]/255;
  }
  return { r, g, b, w:width, h:height };
}

function floatToImgData(buf, gamma=1) {
  const { r, g, b, w, h } = buf;
  const out = new ImageData(w, h);
  for (let i=0,p=0; i<out.data.length; i+=4,p++) {
    out.data[i]   = Math.min(255, Math.pow(r[p], 1/gamma)*255+0.5)|0;
    out.data[i+1] = Math.min(255, Math.pow(g[p], 1/gamma)*255+0.5)|0;
    out.data[i+2] = Math.min(255, Math.pow(b[p], 1/gamma)*255+0.5)|0;
    out.data[i+3] = 255;
  }
  return out;
}

function cloneFloat(buf) {
  return { r:buf.r.slice(), g:buf.g.slice(), b:buf.b.slice(), w:buf.w, h:buf.h };
}

// ----------------------------------------------------------------
//  CALIBRATION FRAME BUILDERS
// ----------------------------------------------------------------
function masterMean(bufs) {
  if (!bufs.length) return null;
  const { w, h } = bufs[0];
  const n = bufs.length;
  const r=new Float32Array(w*h), g=new Float32Array(w*h), b=new Float32Array(w*h);
  for (const buf of bufs) {
    for (let i=0; i<w*h; i++) { r[i]+=buf.r[i]; g[i]+=buf.g[i]; b[i]+=buf.b[i]; }
  }
  for (let i=0; i<w*h; i++) { r[i]/=n; g[i]/=n; b[i]/=n; }
  return { r, g, b, w, h };
}

function subtractBuffer(a, b) {
  const n = a.r.length;
  for (let i=0; i<n; i++) {
    a.r[i] = Math.max(0, a.r[i]-b.r[i]);
    a.g[i] = Math.max(0, a.g[i]-b.g[i]);
    a.b[i] = Math.max(0, a.b[i]-b.b[i]);
  }
}

function divideBuffer(a, flat) {
  // Normalise flat to mean 1
  const n = a.r.length;
  let mr=0,mg=0,mb=0;
  for (let i=0; i<n; i++) { mr+=flat.r[i]; mg+=flat.g[i]; mb+=flat.b[i]; }
  mr/=n; mg/=n; mb/=n; if(!mr) mr=1; if(!mg) mg=1; if(!mb) mb=1;
  for (let i=0; i<n; i++) {
    a.r[i] /= (flat.r[i]/mr || 1);
    a.g[i] /= (flat.g[i]/mg || 1);
    a.b[i] /= (flat.b[i]/mb || 1);
  }
}

// ----------------------------------------------------------------
//  HOT PIXEL REMOVAL — replace pixels > thresh*local_median
// ----------------------------------------------------------------
function removeHotPixels(buf, threshFactor) {
  const { r, g, b, w, h } = buf;
  const thresh = 0.05 + (threshFactor/10)*0.2; // map 1-10 → 0.07..0.25
  const fix = (ch)=>{
    for (let y=1; y<h-1; y++) {
      for (let x=1; x<w-1; x++) {
        const i = y*w+x;
        const v = ch[i];
        const neighbors = [
          ch[i-1], ch[i+1], ch[i-w], ch[i+w],
          ch[i-w-1], ch[i-w+1], ch[i+w-1], ch[i+w+1]
        ].sort((a,z)=>a-z);
        const med = (neighbors[3]+neighbors[4])/2;
        if (v - med > thresh) ch[i] = med;
      }
    }
  };
  fix(r); fix(g); fix(b);
}

// ----------------------------------------------------------------
//  STAR DETECTION
//  Returns array of {x, y, brightness} sorted by brightness desc
// ----------------------------------------------------------------
function detectStars(buf, sensitivity) {
  const { r, g, b, w, h } = buf;
  // Luminance
  const lum = new Float32Array(w*h);
  for (let i=0; i<w*h; i++) lum[i] = 0.299*r[i] + 0.587*g[i] + 0.114*b[i];

  // Simple box-blur for background estimation
  const blurred = boxBlur(lum, w, h, 16);

  // Subtract background, find peaks
  const sub = new Float32Array(w*h);
  for (let i=0; i<w*h; i++) sub[i] = Math.max(0, lum[i]-blurred[i]);

  // Threshold: fraction of max brightness keyed to sensitivity
  let maxV=0;
  for (let i=0; i<sub.length; i++) if(sub[i]>maxV) maxV=sub[i];
  const thresh = maxV * (1 - (sensitivity/10)*0.9 - 0.02);

  const stars = [];
  const rad = 4;
  for (let y=rad; y<h-rad; y+=2) {
    for (let x=rad; x<w-rad; x+=2) {
      const i = y*w+x;
      const v = sub[i];
      if (v < thresh) continue;
      // Local maximum check
      let isMax = true;
      outer: for (let dy=-rad; dy<=rad; dy++) {
        for (let dx=-rad; dx<=rad; dx++) {
          if (dx===0&&dy===0) continue;
          if (sub[(y+dy)*w+(x+dx)] > v) { isMax=false; break outer; }
        }
      }
      if (isMax) {
        // Sub-pixel centroid
        let wx=0,wy=0,wt=0;
        for (let dy=-2; dy<=2; dy++) {
          for (let dx=-2; dx<=2; dx++) {
            const sv = sub[(y+dy)*w+(x+dx)];
            wx += (x+dx)*sv; wy += (y+dy)*sv; wt += sv;
          }
        }
        stars.push({ x: wt?wx/wt:x, y: wt?wy/wt:y, b:v });
      }
    }
  }
  stars.sort((a,z)=>z.b-a.b);
  return stars.slice(0, 300);
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w*h);
  const out = new Float32Array(w*h);
  // Horizontal
  for (let y=0; y<h; y++) {
    let sum=0, cnt=0;
    for (let x=0; x<r; x++) { sum+=src[y*w+x]; cnt++; }
    for (let x=0; x<w; x++) {
      if (x+r<w) { sum+=src[y*w+x+r]; cnt++; }
      if (x-r-1>=0) { sum-=src[y*w+x-r-1]; cnt--; }
      tmp[y*w+x] = sum/cnt;
    }
  }
  // Vertical
  for (let x=0; x<w; x++) {
    let sum=0, cnt=0;
    for (let y=0; y<r; y++) { sum+=tmp[y*w+x]; cnt++; }
    for (let y=0; y<h; y++) {
      if (y+r<h) { sum+=tmp[(y+r)*w+x]; cnt++; }
      if (y-r-1>=0) { sum-=tmp[(y-r-1)*w+x]; cnt--; }
      out[y*w+x] = sum/cnt;
    }
  }
  return out;
}

// ----------------------------------------------------------------
//  STAR MATCHING & HOMOGRAPHY (2D similarity: scale+rot+translate)
// ----------------------------------------------------------------
function matchStars(refStars, tgtStars, maxDist=20) {
  // Build kNN-style matches using nearest-neighbor on top 50 stars
  const ref50 = refStars.slice(0,50);
  const tgt50 = tgtStars.slice(0,50);
  const matches=[];
  for (const rs of ref50) {
    let best=null, bd=Infinity;
    for (const ts of tgt50) {
      const d = Math.hypot(rs.x-ts.x, rs.y-ts.y);
      if (d<bd) { bd=d; best=ts; }
    }
    if (bd<maxDist && best) matches.push({ r:rs, t:best });
  }
  return matches;
}

function solveSimilarity(matches) {
  // Solve for [scale*cos, -scale*sin, tx, scale*sin, scale*cos, ty]
  // Using least-squares on the matched pairs
  if (matches.length < 3) return null;
  const n = matches.length;
  let sx=0, sy=0, rx=0, ry=0, sxx=0, sxy=0, syy=0, sxrx=0, sxry=0, syrx=0, syry=0;
  for (const { r, t } of matches) {
    sx+=t.x; sy+=t.y; rx+=r.x; ry+=r.y;
    sxx+=t.x*t.x; syy+=t.y*t.y; sxy+=t.x*t.y;
    sxrx+=t.x*r.x; sxry+=t.x*r.y;
    syrx+=t.y*r.x; syry+=t.y*r.y;
  }
  const D = sxx+syy;
  if (!D) return null;
  const a = (sxrx+syry)/D;
  const b = (sxry-syrx)/D;
  const tx = (rx - a*sx + b*sy)/n;
  const ty = (ry - b*sx - a*sy)/n;
  // a=scale*cos, b=scale*sin => affine 2x2 = [[a,-b],[b,a]]
  // transform: r = [[a,-b],[b,a]] * t + [tx,ty]
  return { a, b, tx, ty };
}

// ----------------------------------------------------------------
//  BILINEAR RESAMPLING (warp target frame onto reference grid)
// ----------------------------------------------------------------
function warpFrame(src, transform, refW, refH) {
  const { a, b, tx, ty } = transform;
  // Inverse transform: t = [[a,b],[-b,a]] * (r - tr)
  // since [[a,-b],[b,a]]^-1 = [[a,b],[-b,a]] / (a²+b²)
  const det = a*a+b*b || 1;
  const ia=(a)/det, ib=(b)/det;
  const itx = -(ia*tx - ib*ty);
  const ity = -(ib*tx + ia*ty);

  const { r,g,b:blue, w:sw, h:sh } = src;
  const nr=new Float32Array(refW*refH),
        ng=new Float32Array(refW*refH),
        nb=new Float32Array(refW*refH);

  for (let py=0; py<refH; py++) {
    for (let px=0; px<refW; px++) {
      // Map reference pixel back to source
      const sx = ia*px - ib*py + itx;
      const sy = ib*px + ia*py + ity;
      const idx = py*refW+px;
      if (sx<0||sx>=sw-1||sy<0||sy>=sh-1) {
        nr[idx]=0; ng[idx]=0; nb[idx]=0; continue;
      }
      // Bilinear
      const x0=sx|0, y0=sy|0, x1=x0+1, y1=y0+1;
      const fx=sx-x0, fy=sy-y0;
      const w00=(1-fx)*(1-fy), w10=fx*(1-fy), w01=(1-fx)*fy, w11=fx*fy;
      const s=(y,x)=>y*sw+x;
      nr[idx] = w00*r[s(y0,x0)]+w10*r[s(y0,x1)]+w01*r[s(y1,x0)]+w11*r[s(y1,x1)];
      ng[idx] = w00*g[s(y0,x0)]+w10*g[s(y0,x1)]+w01*g[s(y1,x0)]+w11*g[s(y1,x1)];
      nb[idx] = w00*blue[s(y0,x0)]+w10*blue[s(y0,x1)]+w01*blue[s(y1,x0)]+w11*blue[s(y1,x1)];
    }
  }
  return { r:nr, g:ng, b:nb, w:refW, h:refH };
}

// ----------------------------------------------------------------
//  STACKING METHODS
// ----------------------------------------------------------------
function stackMean(aligned) {
  const n=aligned.length, {w,h}=aligned[0];
  const R=new Float32Array(w*h),G=new Float32Array(w*h),B=new Float32Array(w*h);
  for (const f of aligned) {
    for (let i=0;i<w*h;i++){R[i]+=f.r[i];G[i]+=f.g[i];B[i]+=f.b[i];}
  }
  for (let i=0;i<w*h;i++){R[i]/=n;G[i]/=n;B[i]/=n;}
  return {r:R,g:G,b:B,w,h};
}

function stackMedian(aligned) {
  const n=aligned.length, {w,h}=aligned[0];
  const R=new Float32Array(w*h),G=new Float32Array(w*h),B=new Float32Array(w*h);
  const tmp=new Float32Array(n);
  for (let i=0;i<w*h;i++){
    for (let f=0;f<n;f++) tmp[f]=aligned[f].r[i];
    R[i]=median(tmp,n);
    for (let f=0;f<n;f++) tmp[f]=aligned[f].g[i];
    G[i]=median(tmp,n);
    for (let f=0;f<n;f++) tmp[f]=aligned[f].b[i];
    B[i]=median(tmp,n);
  }
  return {r:R,g:G,b:B,w,h};
}

function median(arr, n) {
  const s=arr.slice(0,n).sort((a,b)=>a-b);
  const m=n>>1;
  return n%2?s[m]:(s[m-1]+s[m])/2;
}

function stackKappaSigma(aligned, kappa, iters) {
  const n=aligned.length, {w,h}=aligned[0];
  const R=new Float32Array(w*h),G=new Float32Array(w*h),B=new Float32Array(w*h);
  const vals=new Float32Array(n);
  const channels=[
    {out:R,get:(f,i)=>f.r[i]},
    {out:G,get:(f,i)=>f.g[i]},
    {out:B,get:(f,i)=>f.b[i]},
  ];
  for (const {out,get} of channels) {
    for (let i=0;i<w*h;i++){
      for (let f=0;f<n;f++) vals[f]=get(aligned[f],i);
      out[i] = kappaSigmaClip(vals, n, kappa, iters);
    }
  }
  return {r:R,g:G,b:B,w,h};
}

function kappaSigmaClip(vals, n, kappa, iters) {
  let mask = new Uint8Array(n).fill(1);
  for (let it=0;it<iters;it++){
    let sum=0, cnt=0;
    for (let i=0;i<n;i++) if(mask[i]){sum+=vals[i];cnt++;}
    if(!cnt) break;
    const mean=sum/cnt;
    let ssq=0;
    for (let i=0;i<n;i++) if(mask[i]) ssq+=(vals[i]-mean)**2;
    const sig=Math.sqrt(ssq/cnt);
    for (let i=0;i<n;i++) if(mask[i]&&Math.abs(vals[i]-mean)>kappa*sig) mask[i]=0;
  }
  let s=0,c=0;
  for (let i=0;i<n;i++) if(mask[i]){s+=vals[i];c++;}
  return c?s/c:vals.slice(0,n).reduce((a,b)=>a+b,0)/n;
}

function stackWinsorized(aligned, kappa, iters) {
  const n=aligned.length, {w,h}=aligned[0];
  const R=new Float32Array(w*h),G=new Float32Array(w*h),B=new Float32Array(w*h);
  const vals=new Float32Array(n);
  const winsorize=(arr,n,k,it)=>{
    let mn=arr.slice(0,n).reduce((a,b)=>a+b)/n;
    for (let iter=0;iter<it;iter++){
      let s=0,c=0;
      for (let i=0;i<n;i++){s+=arr[i];c++;}
      mn=s/c;
      let ssq=0;
      for (let i=0;i<n;i++) ssq+=(arr[i]-mn)**2;
      const sig=Math.sqrt(ssq/n);
      for (let i=0;i<n;i++){
        if(arr[i]>mn+k*sig) arr[i]=mn+k*sig;
        else if(arr[i]<mn-k*sig) arr[i]=mn-k*sig;
      }
    }
    return arr.slice(0,n).reduce((a,b)=>a+b)/n;
  };
  [[R,'r'],[G,'g'],[B,'b']].forEach(([out,ch])=>{
    for (let i=0;i<w*h;i++){
      for (let f=0;f<n;f++) vals[f]=aligned[f][ch][i];
      out[i]=winsorize(vals.slice(),n,kappa,iters);
    }
  });
  return {r:R,g:G,b:B,w,h};
}

function stackWeighted(aligned) {
  // Weight each frame by inverse of its variance (proxy: mean absolute deviation of lumin)
  const n=aligned.length,{w,h}=aligned[0];
  const weights=aligned.map(f=>{
    const lum=f.r.map((v,i)=>0.299*v+0.587*f.g[i]+0.114*f.b[i]);
    let sum=0; lum.forEach(v=>sum+=v);
    const mean=sum/lum.length;
    let mad=0; lum.forEach(v=>mad+=Math.abs(v-mean));
    mad/=lum.length;
    return 1/(mad+0.001);
  });
  const wsum=weights.reduce((a,b)=>a+b,0);
  const R=new Float32Array(w*h),G=new Float32Array(w*h),B=new Float32Array(w*h);
  for (let fi=0;fi<n;fi++){
    const ww=weights[fi]/wsum;
    for (let i=0;i<w*h;i++){R[i]+=aligned[fi].r[i]*ww;G[i]+=aligned[fi].g[i]*ww;B[i]+=aligned[fi].b[i]*ww;}
  }
  return {r:R,g:G,b:B,w,h};
}

// ----------------------------------------------------------------
//  SKY GRADIENT REMOVAL
//  Fits a 2D polynomial background surface and subtracts it
// ----------------------------------------------------------------
function removeGradient(buf, strength) {
  const { r, g, b, w, h } = buf;
  const s = strength/10;

  const fitAndSub = (ch) => {
    // Sample a grid of background points (skip bright stars)
    const gs=16; // grid step
    const pts=[]; // {x,y,v}
    for (let y=gs; y<h-gs; y+=gs) {
      for (let x=gs; x<w-gs; x+=gs) {
        const i=y*w+x;
        const v=ch[i];
        // Skip if significantly brighter than neighbors (likely a star)
        const n1=ch[(y-gs)*w+x], n2=ch[(y+gs)*w+x], n3=ch[y*w+x-gs], n4=ch[y*w+x+gs];
        const localMed=(n1+n2+n3+n4)/4;
        if (v-localMed < 0.05) pts.push({x:x/w, y:y/h, v});
      }
    }
    if (pts.length<6) return;
    // Fit 2nd-degree polynomial: v = a + bx + cy + dx² + ey² + fxy
    const bg = fitPoly2D(pts, w, h);
    if (!bg) return;
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      const i=y*w+x;
      ch[i] = Math.max(0, ch[i] - bg[i]*s);
    }
  };
  fitAndSub(r); fitAndSub(g); fitAndSub(b);
}

function fitPoly2D(pts, w, h) {
  // 6-term least squares: [1, x, y, x², y², xy]
  const n=pts.length, m=6;
  const A=[], bv=[];
  for (const p of pts) {
    A.push([1, p.x, p.y, p.x*p.x, p.y*p.y, p.x*p.y]);
    bv.push(p.v);
  }
  // Normal equations A^T A c = A^T b
  const AtA=Array.from({length:m},()=>new Float64Array(m));
  const Atb=new Float64Array(m);
  for (let i=0;i<n;i++){
    for (let j=0;j<m;j++){
      Atb[j]+=A[i][j]*bv[i];
      for (let k=0;k<m;k++) AtA[j][k]+=A[i][j]*A[i][k];
    }
  }
  const c=solveLinear(AtA,Atb,m);
  if (!c) return null;
  const bg=new Float32Array(w*h);
  for (let y=0;y<h;y++){
    const yy=y/h;
    for (let x=0;x<w;x++){
      const xx=x/w;
      bg[y*w+x]=c[0]+c[1]*xx+c[2]*yy+c[3]*xx*xx+c[4]*yy*yy+c[5]*xx*yy;
    }
  }
  return bg;
}

function solveLinear(A, b, n) {
  // Gaussian elimination with partial pivot
  const aug=A.map((row,i)=>[...row, b[i]]);
  for (let col=0;col<n;col++){
    let maxR=col;
    for (let row=col+1;row<n;row++) if(Math.abs(aug[row][col])>Math.abs(aug[maxR][col])) maxR=row;
    [aug[col],aug[maxR]]=[aug[maxR],aug[col]];
    const piv=aug[col][col]; if(Math.abs(piv)<1e-12) return null;
    for (let row=0;row<n;row++){
      if(row===col) continue;
      const f=aug[row][col]/piv;
      for (let c=col;c<=n;c++) aug[row][c]-=f*aug[col][c];
    }
    for (let c=col;c<=n;c++) aug[col][c]/=piv;
  }
  return aug.map(row=>row[n]);
}

// ----------------------------------------------------------------
//  AUTO-STRETCH (midtone stretch)
// ----------------------------------------------------------------
function autoStretch(buf) {
  const { r, g, b, w, h } = buf;
  const n = w*h;
  // Compute median of each channel
  const med = (ch) => {
    const s=ch.slice().sort();
    return (s[n>>1]+s[(n>>1)+1])/2;
  };
  const stretch = (ch) => {
    const m=med(ch);
    if(m<=0) return;
    // Histogram stretch: remap so median maps to ~0.2
    const target=0.2;
    const scale = target/Math.max(m,0.001);
    for (let i=0;i<n;i++) ch[i]=Math.min(1,ch[i]*scale);
    // Gamma correction
    const gamma=1.8;
    for (let i=0;i<n;i++) ch[i]=Math.pow(ch[i],1/gamma);
  };
  stretch(r); stretch(g); stretch(b);
}

// ----------------------------------------------------------------
//  FOREGROUND COMPOSITION
//  Stack lower portion of frames without alignment (foreground),
//  and upper portion with alignment (sky)
// ----------------------------------------------------------------
function composeForeground(sky, fgBufs, horizonPct) {
  const horizY = Math.floor(sky.h * horizonPct / 100);
  const fgStack = masterMean(fgBufs);
  if (!fgStack) return;
  // Copy foreground into sky stack below horizon
  for (let y=horizY; y<sky.h; y++) {
    for (let x=0; x<sky.w; x++) {
      const i=y*sky.w+x;
      sky.r[i]=fgStack.r[i];
      sky.g[i]=fgStack.g[i];
      sky.b[i]=fgStack.b[i];
    }
  }
}

// ----------------------------------------------------------------
//  PROGRESS / LOG HELPERS
// ----------------------------------------------------------------
const STAGES = ['LOAD','CALIBRATE','DETECT STARS','ALIGN','STACK','GRADIENT','COMPOSE','EXPORT'];
let _logEl, _barEl, _labelEl, _stagesEl;

function initProgressUI() {
  _logEl   = document.getElementById('log-window');
  _barEl   = document.getElementById('progress-bar');
  _labelEl = document.getElementById('progress-label');
  _stagesEl= document.getElementById('progress-stages');
  _logEl.innerHTML='';
  _stagesEl.innerHTML='';
  STAGES.forEach((s,i)=>{
    const pill=document.createElement('div');
    pill.className='stage-pill';
    pill.id=`stage-${i}`;
    pill.textContent=s;
    _stagesEl.appendChild(pill);
  });
}

function setStage(i) {
  document.querySelectorAll('.stage-pill').forEach((p,j)=>{
    p.classList.toggle('active',j===i);
    if(j<i) p.classList.add('done');
  });
}

function setProgress(pct, label) {
  _barEl.style.width=pct+'%';
  _labelEl.textContent=label;
}

function log(msg, cls='') {
  const line=document.createElement('div');
  line.className='log-line'+(cls?' '+cls:'');
  line.textContent=`> ${msg}`;
  _logEl.appendChild(line);
  _logEl.scrollTop=_logEl.scrollHeight;
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

// ----------------------------------------------------------------
//  RESET / START
// ----------------------------------------------------------------
function resetStackUI() {
  document.getElementById('status-idle').style.display='flex';
  document.getElementById('status-running').style.display='none';
  document.getElementById('status-done').style.display='none';
}

document.getElementById('btn-start').addEventListener('click', startStack);
document.getElementById('btn-reset').addEventListener('click', ()=>{
  // Clear all state
  TYPES.forEach(t=>{
    State.frames[t]=[];
    document.getElementById(`thumbs-${t}`).innerHTML='';
    document.getElementById(`count-${t}`).textContent='0';
    document.getElementById(`card-${t}`).classList.remove('has-files');
  });
  updateCounts();
  showPanel('load');
});
document.getElementById('btn-download').addEventListener('click', downloadResult);

// ----------------------------------------------------------------
//  MAIN STACK PIPELINE
// ----------------------------------------------------------------
async function startStack() {
  document.getElementById('status-idle').style.display='none';
  document.getElementById('status-running').style.display='block';
  initProgressUI();

  try {
    await runPipeline();
  } catch(err) {
    log('ERROR: '+err.message, 'error');
    log('Stack aborted.', 'error');
  }
}

async function runPipeline() {
  const S = State.settings;
  const lightFrames = State.frames.light;

  // ---- STAGE 0: LOAD ----
  setStage(0);
  log(`Loading ${lightFrames.length} light frames…`, 'info');
  setProgress(2, 'Loading images…');

  const lightBufs = [];
  for (let i=0; i<lightFrames.length; i++) {
    const entry = lightFrames[i];
    await loadImageData(entry);
    lightBufs.push(imgToFloat(entry.data));
    setProgress(2 + (i/lightFrames.length)*12, `Loaded frame ${i+1}/${lightFrames.length}: ${entry.name}`);
    log(`Loaded: ${entry.name} (${entry.w}×${entry.h})`);
    await sleep(10);
  }

  // Ref dimensions from first frame
  const refW = lightBufs[0].w, refH = lightBufs[0].h;
  log(`Reference frame size: ${refW}×${refH}`, 'ok');

  // ---- STAGE 1: CALIBRATE ----
  setStage(1);
  log('Building calibration masters…', 'info');
  setProgress(14, 'Calibration…');

  // Build master bias
  let masterBias = null;
  if (S.useBias && State.frames.bias.length) {
    const bufs=[];
    for (const e of State.frames.bias) { await loadImageData(e); bufs.push(imgToFloat(e.data)); }
    masterBias = masterMean(bufs);
    log(`Master bias built from ${bufs.length} frames`, 'ok');
  }

  // Build master dark
  let masterDark = null;
  if (S.useDark && State.frames.dark.length) {
    const bufs=[];
    for (const e of State.frames.dark) { await loadImageData(e); bufs.push(imgToFloat(e.data)); }
    masterDark = masterMean(bufs);
    if (masterBias) subtractBuffer(masterDark, masterBias);
    log(`Master dark built from ${bufs.length} frames`, 'ok');
  }

  // Build master flat
  let masterFlat = null;
  if (S.useFlat && State.frames.flat.length) {
    const bufs=[];
    for (const e of State.frames.flat) { await loadImageData(e); bufs.push(imgToFloat(e.data)); }
    masterFlat = masterMean(bufs);
    if (masterBias) subtractBuffer(masterFlat, masterBias);
    log(`Master flat built from ${bufs.length} frames`, 'ok');
  }

  // Apply calibration to light frames
  const calibrated = [];
  for (let i=0; i<lightBufs.length; i++) {
    const frame = cloneFloat(lightBufs[i]);
    if (masterBias) subtractBuffer(frame, masterBias);
    if (masterDark) subtractBuffer(frame, masterDark);
    if (masterFlat) divideBuffer(frame, masterFlat);
    if (S.hotPixel) removeHotPixels(frame, S.hotPixelThresh);
    calibrated.push(frame);
    setProgress(14 + (i/lightBufs.length)*10, `Calibrating frame ${i+1}/${lightBufs.length}…`);
    await sleep(5);
  }
  log('All frames calibrated', 'ok');
  setProgress(24, 'Calibration complete');

  // ---- STAGE 2: DETECT STARS ----
  setStage(2);
  log('Detecting stars…', 'info');
  setProgress(25, 'Detecting stars in reference frame…');

  const refFrame = calibrated[0];
  const refStars = detectStars(refFrame, S.starSensitivity);
  log(`Reference frame: ${refStars.length} stars detected`, refStars.length>=S.minStars?'ok':'warn');

  if (refStars.length < S.minStars) {
    log(`Warning: only ${refStars.length} stars found (minimum ${S.minStars}). Try lowering sensitivity.`, 'warn');
  }

  const allStars = [refStars];
  for (let i=1; i<calibrated.length; i++) {
    const stars = detectStars(calibrated[i], S.starSensitivity);
    allStars.push(stars);
    log(`Frame ${i+1}: ${stars.length} stars`);
    setProgress(25 + (i/calibrated.length)*12, `Detecting stars in frame ${i+1}/${calibrated.length}…`);
    await sleep(5);
  }
  log('Star detection complete', 'ok');

  // ---- STAGE 3: ALIGN ----
  setStage(3);
  log('Aligning frames to reference…', 'info');
  setProgress(37, 'Computing alignments…');

  const aligned = [refFrame]; // reference stays
  let alignedCount = 1;

  for (let i=1; i<calibrated.length; i++) {
    const matches = matchStars(refStars, allStars[i], 40);
    if (matches.length < 3) {
      log(`Frame ${i+1}: insufficient star matches (${matches.length}) — using as-is`, 'warn');
      // Use identity transform
      aligned.push(calibrated[i]);
    } else {
      const transform = solveSimilarity(matches);
      if (!transform) {
        log(`Frame ${i+1}: transform solve failed — using as-is`, 'warn');
        aligned.push(calibrated[i]);
      } else {
        const warped = warpFrame(calibrated[i], transform, refW, refH);
        aligned.push(warped);
        const angle = Math.atan2(transform.b, transform.a) * 180/Math.PI;
        const scale = Math.sqrt(transform.a**2+transform.b**2);
        log(`Frame ${i+1}: aligned (rot=${angle.toFixed(2)}° scale=${scale.toFixed(4)} matches=${matches.length})`, 'ok');
        alignedCount++;
      }
    }
    setProgress(37 + (i/(calibrated.length-1))*18, `Aligning frame ${i+1}/${calibrated.length}…`);
    await sleep(20);
  }
  log(`${alignedCount}/${lightBufs.length} frames successfully aligned`, 'ok');

  // ---- STAGE 4: STACK ----
  setStage(4);
  log(`Stacking ${aligned.length} frames using: ${S.stackMethod}…`, 'info');
  setProgress(55, `Stacking with ${S.stackMethod}…`);
  await sleep(30);

  let stacked;
  switch(S.stackMethod) {
    case 'mean':       stacked = stackMean(aligned); break;
    case 'median':     stacked = stackMedian(aligned); break;
    case 'kappa-sigma':stacked = stackKappaSigma(aligned, S.kappa, S.kappaIters); break;
    case 'winsorized': stacked = stackWinsorized(aligned, S.kappa, S.kappaIters); break;
    case 'weighted':   stacked = stackWeighted(aligned); break;
    default:           stacked = stackKappaSigma(aligned, S.kappa, S.kappaIters);
  }
  log('Stacking complete', 'ok');
  setProgress(70, 'Stack complete');
  await sleep(20);

  // ---- STAGE 5: GRADIENT REMOVAL ----
  setStage(5);
  if (S.gradient) {
    log('Removing sky gradient…', 'info');
    setProgress(72, 'Removing sky gradient…');
    await sleep(20);
    removeGradient(stacked, S.gradientStrength);
    log('Gradient removal complete', 'ok');
  } else {
    log('Gradient removal skipped', '');
  }
  setProgress(82, 'Post-processing…');

  // ---- STAGE 6: FOREGROUND COMPOSITION ----
  setStage(6);
  if (S.foreground && calibrated.length >= 2) {
    log('Composing foreground…', 'info');
    const fgBufs = calibrated.slice(0, Math.min(S.fgFrames, calibrated.length));
    composeForeground(stacked, fgBufs, S.horizonLine);
    log('Foreground composition complete', 'ok');
  }

  // Auto stretch
  if (S.autoStretch) {
    log('Applying auto-stretch…');
    autoStretch(stacked);
  }

  // ---- STAGE 7: EXPORT ----
  setStage(7);
  log('Rendering output…', 'info');
  setProgress(92, 'Rendering…');
  await sleep(30);

  // Draw to result canvas
  const canvas = document.getElementById('result-canvas');
  const maxDim = 900;
  let dw=stacked.w, dh=stacked.h;
  if (dw>maxDim||dh>maxDim) {
    const sc=Math.min(maxDim/dw,maxDim/dh);
    dw=Math.round(dw*sc); dh=Math.round(dh*sc);
  }
  canvas.width=dw; canvas.height=dh;
  const ctx=canvas.getContext('2d');

  // Scale stacked to display canvas
  const dispCanvas=document.createElement('canvas');
  dispCanvas.width=stacked.w; dispCanvas.height=stacked.h;
  const dctx=dispCanvas.getContext('2d');
  dctx.putImageData(floatToImgData(stacked), 0, 0);
  ctx.drawImage(dispCanvas,0,0,dw,dh);

  // Store for download
  State.result = { stacked, dispCanvas, format:S.outputFormat };

  setProgress(100, 'Done!');
  log('Stack complete! ✓', 'ok');
  await sleep(300);

  // Show results
  document.getElementById('status-running').style.display='none';
  document.getElementById('status-done').style.display='block';

  // Stats
  const statsEl = document.getElementById('result-stats');
  statsEl.innerHTML = `
    <div class="result-stat"><span class="rs-val">${lightFrames.length}</span><span class="rs-label">FRAMES STACKED</span></div>
    <div class="result-stat"><span class="rs-val">${stacked.w}×${stacked.h}</span><span class="rs-label">RESOLUTION</span></div>
    <div class="result-stat"><span class="rs-val">${S.stackMethod.toUpperCase()}</span><span class="rs-label">STACK METHOD</span></div>
    <div class="result-stat"><span class="rs-val">${alignedCount}</span><span class="rs-label">FRAMES ALIGNED</span></div>
    <div class="result-stat"><span class="rs-val">${S.gradient?'YES':'NO'}</span><span class="rs-label">GRADIENT REMOVED</span></div>
  `;

  // Mark nav tabs done
  ['load','calibrate','settings'].forEach(id=>{
    const t=document.querySelector(`.nav-tab[data-panel="${id}"]`);
    if(t) t.classList.add('done');
  });
}

// ----------------------------------------------------------------
//  DOWNLOAD
// ----------------------------------------------------------------
function downloadResult() {
  if (!State.result) return;
  const { dispCanvas, format } = State.result;
  const mime = format==='jpeg'?'image/jpeg':'image/png';
  const ext  = format==='jpeg'?'jpg':'png';
  const q    = format==='jpeg'?0.95:undefined;
  const url  = dispCanvas.toDataURL(mime, q);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `sequator_stack.${ext}`;
  a.click();
  log('Result saved!', 'ok');
}
