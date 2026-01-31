import { CalendarEvent } from '../types';

/**
 * A lightweight client-side ICS parser for the demo.
 * In production, this logic happens in the NestJS backend using 'ical.js'.
 */
export const parseICS = (icsData: string): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const lines = icsData.split(/\r\n|\n|\r/);
  
  let currentEvent: Partial<CalendarEvent> | null = null;
  let inEvent = false;

  const parseDate = (dateStr: string): Date => {
    // Basic parser for formats like 20231024T100000Z
    if (!dateStr) return new Date();
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11) || '0');
    const min = parseInt(dateStr.substring(11, 13) || '0');
    return new Date(year, month, day, hour, min);
  };

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      currentEvent = { isRecurring: false };
      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      inEvent = false;
      if (currentEvent && currentEvent.summary && currentEvent.start && currentEvent.end) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
      continue;
    }

    if (inEvent && currentEvent) {
      if (line.startsWith('UID:')) currentEvent.uid = line.substring(4);
      if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8);
      if (line.startsWith('DESCRIPTION:')) currentEvent.description = line.substring(12);
      if (line.startsWith('DTSTART;')) {
         // Handle timezone params if any (naive implementation)
         const val = line.split(':')[1];
         currentEvent.start = parseDate(val);
      } else if (line.startsWith('DTSTART:')) {
         currentEvent.start = parseDate(line.substring(8));
      }

      if (line.startsWith('DTEND;')) {
         const val = line.split(':')[1];
         currentEvent.end = parseDate(val);
      } else if (line.startsWith('DTEND:')) {
         currentEvent.end = parseDate(line.substring(6));
      }

      if (line.startsWith('RRULE:')) currentEvent.isRecurring = true;
    }
  }

  return events;
};
