// Renders the desktop locally: live monkeytype and GitHub (GITHUB_TOKEN from
// env), and a fixture track in place of Spotify unless its env vars are set.
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAll } from '../lib/data.js';
import { renderDesktop, renderPortrait } from '../lib/render.js';

const data = await fetchAll();
if (!data.spotify && !process.argv.includes('--no-spotify')) {
  const art = `data:image/jpeg;base64,${readFileSync(new URL('../fixtures/art.jpg', import.meta.url)).toString('base64')}`;
  const paused = process.argv.includes('--paused');
  data.spotify = {
    title: 'Fixture Track Title',
    artist: 'Fixture Artist',
    album: 'Fixture Album',
    durationMs: 214000,
    progressMs: 83000,
    playing: !paused,
    volume: 62,
    art,
  };
}
const svg = process.argv.includes('--portrait') ? renderPortrait(data) : renderDesktop(data);
const out = process.argv.find((a) => a.endsWith('.svg')) ?? 'preview.svg';
writeFileSync(out, svg);
console.log(`${out}: ${(svg.length / 1024).toFixed(1)} KB`, { monkeytype: !!data.monkeytype, github: !!data.github });
