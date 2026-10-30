const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAILY_LABELS = new Set(['everyday', 'daily', 'all days']);

export function timeToMinutes(value) {
  const [hours = '0', minutes = '0'] = String(value || '0:0').split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function scheduledHoursPerDay(schedules = []) {
  const intervalsByDay = Array.from({ length: 7 }, () => []);
  for (const schedule of schedules) {
    const label = String(schedule.day_of_week || '').trim().toLowerCase();
    const start = timeToMinutes(schedule.start_time);
    let end = timeToMinutes(schedule.end_time);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end === start) continue;
    if (end < start) end += 24 * 60;
    const days = DAILY_LABELS.has(label) ? WEEKDAYS.map((_, index) => index) : [WEEKDAYS.indexOf(label)];
    for (const day of days) {
      if (day < 0) continue;
      if (end <= 24 * 60) intervalsByDay[day].push([start, end]);
      else {
        intervalsByDay[day].push([start, 24 * 60]);
        intervalsByDay[(day + 1) % 7].push([0, end - 24 * 60]);
      }
    }
  }

  const weeklyMinutes = intervalsByDay.reduce((total, intervals) => {
    const ordered = intervals.sort((left, right) => left[0] - right[0]);
    let dayMinutes = 0;
    let current = null;
    for (const interval of ordered) {
      if (!current) current = [...interval];
      else if (interval[0] <= current[1]) current[1] = Math.max(current[1], interval[1]);
      else {
        dayMinutes += current[1] - current[0];
        current = [...interval];
      }
    }
    if (current) dayMinutes += current[1] - current[0];
    return total + dayMinutes;
  }, 0);

  return weeklyMinutes / 60 / 7;
}

function applianceLoads(appliances = []) {
  return appliances.reduce((loads, appliance) => {
    const ratedWatts = Math.max(0, Number(appliance.power_watts || 0));
    const loadFactor = Math.min(1, Math.max(0.05, Number(appliance.load_factor ?? 1)));
    const standbyWatts = Math.min(ratedWatts, Math.max(0, Number(appliance.standby_watts || 0)));
    loads.ratedKw += ratedWatts / 1000;
    loads.activeKw += ratedWatts * loadFactor / 1000;
    loads.standbyKw += standbyWatts / 1000;
    return loads;
  }, { ratedKw: 0, activeKw: 0, standbyKw: 0 });
}

export function resolveEffectiveTariffRate(organization = {}) {
  const flatRate = Number(organization.tariff_rate ?? organization.flatTariffRate ?? organization.tariffRate ?? 0);
  if ((organization.tariff_mode ?? organization.tariffMode) !== 'time_of_use') return Number.isFinite(flatRate) ? flatRate : 0;

  const peakRate = Number(organization.peak_tariff_rate ?? organization.peakTariffRate ?? flatRate);
  const offpeakRate = Number(organization.offpeak_tariff_rate ?? organization.offpeakTariffRate ?? flatRate);
  const peakStart = timeToMinutes(organization.peak_start_time ?? organization.peakStartTime ?? '17:00');
  const peakEnd = timeToMinutes(organization.peak_end_time ?? organization.peakEndTime ?? '22:00');
  const peakMinutes = peakStart === peakEnd ? 0 : peakEnd > peakStart ? peakEnd - peakStart : 1440 - peakStart + peakEnd;
  const blended = (peakRate * peakMinutes + offpeakRate * (1440 - peakMinutes)) / 1440;
  return Number.isFinite(blended) ? blended : (Number.isFinite(flatRate) ? flatRate : 0);
}

export function roomEstimate(room, tariffRate = 8, carbonFactor = 0.82, operatingHours = 8) {
  const loads = applianceLoads(room.appliances || []);
  const scheduledHours = scheduledHoursPerDay(room.schedules || []);
  const idleHours = Math.max(0, operatingHours - scheduledHours);
  const avoidableKw = Math.max(0, loads.activeKw - loads.standbyKw);
  const wasteKwh = avoidableKw * idleHours;
  return {
    connectedKw: loads.ratedKw,
    activeLoadKw: loads.activeKw,
    standbyLoadKw: loads.standbyKw,
    modeledEnergyKwh: loads.activeKw * scheduledHours + loads.standbyKw * idleHours,
    scheduledHours,
    idleHours,
    wasteKwh,
    cost: wasteKwh * tariffRate,
    carbon: wasteKwh * carbonFactor,
  };
}

export function calculateWorkspaceDashboard(rooms, organization) {
  const tariff = resolveEffectiveTariffRate(organization);
  const carbonFactor = Number(organization.carbon_factor ?? organization.carbonFactor) || 0;
  const operatingHours = Number(organization.operating_hours ?? organization.operatingHours) || 0;
  const totals = rooms.reduce((summary, room) => {
    const estimate = roomEstimate(room, tariff, carbonFactor, operatingHours);
    summary.wastedEnergy += estimate.wasteKwh;
    summary.financialLoss += estimate.cost;
    summary.carbonFootprint += estimate.carbon;
    summary.efficiencyTotal += operatingHours > 0 ? Math.min(100, (estimate.scheduledHours / operatingHours) * 100) : 0;
    return summary;
  }, { wastedEnergy: 0, financialLoss: 0, carbonFootprint: 0, efficiencyTotal: 0 });

  return {
    total_rooms_analyzed: rooms.length,
    campus_wasted_energy_kwh: Number(totals.wastedEnergy.toFixed(2)),
    campus_financial_loss_inr: Number(totals.financialLoss.toFixed(2)),
    campus_carbon_footprint_kg: Number(totals.carbonFootprint.toFixed(2)),
    campus_efficiency_score: rooms.length ? Number((totals.efficiencyTotal / rooms.length).toFixed(1)) : 0,
  };
}
