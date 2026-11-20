// Vice City Nights — cover renderer. Draws the multi-panel GTA-style poster
// onto any 2D canvas: panels, per-panel photo crop, colour grade, bold poster
// lettering. Pure canvas, no network, deterministic for a given state.
import { GRADES, SIZES } from './grades.js';

/** Panel rectangles for a layout, as fractions of the canvas, gutters included. */
export function layoutPanels(layout, width, height) {
  const g = Math.max(6, Math.round(width * 0.008)); // gutter, px
  if (layout === 'solo') {
    return [{ x: 0, y: 0, w: width, h: height }];
  }
  if (layout === 'duo') {
    const leftW = Math.round(width * 0.52);
    return [
      { x: 0, y: 0, w: leftW, h: height },
      { x: leftW + g, y: 0, w: width - leftW - g, h: height },
    ];
  }
  // trio: one wide hero panel on top, two panels beneath — the comic-strip look.
  const topH = Math.round(height * 0.56);
  const botW = Math.round((width - g) / 2);
  return [
    { x: 0, y: 0, w: width, h: topH },
    { x: 0, y: topH + g, w: botW, h: height - topH - g },
    { x: botW + g, y: topH + g, w: width - botW - g, h: height - topH - g },
  ];
}

/** How many panels a layout has. */
export function panelCount(layout) {
  return layout === 'solo' ? 1 : layout === 'duo' ? 2 : 3;
}

/**
 * Cover-fit draw rectangle for an image inside a panel rect, with a zoom
 * factor and a normalised offset. offset.x / offset.y run -1..1 (0 = centred);
 * the image is clamped so it always covers the panel.
 */
export function fitPhoto(img, rect, panel) {
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const maxX = Math.max(0, (dw - rect.w) / 2);
  const maxY = Math.max(0, (dh - rect.h) / 2);
  const ox = Math.max(-1, Math.min(1, panel.ox || 0));
  const oy = Math.max(-1, Math.min(1, panel.oy || 0));
  return {
    x: rect.x + (rect.w - dw) / 2 - ox * maxX,
    y: rect.y + (rect.h - dh) / 2 - oy * maxY,
    w: dw,
    h: dh,
  };
}

/** Paint one grade overlay over a clipped panel rectangle. */
function paintGrade(ctx, grade, rect) {
  for (const layer of grade.overlays) {
    const grad = ctx.createLinearGradient(
      rect.x + layer.from[0] * rect.w, rect.y + layer.from[1] * rect.h,
      rect.x + layer.to[0] * rect.w, rect.y + layer.to[1] * rect.h,
    );
    for (const [at, color] of layer.stops) grad.addColorStop(at, color);
    ctx.save();
    ctx.globalCompositeOperation = layer.blend;
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
  if (grade.vignette > 0) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const r = Math.hypot(rect.w, rect.h) / 2;
    const vg = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${grade.vignette})`);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = vg;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }
}

const POSTER_FONT = '"Arial Black", Impact, "Helvetica Neue", sans-serif';
const BODY_FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Shrink a font size until the text fits maxWidth. Returns the fitted size. */
function fitFont(ctx, text, startPx, maxWidth, weight, family) {
  let px = startPx;
  for (;;) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth || px <= 18) return px;
    px = Math.max(18, Math.floor(px * 0.94));
  }
}

/** Draw the poster's title band: gradient scrim, accent rule, title, caption, cast.
 *  Laid out bottom-up from the cast line so nothing overlaps at any aspect ratio. */
function paintLettering(ctx, state, width, height) {
  const cx = width / 2;
  const title = (state.title || 'VICE CITY NIGHTS').toUpperCase();
  const caption = state.caption || '';
  const cast = (state.cast || '').trim();
  const maxW = width * 0.92;

  // Measure first, then place: cast at the bottom, caption above it, title above that.
  const castPx = Math.round(width * 0.019);
  const castY = height - Math.round(height * 0.022);
  const capPx = caption
    ? fitFont(ctx, caption, Math.round(width * 0.030), maxW, 600, BODY_FONT)
    : 0;
  const captionY = cast ? castY - castPx - Math.round(height * 0.030) : castY;
  const titlePx = fitFont(ctx, title, Math.round(width * 0.088), maxW, 900, POSTER_FONT);
  const titleGap = Math.round(height * 0.040);
  const titleY = caption ? captionY - capPx - titleGap : castY - titleGap;
  const ruleY = titleY - titlePx - Math.round(height * 0.028);
  const bandTop = ruleY - Math.round(height * 0.05);

  // Scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, bandTop, 0, height);
  scrim.addColorStop(0, 'rgba(8,3,16,0)');
  scrim.addColorStop(0.5, 'rgba(8,3,16,0.55)');
  scrim.addColorStop(1, 'rgba(8,3,16,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandTop, width, height - bandTop);

  // Accent rule above the title.
  const ruleW = Math.round(width * 0.34);
  const rule = ctx.createLinearGradient((width - ruleW) / 2, 0, (width + ruleW) / 2, 0);
  rule.addColorStop(0, '#ff9a3c');
  rule.addColorStop(0.5, '#ff2e88');
  rule.addColorStop(1, '#7b2fff');
  ctx.fillStyle = rule;
  ctx.fillRect((width - ruleW) / 2, ruleY, ruleW, Math.max(3, Math.round(height * 0.005)));

  // Title: heavy condensed poster type, dark outline, warm gradient fill.
  const titleGrad = ctx.createLinearGradient(0, titleY - titlePx, 0, titleY);
  if (state.grade === 'noir') {
    titleGrad.addColorStop(0, '#ffffff');
    titleGrad.addColorStop(1, '#c9c9c9');
  } else if (state.grade === 'neon') {
    titleGrad.addColorStop(0, '#eafffb');
    titleGrad.addColorStop(0.55, '#ffffff');
    titleGrad.addColorStop(1, '#ff9ad2');
  } else {
    titleGrad.addColorStop(0, '#fff8e2');
    titleGrad.addColorStop(0.55, '#ffffff');
    titleGrad.addColorStop(1, '#ffb347');
  }
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${Math.round(titlePx * 0.015)}px`; } catch { /* older canvas: ignore */ }
  ctx.font = `900 ${titlePx}px ${POSTER_FONT}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#160409';
  ctx.lineWidth = Math.max(3, Math.round(titlePx * 0.13));
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(titlePx * 0.12);
  ctx.shadowOffsetY = Math.round(titlePx * 0.045);
  ctx.strokeText(title, cx, titleY);
  ctx.fillStyle = titleGrad;
  ctx.fillText(title, cx, titleY);
  ctx.restore();

  // Caption line under the title.
  if (caption) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `italic 600 ${capPx}px ${BODY_FONT}`;
    ctx.fillStyle = '#ffe9f4';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = Math.round(capPx * 0.25);
    ctx.shadowOffsetY = Math.round(capPx * 0.08);
    ctx.fillText(caption, cx, captionY);
    ctx.restore();
  }

  // Cast line pinned to the very bottom.
  if (cast) {
    ctx.save();
    ctx.textAlign = 'center';
    try { ctx.letterSpacing = `${Math.round(castPx * 0.22)}px`; } catch { /* ignore */ }
    ctx.font = `700 ${castPx}px ${BODY_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText(`STARRING  ${cast.toUpperCase()}`, cx, castY);
    ctx.restore();
  }
}

/**
 * Draw the whole cover onto ctx at the given pixel size.
 * state: { layout, grade, title, caption, cast, panels, photos }
 *   panels: [{ photo, zoom, ox, oy }] — one per layout panel
 *   photos: [{ name, img }] — loaded HTMLImageElements
 */
export function drawCover(ctx, state, width, height) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0d0a14';
  ctx.fillRect(0, 0, width, height);

  const grade = GRADES[state.grade] || GRADES.sunset;
  const rects = layoutPanels(state.layout, width, height);
  const borderW = Math.max(2, Math.round(width * 0.004));

  rects.forEach((rect, i) => {
    const panel = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const photo = state.photos[panel.photo];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (photo && photo.img && photo.img.naturalWidth > 0) {
      const d = fitPhoto(photo.img, rect, panel);
      ctx.filter = grade.filter;
      ctx.drawImage(photo.img, d.x, d.y, d.w, d.h);
      ctx.filter = 'none';
    } else {
      // No photo yet: a warm placeholder gradient so the panel is never blank.
      const ph = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      ph.addColorStop(0, '#3a1c5c');
      ph.addColorStop(0.5, '#8a2b6d');
      ph.addColorStop(1, '#ff7a3c');
      ctx.fillStyle = ph;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    paintGrade(ctx, grade, rect);
    ctx.restore();
    // Crisp panel edge, poster style.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = borderW;
    ctx.strokeRect(rect.x + borderW / 2, rect.y + borderW / 2, rect.w - borderW, rect.h - borderW);
  });

  paintLettering(ctx, state, width, height);
  ctx.restore();
}

/** Render the cover to a fresh canvas at an export size. */
export function renderCover(state, sizeName) {
  const size = SIZES[sizeName] || SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  drawCover(canvas.getContext('2d'), state, size.width, size.height);
  return canvas;
}

/** Export the cover as a PNG blob. Resolves { blob, bytes, width, height }. */
export async function exportCoverPng(state, sizeName) {
  const canvas = renderCover(state, sizeName);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), 'image/png');
  });
  return { blob, bytes: blob.size, width: canvas.width, height: canvas.height };
}

/** Download filename for an export. */
export function exportFileName(sizeName) {
  const size = SIZES[sizeName] || SIZES.square;
  return `vice-city-nights-${size.width}x${size.height}.png`;
}
