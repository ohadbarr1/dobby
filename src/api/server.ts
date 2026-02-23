import express from 'express';
import cors from 'cors';
import config from '../utils/config';
import logger from '../utils/logger';
import { familiesRouter } from './routes/families';
import { membersRouter } from './routes/members';
import { authRouter } from './routes/auth';

const app = express();

app.use(cors());
app.use(express.json());

// API key authentication
app.use('/api', (req, res, next) => {
  if (!config.API_KEY) {
    // No API key configured — allow all requests (dev mode)
    return next();
  }
  const key = req.header('X-API-Key');
  if (key !== config.API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
});

app.use('/api/families', familiesRouter);
app.use('/api/families', membersRouter);
app.use('/api/auth', authRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`API error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

export function startApi(): void {
  app.listen(config.API_PORT, () => {
    logger.info(`API server listening on port ${config.API_PORT}`);
  });
}
