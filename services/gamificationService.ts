import { TaskPriority, UnitClass, UnitStats } from '../types';

export const calculateUnitStats = (priority: TaskPriority, durationHours: number, isMeeting: boolean): { stats: UnitStats, unitClass: UnitClass } => {
  let hp = 100;
  let attack = 10;
  let defense = 10;
  let apCost = 10;
  let unitClass = UnitClass.INFANTRY;

  // 1. Determine Class
  if (isMeeting) {
    unitClass = UnitClass.HAZARD;
    hp = 999; // Invulnerable essentially
    attack = 50; // Drains mental energy just by existing
    apCost = 20;
    return { unitClass, stats: { hp, attack, defense: 999, apCost } };
  }

  if (durationHours >= 3) {
    unitClass = UnitClass.HEAVY;
  } else if (durationHours < 1 || priority === TaskPriority.LOW) {
    unitClass = UnitClass.SCOUT;
  }

  // 2. Determine Stats based on Priority
  switch (priority) {
    case TaskPriority.CRITICAL:
      attack = 100; // High reward/threat
      hp = 50; // Stressful, volatile
      apCost = 40;
      break;
    case TaskPriority.HIGH:
      attack = 75;
      hp = 80;
      apCost = 30;
      break;
    case TaskPriority.MEDIUM:
      attack = 40;
      hp = 100;
      apCost = 20;
      break;
    case TaskPriority.LOW:
      attack = 15;
      hp = 40;
      apCost = 10;
      break;
  }

  // 3. Modifier by Duration
  hp += (durationHours * 20);
  apCost += (durationHours * 5);

  return {
    unitClass,
    stats: { hp, attack, defense, apCost }
  };
};
