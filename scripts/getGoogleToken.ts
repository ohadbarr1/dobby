import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { google } from 'googleapis';
import { URL } from 'url';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPE,
});

console.log('\n========================================');
console.log('Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n========================================\n');
console.log('Waiting for OAuth callback on http://localhost:3000 ...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const url = new URL(req.url, 'http://localhost:3000');
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('Missing code parameter');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Success! You can close this tab.</h1>');

    console.log('========================================');
    console.log('Refresh token:\n');
    console.log(tokens.refresh_token);
    console.log('\n========================================');
    console.log('Copy this into your .env as GOOGLE_REFRESH_TOKEN_USER1');
    console.log('(then repeat for User2 by running this script again in a different browser profile)');
    console.log('========================================\n');
  } catch (err) {
    res.writeHead(500);
    res.end('Token exchange failed');
    console.error('Token exchange error:', (err as Error).message);
  }

  server.close();
  process.exit(0);
});

server.listen(3000);
