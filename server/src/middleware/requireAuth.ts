import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../auth.js";
import { db } from "../db/index.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      familyId?: number | null;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    req.userId = payload.userId;
    const membership = db
      .prepare<[number], { family_id: number }>(
        "SELECT family_id FROM family_members WHERE user_id = ?"
      )
      .get(payload.userId);
    req.familyId = membership ? membership.family_id : null;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireFamily(req: Request, res: Response, next: NextFunction) {
  if (!req.familyId) {
    return res.status(400).json({ error: "You must join or create a family first" });
  }
  next();
}
