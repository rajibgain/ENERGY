import { motion } from 'framer-motion';
import { Activity, Wifi, WifiOff } from 'lucide-react';

export default function Header({ isOnline }) {
  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: 'rgba(5, 5, 5, 0.6)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="max-w-7xl mx-auto px-8 h-[60px] flex items-center justify-between">
        {/* Brand */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon to-neon-green opacity-80" />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-neon to-neon-green blur-md opacity-30" />
            <Activity size={16} className="text-background relative z-10" strokeWidth={2.5} />
          </div>
          <span className="text-[0.95rem] font-semibold tracking-tight text-text-primary">
            SyncSpace
          </span>
          <span className="text-[0.55rem] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-gradient-to-r from-neon/15 to-neon-green/15 text-neon border border-neon/10">
            AI
          </span>
        </motion.div>

        {/* Status Indicator */}
        <motion.div
          className="flex items-center gap-2.5"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {isOnline ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-dot" style={{ color: '#00ff88' }} />
              <Wifi size={13} className="text-neon-green/70" />
              <span className="text-xs text-text-muted font-medium">Connected</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-neon-red" />
              <WifiOff size={13} className="text-neon-red/70" />
              <span className="text-xs text-text-muted font-medium">Offline</span>
            </>
          )}
        </motion.div>
      </div>
    </motion.header>
  );
}
