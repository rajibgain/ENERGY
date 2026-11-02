import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Sparkles, HelpCircle } from 'lucide-react';

export default function BillAnalyticsView({ billTrends, forecast, organization }) {
  const [activeTab, setActiveTab] = useState('chart');

  const tariff = organization?.tariffRate || 8.0;

  const anomaliesCount = useMemo(() => {
    return (billTrends || []).filter((b) => b.is_anomaly).length;
  }, [billTrends]);

  return (
    <section className="ss-card ss-bill-analytics" id="bill-analytics">
      <div className="ss-card-heading">
        <div>
          <div className="ss-kicker"><span className="ss-kicker-dot" /> FINANCIAL INTELLIGENCE</div>
          <h2>Bill Trends & Machine Learning Forecast</h2>
          <p>Statistical rolling-average anomaly detection and predictive next-month regression modeling.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', margin: '16px 0 24px' }}>
        {/* Forecast Card */}
        <div style={{
          background: 'linear-gradient(135deg, #19362a 0%, #11251c 100%)',
          color: '#f0f0e8',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '1px solid rgba(220,237,203,0.15)',
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#adc66c', fontWeight: 700 }}>
                <Sparkles size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                NEXT-MONTH PREDICTIVE FORECAST
              </span>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: forecast?.trend === 'increasing' ? 'rgba(216,130,108,0.2)' : forecast?.trend === 'decreasing' ? 'rgba(172,207,101,0.2)' : 'rgba(255,255,255,0.1)',
                color: forecast?.trend === 'increasing' ? '#d8826c' : forecast?.trend === 'decreasing' ? '#accf65' : '#ccc',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                {forecast?.trend === 'increasing' && <TrendingUp size={11} />}
                {forecast?.trend === 'decreasing' && <TrendingDown size={11} />}
                {forecast?.trend === 'stable' && <Minus size={11} />}
                {forecast?.trend || 'Stable'}
              </span>
            </div>

            <div style={{ fontSize: '26px', fontWeight: 600, color: '#f5f4e9', margin: '8px 0 4px' }}>
              ₹{(forecast?.predicted_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '13px', color: '#adc66c' }}>
              ~{(forecast?.predicted_kwh || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} kWh expected
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(240,240,232,0.12)', paddingTop: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(240,240,232,0.6)' }}>
            <span>Target Month: <strong>{forecast?.predicted_month || 'Next'}</strong></span>
            <span>Model Fit (R²): <strong>{((forecast?.confidence_r2 || 0) * 100).toFixed(0)}%</strong></span>
          </div>
        </div>

        {/* Anomaly Detection Status Card */}
        <div style={{
          background: anomaliesCount > 0 ? '#fff8f6' : '#f7faf2',
          border: `1px solid ${anomaliesCount > 0 ? '#f4cfc4' : '#d2e8b9'}`,
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: anomaliesCount > 0 ? '#b54724' : '#386629', fontWeight: 700 }}>
              STATISTICAL ANOMALY SURVEILLANCE
            </span>
            <div style={{ fontSize: '24px', fontWeight: 600, color: anomaliesCount > 0 ? '#943216' : '#234917', margin: '8px 0 4px' }}>
              {anomaliesCount} Flagged Month{anomaliesCount === 1 ? '' : 's'}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#566055' }}>
              {anomaliesCount > 0
                ? 'Flagged months have electricity expenditures exceeding 20% above their 3-month rolling average.'
                : 'No statistical anomalies detected. Expenditures remain within the normal 20% variance window.'}
            </p>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '10px', marginTop: '12px', fontSize: '11px', color: '#798076' }}>
            Criteria: Month expenditure &gt; 1.20 × rolling average(M-3, M-2, M-1)
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      {(!billTrends || billTrends.length === 0) ? (
        <div className="ss-chart-empty" style={{ margin: '20px 0' }}>
          <strong>No bill records available</strong>
          <span style={{ fontSize: '12px', color: '#798076' }}>Add records to the electricity ledger to visualize expenditure trends.</span>
        </div>
      ) : (
        <div style={{ width: '100%', height: 280, marginTop: '12px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={billTrends} margin={{ top: 15, right: 20, left: -5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e3d8" vertical={false} />
              <XAxis dataKey="month" stroke="#798076" fontSize={11} tickLine={false} />
              <YAxis stroke="#798076" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#fafaf5', borderColor: '#e1e3d8', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val, name, item) => [
                  `₹${val.toLocaleString('en-IN')}${item.payload.is_anomaly ? ' ⚠️ (>20% Spike Anomaly)' : ''}`,
                  name === 'total_amount' ? 'Billed Amount' : '3-Mo Rolling Avg'
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="total_amount" name="Billed Total (₹)">
                {billTrends.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.is_anomaly ? '#d8826c' : '#19362a'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

