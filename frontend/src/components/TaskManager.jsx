import { useState } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, Plus, Check, ChevronRight, User, Calendar, FileText, ArrowUpRight
} from 'lucide-react';
import { createTask, updateTask, deleteTask } from '../services/api';

export default function TaskManager({ tasks, rooms, organization, onRefresh, isDemo, canManage }) {
  const [filter, setFilter] = useState('all');
  const [createModal, setCreateModal] = useState(false);
  const [verifyModal, setVerifyModal] = useState(null); // task object when verifying
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: '',
    room_id: '',
  });
  const [verifyReadings, setVerifyReadings] = useState({ before_kwh: '', after_kwh: '' });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const tariff = organization?.tariffRate || 8.0;

  const filteredTasks = (tasks || []).filter((task) => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    if (isDemo) {
      setToast('Tasks are illustrative in demo mode.');
      setCreateModal(false);
      return;
    }
    setBusy(true);
    try {
      await createTask({
        title: draft.title.trim(),
        description: draft.description.trim(),
        assigned_to: draft.assigned_to.trim() || null,
        priority: draft.priority,
        due_date: draft.due_date || null,
        room_id: draft.room_id ? Number(draft.room_id) : null,
      });
      setDraft({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '', room_id: '' });
      setCreateModal(false);
      setToast('Audit task created.');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setToast('Failed to create task.');
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (task, nextStatus) => {
    if (isDemo) return;
    try {
      await updateTask(task.id, { status: nextStatus });
      if (onRefresh) await onRefresh();
    } catch (err) {
      setToast('Failed to update status.');
    }
  };

  const handleSaveVerification = async (e) => {
    e.preventDefault();
    if (!verifyModal) return;
    const beforeVal = parseFloat(verifyReadings.before_kwh);
    const afterVal = parseFloat(verifyReadings.after_kwh);

    if (isNaN(beforeVal) || isNaN(afterVal) || beforeVal < afterVal) {
      setToast('Enter valid readings where before reading >= after reading.');
      return;
    }

    if (isDemo) {
      setToast('Saved verified savings in demo session.');
      setVerifyModal(null);
      return;
    }

    setBusy(true);
    try {
      await updateTask(verifyModal.id, {
        status: 'completed',
        before_reading_kwh: beforeVal,
        after_reading_kwh: afterVal,
      });
      setVerifyModal(null);
      setVerifyReadings({ before_kwh: '', after_kwh: '' });
      setToast('Verified meter savings logged successfully!');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setToast('Failed to log verification.');
    } finally {
      setBusy(false);
    }
  };

  const calculatePreviewSavings = () => {
    const b = parseFloat(verifyReadings.before_kwh);
    const a = parseFloat(verifyReadings.after_kwh);
    if (!isNaN(b) && !isNaN(a) && b >= a) {
      const savedKwh = b - a;
      const savedInr = savedKwh * tariff;
      return { kwh: savedKwh.toFixed(1), inr: savedInr.toLocaleString('en-IN', { maximumFractionDigits: 0 }) };
    }
    return null;
  };

  const preview = calculatePreviewSavings();

  return (
    <section className="ss-card ss-tasks-section" id="tasks">
      <div className="ss-card-heading">
        <div>
          <div className="ss-kicker"><span className="ss-kicker-dot" /> ACTION REGISTER</div>
          <h2>Energy Tasks & Audit Log</h2>
          <p>Assign facility retrofits, operational changes, and record before-and-after meter readings to log proven savings.</p>
        </div>
        {canManage && (
          <button className="ss-btn-subtle" onClick={() => setCreateModal(true)}>
            <Plus size={14} /> New Audit Task
          </button>
        )}
      </div>

      <div className="ss-filter-tabs" style={{ display: 'flex', gap: '8px', margin: '14px 0 20px' }}>
        {['all', 'open', 'in_progress', 'completed'].map((st) => (
          <button
            key={st}
            className={'ss-tab-pill' + (filter === st ? ' is-active' : '')}
            onClick={() => setFilter(st)}
          >
            {st === 'all' ? 'All Tasks' : st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            <span style={{ marginLeft: '6px', opacity: 0.7 }}>
              {st === 'all' ? (tasks || []).length : (tasks || []).filter((t) => t.status === st).length}
            </span>
          </button>
        ))}
      </div>

      {toast && (
        <div style={{ padding: '8px 12px', background: '#eef2e6', color: '#19362a', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
          {toast}
        </div>
      )}

      {!filteredTasks.length ? (
        <div className="ss-chart-empty">
          <div className="ss-empty-mark"><CheckCircle2 size={22} /></div>
          <strong>No tasks in this view</strong>
          <span style={{ fontSize: '12px', color: '#798076' }}>Create actionable tasks to track repairs, retrofits, and HVAC tuning.</span>
        </div>
      ) : (
        <div className="ss-tasks-grid" style={{ display: 'grid', gap: '12px' }}>
          {filteredTasks.map((task) => {
            const roomObj = (rooms || []).find((r) => r.id === task.room_id);
            return (
              <div key={task.id} className="ss-task-card" style={{
                background: '#fff',
                border: '1px solid #e1e3d8',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className={`ss-badge ss-badge-${task.priority}`} style={{
                      textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      background: task.priority === 'critical' || task.priority === 'high' ? '#fee' : '#edf3e4',
                      color: task.priority === 'critical' || task.priority === 'high' ? '#922' : '#283618',
                      marginRight: '8px'
                    }}>
                      {task.priority}
                    </span>
                    <strong style={{ fontSize: '14px', color: '#1a2920' }}>{task.title}</strong>
                  </div>

                  <span className={`ss-status-badge ss-status-${task.status}`} style={{
                    fontSize: '11px', textTransform: 'capitalize', fontWeight: 600,
                    color: task.status === 'completed' ? '#2e6f40' : task.status === 'in_progress' ? '#1f4e79' : '#b25e00',
                  }}>
                    ● {task.status.replace('_', ' ')}
                  </span>
                </div>

                {task.description && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#566055' }}>{task.description}</p>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '11px', color: '#798076', borderTop: '1px solid #f0f0e8', paddingTop: '10px' }}>
                  {task.assigned_to && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} /> {task.assigned_to}
                    </span>
                  )}
                  {task.due_date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> Due: {task.due_date}
                    </span>
                  )}
                  {roomObj && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Zone: <strong>{roomObj.name}</strong>
                    </span>
                  )}
                </div>

                {task.verified_savings_kwh != null && (
                  <div style={{
                    background: '#f1f8ea',
                    border: '1px solid #c8e6b8',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#284e1b',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}>
                    <span>Proven Savings Logged:</span>
                    <strong>{task.verified_savings_kwh} kWh saved (₹{task.verified_savings_inr?.toLocaleString('en-IN')})</strong>
                  </div>
                )}

                {canManage && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                    {task.status !== 'completed' && (
                      <button
                        className="ss-btn-subtle"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => {
                          setVerifyModal(task);
                          setVerifyReadings({
                            before_kwh: task.before_reading_kwh != null ? String(task.before_reading_kwh) : '',
                            after_kwh: task.after_reading_kwh != null ? String(task.after_reading_kwh) : '',
                          });
                        }}
                      >
                        <Check size={12} /> Log Meter Verification
                      </button>
                    )}
                    {task.status === 'open' && (
                      <button
                        className="ss-btn-subtle"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => handleStatusChange(task, 'in_progress')}
                      >
                        Start Task
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {createModal && (
        <div className="ss-modal-backdrop" onClick={() => setCreateModal(false)}>
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-head">
              <h3>Create Audit Task</h3>
              <button className="ss-modal-close" onClick={() => setCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <label className="ss-form-label">
                  <span>Task Title *</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Install programmable timer on HVAC"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>
                <label className="ss-form-label">
                  <span>Description</span>
                  <textarea
                    rows={2}
                    placeholder="Specific retrofit or operational requirement..."
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label className="ss-form-label">
                    <span>Assigned Owner</span>
                    <input
                      type="text"
                      placeholder="Name or email"
                      value={draft.assigned_to}
                      onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })}
                    />
                  </label>
                  <label className="ss-form-label">
                    <span>Priority</span>
                    <select
                      value={draft.priority}
                      onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label className="ss-form-label">
                    <span>Due Date</span>
                    <input
                      type="date"
                      value={draft.due_date}
                      onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                    />
                  </label>
                  <label className="ss-form-label">
                    <span>Associated Zone (Optional)</span>
                    <select
                      value={draft.room_id}
                      onChange={(e) => setDraft({ ...draft, room_id: e.target.value })}
                    >
                      <option value="">Portfolio / Unassigned</option>
                      {(rooms || []).map((r) => (
                        <option key={r.id} value={r.id}>{r.name} ({r.block})</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button type="button" className="ss-btn-subtle" onClick={() => setCreateModal(false)}>Cancel</button>
                <button type="submit" className="ss-btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Verification Modal */}
      {verifyModal && (
        <div className="ss-modal-backdrop" onClick={() => setVerifyModal(null)}>
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-head">
              <h3>Record Meter Verification</h3>
              <button className="ss-modal-close" onClick={() => setVerifyModal(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveVerification}>
              <p style={{ fontSize: '13px', color: '#566055', marginBottom: '14px' }}>
                Logging before and after meter readings validates the physical intervention and converts theoretical estimates into proven savings.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <label className="ss-form-label">
                  <span>Baseline Reading (Before, kWh)</span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 500.0"
                    value={verifyReadings.before_kwh}
                    onChange={(e) => setVerifyReadings({ ...verifyReadings, before_kwh: e.target.value })}
                  />
                </label>
                <label className="ss-form-label">
                  <span>Post-Retrofit Reading (After, kWh)</span>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g. 350.0"
                    value={verifyReadings.after_kwh}
                    onChange={(e) => setVerifyReadings({ ...verifyReadings, after_kwh: e.target.value })}
                  />
                </label>
              </div>

              {preview && (
                <div style={{
                  background: '#f2f9ed',
                  border: '1px solid #b7dfa4',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}>
                  <span style={{ color: '#274b1e' }}>Calculated Proven Savings:</span>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#1b3b12', marginTop: '2px' }}>
                    {preview.kwh} kWh &nbsp;·&nbsp; ₹{preview.inr}
                  </strong>
                  <small style={{ color: '#5b7852', fontSize: '11px' }}>Computed at current effective tariff of ₹{tariff}/kWh</small>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="ss-btn-subtle" onClick={() => setVerifyModal(null)}>Cancel</button>
                <button type="submit" className="ss-btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Log Proven Savings & Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

