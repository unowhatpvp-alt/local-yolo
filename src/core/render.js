/** Rendering uses source-pixel coordinates. Crop and mirror are applied exactly once here. */
const SKELETON = [[5, 7], [7, 9], [6, 8], [8, 10], [5, 6], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 1], [0, 2], [1, 3], [2, 4]];
const COLORS = ['#ffffff', '#e3e3e3', '#cccccc', '#f3eee3', '#d8d3c9', '#bcbcbc'];
let maskCanvas;

function dimensions(source) {
  return { width: source?.videoWidth || source?.naturalWidth || source?.width || 0, height: source?.videoHeight || source?.naturalHeight || source?.height || 0 };
}

export function renderFrame(canvas, source, result, { showResults = true, mirror = false, crop, maxDimension = 1920 } = {}) {
  const size = dimensions(source);
  if (!size.width || !size.height) return null;
  const view = crop?.width > 0 && crop?.height > 0 ? crop : { x: 0, y: 0, ...size };
  const scale = Math.min(1, maxDimension / Math.max(view.width, view.height));
  const width = Math.max(1, Math.round(view.width * scale));
  const height = Math.max(1, Math.round(view.height * scale));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.save();
  if (mirror) { ctx.translate(width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, view.x, view.y, view.width, view.height, 0, 0, width, height);
  ctx.restore();
  if (result && showResults) renderResult(ctx, result, { show: true, mirror, crop: view });
  return { width, height };
}

function label(ctx, text, x, y, fontSize, color) {
  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const pad = fontSize * 0.36;
  const width = Math.min(ctx.canvas.width, ctx.measureText(text).width + pad * 2);
  const height = fontSize + pad * 2;
  const left = Math.max(0, Math.min(x, ctx.canvas.width - width));
  const top = Math.max(0, Math.min(y - height, ctx.canvas.height - height));
  ctx.fillStyle = 'rgba(17,17,17,.86)';
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(text, left + pad, top + pad, width - pad * 2);
  ctx.restore();
}

function paintMask(ctx, mask, map, color, mirror) {
  if (!mask?.data || !mask.width || !mask.height || !mask.box) return;
  maskCanvas ||= document.createElement('canvas');
  if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) { maskCanvas.width = mask.width; maskCanvas.height = mask.height; }
  const scratch = maskCanvas.getContext('2d');
  const pixels = scratch.createImageData(mask.width, mask.height);
  for (let i = 0; i < mask.width * mask.height; i += 1) {
    pixels.data[i * 4] = 255;
    pixels.data[i * 4 + 1] = 255;
    pixels.data[i * 4 + 2] = 255;
    pixels.data[i * 4 + 3] = mask.data[i] > 0 ? 66 : 0;
  }
  scratch.putImageData(pixels, 0, 0);
  const p = map(mask.box.x, mask.box.y);
  const q = map(mask.box.x + mask.box.width, mask.box.y + mask.box.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (mirror) { ctx.translate(p.x, p.y); ctx.scale(-1, 1); ctx.drawImage(maskCanvas, 0, 0, Math.abs(q.x - p.x), Math.abs(q.y - p.y)); }
  else ctx.drawImage(maskCanvas, p.x, p.y, q.x - p.x, q.y - p.y);
  ctx.restore();
}

export function renderResult(ctx, result, { show = true, mirror = false, crop, keypointThreshold = 0.35 } = {}) {
  if (!show || !result) return;
  const view = crop || { x: 0, y: 0, width: result.sourceWidth || ctx.canvas.width, height: result.sourceHeight || ctx.canvas.height };
  const sx = ctx.canvas.width / view.width;
  const sy = ctx.canvas.height / view.height;
  const map = (x, y) => ({ x: (mirror ? view.width - (x - view.x) : x - view.x) * sx, y: (y - view.y) * sy });
  const fontSize = Math.max(13, Math.min(28, ctx.canvas.width / 48));
  const lineWidth = Math.max(1.5, Math.min(4, ctx.canvas.width / 520));
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const items = result.items || [];
  if (['classify', 'classification'].includes(result.task)) {
    items.slice(0, 5).forEach((item, index) => label(ctx, `${item.label ?? item.classId ?? 'Class'}  ${(item.score * 100).toFixed(1)}%`, 12, 12 + (index + 1) * (fontSize * 1.9), fontSize, '#fff'));
    ctx.restore();
    return;
  }
  for (const item of items) {
    const color = COLORS[Math.abs(item.classId || 0) % COLORS.length];
    paintMask(ctx, item.mask, map, color, mirror);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 3;
    const box = item.box;
    let anchor = { x: 0, y: fontSize * 2 };
    if (item.polygon?.length) {
      const points = item.polygon.map((point) => map(point.x, point.y));
      ctx.beginPath();
      points.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.stroke();
      anchor = { x: Math.min(...points.map((point) => point.x)), y: Math.min(...points.map((point) => point.y)) };
    } else if (box) {
      const p = map(box.x, box.y);
      const q = map(box.x + box.width, box.y + box.height);
      anchor = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y) };
      ctx.strokeRect(anchor.x, anchor.y, Math.abs(q.x - p.x), Math.abs(q.y - p.y));
    }
    if (item.keypoints?.length) {
      for (const [a, b] of SKELETON) {
        const kp1 = item.keypoints[a];
        const kp2 = item.keypoints[b];
        if (!kp1 || !kp2 || (kp1.score ?? 1) < keypointThreshold || (kp2.score ?? 1) < keypointThreshold) continue;
        const p = map(kp1.x, kp1.y);
        const q = map(kp2.x, kp2.y);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      for (const kp of item.keypoints) {
        if ((kp.score ?? 1) < keypointThreshold) continue;
        const p = map(kp.x, kp.y);
        ctx.beginPath(); ctx.arc(p.x, p.y, lineWidth * 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
    const text = `${item.label ?? item.classId ?? 'Object'}  ${(Math.max(0, Math.min(1, item.score || 0)) * 100).toFixed(0)}%`;
    label(ctx, text, anchor.x, anchor.y, fontSize, color);
  }
  ctx.restore();
}

export function frameBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to export this frame.')), type));
}

export async function saveFrame(canvas, filename = `local-yolo-${Date.now()}.png`) {
  const blob = await frameBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return blob;
}
