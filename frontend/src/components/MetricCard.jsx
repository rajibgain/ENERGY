import { motion } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.6 + i * 0.15,
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export default function MetricCard({ index, icon: Icon, label, rawValue, prefix, suffix, decimals, subtitle, color, glowClass }) {
  const colorMap = {
    neon: 'text-neon',
    green: 'text-neon-green',
    amber: 'text-neon-amber',
    red: 'text-neon-red',
  };

  const iconBgMap = {
    neon: 'rgba(0, 243, 255, 0.06)',
    green: 'rgba(0, 255, 136, 0.06)',
    amber: 'rgba(255, 184, 0, 0.06)',
    red: 'rgba(255, 59, 92, 0.06)',
  };

  const accentClass = {
    neon: 'accent-bar--cyan',
    green: 'accent-bar--green',
    amber: 'accent-bar--amber',
    red: 'accent-bar--green',
  };

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -8, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
      className={`glass-card gradient-border p-7 cursor-default group ${glowClass || ''}`}
    >
      {/* Accent bar */}
      <div className={`accent-bar ${accentClass[color]}`} />

      {/* Icon */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-110"
        style={{ background: iconBgMap[color] }}
      >
        <Icon size={20} className={`${colorMap[color]} opacity-80`} strokeWidth={1.8} />
      </div>

      {/* Label */}
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted mb-2">
        {label}
      </p>

      {/* Animated Value */}
      <div className={`text-3xl font-bold ${colorMap[color]} leading-none mb-2`}>
        {rawValue != null ? (
          <AnimatedCounter
            value={rawValue}
            prefix={prefix || ''}
            suffix={suffix || ''}
            decimals={decimals ?? 2}
          />
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[0.7rem] text-text-muted mt-1">{subtitle}</p>
      )}
    </motion.div>
  );
}
