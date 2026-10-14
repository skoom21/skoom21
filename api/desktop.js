import { fetchAll } from '../lib/data.js';
import { renderDesktop, renderPortrait } from '../lib/render.js';

export default async function handler(req, res) {
  // README serves ?layout=portrait to narrow viewports through <picture>.
  const portrait = new URL(req.url, 'http://x').searchParams.get('layout') === 'portrait';
  const data = await fetchAll();
  const svg = portrait ? renderPortrait(data) : renderDesktop(data);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  // GitHub's camo proxy passes Cache-Control through, so anything cacheable
  // here would freeze the now-playing card for every visitor.
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  // Vercel's own edge may hold it briefly, which keeps a busy profile from
  // spending Spotify's rate limit. The elapsed clock drifts by at most this.
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=10, stale-while-revalidate=20');
  res.status(200).send(svg);
}
