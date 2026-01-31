import React from 'react';
import { DAYS_OF_WEEK, HOURS_OF_DAY } from '../constants';
import { TacticalUnit } from '../types';
import TacticalUnitComponent from './TacticalUnit';

interface GridSystemProps {
  units: TacticalUnit[];
  onUnitSelect: (unit: TacticalUnit) => void;
  onSlotClick: (dayIndex: number, hourIndex: number) => void;
  selectedUnitId: string | null;
  scoutedSectors: string[]; // Set of "dayIndex-hourIndex"
  fogEnabled: boolean;
}

const GridSystem: React.FC<GridSystemProps> = ({ 
  units, 
  onUnitSelect, 
  onSlotClick,
  selectedUnitId,
  scoutedSectors,
  fogEnabled
}) => {

  const getUnitsForCell = (dayIndex: number, hour: number) => {
    return units.filter(u => {
      const uDay = u.startTime.getDay();
      const uHour = u.startTime.getHours();
      return uDay === dayIndex && uHour === hour;
    });
  };

  const isScouted = (dayIndex: number, hour: number) => {
    if (!fogEnabled) return true;
    
    // Check if explicitly scouted
    if (scoutedSectors.includes(`${dayIndex}-${hour}`)) return true;
    
    // Check if near current time (simple proximity visibility)
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    
    // Visible if it's today and within +/- 2 hours
    if (dayIndex === currentDay && Math.abs(hour - currentHour) <= 2) return true;

    // Visible if a unit exists here
    const hasUnit = units.some(u => {
        const uDay = u.startTime.getDay();
        const uHour = u.startTime.getHours();
        return uDay === dayIndex && uHour <= hour && (uHour + u.durationHours) > hour;
    });

    return hasUnit;
  };

  return (
    <div className="grid grid-cols-[50px_repeat(7,1fr)] bg-tactical-grid border border-gray-800 rounded-lg overflow-hidden select-none">
      {/* Header Row */}
      <div className="p-2 border-b border-r border-gray-800 bg-tactical-bg"></div>
      {DAYS_OF_WEEK.map((day, i) => (
        <div key={day} className={`p-2 text-center text-xs font-bold border-b border-gray-800 bg-tactical-bg ${i === new Date().getDay() ? 'text-tactical-green' : 'text-gray-500'}`}>
          {day}
        </div>
      ))}

      {/* Grid Body */}
      {HOURS_OF_DAY.map((hour) => (
        <React.Fragment key={hour}>
          {/* Time Label */}
          <div className="h-16 border-r border-b border-gray-800 flex items-center justify-center text-[10px] text-gray-500 bg-tactical-bg font-mono">
            {hour.toString().padStart(2, '0')}:00
          </div>
          
          {/* Day Cells */}
          {DAYS_OF_WEEK.map((_, dayIndex) => {
            const cellUnits = getUnitsForCell(dayIndex, hour);
            const visible = isScouted(dayIndex, hour);
            const key = `${dayIndex}-${hour}`;

            return (
              <div 
                key={key}
                onClick={() => onSlotClick(dayIndex, hour)}
                className={`
                  relative h-16 border-b border-r border-gray-800/50 transition-colors
                  ${!visible ? 'bg-black/80 backdrop-blur-sm cursor-help' : 'hover:bg-white/5 cursor-pointer'}
                `}
              >
                {!visible && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                     <span className="text-[10px] tracking-[4px] text-gray-500">///</span>
                  </div>
                )}
                
                {visible && cellUnits.map(unit => (
                  <TacticalUnitComponent
                    key={unit.id}
                    unit={unit}
                    isSelected={selectedUnitId === unit.id}
                    onClick={onUnitSelect}
                  />
                ))}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

export default GridSystem;
