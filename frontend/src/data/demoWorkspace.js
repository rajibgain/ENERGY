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

export const DEMO_ROOMS = [
  {
    id: 901,
    name: 'Engineering Labs',
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
    block: 'Innovation Block · North Campus',
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

export function calculateDemoDashboard(rooms, organization) {
  return calculateWorkspaceDashboard(rooms, organization);
}

