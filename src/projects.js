import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Projects horizontal scroll, unique card typography, and tag filtering.
 * Matches user requirement: medium cards, distinctive typography, and horizontal scrolling on page scroll.
 */
export function initProjects(projects, containerEl, filterContainerEl) {
  if (!projects || !projects.length) return;

  const sectionEl = containerEl.closest('#projects') || containerEl.parentElement;
  let horizontalScrollTween = null;

  // 1. Filter chips: "All" followed by each website project name
  const filterList = ['All', ...projects.map((p) => p.title).filter(Boolean)];
  let activeFilter = 'All';

  function renderFilterChips() {
    if (!filterContainerEl) return;
    filterContainerEl.innerHTML = '';

    filterList.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `filter-chip ${name === activeFilter ? 'active' : ''}`;
      btn.textContent = name;
      btn.setAttribute('aria-pressed', name === activeFilter ? 'true' : 'false');
      btn.addEventListener('click', () => {
        activeFilter = name;
        renderFilterChips();
        renderGrid();
      });
      filterContainerEl.appendChild(btn);
    });
  }

  function setupHorizontalScroll() {
    if (horizontalScrollTween) {
      if (horizontalScrollTween.scrollTrigger) {
        horizontalScrollTween.scrollTrigger.kill();
      }
      horizontalScrollTween.kill();
      horizontalScrollTween = null;
    }

    gsap.set(containerEl, { clearProps: 'transform,x' });
    if (!sectionEl) return;

    const getDistance = () => {
      const containerWidth = containerEl.scrollWidth;
      const viewportWidth = window.innerWidth;
      // Ensure we scroll far enough so the very last card and its right padding fully clear into view
      const endPadding = Math.max(48, (viewportWidth - 1240) / 2) + 60;
      return Math.max(0, containerWidth - viewportWidth + endPadding);
    };

    const dist = getDistance();
    if (dist > 10) {
      horizontalScrollTween = gsap.to(containerEl, {
        x: () => -getDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: sectionEl,
          pin: true,
          start: 'top 72px',
          end: () => `+=${Math.max(window.innerHeight, getDistance() * 1.3)}`,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
    }

    ScrollTrigger.refresh();
  }

  function renderGrid() {
    containerEl.innerHTML = '';
    const filtered = activeFilter === 'All'
      ? projects
      : projects.filter((p) => p.title === activeFilter);

    if (filtered.length === 0) {
      containerEl.innerHTML = `
        <div style="text-align: center; padding: 48px 24px; color: var(--fg-muted);">
          <p>No project found named <strong>${activeFilter}</strong>.</p>
          <button class="filter-chip active" style="margin-top: 12px;" onclick="this.closest('section').querySelector('.filter-chip').click()">Show All Projects</button>
        </div>
      `;
      setupHorizontalScroll();
      return;
    }

    filtered.forEach((p) => {
      const card = document.createElement('article');
      card.className = 'project-card';

      card.innerHTML = `
        <div class="project-cover-wrap">
          <img class="project-cover" src="${p.coverUrl}" alt="${p.title} preview" loading="lazy">
        </div>
        <div class="project-details">
          <div class="project-meta-row">
            <span class="project-year">${p.year || ''}</span>
            <div class="project-tags"><span class="project-tag">Completed Website</span></div>
          </div>
          <h3 class="project-title">${p.title}</h3>
          <p class="project-summary">${p.summary}</p>
          <div class="project-actions">
            ${p.caseStudy ? `<a href="/work/${p.slug}.html" class="project-btn case-study-btn">Case Study &rarr;</a>` : ''}
            ${p.liveUrl && p.liveUrl !== '#' ? `<a href="${p.liveUrl}" ${p.liveUrl.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''} class="project-btn live-btn">Visit Website &nearr;</a>` : ''}
            ${p.repoUrl ? `<a href="${p.repoUrl}" target="_blank" rel="noopener noreferrer" class="project-btn code-btn">Code &nearr;</a>` : ''}
          </div>
        </div>
      `;

      containerEl.appendChild(card);
    });

    gsap.fromTo(
      containerEl.querySelectorAll('.project-card'),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
    );

    requestAnimationFrame(() => {
      setupHorizontalScroll();
    });
  }

  renderFilterChips();
  renderGrid();

  window.addEventListener('resize', () => {
    setupHorizontalScroll();
  }, { passive: true });
}
