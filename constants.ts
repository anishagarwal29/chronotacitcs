import { TacticalUnit, TaskPriority, UnitClass, ProjectBoss } from './types';

export const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => i);

export const MAX_DAILY_AP = 100;

// Get today's date parts for dynamic mock data
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dd2 = String(tomorrow.getDate()).padStart(2, '0');

export const MOCK_ICAL_DATA = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//macOS 14.0//EN
BEGIN:VEVENT
UID:icloud-demo-1
SUMMARY:Algorithm Class
DESCRIPTION:Advanced Graph Theory
DTSTART:${yyyy}${mm}${dd}T090000
DTEND:${yyyy}${mm}${dd}T110000
RRULE:FREQ=WEEKLY
END:VEVENT
BEGIN:VEVENT
UID:icloud-demo-2
SUMMARY:Team Sync
DTSTART:${yyyy}${mm}${dd}T140000
DTEND:${yyyy}${mm}${dd}T150000
END:VEVENT
BEGIN:VEVENT
UID:icloud-demo-3
SUMMARY:Urgent: Fix Deploy
DTSTART:${yyyy}${mm}${dd2}T100000
DTEND:${yyyy}${mm}${dd2}T120000
END:VEVENT
END:VCALENDAR
`;

// Mock Data for Initial State
export const INITIAL_UNITS: TacticalUnit[] = [
  {
    id: 'u-1',
    title: 'Weekly Standup',
    startTime: new Date(new Date().setHours(10, 0, 0, 0)), // Today 10am
    durationHours: 1,
    priority: TaskPriority.MEDIUM,
    unitClass: UnitClass.HAZARD,
    stats: { hp: 999, attack: 50, defense: 999, apCost: 20 },
    isComplete: false,
    codename: 'OBSTACLE: SYNC',
    flavorText: 'An unavoidable temporal distortion. Cannot be moved.',
    syncStatus: 'synced'
  }
];

export const MOCK_BOSS: ProjectBoss = {
  id: 'b-1',
  name: 'PROJECT: CHRONOS',
  totalHp: 1000,
  currentHp: 650,
  deadline: new Date(new Date().setDate(new Date().getDate() + 7)),
  lore: 'A massive temporal entity threatening to consume Q4 deliverables.',
  phases: [
    { id: 'p-1', title: 'Phase 1: Database Migration', hp: 300, isDefeated: true },
    { id: 'p-2', title: 'Phase 2: API Gateway', hp: 400, isDefeated: false },
    { id: 'p-3', title: 'Phase 3: Client Integration', hp: 300, isDefeated: false },
  ]
};
