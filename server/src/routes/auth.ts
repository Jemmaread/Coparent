import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/index.js";
import { signToken } from "../auth.js";
import { generateInviteCode, pickParentColor } from "../utils.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { ah } from "../asyncHandler.js";
import type { FamilyRow, UserRow } from "../types.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  family: z.union([
    z.object({ mode: z.literal("create"), familyName: z.string().min(1).max(120) }),
    z.object({ mode: z.literal("join"), inviteCode: z.string().min(4).max(12) }),
  ]),
});

function publicUser(user: UserRow) {
  return { id: user.id, name: user.name, email: user.email, color: user.color };
}

authRouter.post(
  "/register",
  ah(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { name, email, password, family } = parsed.data;

    const existing = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }

    let familyRow: FamilyRow;
    if (family.mode === "create") {
      const inviteCode = generateInviteCode();
      const info = await pool.query<FamilyRow>(
        "INSERT INTO families (name, invite_code) VALUES ($1, $2) RETURNING *",
        [family.familyName, inviteCode]
      );
      familyRow = info.rows[0];
    } else {
      const found = await pool.query<FamilyRow>("SELECT * FROM families WHERE invite_code = $1", [
        family.inviteCode.toUpperCase(),
      ]);
      if (!found.rows[0]) {
        return res.status(404).json({ error: "Invite code not found. Check with your co-parent." });
      }
      familyRow = found.rows[0];
    }

    const memberColors = await pool.query<{ color: string }>(
      `SELECT u.color FROM users u
       JOIN family_members fm ON fm.user_id = u.id
       WHERE fm.family_id = $1`,
      [familyRow.id]
    );
    const color = pickParentColor(memberColors.rows.map((r) => r.color));

    const passwordHash = bcrypt.hashSync(password, 10);
    const userInfo = await pool.query<UserRow>(
      "INSERT INTO users (name, email, password_hash, color) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email.toLowerCase(), passwordHash, color]
    );
    const user = userInfo.rows[0];

    await pool.query("INSERT INTO family_members (family_id, user_id) VALUES ($1, $2)", [
      familyRow.id,
      user.id,
    ]);

    const token = signToken({ userId: user.id });
    res.status(201).json({ token, user: publicUser(user), family: familyRow });
  })
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  ah(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const { email, password } = parsed.data;
    const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Incorrect email or password" });
    }
    const token = signToken({ userId: user.id });
    res.json({ token, user: publicUser(user) });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  ah(async (req, res) => {
    const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [req.userId!]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    let family: FamilyRow | undefined;
    let members: ReturnType<typeof publicUser>[] = [];
    if (req.familyId) {
      const familyResult = await pool.query<FamilyRow>("SELECT * FROM families WHERE id = $1", [
        req.familyId,
      ]);
      family = familyResult.rows[0];
      const memberResult = await pool.query<UserRow>(
        `SELECT u.* FROM users u
         JOIN family_members fm ON fm.user_id = u.id
         WHERE fm.family_id = $1 ORDER BY u.id ASC`,
        [req.familyId]
      );
      members = memberResult.rows.map(publicUser);
    }

    res.json({ user: publicUser(user), family: family ?? null, members });
  })
);
