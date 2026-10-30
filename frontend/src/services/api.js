import axios from 'axios';

const localApiHost = typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'localhost' : '127.0.0.1';
const configuredApiRoot = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, '');
const API_ROOT = configuredApiRoot || (import.meta.env.DEV ? `http://${localApiHost}:8000` : '');
export const API_BASE = `${API_ROOT}/api/v1`;

const apiNotConfiguredError = () => Object.assign(
  new Error('The workspace API is not configured for this deployment.'),
  { code: 'API_NOT_CONFIGURED' },
);

const API = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  if (!API_ROOT) throw apiNotConfiguredError();
  return config;
});

export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.detail || (error?.code === 'API_NOT_CONFIGURED' ? 'Account workspaces are not configured on this site. Explore the demo or contact the administrator.' : error?.code === 'ERR_NETWORK' ? 'The workspace service is unavailable. Start the API and try again.' : fallback);

export const checkBackendHealth = async () => {
  if (!API_ROOT) throw apiNotConfiguredError();
  return (await axios.get(`${API_ROOT}/`, { timeout: 5000 })).data;
};
export const signUp = async (payload) => (await API.post('/auth/register', payload)).data;
export const signInWithGoogle = async (credential) => (await API.post('/auth/google/login', { credential })).data;
export const signUpWithGoogle = async (payload) => (await API.post('/auth/google/register', payload)).data;
export const askEnergyAdvisor = async (payload) => (await API.post('/advisor/chat', payload, { timeout: 45000 })).data;
export const acceptInvitation = async (payload) => (await API.post('/auth/register-invitation', payload)).data;
export const signIn = async (payload) => (await API.post('/auth/login', payload)).data;
export const signOut = async () => API.post('/auth/logout');
export const fetchSession = async () => (await API.get('/auth/me')).data;
export const updateOrganization = async (payload) => (await API.patch('/auth/organization', payload)).data;
export const fetchMembers = async () => (await API.get('/auth/members')).data;
export const fetchInvitations = async () => (await API.get('/auth/invitations')).data;
export const createInvitation = async (payload) => (await API.post('/auth/invitations', payload)).data;
export const revokeInvitation = async (id) => API.delete(`/auth/invitations/${id}`);
export const updateMember = async (id, payload) => (await API.patch(`/auth/members/${id}`, payload)).data;
export const suspendMember = async (id) => (await API.delete(`/auth/members/${id}`)).data;

export const fetchCampusDashboard = async (organization = {}) => (await API.get('/campus-dashboard/', { params: {
  tariff_rate: organization.tariffRate,
  carbon_factor: organization.carbonFactor,
  operating_hours: organization.operatingHours,
} })).data;
export const fetchRooms = async () => (await API.get('/rooms/')).data;
export const createRoom = async (payload) => (await API.post('/rooms/', payload)).data;
export const fetchSites = async () => (await API.get('/sites/')).data;
export const createSite = async (payload) => (await API.post('/sites/', payload)).data;
export const updateSite = async (id, payload) => (await API.patch(`/sites/${id}/`, payload)).data;
export const uploadSiteSchematic = async (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return (await API.post(`/sites/${id}/schematic/`, formData)).data;
};
export const fetchSiteSchematic = async (id) => (await API.get(`/sites/${id}/schematic/`, { responseType: 'blob' })).data;
export const clearSiteSchematic = async (id) => (await API.delete(`/sites/${id}/schematic/`)).data;
export const moveRoomToSite = async (roomId, siteId) => (await API.patch(`/rooms/${roomId}/site/`, { site_id: siteId })).data;
export const fetchRoomAnalysis = async (roomId, organization = {}) => (await API.get(`/rooms/${roomId}/waste-analysis/`, { params: {
  tariff_rate: organization.tariffRate,
  carbon_factor: organization.carbonFactor,
  operating_hours: organization.operatingHours,
} })).data;
export const uploadScheduleCSV = async (roomId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return (await API.post(`/rooms/${roomId}/schedules/upload/`, formData)).data;
};

const mapBill = (bill) => ({
  id: bill.id,
  biller: bill.biller,
  state: bill.state,
  site: bill.site,
  reference: bill.reference,
  amount: bill.amount,
  dueDate: bill.due_date,
  status: bill.status,
  paidDate: bill.paid_date,
  paymentReference: bill.payment_reference,
});
export const fetchBillRecords = async () => (await API.get('/bill-records/')).data.map(mapBill);
export const createBillRecord = async (payload) => mapBill((await API.post('/bill-records/', {
  biller: payload.biller,
  state: payload.state,
  site: payload.site,
  reference: payload.reference,
  amount: Number(payload.amount),
  due_date: payload.dueDate,
})).data);
export const recordBillPayment = async (id, paymentReference) => mapBill((await API.put(`/bill-records/${id}/payment`, { payment_reference: paymentReference })).data);
export const archiveBillRecord = async (id) => mapBill((await API.patch(`/bill-records/${id}`, { status: 'void' })).data);

export default API;
