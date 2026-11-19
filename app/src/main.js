// VICE FRAME — editor wiring.
// Owns the page state, the preview canvas, the file inputs and the export.
// All drawing goes through drawCover() in cover.js so the preview and the
// exported PNG are the same picture at different sizes.

import { drawCover, DEFAULT_FX, DEFAULT_FY, EXPORT_SIZES, GRADES, LAYOUTS, layoutPanelCount } from './cover.js';

// The built-in sample photos, in the order the demo loads them. Five
// different scenes — a boulevard portrait, a pier fisherman, a neon hotel
// sign, a lifeguard tower and a classic car — so every multi-panel layout
// can give each panel its own photo. Sources and licences: see README.md.
const SAMPLES = ['boulevard.jpg', 'pier.jpg', 'neon.jpg', 'lifeguard.jpg', 'classic-car.jpg'];

const $ = (id) => document.getElementById(id);
const canvas = $('preview');
const ctx = canvas.getContext('2d');

const state = {
  layout: 'poster',
  grade: 'sunset',
  sizeId: 'landscape',
  caption: 'VICE CITY',
  subcaption: 'NEON NIGHTS • 2026',
  photos: [], // { name, img } — in load order
  panels: [], // { photoIdx, zoom, ox, oy } — one per layout panel
};

let selectedPanel = 0;
let drag = null; // { x, y, ox, oy } while the pointer pans a photo

function sizeOf() {
  return EXPORT_SIZES.find((s) => s.id === state.sizeId) || EXPORT_SIZES[2];
}

function newPanel() {
  // fx / fy: the photo's focal point. The default sits in the upper third
  // of the photo so faces survive wide, short panels (see cover.js).
  return { photoIdx: -1, zoom: 1, ox: 0, oy: 0, fx: DEFAULT_FX, fy: DEFAULT_FY };
}

function ensurePanels() {
  const n = layoutPanelCount(state.layout);
  while (state.panels.length < n) state.panels.push(newPanel());
  state.panels.length = n;
  if (selectedPanel >= n) selectedPanel = 0;
}

// Give every panel a different photo while unused photos remain. Panels
// that already hold a unique photo keep it; empty or duplicated panels
// take the next unused photo in load order. Only when the photos run out
// (fewer photos than panels) does a later panel reuse one — and a single
// loaded photo still fills the whole cover, as it always has.
function assignDistinctPhotos() {
  if (state.photos.length === 0) return;
  const used = new Set();
  state.panels.forEach((p, i) => {
    if (p.photoIdx < 0 || used.has(p.photoIdx)) {
      const free = state.photos.findIndex((_, j) => !used.has(j));
      p.photoIdx = free >= 0 ? free : i % state.photos.length;
    }
    used.add(p.photoIdx);
  });
}

function panelStates() {
  ensurePanels();
  return state.panels.map((p) => ({
    photo: p.photoIdx >= 0 ? state.photos[p.photoIdx].img : null,
    zoom: p.zoom,
    ox: p.ox,
    oy: p.oy,
    fx: p.fx ?? DEFAULT_FX,
    fy: p.fy ?? DEFAULT_FY,
  }));
}

function render() {
  const s = sizeOf();
  // Preview canvas keeps the export aspect ratio at a handy on-screen size.
  const scale = Math.min(920 / s.w, 560 / s.h);
  canvas.width = Math.round(s.w * scale);
  canvas.height = Math.round(s.h * scale);
  drawCover(ctx, canvas.width, canvas.height, {
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    subcaption: state.subcaption,
    panels: panelStates(),
  });
  // Highlight the selected panel with a dashed outline — in the editor
  // only. In the full-bleed cover scene (body.shot-cover) the page IS the
  // cover, so it must render exactly what Export PNG produces, with no
  // editor chrome painted over it.
  const gap = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.012));
  const rects = LAYOUTS[state.layout].panels(canvas.width, canvas.height, gap);
  const r = rects[selectedPanel];
  if (r && !document.body.classList.contains('shot-cover')) {
    ctx.save();
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#00e5ff';
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.restore();
  }
  syncPanelControls();
}

function syncPanelControls() {
  const p = state.panels[selectedPanel];
  if (!p) return;
  $('panelLabel').textContent = `Panel ${selectedPanel + 1} of ${state.panels.length}`;
  $('zoom').value = p.zoom;
  $('zoomVal').textContent = `${Math.round(p.zoom * 100)}%`;
  $('shiftX').value = p.ox;
  $('shiftY').value = p.oy;
  const sel = $('photoPick');
  sel.value = String(p.photoIdx);
}

function fillPhotoPick() {
  const sel = $('photoPick');
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = '(empty panel)';
  sel.appendChild(none);
  state.photos.forEach((ph, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = ph.name;
    sel.appendChild(o);
  });
  const strip = $('photoStrip');
  strip.innerHTML = '';
  state.photos.forEach((ph, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.textContent = ph.name;
    b.title = `Put ${ph.name} in panel ${selectedPanel + 1}`;
    b.addEventListener('click', () => {
      state.panels[selectedPanel].photoIdx = i;
      render();
    });
    strip.appendChild(b);
  });
}

function addPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.photos.push({ name: file.name, img });
      URL.revokeObjectURL(url);
      // New photo goes into the empty/duplicated panels first, so adding
      // photos one by one still ends with a different photo per panel.
      assignDistinctPhotos();
      fillPhotoPick();
      render();
      resolve();
    };
    img.onerror = () => reject(new Error(`Could not read ${file.name}`));
    img.src = url;
  });
}

function loadSample(name) {
  // Loading the same sample twice would defeat the distinct-photo spread.
  if (state.photos.some((ph) => ph.name === name)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      state.photos.push({ name, img });
      // Spread the photos across the panels so no panel repeats a photo
      // while an unused one exists (the old two-sample spread repeated
      // the first photo in panel 3 of the poster layout).
      assignDistinctPhotos();
      fillPhotoPick();
      render();
      resolve();
    };
    img.onerror = () => reject(new Error(`Could not load sample ${name}`));
    img.src = `samples/${name}`;
  });
}

async function exportPNG() {
  const s = sizeOf();
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  const octx = off.getContext('2d');
  drawCover(octx, s.w, s.h, {
    layout: state.layout,
    grade: state.grade,
    caption: state.caption,
    subcaption: state.subcaption,
    panels: panelStates(),
  });
  const blob = await new Promise((res) => off.toBlob(res, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vice-frame-${s.id}-${s.w}x${s.h}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { w: s.w, h: s.h, bytes: blob.size };
}

// --- toolbar ---------------------------------------------------------------

function buildButtons(el, entries, current, onPick) {
  el.innerHTML = '';
  for (const [id, label] of entries) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (id === current ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      onPick(id);
      buildButtons(el, entries, id, onPick);
      render();
    });
    el.appendChild(b);
  }
}

buildButtons($('layouts'), Object.entries(LAYOUTS).map(([id, l]) => [id, l.label]), state.layout, (id) => {
  state.layout = id;
  ensurePanels();
  // A layout with more panels (grid has 4) must not leave the new panels
  // empty or repeating while an unused photo is loaded.
  assignDistinctPhotos();
});
buildButtons($('grades'), Object.entries(GRADES).map(([id, g]) => [id, g.label]), state.grade, (id) => {
  state.grade = id;
});
buildButtons($('sizes'), EXPORT_SIZES.map((s) => [s.id, s.label]), state.sizeId, (id) => {
  state.sizeId = id;
});

// --- inputs ----------------------------------------------------------------

$('caption').addEventListener('input', (e) => { state.caption = e.target.value; render(); });
$('subcaption').addEventListener('input', (e) => { state.subcaption = e.target.value; render(); });
$('fileInput').addEventListener('change', async (e) => {
  for (const f of e.target.files) await addPhotoFile(f);
  e.target.value = '';
});
$('sampleBtn').addEventListener('click', async () => {
  for (const name of SAMPLES) await loadSample(name);
});
$('photoPick').addEventListener('change', (e) => {
  state.panels[selectedPanel].photoIdx = Number(e.target.value);
  render();
});
$('zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value);
  render();
});
$('shiftX').addEventListener('input', (e) => {
  state.panels[selectedPanel].ox = Number(e.target.value);
  render();
});
$('shiftY').addEventListener('input', (e) => {
  state.panels[selectedPanel].oy = Number(e.target.value);
  render();
});
$('exportBtn').addEventListener('click', async () => {
  const btn = $('exportBtn');
  btn.disabled = true;
  btn.textContent = 'Exporting…';
  try {
    const info = await exportPNG();
    $('status').textContent = `Exported ${info.w} × ${info.h} PNG (${Math.round(info.bytes / 1024)} KiB).`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Export PNG';
  }
});

// --- canvas interaction: click picks a panel, drag pans its photo ---------

function panelAt(px, py) {
  const gap = Math.max(4, Math.round(Math.min(canvas.width, canvas.height) * 0.012));
  const rects = LAYOUTS[state.layout].panels(canvas.width, canvas.height, gap);
  const scaleX = canvas.width / canvas.getBoundingClientRect().width;
  const scaleY = canvas.height / canvas.getBoundingClientRect().height;
  const x = px * scaleX;
  const y = py * scaleY;
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const idx = panelAt(e.clientX - rect.left, e.clientY - rect.top);
  if (idx < 0) return;
  selectedPanel = idx;
  const p = state.panels[idx];
  drag = { x: e.clientX, y: e.clientY, ox: p.ox, oy: p.oy, moved: false };
  canvas.setPointerCapture(e.pointerId);
  render();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = state.panels[selectedPanel];
  const rect = canvas.getBoundingClientRect();
  const dx = (e.clientX - drag.x) / rect.width;
  const dy = (e.clientY - drag.y) / rect.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.004) drag.moved = true;
  p.ox = Math.max(-0.5, Math.min(0.5, drag.ox + dx));
  p.oy = Math.max(-0.5, Math.min(0.5, drag.oy + dy));
  render();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// --- boot ------------------------------------------------------------------

ensurePanels();
fillPhotoPick();
render();

// Handle for the deterministic screenshot flow (shots.js) and for tests.
window.__viceFrame = {
  state,
  render,
  exportPNG,
  loadSample,
  setCaption(t) { state.caption = t; $('caption').value = t; render(); },
  setSubcaption(t) { state.subcaption = t; $('subcaption').value = t; render(); },
  setLayout(id) { state.layout = id; ensurePanels(); assignDistinctPhotos(); render(); },
  setGrade(id) { state.grade = id; render(); },
  setSize(id) { state.sizeId = id; render(); },
};
