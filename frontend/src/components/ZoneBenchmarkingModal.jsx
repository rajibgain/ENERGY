import { useEffect, useState } from 'react';
import { ShieldCheck, Award, AlertTriangle, ExternalLink, BookOpen, Check } from 'lucide-react';
import { fetchZoneBenchmark } from '../services/api';

const ECBC_PRESETS = [
  { id: 'office', label: 'Commercial Office (ECBC 2017 Compliant — 140 kWh/m²/yr · Statutory)', type: 'statutory_code' },
  { id: 'office_plus', label: 'Commercial Office (ECBC+ 35% Savings — 115 kWh/m²/yr · Statutory)', type: 'statutory_code' },
  { id: 'office_super', label: 'Commercial Office (Super ECBC 50% Savings — 90 kWh/m²/yr · Statutory)', type: 'statutory_code' },
  { id: 'hospital', label: 'Healthcare / Hospital Facility (BEE Star Rating — 200 kWh/m²/yr · Statutory)', type: 'statutory_code' },
  { id: 'hotel', label: 'Hospitality / Hotel Facility (BEE Star Rating — 300 kWh/m²/yr · Statutory)', type: 'statutory_code' },
  { id: 'retail', label: 'Shopping Mall / Retail Center (BEE Star Rating — 180 kWh/m²/yr · Statutory)', type: 'statutory_code' },
  { id: 'education', label: 'Educational Institution Campus (BEE Audit — 100 kWh/m²/yr · Indicative)', type: 'indicative_space' },
  { id: 'classroom', label: 'Academic Classroom / Lecture Hall (BEE Audit — 95 kWh/m²/yr · Indicative)', type: 'indicative_space' },
  { id: 'lab', label: 'Science / Computer Lab (BEE High-Density — 160 kWh/m²/yr · Indicative)', type: 'indicative_space' },
  { id: 'it_datacenter', label: 'IT Server Room / Datacenter (BEE Data Guidelines — 400 kWh/m²/yr · Indicative)', type: 'indicative_space' },
  { id: 'warehouse', label: 'Warehouse / Storage Facility (BEE Unconditioned — 50 kWh/m²/yr · Indicative)', type: 'indicative_space' },
];

export default function ZoneBenchmarkingModal({ room, onClose, isDemo }) {
  const [area, setArea] = useState(room?.area_sqm || 50);
  const [zoneType, setZoneType] = useState(room?.zone_type || 'office');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const loadBenchmark = async (currentArea, currentType) => {
    setLoading(true);
    setError('');
    try {
      if (isDemo) {
        // Deterministic client calculation for demo mode
        const annualModeled = 14.5 * 365; // sample annual kWh
        const epi = Math.round((annualModeled / (currentArea || 50)) * 10) / 10;
        const benchPreset = ECBC_PRESETS.find((p) => p.id === currentType) || ECBC_PRESETS[0];
        const benchEpi = currentType === 'education' ? 100 : currentType === 'lab' ? 160 : currentType === 'classroom' ? 95 : 140;
        const diff = Math.round(((epi - benchEpi) / benchEpi) * 1000) / 10;
        setData({
          room_id: room.id,
          room_name: room.name,
          zone_type: currentType,
          area_sqm: currentArea,
          annual_modeled_kwh: annualModeled,
          epi_kwh_sqm_year: epi,
          benchmark_epi: benchEpi,
          benchmark_label: benchPreset.label,
          benchmark_type: benchPreset.type,
          climate_zone: 'Composite / Warm-Humid Standard (Daytime)',
          rating: diff < -10 ? 'efficient' : diff <= 15 ? 'standard' : 'inefficient',
          percentage_difference: diff,
          source_citation: benchPreset.type === 'statutory_code'
            ? 'Energy Conservation Building Code (ECBC 2017) Section 3 / Appendix E, Bureau of Energy Efficiency (BEE), Ministry of Power, Govt of India'
            : 'BEE Energy Audit Guidelines & ECO-III Space Benchmark Reference (Indicative operational space-type benchmark; not a statutory whole-building mandate)',
          benchmark_year: 2017,
        });
      } else {
        const res = await fetchZoneBenchmark(room.id, currentArea, currentType);
        setData(res);
      }
    } catch (err) {
      setError('Could not retrieve benchmark analysis.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (room) {
      loadBenchmark(area, zoneType);
    }
  }, [room]);

  const handleApply = (e) => {
    e.preventDefault();
    loadBenchmark(Number(area), zoneType);
  };

  if (!room) return null;

  return (
    <div className="ss-modal-backdrop" onClick={onClose}>
      <div className="ss-modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="ss-modal-head">
          <div>
            <span style={{ fontSize: '10px', color: '#798076', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              REGULATORY BENCHMARKING
            </span>
            <h3 style={{ margin: '2px 0 0' }}>{room.name} — ECBC &amp; BEE Compliance</h3>
          </div>
          <button className="ss-modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleApply} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '14px 0 18px' }}>
          <label className="ss-form-label">
            <span>Floor Area (m²)</span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </label>
          <label className="ss-form-label">
            <span>ECBC Space Classification</span>
            <select
              value={zoneType}
              onChange={(e) => setZoneType(e.target.value)}
            >
              {ECBC_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="ss-btn-subtle" style={{ fontSize: '11px' }}>
              Recalculate Energy Performance Index
            </button>
          </div>
        </form>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#798076' }}>
            Comparing against official BEE / ECBC reference tables…
          </div>
        ) : error ? (
          <div style={{ padding: '12px', background: '#fee', color: '#922', borderRadius: '6px', fontSize: '13px' }}>
            {error}
          </div>
        ) : data ? (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              padding: '16px',
              borderRadius: '8px',
              background: data.rating === 'efficient' ? '#f0f9e8' : data.rating === 'standard' ? '#fdf8eb' : '#fff5f2',
              border: `1px solid ${data.rating === 'efficient' ? '#bce59e' : data.rating === 'standard' ? '#f6df9d' : '#f8c7b8'}`,
            }}>
              <div>
                <small style={{ color: '#566055', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.08em' }}>
                  Zone EPI (Energy Performance Index)
                </small>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#19362a', marginTop: '2px' }}>
                  {data.epi_kwh_sqm_year} <span style={{ fontSize: '12px', fontWeight: 400 }}>kWh/m²/yr</span>
                </div>
                <span style={{ fontSize: '11px', color: '#566055' }}>
                  {data.percentage_difference > 0 ? `+${data.percentage_difference}%` : `${data.percentage_difference}%`} vs reference
                </span>
              </div>

              <div>
                <small style={{ color: '#566055', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.08em' }}>
                  Regulatory Reference EPI
                </small>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#4a5b48', marginTop: '2px' }}>
                  {data.benchmark_epi} <span style={{ fontSize: '12px', fontWeight: 400 }}>kWh/m²/yr</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: data.rating === 'efficient' ? '#386629' : data.rating === 'standard' ? '#b27b00' : '#b54724',
                    color: '#fff',
                  }}>
                    {data.rating === 'efficient' ? '✓ High Efficiency' : data.rating === 'standard' ? 'Compliant Baseline' : 'Exceeds Benchmark'}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: data.benchmark_type === 'statutory_code' ? '#19362a' : '#4a5b48',
                    color: '#f0f9e8',
                  }}>
                    {data.benchmark_type === 'statutory_code' ? 'Statutory Whole-Building Mandate' : 'Indicative Space-Type Benchmark'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              background: '#f8f8f2',
              border: '1px solid #e1e3d8',
              borderRadius: '6px',
              padding: '12px 14px',
              fontSize: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#19362a' }}>
                  <BookOpen size={13} />
                  <span>Authoritative Citation ({data.benchmark_year})</span>
                </div>
                <span style={{ fontSize: '10px', color: '#798076', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {data.climate_zone || 'Composite / Warm-Humid Standard'}
                </span>
              </div>
              <p style={{ margin: 0, color: '#566055', lineHeight: 1.4 }}>
                {data.source_citation}
              </p>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button className="ss-btn-subtle" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

