import React, { useEffect, useState } from 'react';
import { Clock, Activity, MousePointerClick, Zap, BarChart2 } from 'lucide-react';

const MetricCard = ({ label, value, subtext, icon: Icon, color }) => (
  <div className="bg-[#111] border border-white/5 p-4 rounded-xl relative overflow-hidden group">
    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
      <Icon size={48} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-lg bg-white/5 ${color} text-white`}>
        <Icon size={18} />
      </div>
      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-mono font-bold text-white mt-1">{value}</div>
    {subtext && <div className="text-[10px] text-gray-500 mt-1 font-mono">{subtext}</div>}
  </div>
);

export default function AnalyticsPanel({ rawUsers, clicksData = {} }) {
  const [avgDuration, setAvgDuration] = useState("00:00");
  const [totalClicks, setTotalClicks] = useState(0);
  const [topComponent, setTopComponent] = useState({ id: "N/A", count: 0 });
  const [chartData, setChartData] = useState([]);

  // --- 1. DURATION TIMER (Uses Raw User Data) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const users = Object.values(rawUsers || {});
      
      if (users.length === 0) {
        setAvgDuration("00:00");
        return;
      }

      const totalTime = users.reduce((acc, user) => {
        const start = user.start_time || user.last_seen || now; 
        return acc + (now - start);
      }, 0);

      const avgMs = totalTime / users.length;
      const seconds = Math.floor((avgMs / 1000) % 60);
      const minutes = Math.floor((avgMs / 1000 / 60));
      
      setAvgDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [rawUsers]);

  // --- 2. PROCESS RAW CLICK DATA (Decoupled from Spheres) ---
  useEffect(() => {
    // Convert object { "btn-1": 10, "nav": 5 } -> Array [ { id: "btn-1", count: 10 }, ... ]
    const entries = Object.entries(clicksData).map(([key, count]) => ({
      id: key,
      count: count
    }));

    // A. Total Interactions
    const total = entries.reduce((acc, item) => acc + item.count, 0);
    setTotalClicks(total);

    // B. Top Component
    const sorted = [...entries].sort((a, b) => b.count - a.count);
    if (sorted.length > 0) {
      setTopComponent(sorted[0]);
    } else {
      setTopComponent({ id: "N/A", count: 0 });
    }

    // C. Chart Data
    setChartData(entries);

  }, [clicksData]);

  return (
    <div className="h-full w-full bg-[#0a0a0a] flex flex-col p-6 overflow-y-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="text-neon-blue" />
            LIVE ANALYTICS
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">REAL-TIME SWARM TELEMETRY</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-red-500 tracking-wider">LIVE FEED</span>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <MetricCard 
          label="Active Agents" 
          value={Object.keys(rawUsers).length} 
          subtext="Current Concurrent Sessions"
          icon={Zap}
          color="text-yellow-400 bg-yellow-400/20"
        />
        <MetricCard 
          label="Avg Engagement" 
          value={avgDuration} 
          subtext="Time on Site (Live)"
          icon={Clock}
          color="text-neon-blue bg-neon-blue/20"
        />
        <MetricCard 
          label="Total Interactions" 
          value={totalClicks} 
          subtext="Cumulative Clicks (All Time)"
          icon={MousePointerClick}
          color="text-neon-purple bg-neon-purple/20"
        />
        <MetricCard 
          label="Top Component" 
          value={topComponent.id} 
          subtext={`${topComponent.count} interactions`}
          icon={BarChart2}
          color="text-green-400 bg-green-400/20"
        />
      </div>

      {/* CHARTS SECTION */}
      <div className="flex-1 bg-[#111] border border-white/5 rounded-xl p-6 flex flex-col">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
          <BarChart2 size={14} /> Interaction Distribution
        </h3>
        
        <div className="flex-1 flex items-end gap-4 relative pl-8 pb-6 border-l border-b border-white/10">
           {/* Y-Axis Label */}
           <div className="absolute top-0 -left-6 h-full flex flex-col justify-between text-[9px] text-gray-600 py-2">
              <span>MAX</span>
              <span>0</span>
           </div>

           {chartData.length === 0 ? (
             <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs italic">
               Waiting for incoming signals...
             </div>
           ) : (
             chartData.map((item) => {
               const max = Math.max(...chartData.map(x => x.count), 1);
               const height = ((item.count) / max) * 100;
               return (
                 <div key={item.id} className="flex-1 flex flex-col justify-end group h-full relative">
                    <div 
                      className="w-full bg-white/5 border border-white/10 rounded-t transition-all duration-500 group-hover:bg-neon-blue/20 group-hover:border-neon-blue/50"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    >
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black border border-white/20 px-2 py-1 text-[10px] text-white rounded pointer-events-none whitespace-nowrap z-10">
                        {item.count} Clicks
                      </div>
                    </div>
                    <div className="mt-3 text-[9px] text-gray-500 text-center font-mono truncate w-full" title={item.id}>
                      {item.id}
                    </div>
                 </div>
               );
             })
           )}
        </div>
      </div>
    </div>
  );
}