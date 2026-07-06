import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireAuth, requireFamily } from "../middleware/requireAuth.js";
import { ah } from "../asyncHandler.js";
import type { EventRow, SwapRequestRow } from "../types.js";

export const swapRequestsRouter = Router();

swapRequestsRouter.use(requireAuth, requireFamily);

swapRequestsRouter.get(
  "/",
  ah(async (req, res) => {
    const { rows } = await pool.query<SwapRequestRow>(
      "SELECT * FROM swap_requests WHERE family_id = $1 ORDER BY created_at DESC",
      [req.familyId!]
    );
    res.json(rows);
  })
);

const createSchema = z.object({
  relatedEventId: z.number().int().positive().optional().nullable(),
  targetUserId: z.number().int().positive(),
  message: z.string().max(1000).optional().nullable(),
  proposedStartTime: z.string().min(1),
  proposedEndTime: z.string().min(1),
  proposedOwnerParentId: z.number().int().positive().optional().nullable(),
});

swapRequestsRouter.post(
  "/",
  ah(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const data = parsed.data;
    if (new Date(data.proposedEndTime) < new Date(data.proposedStartTime)) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    const target = await pool.query(
      "SELECT user_id FROM family_members WHERE user_id = $1 AND family_id = $2",
      [data.targetUserId, req.familyId!]
    );
    if (!target.rows[0]) {
      return res.status(400).json({ error: "Target parent is not part of this family" });
    }

    if (data.relatedEventId != null) {
      const event = await pool.query<EventRow>(
        "SELECT * FROM events WHERE id = $1 AND family_id = $2",
        [data.relatedEventId, req.familyId!]
      );
      if (!event.rows[0]) return res.status(404).json({ error: "Related event not found" });
    }

    const info = await pool.query<SwapRequestRow>(
      `INSERT INTO swap_requests
       (family_id, related_event_id, requested_by, target_user_id, message, proposed_start_time, proposed_end_time, proposed_owner_parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.familyId!,
        data.relatedEventId ?? null,
        req.userId!,
        data.targetUserId,
        data.message ?? null,
        data.proposedStartTime,
        data.proposedEndTime,
        data.proposedOwnerParentId ?? null,
      ]
    );
    res.status(201).json(info.rows[0]);
  })
);

const respondSchema = z.object({
  status: z.enum(["accepted", "declined", "cancelled"]),
});

swapRequestsRouter.post(
  "/:id/respond",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const swapResult = await pool.query<SwapRequestRow>(
      "SELECT * FROM swap_requests WHERE id = $1 AND family_id = $2",
      [id, req.familyId!]
    );
    const swap = swapResult.rows[0];
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

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (status === "accepted") {
        if (swap.related_event_id) {
          await client.query(
            `UPDATE events SET start_time=$1, end_time=$2, owner_parent_id=COALESCE($3, owner_parent_id), updated_at=now()
             WHERE id = $4`,
            [swap.proposed_start_time, swap.proposed_end_time, swap.proposed_owner_parent_id, swap.related_event_id]
          );
        } else {
          await client.query(
            `INSERT INTO events (family_id, created_by, type, title, description, start_time, end_time, all_day, owner_parent_id)
             VALUES ($1, $2, 'custody', 'Custody swap', $3, $4, $5, false, $6)`,
            [
              swap.family_id,
              req.userId!,
              swap.message,
              swap.proposed_start_time,
              swap.proposed_end_time,
              swap.proposed_owner_parent_id,
            ]
          );
        }
      }
      await client.query("UPDATE swap_requests SET status=$1, updated_at=now() WHERE id=$2", [
        status,
        id,
      ]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    const updated = await pool.query<SwapRequestRow>("SELECT * FROM swap_requests WHERE id = $1", [
      id,
    ]);
    res.json(updated.rows[0]);
  })
);
