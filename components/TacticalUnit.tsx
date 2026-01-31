import React from 'react';
import { motion } from 'framer-motion';
import { TacticalUnit, UnitClass } from '../types';

interface TacticalUnitProps {
  unit: TacticalUnit;
  onClick: (unit: TacticalUnit) => void;
  isSelected: boolean;
}

const getClassColor = (unitClass: UnitClass) => {
  switch (unitClass) {
    case UnitClass.HAZARD: return 'bg-tactical-red border-red-500';
    case UnitClass.HEAVY: return 'bg-indigo-900 border-indigo-500';
    case UnitClass.SCOUT: return 'bg-teal-900 border-teal-500';
    case UnitClass.PATROL: return 'bg-yellow-900/50 border-yellow-500';
    default: return 'bg-tactical-green/20 border-tactical-green';
  }
};

const TacticalUnitComponent: React.FC<TacticalUnitProps> = ({ unit, onClick, isSelected }) => {
  const baseClasses = `absolute w-full p-2 border-l-4 rounded-r shadow-lg cursor-pointer overflow-hidden group transition-all`;
  const colorClasses = getClassColor(unit.unitClass);
  const selectedClasses = isSelected ? 'ring-2 ring-white z-20 brightness-110' : 'z-10 hover:brightness-110';
  const syncClasses = unit.syncStatus === 'pending' ? 'opacity-70 border-dashed' : '';
  
  // Calculate height based on duration (assuming 64px per hour row)
  const height = `${unit.durationHours * 64 - 4}px`; // -4 for margin

  return (
    <motion.div
      layoutId={`unit-${unit.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${baseClasses} ${colorClasses} ${selectedClasses} ${syncClasses}`}
      style={{ height, top: '2px', left: '2px', width: 'calc(100% - 4px)' }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(unit);
      }}
    >
      <div className="flex justify-between items-start">
        <h4 className="text-xs font-bold font-sans uppercase tracking-wider text-white truncate">
          {unit.codename || unit.title}
        </h4>
        {unit.isComplete && (
          <span className="text-xs text-tactical-green">✓</span>
        )}
      </div>
      
      <div className="mt-1 flex gap-2 text-[10px] text-gray-300 font-mono">
        <span>HP: {unit.stats.hp}</span>
        <span>ATK: {unit.stats.attack}</span>
      </div>

      {isSelected && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-[10px] text-gray-400 border-t border-white/20 pt-1"
        >
          {unit.flavorText || "Awaiting briefing..."}
          {unit.syncStatus === 'pending' && <div className="text-yellow-500 mt-1">⚠ UPLOADING...</div>}
        </motion.div>
      )}

      {/* Decorative tactical corners */}
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/30" />
    </motion.div>
  );
};

export default TacticalUnitComponent;
