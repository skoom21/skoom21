// Every source is fetched in parallel and every one may fail on its own: a
// source that errors renders as its empty state, never as a broken image.

const GITHUB_LOGIN = 'skoom21';
const MONKEYTYPE_NAME = 'skoom10';
const TIMEOUT_MS = 2500;
const SLOW_TTL_MS = 60 * 60 * 1000;

// Warm function instances keep slow-moving data for an hour, so a visit
// usually costs one Spotify round trip and nothing else.
const memo = new Map();
async function cached(key, ttl, load) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  if (value) memo.set(key, { at: Date.now(), value });
  return value ?? hit?.value ?? null;
}

async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function settle(label, promise) {
  try {
    return await promise;
  } catch (err) {
    console.error(`[${label}]`, err.message);
    return null;
  }
}

// ---------------------------------------------------------------- spotify

async function spotifyToken() {
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) return null;
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh });
  const json = await getJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  return json.access_token;
}

async function imageAsDataUri(url) {
  if (!url) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') || 'image/jpeg';
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

function pickTrack(item) {
  if (!item || item.type !== 'track') return null;
  // Spotify lists images largest first; 300px is plenty for a blurred backdrop.
  const art = item.album.images.find((i) => i.width <= 320) ?? item.album.images.at(-1);
  return {
    title: item.name,
    artist: item.artists.map((a) => a.name).join(', '),
    album: item.album.name,
    durationMs: item.duration_ms,
    artUrl: art?.url ?? null,
  };
}

export async function fetchSpotify() {
  const token = await spotifyToken();
  if (!token) return null;
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // /me/player rather than /currently-playing: only the full playback state
  // carries the device, and the OSD's headline row is the device volume.
  const now = await getJson('https://api.spotify.com/v1/me/player', auth);
  let track = pickTrack(now?.item);
  let state;
  if (track && now.is_playing) {
    state = { playing: true, progressMs: now.progress_ms, volume: now.device?.volume_percent ?? null };
  } else {
    if (!track) {
      const recent = await getJson('https://api.spotify.com/v1/me/player/recently-played?limit=1', auth);
      track = pickTrack(recent?.items?.[0]?.track);
    }
    if (!track) return null;
    state = { playing: false, progressMs: now?.progress_ms ?? 0, volume: now?.device?.volume_percent ?? null };
  }
  const art = await settle('spotify-art', imageAsDataUri(track.artUrl));
  return { ...track, ...state, art };
}

// ---------------------------------------------------------------- monkeytype

function bestOf(entries = []) {
  // Personal bests are split by language, difficulty and punctuation; the
  // headline is the fastest of any of them, as monkeytype's own profile shows.
  return entries.reduce((best, e) => (!best || e.wpm > best.wpm ? e : best), null);
}

export function fetchMonkeytype() {
  return cached('monkeytype', SLOW_TTL_MS, async () => {
    const { data } = await getJson(`https://api.monkeytype.com/users/${MONKEYTYPE_NAME}/profile`);
    const time = data.personalBests?.time ?? {};
    return {
      name: data.name,
      pb15: bestOf(time['15']),
      pb30: bestOf(time['30']),
      pb60: bestOf(time['60']),
      completedTests: data.typingStats?.completedTests ?? 0,
      startedTests: data.typingStats?.startedTests ?? 0,
      hoursTyping: (data.typingStats?.timeTyping ?? 0) / 3600,
    };
  });
}

// ---------------------------------------------------------------- github

const CONTRIB_QUERY = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { contributionLevel contributionCount } }
      }
    }
  }
}`;

const LEVEL = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

export function fetchGitHub() {
  return cached('github', SLOW_TTL_MS, async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return null;
    const json = await getJson('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': GITHUB_LOGIN },
      body: JSON.stringify({ query: CONTRIB_QUERY, variables: { login: GITHUB_LOGIN } }),
    });
    const user = json.data?.user;
    if (!user) throw new Error(JSON.stringify(json.errors ?? json));
    const cal = user.contributionsCollection.contributionCalendar;
    return {
      followers: user.followers.totalCount,
      publicRepos: user.repositories.totalCount,
      total: cal.totalContributions,
      weeks: cal.weeks.map((w) => w.contributionDays.map((d) => ({ level: LEVEL[d.contributionLevel] ?? 0, count: d.contributionCount }))),
      recent: cal.weeks.slice(-26).flatMap((w) => w.contributionDays).reduce((n, d) => n + d.contributionCount, 0),
    };
  });
}

export async function fetchAll() {
  const [spotify, monkeytype, github] = await Promise.all([
    settle('spotify', fetchSpotify()),
    settle('monkeytype', fetchMonkeytype()),
    settle('github', fetchGitHub()),
  ]);
  return { spotify, monkeytype, github, now: new Date() };
}
