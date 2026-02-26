import type { Express } from "express";
import { Router } from "express";
import { createServer, type Server } from "node:http";
import { registerGamificationRoutes } from './gamification-routes';
import { registerSponsorRoutes } from './sponsor-routes';
import { registerNBARoutes } from './nba-routes';
import { registerBracketRoutes, ensureBracketTables } from './bracket-routes';

export async function registerRoutes(app: Express): Promise<Server> {
  const router = Router();
  registerGamificationRoutes(router);
  registerSponsorRoutes(router);
  registerNBARoutes(router);
  registerBracketRoutes(router);
  app.use(router);

  ensureBracketTables().catch(err => console.error('[Bracket] Table setup error:', err));

  const httpServer = createServer(app);

  return httpServer;
}
