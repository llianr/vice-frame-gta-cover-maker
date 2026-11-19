// VICE FRAME — deterministic screenshot scenes.
// Reads ?shot=editor|cover plus &size=<WxH>&grade=<id>&caption=<text>.
// Loads every built-in sample, then applies the scene for that export
// size: which photo sits in which panel and how it is framed (zoom plus
// focal point). Scenes were tuned panel by panel against the rendered
// covers — every panel holds a different photo, faces stay whole, and
// the caption band across the bottom never covers a face. Sets
// window.__shotReady once the picture is final. No network: samples
// live under app/samples/.

import { EXPORT_SIZES } from './cover.js';

const SAMPLES = ['boulevard.jpg', 'pier.jpg', 'neon.jpg', 'lifeguard.jpg', 'classic-car.jpg'];

// One scene per export size, one entry per poster panel
// (hero, bottom-left, bottom-right). Framing notes per size:
//
// landscape 1920×1080 — every panel is a wide, short slice. The hero is
//   the wide lifeguard-tower panorama. The bottom panels get the two
//   landscape scenes with no faces — the classic car and the neon sign —
//   because a portrait photo in a 2.4:1 panel is magnified until the
//   face fills the panel and lands under the caption band (checked
//   against the render: that is exactly what the first attempt did).
//   The boulevard portrait headlines the tall sizes instead.
// portrait 1080×1350 — the tall hero suits the boulevard portrait; the
//   fisherman is zoomed a little so his face clears the caption band;
//   the classic car is nearly square and lands whole.
// square 1080×1080 — lifeguard hero again (its full height fits), the
//   boulevard portrait low-left with a high focal point, classic car
//   low-right. The fisherman sits this size out: in a square bottom
//   panel his hat or his chin would meet the caption, so he only
//   appears where the geometry gives his face clear air.
const SCENES = {
  landscape: [
    { photo: 'lifeguard.jpg', zoom: 1, fx: 0.5, fy: 0.3 },
    { photo: 'classic-car.jpg', zoom: 1, fx: 0.5, fy: 0.6 },
    { photo: 'neon.jpg', zoom: 1, fx: 0.5, fy: 0.3 },
  ],
  portrait: [
    { photo: 'boulevard.jpg', zoom: 1, fx: 0.5, fy: 0.13 },
    { photo: 'pier.jpg', zoom: 1.25, fx: 0.55, fy: 0.05 },
    { photo: 'classic-car.jpg', zoom: 1, fx: 0.5, fy: 0.5 },
  ],
  square: [
    { photo: 'lifeguard.jpg', zoom: 1, fx: 0.17, fy: 0.5 },
    { photo: 'boulevard.jpg', zoom: 1, fx: 0.5, fy: 0.14 },
    { photo: 'classic-car.jpg', zoom: 1, fx: 0.5, fy: 0.55 },
  ],
};

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

  const caption = q.get('caption');
  const size = q.get('size');
  const grade = q.get('grade');

  if (size) {
    const [w, h] = size.split('x').map(Number);
    const match = EXPORT_SIZES.find((s) => s.w === w && s.h === h);
    if (match) app.setSize(match.id);
  }
  if (grade) app.setGrade(grade);
  if (caption !== null) app.setCaption(caption);

  // Load every sample through the editor's own loader, then lay the
  // scene for this size over the panels.
  for (const name of SAMPLES) await app.loadSample(name);
  const scene = SCENES[app.state.sizeId] || SCENES.landscape;
  app.state.panels.forEach((p, i) => {
    const c = scene[i % scene.length];
    const idx = app.state.photos.findIndex((ph) => ph.name === c.photo);
    if (idx < 0) return;
    p.photoIdx = idx;
    p.zoom = c.zoom;
    p.fx = c.fx;
    p.fy = c.fy;
    p.ox = 0;
    p.oy = 0;
  });
  app.render();

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
