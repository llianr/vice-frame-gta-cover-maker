// VICE FRAME — cover renderer.
// Draws a multi-panel GTA-poster-style cover on any 2d canvas context.
// Pure drawing code: no DOM, no network, no fonts to fetch (system fonts only).
// The editor (main.js) owns state; this module owns the pixels.

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'landscape', label: '1920 × 1080', w: 1920, h: 1080 },
];

// Panel layouts. Each returns rects in cover pixels: { x, y, w, h }.
// The caption is drawn over the bottom of the cover, not inside a panel.
export const LAYOUTS = {
  poster: {
    label: 'Poster — hero + duo',
    panels(W, H, g) {
      const heroH = Math.round(H * 0.62);
      return [
        { x: 0, y: 0, w: W, h: heroH },
        { x: 0, y: heroH + g, w: Math.floor((W - g) / 2), h: H - heroH - g },
        { x: Math.ceil((W + g) / 2), y: heroH + g, w: W - Math.ceil((W + g) / 2), h: H - heroH - g },
      ];
    },
  },
  grid: {
    label: 'Grid — 2 × 2',
    panels(W, H, g) {
      const cw = Math.floor((W - g) / 2);
      const ch = Math.floor((H - g) / 2);
      return [
        { x: 0, y: 0, w: cw, h: ch },
        { x: cw + g, y: 0, w: W - cw - g, h: ch },
        { x: 0, y: ch + g, w: cw, h: H - ch - g },
        { x: cw + g, y: ch + g, w: W - cw - g, h: H - ch - g },
      ];
    },
  },
  strip: {
    label: 'Strip — tall + stacked',
    panels(W, H, g) {
      const leftW = Math.round(W * 0.58);
      const rightH = Math.floor((H - g) / 2);
      return [
        { x: 0, y: 0, w: leftW, h: H },
        { x: leftW + g, y: 0, w: W - leftW - g, h: rightH },
        { x: leftW + g, y: rightH + g, w: W - leftW - g, h: H - rightH - g },
      ];
    },
  },
  duo: {
    label: 'Duo — split halves',
    panels(W, H, g) {
      const cw = Math.floor((W - g) / 2);
      return [
        { x: 0, y: 0, w: cw, h: H },
        { x: cw + g, y: 0, w: W - cw - g, h: H },
      ];
    },
  },
};

// Colour grades. `filter` runs on each photo; `wash` is a gradient painted
// over the whole cover with a blend mode; `vignette` darkens the corners.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.38) contrast(1.08) sepia(0.22) brightness(1.03)',
    wash: ['#ff9a3c', '#ff5e62', '#c81d7a'],
    blend: 'overlay',
    washAlpha: 0.42,
    vignette: 0.28,
  },
  neon: {
    label: 'Neon Night',
    filter: 'saturate(1.65) contrast(1.16) hue-rotate(-14deg) brightness(0.98)',
    wash: ['#ff2ec4', '#7b2eff', '#00e5ff'],
    blend: 'soft-light',
    washAlpha: 0.55,
    vignette: 0.3,
  },
  pastel: {
    label: 'Pastel Vice',
    filter: 'saturate(1.12) contrast(0.94) brightness(1.07)',
    wash: ['#ffb3d9', '#ffe9a8', '#7fe3d0'],
    blend: 'overlay',
    washAlpha: 0.26,
    vignette: 0.1,
  },
  noir: {
    label: 'Mono Noir',
    filter: 'grayscale(1) contrast(1.28) brightness(1.04)',
    wash: ['#ffffff', '#8a8a8a', '#000000'],
    blend: 'overlay',
    washAlpha: 0.16,
    vignette: 0.34,
  },
};

const INK = '#14001f'; // deep plum outline used for lettering and gutters
const PAPER = '#0b0614'; // cover background behind the panels

function coverFit(img, rect, zoom, ox, oy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const s = base * zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  return {
    dx: rect.x + (rect.w - dw) / 2 + ox * rect.w,
    dy: rect.y + (rect.h - dh) / 2 + oy * rect.h,
    dw,
    dh,
  };
}

function paintPhoto(ctx, img, rect, panel, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (img) {
    ctx.filter = grade.filter;
    const d = coverFit(img, rect, panel.zoom, panel.ox, panel.oy);
    ctx.drawImage(img, d.dx, d.dy, d.dw, d.dh);
    ctx.filter = 'none';
  } else {
    // Empty panel: a loud placeholder so the layout reads even before photos.
    const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    g.addColorStop(0, '#3b1155');
    g.addColorStop(1, '#12081f');
    ctx.fillStyle = g;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${Math.max(14, rect.w * 0.045)}px "Arial Black", Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
  }
  ctx.restore();
}

function paintWash(ctx, W, H, grade) {
  const g = ctx.createLinearGradient(0, 0, W * 0.25, H);
  g.addColorStop(0, grade.wash[0]);
  g.addColorStop(0.55, grade.wash[1]);
  g.addColorStop(1, grade.wash[2]);
  ctx.save();
  ctx.globalCompositeOperation = grade.blend;
  ctx.globalAlpha = grade.washAlpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (grade.vignette > 0) {
    const v = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75,
    );
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(5,0,12,${grade.vignette})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}

function paintCaption(ctx, W, H, caption, subcaption) {
  const text = (caption || 'VICE CITY').toUpperCase();
  const size = Math.round(W * (text.length > 12 ? 0.085 : 0.108));
  const cx = W / 2;
  // The caption sits in the bottom band of the cover; a dark scrim behind it
  // keeps the letters readable over any photo and unifies the panel gutters.
  const bandH = Math.round(H * 0.24);
  const scrim = ctx.createLinearGradient(0, H - bandH, 0, H);
  scrim.addColorStop(0, 'rgba(12,0,24,0)');
  scrim.addColorStop(0.45, 'rgba(12,0,24,0.42)');
  scrim.addColorStop(1, 'rgba(12,0,24,0.72)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H - bandH, W, bandH);
  const cy = H - Math.round(H * 0.075);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.022);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  // Sunlit gradient fill, thick plum outline, hard drop shadow.
  const fill = ctx.createLinearGradient(0, -size * 0.55, 0, size * 0.55);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.55, '#ffe9a8');
  fill.addColorStop(1, '#ff7a3c');
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.shadowColor = 'rgba(10,0,20,0.85)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = Math.max(4, size * 0.07);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(4, size * 0.11);
  ctx.strokeText(text, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();

  if (subcaption) {
    // Sub-caption goes ABOVE the main caption so both stay inside the cover.
    const sub = subcaption.toUpperCase();
    const ss = Math.round(W * 0.024);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${ss}px "Arial Black", Impact, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(ss * 0.35)}px`; } catch { /* older canvas */ }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, ss * 0.22);
    const sy = cy - size * 0.78;
    ctx.strokeText(sub, W / 2, sy);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sub, W / 2, sy);
    ctx.restore();
  }
}

function paintFrame(ctx, W, H) {
  const t = Math.max(6, Math.round(W * 0.008));
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = t;
  ctx.strokeRect(t / 2, t / 2, W - t, H - t);
  // Small corner ticks, poster-print style.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, t * 0.45);
  const L = Math.round(W * 0.045);
  const o = t + Math.round(W * 0.012);
  for (const [x, y, sx, sy] of [[o, o, 1, 1], [W - o, o, -1, 1], [o, H - o, 1, -1], [W - o, H - o, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * L, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * L);
    ctx.stroke();
  }
  ctx.restore();
}

// state: { layout, grade, caption, subcaption, panels: [{photo, zoom, ox, oy}] }
export function drawCover(ctx, W, H, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const layout = LAYOUTS[state.layout] || LAYOUTS.poster;
  const gap = Math.max(4, Math.round(Math.min(W, H) * 0.012));
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const rects = layout.panels(W, H, gap);
  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: null, zoom: 1, ox: 0, oy: 0 };
    paintPhoto(ctx, panel.photo, rect, panel, grade);
  });
  // Gutter lines between panels.
  ctx.fillStyle = INK;
  paintWash(ctx, W, H, grade);
  paintCaption(ctx, W, H, state.caption, state.subcaption);
  paintFrame(ctx, W, H);
  ctx.restore();
}

export function layoutPanelCount(layoutId) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.poster;
  return layout.panels(100, 100, 2).length;
}
