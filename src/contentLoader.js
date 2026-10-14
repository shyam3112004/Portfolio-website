/**
 * Loads page content config from API or static JSON fallback.
 * Matches TRD §3.2 contract.
 */
export async function loadContent(slug = 'home') {
  try {
    const localData = localStorage.getItem('portfolio_custom_content');
    if (localData) {
      const parsed = JSON.parse(localData);
      if (parsed && parsed.projects && parsed.skills) return parsed;
    }
  } catch (e) {}

  try {
    const res = await fetch(`/api/page/${slug}`, { signal: AbortSignal.timeout?.(2500) });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.info('Using static fallback for content:', err.message);
    const fallback = await fetch(`/content/${slug}.json`);
    if (!fallback.ok) throw new Error(`Fallback content not found for ${slug}`);
    return await fallback.json();
  }
}

export function saveLocalContent(config) {
  localStorage.setItem('portfolio_custom_content', JSON.stringify(config));
}

export function clearLocalContent() {
  localStorage.removeItem('portfolio_custom_content');
}
