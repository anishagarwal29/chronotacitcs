import React from 'react';
import { ProjectBoss } from '../types';
import { motion } from 'framer-motion';

interface BossArenaProps {
  boss: ProjectBoss;
}

const BossArena: React.FC<BossArenaProps> = ({ boss }) => {
  const percentage = (boss.currentHp / boss.totalHp) * 100;

  return (
    <div className="bg-tactical-panel border border-red-900/50 p-4 rounded-lg shadow-lg relative overflow-hidden mb-6">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,0,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
      
      <div className="relative z-10 flex flex-col md:flex-row gap-6">
        
        {/* Boss Avatar Area */}
        <div className="flex-shrink-0 w-32 h-32 bg-black border-2 border-tactical-red flex items-center justify-center relative">
          <div className="absolute inset-0 border border-red-500/30 animate-pulse" />
          <span className="text-4xl text-tactical-red font-mono">☠</span>
          <div className="absolute bottom-1 right-1 text-[10px] text-tactical-red font-mono">Lv. 50</div>
        </div>

        {/* Stats Area */}
        <div className="flex-grow">
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-2xl font-sans font-bold text-white tracking-widest">{boss.name}</h2>
            <span className="text-sm font-mono text-tactical-red">DEADLINE: {boss.deadline.toLocaleDateString()}</span>
          </div>
          
          <p className="text-gray-400 text-sm mb-4 font-mono italic">"{boss.lore}"</p>

          {/* HP Bar */}
          <div className="w-full h-6 bg-black border border-gray-700 relative mb-4">
             <motion.div 
               className="h-full bg-gradient-to-r from-red-900 to-tactical-red"
               initial={{ width: 0 }}
               animate={{ width: `${percentage}%` }}
               transition={{ duration: 1 }}
             />
             <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white shadow-black drop-shadow-md">
                {boss.currentHp} / {boss.totalHp} HP
             </div>
          </div>

          {/* Phases */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-500 uppercase">Engagement Phases</h3>
            <div className="flex gap-2">
              {boss.phases.map(phase => (
                <div 
                  key={phase.id}
                  className={`flex-1 p-2 border ${phase.isDefeated ? 'border-gray-700 bg-gray-900 text-gray-600' : 'border-tactical-red/50 bg-red-900/10 text-gray-200'}`}
                >
                  <div className="text-[10px] font-bold truncate">{phase.title}</div>
                  <div className="text-[10px] font-mono">{phase.isDefeated ? 'DEFEATED' : `${phase.hp} HP`}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BossArena;
