// Renders skoom21's Omarchy desktop as one self-contained SVG.
//
// The page is the Vantablack theme: pure greyscale. The only colour that ever
// appears is the cover art of whatever is playing, blurred behind the
// now-playing OSD exactly as omarchy-nowplaying-osd draws it.

import { FONT_REGULAR, FONT_BOLD, SHOT_ORBIS, SHOT_MELLO } from './assets.generated.js';

export const W = 960;
export const H = 600;

// Vantablack, from the theme's colors.toml.
const C = {
  bg: '#000000',
  fg: '#ffffff',
  light: '#ececec',
  muted: '#7a7a7a',
  dim: '#505050',
  accent: '#8d8d8d',
  raised: '#1a1a1a',
  activeBorder: '#8d8d8d',
  inactiveBorder: 'rgba(89,89,89,0.67)',
};

// Hyprland geometry: gaps_out 10, gaps_in 5, border 2.
const BAR_H = 26;
const GAP_OUT = 10;
const GAP = 10;
const BORDER = 2;
const TOP = BAR_H + GAP_OUT;
const BOTTOM = H - GAP_OUT;

const MONO = 'Caskaydia, monospace';
const CHAR = 0.6; // advance width of the mono face, in em

// The terminal types at skoom10's 15-second personal best: 5 characters per word.
const DEFAULT_WPM = 156.78;

// Workspace cycle: hold 1, slide to 2, hold, slide back.
const CYCLE_S = 20;
const CYCLE_DELAY_S = 0;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fit = (s, maxChars) => (s.length > maxChars ? `${s.slice(0, Math.max(0, maxChars - 1))}…` : s);

const fmtTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const num = (n) => n.toLocaleString('en-US');

function t(x, y, str, { size = 12.5, fill = C.light, weight, anchor, cls, extra = '' } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}"${weight ? ` font-weight="${weight}"` : ''}${
    anchor ? ` text-anchor="${anchor}"` : ''
  }${cls ? ` class="${cls}"` : ''}${extra} xml:space="preserve">${esc(str)}</text>`;
}

function frame(x, y, w, h, active, inner) {
  // Hyprland draws the border inside the window rectangle.
  const id = `clip-${x}-${y}`;
  return `<g>
  <clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.bg}"/>
  <g clip-path="url(#${id})">${inner}</g>
  <rect x="${x + BORDER / 2}" y="${y + BORDER / 2}" width="${w - BORDER}" height="${h - BORDER}" fill="none" stroke="${
    active ? C.activeBorder : C.inactiveBorder
  }" stroke-width="${BORDER}"/>
</g>`;
}

// ---------------------------------------------------------------- waybar

function waybar(now, cw = W) {
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const ws = (active) =>
    [1, 2, 3, 4, 5].map((n, i) => t(14 + i * 18, 17, n === active ? '■' : String(n), { size: 12, fill: C.light })).join('');
  return `<g>
  <rect width="${cw}" height="${BAR_H}" fill="${C.bg}"/>
  <g class="ws-one">${ws(1)}</g>
  <g class="ws-two">${ws(2)}</g>
  ${t(cw / 2, 17, time.replace(',', ''), { size: 12, anchor: 'middle' })}
  ${t(cw - 14, 17, '      ', { size: 12, anchor: 'end' })}
</g>`;
}

// ---------------------------------------------------------------- terminal

const STAGES = [
  ['init', 'passed', ''],
  ['intake:pull', 'passed', '(unrepeatable)'],
  ['intake:crawl', 'passed', ''],
  ['intake:normalize', 'passed', ''],
  ['extract', 'passed', ''],
  ['routes', 'passed', ''],
  ['analyse', 'passed', ''],
  ['model', 'passed', ''],
  ['seed', 'passed', '(unrepeatable)'],
  ['handoff', 'passed', ''],
  ['sections', 'passed', ''],
  ['perf', 'passed', ''],
  ['verify', 'stale', 'cms/ changed since seed produced it'],
];

function terminal(x, y, w, h, { github, wpm, compact = false, size = 12.5 }) {
  const lh = 16;
  const left = x + 16;
  let row = 0;
  const yAt = () => y + 24 + row * lh;
  const out = [];
  const line = (str, opts) => {
    out.push(t(left, yAt(), str, { size, ...opts }));
    row++;
  };
  const prompt = () => {
    out.push(t(left, yAt(), '~', { size, fill: C.fg, weight: 700 }) + t(left + size * CHAR * 2, yAt(), '❯', { size, fill: C.accent }));
  };

  // Portrait has no room for fastfetch; the stage table is the point.
  if (!compact) {
  prompt();
  out.push(t(left + size * CHAR * 4, yAt(), 'fastfetch', { size, fill: C.fg }));
  row++;
  line('skoom21@karachi', { fill: C.fg, weight: 700 });
  const facts = [
    ['OS', 'Omarchy (Arch Linux)'],
    ['WM', 'Hyprland'],
    ['Theme', 'Vantablack'],
    ['Stack', 'Next.js, Supabase, Payload CMS, TypeScript'],
  ];
  if (github) facts.push(['GitHub', `${github.publicRepos} public repos, ${github.followers} followers`]);
  for (const [k, v] of facts) {
    out.push(t(left, yAt(), k, { size, fill: C.muted }) + t(left + size * CHAR * 10, yAt(), v, { size }));
    row++;
  }
  row++;
  }

  // The command types itself at a real typing speed; its output prints once
  // the "enter" lands, a few milliseconds per line like a real terminal.
  const cmd = 'migratore status ./site';
  const cmdX = left + size * CHAR * 4;
  const cmdY = yAt();
  const cps = (wpm * 5) / 60;
  const typeS = cmd.length / cps;
  const typeStart = 0.9;
  const outStart = typeStart + typeS + 0.35;
  const cw = size * CHAR;
  prompt();
  out.push(t(cmdX, cmdY, cmd, { size, fill: C.fg }));
  // A cover that slides off the command one character at a time.
  out.push(
    `<rect class="type-cover" x="${cmdX}" y="${cmdY - size}" width="${cmd.length * cw + 4}" height="${lh + 2}" fill="${C.bg}" style="--chars:${cmd.length};--dx:${
      cmd.length * cw + 6
    }px;animation-duration:${typeS.toFixed(2)}s;animation-delay:${typeStart}s"/>`,
  );
  out.push(
    `<rect class="type-caret" x="${cmdX}" y="${cmdY - size + 2}" width="${cw}" height="${size + 2}" fill="${C.light}" style="--chars:${cmd.length};--dx:${
      cmd.length * cw
    }px;animation-duration:${typeS.toFixed(2)}s, 0.01s;animation-delay:${typeStart}s, ${outStart.toFixed(2)}s"/>`,
  );
  row++;

  const printed = [];
  printed.push(t(left, yAt(), 'site · 0.1.0', { size, fill: C.muted }));
  row++;
  row++;
  const noteRoom = Math.floor((w - 32) / cw) - 42;
  for (const [stage, state, note] of STAGES) {
    const ok = state === 'passed';
    const yy = yAt();
    // migratore prints ██████████ / ████······; drawn as shapes so the block
    // glyphs don't fuse into one column at this line height.
    const bx = left + cw * 2;
    const bar = ok
      ? `<rect x="${bx}" y="${yy - 9}" width="${cw * 10}" height="9" fill="${C.accent}"/>`
      : `<rect x="${bx}" y="${yy - 9}" width="${cw * 4}" height="9" fill="${C.dim}"/>` + t(bx + cw * 4, yy, '······', { size, fill: C.dim });
    printed.push(
      bar +
        t(left + cw * 14, yy, stage, { size, fill: ok ? C.light : C.muted }) +
        t(left + cw * 32, yy, state, { size, fill: ok ? C.light : C.muted }) +
        (note && noteRoom >= 12 ? t(left + cw * 42, yy, fit(note, noteRoom), { size, fill: C.dim }) : ''),
    );
    row++;
  }
  row++;
  out.push(
    printed
      .map((p, i) => `<g class="print" style="animation-delay:${(outStart + i * 0.035).toFixed(3)}s">${p}</g>`)
      .join(''),
  );

  const endS = outStart + printed.length * 0.035 + 0.1;
  const lastY = yAt();
  out.push(
    `<g class="print" style="animation-delay:${endS.toFixed(2)}s">${t(left, lastY, '~', { size, fill: C.fg, weight: 700 })}${t(
      left + cw * 2,
      lastY,
      '❯',
      { size, fill: C.accent },
    )}<rect class="blink" x="${left + cw * 4}" y="${lastY - size + 2}" width="${cw}" height="${size + 2}" fill="${C.light}"/></g>`,
  );

  return frame(x, y, w, h, true, out.join('\n'));
}

// ---------------------------------------------------------------- monkeytype

function monkeytype(x, y, w, h, mt) {
  const inner = [];
  const left = x + 22;
  inner.push(t(left, y + 30, 'monkeytype', { size: 12, fill: C.muted }));
  if (!mt) {
    inner.push(t(left, y + 70, 'stats unavailable right now', { size: 12.5, fill: C.dim }));
    return frame(x, y, w, h, false, inner.join(''));
  }
  inner.push(t(x + w - 22, y + 30, mt.name, { size: 12, fill: C.muted, anchor: 'end' }));

  // Monkeytype's own result screen: a small grey label over a big number.
  const pb = mt.pb15;
  inner.push(t(left, y + 66, 'wpm', { size: 14, fill: C.muted }));
  inner.push(t(left - 3, y + 126, pb ? String(Math.round(pb.wpm)) : '-', { size: 64, fill: C.fg, weight: 700 }));
  inner.push(t(left + 150, y + 66, 'acc', { size: 14, fill: C.muted }));
  inner.push(t(left + 148, y + 126, pb ? `${Math.round(pb.acc)}%` : '-', { size: 64, fill: C.fg, weight: 700 }));

  const rows = [
    ['15s', mt.pb15],
    ['30s', mt.pb30],
    ['60s', mt.pb60],
  ];
  const colW = (w - 44) / 3;
  rows.forEach(([label, best], i) => {
    const cx = left + i * colW;
    inner.push(t(cx, y + 168, `${label} pb`, { size: 12, fill: C.muted }));
    inner.push(t(cx, y + 190, best ? String(Math.round(best.wpm)) : '-', { size: 18, fill: C.light, weight: 700 }));
  });

  // In a tall pane the footer stays with the numbers, clear of the OSD.
  const footY = Math.min(y + h - 22, y + 232);
  inner.push(
    t(left, footY, `${num(mt.completedTests)} tests completed`, { size: 12, fill: C.muted }) +
      t(x + w - 22, footY, `${Math.round(mt.hoursTyping)}h typing`, { size: 12, fill: C.muted, anchor: 'end' }),
  );
  return frame(x, y, w, h, false, inner.join(''));
}

// ---------------------------------------------------------------- contributions

function contributions(x, y, w, h, gh) {
  const inner = [];
  const left = x + 22;
  inner.push(t(left, y + 30, 'contributions', { size: 12, fill: C.muted }));
  if (gh) inner.push(t(x + w - 22, y + 30, `${num(gh.recent)} in the last 26 weeks`, { size: 12, fill: C.muted, anchor: 'end' }));
  if (!gh) {
    inner.push(t(left, y + 70, 'graph unavailable right now', { size: 12.5, fill: C.dim }));
    return frame(x, y, w, h, false, inner.join(''));
  }
  // Drawn as a dot matrix: each day is a dot whose size, not colour, carries
  // the count, because the theme has no colour to spend on it.
  const weeks = gh.weeks.slice(-26).map((wk) => wk.map((d) => d.level));
  const pitch = (w - 44) / weeks.length;
  const top = y + 48;
  const radius = [0.9, 1.7, 2.6, 3.5, 4.4];
  const fills = [C.dim, C.light, C.light, C.fg, C.fg];
  weeks.forEach((days, wi) => {
    days.forEach((level, di) => {
      inner.push(
        `<circle cx="${(left + pitch / 2 + wi * pitch).toFixed(1)}" cy="${(top + pitch / 2 + di * pitch).toFixed(1)}" r="${radius[level]}" fill="${fills[level]}"/>`,
      );
    });
  });
  return frame(x, y, w, h, false, inner.join(''));
}

// ---------------------------------------------------------------- now playing OSD

function nowPlaying(sp, cw = W, ch = H, w = 400) {
  if (!sp) return '';
  const pad = 16;
  const showSeek = sp.playing || sp.progressMs > 0;
  const hasVolume = sp.volume != null;
  const textW = w - pad * 2;
  const titleSize = 15;
  const bodySize = 12.5;
  const capSize = 11;
  let h = pad + titleSize + 8 + bodySize + 12 + capSize + pad;
  if (hasVolume) h += 12 + 20;
  const x = Math.round((cw - w) / 2);
  // The plugin anchors the card bottom-centre, 67px up on a 1080px screen;
  // the portrait canvas keeps the same margin rather than rescaling it.
  const y = Math.round(ch - (67 * H) / 1080 - h);
  const r = 6;
  const parts = [];

  parts.push(`<clipPath id="osd-clip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>`);
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${C.bg}" fill-opacity="0.97"/>`);
  if (sp.art) {
    // The plugin's defaults: backdrop at 0.55 opacity, saturation -0.35,
    // blurred flat, under a 0.45 scrim of the theme background.
    parts.push(`<g clip-path="url(#osd-clip)">
  <image href="${sp.art}" x="${x - 40}" y="${y - (w + 80 - h) / 2}" width="${w + 80}" height="${w + 80}" preserveAspectRatio="xMidYMid slice" opacity="0.55" filter="url(#osd-blur)"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${C.bg}" fill-opacity="0.45"/>
</g>`);
  }
  parts.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="${C.inactiveBorder}"/>`);

  const left = x + pad;
  let cy = y + pad + titleSize - 2;
  parts.push(t(left, cy, fit(sp.title, Math.floor(textW / (titleSize * CHAR))), { size: titleSize, fill: C.fg, weight: 700 }));
  cy += 8 + bodySize;
  // Same separator the plugin uses.
  const same = (u, v) => String(u || '').trim().toLowerCase() === String(v || '').trim().toLowerCase();
  const showAlbum = sp.album && !same(sp.album, sp.artist) && !same(sp.album, sp.title);
  const sub = [sp.artist, showAlbum ? sp.album : null].filter(Boolean).join('  ·  ');
  parts.push(t(left, cy, fit(sub, Math.floor(textW / (bodySize * CHAR))), { size: bodySize, fill: 'rgba(255,255,255,0.62)' }));
  cy += 12 + capSize;

  const total = fmtTime(sp.durationMs);
  if (showSeek) {
    const timeChars = 4 + 3 + total.length; // "m:ss / m:ss"
    const timeW = timeChars * capSize * CHAR;
    const barW = textW - timeW - 10;
    const barY = cy - capSize / 2 + 1;
    const frac = Math.min(1, sp.progressMs / sp.durationMs);
    const remainS = Math.max(0, (sp.durationMs - sp.progressMs) / 1000);
    const live = sp.playing && remainS > 0;
    parts.push(`<rect x="${left}" y="${barY - 1.5}" width="${barW}" height="3" rx="1.5" fill="rgba(255,255,255,0.28)"/>`);
    parts.push(
      `<rect class="${live ? 'seek' : ''}" x="${left}" y="${barY - 1.5}" width="${barW}" height="3" rx="1.5" fill="${C.accent}" style="transform:scaleX(${frac.toFixed(
        4,
      )});--to:1;animation-duration:${remainS.toFixed(1)}s"/>`,
    );
    parts.push(
      `<circle class="${live ? 'knob' : ''}" cx="${left}" cy="${barY}" r="3.5" fill="${C.accent}" style="transform:translateX(${(frac * barW).toFixed(
        1,
      )}px);--dx:${barW}px;animation-duration:${remainS.toFixed(1)}s"/>`,
    );
    parts.push(elapsedReadout(left + textW - timeW, cy, capSize, sp, live) + t(left + textW, cy, ` / ${total}`, { size: capSize, fill: 'rgba(255,255,255,0.62)', anchor: 'end' }));
  } else {
    // The real OSD would simply be hidden now; on a profile, say what it is.
    parts.push(t(left, cy, 'last played', { size: capSize, fill: 'rgba(255,255,255,0.62)' }));
    parts.push(t(left + textW, cy, total, { size: capSize, fill: 'rgba(255,255,255,0.62)', anchor: 'end' }));
  }

  if (hasVolume) {
    cy += 12 + 14;
    const iconW = 16;
    const valW = 3 * 13 * CHAR;
    const barW = textW - iconW - valW - 32;
    parts.push(t(left, cy + 1, '', { size: 15, fill: C.fg }));
    parts.push(`<rect x="${left + iconW + 16}" y="${cy - 8}" width="${barW}" height="6" fill="rgba(255,255,255,0.45)"/>`);
    parts.push(`<rect x="${left + iconW + 16}" y="${cy - 8}" width="${((barW * sp.volume) / 100).toFixed(1)}" height="6" fill="${C.accent}"/>`);
    parts.push(t(left + textW, cy, String(sp.volume), { size: 13, fill: C.fg, anchor: 'end' }));
  }

  return `<g class="osd">${parts.join('\n')}</g>`;
}

// Elapsed time that keeps counting: each digit is a strip of numerals behind
// a one-cell window, stepped by CSS so the clock runs with no script.
function elapsedReadout(x, y, size, sp, live) {
  const elapsedS = Math.floor(sp.progressMs / 1000);
  const totalS = Math.floor(sp.durationMs / 1000);
  if (!live) return t(x, y, fmtTime(sp.progressMs), { size, fill: 'rgba(255,255,255,0.62)' });
  const cw = size * CHAR;
  const lh = size + 4;
  const fill = 'rgba(255,255,255,0.62)';
  const digit = (cx, values, periodS, offsetS, id) => {
    const strip = values.map((v, i) => t(cx, y + i * lh, String(v), { size, fill })).join('');
    const count = (totalS / periodS).toFixed(4);
    // Without animation the strip rests on the digit for the moment of render.
    const rest = -Math.floor((offsetS / periodS) * values.length) * lh;
    return `<clipPath id="${id}"><rect x="${cx}" y="${y - size}" width="${cw}" height="${lh}"/></clipPath>
<g clip-path="url(#${id})"><g class="odo" style="transform:translateY(${rest}px);--steps:${values.length};--dy:${-values.length * lh}px;animation-duration:${periodS}s;animation-delay:-${offsetS}s;animation-iteration-count:${count}">${strip}</g></g>`;
  };
  const tens = [0, 1, 2, 3, 4, 5];
  const ones = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  return [
    digit(x, ones, 600, elapsedS % 600, 'odo-m'),
    t(x + cw, y, ':', { size, fill }),
    digit(x + cw * 2, tens, 60, elapsedS % 60, 'odo-t'),
    digit(x + cw * 3, ones, 10, elapsedS % 10, 'odo-o'),
  ].join('');
}

// ---------------------------------------------------------------- workspace 2

function browser(x, y, w, h, url, shot, active) {
  const chrome = 34;
  const inner = `<rect x="${x}" y="${y}" width="${w}" height="${chrome}" fill="${C.raised}"/>
<rect x="${x + 12}" y="${y + 7}" width="${w - 24}" height="20" rx="10" fill="${C.bg}"/>
${t(x + 26, y + 21, url, { size: 11.5, fill: C.muted })}
<image href="data:image/jpeg;base64,${shot}" x="${x}" y="${y + chrome}" width="${w}" height="${h - chrome}" preserveAspectRatio="xMidYMin slice"/>`;
  return frame(x, y, w, h, active, inner);
}

function installTerminal(x, y, w, h) {
  const size = 12;
  const cw = size * CHAR;
  const left = x + 16;
  const lines = [];
  let yy = y + 24;
  const prompt = (cmd) => {
    lines.push(t(left, yy, '~', { size, fill: C.fg, weight: 700 }) + t(left + cw * 2, yy, '❯', { size, fill: C.accent }) + t(left + cw * 4, yy, cmd, { size, fill: C.fg }));
    yy += 17;
  };
  const say = (s, fill = C.muted) => {
    lines.push(t(left + cw * 2, yy, s, { size, fill }));
    yy += 17;
  };
  // Messages are omarchy-plugin-add's and omarchy-plugin-enable's own.
  const max = Math.floor((w - 32) / cw) - 2;
  for (const [repo, id] of [
    ['omarchy-nowplaying-osd', 'skoom.nowplaying-osd'],
    ['omarchy-beszel', 'skoom.beszel'],
  ]) {
    prompt('omarchy plugin add --enable \\');
    say(`github.com/skoom21/${repo}`, C.light);
    say(fit(`Added ${id} into ~/.config/omarchy/plugins/${id}`, max));
    say(`Enabled ${id}`);
    yy += 6;
  }
  lines.push(t(left, yy, '~', { size, fill: C.fg, weight: 700 }) + t(left + cw * 2, yy, '❯', { size, fill: C.accent }) + `<rect class="blink" x="${left + cw * 4}" y="${yy - size + 2}" width="${cw}" height="${size + 2}" fill="${C.light}"/>`);
  return frame(x, y, w, h, false, lines.join('\n'));
}

// ---------------------------------------------------------------- page

function style({ workspaces = true } = {}) {
  return `<style>
@font-face{font-family:Caskaydia;font-weight:400;src:url(data:font/woff2;base64,${FONT_REGULAR}) format('woff2')}
@font-face{font-family:Caskaydia;font-weight:700;src:url(data:font/woff2;base64,${FONT_BOLD}) format('woff2')}
text{font-family:${MONO}}
.ws-two{opacity:0}
/* The typing cover only exists while it is animating: a static render must
   show the finished command, not a hidden one. */
.type-cover,.type-caret{visibility:hidden}
@media (prefers-reduced-motion:no-preference){
  .type-cover,.type-caret{visibility:visible}
  .type-cover{animation:type-slide linear both;animation-timing-function:steps(var(--chars),end)}
  .type-caret{animation:type-slide both,gone forwards;animation-timing-function:steps(var(--chars),end),linear}
  .print{opacity:0;animation:appear 0.01s forwards}
  .blink{animation:blink 1.1s step-end infinite}
  .track{animation:${workspaces ? 'workspaces' : 'none'} ${CYCLE_S}s cubic-bezier(0.23,1,0.32,1) ${CYCLE_DELAY_S}s infinite}
  .ws-one{animation:${workspaces ? 'ws-one' : 'none'} ${CYCLE_S}s step-end ${CYCLE_DELAY_S}s infinite}
  .ws-two{animation:${workspaces ? 'ws-two' : 'none'} ${CYCLE_S}s step-end ${CYCLE_DELAY_S}s infinite}
  .seek{transform-box:fill-box;transform-origin:left center;animation:seek linear forwards}
  .knob{animation:knob linear forwards}
  .odo{animation-name:odo;animation-fill-mode:forwards;animation-timing-function:steps(var(--steps),end)}
}
.seek{transform-box:fill-box;transform-origin:left center}
@keyframes type-slide{to{transform:translateX(var(--dx))}}
@keyframes gone{to{opacity:0}}
@keyframes appear{to{opacity:1}}
@keyframes blink{50%{opacity:0}}
@keyframes workspaces{0%,55%{transform:translateX(0)}58%,85%{transform:translateX(-${W}px)}88%,100%{transform:translateX(0)}}
@keyframes ws-one{0%{opacity:1}56.5%{opacity:0}86.5%{opacity:1}}
@keyframes ws-two{0%{opacity:0}56.5%{opacity:1}86.5%{opacity:0}}
@keyframes seek{to{transform:scaleX(1)}}
@keyframes knob{to{transform:translateX(var(--dx))}}
@keyframes odo{from{transform:translateY(0)}to{transform:translateY(var(--dy))}}
</style>`;
}

function describe(spotify) {
  return spotify
    ? `skoom21's Omarchy desktop. ${spotify.playing ? 'Now playing' : 'Last played'}: ${spotify.title} by ${spotify.artist}.`
    : "skoom21's Omarchy desktop.";
}

function open(w, h, title, css) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
${css}
<defs>
  <filter id="osd-blur" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="14"/>
    <feColorMatrix type="saturate" values="0.65"/>
  </filter>
</defs>
<rect width="${w}" height="${h}" fill="${C.bg}"/>`;
}

export function renderDesktop({ spotify, monkeytype: mt, github, now = new Date() }) {
  const wpm = mt?.pb15?.wpm ?? DEFAULT_WPM;
  const innerW = W - GAP_OUT * 2;
  const fullH = BOTTOM - TOP;

  // Workspace 1: the terminal takes the master side; the right column stacks.
  const termW = 580;
  const colX = GAP_OUT + termW + GAP;
  const colW = innerW - termW - GAP;
  const mtH = 262;
  const ws1 = [
    terminal(GAP_OUT, TOP, termW, fullH, { github, wpm }),
    monkeytype(colX, TOP, colW, mtH, mt),
    contributions(colX, TOP + mtH + GAP, colW, fullH - mtH - GAP, github),
  ].join('\n');

  // Workspace 2, one screen to the right.
  const o = W;
  const orbisW = 560;
  const rX = o + GAP_OUT + orbisW + GAP;
  const rW = innerW - orbisW - GAP;
  const melloH = 236;
  const ws2 = [
    browser(o + GAP_OUT, TOP, orbisW, fullH, 'orbis-ai-pi.vercel.app', SHOT_ORBIS, true),
    browser(rX, TOP, rW, melloH, 'localhost:3000', SHOT_MELLO, false),
    installTerminal(rX, TOP + melloH + GAP, rW, fullH - melloH - GAP),
  ].join('\n');

  const title = describe(spotify);

  return `${open(W, H, title, style())}
<g class="track">
${ws1}
${ws2}
</g>
${waybar(now)}
${nowPlaying(spotify)}
</svg>`;
}

// The same desktop on a portrait monitor, for phone-width READMEs: one
// workspace, no fastfetch, and the windows stacked so text stays legible at
// ~308px wide. Served to narrow viewports through <picture>.
export const PW = 400;
export const PH = 920;

export function renderPortrait({ spotify, monkeytype: mt, github, now = new Date() }) {
  const wpm = mt?.pb15?.wpm ?? DEFAULT_WPM;
  const innerW = PW - GAP_OUT * 2;
  const termH = 300;
  const contribH = 164;
  const y2 = TOP + termH + GAP;
  const y3 = y2 + contribH + GAP;
  const body = [
    terminal(GAP_OUT, TOP, innerW, termH, { github, wpm, compact: true }),
    contributions(GAP_OUT, y2, innerW, contribH, github),
    // Last in the stack, so the OSD floats over its empty lower half.
    monkeytype(GAP_OUT, y3, innerW, PH - GAP_OUT - y3, mt),
  ].join('\n');
  return `${open(PW, PH, describe(spotify), style({ workspaces: false }))}
<g class="track">
${body}
</g>
${waybar(now, PW)}
${nowPlaying(spotify, PW, PH, innerW - 20)}
</svg>`;
}
