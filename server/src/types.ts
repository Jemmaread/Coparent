export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  color: string;
  created_at: string;
}

export interface FamilyRow {
  id: number;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface ChildRow {
  id: number;
  family_id: number;
  name: string;
  color: string;
  created_at: string;
}

export type EventType = "custody" | "activity" | "unavailable";

export interface EventRow {
  id: number;
  family_id: number;
  created_by: number;
  type: EventType;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: number;
  child_id: number | null;
  owner_parent_id: number | null;
  created_at: string;
  updated_at: string;
}

export type SwapStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface SwapRequestRow {
  id: number;
  family_id: number;
  related_event_id: number | null;
  requested_by: number;
  target_user_id: number;
  status: SwapStatus;
  message: string | null;
  proposed_start_time: string;
  proposed_end_time: string;
  proposed_owner_parent_id: number | null;
  created_at: string;
  updated_at: string;
}
