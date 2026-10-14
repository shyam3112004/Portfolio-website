/**
 * High-performance Canvas Image-Sequence Renderer.
 * Matches TRD §4 Progressive Loading Pipeline and FR-1, FR-2, FR-6.
 */
export function initScrollCanvas({ canvas, scene, onKeyframesReady, onProgress }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const frameConfig = isMobile ? scene.frames.mobile : scene.frames.desktop;
  const totalFrames = frameConfig.count;
  const basePath = frameConfig.basePath;
  const ext = frameConfig.ext;

  const frames = new Array(totalFrames).fill(null);
  let keyframesLoaded = false;
  let loadedCount = 0;
  let currentProgress = 0;

  // Progressive loading phases: 1) every 4th frame, 2) every 2nd, 3) all remaining
  const loadOrder = [];
  const keyframeIndices = new Set();

  // Phase 1: Every 4th frame
  for (let i = 0; i < totalFrames; i += 4) {
    loadOrder.push(i);
    keyframeIndices.add(i);
  }
  if (!keyframeIndices.has(totalFrames - 1)) {
    loadOrder.push(totalFrames - 1);
    keyframeIndices.add(totalFrames - 1);
  }

  // Phase 2: Every 2nd frame
  for (let i = 0; i < totalFrames; i += 2) {
    if (!keyframeIndices.has(i)) loadOrder.push(i);
  }

  // Phase 3: All remaining
  for (let i = 0; i < totalFrames; i++) {
    if (!loadOrder.includes(i)) loadOrder.push(i);
  }

  function getFrameSrc(index) {
    const num = String(index + 1).padStart(4, '0');
    return `${basePath}/frame_${num}.${ext}`;
  }

  async function loadSingleFrame(index) {
    const src = getFrameSrc(index);
    try {
      if ('createImageBitmap' in window) {
        const res = await fetch(src, { priority: keyframeIndices.has(index) ? 'high' : 'low' });
        if (res.ok) {
          const blob = await res.blob();
          const bitmap = await createImageBitmap(blob);
          frames[index] = bitmap;
          loadedCount++;
          onProgress?.(loadedCount, totalFrames);
          return bitmap;
        }
      }
    } catch (_) {
      // Fall back to Image() on decoding failure or network restriction
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        frames[index] = img;
        loadedCount++;
        onProgress?.(loadedCount, totalFrames);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`Failed to load frame ${index}`);
        resolve(null);
      };
    });
  }

  async function preloadSequence() {
    // Phase 1: Load keyframes concurrently (batches of 8 to avoid connection throttling)
    const keyframesToLoad = Array.from(keyframeIndices);
    for (let i = 0; i < keyframesToLoad.length; i += 8) {
      const batch = keyframesToLoad.slice(i, i + 8);
      await Promise.all(batch.map(idx => loadSingleFrame(idx)));
    }

    keyframesLoaded = true;
    onKeyframesReady?.();
    render(currentProgress);

    // Phase 2 & 3: Background streaming for remaining frames
    const remaining = loadOrder.filter(idx => !keyframeIndices.has(idx));
    for (let i = 0; i < remaining.length; i += 6) {
      const batch = remaining.slice(i, i + 6);
      await Promise.all(batch.map(idx => loadSingleFrame(idx)));
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    render(currentProgress);
  }

  function getNearestLoadedFrame(targetIdx) {
    if (frames[targetIdx]) return frames[targetIdx];
    // Search outward for nearest loaded frame
    for (let offset = 1; offset < totalFrames; offset++) {
      if (targetIdx - offset >= 0 && frames[targetIdx - offset]) return frames[targetIdx - offset];
      if (targetIdx + offset < totalFrames && frames[targetIdx + offset]) return frames[targetIdx + offset];
    }
    return null;
  }

  function render(progress) {
    currentProgress = Math.max(0, Math.min(1, progress));
    const targetIdx = Math.round(currentProgress * (totalFrames - 1));
    const img = getNearestLoadedFrame(targetIdx);

    if (!img || !canvas.width || !canvas.height) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    // object-fit: cover
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  preloadSequence();

  return {
    render,
    resize,
    destroy: () => window.removeEventListener('resize', resize)
  };
}
