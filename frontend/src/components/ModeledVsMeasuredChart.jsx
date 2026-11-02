import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine
} from 'recharts';
import { Activity, UploadCloud, TrendingUp, AlertCircle, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { uploadMeterCSV } from '../services/api';

export default function ModeledVsMeasuredChart({ summary, onRefresh, isDemo, canManage }) {
  const [uploadModal, setUploadModal] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const data = summary?.monthly_data || [];
  const hasData = data.some((d) => d.measured_kwh > 0);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected && selected.name.toLowerCase().endsWith('.csv')) {
      setFile(selected);
      setFeedback(null);
    } else {
      setFile(null);
      setFeedback({ type: 'error', message: 'Please select a valid CSV file.' });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (isDemo) {
      setFeedback({ type: 'info', message: 'CSV upload is disabled in assignment demo mode.' });
      return;
    }
    setUploading(true);
    setFeedback(null);
    try {
      const res = await uploadMeterCSV(file);
      setFeedback({ type: 'success', message: res.message || 'Meter data successfully imported.' });
      setFile(null);
      if (onRefresh) await onRefresh();
      setTimeout(() => {
        setUploadModal(false);
        setFeedback(null);
      }, 1800);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to upload meter data. Please check CSV formatting.',
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleMeterCsv = () => {
    const csvContent = "timestamp,kwh,room_name\n2026-10-01 09:00,18.4,Engineering Labs\n2026-10-01 10:00,22.1,Engineering Labs\n2026-10-01 11:00,24.0,Engineering Labs\n2026-10-02 09:00,19.2,Library & Learning Commons\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "syncspace-meter-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="ss-card ss-modeled-measured" id="measured-analytics">
      <div className="ss-card-heading">
        <div>
          <div className="ss-kicker"><span className="ss-kicker-dot" /> EMPIRICAL VALIDATION</div>
          <h2>Modeled vs. Measured Energy</h2>
          <p>Compare theoretical schedule calculations against real-world interval meter data.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canManage && (
            <button className="ss-btn-subtle" onClick={() => setUploadModal(true)}>
              <UploadCloud size={14} /> Upload Meter CSV
            </button>
          )}
        </div>
      </div>

      <div className="ss-analytics-summary-grid">
        <div className="ss-sub-metric">
          <small>Modeled Total</small>
          <strong>{(summary?.total_modeled_kwh || 0).toLocaleString('en-IN')} <span>kWh</span></strong>
          <span>Theoretical schedule baseline</span>
        </div>
        <div className="ss-sub-metric">
          <small>Measured Meter Total</small>
          <strong>{(summary?.total_measured_kwh || 0).toLocaleString('en-IN')} <span>kWh</span></strong>
          <span>{hasData ? 'Verified CSV interval upload' : 'No meter data uploaded yet'}</span>
        </div>
        <div className="ss-sub-metric">
          <small>Model Gap (Variance)</small>
          <strong style={{ color: (summary?.net_gap_kwh || 0) < 0 ? '#b54724' : '#56734c' }}>
            {(summary?.net_gap_kwh || 0).toLocaleString('en-IN')} <span>kWh</span>
          </strong>
          <span>{(summary?.net_gap_kwh || 0) < 0 ? 'Exceeding schedule model' : 'Operating under rated capacity'}</span>
        </div>
      </div>

      {!hasData ? (
        <div className="ss-chart-empty" style={{ margin: '24px 0' }}>
          <div className="ss-empty-mark"><Activity size={22} /></div>
          <strong>No interval meter data uploaded yet</strong>
          <p style={{ margin: '6px 0 16px', color: '#798076', fontSize: '13px' }}>
            SyncSpace uses CSV meter uploads (no live hardware needed) to benchmark theoretical models against measured reality.
          </p>
          {canManage && (
            <button className="ss-btn-subtle" onClick={() => setUploadModal(true)}>
              <UploadCloud size={14} /> Upload Historical Meter CSV
            </button>
          )}
        </div>
      ) : (
        <div style={{ width: '100%', height: 280, marginTop: '20px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e3d8" vertical={false} />
              <XAxis dataKey="period" stroke="#798076" fontSize={11} tickLine={false} />
              <YAxis stroke="#798076" fontSize={11} tickLine={false} unit=" kWh" />
              <Tooltip
                contentStyle={{ background: '#fafaf5', borderColor: '#e1e3d8', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val) => [`${val.toLocaleString('en-IN')} kWh`]}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="modeled_kwh" name="Modeled Schedule Baseline" fill="#accf65" radius={[4, 4, 0, 0]} />
              <Bar dataKey="measured_kwh" name="Actual Meter Upload" fill="#19362a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {uploadModal && (
        <div className="ss-modal-backdrop" onClick={() => setUploadModal(false)}>
          <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ss-modal-head">
              <h3>Upload Historical Interval Meter Data</h3>
              <button className="ss-modal-close" onClick={() => setUploadModal(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload}>
              <p style={{ fontSize: '13px', color: '#566055', marginBottom: '16px' }}>
                Upload historical interval meter readings as a CSV. Required headers: <code>timestamp</code>, <code>kwh</code>. Optional: <code>room_name</code>.
              </p>

              <div style={{ padding: '16px', background: '#f5f5ee', borderRadius: '8px', marginBottom: '16px' }}>
                <input type="file" accept=".csv" onChange={handleFileChange} />
                {file && <span style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#19362a' }}>Selected: <strong>{file.name}</strong></span>}
              </div>

              {feedback && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  marginBottom: '16px',
                  background: feedback.type === 'error' ? '#fee' : feedback.type === 'info' ? '#eef' : '#efe',
                  color: feedback.type === 'error' ? '#922' : feedback.type === 'info' ? '#228' : '#282',
                }}>
                  {feedback.message}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                <button type="button" className="ss-btn-subtle" onClick={downloadSampleMeterCsv} style={{ fontSize: '11px' }}>
                  <FileText size={13} /> Sample CSV Template
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="ss-btn-subtle" onClick={() => setUploadModal(false)}>Cancel</button>
                  <button type="submit" className="ss-btn-primary" disabled={!file || uploading}>
                    {uploading ? 'Importing…' : 'Import Meter Data'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

