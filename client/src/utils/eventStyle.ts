import type { CalendarEvent, Child, Family, User } from '../types';

function activityColor(event: CalendarEvent, children: Child[], family: Family | null): string | null {
  if (event.child_ids.length === 1) {
    return children.find((c) => c.id === event.child_ids[0])?.color ?? null;
  }
  if (event.child_ids.length > 1) {
    return family?.combined_child_color ?? null;
  }
  return null;
}

export function eventColor(
  event: CalendarEvent,
  members: User[],
  children: Child[] = [],
  family: Family | null = null
): string {
  if (event.type === 'activity') {
    return activityColor(event, children, family) ?? 'var(--activity)';
  }
  if (event.type === 'unavailable') return 'var(--unavailable)';
  const owner = members.find((m) => m.id === event.owner_parent_id);
  return owner?.color || 'var(--text)';
}

export function eventBg(
  event: CalendarEvent,
  members: User[],
  children: Child[] = [],
  family: Family | null = null
): string {
  if (event.type === 'activity') {
    const color = activityColor(event, children, family);
    return color ? `${color}22` : 'var(--activity-bg)';
  }
  if (event.type === 'unavailable') return 'var(--unavailable-bg)';
  const owner = members.find((m) => m.id === event.owner_parent_id);
  return owner ? `${owner.color}22` : 'var(--accent-bg)';
}

export function typeLabel(type: CalendarEvent['type']): string {
  if (type === 'activity') return 'Activity';
  if (type === 'unavailable') return 'Unavailable';
  return 'Custody';
}
