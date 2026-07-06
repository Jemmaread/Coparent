import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireAuth, requireFamily } from "../middleware/requireAuth.js";
import { ah } from "../asyncHandler.js";
import type { EventResponse, EventRow } from "../types.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth, requireFamily);

async function attachChildIds(events: EventRow[]): Promise<EventResponse[]> {
  if (events.length === 0) return [];
  const ids = events.map((e) => e.id);
  const { rows } = await pool.query<{ event_id: number; child_id: number }>(
    "SELECT event_id, child_id FROM event_children WHERE event_id = ANY($1)",
    [ids]
  );
  const byEvent = new Map<number, number[]>();
  for (const row of rows) {
    const list = byEvent.get(row.event_id) ?? [];
    list.push(row.child_id);
    byEvent.set(row.event_id, list);
  }
  return events.map((e) => ({ ...e, child_ids: byEvent.get(e.id) ?? [] }));
}

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
    res.json(await attachChildIds(rows));
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
  childIds: z.array(z.number().int().positive()).optional().default([]),
  ownerParentId: z.number().int().positive().optional().nullable(),
});

async function validateChildren(req: Request, childIds: number[]) {
  if (childIds.length === 0) return null;
  const { rows } = await pool.query<{ id: number }>(
    "SELECT id FROM children WHERE family_id = $1 AND id = ANY($2)",
    [req.familyId!, childIds]
  );
  if (rows.length !== new Set(childIds).size) {
    return "One or more children do not belong to this family";
  }
  return null;
}

async function validateOwner(req: Request, ownerParentId?: number | null) {
  if (ownerParentId == null) return null;
  const member = await pool.query(
    "SELECT user_id FROM family_members WHERE user_id = $1 AND family_id = $2",
    [ownerParentId, req.familyId!]
  );
  if (!member.rows[0]) return "Owner parent is not part of this family";
  return null;
}

async function setEventChildren(eventId: number, childIds: number[]) {
  await pool.query("DELETE FROM event_children WHERE event_id = $1", [eventId]);
  for (const childId of childIds) {
    await pool.query("INSERT INTO event_children (event_id, child_id) VALUES ($1, $2)", [
      eventId,
      childId,
    ]);
  }
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
    const childError = await validateChildren(req, data.childIds);
    if (childError) return res.status(400).json({ error: childError });
    const ownerError = await validateOwner(req, data.ownerParentId);
    if (ownerError) return res.status(400).json({ error: ownerError });

    const client = await pool.connect();
    let event: EventRow;
    try {
      await client.query("BEGIN");
      const info = await client.query<EventRow>(
        `INSERT INTO events
         (family_id, created_by, type, title, description, location, start_time, end_time, all_day, owner_parent_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
          data.ownerParentId ?? null,
        ]
      );
      event = info.rows[0];
      for (const childId of data.childIds) {
        await client.query("INSERT INTO event_children (event_id, child_id) VALUES ($1, $2)", [
          event.id,
          childId,
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.status(201).json({ ...event, child_ids: data.childIds });
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

    const merged = {
      type: data.type ?? existing.type,
      title: data.title ?? existing.title,
      description: data.description !== undefined ? data.description : existing.description,
      location: data.location !== undefined ? data.location : existing.location,
      startTime: data.startTime ?? existing.start_time,
      endTime: data.endTime ?? existing.end_time,
      allDay: data.allDay !== undefined ? data.allDay : !!existing.all_day,
      ownerParentId: data.ownerParentId !== undefined ? data.ownerParentId : existing.owner_parent_id,
    };
    if (new Date(merged.endTime) < new Date(merged.startTime)) {
      return res.status(400).json({ error: "End time must be after start time" });
    }
    if (data.childIds) {
      const childError = await validateChildren(req, data.childIds);
      if (childError) return res.status(400).json({ error: childError });
    }
    const ownerError = await validateOwner(req, merged.ownerParentId);
    if (ownerError) return res.status(400).json({ error: ownerError });

    const client = await pool.connect();
    let updated: EventRow;
    try {
      await client.query("BEGIN");
      const result = await client.query<EventRow>(
        `UPDATE events SET type=$1, title=$2, description=$3, location=$4, start_time=$5, end_time=$6, all_day=$7, owner_parent_id=$8, updated_at=now()
         WHERE id = $9
         RETURNING *`,
        [
          merged.type,
          merged.title,
          merged.description ?? null,
          merged.location ?? null,
          merged.startTime,
          merged.endTime,
          merged.allDay,
          merged.ownerParentId ?? null,
          id,
        ]
      );
      updated = result.rows[0];
      if (data.childIds) {
        await client.query("DELETE FROM event_children WHERE event_id = $1", [id]);
        for (const childId of data.childIds) {
          await client.query("INSERT INTO event_children (event_id, child_id) VALUES ($1, $2)", [
            id,
            childId,
          ]);
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const [withChildren] = await attachChildIds([updated]);
    res.json(withChildren);
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

const custodyDaysSchema = z.object({
  ownerParentId: z.number().int().positive(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(60),
});

eventsRouter.post(
  "/custody-days",
  ah(async (req, res) => {
    const parsed = custodyDaysSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { ownerParentId, dates } = parsed.data;
    const ownerError = await validateOwner(req, ownerParentId);
    if (ownerError) return res.status(400).json({ error: ownerError });

    const parentResult = await pool.query<{ name: string }>("SELECT name FROM users WHERE id = $1", [
      ownerParentId,
    ]);
    const parentName = parentResult.rows[0]?.name ?? "Parent";

    const client = await pool.connect();
    const created: EventRow[] = [];
    try {
      await client.query("BEGIN");
      for (const date of dates) {
        const startTime = `${date}T00:00:00`;
        const endTime = `${date}T23:59:00`;
        await client.query(
          `DELETE FROM events
           WHERE family_id = $1 AND type = 'custody' AND start_time = $2 AND end_time = $3`,
          [req.familyId!, startTime, endTime]
        );
        const info = await client.query<EventRow>(
          `INSERT INTO events (family_id, created_by, type, title, start_time, end_time, all_day, owner_parent_id)
           VALUES ($1, $2, 'custody', $3, $4, $5, true, $6)
           RETURNING *`,
          [req.familyId!, req.userId!, `${parentName} has the kids`, startTime, endTime, ownerParentId]
        );
        created.push(info.rows[0]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    res.status(201).json(created.map((e) => ({ ...e, child_ids: [] })));
  })
);
