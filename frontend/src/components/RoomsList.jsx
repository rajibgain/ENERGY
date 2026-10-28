import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Cpu, CalendarDays, BarChart3 } from 'lucide-react';
import { fetchRoomAnalysis } from '../services/api';

export default function RoomsList({ rooms, loading }) {
  const [analysis, setAnalysis] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);

  const handleAnalyze = async (room) => {
    setAnalyzingId(room.id);
    try {
      const data = await fetchRoomAnalysis(room.id);
      setAnalysis({ ...data, roomName: room.name });
    } catch {
      setAnalysis(null);
    } finally {
      setAnalyzingId(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 space-y-3">
        <div className="skeleton h-5 w-32" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="glass-card gradient-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={18} className="text-neon" />
        <h2 className="text-base font-bold text-text-primary">Rooms</h2>
      </div>
      <p className="text-xs text-text-muted mb-4">All monitored rooms on campus.</p>

      {rooms.length === 0 ? (
        <p className="text-sm text-text-muted py-4">No rooms found. Add rooms via the API.</p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {rooms.map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-hover hover:border-border-hover transition-all group cursor-pointer"
            >
              <div>
                <p className="text-sm font-semibold text-text-primary group-hover:text-neon transition-colors">
                  {room.name}
                </p>
                <p className="text-xs text-text-muted">{room.block}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full bg-surface-light text-text-secondary border border-border flex items-center gap-1">
                  <Cpu size={10} /> {room.appliances.length}
                </span>
                <span className="text-[0.65rem] font-medium px-2 py-0.5 rounded-full bg-surface-light text-text-secondary border border-border flex items-center gap-1">
                  <CalendarDays size={10} /> {room.schedules.length}
                </span>
                <button
                  onClick={() => handleAnalyze(room)}
                  disabled={analyzingId === room.id}
                  className="text-[0.7rem] font-semibold px-3 py-1 rounded-lg border border-neon/30 text-neon hover:bg-neon/10 transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  <BarChart3 size={12} />
                  {analyzingId === room.id ? '…' : 'Analyze'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Analysis Result */}
      <AnimatePresence>
        {analysis && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 pt-5 border-t border-border overflow-hidden"
          >
            <h3 className="text-sm font-bold text-text-primary mb-3">
              Waste Analysis — <span className="text-neon">{analysis.roomName}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Wasted Energy', value: `${analysis.wasted_energy_kwh?.toFixed(2)} kWh`, color: 'text-neon-green' },
                { label: 'Financial Loss', value: `₹${analysis.financial_loss_inr?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, color: 'text-neon-amber' },
                { label: 'CO₂ Footprint', value: `${analysis.carbon_footprint_kg?.toFixed(2)} kg`, color: 'text-neon' },
                { label: 'Daily Waste', value: analysis.daily_wasted_hours != null ? `${analysis.daily_wasted_hours.toFixed(1)} hrs` : 'N/A', color: 'text-neon-red' },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-muted">{stat.label}</p>
                  <p className={`text-lg font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
