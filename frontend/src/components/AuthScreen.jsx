import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Building2, Check, Eye, EyeOff, Leaf, LockKeyhole, Mail, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { acceptInvitation, errorMessage, signIn, signInWithGoogle, signUp, signUpWithGoogle } from '../services/api';
import { INDIAN_STATES } from '../data/electricityProviders';

const ORGANIZATION_TYPES = ['Company', 'Office', 'Education', 'Healthcare', 'Manufacturing', 'Retail', 'Hospitality', 'Logistics', 'Property portfolio', 'Public sector', 'Nonprofit', 'Other'];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function getPasswordRequirements(password) {
  return [
    { label: '12 or more characters', met: password.length >= 12 },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Symbol', met: /[^A-Za-z0-9\s]/.test(password) },
  ];
}

export default function AuthScreen({ onAuthenticated, onDemo }) {
  const inviteToken = new URLSearchParams(window.location.search).get('invite') || '';
  const [mode, setMode] = useState(inviteToken ? 'signup' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', organization_name: '', organization_type: 'Company', state: 'Maharashtra' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const googleButtonRef = useRef(null);
  const formRef = useRef(form);
  const isSignup = mode === 'signup';
  const passwordRequirements = getPasswordRequirements(form.password);
  const passwordScore = passwordRequirements.filter((requirement) => requirement.met).length;
  const passwordStrength = form.password
    ? passwordScore === 5 ? 'Strong' : passwordScore >= 4 ? 'Good' : passwordScore >= 2 ? 'Fair' : 'Weak'
    : 'Not rated';
  const passwordConfirmationMatches = form.password === confirmPassword;

  const update = (key) => (event) => {
    formRef.current = { ...formRef.current, [key]: event.target.value };
    setForm(formRef.current);
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setGoogleError('');
  };

  useEffect(() => {
    if (inviteToken || !GOOGLE_CLIENT_ID) return undefined;
    const scriptUrl = 'https://accounts.google.com/gsi/client';
    let script = document.querySelector('script[data-syncspace-google-identity]');
    let inserted = false;
    const markReady = () => setGoogleReady(true);
    const markFailed = () => setGoogleError('Google sign-in could not load. Check your connection and try again.');

    if (window.google?.accounts?.id) {
      const timer = window.setTimeout(markReady, 0);
      return () => window.clearTimeout(timer);
    }
    if (!script) {
      script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.dataset.syncspaceGoogleIdentity = 'true';
      inserted = true;
    }
    script.addEventListener('load', markReady);
    script.addEventListener('error', markFailed);
    if (inserted) document.head.appendChild(script);
    return () => {
      script?.removeEventListener('load', markReady);
      script?.removeEventListener('error', markFailed);
    };
  }, [inviteToken]);

  useEffect(() => {
    if (!googleReady || !GOOGLE_CLIENT_ID || inviteToken || !googleButtonRef.current || !window.google?.accounts?.id) return undefined;
    const button = googleButtonRef.current;
    button.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async ({ credential }) => {
        if (!credential) {
          setError('Google did not return an account credential. Try again.');
          return;
        }
        const currentForm = formRef.current;
        if (isSignup && !currentForm.organization_name.trim()) {
          setError('Enter your organization name before continuing with Google.');
          return;
        }
        setBusy(true);
        setError('');
        try {
          const result = isSignup
            ? await signUpWithGoogle({
              credential,
              organization_name: currentForm.organization_name,
              organization_type: currentForm.organization_type,
              state: currentForm.state,
            })
            : await signInWithGoogle(credential);
          window.history.replaceState({}, '', window.location.pathname);
          onAuthenticated(result);
        } catch (requestError) {
          setError(errorMessage(requestError, 'Google sign-in did not work. Please try again.'));
        } finally {
          setBusy(false);
        }
      },
    });
    window.google.accounts.id.renderButton(button, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: isSignup ? 'signup_with' : 'signin_with',
      logo_alignment: 'left',
      width: 340,
    });
    return () => button.replaceChildren();
  }, [googleReady, isSignup, inviteToken, onAuthenticated]);

  const submit = async (event) => {
    event.preventDefault();
    if (isSignup && !inviteToken) {
      const allPasswordRequirementsMet = passwordRequirements.every((requirement) => requirement.met);
      if (!allPasswordRequirementsMet) {
        setError('Use at least 12 characters with lowercase, uppercase, a number, and a symbol.');
        return;
      }
    }
    if (isSignup) {
      if (!passwordConfirmationMatches) {
        setError('The passwords do not match. Re-enter your password to continue.');
        return;
      }
    }
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
          <p className="ss-auth-intro">{inviteToken ? 'Enter your password to accept this workspace invitation. If you already have an account, use its current password.' : isSignup ? 'Create an owner account, then invite your team with the right level of access.' : 'Sign in to pick up where your organization left off.'}</p>

          {!inviteToken && <div className="ss-auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? 'is-active' : ''} onClick={() => changeMode('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? 'is-active' : ''} onClick={() => changeMode('signup')}>Create workspace</button>
          </div>}

          <form className="ss-auth-form" onSubmit={submit}>
            {isSignup && <label className="ss-auth-field"><span>YOUR NAME</span><div className="ss-auth-input"><Building2 size={15} /><input autoComplete="name" value={form.full_name} onChange={update('full_name')} placeholder="Full name" required minLength="2" maxLength="120" /></div></label>}
            <label className="ss-auth-field"><span>WORK EMAIL</span><div className="ss-auth-input"><Mail size={15} /><input type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@organization.com" required maxLength="254" /></div></label>
            <label className="ss-auth-field"><span>{isSignup && !inviteToken ? 'CREATE PASSWORD' : 'PASSWORD'}</span><div className="ss-auth-input"><LockKeyhole size={15} /><input type={showPassword ? 'text' : 'password'} autoComplete={isSignup && !inviteToken ? 'new-password' : 'current-password'} value={form.password} onChange={update('password')} placeholder={isSignup && !inviteToken ? 'Create a strong password' : 'Enter your password'} required minLength={isSignup && !inviteToken ? 12 : 1} maxLength="128" /> <button type="button" className="ss-auth-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
              {isSignup && !inviteToken && <div className="ss-password-strength">
                <div className="ss-password-strength-heading"><span>Password strength</span><strong data-strength={passwordScore}>{passwordStrength}</strong></div>
                <div className="ss-password-meter" role="progressbar" aria-label="Password strength" aria-valuemin="0" aria-valuemax="5" aria-valuenow={passwordScore}><span className="ss-password-meter-fill" style={{ width: `${passwordScore * 20}%` }} /></div>
                <div className="ss-password-rules">{passwordRequirements.map((requirement) => <span key={requirement.label} className={requirement.met ? 'is-met' : ''}><Check size={11} />{requirement.label}</span>)}</div>
              </div>}
            </label>
            {isSignup && <label className="ss-auth-field"><span>RE-ENTER PASSWORD</span><div className="ss-auth-input"><LockKeyhole size={15} /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter the same password again" required maxLength="128" /></div>{confirmPassword && !passwordConfirmationMatches && <small className="ss-password-mismatch">Passwords do not match yet.</small>}</label>}
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

          {!inviteToken && <div className="ss-google-auth">
            <div className="ss-auth-divider"><span>OR</span></div>
            {GOOGLE_CLIENT_ID ? <div className="ss-google-button-wrap"><div ref={googleButtonRef} className="ss-google-button" />{googleError && <small className="ss-google-error">{googleError}</small>}</div> : <div className="ss-google-unavailable"><strong>Google sign-in needs setup</strong><small>Configure a Google web client ID to enable it here.</small></div>}
          </div>}

          {!inviteToken && <div className="ss-auth-demo-wrap"><button className="ss-auth-demo-button" type="button" onClick={onDemo}><span><Sparkles size={15} /></span><span><strong>Explore the assignment demo</strong><small>Open a sample campus · no account needed</small></span><ArrowRight size={15} /></button><p>Illustrative data only. You can explore the energy model and try the workspace tools.</p></div>}

          <div className="ss-auth-assurance"><ShieldCheck size={15} /><span>Private to your organization. Roles are checked on every request.</span></div>
          {!inviteToken && <p className="ss-auth-switch">{isSignup ? 'Already have a workspace?' : 'New to SyncSpace?'} <button type="button" onClick={() => changeMode(isSignup ? 'login' : 'signup')}>{isSignup ? 'Sign in' : 'Create an organization'}</button></p>}
          <p className="ss-auth-terms">By continuing, you’re creating a secure organization workspace for your team.</p>
        </div>
      </section>
    </main>
  );
}
