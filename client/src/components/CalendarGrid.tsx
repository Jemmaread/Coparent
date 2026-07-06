import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CalendarEvent, User } from '../types';
import { eventBg, eventColor } from '../utils/eventStyle';

interface Props {
  month: Date;
  events: CalendarEvent[];
  members: User[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => {
    const start = new Date(e.start_time);
    const end = new Date(e.end_time);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return start <= dayEnd && end >= dayStart;
  });
}

export default function CalendarGrid({ month, events, members, onDayClick, onEventClick }: Props) {
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ padding: '10px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text-h)', textAlign: 'center' }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day) => {
          const dayEvents = eventsForDay(events, day);
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              style={{
                minHeight: 108,
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                padding: 6,
                cursor: 'pointer',
                background: inMonth ? 'var(--surface)' : 'transparent',
                opacity: inMonth ? 1 : 0.45,
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: today ? 800 : 500,
                  color: today ? 'white' : 'var(--text-h)',
                  background: today ? 'var(--accent)' : 'transparent',
                  borderRadius: 999,
                  width: 20,
                  height: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {format(day, 'd')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {visible.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    title={ev.title}
                    style={{
                      textAlign: 'left',
                      border: 'none',
                      borderLeft: `3px solid ${eventColor(ev, members)}`,
                      background: eventBg(ev, members),
                      color: 'var(--text-h)',
                      borderRadius: 4,
                      padding: '2px 5px',
                      fontSize: 11,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.title}
                  </button>
                ))}
                {overflow > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text)', paddingLeft: 4 }}>+{overflow} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
