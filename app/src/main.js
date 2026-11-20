// Vice City Nights — editor. Owns the state, wires the controls, drag-to-crop
// on the preview, file loading, PNG export, and the deterministic ?shot=
// modes the screenshots are taken from. No network requests: sample photos
// are files under app/, uploads are read locally with FileReader.
import { GRADES, GRADE_NAMES, SIZES, SIZE_NAMES } from './grades.js';
import { drawCover, exportCoverPng, exportFileName, layoutPanels, panelCount } from './cover.js';

const SAMPLES = [
  { name: 'Boulevard', key: 'boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', key: 'pier', src: 'samples/pier.jpg' },
];

// ---------------------------------------------------------------- state

function defaultPanels(layout) {
  // Spread the two samples across the panels: hero gets the boulevard sunset,
  // the rest alternate. A panel's crop is its own zoom + offset. The hero
  // panel is wide and short, so its photo is pinned toward the top (oy < 0)
  // where the subject's face is, instead of centre-cropping it away.
  const n = panelCount(layout);
  const order = [0, 1, 0];
  return Array.from({ length: n }, (_, i) => ({
    photo: order[i] ?? 0,
    zoom: 1,
    ox: 0,
    oy: layout === 'trio' && i === 0 ? -0.75 : 0,
  }));
}

const state = {
  layout: 'trio',
  grade: 'sunset',
  size: 'square',
  title: 'VICE CITY NIGHTS',
  caption: 'One last job under the neon sky.',
  cast: 'MARCO VOSS · LENA CRUZ',
  photos: [], // { name, key, img } — samples first, uploads appended
  panels: defaultPanels('trio'),
  selected: 0,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function loadSamples() {
  state.photos = [];
  for (const s of SAMPLES) {
    try {
      state.photos.push({ name: s.name, key: s.key, img: await loadImage(s.src) });
    } catch (err) {
      console.error(err);
    }
  }
}

// ---------------------------------------------------------------- dom

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');
const params = new URLSearchParams(location.search);

/** The cover's export pixel size for the current size choice. */
function exportSize() {
  return SIZES[state.size] || SIZES.square;
}

/** Scale the preview canvas to the export size, capped for the screen. */
function fitPreview() {
  const size = exportSize();
  const scale = Math.min(1, 720 / Math.max(size.width, size.height));
  preview.width = Math.round(size.width * scale);
  preview.height = Math.round(size.height * scale);
}

function render() {
  fitPreview();
  drawCover(pctx, state, preview.width, preview.height);
}

/** Keep the segmented buttons in sync with state. */
function syncControls() {
  for (const [segId, key, names] of [
    ['layout-seg', 'layout', ['solo', 'duo', 'trio']],
    ['grade-seg', 'grade', GRADE_NAMES],
    ['size-seg', 'size', SIZE_NAMES],
  ]) {
    const seg = $(segId);
    if (!seg) continue;
    for (const btn of seg.querySelectorAll('button')) {
      const attr = key === 'layout' ? 'layout' : key === 'grade' ? 'grade' : 'size';
      btn.classList.toggle('active', btn.dataset[attr] === state[key]);
    }
  }
  for (const btn of document.querySelectorAll('.sample-btn')) {
    const panel = state.panels[state.selected];
    btn.classList.toggle('active', !!panel && state.photos[panel.photo]?.key === btn.dataset.photo);
  }
  const tag = $('panel-tag');
  const panel = state.panels[state.selected];
  if (panel) {
    tag.hidden = false;
    tag.textContent = `Panel ${state.selected + 1} · ${state.photos[panel.photo]?.name ?? 'photo'}`;
    $('zoom-input').value = String(Math.round(panel.zoom * 100));
    $('zoom-out').value = `${Math.round(panel.zoom * 100)}%`;
  } else {
    tag.hidden = true;
  }
  const select = $('panel-photo');
  select.innerHTML = '';
  state.photos.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    if (panel && panel.photo === i) opt.selected = true;
    select.appendChild(opt);
  });
}

function setLayout(layout) {
  if (!['solo', 'duo', 'trio'].includes(layout)) return;
  const old = state.panels;
  state.layout = layout;
  state.panels = defaultPanels(layout);
  // Keep crops where the panel index still exists.
  state.panels.forEach((p, i) => { if (old[i]) Object.assign(p, old[i]); });
  state.selected = Math.min(state.selected, state.panels.length - 1);
  syncControls();
  render();
}

function setGrade(grade) {
  if (!GRADES[grade]) return;
  state.grade = grade;
  syncControls();
  render();
}

function setSize(size) {
  if (!SIZES[size]) return;
  state.size = size;
  syncControls();
  render();
}

// ---------------------------------------------------------------- export

async function doExport() {
  const status = $('export-status');
  try {
    status.textContent = 'Exporting…';
    const info = await exportCoverPng(state, state.size);
    window.__exportInfo = { ...info, blob: undefined, mime: 'image/png' };
    const url = URL.createObjectURL(info.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(state.size);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    status.textContent = `Exported ${info.width} × ${info.height} PNG — ${(info.bytes / 1024).toFixed(0)} KiB.`;
    return info;
  } catch (err) {
    console.error(err);
    status.textContent = `Export failed: ${err.message}`;
    throw err;
  }
}

/** Test hook for the screenshot run: export without a download click. */
window.__exportPng = async () => {
  const info = await exportCoverPng(state, state.size);
  window.__exportInfo = { bytes: info.bytes, width: info.width, height: info.height, mime: 'image/png' };
  return window.__exportInfo;
};

// ---------------------------------------------------------------- drag to crop

function previewPoint(event) {
  const r = preview.getBoundingClientRect();
  return {
    x: (event.clientX - r.left) * (preview.width / r.width),
    y: (event.clientY - r.top) * (preview.height / r.height),
  };
}

function panelAt(point) {
  const rects = layoutPanels(state.layout, preview.width, preview.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null; // { panel, lastX, lastY }

preview.addEventListener('pointerdown', (event) => {
  const point = previewPoint(event);
  const i = panelAt(point);
  if (i < 0) return;
  state.selected = i;
  syncControls();
  drag = { panel: i, lastX: point.x, lastY: point.y };
  preview.setPointerCapture(event.pointerId);
  preview.classList.add('dragging');
  render();
});

preview.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = previewPoint(event);
  const panel = state.panels[drag.panel];
  const rect = layoutPanels(state.layout, preview.width, preview.height)[drag.panel];
  const img = state.photos[panel.photo]?.img;
  if (!img) return;
  // Convert a screen drag into a normalised crop offset.
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const excessX = Math.max(1, img.naturalWidth * scale - rect.w);
  const excessY = Math.max(1, img.naturalHeight * scale - rect.h);
  panel.ox = Math.max(-1, Math.min(1, panel.ox - (2 * (point.x - drag.lastX)) / excessX));
  panel.oy = Math.max(-1, Math.min(1, panel.oy - (2 * (point.y - drag.lastY)) / excessY));
  drag.lastX = point.x;
  drag.lastY = point.y;
  render();
});

function endDrag() {
  drag = null;
  preview.classList.remove('dragging');
}
preview.addEventListener('pointerup', endDrag);
preview.addEventListener('pointercancel', endDrag);

preview.addEventListener('wheel', (event) => {
  event.preventDefault();
  const point = previewPoint(event);
  const i = panelAt(point);
  if (i < 0) return;
  state.selected = i;
  const panel = state.panels[i];
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
  syncControls();
  render();
}, { passive: false });

// ---------------------------------------------------------------- controls

$('layout-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-layout]');
  if (btn) setLayout(btn.dataset.layout);
});
$('grade-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-grade]');
  if (btn) setGrade(btn.dataset.grade);
});
$('size-seg').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-size]');
  if (btn) setSize(btn.dataset.size);
});

document.querySelectorAll('.sample-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = state.photos.findIndex((p) => p.key === btn.dataset.photo);
    if (idx < 0) return;
    state.panels[state.selected].photo = idx;
    syncControls();
    render();
  });
});

$('panel-photo').addEventListener('change', (e) => {
  state.panels[state.selected].photo = Number(e.target.value);
  syncControls();
  render();
});
$('zoom-input').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value) / 100;
  syncControls();
  render();
});
$('reset-crop').addEventListener('click', () => {
  const p = state.panels[state.selected];
  p.zoom = 1; p.ox = 0; p.oy = 0;
  syncControls();
  render();
});

$('title-input').addEventListener('input', (e) => { state.title = e.target.value; render(); });
$('caption-input').addEventListener('input', (e) => { state.caption = e.target.value; render(); });
$('cast-input').addEventListener('input', (e) => { state.cast = e.target.value; render(); });

$('file-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('could not read file'));
    reader.readAsDataURL(file);
  });
  const img = await loadImage(dataUrl);
  const name = file.name.replace(/\.[^.]+$/, '') || 'Your photo';
  state.photos.push({ name, key: `upload-${state.photos.length}`, img });
  state.panels[state.selected].photo = state.photos.length - 1;
  $('export-status').textContent = `Loaded “${name}” — it stays on your machine.`;
  syncControls();
  render();
});

$('export-btn').addEventListener('click', doExport);

// ---------------------------------------------------------------- ?shot= modes
// Deterministic renders for screenshots, documented in shots.json:
//   ?shot=cover&photo=pier&layout=trio&size=square&grade=sunset&title=…&caption=…
//       full-viewport finished cover (editor chrome hidden)
//   ?shot=editor&photo=boulevard&layout=duo&size=portrait
//       the editor UI with that photo loaded and layout applied
// Any param may be omitted; defaults are the editor's defaults above.

function applyParams() {
  if (params.get('layout')) setLayout(params.get('layout'));
  if (params.get('grade')) setGrade(params.get('grade'));
  if (params.get('size')) setSize(params.get('size'));
  if (params.get('title') !== null) { state.title = params.get('title'); $('title-input').value = state.title; }
  if (params.get('caption') !== null) { state.caption = params.get('caption'); $('caption-input').value = state.caption; }
  if (params.get('cast') !== null) { state.cast = params.get('cast'); $('cast-input').value = state.cast; }
  // ?photo= fills every panel with that photo, staggered crops so a
  // multi-panel cover still reads as several shots, not one repeated frame.
  const photo = params.get('photo');
  if (photo) {
    const idx = state.photos.findIndex((p) => p.key === photo);
    if (idx >= 0) {
      state.panels.forEach((p, i) => {
        p.photo = idx;
        p.zoom = i === 0 ? 1 : 1.12;
        p.ox = i === 0 ? 0 : i === 1 ? 0.55 : -0.55;
        // Hero panel: pin toward the top of the photo so faces stay in frame.
        p.oy = i === 0 ? -0.75 : 0.25;
      });
    }
  }
}

async function boot() {
  await loadSamples();
  applyParams();
  const shot = params.get('shot');
  if (shot === 'cover') {
    // Full-viewport finished cover at export resolution, CSS-scaled down.
    document.body.classList.add('shot-cover');
    const size = exportSize();
    preview.width = size.width;
    preview.height = size.height;
    drawCover(pctx, state, size.width, size.height);
    document.title = `Vice City Nights — ${state.title}`;
  } else {
    render();
  }
  syncControls();
  window.__shotReady = true;
}

boot().catch((err) => {
  console.error(err);
  window.__shotError = String(err);
});
