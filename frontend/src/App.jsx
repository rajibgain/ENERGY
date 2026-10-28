import { useCallback, useEffect, useRef, useState } from 'react';
import EnergyWorkspace from './components/EnergyWorkspace';
import AuthScreen from './components/AuthScreen';
import { checkBackendHealth, fetchBillRecords, fetchCampusDashboard, fetchRooms, fetchSession, signOut, updateOrganization as saveOrganization } from './services/api';
import { calculateDemoDashboard, DEMO_BILLS, DEMO_ROOMS, DEMO_SESSION } from './data/demoWorkspace';

const EMPTY_DASHBOARD = {
  total_rooms_analyzed: 0,
  campus_wasted_energy_kwh: 0,
  campus_financial_loss_inr: 0,
  campus_carbon_footprint_kg: 0,
  campus_efficiency_score: 0,
};

const mapOrganization = (org) => ({
  id: org.id,
  name: org.name,
  type: org.organization_type,
  state: org.state,
  tariffRate: org.tariff_rate,
  carbonFactor: org.carbon_factor,
  operatingHours: org.operating_hours,
  bbpsPartner: org.bbps_partner || 'Setu',
  paymentPortalUrl: org.payment_portal_url || '',
});

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [rooms, setRooms] = useState([]);
  const [billRecords, setBillRecords] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataError, setDataError] = useState('');
  const demoSelected = useRef(false);

  const loadDemoData = useCallback((activeOrganization = DEMO_SESSION.organization) => {
    setDashboard(calculateDemoDashboard(DEMO_ROOMS, activeOrganization));
    setRooms(DEMO_ROOMS);
    setBillRecords(DEMO_BILLS);
    setIsOnline(false);
    setDataError('');
    setLastUpdated(new Date());
  }, []);

  const startDemo = () => {
    demoSelected.current = true;
    setCheckingSession(false);
    loadDemoData();
    setSession(DEMO_SESSION);
  };

  useEffect(() => {
    let active = true;
    fetchSession().then((value) => { if (active && !demoSelected.current) setSession(value); }).catch(() => { if (active && !demoSelected.current) setSession(null); }).finally(() => { if (active && !demoSelected.current) setCheckingSession(false); });
    return () => { active = false; };
  }, []);

  const organization = session ? mapOrganization(session.organization) : null;
  const role = session?.role || null;
  const isDemo = Boolean(session?.isDemo);

  const loadData = useCallback(async () => {
    if (!session || session.isDemo) return;
    setRefreshing(true);
    setDataError('');
    try {
      await checkBackendHealth();
      const liveOrganization = mapOrganization(session.organization);
      const requests = [fetchCampusDashboard(liveOrganization), fetchRooms()];
      if (role !== 'staff') requests.push(fetchBillRecords());
      const [dashboardData, roomsData, billsData = []] = await Promise.all(requests);
      setDashboard(dashboardData);
      setRooms(roomsData);
      setBillRecords(billsData);
      setIsOnline(true);
    } catch (error) {
      setIsOnline(false);
      setDataError(error?.response?.status === 401 ? 'Your session ended. Sign in again to continue.' : 'Some workspace data could not load. Check your connection and refresh.');
      if (error?.response?.status === 401) setSession(null);
    } finally {
      setLastUpdated(new Date());
      setRefreshing(false);
    }
  }, [session?.isDemo, session?.organization?.id, session?.organization?.tariff_rate, session?.organization?.carbon_factor, session?.organization?.operating_hours, role]);

  useEffect(() => { if (session && !session.isDemo) loadData(); }, [session?.organization?.id, session?.isDemo, role, loadData]);

  const handleOrganizationChange = async (next) => {
    if (session?.isDemo) {
      const updated = {
        ...session.organization,
        name: next.name,
        organization_type: next.type,
        state: next.state,
        tariff_rate: Number(next.tariffRate),
        carbon_factor: Number(next.carbonFactor),
        operating_hours: Number(next.operatingHours),
        bbps_partner: next.bbpsPartner,
        payment_portal_url: next.paymentPortalUrl,
      };
      setSession((current) => current ? { ...current, organization: updated } : current);
      setDashboard(calculateDemoDashboard(rooms, updated));
      return updated;
    }
    const updated = await saveOrganization({
      name: next.name,
      organization_type: next.type,
      state: next.state,
      tariff_rate: Number(next.tariffRate),
      carbon_factor: Number(next.carbonFactor),
      operating_hours: Number(next.operatingHours),
      bbps_partner: next.bbpsPartner,
      payment_portal_url: next.paymentPortalUrl,
    });
    setSession((current) => current ? { ...current, organization: updated } : current);
  };

  const handleLogout = async () => {
    try { if (!session?.isDemo) await signOut(); } finally {
      demoSelected.current = false;
      setSession(null);
      setDashboard(EMPTY_DASHBOARD);
      setRooms([]);
      setBillRecords([]);
      setIsOnline(false);
      setLastUpdated(null);
    }
  };

  if (checkingSession && !session) return <div className="ss-auth-loading"><span className="ss-brand-mark">✳</span><span>Opening your workspace…</span><button className="ss-auth-loading-demo" onClick={startDemo}>Skip to assignment demo <span aria-hidden="true">→</span></button></div>;
  if (!session || new URLSearchParams(window.location.search).has('invite')) return <AuthScreen onAuthenticated={(value) => { demoSelected.current = false; setSession(value); }} onDemo={startDemo} />;

  return (
    <EnergyWorkspace
      dashboard={dashboard}
      rooms={rooms}
      billRecords={billRecords}
      setBillRecords={setBillRecords}
      isOnline={isOnline}
      isDemo={isDemo}
      refreshing={refreshing}
      lastUpdated={lastUpdated}
      dataError={dataError}
      onRefresh={isDemo ? () => loadDemoData(session.organization) : loadData}
      organization={organization}
      onOrganizationChange={handleOrganizationChange}
      user={session.user}
      role={role}
      onLogout={handleLogout}
    />
  );
}
