import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Projects grid, tag filtering, and scroll reveal animations.
 * Matches FR-8, FR-9, and TRD §3.
 */
export function initProjects(projects, containerEl, filterContainerEl) {
  if (!projects || !projects.length) return;

  // Extract all unique tags
  const allTags = new Set();
  projects.forEach((p) => p.tags?.forEach((t) => allTags.add(t)));
  const tagList = ['All', ...Array.from(allTags)];

  let activeTag = 'All';

  function renderFilterChips() {
    if (!filterContainerEl) return;
    filterContainerEl.innerHTML = '';

    tagList.forEach((tag) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `filter-chip ${tag === activeTag ? 'active' : ''}`;
      btn.textContent = tag;
      btn.setAttribute('aria-pressed', tag === activeTag ? 'true' : 'false');
      btn.addEventListener('click', () => {
        activeTag = tag;
        renderFilterChips();
        renderGrid();
      });
      filterContainerEl.appendChild(btn);
    });
  }

  function renderGrid() {
    containerEl.innerHTML = '';
    const filtered = activeTag === 'All'
      ? projects
      : projects.filter((p) => p.tags?.includes(activeTag));

    if (filtered.length === 0) {
      containerEl.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 0; color: var(--fg-muted);">
          <p>No projects found matching the <strong>${activeTag}</strong> tag.</p>
          <button class="filter-chip active" style="margin-top: 12px;" onclick="this.closest('section').querySelector('.filter-chip').click()">Reset Filter</button>
        </div>
      `;
      return;
    }

    filtered.forEach((p, idx) => {
      const card = document.createElement('article');
      card.className = `project-card ${p.featured && idx === 0 ? 'featured' : ''}`;

      const tagsHtml = (p.tags || [])
        .map((t) => `<span class="project-tag">${t}</span>`)
        .join('');

      card.innerHTML = `
        <div class="project-cover-wrap">
          <img class="project-cover" src="${p.coverUrl}" alt="${p.title} preview" loading="lazy">
        </div>
        <div class="project-details">
          <div class="project-meta-row">
            <span class="project-year">${p.year || ''}</span>
            <div class="project-tags">${tagsHtml}</div>
          </div>
          <h3 class="project-title">${p.title}</h3>
          <p class="project-summary">${p.summary}</p>
          <div class="project-actions">
            ${p.caseStudy ? `<a href="/work/${p.slug}.html" class="project-btn">Case Study &rarr;</a>` : ''}
            ${p.repoUrl ? `<a href="${p.repoUrl}" target="_blank" rel="noopener noreferrer" class="project-btn" style="color: var(--fg-muted);">Code &nearr;</a>` : ''}
          </div>
        </div>
      `;

      containerEl.appendChild(card);

      // Reveal animation
      gsap.to(card, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      });
    });

    ScrollTrigger.refresh();
  }

  renderFilterChips();
  renderGrid();
}
