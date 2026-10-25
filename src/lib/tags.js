// Manual Post Type and Persona tags, keyed by post URL.
import { POST_TYPES, PERSONAS } from './constants.js';
import { normalizeUrl } from './xlsxParser.js';

export const TAGS_VERSION = 1;

export function emptyTags() {
  return { version: TAGS_VERSION, updatedAt: null, posts: {} };
}

export function setTag(tags, urlKey, field, value) {
  const next = { ...tags, posts: { ...tags.posts }, updatedAt: new Date().toISOString() };
  const current = { ...(next.posts[urlKey] || {}) };
  if (value) current[field] = value; else delete current[field];
  if (Object.keys(current).length) next.posts[urlKey] = current; else delete next.posts[urlKey];
  return next;
}

export function getTag(tags, urlKey, field) {
  return tags?.posts?.[urlKey]?.[field] || null;
}

// Accepts the JSON we wrote earlier. Also tolerates a plain {url: {postType, persona}} map.
export function parseTagsJson(text) {
  const data = JSON.parse(text);
  const source = data && data.posts && typeof data.posts === 'object' ? data.posts : data;
  const out = emptyTags();
  if (!source || typeof source !== 'object') return out;
  for (const [url, value] of Object.entries(source)) {
    if (!value || typeof value !== 'object') continue;
    const key = normalizeUrl(url);
    const entry = {};
    if (POST_TYPES.includes(value.postType)) entry.postType = value.postType;
    if (PERSONAS.includes(value.persona)) entry.persona = value.persona;
    if (Object.keys(entry).length) out.posts[key] = entry;
  }
  out.updatedAt = data.updatedAt || null;
  return out;
}

export function tagsToJson(tags, posts = []) {
  // Store the full URL next to each key so the file is readable by a human.
  const urlLookup = new Map(posts.map((p) => [p.urlKey, p.url]));
  const out = { version: TAGS_VERSION, updatedAt: new Date().toISOString(), posts: {} };
  for (const [key, value] of Object.entries(tags.posts)) {
    out.posts[urlLookup.get(key) || key] = value;
  }
  return JSON.stringify(out, null, 2);
}

// Apply saved tags, falling back to tags that came from calendar columns.
export function applyTags(posts, tags) {
  return posts.map((p) => ({
    ...p,
    postType: getTag(tags, p.urlKey, 'postType') || p.initialPostType || null,
    persona: getTag(tags, p.urlKey, 'persona') || p.initialPersona || null,
  }));
}
