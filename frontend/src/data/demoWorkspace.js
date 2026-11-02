import { calculateWorkspaceDashboard } from '../utils/energyModel';

const localDate = (offsetDays = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + offsetDays);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DEMO_SESSION = {
  isDemo: true,
  role: 'owner',
  user: { id: 9001, email: 'demo@syncspace.local', full_name: 'Aarav Mehta' },
  organization: {
    id: 9001,
    name: 'Northstar Institute of Technology',
    organization_type: 'Education',
    state: 'West Bengal',
    tariff_rate: 8.5,
    carbon_factor: 0.82,
    operating_hours: 12,
    bbps_partner: 'Setu',
    payment_portal_url: '',
  },
};

export const DEMO_SITES = [
  {
    id: 9501,
    name: 'North Campus',
    address: 'Illustrative campus location',
    city: 'Kharagpur',
    state: 'West Bengal',
    latitude: 22.3149,
    longitude: 87.3105,
    has_schematic: false,
    schematic_filename: null,
  },
  {
    id: 9502,
    name: 'City Innovation Centre',
    address: 'Illustrative city location',
    city: 'Kolkata',
    state: 'West Bengal',
    latitude: 22.5726,
    longitude: 88.3639,
    has_schematic: false,
    schematic_filename: null,
  },
];

export const DEMO_ROOMS = [
  {
    id: 901,
    name: 'Engineering Labs',
    site_id: 9501,
    block: 'Innovation Block · North Campus',
    appliances: [
      { id: 9011, name: 'Split AC units · 6', power_watts: 24000 },
      { id: 9012, name: 'Workstation cluster · 32', power_watts: 18400 },
      { id: 9013, name: 'Laboratory lighting', power_watts: 5200 },
    ],
    schedules: [{ id: 9101, day_of_week: 'Everyday', start_time: '09:00:00', end_time: '17:00:00' }],
  },
  {
    id: 902,
    name: 'Library & Learning Commons',
    site_id: 9501,
    block: 'Knowledge Block · North Campus',
    appliances: [
      { id: 9021, name: 'Central air conditioning', power_watts: 18500 },
      { id: 9022, name: 'Lighting circuits', power_watts: 7200 },
      { id: 9023, name: 'Public workstations', power_watts: 5600 },
    ],
    schedules: [{ id: 9102, day_of_week: 'Everyday', start_time: '08:00:00', end_time: '21:00:00' }],
  },
  {
    id: 903,
    name: 'Central HVAC Plant',
    site_id: 9501,
    block: 'Utilities Yard · North Campus',
    appliances: [
      { id: 9031, name: 'Chiller plant', power_watts: 54000 },
      { id: 9032, name: 'Primary water pumps', power_watts: 18000 },
      { id: 9033, name: 'Ventilation fans', power_watts: 12500 },
    ],
    schedules: [{ id: 9103, day_of_week: 'Everyday', start_time: '07:00:00', end_time: '21:00:00' }],
  },
  {
    id: 904,
    name: 'Administration Building',
    site_id: 9501,
    block: 'Civic Block · North Campus',
    appliances: [
      { id: 9041, name: 'Office air conditioning', power_watts: 11500 },
      { id: 9042, name: 'Desktop computers', power_watts: 5800 },
      { id: 9043, name: 'Lighting', power_watts: 2400 },
    ],
    schedules: [{ id: 9104, day_of_week: 'Everyday', start_time: '09:00:00', end_time: '17:00:00' }],
  },
  {
    id: 905,
    name: 'Auditorium',
    site_id: 9501,
    block: 'Arts & Events Block · North Campus',
    appliances: [
      { id: 9051, name: 'Stage and house lighting', power_watts: 9200 },
      { id: 9052, name: 'Air conditioning', power_watts: 24800 },
      { id: 9053, name: 'Audio and projection', power_watts: 6000 },
    ],
    schedules: [
      { id: 9105, day_of_week: 'Friday', start_time: '16:00:00', end_time: '21:00:00' },
      { id: 9106, day_of_week: 'Saturday', start_time: '10:00:00', end_time: '16:00:00' },
    ],
  },
  {
    id: 906,
    name: 'Dining Hall',
    site_id: 9501,
    block: 'Commons Block · North Campus',
    appliances: [
      { id: 9061, name: 'Kitchen equipment', power_watts: 10000 },
      { id: 9062, name: 'Dining area cooling', power_watts: 7500 },
      { id: 9063, name: 'Lighting', power_watts: 2000 },
    ],
    schedules: [{ id: 9107, day_of_week: 'Everyday', start_time: '07:00:00', end_time: '20:00:00' }],
  },
  {
    id: 907,
    name: 'Digital Research Centre',
    site_id: 9502,
    block: 'Digital Block · City Innovation Centre',
    appliances: [
      { id: 9071, name: 'Server racks', power_watts: 11000 },
      { id: 9072, name: 'Cooling and ventilation', power_watts: 8000 },
    ],
    schedules: [{ id: 9108, day_of_week: 'Everyday', start_time: '00:00:00', end_time: '23:59:00' }],
  },
];

export const DEMO_BILLS = [
  {
    id: 9201,
    biller: 'West Bengal State Electricity Distribution Company Limited (WBSEDCL)',
    state: 'West Bengal',
    site: 'North Campus',
    reference: 'WB-••••-4821',
    amount: 86420,
    dueDate: localDate(9),
    status: 'due',
    paidDate: null,
    paymentReference: null,
  },
  {
    id: 9202,
    biller: 'CESC Limited',
    state: 'West Bengal',
    site: 'City Innovation Centre',
    reference: 'CE-••••-1730',
    amount: 74230,
    dueDate: localDate(-12),
    status: 'paid',
    paidDate: localDate(-15),
    paymentReference: 'DEMO-TXN-64018',
  },
];

export const DEMO_TEAM = [
  { id: 9301, role: 'owner', is_active: true, user: DEMO_SESSION.user, created_at: localDate(-90) },
  { id: 9302, role: 'manager', is_active: true, user: { id: 9302, email: 'priya@northstar.example', full_name: 'Priya Sen' }, created_at: localDate(-45) },
  { id: 9303, role: 'staff', is_active: true, user: { id: 9303, email: 'kabir@northstar.example', full_name: 'Kabir Das' }, created_at: localDate(-21) },
];

export const DEMO_APPLIANCE_TEMPLATES = [
  { id: 1, name: '1.5-ton Split AC', category: 'HVAC', power_watts: 1500, load_factor: 0.6, standby_watts: 15 },
  { id: 2, name: '2-ton Split AC', category: 'HVAC', power_watts: 2000, load_factor: 0.6, standby_watts: 20 },
  { id: 3, name: 'Window AC 1.5-ton', category: 'HVAC', power_watts: 1800, load_factor: 0.65, standby_watts: 12 },
  { id: 4, name: 'Standard Ceiling Fan', category: 'Fan', power_watts: 75, load_factor: 0.8, standby_watts: 0 },
  { id: 5, name: 'BEE 5-Star Ceiling Fan', category: 'Fan', power_watts: 35, load_factor: 0.8, standby_watts: 0 },
  { id: 6, name: '40W Tube Light', category: 'Lighting', power_watts: 40, load_factor: 1.0, standby_watts: 0 },
  { id: 7, name: 'LED Tube Light 20W', category: 'Lighting', power_watts: 20, load_factor: 1.0, standby_watts: 0 },
  { id: 8, name: 'LED Panel 40W', category: 'Lighting', power_watts: 40, load_factor: 1.0, standby_watts: 0 },
  { id: 9, name: 'Desktop Computer', category: 'IT', power_watts: 200, load_factor: 0.5, standby_watts: 5 },
  { id: 10, name: 'Water Cooler', category: 'Kitchen', power_watts: 150, load_factor: 0.4, standby_watts: 5 },
];

export const DEMO_TASKS = [
  {
    id: 801,
    title: 'Install digital timer on Auditorium chiller',
    description: 'Avoidable idle runtime observed on weekends. Retrofit weekly programmable controller.',
    assigned_to: 'Priya Sen',
    due_date: localDate(14),
    status: 'open',
    priority: 'high',
    room_id: 905,
    before_reading_kwh: null,
    after_reading_kwh: null,
    verified_savings_kwh: null,
    verified_savings_inr: null,
    created_at: localDate(-5),
  },
  {
    id: 802,
    title: 'LED retrofit across Engineering Labs',
    description: 'Replaced 40W magnetic fluorescent fixtures with 20W electronic LED batten units.',
    assigned_to: 'Kabir Das',
    due_date: localDate(-10),
    status: 'completed',
    priority: 'medium',
    room_id: 901,
    before_reading_kwh: 5400,
    after_reading_kwh: 3100,
    verified_savings_kwh: 2300,
    verified_savings_inr: 19550,
    completed_at: localDate(-8),
    created_at: localDate(-30),
  },
];

export const DEMO_METER_SUMMARY = {
  monthly_data: [
    { period: '2026-08', modeled_kwh: 24800, measured_kwh: 26150, difference_kwh: -1350, difference_pct: -5.4 },
    { period: '2026-09', modeled_kwh: 24800, measured_kwh: 25400, difference_kwh: -600, difference_pct: -2.4 },
    { period: '2026-10', modeled_kwh: 24800, measured_kwh: 23900, difference_kwh: 900, difference_pct: 3.6 },
  ],
  total_modeled_kwh: 74400,
  total_measured_kwh: 75450,
  net_gap_kwh: -1050,
};

export const DEMO_BILL_TRENDS = [
  { month: '2026-07', total_amount: 142000, bill_count: 2, avg_amount: 71000, rolling_avg: null, is_anomaly: false },
  { month: '2026-08', total_amount: 148500, bill_count: 2, avg_amount: 74250, rolling_avg: null, is_anomaly: false },
  { month: '2026-09', total_amount: 145000, bill_count: 2, avg_amount: 72500, rolling_avg: null, is_anomaly: false },
  { month: '2026-10', total_amount: 198000, bill_count: 2, avg_amount: 99000, rolling_avg: 145166.7, is_anomaly: true },
];

export const DEMO_FORECAST = {
  historical_months: [
    { month: '2026-07', amount: 142000 },
    { month: '2026-08', amount: 148500 },
    { month: '2026-09', amount: 145000 },
    { month: '2026-10', amount: 198000 },
  ],
  predicted_month: '2026-11',
  predicted_amount: 184500,
  predicted_kwh: 21705,
  confidence_r2: 0.81,
  trend: 'increasing',
};

export function calculateDemoDashboard(rooms, organization) {
  return calculateWorkspaceDashboard(rooms, organization);
}

