import type { CalendarEvent, User } from '../types';

export function eventColor(event: CalendarEvent, members: User[]): string {
  if (event.type === 'activity') return 'var(--activity)';
  if (event.type === 'unavailable') return 'var(--unavailable)';
  const owner = members.find((m) => m.id === event.owner_parent_id);
  return owner?.color || 'var(--text)';
}

export function eventBg(event: CalendarEvent, members: User[]): string {
  if (event.type === 'activity') return 'var(--activity-bg)';
  if (event.type === 'unavailable') return 'var(--unavailable-bg)';
  const owner = members.find((m) => m.id === event.owner_parent_id);
  return owner ? `${owner.color}22` : 'var(--accent-bg)';
}

export function typeLabel(type: CalendarEvent['type']): string {
  if (type === 'activity') return 'Activity';
  if (type === 'unavailable') return 'Unavailable';
  return 'Custody';
}
