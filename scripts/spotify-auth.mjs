// One-time: trade a Spotify login for the refresh token the endpoint needs.
//   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-auth.mjs
// The app's redirect URI must be exactly http://127.0.0.1:8888/callback
// (Spotify no longer accepts "localhost").
import { createServer } from 'node:http';

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.');
  process.exit(1);
}
const redirect = 'http://127.0.0.1:8888/callback';
const scope = 'user-read-playback-state user-read-currently-playing user-read-recently-played';
const url = `https://accounts.spotify.com/authorize?${new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: redirect, scope })}`;

const server = createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get('code');
  if (!code) return res.end('No code in the callback.');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect }),
  });
  const json = await tokenRes.json();
  if (!json.refresh_token) {
    res.end('Token exchange failed; see the terminal.');
    console.error(json);
  } else {
    res.end('Done. You can close this tab.');
    console.log(`\nSPOTIFY_REFRESH_TOKEN=${json.refresh_token}\n`);
  }
  server.close();
});
server.listen(8888, '127.0.0.1', () => console.log(`Open this URL and approve:\n\n${url}\n`));
