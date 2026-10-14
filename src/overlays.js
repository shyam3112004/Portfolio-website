import gsap from 'gsap';

/**
 * Builds DOM for overlays and returns update function to sync with scroll progress.
 * Matches TRD §3.1 and UI Brief §8.
 */
export function initOverlays(overlays, containerEl, canvasEl) {
  containerEl.innerHTML = '';

  const elements = overlays.map((item) => {
    const el = document.createElement('div');
    el.className = `hero-overlay-item align-${item.align || 'center'}`;
    el.id = item.id;

    let ctaHtml = '';
    if (item.cta) {
      ctaHtml = `<a href="${item.cta.href}" class="hero-overlay-cta">${item.cta.label} &rarr;</a>`;
    }

    el.innerHTML = `
      <h2 class="hero-overlay-heading">${item.heading}</h2>
      ${item.body ? `<p class="hero-overlay-body">${item.body}</p>` : ''}
      ${ctaHtml}
    `;

    containerEl.appendChild(el);
    return { item, el };
  });

  // Function to evaluate visibility and animation state based on progress (0 - 1)
  function update(progress) {
    elements.forEach(({ item, el }) => {
      const { start, end, align } = item;
      const fadeRange = 0.05; // 5% scroll transition

      if (progress >= start && progress <= end) {
        // Calculate entry and exit opacities
        let opacity = 1;
        let translateY = 0;

        if (progress < start + fadeRange) {
          const ratio = (progress - start) / fadeRange;
          opacity = gsap.parseEase('power2.out')(ratio);
          translateY = (1 - ratio) * 25;
        } else if (progress > end - fadeRange) {
          const ratio = (end - progress) / fadeRange;
          opacity = gsap.parseEase('power2.in')(ratio);
          translateY = (1 - ratio) * -25;
        }

        el.style.opacity = String(opacity);
        el.style.visibility = opacity > 0.01 ? 'visible' : 'hidden';
        if (align === 'center') {
          el.style.transform = `translate(-50%, ${translateY}px)`;
        } else {
          el.style.transform = `translateY(${translateY}px)`;
        }
      } else {
        el.style.opacity = '0';
        el.style.visibility = 'hidden';
      }
    });

    // Canvas transition: progress 0.85 -> 1.0 (scale 1.0 -> 0.92, radius 0 -> 24px)
    if (canvasEl) {
      if (progress > 0.82) {
        const factor = Math.min(1, (progress - 0.82) / 0.18);
        const scale = 1.0 - 0.08 * factor;
        const radius = 24 * factor;
        canvasEl.style.transform = `scale(${scale})`;
        canvasEl.style.borderRadius = `${radius}px`;
      } else {
        canvasEl.style.transform = 'scale(1)';
        canvasEl.style.borderRadius = '0px';
      }
    }
  }

  update(0);
  return { update };
}
