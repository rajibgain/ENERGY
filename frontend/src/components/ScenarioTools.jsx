import { useMemo, useState } from 'react';
import { Calculator, Leaf, Sun, Wallet } from 'lucide-react';
import { scheduledHoursPerDay } from '../utils/energyModel';

const LIGHTING_TERMS = ['light', 'lamp', 'tube', 'bulb'];
const COOLING_TERMS = ['ac', 'air conditioner', 'hvac', 'chiller', 'cooling', 'split'];
const matchesAppliance = (appliance, terms) => {
  const name = String(appliance.name || '').toLowerCase();
  return terms.some((term) => term === 'ac' ? /\bac\b/.test(name) : name.includes(term));
};
const watts = (value) => Math.max(0, Number(value || 0));
const loadFactor = (appliance) => Math.min(1, Math.max(0.05, Number(appliance.load_factor ?? 1)));
const money = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const fixed = (value, digits = 1) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });

function ScenarioField({ label, value, min, max, step = 1, unit, onChange, hint }) {
  return <label className="ss-scenario-control">
    <span><strong>{label}</strong><output>{value}{unit}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    {hint && <small>{hint}</small>}
  </label>;
}

function WhatIfCalculator({ rooms, organization }) {
  const [cutHours, setCutHours] = useState(0);
  const [lightingReduction, setLightingReduction] = useState(50);
  const [currentSetpoint, setCurrentSetpoint] = useState(24);
  const [proposedSetpoint, setProposedSetpoint] = useState(26);
  const [coolingSavingPerDegree, setCoolingSavingPerDegree] = useState(2);
  const [investment, setInvestment] = useState('');
  const operatingHours = Math.max(0, Number(organization.operatingHours || 0));
  const maxCut = Math.max(0.5, Math.min(4, operatingHours));
  const summary = useMemo(() => {
    let baselineKwh = 0;
    let scenarioKwh = 0;
    let lightCount = 0;
    let coolingCount = 0;
    let scheduledHoursTotal = 0;

    for (const room of rooms) {
      const scheduledHours = Math.min(operatingHours, scheduledHoursPerDay(room.schedules || []));
      const reducedHours = Math.max(0, scheduledHours - Math.min(cutHours, scheduledHours));
      scheduledHoursTotal += scheduledHours;
      const idleHours = Math.max(0, operatingHours - scheduledHours);
      for (const appliance of room.appliances || []) {
        const ratedWatts = watts(appliance.power_watts);
        const activeKw = ratedWatts * loadFactor(appliance) / 1000;
        const standbyKw = Math.min(ratedWatts, watts(appliance.standby_watts)) / 1000;
        const light = matchesAppliance(appliance, LIGHTING_TERMS);
        const cooling = matchesAppliance(appliance, COOLING_TERMS);
        if (light) lightCount += 1;
        if (cooling) coolingCount += 1;
        const ledFactor = light ? 1 - lightingReduction / 100 : 1;
        const setpointDelta = cooling ? Math.max(0, proposedSetpoint - currentSetpoint) : 0;
        const coolingReduction = Math.min(50, setpointDelta * coolingSavingPerDegree);
        const coolingFactor = cooling ? 1 - coolingReduction / 100 : 1;
        baselineKwh += activeKw * scheduledHours + standbyKw * idleHours;
        scenarioKwh += activeKw * ledFactor * coolingFactor * reducedHours + standbyKw * (operatingHours - reducedHours);
      }
    }

    const savingsKwh = Math.max(0, baselineKwh - scenarioKwh);
    const monthlyKwh = savingsKwh * 30;
    const monthlySavings = monthlyKwh * Number(organization.tariffRate || 0);
    const capex = Number(investment);
    return {
      baselineKwh,
      scenarioKwh,
      savingsKwh,
      monthlyKwh,
      dailyRupees: savingsKwh * Number(organization.tariffRate || 0),
      monthlySavings,
      dailyCarbon: savingsKwh * Number(organization.carbonFactor || 0),
      paybackMonths: capex > 0 && monthlySavings > 0 ? capex / monthlySavings : null,
      lightCount,
      coolingCount,
      hasSchedules: scheduledHoursTotal > 0,
    };
  }, [rooms, organization, operatingHours, cutHours, lightingReduction, currentSetpoint, proposedSetpoint, coolingSavingPerDegree, investment]);

  return <article className="ss-card ss-scenario-card">
    <div className="ss-scenario-heading">
      <span className="ss-scenario-icon"><Calculator size={17} /></span>
      <div><div className="ss-kicker"><span className="ss-kicker-dot" /> PLANNING SCENARIO</div><h3>What if you changed the schedule?</h3></div>
    </div>
    <p className="ss-scenario-copy">Adjust the operating assumptions to estimate daily savings against the current timetable.</p>

    {!summary.hasSchedules && <div className="ss-scenario-empty">Add a schedule to at least one zone before comparing operating scenarios.</div>}

    <div className="ss-scenario-controls">
      <ScenarioField label="Reduce scheduled runtime per zone" value={cutHours} min={0} max={maxCut} step={0.5} unit=" h" onChange={setCutHours} hint="Each zone is capped at its scheduled hours/day." />
      <ScenarioField label="Lighting power reduction after LED upgrade" value={lightingReduction} min={0} max={80} unit="%" onChange={setLightingReduction} hint={`${summary.lightCount} equipment item${summary.lightCount === 1 ? '' : 's'} matched by name; adjust this planning assumption.`} />
      <div className="ss-setpoint-controls">
        <label className="ss-scenario-number"><span>Current AC setpoint</span><div><input type="number" min="16" max="32" step="0.5" value={currentSetpoint} onChange={(event) => setCurrentSetpoint(Number(event.target.value))} /><b>°C</b></div></label>
        <label className="ss-scenario-number"><span>Scenario setpoint</span><div><input type="number" min="16" max="32" step="0.5" value={proposedSetpoint} onChange={(event) => setProposedSetpoint(Number(event.target.value))} /><b>°C</b></div></label>
      </div>
      <ScenarioField label="Assumed cooling reduction per °C increase" value={coolingSavingPerDegree} min={0} max={10} step={0.5} unit="%/°C" onChange={setCoolingSavingPerDegree} hint={`${summary.coolingCount} equipment item${summary.coolingCount === 1 ? '' : 's'} matched by name; this is an editable assumption, not a measured result.`} />
      <label className="ss-scenario-number ss-investment-field"><span>Estimated one-time project cost <small>(optional)</small></span><div><b>₹</b><input type="number" min="0" step="1000" value={investment} onChange={(event) => setInvestment(event.target.value)} placeholder="Enter a quote" /></div></label>
    </div>

    <div className="ss-scenario-results">
      <div><span>Potential daily savings</span><strong>{summary.hasSchedules ? <>{fixed(summary.savingsKwh)} <small>kWh</small></> : '—'}</strong><em>{summary.hasSchedules ? `${money(summary.dailyRupees)} / day · ${fixed(summary.dailyCarbon)} kg CO₂e / day` : 'Add a timetable to estimate'}</em></div>
      <div><span>Monthly estimate · 30 days</span><strong>{summary.hasSchedules ? money(summary.monthlySavings) : '—'}</strong><em>{summary.hasSchedules ? `${fixed(summary.monthlyKwh)} kWh · baseline ${fixed(summary.baselineKwh)} → scenario ${fixed(summary.scenarioKwh)} kWh/day` : 'Add a timetable to estimate'}</em></div>
      <div><span>Simple payback</span><strong>{summary.paybackMonths ? `${fixed(summary.paybackMonths)} months` : '—'}</strong><em>{summary.paybackMonths ? 'Using the project cost you entered' : 'Enter a project quote and savings above zero'}</em></div>
    </div>
      <p className="ss-scenario-foot"><Leaf size={13} /> Uses appliance load factors, standby watts and imported schedules. Savings are modeled as active load shifted to standby; LED and cooling percentages are editable assumptions, with cooling reduction capped at 50%. Verify results against meter readings or a separate measured-usage analysis.</p>
  </article>;
}

function SolarEstimator({ organization }) {
  const [roofArea, setRoofArea] = useState('');
  const [usablePercent, setUsablePercent] = useState(70);
  const [areaPerKwp, setAreaPerKwp] = useState(9.3);
  const [dailyYield, setDailyYield] = useState(4.75);
  const [quotePerKwp, setQuotePerKwp] = useState('');
  const estimates = useMemo(() => {
    const totalArea = Math.max(0, Number(roofArea || 0));
    const systemSize = areaPerKwp > 0 ? totalArea * usablePercent / 100 / areaPerKwp : 0;
    const dailyEnergy = systemSize * dailyYield;
    const monthlyEnergy = dailyEnergy * 30;
    const monthlyValue = monthlyEnergy * Number(organization.tariffRate || 0);
    const cost = Number(quotePerKwp) > 0 ? systemSize * Number(quotePerKwp) : 0;
    return {
      systemSize,
      dailyEnergy,
      monthlyEnergy,
      monthlyValue,
      cost,
      paybackMonths: cost > 0 && monthlyValue > 0 ? cost / monthlyValue : null,
    };
  }, [roofArea, usablePercent, areaPerKwp, dailyYield, quotePerKwp, organization.tariffRate]);
  const hasRoofInput = Number(roofArea) > 0;

  return <article className="ss-card ss-scenario-card ss-solar-card">
    <div className="ss-scenario-heading">
      <span className="ss-scenario-icon is-solar"><Sun size={17} /></span>
      <div><div className="ss-kicker"><span className="ss-kicker-dot" /> ROOFTOP SOLAR · KOLKATA</div><h3>Estimate roof potential</h3></div>
    </div>
    <p className="ss-scenario-copy">A first-pass estimate using the Kolkata yield range of 4.5–5.0 kWh per kWp per day.</p>
    <div className="ss-solar-inputs">
      <label className="ss-scenario-number"><span>Total roof area</span><div><input type="number" min="0" step="1" value={roofArea} onChange={(event) => setRoofArea(event.target.value)} placeholder="e.g. 250" /><b>m²</b></div></label>
      <label className="ss-scenario-number"><span>Usable roof area</span><div><input type="number" min="1" max="100" step="1" value={usablePercent} onChange={(event) => setUsablePercent(Math.min(100, Math.max(1, Number(event.target.value))))} /><b>%</b></div></label>
      <label className="ss-scenario-number"><span>Roof area per 1 kWp</span><div><input type="number" min="1" max="100" step="0.1" value={areaPerKwp} onChange={(event) => setAreaPerKwp(Number(event.target.value))} /><b>m²</b></div></label>
      <label className="ss-scenario-number"><span>Solar yield</span><div><input type="number" min="4.5" max="5" step="0.05" value={dailyYield} onChange={(event) => setDailyYield(Math.min(5, Math.max(4.5, Number(event.target.value))))} /><b>kWh/kWp/day</b></div></label>
      <label className="ss-scenario-number ss-investment-field"><span>Installer quote <small>(optional)</small></span><div><b>₹/kWp</b><input type="number" min="0" step="1000" value={quotePerKwp} onChange={(event) => setQuotePerKwp(event.target.value)} placeholder="Enter a quote" /></div></label>
    </div>
    <div className="ss-solar-results">
      <div><span>Estimated system size</span><strong>{hasRoofInput ? <>{fixed(estimates.systemSize, 2)} <small>kWp</small></> : '—'}</strong></div>
      <div><span>Estimated generation</span><strong>{hasRoofInput ? <>{fixed(estimates.dailyEnergy)} <small>kWh/day</small></> : '—'}</strong><em>{hasRoofInput ? `${fixed(estimates.monthlyEnergy)} kWh / 30 days` : 'Enter roof area to estimate'}</em></div>
      <div><span>Bill value offset estimate</span><strong>{hasRoofInput ? <>{money(estimates.monthlyValue)} <small>/ month</small></> : '—'}</strong><em>{hasRoofInput ? `At the configured tariff of ₹${fixed(organization.tariffRate, 2)}/kWh` : 'Enter roof area to estimate'}</em></div>
      <div><span>Simple payback</span><strong>{estimates.paybackMonths ? `${fixed(estimates.paybackMonths)} months` : '—'}</strong><em>{estimates.paybackMonths ? `Quote-based estimated cost ${money(estimates.cost)}` : 'Enter roof area and an installer quote'}</em></div>
    </div>
    <p className="ss-scenario-foot"><Wallet size={13} /> Assumes all generation offsets grid purchases at the blended tariff; exports, self-consumption timing, shading, orientation, tilt, structural capacity, local approvals, system losses and actual installer pricing are not modeled. The 9.3 m²/kWp area density is an editable rough planning reference; replace it with a site-specific design.</p>
  </article>;
}

export default function ScenarioTools({ rooms, organization }) {
  return <section id="simulator" data-section className="ss-simulator-section">
    <div className="ss-section-caption"><span>PLAN BEFORE YOU INVEST</span><span>SCENARIOS · ESTIMATES</span></div>
    <div className="ss-simulator-heading"><div><div className="ss-kicker"><span className="ss-kicker-dot" /> WHAT-IF WORKSPACE</div><h2>Explore the <em>next move.</em></h2><p>Change schedules, equipment assumptions, or roof inputs to compare planning estimates. Nothing here controls building equipment.</p></div></div>
    <div className="ss-simulator-grid"><WhatIfCalculator rooms={rooms} organization={organization} /><SolarEstimator organization={organization} /></div>
  </section>;
}
