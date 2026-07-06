import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireAuth, requireFamily } from "../middleware/requireAuth.js";
import { ah } from "../asyncHandler.js";
import type { EventRow } from "../types.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth, requireFamily);

eventsRouter.get(
  "/",
  ah(async (req, res) => {
    const { start, end } = req.query;
    let rows: EventRow[];
    if (typeof start === "string" && typeof end === "string") {
      const result = await pool.query<EventRow>(
        `SELECT * FROM events
         WHERE family_id = $1 AND start_time < $2 AND end_time > $3
         ORDER BY start_time ASC`,
        [req.familyId!, end, start]
      );
      rows = result.rows;
    } else {
      const result = await pool.query<EventRow>(
        "SELECT * FROM events WHERE family_id = $1 ORDER BY start_time ASC",
        [req.familyId!]
      );
      rows = result.rows;
    }
    res.json(rows);
  })
);

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

async function validateOwnership(
  req: Request,
  childId?: number | null,
  ownerParentId?: number | null
) {
  if (childId != null) {
    const child = await pool.query("SELECT id FROM children WHERE id = $1 AND family_id = $2", [
      childId,
      req.familyId!,
    ]);
    if (!child.rows[0]) return "Child does not belong to this family";
  }
  if (ownerParentId != null) {
    const member = await pool.query(
      "SELECT user_id FROM family_members WHERE user_id = $1 AND family_id = $2",
      [ownerParentId, req.familyId!]
    );
    if (!member.rows[0]) return "Owner parent is not part of this family";
  }
  return null;
}

eventsRouter.post(
  "/",
  ah(async (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;
    if (new Date(data.endTime) < new Date(data.startTime)) {
      return res.status(400).json({ error: "End time must be after start time" });
    }
    const ownershipError = await validateOwnership(req, data.childId, data.ownerParentId);
    if (ownershipError) return res.status(400).json({ error: ownershipError });

    const info = await pool.query<EventRow>(
      `INSERT INTO events
       (family_id, created_by, type, title, description, location, start_time, end_time, all_day, child_id, owner_parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        req.familyId!,
        req.userId!,
        data.type,
        data.title,
        data.description ?? null,
        data.location ?? null,
        data.startTime,
        data.endTime,
        data.allDay,
        data.childId ?? null,
        data.ownerParentId ?? null,
      ]
    );
    res.status(201).json(info.rows[0]);
  })
);

eventsRouter.put(
  "/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const existingResult = await pool.query<EventRow>(
      "SELECT * FROM events WHERE id = $1 AND family_id = $2",
      [id, req.familyId!]
    );
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: "Event not found" });

    const parsed = eventSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;
    const ownershipError = await validateOwnership(
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

    const updated = await pool.query<EventRow>(
      `UPDATE events SET type=$1, title=$2, description=$3, location=$4, start_time=$5, end_time=$6, all_day=$7, child_id=$8, owner_parent_id=$9, updated_at=now()
       WHERE id = $10
       RETURNING *`,
      [
        merged.type,
        merged.title,
        merged.description ?? null,
        merged.location ?? null,
        merged.startTime,
        merged.endTime,
        merged.allDay,
        merged.childId ?? null,
        merged.ownerParentId ?? null,
        id,
      ]
    );
    res.json(updated.rows[0]);
  })
);

eventsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await pool.query<EventRow>(
      "SELECT * FROM events WHERE id = $1 AND family_id = $2",
      [id, req.familyId!]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: "Event not found" });
    await pool.query("DELETE FROM events WHERE id = $1", [id]);
    res.status(204).end();
  })
);
