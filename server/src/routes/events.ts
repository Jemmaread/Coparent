import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireAuth, requireFamily } from "../middleware/requireAuth.js";
import type { EventRow } from "../types.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth, requireFamily);

eventsRouter.get("/", (req, res) => {
  const { start, end } = req.query;
  let rows: EventRow[];
  if (typeof start === "string" && typeof end === "string") {
    rows = db
      .prepare<[number, string, string], EventRow>(
        `SELECT * FROM events
         WHERE family_id = ? AND start_time < ? AND end_time > ?
         ORDER BY start_time ASC`
      )
      .all(req.familyId!, end, start);
  } else {
    rows = db
      .prepare<[number], EventRow>("SELECT * FROM events WHERE family_id = ? ORDER BY start_time ASC")
      .all(req.familyId!);
  }
  res.json(rows);
});

const eventSchema = z.object({
  type: z.enum(["custody", "activity", "unavailable"]),
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  allDay: z.boolean().optional().default(false),
  childId: z.number().int().positive().optional().nullable(),
  ownerParentId: z.number().int().positive().optional().nullable(),
});

function validateOwnership(req: import("express").Request, childId?: number | null, ownerParentId?: number | null) {
  if (childId != null) {
    const child = db
      .prepare<[number, number], { id: number }>(
        "SELECT id FROM children WHERE id = ? AND family_id = ?"
      )
      .get(childId, req.familyId!);
    if (!child) return "Child does not belong to this family";
  }
  if (ownerParentId != null) {
    const member = db
      .prepare<[number, number], { user_id: number }>(
        "SELECT user_id FROM family_members WHERE user_id = ? AND family_id = ?"
      )
      .get(ownerParentId, req.familyId!);
    if (!member) return "Owner parent is not part of this family";
  }
  return null;
}

eventsRouter.post("/", (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const data = parsed.data;
  if (new Date(data.endTime) < new Date(data.startTime)) {
    return res.status(400).json({ error: "End time must be after start time" });
  }
  const ownershipError = validateOwnership(req, data.childId, data.ownerParentId);
  if (ownershipError) return res.status(400).json({ error: ownershipError });

  const info = db
    .prepare(
      `INSERT INTO events
       (family_id, created_by, type, title, description, location, start_time, end_time, all_day, child_id, owner_parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.familyId!,
      req.userId!,
      data.type,
      data.title,
      data.description ?? null,
      data.location ?? null,
      data.startTime,
      data.endTime,
      data.allDay ? 1 : 0,
      data.childId ?? null,
      data.ownerParentId ?? null
    );
  const event = db
    .prepare<[number], EventRow>("SELECT * FROM events WHERE id = ?")
    .get(info.lastInsertRowid as number);
  res.status(201).json(event);
});

eventsRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare<[number, number], EventRow>("SELECT * FROM events WHERE id = ? AND family_id = ?")
    .get(id, req.familyId!);
  if (!existing) return res.status(404).json({ error: "Event not found" });

  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const data = parsed.data;
  const ownershipError = validateOwnership(
    req,
    data.childId !== undefined ? data.childId : existing.child_id,
    data.ownerParentId !== undefined ? data.ownerParentId : existing.owner_parent_id
  );
  if (ownershipError) return res.status(400).json({ error: ownershipError });

  const merged = {
    type: data.type ?? existing.type,
    title: data.title ?? existing.title,
    description: data.description !== undefined ? data.description : existing.description,
    location: data.location !== undefined ? data.location : existing.location,
    startTime: data.startTime ?? existing.start_time,
    endTime: data.endTime ?? existing.end_time,
    allDay: data.allDay !== undefined ? data.allDay : !!existing.all_day,
    childId: data.childId !== undefined ? data.childId : existing.child_id,
    ownerParentId: data.ownerParentId !== undefined ? data.ownerParentId : existing.owner_parent_id,
  };
  if (new Date(merged.endTime) < new Date(merged.startTime)) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  db.prepare(
    `UPDATE events SET type=?, title=?, description=?, location=?, start_time=?, end_time=?, all_day=?, child_id=?, owner_parent_id=?, updated_at=datetime('now')
     WHERE id = ?`
  ).run(
    merged.type,
    merged.title,
    merged.description ?? null,
    merged.location ?? null,
    merged.startTime,
    merged.endTime,
    merged.allDay ? 1 : 0,
    merged.childId ?? null,
    merged.ownerParentId ?? null,
    id
  );
  const updated = db.prepare<[number], EventRow>("SELECT * FROM events WHERE id = ?").get(id);
  res.json(updated);
});

eventsRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare<[number, number], EventRow>("SELECT * FROM events WHERE id = ? AND family_id = ?")
    .get(id, req.familyId!);
  if (!existing) return res.status(404).json({ error: "Event not found" });
  db.prepare("DELETE FROM events WHERE id = ?").run(id);
  res.status(204).end();
});
