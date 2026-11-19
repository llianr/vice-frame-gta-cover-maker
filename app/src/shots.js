// VICE FRAME — deterministic screenshot scenes.
// Reads ?shot=editor|cover plus &photo=<sample>&caption=<text>&size=<WxH>.
// Loads the named sample photo into every panel, applies the caption, paints
// once, then sets window.__shotReady so a screenshot runner knows the
// picture is final. No network: samples live under app/samples/.

import { EXPORT_SIZES } from './cover.js';

function params() {
  return new URLSearchParams(window.location.search);
}

async function waitForApp() {
  for (let i = 0; i < 100 && !window.__viceFrame; i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return window.__viceFrame;
}

async function runShot() {
  const q = params();
  const shot = q.get('shot');
  if (!shot) return;
  const app = await waitForApp();
  if (!app) return;

  const photo = q.get('photo') || 'boulevard.jpg';
  const caption = q.get('caption');
  const size = q.get('size');
  const grade = q.get('grade');
  const layout = q.get('layout');

  if (size) {
    const [w, h] = size.split('x').map(Number);
    const match = EXPORT_SIZES.find((s) => s.w === w && s.h === h);
    if (match) app.setSize(match.id);
  }
  if (layout) app.setLayout(layout);
  if (grade) app.setGrade(grade);
  if (caption !== null) app.setCaption(caption);

  // Load the sample photo (fresh Image each run so panels all get it).
  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
    img.src = `samples/${photo}`;
  });
  if (img.naturalWidth > 0) {
    // Push the photo into the editor's photo list via its own loader path:
    // reuse loadSample so the photo lands in every empty panel.
    await app.loadSample(photo);
    await app.loadSample('pier.jpg');
    // A poster reads as a poster only when its panels differ: alternate the
    // two samples and vary the crop per panel instead of repeating one shot.
    const crops = [
      { photoIdx: 0, zoom: 1.0, ox: 0, oy: 0.28 },
      { photoIdx: 1, zoom: 1.15, ox: 0.1, oy: 0.12 },
      { photoIdx: 0, zoom: 1.5, ox: -0.08, oy: 0.05 },
      { photoIdx: 1, zoom: 1.0, ox: -0.06, oy: 0.05 },
    ];
    app.state.panels.forEach((p, i) => {
      const c = crops[i % crops.length];
      p.photoIdx = c.photoIdx;
      p.zoom = c.zoom;
      p.ox = c.ox;
      p.oy = c.oy;
    });
    app.render();
  }

  if (shot === 'cover') {
    // Full-bleed cover scene: hide the editor chrome, show the cover alone
    // at the export aspect ratio, so a screenshot of the page IS the cover
    // the app drew — never an edit or a composite.
    document.body.classList.add('shot-cover');
    const s = app.state.sizeId === 'square'
      ? { w: 1080, h: 1080 }
      : app.state.sizeId === 'portrait' ? { w: 1080, h: 1350 } : { w: 1920, h: 1080 };
    const scale = Math.min(window.innerWidth / s.w, window.innerHeight / s.h);
    const c = document.getElementById('preview');
    c.style.width = `${Math.floor(s.w * scale)}px`;
    c.style.height = `${Math.floor(s.h * scale)}px`;
    c.style.maxWidth = 'none';
    c.style.maxHeight = 'none';
    app.render();
  }

  // One animation frame so the paint is really on screen.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}

runShot().catch(() => { window.__shotReady = true; });
