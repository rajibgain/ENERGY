import { useState } from 'react';
import { ArrowRight, Building2, Eye, EyeOff, Leaf, LockKeyhole, Mail, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { acceptInvitation, errorMessage, signIn, signUp } from '../services/api';
import { INDIAN_STATES } from '../data/electricityProviders';

const ORGANIZATION_TYPES = ['Company', 'Office', 'Education', 'Healthcare', 'Manufacturing', 'Retail', 'Hospitality', 'Logistics', 'Property portfolio', 'Public sector', 'Nonprofit', 'Other'];

export default function AuthScreen({ onAuthenticated, onDemo }) {
  const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';
  const [mode, setMode] = useState(inviteToken ? 'signup' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', organization_name: '', organization_type: 'Company', state: 'Maharashtra' });
  const isSignup = mode === 'signup';

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = inviteToken
        ? await acceptInvitation({ token: inviteToken, full_name: form.full_name, email: form.email, password: form.password })
        : isSignup
          ? await signUp(form)
          : await signIn({ email: form.email, password: form.password });
      window.history.replaceState({}, '', window.location.pathname);
      onAuthenticated(result);
    } catch (requestError) {
      setError(errorMessage(requestError, 'We could not verify those details. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="ss-auth-page">
      <section className="ss-auth-showcase" aria-label="SyncSpace energy intelligence">
        <div className="ss-auth-showcase-grain" />
        <a className="ss-auth-brand" href={import.meta.env.BASE_URL} aria-label="SyncSpace home"><span className="ss-auth-brand-mark"><Zap size={17} fill="currentColor" /></span><span><strong>syncspace</strong><small>Energy intelligence</small></span></a>
        <div className="ss-auth-story">
          <span className="ss-auth-kicker"><i /> ENERGY, IN EVERY SPACE</span>
          <h1>Make every<br />watt work <em>harder.</em></h1>
          <p>A calmer way to see energy across every building, team and site you operate.</p>
        </div>
        <div className="ss-auth-showcase-bottom"><span><Leaf size={14} /> Built for the places that power your work</span><span>01 — INDIA</span></div>
      </section>

      <section className="ss-auth-panel">
        <div className="ss-auth-mobile-brand"><span className="ss-auth-brand-mark"><Zap size={16} fill="currentColor" /></span><strong>syncspace</strong></div>
        <div className="ss-auth-card">
          <div className="ss-auth-card-mark"><span><Building2 size={17} /></span><i><Sparkles size={12} /></i></div>
          <div className="ss-auth-eyebrow"><span className="ss-auth-live-dot" /> {inviteToken ? 'TEAM INVITATION' : 'YOUR ENERGY WORKSPACE'}</div>
          <h2>{inviteToken ? <>Join your<br /><em>organization.</em></> : isSignup ? <>Start with<br /><em>your organization.</em></> : <>Welcome<br /><em>back.</em></>}</h2>
          <p className="ss-auth-intro">{inviteToken ? 'Create your account to accept this workspace invitation.' : isSignup ? 'Create an owner account, then invite your team with the right level of access.' : 'Sign in to pick up where your organization left off.'}</p>

          {!inviteToken && <div className="ss-auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? 'is-active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? 'is-active' : ''} onClick={() => { setMode('signup'); setError(''); }}>Create workspace</button>
          </div>}

          <form className="ss-auth-form" onSubmit={submit}>
            {isSignup && <label className="ss-auth-field"><span>YOUR NAME</span><div className="ss-auth-input"><Building2 size={15} /><input autoComplete="name" value={form.full_name} onChange={update('full_name')} placeholder="Full name" required minLength="2" maxLength="120" /></div></label>}
            <label className="ss-auth-field"><span>WORK EMAIL</span><div className="ss-auth-input"><Mail size={15} /><input type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@organization.com" required maxLength="254" /></div></label>
            <label className="ss-auth-field"><span>PASSWORD</span><div className="ss-auth-input"><LockKeyhole size={15} /><input type={showPassword ? 'text' : 'password'} autoComplete={isSignup ? 'new-password' : 'current-password'} value={form.password} onChange={update('password')} placeholder={isSignup ? 'At least 12 characters' : 'Enter your password'} required minLength={isSignup ? 12 : 1} maxLength="128" /> <button type="button" className="ss-auth-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>{isSignup && <small>Use 12 or more characters to protect your account.</small>}</label>
            {isSignup && !inviteToken && <>
              <label className="ss-auth-field"><span>ORGANIZATION NAME</span><div className="ss-auth-input"><Building2 size={15} /><input value={form.organization_name} onChange={update('organization_name')} placeholder="Company, campus, firm or site group" required minLength="2" maxLength="120" /></div></label>
              <div className="ss-auth-form-row">
                <label className="ss-auth-field"><span>ORGANIZATION TYPE</span><select value={form.organization_type} onChange={update('organization_type')}>{ORGANIZATION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label className="ss-auth-field"><span>PRIMARY STATE / UT</span><select value={form.state} onChange={update('state')}>{INDIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select></label>
              </div>
            </>}
            {error && <div className="ss-auth-error" role="alert">{error}</div>}
            <button className="ss-auth-submit" type="submit" disabled={busy}>{busy ? 'Securing your workspace…' : inviteToken ? 'Accept invitation' : isSignup ? 'Create your workspace' : 'Sign in to SyncSpace'} <ArrowRight size={15} /></button>
          </form>

          {!inviteToken && <div className="ss-auth-demo-wrap"><button className="ss-auth-demo-button" type="button" onClick={onDemo}><span><Sparkles size={15} /></span><span><strong>Explore the assignment demo</strong><small>Open a sample campus · no account needed</small></span><ArrowRight size={15} /></button><p>Illustrative data only. You can explore the energy model and try the workspace tools.</p></div>}

          <div className="ss-auth-assurance"><ShieldCheck size={15} /><span>Private to your organization. Roles are checked on every request.</span></div>
          {!inviteToken && <p className="ss-auth-switch">{isSignup ? 'Already have a workspace?' : 'New to SyncSpace?'} <button type="button" onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); }}>{isSignup ? 'Sign in' : 'Create an organization'}</button></p>}
          <p className="ss-auth-terms">By continuing, you’re creating a secure organization workspace for your team.</p>
        </div>
      </section>
    </main>
  );
}
