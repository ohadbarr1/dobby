import { Router } from 'express';
import { google } from 'googleapis';
import config from '../../utils/config';
import * as memberRepo from '../../db/repositories/memberRepo';
import logger from '../../utils/logger';

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const REDIRECT_URI = `http://localhost:${config.API_PORT}/api/auth/google/callback`;

export const authRouter = Router();

// GET /api/auth/google/url?memberId=X — generate OAuth URL for a member
authRouter.get('/google/url', async (req, res) => {
  try {
    const memberId = Number(req.query.memberId);
    if (!memberId) {
      return res.status(400).json({ error: 'memberId query parameter is required' });
    }

    const member = await memberRepo.getMemberById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPE,
      state: String(memberId),
    });

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/auth/google/callback — handle OAuth callback, save refresh token
authRouter.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const memberId = Number(req.query.state);

    if (!code || !memberId) {
      return res.status(400).send('Missing code or state parameter');
    }

    const member = await memberRepo.getMemberById(memberId);
    if (!member) {
      return res.status(404).send('Member not found');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).send('No refresh token received. Try revoking access and re-authorizing.');
    }

    // Save refresh token and default calendar ID to the member record
    await memberRepo.updateMemberCalendar(member.id, tokens.refresh_token, 'primary');

    logger.info(`Google Calendar connected for member ${member.name} (id=${member.id})`);
    res.send(`<h1>הצלחה! היומן של ${member.name} חובר.</h1><p>אפשר לסגור את הדף הזה.</p>`);
  } catch (err) {
    logger.error(`Google OAuth callback error: ${(err as Error).message}`);
    res.status(500).send('OAuth failed. Please try again.');
  }
});
