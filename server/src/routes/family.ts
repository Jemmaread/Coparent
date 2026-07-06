import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireAuth, requireFamily } from "../middleware/requireAuth.js";
import type { ChildRow, FamilyRow, UserRow } from "../types.js";

export const familyRouter = Router();

familyRouter.use(requireAuth, requireFamily);

familyRouter.get("/", (req, res) => {
  const family = db
    .prepare<[number], FamilyRow>("SELECT * FROM families WHERE id = ?")
    .get(req.familyId!)!;
  const members = db
    .prepare<[number], UserRow>(
      `SELECT u.* FROM users u
       JOIN family_members fm ON fm.user_id = u.id
       WHERE fm.family_id = ? ORDER BY u.id ASC`
    )
    .all(req.familyId!)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, color: u.color }));
  const children = db
    .prepare<[number], ChildRow>("SELECT * FROM children WHERE family_id = ? ORDER BY id ASC")
    .all(req.familyId!);
  res.json({ family, members, children });
});

const childSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().min(4).max(20).optional(),
});

familyRouter.post("/children", (req, res) => {
  const parsed = childSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { name, color } = parsed.data;
  const info = db
    .prepare("INSERT INTO children (family_id, name, color) VALUES (?, ?, ?)")
    .run(req.familyId!, name, color || "#8a5cf6");
  const child = db
    .prepare<[number], ChildRow>("SELECT * FROM children WHERE id = ?")
    .get(info.lastInsertRowid as number);
  res.status(201).json(child);
});

familyRouter.delete("/children/:id", (req, res) => {
  const id = Number(req.params.id);
  const child = db
    .prepare<[number, number], ChildRow>("SELECT * FROM children WHERE id = ? AND family_id = ?")
    .get(id, req.familyId!);
  if (!child) return res.status(404).json({ error: "Child not found" });
  db.prepare("DELETE FROM children WHERE id = ?").run(id);
  res.status(204).end();
});
