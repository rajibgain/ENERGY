import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Building2, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, CircleHelp,
  Clock3, CreditCard, Download, ExternalLink, FileDown, FileText, Leaf,
  MapPin, MoreHorizontal, Plus, RefreshCw, Search, ShieldCheck, Sun,
  UploadCloud, X, Zap, Users, LogOut, Copy, UserPlus,
} from 'lucide-react';
import { archiveBillRecord, createBillRecord, createInvitation, errorMessage, fetchInvitations, fetchMembers, fetchRoomAnalysis, recordBillPayment, revokeInvitation, suspendMember, updateMember, uploadScheduleCSV } from '../services/api';
import { ELECTRICITY_DIRECTORY_SOURCES, INDIAN_STATES, STATE_ELECTRICITY_PROVIDERS } from '../data/electricityProviders';
import { DEMO_TEAM } from '../data/demoWorkspace';
import { roomEstimate, timeToMinutes } from '../utils/energyModel';

const NAV = [
  { id: 'overview', label: 'Overview', number: '01' },
  { id: 'performance', label: 'Energy profile', number: '02' },
  { id: 'zones', label: 'Zones', number: '03' },
  { id: 'imports', label: 'Schedule import', number: '04' },
  { id: 'bills', label: 'Bill payments', number: '05' },
];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ORGANIZATION_TYPES = ['Company', 'Commercial office', 'Education', 'Healthcare', 'Manufacturing', 'Retail', 'Hospitality', 'Logistics', 'Property portfolio', 'Public sector', 'Nonprofit', 'Other'];
function number(value, digits = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

function scheduleForDay(schedule, day) {
  const scheduledDay = String(schedule.day_of_week || '').trim().toLowerCase();
  return scheduledDay === day.toLowerCase() || scheduledDay === 'everyday' || scheduledDay === 'daily' || scheduledDay === 'all days';
}

function buildProfile(rooms, mode) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const days = mode === 'week' ? WEEKDAYS : [today];
  const capacity = rooms.reduce((total, room) => total + roomEstimate(room).connectedKw, 0);
  const points = Array.from({ length: 25 }, (_, hour) => {
    let scheduledKw = 0;
    for (const day of days) {
      for (const room of rooms) {
        const roomKw = roomEstimate(room).connectedKw;
        let activeMinutes = 0;
        for (const schedule of room.schedules || []) {
          if (!scheduleForDay(schedule, day)) continue;
          activeMinutes += Math.max(0, Math.min((hour + 1) * 60, timeToMinutes(schedule.end_time)) - Math.max(hour * 60, timeToMinutes(schedule.start_time)));
        }
        scheduledKw += roomKw * Math.min(60, activeMinutes) / 60;
      }
    }
    return { hour, load: scheduledKw / days.length };
  });
  return { points, capacity, hasSchedules: rooms.some((room) => (room.schedules || []).length > 0) };
}

function makeLine(points, valueKey, chart) {
  const { left, top, width, height, max } = chart;
  return points.map((point, index) => {
    const x = left + (index / (points.length - 1)) * width;
    const y = top + height - (point[valueKey] / max) * height;
    return (index === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => '"' + String(value ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ScheduleChart({ profile, mode, onModeChange }) {
  const [hover, setHover] = useState(null);
  const chart = { left: 48, top: 18, width: 642, height: 166, max: Math.max(1, profile.capacity) };
  const line = makeLine(profile.points, 'load', chart);
  const area = line + ' L' + (chart.left + chart.width) + ',' + (chart.top + chart.height) + ' L' + chart.left + ',' + (chart.top + chart.height) + ' Z';
  const yFor = (value) => chart.top + chart.height - (value / chart.max) * chart.height;

  const handlePointer = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - bounds.left) / bounds.width) * 720;
    const selected = Math.max(0, Math.min(24, Math.round(((viewX - chart.left) / chart.width) * 24)));
    setHover(selected);
  };

  return (
    <section className="ss-card ss-profile" id="performance" data-section>
      <div className="ss-card-heading">
        <div>
          <div className="ss-kicker"><span className="ss-kicker-dot" /> ENERGY MODEL</div>
          <h2>Schedule profile</h2>
          <p>Expected demand from facility schedules and connected equipment.</p>
        </div>
        <label className="ss-select-wrap" aria-label="Profile time period">
          <select value={mode} onChange={(event) => { onModeChange(event.target.value); setHover(null); }}>
            <option value="today">Today</option>
            <option value="week">Week average</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>
      </div>
      {!profile.hasSchedules ? (
        <div className="ss-chart-empty">
          <div className="ss-empty-mark"><Activity size={21} /></div>
          <strong>Timetables will bring this profile to life.</strong>
          <span>Upload an operating schedule to see expected hourly demand here.</span>
        </div>
      ) : (
        <>
          <div className="ss-chart-wrap" onPointerMove={handlePointer} onPointerLeave={() => setHover(null)}>
            <svg className="ss-chart" viewBox="0 0 720 224" role="img" aria-label="Estimated scheduled electrical load across the day">
              <defs>
                <linearGradient id="ss-load-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#a7d65c" stopOpacity=".28" />
                  <stop offset="100%" stopColor="#a7d65c" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((step) => {
                const value = (profile.capacity * step) / 3;
                const y = yFor(value);
                return <g key={step}><line x1={chart.left} x2={chart.left + chart.width} y1={y} y2={y} className="ss-grid-line" /><text x="0" y={y + 4} className="ss-axis-label">{number(value, 0)} kW</text></g>;
              })}
              <path d={area} fill="url(#ss-load-fill)" />
              <line x1={chart.left} x2={chart.left + chart.width} y1={yFor(profile.capacity)} y2={yFor(profile.capacity)} className="ss-capacity-line" />
              <path d={line} className="ss-load-line" />
              {profile.points.map((point, index) => {
                if (index % 2 !== 0 && index !== 24) return null;
                const x = chart.left + (index / 24) * chart.width;
                const y = yFor(point.load);
                return <circle key={point.hour} cx={x} cy={y} r={hover === index ? 5 : 2.6} className="ss-chart-point"><title>{String(index).padStart(2, '0')}:00 — {number(point.load, 1)} kW scheduled</title></circle>;
              })}
              {[0, 6, 12, 18, 24].map((hour) => <text key={hour} x={chart.left + (hour / 24) * chart.width} y="218" textAnchor={hour === 0 ? 'start' : hour === 24 ? 'end' : 'middle'} className="ss-axis-label">{String(hour).padStart(2, '0')}:00</text>)}
              {hover != null && <line x1={chart.left + (hover / 24) * chart.width} x2={chart.left + (hover / 24) * chart.width} y1={chart.top} y2={chart.top + chart.height} className="ss-hover-line" />}
            </svg>
            {hover != null && <div className="ss-chart-readout"><span>{String(hover).padStart(2, '0')}:00</span><strong>{number(profile.points[hover].load, 2)} kW</strong><small>scheduled load</small></div>}
          </div>
          <div className="ss-chart-legend"><span><i className="ss-legend-load" /> Scheduled load</span><span><i className="ss-legend-capacity" /> Installed capacity</span><small>Modelled from schedules · not meter readings</small></div>
        </>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value, unit, detail }) {
  return (
    <article className="ss-metric ss-card">
      <div className="ss-metric-top"><span className="ss-metric-icon"><Icon size={16} strokeWidth={1.7} /></span><span className="ss-metric-label">{label}</span><MoreHorizontal size={16} className="ss-muted-icon" aria-hidden="true" /></div>
      <div className="ss-metric-value">{value}<span>{unit}</span></div>
      <p className="ss-metric-detail">{detail}</p>
    </article>
  );
}

export default function EnergyWorkspace({ dashboard, rooms, billRecords, setBillRecords, isOnline, isDemo, refreshing, lastUpdated, dataError, onRefresh, organization, onOrganizationChange, user, role, onLogout }) {
  const canManageWorkspace = role === 'owner' || role === 'admin';
  const canManageFacilities = role !== 'staff';
  const canViewBills = role !== 'staff';
  const visibleNav = NAV.filter((item) => (item.id !== 'imports' || canManageFacilities) && (item.id !== 'bills' || canViewBills));
  const [activeSection, setActiveSection] = useState('overview');
  const [profileMode, setProfileMode] = useState('today');
  const [search, setSearch] = useState('');
  const [needsAttention, setNeedsAttention] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomAnalysis, setRoomAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importRoomId, setImportRoomId] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState('');
  const [organizationModal, setOrganizationModal] = useState(false);
  const [organizationDraft, setOrganizationDraft] = useState(organization);
  const [billModal, setBillModal] = useState('');
  const [editingBill, setEditingBill] = useState(null);
  const [newBill, setNewBill] = useState({ biller: '', providerKey: '', customBiller: '', state: organization.state || 'Maharashtra', site: '', reference: '', amount: '', dueDate: '' });
  const [paymentReference, setPaymentReference] = useState('');
  const [bbpsPartner, setBbpsPartner] = useState(organization.bbpsPartner || 'Setu');
  const [paymentPortalUrl, setPaymentPortalUrl] = useState(organization.paymentPortalUrl || '');
  const [portalDraft, setPortalDraft] = useState(organization.paymentPortalUrl || '');
  const [billFilter, setBillFilter] = useState('all');
  const [teamModal, setTeamModal] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamInvitations, setTeamInvitations] = useState([]);
  const [inviteDraft, setInviteDraft] = useState({ email: '', role: 'staff' });
  const [inviteLink, setInviteLink] = useState('');
  const [teamError, setTeamError] = useState('');
  const [teamBusy, setTeamBusy] = useState(false);
  const fileRef = useRef(null);
  const searchInputRef = useRef(null);

  const profile = useMemo(() => buildProfile(rooms, profileMode), [rooms, profileMode]);
  const rankedRooms = useMemo(() => rooms.map((room) => ({ ...room, estimate: roomEstimate(room, organization.tariffRate, organization.carbonFactor, organization.operatingHours) })).sort((a, b) => b.estimate.wasteKwh - a.estimate.wasteKwh), [rooms, organization]);
  const actionOpportunities = rankedRooms.filter((room) => room.estimate.wasteKwh > 0).slice(0, 3);
  const filteredRooms = useMemo(() => rooms.filter((room) => {
    const matchesText = (room.name + ' ' + room.block).toLowerCase().includes(search.trim().toLowerCase());
    const hasGap = roomEstimate(room, organization.tariffRate, organization.carbonFactor, organization.operatingHours).idleHours > 0 || !(room.schedules || []).length;
    return matchesText && (!needsAttention || hasGap);
  }), [rooms, search, needsAttention, organization]);
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const score = Number(dashboard?.campus_efficiency_score || 0);
  const scoreAngle = Math.max(0, Math.min(100, score)) * 3.6;
  const dueBills = billRecords.filter((bill) => bill.status === 'due');
  const dueTotal = dueBills.reduce((total, bill) => total + Number(bill.amount || 0), 0);
  const visibleBills = billRecords.filter((bill) => billFilter === 'all' || (billFilter === 'archived' ? bill.status === 'void' : bill.status === billFilter)).sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
  const stateProviders = STATE_ELECTRICITY_PROVIDERS[newBill.state] || [];
  const selectedProvider = stateProviders.find((provider) => provider.id === newBill.providerKey);

  useEffect(() => {
    setOrganizationDraft(organization);
    setBbpsPartner(organization.bbpsPartner || 'Setu');
    setPaymentPortalUrl(organization.paymentPortalUrl || '');
    setPortalDraft(organization.paymentPortalUrl || '');
  }, [organization.id, organization.name, organization.type, organization.state, organization.tariffRate, organization.carbonFactor, organization.operatingHours, organization.bbpsPartner, organization.paymentPortalUrl]);

  useEffect(() => {
    const sections = NAV.map(({ id }) => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-20% 0px -62% 0px', threshold: [0, 0.1, 0.35, 0.6] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleShortcut = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !['input', 'textarea', 'select'].includes(tag)) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape' && selectedRoom) {
        setSelectedRoom(null);
        setRoomAnalysis(null);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [selectedRoom]);

  const goToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveSection(id);
  };

  const exportRooms = () => {
    const rows = [['Zone', 'Building', 'Connected load (kW)', 'Scheduled hours', `Idle hours (${organization.operatingHours}h baseline)`, 'Estimated waste (kWh/day)', `Estimated cost (INR/day at ${organization.tariffRate}/kWh)`, 'Estimated carbon (kg/day)']];
    for (const room of rooms) {
      const estimate = roomEstimate(room, organization.tariffRate, organization.carbonFactor, organization.operatingHours);
      rows.push([room.name, room.block, number(estimate.connectedKw, 2), number(estimate.scheduledHours, 2), number(estimate.idleHours, 2), number(estimate.wasteKwh, 2), number(estimate.cost, 2), number(estimate.carbon, 2)]);
    }
    downloadCsv('syncspace-energy-estimates.csv', rows);
    setToast('Energy estimates exported.');
  };

  const downloadTemplate = () => {
    downloadCsv('syncspace-schedule-template.csv', [['day_of_week', 'start_time', 'end_time'], ['Monday', '09:00', '11:00'], ['Wednesday', '13:00', '15:00']]);
    setToast('Schedule template downloaded.');
  };

  const acceptFile = async (nextFile) => {
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      setFile(null);
      setToast('Choose a .csv file to continue.');
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setFile(null);
      setToast('This file is larger than 10 MB. Choose a smaller CSV.');
      return;
    }
    try {
      const firstLine = (await nextFile.slice(0, 4096).text()).replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].toLowerCase();
      const columns = firstLine.split(',').map((column) => column.trim().replaceAll('"', ''));
      if (!['day_of_week', 'start_time', 'end_time'].every((column) => columns.includes(column))) {
        setFile(null);
        setToast('CSV needs day_of_week, start_time and end_time columns.');
        return;
      }
      setFile(nextFile);
    } catch {
      setFile(null);
      setToast('This CSV could not be read. Try saving it as UTF-8.');
    }
  };

  const submitSchedule = async (event) => {
    event.preventDefault();
    if (isDemo) return setToast('Schedule uploads need the live workspace API. This sample workspace is read-only.');
    if (!isOnline) return setToast('Connect the workspace API before uploading a schedule.');
    if (!importRoomId) return setToast('Choose a zone for this schedule.');
    if (!file) return setToast('Choose a CSV file to upload.');
    setUploading(true);
    try {
      const response = await uploadScheduleCSV(importRoomId, file);
      setToast(response.message || 'Schedule added to the selected zone.');
      setFile(null);
      setImportRoomId('');
      if (fileRef.current) fileRef.current.value = '';
      await onRefresh();
    } catch (error) {
      setToast(error.response?.data?.detail || 'Upload failed. Check the file format and try again.');
    } finally {
      setUploading(false);
    }
  };

  const analyzeRoom = async () => {
    if (!selectedRoom) return;
    setAnalyzing(true);
    try {
      const estimate = isDemo ? roomEstimate(selectedRoom, organization.tariffRate, organization.carbonFactor, organization.operatingHours) : await fetchRoomAnalysis(selectedRoom.id, organization);
      setRoomAnalysis(estimate);
    } catch {
      setToast('Could not calculate this zone right now. Refresh and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveOrganization = async (event) => {
    event.preventDefault();
    const next = { ...organizationDraft, tariffRate: Number(organizationDraft.tariffRate), carbonFactor: Number(organizationDraft.carbonFactor), operatingHours: Number(organizationDraft.operatingHours) };
    try {
      await onOrganizationChange(next);
      setOrganizationModal(false);
      setToast('Workspace profile updated. Estimates are recalculating.');
    } catch (error) {
      setToast(errorMessage(error, 'Could not update the workspace profile.'));
    }
  };

  const addBillRecord = async (event) => {
    event.preventDefault();
    const providerName = newBill.providerKey === '__other' ? newBill.customBiller.trim() : selectedProvider?.name;
    if (!providerName || !newBill.amount || Number(newBill.amount) <= 0 || !newBill.dueDate) {
      setToast('Choose a provider, add a positive amount, and choose the due date.');
      return;
    }
    try {
      const payload = { ...newBill, biller: providerName, reference: newBill.reference.trim() || '—', site: newBill.site.trim() || 'Portfolio' };
      const created = isDemo
        ? { id: Date.now(), biller: payload.biller, state: payload.state, site: payload.site, reference: payload.reference, amount: Number(payload.amount), dueDate: payload.dueDate, status: 'due', paidDate: null, paymentReference: null }
        : await createBillRecord(payload);
      setBillRecords((current) => [created, ...current]);
      setNewBill({ biller: '', providerKey: '', customBiller: '', state: organization.state || 'Maharashtra', site: '', reference: '', amount: '', dueDate: '' });
      setBillModal('');
      setToast('Bill record added to this organization’s ledger.');
    } catch (error) {
      setToast(errorMessage(error, 'Could not add this bill record.'));
    }
  };

  const recordExternalPayment = async (event) => {
    event.preventDefault();
    if (!editingBill || !paymentReference.trim()) {
      setToast('Add the transaction reference from your provider.');
      return;
    }
    try {
      const updated = isDemo
        ? { ...editingBill, status: 'paid', paidDate: new Date().toISOString().slice(0, 10), paymentReference: paymentReference.trim() }
        : await recordBillPayment(editingBill.id, paymentReference.trim());
      setBillRecords((current) => current.map((bill) => bill.id === editingBill.id ? updated : bill));
      setBillModal('');
      setEditingBill(null);
      setPaymentReference('');
      setToast('Payment record updated. SyncSpace did not initiate the payment.');
    } catch (error) {
      setToast(errorMessage(error, 'Could not save this payment record.'));
    }
  };

  const archiveRecord = async (bill) => {
    if (!window.confirm(`Archive the bill record for ${bill.biller}?`)) return;
    try {
      const updated = isDemo ? { ...bill, status: 'void' } : await archiveBillRecord(bill.id);
      setBillRecords((current) => current.map((item) => item.id === bill.id ? updated : item));
      setToast('Bill record archived.');
    } catch (error) {
      setToast(errorMessage(error, 'Could not archive this bill record.'));
    }
  };

  const exportBillRecords = () => {
    const rows = [['Provider', 'State / territory', 'Site', 'Consumer / bill reference', 'Amount (INR)', 'Due date', 'Status', 'Paid date', 'Provider transaction reference']];
    for (const bill of billRecords) rows.push([bill.biller, bill.state, bill.site, bill.reference, bill.amount, bill.dueDate, bill.status, bill.paidDate || '', bill.paymentReference || '']);
    downloadCsv('syncspace-electricity-records.csv', rows);
    setToast('Electricity records exported.');
  };

  const openPaymentRecord = (bill) => {
    setEditingBill(bill);
    setPaymentReference('');
    setBillModal('payment');
  };

  const openProviderPortal = () => {
    if (!paymentPortalUrl) {
      setPortalDraft('');
      setBillModal('bbps');
      return;
    }
    window.open(paymentPortalUrl, '_blank', 'noopener,noreferrer');
  };

  const saveBbpsSetup = async () => {
    const portal = portalDraft.trim();
    if (portal) {
      try {
        const parsed = new URL(portal);
        if (parsed.protocol !== 'https:') throw new Error('HTTPS required');
      } catch {
        setToast('Enter a valid HTTPS bill-pay portal link supplied by your provider.');
        return;
      }
    }
    try {
      await onOrganizationChange({ ...organization, bbpsPartner, paymentPortalUrl: portal });
      setPaymentPortalUrl(portal);
      setBillModal('');
      setToast(portal ? `${bbpsPartner} portal saved for this organization.` : `${bbpsPartner} saved as the preferred partner.`);
    } catch (error) {
      setToast(errorMessage(error, 'Could not save the provider configuration.'));
    }
  };

  const loadTeam = async () => {
    setTeamLoading(true);
    setTeamError('');
    if (isDemo) {
      setTeamMembers(DEMO_TEAM);
      setTeamInvitations([]);
      setTeamLoading(false);
      return;
    }
    try {
      const [members, invitations] = await Promise.all([fetchMembers(), fetchInvitations()]);
      setTeamMembers(members);
      setTeamInvitations(invitations);
    } catch (error) {
      setTeamError(errorMessage(error, 'Could not load team access.'));
    } finally {
      setTeamLoading(false);
    }
  };

  const openTeam = async () => {
    setTeamModal(true);
    setInviteLink('');
    await loadTeam();
  };

  const inviteTeamMember = async (event) => {
    event.preventDefault();
    if (isDemo) return setTeamError('Invitations are disabled in the read-only assignment demo.');
    setTeamBusy(true);
    setTeamError('');
    try {
      const invitation = await createInvitation(inviteDraft);
      const link = `${window.location.origin}/?invite=${encodeURIComponent(invitation.token)}`;
      setInviteLink(link);
      setInviteDraft({ email: '', role: 'staff' });
      await loadTeam();
    } catch (error) {
      setTeamError(errorMessage(error, 'Could not create this invitation.'));
    } finally {
      setTeamBusy(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setToast('Invitation link copied. Share it with the invited teammate.');
    } catch {
      setToast('Select and copy the invitation link.');
    }
  };

  const changeMemberRole = async (member, nextRole) => {
    if (isDemo) return setTeamError('Role changes are disabled in the read-only assignment demo.');
    try {
      const changed = await updateMember(member.id, { role: nextRole });
      setTeamMembers((current) => current.map((item) => item.id === changed.id ? changed : item));
    } catch (error) {
      setTeamError(errorMessage(error, 'Could not change this role.'));
    }
  };

  const removeMember = async (member) => {
    if (isDemo) return setTeamError('Member changes are disabled in the read-only assignment demo.');
    if (!window.confirm(`Remove ${member.user.full_name} from this workspace?`)) return;
    try {
      const changed = await suspendMember(member.id);
      setTeamMembers((current) => current.map((item) => item.id === changed.id ? changed : item));
    } catch (error) {
      setTeamError(errorMessage(error, 'Could not remove this team member.'));
    }
  };

  const cancelInvitation = async (invitation) => {
    if (isDemo) return setTeamError('Invitation changes are disabled in the read-only assignment demo.');
    try {
      await revokeInvitation(invitation.id);
      setTeamInvitations((current) => current.filter((item) => item.id !== invitation.id));
    } catch (error) {
      setTeamError(errorMessage(error, 'Could not revoke this invitation.'));
    }
  };

  return (
    <div className="ss-app">
      <aside className="ss-sidebar">
        <button className="ss-brand" onClick={() => goToSection('overview')} aria-label="SyncSpace home">
          <span className="ss-brand-mark"><Zap size={17} fill="currentColor" /></span>
          <span><strong>syncspace</strong><small>Energy intelligence</small></span>
        </button>
        <div className="ss-side-label">WORKSPACE</div>
        <nav className="ss-navigation" aria-label="Main navigation">
          {visibleNav.map((item) => <button key={item.id} className={'ss-nav-item' + (activeSection === item.id ? ' is-active' : '')} onClick={() => goToSection(item.id)} aria-current={activeSection === item.id ? 'page' : undefined}>
            <span className="ss-nav-number">{item.number}</span><span>{item.label}</span><ChevronRight size={14} />
          </button>)}
        </nav>
        <div className="ss-sidebar-bottom">
          <div className="ss-mission-card"><span className="ss-mission-icon"><Leaf size={14} /></span><span className="ss-side-label">THE MISSION</span><p>Make every watt work harder.</p><span className="ss-mission-index">One connected view, across every site.</span><button className="ss-mission-method" onClick={() => setMethodologyOpen(true)}>Project method <ArrowRight size={11} /></button></div>
          <button className="ss-profile-chip" onClick={() => canManageWorkspace && (setOrganizationDraft(organization), setOrganizationModal(true))} aria-label={canManageWorkspace ? 'Open workspace settings' : 'Your account'}><span className="ss-avatar">{user.full_name.charAt(0).toUpperCase()}</span><span><strong>{user.full_name}</strong><small>{role} · {organization.name}</small></span><MoreHorizontal size={16} /></button>
        </div>
      </aside>

      <main className="ss-main">
        <header className="ss-topbar">
          <div className="ss-breadcrumb"><span>{organization.name}</span><ChevronDown size={13} /><span className="ss-breadcrumb-sep">/</span><span>Portfolio overview</span></div>
          <div className="ss-topbar-right">
            {canManageWorkspace && <button className="ss-org-switch" onClick={() => { setOrganizationDraft(organization); setOrganizationModal(true); }}><Building2 size={14} /><span>Settings</span></button>}
            {canManageWorkspace && <button className="ss-org-switch" onClick={openTeam}><Users size={14} /><span>Team</span></button>}
            <span className={'ss-connection' + (isOnline ? ' is-online' : '') + (isDemo ? ' is-demo' : '')}><i />{isDemo ? 'DEMO MODE' : isOnline ? 'API connected' : 'Offline'}</span>
            <span className="ss-topbar-divider" />
            <span className="ss-topbar-date">{today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <button className="ss-logout-button" onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={15} /><span>Sign out</span></button>
          </div>
        </header>

        <div className="ss-content">
          <section className="ss-cinematic" id="overview" data-section>
            <div className="ss-cinematic-grain" aria-hidden="true" />
            <div className="ss-cinematic-copy">
              <div className="ss-cinematic-kicker"><span className="ss-cinematic-pulse" /> ENERGY INTELLIGENCE <span>/ INDIA · {organization.state.toUpperCase()}</span></div>
              <p className="ss-cinematic-eyebrow">A clearer view of the places that power your work.</p>
              <h1>Every building<br />holds a <em>signal.</em></h1>
              <p className="ss-cinematic-description">See energy patterns across your {organization.type.toLowerCase()} portfolio. Find the quiet waste. Turn it into a better way to operate.</p>
              <div className="ss-cinematic-actions"><button className="ss-cinematic-cta" onClick={() => goToSection('zones')}>Explore the portfolio <ArrowDownRight size={15} /></button>{canViewBills && <button className="ss-cinematic-link" onClick={() => goToSection('bills')}>Electricity records <ArrowRight size={14} /></button>}</div>
              <div className="ss-cinematic-meta"><span><i />{organization.name}</span><span>{refreshing ? 'Syncing workspace…' : lastUpdated ? 'Updated ' + lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Schedule-based estimates'}<button onClick={onRefresh} disabled={refreshing} aria-label="Refresh workspace data" title="Refresh workspace data" className="ss-cinematic-refresh"><RefreshCw size={12} className={refreshing ? 'ss-spin' : ''} /></button></span></div>
            </div>
            <div className="ss-cinematic-art" aria-hidden="true">
              <div className="ss-cinematic-coordinate ss-coordinate-one">19°04′ N<br />72°52′ E</div>
              <div className="ss-cinematic-coordinate ss-coordinate-two">LIVE MODEL&nbsp; / &nbsp;01</div>
              <svg viewBox="0 0 680 490" className="ss-city-scene" role="presentation">
                <defs>
                  <linearGradient id="ss-city-glow" x1="0" x2="1" y1="1" y2="0"><stop stopColor="#d7ff80" stopOpacity=".12"/><stop offset=".48" stopColor="#d7ff80" stopOpacity=".85"/><stop offset="1" stopColor="#d7ff80" stopOpacity=".08"/></linearGradient>
                  <linearGradient id="ss-glass" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#9cbf91" stopOpacity=".19"/><stop offset="1" stopColor="#101b18" stopOpacity=".04"/></linearGradient>
                  <radialGradient id="ss-city-halo"><stop stopColor="#b8e774" stopOpacity=".2"/><stop offset="1" stopColor="#b8e774" stopOpacity="0"/></radialGradient>
                </defs>
                <ellipse cx="389" cy="269" rx="240" ry="202" fill="url(#ss-city-halo)" />
                <g fill="none" stroke="#dcead3" strokeOpacity=".16" strokeWidth=".8"><path d="M37 386H643M55 407H625M86 428H594M132 449H548M188 469H492"/><path d="m46 386 205 83M151 386l143 83M260 386l83 83M364 386l22 83M480 386l-51 83M587 386l-110 83"/></g>
                <g className="ss-city-buildings" stroke="#dbe8d4" strokeOpacity=".6" strokeWidth="1">
                  <path d="M95 386V233l56-23v176M104 249l39-16M104 268l39-16M104 287l39-16M104 306l39-16M104 325l39-16M104 344l39-16M104 363l39-16" fill="url(#ss-glass)"/>
                  <path d="M180 386V147l85-43v282M193 163l59-30M193 188l59-30M193 213l59-30M193 238l59-30M193 263l59-30M193 288l59-30M193 313l59-30M193 338l59-30M193 363l59-30" fill="url(#ss-glass)"/>
                  <path d="M291 386V207l62-28v207M303 220l39-18M303 241l39-18M303 262l39-18M303 283l39-18M303 304l39-18M303 325l39-18M303 346l39-18M303 367l39-18" fill="url(#ss-glass)"/>
                  <path d="M382 386V112l91 35v239M396 137l62 24M396 164l62 24M396 191l62 24M396 218l62 24M396 245l62 24M396 272l62 24M396 299l62 24M396 326l62 24M396 353l62 24" fill="url(#ss-glass)"/>
                  <path d="M500 386V238l68 20v128M513 257l43 13M513 280l43 13M513 303l43 13M513 326l43 13M513 349l43 13M513 372l43 13" fill="url(#ss-glass)"/>
                </g>
                <g fill="#d9f0ba" opacity=".58"><circle cx="223" cy="99" r="2"/><circle cx="420" cy="88" r="1.5"/><circle cx="542" cy="188" r="1.5"/><circle cx="140" cy="170" r="1.4"/><circle cx="321" cy="129" r="1.7"/></g>
                <path className="ss-energy-thread" d="M49 356C119 356 147 308 208 308s76-58 135-58 71 73 135 73 88-78 150-78" fill="none" stroke="url(#ss-city-glow)" strokeWidth="2"/>
                <path className="ss-energy-thread ss-energy-thread-two" d="M62 367C134 367 148 339 202 339s86-36 143-36 75 42 137 42 89-48 137-48" fill="none" stroke="#c5ec86" strokeOpacity=".3" strokeWidth="1"/>
                <circle className="ss-city-node ss-node-one" cx="208" cy="308" r="4" fill="#d6ff96"/><circle className="ss-city-node ss-node-two" cx="343" cy="250" r="4" fill="#d6ff96"/><circle className="ss-city-node ss-node-three" cx="478" cy="323" r="4" fill="#d6ff96"/>
              </svg>
              <div className="ss-scene-caption"><span>01—05</span><span>BUILDINGS · ONE PORTFOLIO</span><span>ENERGY MODEL</span></div>
              <div className="ss-scene-corner" />
            </div>
          </section>

          {isDemo && <div className="ss-demo-note"><span className="ss-demo-icon"><CircleHelp size={15} /></span><span><strong>College assignment demo</strong> — Northstar campus data is illustrative. Explore estimates, zones, bills, settings and team roles; changes stay in this session.</span><button onClick={onRefresh}>Reset sample <RefreshCw size={12} /></button></div>}
          {dataError && <div className="ss-data-error" role="status"><span>{dataError}</span><button onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh data'}</button></div>}

          <section className="ss-metrics" aria-label="Organization energy estimates">
            <article className="ss-primary-metric">
              <div className="ss-primary-wash" />
              <div className="ss-primary-grid" />
              <div className="ss-primary-content">
              <div className="ss-primary-label"><span className="ss-primary-mark"><Activity size={15} /></span> MODELED DAILY ENERGY GAP <button className="ss-metric-help" onClick={() => setMethodologyOpen(true)} aria-label="How the energy estimate is calculated" title="How this estimate is calculated"><CircleHelp size={13} /></button><span className="ss-primary-arrow"><ArrowDownRight size={14} /></span></div>
                <div className="ss-primary-number">{number(dashboard?.campus_wasted_energy_kwh, 1)}<span>kWh</span></div>
              <div className="ss-primary-foot"><span>Planning estimate from equipment ratings and schedules</span><span className="ss-primary-count">{rooms.length} ZONES</span></div>
              </div>
              <div className="ss-orbit-art" aria-hidden="true"><span className="ss-orbit ss-orbit-one" /><span className="ss-orbit ss-orbit-two" /><span className="ss-orbit ss-orbit-three" /><i /><b /></div>
              <div className="ss-primary-index">01 <span>/ DAILY</span></div>
            </article>
            <Metric icon={CircleDollarSign} label="Estimated cost" value={'₹' + number(dashboard?.campus_financial_loss_inr, 0)} unit="" detail={`Per day · at ₹${organization.tariffRate}/kWh`} />
            <Metric icon={Leaf} label="Modeled waste emissions" value={number(dashboard?.campus_carbon_footprint_kg, 1)} unit="kg" detail={`CO₂ tied to the estimated gap · factor ${organization.carbonFactor}`} />
            <article className="ss-metric ss-card ss-efficiency">
              <div className="ss-metric-top"><span className="ss-metric-icon"><ShieldCheck size={16} strokeWidth={1.7} /></span><span className="ss-metric-label">Schedule coverage</span><MoreHorizontal size={16} className="ss-muted-icon" aria-hidden="true" /></div>
              <div className="ss-efficiency-row"><div className="ss-efficiency-value">{number(score, 0)}<span>%</span></div><div className="ss-efficiency-ring" style={{ '--ss-angle': scoreAngle + 'deg' }}><span><Check size={13} /></span></div></div>
              <p className="ss-metric-detail">Declared hours vs. operating baseline</p>
            </article>
          </section>

          <div className="ss-section-caption"><span>READ THE PATTERN</span><span>01 — 05</span></div>
          <div className="ss-analysis-grid">
            <ScheduleChart profile={profile} mode={profileMode} onModeChange={setProfileMode} />
            <aside className="ss-card ss-opportunity ss-action-center">
              <div className="ss-card-heading ss-opportunity-heading"><div><div className="ss-kicker"><span className="ss-kicker-dot" /> RULE-BASED ACTION CENTER</div><h2>Good places to start.</h2></div><span className="ss-opportunity-icon"><Sun size={17} /></span></div>
              <p className="ss-opportunity-copy">Zones with the largest schedule-based energy gaps, ranked by estimated daily impact.</p>
              {actionOpportunities.length ? <div className="ss-action-list">{actionOpportunities.map((room, index) => <button className="ss-action-item" key={room.id} onClick={() => { setSelectedRoom(room); setRoomAnalysis(null); goToSection('zones'); }}><span className="ss-action-rank">0{index + 1}</span><span className="ss-action-copy"><strong>Review schedule</strong><small>{room.name} · {room.block}</small></span><span className="ss-action-impact"><strong>{number(room.estimate.wasteKwh, 1)} <small>kWh/d</small></strong><em>₹{number(room.estimate.cost, 0)}/day</em></span><ArrowUpRight size={14} /></button>)}</div> : <div className="ss-opportunity-empty"><span className="ss-empty-mark"><Check size={19} /></span><strong>No gaps modeled.</strong><p>Add operating schedules and equipment ratings to build the action list.</p>{canManageFacilities && <button className="ss-text-action" onClick={() => goToSection('imports')}>Import a schedule <ArrowRight size={14} /></button>}</div>}
              <div className="ss-opportunity-foot"><span><Clock3 size={12} /> Rated load × unscheduled hours · not meter-verified</span><button className="ss-methodology-link" onClick={() => setMethodologyOpen(true)}>How it works <ArrowRight size={11} /></button></div>
            </aside>
          </div>

          <section id="zones" data-section className="ss-zones-section">
            <div className="ss-section-caption"><span>THE BUILDING BLOCKS</span><span>02 — 04</span></div>
            <div className="ss-zones-heading">
              <div><div className="ss-kicker"><span className="ss-kicker-dot" /> FACILITY PORTFOLIO</div><h2>Every zone, <em>in view.</em></h2><p>Equipment and schedule coverage, building by building.</p></div>
              <button className="ss-button ss-button-quiet" onClick={exportRooms}><Download size={15} /> Export estimates <ArrowRight size={14} /></button>
            </div>
            <div className="ss-card ss-zone-table-card">
              <div className="ss-zone-toolbar">
                <div className="ss-zone-count"><strong>{rooms.length.toString().padStart(2, '0')}</strong><span>zones monitored</span></div>
                <div className="ss-zone-tools">
                  <label className="ss-search"><Search size={15} /><input ref={searchInputRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a zone" aria-label="Search zones" /><kbd>/</kbd></label>
                  <button className={'ss-filter-button' + (needsAttention ? ' is-selected' : '')} onClick={() => setNeedsAttention(!needsAttention)} aria-pressed={needsAttention}><span className="ss-filter-dot" /> Needs attention</button>
                </div>
              </div>
              {rooms.length === 0 ? <div className="ss-table-empty"><div className="ss-empty-mark"><Zap size={18} /></div><strong>No zones connected yet.</strong><p>Add facilities to the workspace API, then refresh to build your energy overview.</p></div> : filteredRooms.length === 0 ? <div className="ss-table-empty"><strong>No zones match this view.</strong><p>Clear the search or attention filter to see more zones.</p><button className="ss-text-action" onClick={() => { setSearch(''); setNeedsAttention(false); }}>Clear filters <X size={13} /></button></div> : <div className="ss-table-scroll"><table className="ss-zone-table"><thead><tr><th>ZONE / BUILDING</th><th>CONNECTED LOAD</th><th>SCHEDULES</th><th>DAILY WASTE ESTIMATE</th><th>STATUS</th><th><span className="ss-visually-hidden">View zone</span></th></tr></thead><tbody>
                {filteredRooms.map((room, index) => {
                  const estimate = roomEstimate(room, organization.tariffRate, organization.carbonFactor, organization.operatingHours);
                  const attention = estimate.idleHours > 0 || !(room.schedules || []).length;
                  return <tr key={room.id} onClick={() => { setSelectedRoom(room); setRoomAnalysis(null); }} tabIndex="0" onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedRoom(room); }}>
                    <td><span className="ss-table-index">{String(index + 1).padStart(2, '0')}</span><span className="ss-zone-name"><strong>{room.name}</strong><small>{room.block}</small></span></td>
                    <td><strong>{number(estimate.connectedKw, 2)} <small>kW</small></strong></td>
                    <td><span className="ss-schedule-count"><span />{(room.schedules || []).length} {(room.schedules || []).length === 1 ? 'entry' : 'entries'}</span></td>
                    <td><strong>{number(estimate.wasteKwh, 1)} <small>kWh</small></strong></td>
                    <td><span className={'ss-status-tag' + (attention ? ' is-attention' : '')}><i />{attention ? 'Review schedule' : 'Scheduled'}</span></td>
                    <td><button className="ss-row-open" aria-label={'View ' + room.name}><ArrowUpRight size={15} /></button></td>
                  </tr>;
                })}
              </tbody></table></div>}
              <div className="ss-table-foot"><span>Waste is modelled using a {organization.operatingHours}-hour daily baseline, at ₹{number(organization.tariffRate, 2)}/kWh.</span><span>SELECT A ZONE <ArrowRight size={12} /></span></div>
            </div>
          </section>

          {canManageFacilities && <section id="imports" data-section className="ss-import-section">
            <div className="ss-section-caption"><span>MAKE THE MODEL YOURS</span><span>03 — 05</span></div>
            <div className="ss-import-grid">
              <div className="ss-import-intro"><div className="ss-kicker"><span className="ss-kicker-dot" /> BRING YOUR DATA</div><h2>Start with<br /><em>the schedule.</em></h2><p>Upload an operating schedule to model expected demand, usage gaps and estimated costs across your facilities.</p><button className="ss-template-link" onClick={downloadTemplate}><FileDown size={15} /> Download CSV template <ArrowRight size={13} /></button><div className="ss-import-foot"><span><ShieldCheck size={13} /> CSV files are sent to your workspace API for processing.</span></div></div>
              <form className="ss-card ss-upload-card" onSubmit={submitSchedule}>
                <div className="ss-upload-heading"><div><div className="ss-kicker"><span className="ss-kicker-dot" /> SCHEDULE IMPORT</div><h3>Add a timetable</h3></div><span className="ss-upload-step">01 / 02</span></div>
                <label className="ss-field-label" htmlFor="ss-zone-select">CHOOSE A ZONE</label>
                <div className="ss-room-select"><select id="ss-zone-select" value={importRoomId} onChange={(event) => setImportRoomId(event.target.value)} disabled={rooms.length === 0}><option value="">Select a facility zone</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.block}</option>)}</select><ChevronDown size={15} /></div>
                <div className={'ss-dropzone' + (dragging ? ' is-dragging' : '') + (file ? ' has-file' : '')} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" aria-label="Choose schedule CSV" onChange={(event) => acceptFile(event.target.files?.[0])} />
                  <button type="button" className="ss-dropzone-action" onClick={() => fileRef.current?.click()}><span className="ss-drop-icon">{file ? <Check size={19} /> : <UploadCloud size={20} />}</span><strong>{file ? file.name : dragging ? 'Drop your file here' : 'Drop a CSV file here'}</strong><span>{file ? number(file.size / 1024, 0) + ' KB · Header checked' : 'or browse files · .csv, up to 10 MB'}</span></button>
                  {file && <button type="button" className="ss-remove-file" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} aria-label="Remove selected file"><X size={13} /></button>}
                </div>
                {!isOnline && <p className="ss-upload-offline"><span /> Upload is unavailable until the workspace API is connected.</p>}
                <div className="ss-upload-actions"><span><span className="ss-required-mark">*</span> Required fields: day, start and end time</span><button className="ss-button ss-button-primary" type="submit" disabled={uploading || !isOnline || !rooms.length}>{uploading ? <><RefreshCw className="ss-spin" size={14} /> Uploading</> : <>Add schedule <ArrowRight size={14} /></>}</button></div>
              </form>
            </div>
          </section>}

          {canViewBills && <section id="bills" data-section className="ss-bills-section">
            <div className="ss-section-caption"><span>INDIA · ELECTRICITY</span><span>05 — BBPS</span></div>
            <div className="ss-bills-heading">
              <div><div className="ss-kicker"><span className="ss-kicker-dot" /> BILLING & RECORDS</div><h2>Every bill.<br /><em>Accounted for.</em></h2><p>Bring state utilities and private providers into one electricity ledger for this workspace.</p></div>
              <div className="ss-bills-heading-actions"><button className="ss-button ss-button-quiet" onClick={exportBillRecords}><Download size={15} /> Export records</button><button className="ss-button ss-button-primary" onClick={() => setBillModal('add')}><Plus size={15} /> Add bill record</button></div>
            </div>

            <div className="ss-bill-overview">
              <article className="ss-bbps-card">
                <div className="ss-bbps-card-top"><span className="ss-bbps-monogram">BB</span><span className="ss-bbps-network">BHARAT BILL PAYMENT SYSTEM</span><span className={'ss-bbps-status' + (paymentPortalUrl ? ' is-linked' : '')}><i />{paymentPortalUrl ? 'Hosted portal linked' : `${bbpsPartner} · setup needed`}</span></div>
                <div className="ss-bbps-copy"><h3>One connection.<br /><em>Many billers.</em></h3><p>Connect through a BBPS Operating Unit to discover supported electricity billers across Indian states, including eligible private providers.</p></div>
              <div className="ss-bbps-card-foot"><span><MapPin size={13} /> {organization.state} · India</span><button onClick={paymentPortalUrl ? openProviderPortal : canManageWorkspace ? () => { setPortalDraft(''); setBillModal('bbps'); } : () => setToast('Ask a workspace owner or admin to connect a bill-pay portal.')}>{paymentPortalUrl ? <>Open bill-pay portal <ExternalLink size={13} /></> : canManageWorkspace ? <>Connect provider <ArrowRight size={14} /></> : <>Ask an admin to connect <ArrowRight size={14} /></>}</button></div>
              </article>
              <article className="ss-bill-due-card"><div className="ss-bill-due-top"><span className="ss-bill-icon"><FileText size={16} /></span><span className="ss-bill-due-label">OPEN ELECTRICITY BILLS</span><span className="ss-bill-due-mark"><Activity size={15} /></span></div><strong>₹{number(dueTotal, 0)}</strong><p>{dueBills.length} bill{dueBills.length === 1 ? '' : 's'} marked due across this workspace</p><div className="ss-bill-due-foot"><span>Records only</span><span>Live fetching unavailable</span></div></article>
            </div>

            <div className="ss-bill-ledger ss-card">
              <div className="ss-bill-ledger-head"><div><div className="ss-kicker"><span className="ss-kicker-dot" /> ELECTRICITY LEDGER</div><h3>Provider records</h3><p>Track due amounts, settlements, and transaction references.</p></div><div className="ss-bill-filters" role="group" aria-label="Filter electricity records">{[['all', 'All'], ['due', 'Due'], ['paid', 'Paid'], ['archived', 'Archived']].map(([id, label]) => <button key={id} className={billFilter === id ? 'is-selected' : ''} onClick={() => setBillFilter(id)} aria-pressed={billFilter === id}>{label}</button>)}</div></div>
              {visibleBills.length === 0 ? <div className="ss-bill-empty"><span><CreditCard size={19} /></span><strong>No {billFilter === 'all' ? '' : billFilter + ' '}bill records yet.</strong><p>Add an electricity statement or connect a bill-pay partner after onboarding.</p><button className="ss-text-action" onClick={() => setBillModal('add')}>Add a bill record <ArrowRight size={14} /></button></div> : <div className="ss-bill-table-scroll"><table className="ss-bill-table"><thead><tr><th>PROVIDER / SITE</th><th>STATE</th><th>BILL REFERENCE</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th><th><span className="ss-visually-hidden">Actions</span></th></tr></thead><tbody>{visibleBills.map((bill) => <tr key={bill.id}>
                <td><span className="ss-bill-provider-icon"><Zap size={14} /></span><span className="ss-bill-provider-name"><strong>{bill.biller}</strong><small>{bill.site}</small></span></td>
                <td>{bill.state}</td><td><code>{bill.reference}</code></td><td>{new Date(`${bill.dueDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td><strong>₹{number(bill.amount, 0)}</strong></td>
                <td>{bill.status === 'paid' ? <><span className="ss-bill-status is-paid"><i />Paid</span><small className="ss-bill-paid-meta">{bill.paidDate ? new Date(`${bill.paidDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Date not recorded'} · {bill.paymentReference || 'No transaction reference'}</small></> : bill.status === 'void' ? <span className="ss-bill-status is-archived"><i />Archived</span> : <span className={'ss-bill-status ' + (bill.dueDate < new Date().toISOString().slice(0, 10) ? 'is-overdue' : 'is-due')}><i />{bill.dueDate < new Date().toISOString().slice(0, 10) ? 'Overdue' : 'Due'}</span>}</td>
                <td>{bill.status === 'due' ? <div className="ss-bill-actions">{paymentPortalUrl && <button className="ss-bill-row-action ss-bill-pay-action" onClick={openProviderPortal}>Pay via portal <ExternalLink size={11} /></button>}<button className="ss-bill-row-action" onClick={() => openPaymentRecord(bill)}>Record payment</button><button className="ss-bill-remove" aria-label={'Archive ' + bill.biller + ' bill record'} title="Archive record" onClick={() => archiveRecord(bill)}><X size={12} /></button></div> : bill.status === 'paid' ? <div className="ss-bill-actions"><span className="ss-bill-reference-note"><CheckCircle2 size={14} /> Recorded</span><button className="ss-bill-remove" aria-label={'Archive ' + bill.biller + ' bill record'} title="Archive record" onClick={() => archiveRecord(bill)}><X size={12} /></button></div> : <span className="ss-bill-reference-note">Kept for audit</span>}</td>
              </tr>)}</tbody></table></div>}
              <div className="ss-bill-ledger-foot"><span><ShieldCheck size={13} /> Stored in your organization workspace. Payments happen on the provider site; reconcile confirmations here.</span><button onClick={() => canManageWorkspace ? setBillModal('bbps') : setToast('Provider settings are managed by workspace owners and admins.')}>Payment integration details <ArrowRight size={13} /></button></div>
            </div>
          </section>}

          <footer className="ss-footer"><button className="ss-brand ss-footer-brand" onClick={() => goToSection('overview')}><span className="ss-brand-mark"><Zap size={15} fill="currentColor" /></span><span><strong>syncspace</strong><small>Energy intelligence</small></span></button><span>Energy, considered.</span><span>{isDemo ? 'Sample facilities · Preview only' : 'Estimates use operating schedules and equipment ratings'}</span></footer>
        </div>
      </main>

      <nav className="ss-mobile-nav" aria-label="Mobile navigation" style={{ gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))` }}>{visibleNav.map((item) => <button key={item.id} onClick={() => goToSection(item.id)} className={activeSection === item.id ? 'is-active' : ''}><span>{item.number}</span>{item.id === 'imports' ? 'Import' : item.id === 'bills' ? 'Bills' : item.label}</button>)}</nav>

      {organizationModal && <div className="ss-modal-backdrop ss-form-backdrop" onClick={() => setOrganizationModal(false)}>
        <section className="ss-form-modal" role="dialog" aria-modal="true" aria-labelledby="ss-org-modal-title" onClick={(event) => event.stopPropagation()}>
          <div className="ss-modal-heading"><span className="ss-form-modal-icon"><Building2 size={17} /></span><button className="ss-icon-button" aria-label="Close workspace settings" onClick={() => setOrganizationModal(false)}><X size={17} /></button></div>
          <div className="ss-modal-copy"><div className="ss-kicker"><span className="ss-kicker-dot" /> WORKSPACE PROFILE</div><h2 id="ss-org-modal-title">Make it <em>yours.</em></h2><p>Set the organization and operating assumptions used by the energy model.</p></div>
          <form className="ss-form-grid" onSubmit={saveOrganization}>
            <label className="ss-form-field ss-field-wide"><span>ORGANIZATION NAME</span><input value={organizationDraft.name} maxLength="64" required onChange={(event) => setOrganizationDraft({ ...organizationDraft, name: event.target.value })} placeholder="Your organization" /></label>
            <label className="ss-form-field"><span>ORGANIZATION TYPE</span><select value={organizationDraft.type} onChange={(event) => setOrganizationDraft({ ...organizationDraft, type: event.target.value })}>{ORGANIZATION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="ss-form-field"><span>PRIMARY STATE / TERRITORY</span><select value={organizationDraft.state} onChange={(event) => setOrganizationDraft({ ...organizationDraft, state: event.target.value })}>{INDIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
            <label className="ss-form-field"><span>AVERAGE TARIFF · ₹/kWh</span><input type="number" min="0" max="1000" step="0.01" required value={organizationDraft.tariffRate} onChange={(event) => setOrganizationDraft({ ...organizationDraft, tariffRate: event.target.value })} /></label>
            <label className="ss-form-field"><span>GRID CARBON · kg/kWh</span><input type="number" min="0" max="3" step="0.01" required value={organizationDraft.carbonFactor} onChange={(event) => setOrganizationDraft({ ...organizationDraft, carbonFactor: event.target.value })} /></label>
            <label className="ss-form-field"><span>OPERATING HOURS / DAY</span><input type="number" min="0.5" max="24" step="0.5" required value={organizationDraft.operatingHours} onChange={(event) => setOrganizationDraft({ ...organizationDraft, operatingHours: event.target.value })} /></label>
            <div className="ss-form-note ss-field-wide"><MapPin size={14} /> Saved to this organization. Utility tariffs vary by DISCOM, tariff category, and billing period.</div>
            <div className="ss-form-actions ss-field-wide"><button type="button" className="ss-button ss-button-quiet" onClick={() => setOrganizationModal(false)}>Cancel</button><button type="submit" className="ss-button ss-button-primary">Save workspace <ArrowRight size={14} /></button></div>
          </form>
        </section>
      </div>}

      {teamModal && <div className="ss-modal-backdrop ss-form-backdrop" onClick={() => setTeamModal(false)}>
        <section className="ss-form-modal ss-team-modal" role="dialog" aria-modal="true" aria-labelledby="ss-team-title" onClick={(event) => event.stopPropagation()}>
          <div className="ss-modal-heading"><span className="ss-form-modal-icon"><Users size={17} /></span><button className="ss-icon-button" aria-label="Close team settings" onClick={() => setTeamModal(false)}><X size={17} /></button></div>
          <div className="ss-modal-copy"><div className="ss-kicker"><span className="ss-kicker-dot" /> PEOPLE & PERMISSIONS</div><h2 id="ss-team-title">The right people.<br /><em>The right access.</em></h2><p>{isDemo ? 'Sample organization roles show how the owner, manager and staff hierarchy works. Team changes are disabled in this assignment demo.' : <>Invite teammates into {organization.name}. Invitations expire after seven days. Copy the link once it appears and share it with the invited email address.</>}</p></div>
          <form className="ss-team-invite-form" onSubmit={inviteTeamMember}>
            <label className="ss-form-field"><span>WORK EMAIL</span><input type="email" required maxLength="254" value={inviteDraft.email} onChange={(event) => setInviteDraft({ ...inviteDraft, email: event.target.value })} placeholder="teammate@organization.com" /></label>
            <label className="ss-form-field"><span>ROLE</span><select value={inviteDraft.role} onChange={(event) => setInviteDraft({ ...inviteDraft, role: event.target.value })}>{role === 'owner' && <option value="admin">Admin</option>}<option value="manager">Manager</option><option value="staff">Staff</option></select></label>
            <button className="ss-button ss-button-primary" type="submit" disabled={teamBusy || isDemo}><UserPlus size={14} />{isDemo ? 'Read-only demo' : teamBusy ? 'Creating link…' : 'Create invitation'}</button>
          </form>
          {inviteLink && <div className="ss-invite-link-card"><div><strong>Invitation link created</strong><small>It works for the invited email and expires in seven days.</small><input readOnly value={inviteLink} aria-label="Invitation link" onFocus={(event) => event.target.select()} /></div><button className="ss-button ss-button-quiet" onClick={copyInvite}><Copy size={14} /> Copy link</button></div>}
          {teamError && <div className="ss-auth-error ss-team-error" role="alert">{teamError}</div>}
          <div className="ss-team-list-heading"><span>TEAM MEMBERS</span><small>{teamMembers.filter((member) => member.is_active).length} active</small></div>
          {teamLoading ? <div className="ss-team-empty">Loading workspace access…</div> : <div className="ss-team-list">{teamMembers.map((member) => {
            const self = member.user.id === user.id;
            const protectedAdmin = role === 'admin' && member.role === 'admin';
            return <div className="ss-team-row" key={member.id}><span className="ss-team-avatar">{member.user.full_name.charAt(0).toUpperCase()}</span><span className="ss-team-person"><strong>{member.user.full_name}{self ? ' · you' : ''}</strong><small>{member.user.email}</small></span>{!member.is_active ? <span className="ss-role-badge is-suspended">suspended</span> : member.role === 'owner' || protectedAdmin || self ? <span className={'ss-role-badge is-' + member.role}>{member.role}</span> : <><select aria-label={'Role for ' + member.user.full_name} value={member.role} disabled={isDemo} onChange={(event) => changeMemberRole(member, event.target.value)}><option value="manager">Manager</option><option value="staff">Staff</option>{role === 'owner' && <option value="admin">Admin</option>}</select><button className="ss-team-remove" disabled={isDemo} onClick={() => removeMember(member)} aria-label={'Remove ' + member.user.full_name} title="Remove access"><X size={13} /></button></>}</div>;
          })}</div>}
          {teamInvitations.length > 0 && <><div className="ss-team-list-heading ss-invites-heading"><span>PENDING INVITATIONS</span><small>{teamInvitations.length}</small></div><div className="ss-team-list">{teamInvitations.map((invitation) => <div className="ss-team-row" key={invitation.id}><span className="ss-team-avatar is-invite"><Mail size={14} /></span><span className="ss-team-person"><strong>{invitation.email}</strong><small>{invitation.role} · expires {new Date(invitation.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</small></span><span className="ss-role-badge is-pending">pending</span><button className="ss-team-remove" onClick={() => cancelInvitation(invitation)} aria-label={'Revoke invitation to ' + invitation.email} title="Revoke invitation"><X size={13} /></button></div>)}</div></>}
          <div className="ss-team-permission-note"><ShieldCheck size={14} /><span>Owner manages admins. Admin manages managers and staff. Managers maintain facilities and bill records. Staff can view energy performance.</span></div>
        </section>
      </div>}

      {billModal && <div className="ss-modal-backdrop ss-form-backdrop" onClick={() => setBillModal('')}>
        {billModal === 'add' && <section className="ss-form-modal" role="dialog" aria-modal="true" aria-labelledby="ss-add-bill-title" onClick={(event) => event.stopPropagation()}>
          <div className="ss-modal-heading"><span className="ss-form-modal-icon"><FileText size={17} /></span><button className="ss-icon-button" aria-label="Close add bill" onClick={() => setBillModal('')}><X size={17} /></button></div>
          <div className="ss-modal-copy"><div className="ss-kicker"><span className="ss-kicker-dot" /> ORGANIZATION LEDGER</div><h2 id="ss-add-bill-title">Add a bill.</h2><p>Log an electricity statement from a state utility or private provider. This does not fetch a live bill.</p></div>
          <form className="ss-form-grid" onSubmit={addBillRecord}>
            <label className="ss-form-field ss-field-wide"><span>STATE / UNION TERRITORY</span><select value={newBill.state} onChange={(event) => setNewBill({ ...newBill, state: event.target.value, providerKey: '', biller: '', customBiller: '' })}>{INDIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
            <label className="ss-form-field ss-field-wide"><span>ELECTRICITY BOARD / PROVIDER</span><select value={newBill.providerKey} required onChange={(event) => { const providerKey = event.target.value; const provider = stateProviders.find((item) => item.id === providerKey); setNewBill({ ...newBill, providerKey, biller: provider?.name || '', customBiller: '' }); }}><option value="">Choose a provider for {newBill.state}</option>{stateProviders.map((provider) => <option value={provider.id} key={provider.id}>{provider.name} · {provider.kind}</option>)}<option value="__other">Other / not listed</option></select></label>
            {selectedProvider && <div className="ss-provider-info ss-field-wide"><span>{selectedProvider.kind}</span><p>{selectedProvider.coverage}</p></div>}
            {newBill.providerKey === '__other' && <label className="ss-form-field ss-field-wide"><span>PROVIDER NAME AS SHOWN ON YOUR BILL</span><input value={newBill.customBiller} maxLength="120" required onChange={(event) => setNewBill({ ...newBill, customBiller: event.target.value })} placeholder="Enter the exact electricity provider name" /></label>}
            <div className="ss-form-note ss-provider-sources ss-field-wide"><ShieldCheck size={14} /><span>Utilities are grouped by state and licensed service area. Match the name on your bill; boundaries and supported billers can vary. Sources: {ELECTRICITY_DIRECTORY_SOURCES.map((source, index) => <span key={source.url}>{index > 0 ? ' · ' : ''}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}</span></div>
            <label className="ss-form-field"><span>SITE / FACILITY</span><input value={newBill.site} maxLength="64" onChange={(event) => setNewBill({ ...newBill, site: event.target.value })} placeholder="Building or site name" /></label>
            <label className="ss-form-field"><span>BILL REFERENCE</span><input value={newBill.reference} maxLength="40" onChange={(event) => setNewBill({ ...newBill, reference: event.target.value })} placeholder="Use a masked reference" /></label>
            <label className="ss-form-field"><span>AMOUNT · ₹</span><input type="number" min="0.01" step="0.01" required value={newBill.amount} onChange={(event) => setNewBill({ ...newBill, amount: event.target.value })} placeholder="0.00" /></label>
            <label className="ss-form-field"><span>DUE DATE</span><input type="date" required value={newBill.dueDate} onChange={(event) => setNewBill({ ...newBill, dueDate: event.target.value })} /></label>
            <div className="ss-form-note ss-field-wide"><ShieldCheck size={14} /> This record is stored for your organization. Use a masked bill reference; don’t add full consumer account numbers.</div>
            <div className="ss-form-actions ss-field-wide"><button type="button" className="ss-button ss-button-quiet" onClick={() => setBillModal('')}>Cancel</button><button type="submit" className="ss-button ss-button-primary">Add record <ArrowRight size={14} /></button></div>
          </form>
        </section>}

        {billModal === 'payment' && editingBill && <section className="ss-form-modal" role="dialog" aria-modal="true" aria-labelledby="ss-payment-title" onClick={(event) => event.stopPropagation()}>
          <div className="ss-modal-heading"><span className="ss-form-modal-icon"><CreditCard size={17} /></span><button className="ss-icon-button" aria-label="Close payment record" onClick={() => setBillModal('')}><X size={17} /></button></div>
          <div className="ss-modal-copy"><div className="ss-kicker"><span className="ss-kicker-dot" /> EXTERNAL PAYMENT RECORD</div><h2 id="ss-payment-title">Reconcile this bill.</h2><p>After you have paid using your electricity provider or bank, add its transaction reference to this ledger.</p></div>
          <div className="ss-payment-confirm"><span>{editingBill.biller}</span><strong>₹{number(editingBill.amount, 2)}</strong><small>{editingBill.site} · {editingBill.reference}</small></div>
          <form className="ss-form-grid" onSubmit={recordExternalPayment}>
            <label className="ss-form-field ss-field-wide"><span>PROVIDER TRANSACTION REFERENCE</span><input required value={paymentReference} maxLength="80" onChange={(event) => setPaymentReference(event.target.value)} placeholder="Reference shown by your provider" /></label>
            <div className="ss-form-note ss-payment-notice ss-field-wide"><CircleHelp size={14} /> This only records an external payment. No funds move through SyncSpace.</div>
            <div className="ss-form-actions ss-field-wide"><button type="button" className="ss-button ss-button-quiet" onClick={() => setBillModal('')}>Cancel</button><button type="submit" className="ss-button ss-button-primary">Save payment record <Check size={14} /></button></div>
          </form>
        </section>}

        {billModal === 'bbps' && <section className="ss-form-modal" role="dialog" aria-modal="true" aria-labelledby="ss-bbps-modal-title" onClick={(event) => event.stopPropagation()}>
          <div className="ss-modal-heading"><span className="ss-form-modal-icon"><CreditCard size={17} /></span><button className="ss-icon-button" aria-label="Close bill-pay setup" onClick={() => setBillModal('')}><X size={17} /></button></div>
          <div className="ss-modal-copy"><div className="ss-kicker"><span className="ss-kicker-dot" /> INDIA · BBPS</div><h2 id="ss-bbps-modal-title">Connect bill pay.</h2><p>Use the provider-hosted payment experience after your organization completes BBPS onboarding. SyncSpace opens its link in a new tab.</p></div>
          <label className="ss-form-field ss-bbps-partner-field"><span>PREFERRED BILL-PAY PARTNER</span><select value={bbpsPartner} onChange={(event) => setBbpsPartner(event.target.value)}><option>Setu</option><option>Other BBPOU</option></select></label>
          <label className="ss-form-field ss-bbps-partner-field"><span>PROVIDER-HOSTED BILL-PAY URL · OPTIONAL</span><input type="url" value={portalDraft} onChange={(event) => setPortalDraft(event.target.value)} placeholder="https://… · URL supplied by your onboarded partner" /></label>
          <div className="ss-bbps-steps"><div><span>01</span><p>Complete business and agent onboarding with the BBPS partner.</p></div><div><span>02</span><p>Get an official hosted bill-pay URL from the partner and save it here over HTTPS.</p></div><div><span>03</span><p>Pay on the partner’s site, then reconcile the confirmation reference in this ledger.</p></div></div>
          <div className="ss-form-note ss-bbps-notice"><ShieldCheck size={14} /> The link is stored in your organization profile. Payments happen on the partner site; provider confirmations still need to be reconciled here.</div>
          <div className="ss-form-actions ss-bbps-actions"><a className="ss-template-link" href="https://docs.setu.co/payments/billpay/pre-built-screens/quickstart/website" target="_blank" rel="noreferrer">Read Setu hosted-screen setup <ExternalLink size={13} /></a><button className="ss-button ss-button-primary" onClick={saveBbpsSetup}>Save provider link <ArrowRight size={14} /></button></div>
        </section>}
      </div>}

      {methodologyOpen && <div className="ss-modal-backdrop ss-methodology-backdrop" onClick={() => setMethodologyOpen(false)}>
        <section className="ss-form-modal ss-methodology-modal" role="dialog" aria-modal="true" aria-labelledby="ss-method-title" onClick={(event) => event.stopPropagation()}>
          <div className="ss-modal-heading"><span className="ss-form-modal-icon"><Activity size={17} /></span><button className="ss-icon-button" aria-label="Close project method" onClick={() => setMethodologyOpen(false)}><X size={17} /></button></div>
          <div className="ss-modal-copy"><div className="ss-kicker"><span className="ss-kicker-dot" /> ESD PROJECT · ENERGY MANAGEMENT</div><h2 id="ss-method-title">How the model works.</h2><p>SyncSpace turns equipment ratings and operating schedules into planning estimates for each facility zone.</p></div>
          <div className="ss-model-equation"><span>CONNECTED LOAD</span><strong>Σ appliance watts ÷ 1,000</strong><i>kW</i></div>
          <div className="ss-model-equation"><span>DAILY ENERGY GAP</span><strong>Connected kW × max(0, operating hours − scheduled hours)</strong><i>kWh/day</i></div>
          <div className="ss-model-formulas"><article><span>01 · COST</span><strong>Energy gap × tariff</strong><small>₹ per day</small></article><article><span>02 · EMISSIONS</span><strong>Energy gap × configured factor</strong><small>kg CO₂ equivalent per day</small></article><article><span>03 · COVERAGE</span><strong>Scheduled hours ÷ operating baseline</strong><small>Average across facility zones</small></article></div>
          <div className="ss-model-caveat"><ShieldCheck size={15} /><p><strong>Read this as a planning signal, not measured waste.</strong> The calculation assumes connected equipment could draw its rated load during unscheduled hours. Check meter readings, occupancy, and actual equipment controls before treating an estimate as a verified saving. Demo figures are illustrative.</p></div>
          <div className="ss-form-actions ss-method-actions"><button type="button" className="ss-button ss-button-primary" onClick={() => setMethodologyOpen(false)}>Back to workspace <ArrowRight size={14} /></button></div>
        </section>
      </div>}

      {selectedRoom && <div className="ss-modal-backdrop" onClick={() => { setSelectedRoom(null); setRoomAnalysis(null); }}>
        <section className="ss-room-drawer" role="dialog" aria-modal="true" aria-labelledby="ss-drawer-title" onClick={(event) => event.stopPropagation()}>
          <div className="ss-drawer-top"><span className="ss-kicker"><span className="ss-kicker-dot" /> ZONE DETAIL</span><button className="ss-icon-button" aria-label="Close zone details" onClick={() => { setSelectedRoom(null); setRoomAnalysis(null); }}><X size={17} /></button></div>
          <div className="ss-drawer-title-row"><span className="ss-zone-initial ss-zone-initial-large">{selectedRoom.name.charAt(0)}</span><div><h2 id="ss-drawer-title">{selectedRoom.name}</h2><p>{selectedRoom.block}</p></div></div>
          <div className="ss-drawer-stats"><div><span>Connected load</span><strong>{number(roomEstimate(selectedRoom, organization.tariffRate, organization.carbonFactor, organization.operatingHours).connectedKw, 2)} kW</strong></div><div><span>Schedules</span><strong>{(selectedRoom.schedules || []).length}</strong></div><div><span>Daily gap estimate</span><strong>{number(roomEstimate(selectedRoom, organization.tariffRate, organization.carbonFactor, organization.operatingHours).wasteKwh, 1)} kWh</strong></div></div>
          <div className="ss-drawer-section"><div className="ss-drawer-section-head"><h3>Equipment</h3><span>{(selectedRoom.appliances || []).length} items</span></div>{!(selectedRoom.appliances || []).length ? <p className="ss-drawer-empty">No equipment has been added for this zone.</p> : selectedRoom.appliances.map((appliance, index) => <div className="ss-equipment-row" key={appliance.id || appliance.name + index}><span className="ss-equipment-icon"><Zap size={14} /></span><strong>{appliance.name}</strong><span>{number(appliance.power_watts, 0)} W</span></div>)}</div>
          <div className="ss-drawer-section"><div className="ss-drawer-section-head"><h3>Timetable</h3><span>{(selectedRoom.schedules || []).length} entries</span></div>{!(selectedRoom.schedules || []).length ? <p className="ss-drawer-empty">No timetable yet. Import one below to model this zone.</p> : selectedRoom.schedules.map((schedule, index) => <div className="ss-schedule-row" key={schedule.id || schedule.day_of_week + schedule.start_time + index}><span>{String(schedule.day_of_week || 'Day').slice(0, 3)}</span><strong>{String(schedule.start_time).slice(0, 5)} — {String(schedule.end_time).slice(0, 5)}</strong></div>)}</div>
          {roomAnalysis && <div className="ss-analysis-result"><span>DAILY FACILITY ESTIMATE</span><strong>{number(roomAnalysis.wasteKwh ?? roomAnalysis.wasted_energy_kwh, 2)} kWh</strong><p>Potential idle-time waste · ₹{number(roomAnalysis.cost ?? roomAnalysis.financial_loss_inr, 0)} per day at the configured tariff.</p></div>}
          <button className="ss-button ss-button-primary ss-analyze-button" onClick={analyzeRoom} disabled={analyzing}>{analyzing ? <><RefreshCw size={14} className="ss-spin" /> Calculating</> : <>Calculate zone estimate <ArrowRight size={14} /></>}</button>
          {canManageFacilities && <button className="ss-drawer-import" onClick={() => { setSelectedRoom(null); setRoomAnalysis(null); setImportRoomId(String(selectedRoom.id)); goToSection('imports'); }}>Import timetable for this zone <ArrowRight size={13} /></button>}
        </section>
      </div>}

      {toast && <div className="ss-toast" role="status"><Check size={15} />{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><X size={13} /></button></div>}
    </div>
  );
}
