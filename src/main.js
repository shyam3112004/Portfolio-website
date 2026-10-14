import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadContent } from './contentLoader.js';
import { initScrollCanvas } from './scrollCanvas.js';
import { initOverlays } from './overlays.js';
import { initSmoothScroll } from './smoothScroll.js';
import { initProjects } from './projects.js';
import { initContactForm } from './contactForm.js';
import { track } from './analytics.js';

gsap.registerPlugin(ScrollTrigger);

async function bootstrap() {
  const loaderEl = document.getElementById('loader');
  const loaderBarEl = document.getElementById('loader-bar');
  const loaderStatusEl = document.getElementById('loader-status');
  const loaderSkipBtn = document.getElementById('loader-skip-btn');
  const headerEl = document.getElementById('main-header');
  const scrollHintEl = document.getElementById('scroll-hint');

  let isReady = false;

  // 8s stall timeout shows Skip Intro
  const stallTimeout = setTimeout(() => {
    if (!isReady && loaderSkipBtn) {
      loaderSkipBtn.classList.add('show');
      track('loader_stalled');
    }
  }, 8000);

  function completeLoader() {
    if (isReady) return;
    isReady = true;
    clearTimeout(stallTimeout);
    loaderEl.classList.add('hidden');
    track('loader_complete');
  }

  loaderSkipBtn?.addEventListener('click', () => {
    track('intro_skipped');
    completeLoader();
  });

  // 1. Fetch content
  let config;
  try {
    config = await loadContent('home');
  } catch (err) {
    console.error('Failed to load page config:', err);
    completeLoader();
    return;
  }

  // Update profile title
  if (config.title) document.title = config.title;

  // 2. Initialize Smooth Scroll
  initSmoothScroll();

  // 3. Setup Scroll Canvas & Overlays
  const scene = config.scenes?.[0];
  const canvasEl = document.getElementById('hero-canvas');
  const overlaysContainerEl = document.getElementById('hero-overlays');

  let overlaysHandler = null;
  if (scene && overlaysContainerEl && canvasEl) {
    overlaysHandler = initOverlays(scene.overlays || [], overlaysContainerEl, canvasEl);
  }

  let canvasController = null;
  if (scene && canvasEl) {
    canvasController = initScrollCanvas({
      canvas: canvasEl,
      scene,
      onKeyframesReady: () => {
        completeLoader();
      },
      onProgress: (loaded, total) => {
        const pct = Math.round((loaded / total) * 100);
        if (loaderBarEl) loaderBarEl.style.width = `${pct}%`;
        if (loaderStatusEl) loaderStatusEl.textContent = `Loading visual frames ${pct}%`;
      },
    });
  } else {
    completeLoader();
  }

  // 4. Hero Pin & Scroll scrubbing via ScrollTrigger
  const heroSection = document.getElementById('hero-section');
  if (heroSection) {
    const milestonesTriggered = new Set();

    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.3,
      onUpdate: (self) => {
        const p = self.progress;

        // Render frame & update overlays
        canvasController?.render(p);
        overlaysHandler?.update(p);

        // Hide scroll hint once user scrolls
        if (p > 0.05 && scrollHintEl) {
          scrollHintEl.style.opacity = '0';
        } else if (p <= 0.05 && scrollHintEl) {
          scrollHintEl.style.opacity = '1';
        }

        // Scroll milestones analytics
        [0.25, 0.5, 0.75, 1.0].forEach((m) => {
          if (p >= m && !milestonesTriggered.has(m)) {
            milestonesTriggered.add(m);
            track('scroll_milestone', { milestone: `${m * 100}%` });
          }
        });
      },
    });
  }

  // 5. Navbar Scrolled State
  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      headerEl?.classList.add('scrolled');
    } else {
      headerEl?.classList.remove('scrolled');
    }
  }, { passive: true });

  // 6. Populate Work / Projects
  const projectsGridEl = document.getElementById('projects-grid');
  const filtersEl = document.getElementById('project-filters');
  if (config.projects && projectsGridEl) {
    initProjects(config.projects, projectsGridEl, filtersEl);
  }

  // 7. Populate Skills
  const skillsGridEl = document.getElementById('skills-grid');
  if (config.skills && skillsGridEl) {
    skillsGridEl.innerHTML = config.skills.map((group) => `
      <div class="skill-group-card">
        <h3 class="skill-group-title">${group.group}</h3>
        <ul class="skill-list">
          ${group.items.map((item) => `<li class="skill-item">${item}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  }

  // 8. Populate Experience Timeline
  const timelineEl = document.getElementById('experience-timeline');
  if (config.experience && timelineEl) {
    timelineEl.innerHTML = config.experience.map((exp) => `
      <div class="timeline-item">
        <div class="timeline-meta">${exp.start} &mdash; ${exp.end || 'Present'}</div>
        <h3 class="timeline-role">${exp.role}</h3>
        <div class="timeline-company">${exp.company}</div>
        <p class="timeline-summary">${exp.summary}</p>
      </div>
    `).join('');
  }

  // 9. Contact Form
  const contactFormEl = document.getElementById('contact-form');
  const formStatusEl = document.getElementById('form-status');
  if (contactFormEl) {
    initContactForm(contactFormEl, formStatusEl);
  }

  // 10. Initial Page Track
  track('page_view');
}

document.addEventListener('DOMContentLoaded', bootstrap);
