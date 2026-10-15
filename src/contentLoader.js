import { supabase, isSupabaseConfigured } from './supabaseClient.js';

/**
 * Loads page content config from Supabase Cloud or static JSON fallback.
 */
export async function loadContent(slug = 'home') {
  // 1. Try Supabase cloud database first so all devices stay in sync
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('portfolio_content')
        .select('data')
        .eq('slug', slug)
        .maybeSingle();
      if (!error && data?.data) {
        return data.data;
      }
    } catch (e) {
      console.info('Supabase content sync fallback:', e?.message);
    }
  }

  // 2. Check local storage cache
  try {
    const localData = localStorage.getItem('portfolio_custom_content');
    if (localData) {
      const parsed = JSON.parse(localData);
      if (parsed && parsed.projects && parsed.skills) {
        return parsed;
      }
    }
  } catch (e) {}

  // 3. Fallback to static JSON
  try {
    const fallback = await fetch(`/content/${slug}.json`);
    if (!fallback.ok) throw new Error(`Fallback content not found for ${slug}`);
    return await fallback.json();
  } catch (err) {
    console.warn('Fallback content fetch failed:', err);
    return null;
  }
}

export async function saveLocalContent(config, slug = 'home') {
  localStorage.setItem('portfolio_custom_content', JSON.stringify(config));
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('portfolio_content')
        .upsert({ slug, data: config, updated_at: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to sync to Supabase:', err);
    }
  }
}

export async function clearLocalContent(slug = 'home') {
  localStorage.removeItem('portfolio_custom_content');
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('portfolio_content').delete().eq('slug', slug);
    } catch (e) {}
  }
}
