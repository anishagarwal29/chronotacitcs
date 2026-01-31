import { TacticalUnit, CalendarEvent, TaskPriority, UnitClass, UnitStats } from '../types';

export const mapEventToUnit = (event: CalendarEvent): TacticalUnit => {
  const startTime = new Date(event.start);
  const endTime = new Date(event.end);
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = Math.max(1, Math.round(durationMs / (1000 * 60 * 60)));

  // Determine Class
  let unitClass = UnitClass.INFANTRY;
  let priority = TaskPriority.MEDIUM;
  let hp = 100;
  let attack = 20;
  let apCost = 15;

  // Keyword Analysis for Gameplay Logic
  const lowerSummary = event.summary.toLowerCase();

  if (event.isRecurring || lowerSummary.includes('class') || lowerSummary.includes('routine')) {
    unitClass = UnitClass.PATROL;
    hp = 200; // Harder to kill because they come back
    attack = 15;
    apCost = 5; // Routine tasks are cheaper
  } else if (lowerSummary.includes('meet') || lowerSummary.includes('sync') || lowerSummary.includes('standup')) {
    unitClass = UnitClass.HAZARD;
    hp = 999;
    attack = 40;
    apCost = 25;
  } else if (durationHours >= 3) {
    unitClass = UnitClass.HEAVY;
    hp = 500;
    attack = 80;
    apCost = 50;
  } else if (durationHours < 1) {
    unitClass = UnitClass.SCOUT;
    hp = 50;
    attack = 10;
    apCost = 10;
  }

  // Priority Heuristic
  if (lowerSummary.includes('urgent') || lowerSummary.includes('!')) {
    priority = TaskPriority.CRITICAL;
    attack += 50;
  }

  return {
    id: event.uid || `auto-${Math.random()}`,
    title: event.summary,
    description: event.description,
    startTime,
    durationHours,
    priority,
    unitClass,
    stats: {
      hp,
      attack,
      defense: durationHours * 10,
      apCost
    },
    isComplete: false,
    syncStatus: 'synced',
    icalUid: event.uid
  };
};
