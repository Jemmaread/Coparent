import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { requireAuth, requireFamily } from "../middleware/requireAuth.js";
import type { EventRow, SwapRequestRow } from "../types.js";

export const swapRequestsRouter = Router();

swapRequestsRouter.use(requireAuth, requireFamily);

swapRequestsRouter.get("/", (req, res) => {
  const rows = db
    .prepare<[number], SwapRequestRow>(
      "SELECT * FROM swap_requests WHERE family_id = ? ORDER BY created_at DESC"
    )
    .all(req.familyId!);
  res.json(rows);
});

const createSchema = z.object({
  relatedEventId: z.number().int().positive().optional().nullable(),
  targetUserId: z.number().int().positive(),
  message: z.string().max(1000).optional().nullable(),
  proposedStartTime: z.string().min(1),
  proposedEndTime: z.string().min(1),
  proposedOwnerParentId: z.number().int().positive().optional().nullable(),
});

swapRequestsRouter.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const data = parsed.data;
  if (new Date(data.proposedEndTime) < new Date(data.proposedStartTime)) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  const target = db
    .prepare<[number, number], { user_id: number }>(
      "SELECT user_id FROM family_members WHERE user_id = ? AND family_id = ?"
    )
    .get(data.targetUserId, req.familyId!);
  if (!target) return res.status(400).json({ error: "Target parent is not part of this family" });

  if (data.relatedEventId != null) {
    const event = db
      .prepare<[number, number], EventRow>("SELECT * FROM events WHERE id = ? AND family_id = ?")
      .get(data.relatedEventId, req.familyId!);
    if (!event) return res.status(404).json({ error: "Related event not found" });
  }

  const info = db
    .prepare(
      `INSERT INTO swap_requests
       (family_id, related_event_id, requested_by, target_user_id, message, proposed_start_time, proposed_end_time, proposed_owner_parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.familyId!,
      data.relatedEventId ?? null,
      req.userId!,
      data.targetUserId,
      data.message ?? null,
      data.proposedStartTime,
      data.proposedEndTime,
      data.proposedOwnerParentId ?? null
    );
  const swap = db
    .prepare<[number], SwapRequestRow>("SELECT * FROM swap_requests WHERE id = ?")
    .get(info.lastInsertRowid as number);
  res.status(201).json(swap);
});

const respondSchema = z.object({
  status: z.enum(["accepted", "declined", "cancelled"]),
});

swapRequestsRouter.post("/:id/respond", (req, res) => {
  const id = Number(req.params.id);
  const swap = db
    .prepare<[number, number], SwapRequestRow>(
      "SELECT * FROM swap_requests WHERE id = ? AND family_id = ?"
    )
    .get(id, req.familyId!);
  if (!swap) return res.status(404).json({ error: "Swap request not found" });
  if (swap.status !== "pending") {
    return res.status(409).json({ error: "This request has already been resolved" });
  }

  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid status" });
  }
  const { status } = parsed.data;

  if (status === "cancelled" && swap.requested_by !== req.userId) {
    return res.status(403).json({ error: "Only the requester can cancel this request" });
  }
  if ((status === "accepted" || status === "declined") && swap.target_user_id !== req.userId) {
    return res.status(403).json({ error: "Only the recipient can respond to this request" });
  }

  const applyAndSave = db.transaction(() => {
    if (status === "accepted") {
      if (swap.related_event_id) {
        db.prepare(
          `UPDATE events SET start_time=?, end_time=?, owner_parent_id=COALESCE(?, owner_parent_id), updated_at=datetime('now')
           WHERE id = ?`
        ).run(swap.proposed_start_time, swap.proposed_end_time, swap.proposed_owner_parent_id, swap.related_event_id);
      } else {
        db.prepare(
          `INSERT INTO events (family_id, created_by, type, title, description, start_time, end_time, all_day, owner_parent_id)
           VALUES (?, ?, 'custody', 'Custody swap', ?, ?, ?, 0, ?)`
        ).run(
          swap.family_id,
          req.userId!,
          swap.message,
          swap.proposed_start_time,
          swap.proposed_end_time,
          swap.proposed_owner_parent_id
        );
      }
    }
    db.prepare("UPDATE swap_requests SET status=?, updated_at=datetime('now') WHERE id=?").run(
      status,
      id
    );
  });
  applyAndSave();

  const updated = db
    .prepare<[number], SwapRequestRow>("SELECT * FROM swap_requests WHERE id = ?")
    .get(id);
  res.json(updated);
});
