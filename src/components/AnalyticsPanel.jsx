import React, { useEffect, useState, useMemo } from 'react';
import { Clock, Activity, MousePointerClick, Zap, BarChart2 } from 'lucide-react';

const MetricCard = ({ label, value, subtext, icon: Icon, color }) => (
  <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/5 p-4 rounded-xl relative overflow-hidden group shadow-sm dark:shadow-none">
    <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
      <Icon size={48} />
    </div>
    <div className="flex items-center gap-3 mb-2">
      <div className={`p-2 rounded-lg bg-gray-100 dark:bg-white/5 ${color} text-white`}>
        <Icon size={18} />
      </div>
      <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-500 tracking-wider">{label}</span>
    </div>
    <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white mt-1">{value}</div>
    {subtext && <div className="text-[10px] text-gray-500 mt-1 font-mono">{subtext}</div>}
  </div>
);

export default function AnalyticsPanel({ rawUsers, clicksData = {} }) {
  const [avgDuration, setAvgDuration] = useState("00:00");
  const [totalClicks, setTotalClicks] = useState(0);
  const [topComponent, setTopComponent] = useState({ id: "N/A", count: 0 });
  const [chartData, setChartData] = useState([]);

  // --- 1. DURATION TIMER ---
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

  // --- 2. PROCESS DATA ---
  useEffect(() => {
    const entries = Object.entries(clicksData).map(([key, count]) => ({
      id: key,
      count: count
    }));

    const total = entries.reduce((acc, item) => acc + item.count, 0);
    setTotalClicks(total);

    const sorted = [...entries].sort((a, b) => b.count - a.count);
    if (sorted.length > 0) {
      setTopComponent(sorted[0]);
    } else {
      setTopComponent({ id: "N/A", count: 0 });
    }

    setChartData(entries);
  }, [clicksData]);

  // --- 3. CALCULATE TRENDLINE (Linear Regression) ---
  const trendlinePoints = useMemo(() => {
    if (chartData.length < 2) return null;

    const n = chartData.length;
    const maxVal = Math.max(...chartData.map(d => d.count), 1);

    // X = index (0, 1, 2...), Y = count
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    chartData.forEach((d, i) => {
      sumX += i;
      sumY += d.count;
      sumXY += i * d.count;
      sumXX += i * i;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const startY = intercept;
    const endY = slope * (n - 1) + intercept;

    // Convert to Percentage (Inverted: 0% is top, 100% is bottom in SVG coords usually, but we map 100-val)
    let rawY1 = 100 - ((startY / maxVal) * 100); 
    let rawY2 = 100 - ((endY / maxVal) * 100);

    // Clamp values to stay within the graph box (0 to 100)
    const y1 = Math.max(0, Math.min(100, rawY1));
    const y2 = Math.max(0, Math.min(100, rawY2));

    const x1 = (1 / n) * 50; 
    const x2 = 100 - ((1 / n) * 50);

    return { x1, y1, x2, y2 };
  }, [chartData]);

  return (
    <div className="h-full w-full bg-gray-50 dark:bg-[#0a0a0a] flex flex-col p-6 overflow-y-auto transition-colors duration-300">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Activity className="text-blue-600 dark:text-neon-blue" />
            LIVE ANALYTICS
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1">REAL-TIME SWARM TELEMETRY</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-red-600 dark:text-red-500 tracking-wider">LIVE FEED</span>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <MetricCard 
          label="Active Agents" 
          value={Object.keys(rawUsers).length} 
          subtext="Current Concurrent Sessions"
          icon={Zap}
          color="text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-400/20"
        />
        <MetricCard 
          label="Avg Engagement" 
          value={avgDuration} 
          subtext="Time on Site (Live)"
          icon={Clock}
          color="text-blue-600 dark:text-neon-blue bg-blue-100 dark:bg-neon-blue/20"
        />
        <MetricCard 
          label="Total Interactions" 
          value={totalClicks} 
          subtext="Cumulative Clicks (All Time)"
          icon={MousePointerClick}
          color="text-purple-600 dark:text-neon-purple bg-purple-100 dark:bg-neon-purple/20"
        />
        <MetricCard 
          label="Top Component" 
          value={topComponent.id} 
          subtext={`${topComponent.count} interactions`}
          icon={BarChart2}
          color="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-400/20"
        />
      </div>

      {/* CHARTS SECTION */}
      <div className="flex-1 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/5 rounded-xl p-6 flex flex-col shadow-sm dark:shadow-none">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <BarChart2 size={14} /> Interaction Distribution
            </h3>
            {/* Legend */}
            {trendlinePoints && (
                <div className="flex items-center gap-2 text-[9px] font-mono text-gray-500">
                    <div className="w-4 h-0.5 bg-yellow-500"></div>
                    <span>TREND</span>
                </div>
            )}
        </div>
        
        {/* CHART CONTAINER WITH FLEXBOX LAYOUT */}
        <div className="flex-1 flex gap-2 mb-8"> {/* mb-8 reserves space for X-axis labels */}
           
           {/* LEFT COLUMN: Y-AXIS LABELS */}
           <div className="flex flex-col justify-between text-[9px] text-gray-400 dark:text-gray-600 py-0 text-right w-8 shrink-0 select-none">
              <span>MAX</span>
              <span>0</span>
           </div>

           {/* RIGHT COLUMN: THE GRAPH */}
           <div className="flex-1 flex items-end gap-4 relative border-l border-b border-gray-200 dark:border-white/10">
              
              {/* --- GRIDLINES --- */}
              <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
                   <div className="absolute w-full border-t border-gray-100 dark:border-white/5 top-[25%] left-0"></div>
                   <div className="absolute w-full border-t border-gray-100 dark:border-white/5 top-[50%] left-0"></div>
                   <div className="absolute w-full border-t border-gray-100 dark:border-white/5 top-[75%] left-0"></div>
              </div>

              {/* --- TRENDLINE --- */}
              {trendlinePoints && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-hidden">
                  <line 
                    x1={`${trendlinePoints.x1}%`} 
                    y1={`${trendlinePoints.y1}%`} 
                    x2={`${trendlinePoints.x2}%`} 
                    y2={`${trendlinePoints.y2}%`} 
                    stroke="#eab308"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="opacity-60 drop-shadow-[0_0_2px_rgba(234,179,8,0.5)]"
                  />
                  <circle cx={`${trendlinePoints.x2}%`} cy={`${trendlinePoints.y2}%`} r="3" fill="#eab308" />
                </svg>
              )}

              {/* --- BARS --- */}
              {chartData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-700 text-xs italic z-10">
                  Waiting for incoming signals...
                </div>
              ) : (
                chartData.map((item) => {
                  const max = Math.max(...chartData.map(x => x.count), 1);
                  const height = ((item.count) / max) * 100;
                  return (
                    <div key={item.id} className="flex-1 h-full relative z-10 group">
                       
                       {/* BAR */}
                       <div 
                         className="absolute bottom-0 w-full bg-blue-100 dark:bg-white/5 border border-blue-200 dark:border-white/10 rounded-t transition-all duration-500 group-hover:bg-blue-200 dark:group-hover:bg-neon-blue/20 group-hover:border-blue-400 dark:group-hover:border-neon-blue/50"
                         style={{ height: `${height}%`, minHeight: '4px' }}
                       >
                         <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-black border border-gray-700 dark:border-white/20 px-2 py-1 text-[10px] text-white rounded pointer-events-none whitespace-nowrap z-30 shadow-lg">
                           {item.count} Clicks
                         </div>
                       </div>

                       {/* X-AXIS LABEL (Hangs below chart area) */}
                       <div className="absolute top-full left-0 w-full mt-2 text-[9px] text-gray-500 text-center font-mono truncate" title={item.id}>
                         {item.id}
                       </div>
                    </div>
                  );
                })
              )}
           </div>
        </div>
      </div>
    </div>
  );
}