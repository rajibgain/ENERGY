import { useState } from 'react';
import {
  LayoutDashboard, BarChart3, Building2, Upload, Settings,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'zones', icon: Building2, label: 'Zones' },
  { id: 'upload', icon: Upload, label: 'Upload' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ activeSection = 'dashboard', onNavigate, collapsed, onToggle }) {
  return (
    <aside
      className="sidebar fixed left-0 top-0 bottom-0 flex flex-col py-6 overflow-hidden"
      style={{ width: collapsed ? 68 : 220 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(0,243,255,0.15), rgba(0,255,136,0.1))' }}>
          <Zap size={18} className="text-cyan-400" strokeWidth={1.5} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <p className="text-sm font-medium tracking-[0.12em] text-white/90 uppercase">SyncSpace</p>
            <p className="text-[9px] tracking-[0.2em] text-white/30 uppercase">AI Energy</p>
          </div>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`sidebar-link ${activeSection === item.id ? 'active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} strokeWidth={1.5} className="shrink-0" />
            {!collapsed && (
              <span className="text-xs tracking-[0.12em] uppercase font-medium whitespace-nowrap overflow-hidden">
                {item.label}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-3 mt-auto">
        <button
          onClick={onToggle}
          className="sidebar-link justify-center"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? (
            <ChevronRight size={16} strokeWidth={1.5} />
          ) : (
            <>
              <ChevronLeft size={16} strokeWidth={1.5} className="shrink-0" />
              <span className="text-[10px] tracking-[0.12em] uppercase font-medium whitespace-nowrap overflow-hidden">
                Collapse
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
