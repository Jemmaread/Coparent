import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../db/index.js";
import { signToken } from "../auth.js";
import { generateInviteCode, pickParentColor } from "../utils.js";
import { requireAuth } from "../middleware/requireAuth.js";
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

authRouter.post("/register", (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const { name, email, password, family } = parsed.data;

  const existing = db
    .prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  let familyRow: FamilyRow;
  if (family.mode === "create") {
    const inviteCode = generateInviteCode();
    const info = db
      .prepare("INSERT INTO families (name, invite_code) VALUES (?, ?)")
      .run(family.familyName, inviteCode);
    familyRow = db
      .prepare<[number], FamilyRow>("SELECT * FROM families WHERE id = ?")
      .get(info.lastInsertRowid as number)!;
  } else {
    const found = db
      .prepare<[string], FamilyRow>("SELECT * FROM families WHERE invite_code = ?")
      .get(family.inviteCode.toUpperCase());
    if (!found) {
      return res.status(404).json({ error: "Invite code not found. Check with your co-parent." });
    }
    familyRow = found;
  }

  const memberColors = db
    .prepare<[number], { color: string }>(
      `SELECT u.color FROM users u
       JOIN family_members fm ON fm.user_id = u.id
       WHERE fm.family_id = ?`
    )
    .all(familyRow.id)
    .map((r) => r.color);
  const color = pickParentColor(memberColors);

  const passwordHash = bcrypt.hashSync(password, 10);
  const userInfo = db
    .prepare("INSERT INTO users (name, email, password_hash, color) VALUES (?, ?, ?, ?)")
    .run(name, email.toLowerCase(), passwordHash, color);
  const userId = userInfo.lastInsertRowid as number;

  db.prepare("INSERT INTO family_members (family_id, user_id) VALUES (?, ?)").run(
    familyRow.id,
    userId
  );

  const user = db.prepare<[number], UserRow>("SELECT * FROM users WHERE id = ?").get(userId)!;
  const token = signToken({ userId });
  res.status(201).json({ token, user: publicUser(user), family: familyRow });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { email, password } = parsed.data;
  const user = db
    .prepare<[string], UserRow>("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password" });
  }
  const token = signToken({ userId: user.id });
  res.json({ token, user: publicUser(user) });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = db.prepare<[number], UserRow>("SELECT * FROM users WHERE id = ?").get(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found" });

  let family: FamilyRow | undefined;
  let members: ReturnType<typeof publicUser>[] = [];
  if (req.familyId) {
    family = db
      .prepare<[number], FamilyRow>("SELECT * FROM families WHERE id = ?")
      .get(req.familyId);
    const memberUsers = db
      .prepare<[number], UserRow>(
        `SELECT u.* FROM users u
         JOIN family_members fm ON fm.user_id = u.id
         WHERE fm.family_id = ? ORDER BY u.id ASC`
      )
      .all(req.familyId);
    members = memberUsers.map(publicUser);
  }

  res.json({ user: publicUser(user), family: family ?? null, members });
});
