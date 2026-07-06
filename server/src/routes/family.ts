import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireAuth, requireFamily } from "../middleware/requireAuth.js";
import { ah } from "../asyncHandler.js";
import type { ChildRow, FamilyRow, UserRow } from "../types.js";

export const familyRouter = Router();

familyRouter.use(requireAuth, requireFamily);

familyRouter.get(
  "/",
  ah(async (req, res) => {
    const familyResult = await pool.query<FamilyRow>("SELECT * FROM families WHERE id = $1", [
      req.familyId!,
    ]);
    const family = familyResult.rows[0];
    const memberResult = await pool.query<UserRow>(
      `SELECT u.* FROM users u
       JOIN family_members fm ON fm.user_id = u.id
       WHERE fm.family_id = $1 ORDER BY u.id ASC`,
      [req.familyId!]
    );
    const members = memberResult.rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      color: u.color,
    }));
    const childrenResult = await pool.query<ChildRow>(
      "SELECT * FROM children WHERE family_id = $1 ORDER BY id ASC",
      [req.familyId!]
    );
    res.json({ family, members, children: childrenResult.rows });
  })
);

const updateFamilySchema = z.object({
  combinedChildColor: z.string().min(4).max(20),
});

familyRouter.patch(
  "/",
  ah(async (req, res) => {
    const parsed = updateFamilySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const updated = await pool.query<FamilyRow>(
      "UPDATE families SET combined_child_color = $1 WHERE id = $2 RETURNING *",
      [parsed.data.combinedChildColor, req.familyId!]
    );
    res.json(updated.rows[0]);
  })
);

const childSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().min(4).max(20).optional(),
});

familyRouter.post(
  "/children",
  ah(async (req, res) => {
    const parsed = childSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { name, color } = parsed.data;
    const info = await pool.query<ChildRow>(
      "INSERT INTO children (family_id, name, color) VALUES ($1, $2, $3) RETURNING *",
      [req.familyId!, name, color || "#8a5cf6"]
    );
    res.status(201).json(info.rows[0]);
  })
);

const updateChildSchema = childSchema.partial();

familyRouter.put(
  "/children/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await pool.query<ChildRow>(
      "SELECT * FROM children WHERE id = $1 AND family_id = $2",
      [id, req.familyId!]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: "Child not found" });

    const parsed = updateChildSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const name = parsed.data.name ?? existing.rows[0].name;
    const color = parsed.data.color ?? existing.rows[0].color;
    const updated = await pool.query<ChildRow>(
      "UPDATE children SET name = $1, color = $2 WHERE id = $3 RETURNING *",
      [name, color, id]
    );
    res.json(updated.rows[0]);
  })
);

familyRouter.delete(
  "/children/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await pool.query<ChildRow>(
      "SELECT * FROM children WHERE id = $1 AND family_id = $2",
      [id, req.familyId!]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: "Child not found" });
    await pool.query("DELETE FROM children WHERE id = $1", [id]);
    res.status(204).end();
  })
);
