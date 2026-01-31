import React, { useState, useEffect } from 'react';
import { INITIAL_UNITS, MOCK_BOSS, MAX_DAILY_AP, MOCK_ICAL_DATA } from './constants';
import { GameState, TacticalUnit, TaskPriority } from './types';
import GridSystem from './components/GridSystem';
import BossArena from './components/BossArena';
import { generateUnitFlavor } from './services/genAIService';
import { calculateUnitStats } from './services/gamificationService';
import { parseICS } from './services/icalParser';
import { mapEventToUnit } from './services/unitMapper';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    units: INITIAL_UNITS,
    actionPoints: { current: 85, max: MAX_DAILY_AP },
    selectedUnitId: null,
    fogOfWar: true,
    scoutedSectors: [],
    lastSynced: undefined
  });

  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMode, setSyncMode] = useState<'LIVE' | 'SIMULATION'>('SIMULATION');

  // Sync Logic: Hybrid Approach
  // 1. Tries to hit http://localhost:3000/api/calendar/sync
  // 2. If fails, falls back to MOCK_ICAL_DATA
  const handleICloudSync = async () => {
    setIsSyncing(true);
    let eventsRaw: any[] = [];
    let source = 'SIMULATION';

    try {
      // Attempt connection to local backend (Post-Export)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

      const response = await fetch('http://localhost:3001/api/calendar/sync', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error("Backend Error");

      const data = await response.json();
      eventsRaw = data;
      source = 'LIVE';
      setSyncMode('LIVE');
    } catch (e) {
      console.warn("Backend unreachable. Using Simulation Mode.", e);
      // Fallback to Mock Data
      await new Promise(resolve => setTimeout(resolve, 1500)); // Fake delay
      eventsRaw = parseICS(MOCK_ICAL_DATA);
      source = 'SIMULATION';
      setSyncMode('SIMULATION');
    }

    try {
      // 3. Transform to Units
      // Note: If backend returns pre-mapped units, skip mapEventToUnit
      const newUnits = source === 'LIVE' && eventsRaw[0]?.unitClass
        ? eventsRaw
        : eventsRaw.map(mapEventToUnit);

      // 4. AI Enhancement (Batched for demo)
      if (newUnits.length > 0 && source === 'SIMULATION') {
        setIsLoadingAI(true);
        // Only doing one for demo performance
        const flavor = await generateUnitFlavor(newUnits[0].title, newUnits[0].priority);
        newUnits[0].codename = flavor.codename;
        newUnits[0].flavorText = flavor.flavorText;
        setIsLoadingAI(false);
      }

      // 5. Merge with existing units
      setGameState(prev => ({
        ...prev,
        units: [...prev.units, ...newUnits],
        lastSynced: new Date()
      }));

    } catch (e) {
      console.error("Processing Failed", e);
      alert("Data Corruption: Unable to parse incoming intel.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUnitSelect = (unit: TacticalUnit) => {
    setGameState(prev => ({ ...prev, selectedUnitId: unit.id === prev.selectedUnitId ? null : unit.id }));
  };

  const handleSlotClick = (dayIndex: number, hourIndex: number) => {
    const { selectedUnitId, units, actionPoints } = gameState;
    const sectorKey = `${dayIndex}-${hourIndex}`;

    // 1. If a unit is selected, try to move it (Reschedule)
    if (selectedUnitId) {
      const unit = units.find(u => u.id === selectedUnitId);
      if (unit) {
        // OPTIMISTIC UPDATE: Immediate UI change before backend sync
        if (actionPoints.current < 5) {
          alert("INSUFFICIENT AP TO RELOCATE UNIT");
          return;
        }

        const newStartTime = new Date();
        const currentDay = newStartTime.getDay();
        const dayDiff = dayIndex - currentDay;
        newStartTime.setDate(newStartTime.getDate() + dayDiff);
        newStartTime.setHours(hourIndex, 0, 0, 0);

        setGameState(prev => ({
          ...prev,
          actionPoints: { ...prev.actionPoints, current: prev.actionPoints.current - 5 },
          units: prev.units.map(u => u.id === unit.id ? {
            ...u,
            startTime: newStartTime,
            syncStatus: 'pending' // Mark for backend push
          } : u),
          selectedUnitId: null
        }));
      }
      return;
    }

    // 2. Scout
    if (gameState.fogOfWar && !gameState.scoutedSectors.includes(sectorKey)) {
      if (actionPoints.current < 2) return;

      setGameState(prev => ({
        ...prev,
        actionPoints: { ...prev.actionPoints, current: prev.actionPoints.current - 2 },
        scoutedSectors: [...prev.scoutedSectors, sectorKey]
      }));
      return;
    }

    // 3. Create
    createNewUnit(dayIndex, hourIndex);
  };

  const createNewUnit = async (dayIndex: number, hourIndex: number) => {
    const title = prompt("ENTER MISSION OBJECTIVE (Task Name):");
    if (!title) return;

    const duration = 1;
    const priority = TaskPriority.MEDIUM;

    const startTime = new Date();
    const currentDay = startTime.getDay();
    const dayDiff = dayIndex - currentDay;
    startTime.setDate(startTime.getDate() + dayDiff);
    startTime.setHours(hourIndex, 0, 0, 0);

    const { stats, unitClass } = calculateUnitStats(priority, duration, false);

    setIsLoadingAI(true);
    const flavor = await generateUnitFlavor(title, priority);
    setIsLoadingAI(false);

    const newUnit: TacticalUnit = {
      id: `u-${Date.now()}`,
      title,
      startTime,
      durationHours: duration,
      priority,
      unitClass,
      stats,
      isComplete: false,
      codename: flavor.codename,
      flavorText: flavor.flavorText,
      syncStatus: 'pending'
    };

    setGameState(prev => ({
      ...prev,
      units: [...prev.units, newUnit]
    }));
  };

  return (
    <div className="min-h-screen bg-tactical-bg text-gray-200 font-sans selection:bg-tactical-green selection:text-black">

      {/* HUD Header */}
      <header className="sticky top-0 z-50 bg-tactical-bg/90 backdrop-blur border-b border-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-widest text-tactical-green uppercase">ChronoTactics <span className="text-xs text-gray-500">v1.0.0</span></h1>
          <div className="h-6 w-px bg-gray-700"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase">Current Ops</span>
            <span className="text-sm font-mono font-bold">{gameState.units.filter(u => !u.isComplete).length} Active</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Action Points */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-500 uppercase">Action Points</span>
            <div className="flex items-center gap-2">
              <span className={`text-xl font-mono font-bold ${gameState.actionPoints.current < 20 ? 'text-red-500 animate-pulse' : 'text-tactical-blue'}`}>
                {gameState.actionPoints.current}
              </span>
              <span className="text-gray-600">/ {gameState.actionPoints.max}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={handleICloudSync}
              disabled={isSyncing}
              className={`px-3 py-1 border text-xs font-mono transition-colors flex items-center gap-2 ${isSyncing
                  ? 'border-gray-600 text-gray-600 cursor-not-allowed'
                  : 'border-tactical-blue text-tactical-blue hover:bg-tactical-blue hover:text-black'
                }`}
            >
              {isSyncing ? 'UPLINKING...' : 'SYNC ICLOUD'}
            </button>

            <button
              onClick={() => setGameState(prev => ({ ...prev, fogOfWar: !prev.fogOfWar }))}
              className="px-3 py-1 border border-tactical-green text-tactical-green text-xs font-mono hover:bg-tactical-green hover:text-black transition-colors"
            >
              FOG: {gameState.fogOfWar ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        {/* Boss Section */}
        <BossArena boss={MOCK_BOSS} />

        {/* Tactical Grid */}
        <div className="relative">
          {/* AI Loading Indicator */}
          {isLoadingAI && (
            <div className="absolute top-4 right-4 z-50 bg-black border border-tactical-green p-2 shadow-glow-green">
              <span className="animate-pulse text-tactical-green font-mono text-xs">DECRYPTING INTEL...</span>
            </div>
          )}

          {/* Sync Status Indicator */}
          {gameState.lastSynced && (
            <div className="absolute top-4 left-4 z-50 flex items-center gap-2 pointer-events-none">
              <div className={`w-2 h-2 rounded-full ${syncMode === 'LIVE' ? 'bg-tactical-green' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className={`text-[10px] ${syncMode === 'LIVE' ? 'text-tactical-green' : 'text-yellow-500'} font-mono`}>
                {syncMode === 'LIVE' ? 'LIVE FEED CONNECTED' : 'SIMULATION MODE'}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                | LAST SYNC: {gameState.lastSynced.toLocaleTimeString()}
              </span>
            </div>
          )}

          <GridSystem
            units={gameState.units}
            onUnitSelect={handleUnitSelect}
            onSlotClick={handleSlotClick}
            selectedUnitId={gameState.selectedUnitId}
            scoutedSectors={gameState.scoutedSectors}
            fogEnabled={gameState.fogOfWar}
          />
        </div>

        {/* Legend / Instructions */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono text-gray-500 border-t border-gray-800 pt-4">
          <div><span className="w-3 h-3 inline-block bg-tactical-green/50 mr-2"></span>INFANTRY</div>
          <div><span className="w-3 h-3 inline-block bg-indigo-900 mr-2"></span>HEAVY</div>
          <div><span className="w-3 h-3 inline-block bg-red-900 mr-2"></span>HAZARD</div>
          <div><span className="w-3 h-3 inline-block bg-yellow-600/50 mr-2"></span>PATROL (Recur)</div>
          <div>[CLICK] Select/Move | [SYNC] iCloud</div>
        </div>
      </main>
    </div>
  );
};

export default App;