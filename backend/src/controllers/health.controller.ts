import { Request, Response } from 'express';
import { prisma } from '../config/db';

const toISO = (d = new Date()) => d.toISOString();

export const getHealth = async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: 'ok',
      db: 'ok',
      time: toISO(),
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'degraded',
      db: 'down',
      time: toISO(),
      error: err?.message,
    });
  }
};

export const getVersion = (_req: Request, res: Response) => {
  const version = process.env.APP_VERSION || '1.0.0';
  const build = process.env.APP_BUILD || new Date().toISOString();
  return res.status(200).json({ version, build });
};
