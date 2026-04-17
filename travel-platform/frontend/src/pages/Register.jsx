import React, { useState, useEffect } from 'react';
import { TRAVEL_STYLES } from '../travelStyles';

const S = {
  wrap: { minHeight: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { fontSize: 28, fontWeight: 500, fontFamily: "'Playfair Display', serif", color: '#1E2A3A', letterSpacing: -0.5, marginBottom: 24, textAlign: 'center' },
  box: { background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '32px 36px', width: '100%', Width: 520, boxShadow: '0 4px 20px rgba(79,70,229,0.08)' },
  title: { fontSize: 16, fontWeight: 800, color: '#1E2A3A', marginBottom: 20 },
  inp: { width: '100%', padding: '12px 16px', border: '1px solid #E2E0DC', borderRadius: 3, fontSize: 14, outline: 'none', background: '#FAFAF8', color: '#1E2A3A', marginBottom: 12, boxSizing: 'border-box' },
  btn: { width: '100%', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 3, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  btnOut: { width: '100%', background: 'white', color: '#8A919C', border: '1px solid #eee', borderRadius: 3, padding: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
  btnSkip: { width: '100%', background: 'none', color: '#8A919C', border: '1px dashed #E2E0DC', borderRadius: 3, padding: 12, fontSize: 13, cursor: 'pointer', marginTop: 8 },
  err: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 2, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  ok: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 2, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 },
  dot: (active, done) => ({ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: done? '#10b981' : active? '#1E2A3A' : '#F5F4F0', color: done || active? 'white' : '#8A919C', border: done? '2px solid #10b981' : active? '2px solid #1E2A3A' : '2px solid #E2E0DC' }),
  line: (done) => ({ width: 40, height: 2, background: done? '#10b981' : '#E2E0DC' }),
  pwBar: { height: 4, borderRadius: 4, background: '#E2E0DC', overflow: 'hidden', marginTop: 8 },
  pwFill: (cnt) => ({ height: '100%', borderRadius: 4, width: `${cnt/4*100}%`, background: cnt <= 1? '#ef4444' : cnt <= 3? '#f59e0b' : '#10b981', transition: 'width 0.3s, background 0.3s' }),
  pwChecks: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 },
  pwCheck: (pass) => ({ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: pass? '#10b981' : '#8A919C' }),
  timer: { fontSize: 12, color: '#f59e0b', fontWeight: 600, marginTop: 4 },
  code: { width: '100%', padding: '14px 16px', border: '1px solid #E2E0DC', borderRadius: 3, fontSize: 22, fontWeight: 700, outline: 'none', background: '#FAFAF8', color: '#1E2A3A', letterSpacing: 8, textAlign: 'center', boxSizing: 'border-box' },
};

const STEPS = [
  { n: 1, label: 'InfoEnter' },
  { n: 2, label: 'EmailVerify' },
  { n: 3, label: 'TRAVELPreferences' },
  { n: 4, label: 'DONE' },
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nickname: '', email: '', password: '', passwordConfirm: '', verifyCode: '', nationality: 'KR' });
  const [wishCountries, setWishCountries] = useState([]);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [pwStrength, setPwStrength] = useState({ len: false, upper: false, lower: false, num: false });
  const [SelectedStyles, setSelectedStyles] = useState([]);
  const [userId, setUserId] = useState(null); // Sign up complete after User ID SAVE

  useEffect(() => {
    const agreed = sessionStorage.getItem('terms_agree');
    if (!agreed) window.location.href = '/terms';
  }, []);

  useEffect(() => {
    let interval;
    if (timer > 0) interval = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const fmtTimer = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;

  const checkPw = (pw) => {
    const s = { len: pw.length >= 8, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw), num: /[0-9]/.test(pw) };
    setPwStrength(s);
    return s;
  };

  const pwCnt = Object.values(pwStrength).filter(Boolean).length;
  const pwOk = pwCnt === 4;
  const cfOk = form.password === form.passwordConfirm && form.passwordConfirm.length > 0;

  const toggleStyle = (key) => {
    setSelectedStyles(prev => prev.includes(key)? prev.filter(k => k!== key) : [...prev, key]);
  };

  const sendCode = async () => {
    if (!form.nickname.trim()) { setMsg({ type: 'err', text: 'Enter a nickname.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setMsg({ type: 'err', text: 'Enter a valid email.' }); return; }
    if (!pwOk) { setMsg({ type: 'err', text: 'Please meet the password requirements.' }); return; }
    if (!cfOk) { setMsg({ type: 'err', text: 'Passwords do not match.' }); return; }
    setLoading(true); setMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, nickname: form.nickname })
      });
      const data = await res.json();
      if (res.ok) { setStep(2); setTimer(300); setMsg({ type: 'ok', text: 'Verification code sent.' }); }
      else setMsg({ type: 'err', text: data.detail || data.error || 'Send failed' });
    } catch { setMsg({ type: 'err', text: 'Server connect Error' }); }
    setLoading(false);
  };

  const resend = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, nickname: form.nickname })
      });
      if (res.ok) { setTimer(300); setMsg({ type: 'ok', text: 'Resent.' }); }
    } catch {}
    setLoading(false);
  };

  const register = async () => {
    if (form.verifyCode.length!== 6) { setMsg({ type: 'err', text: 'Enter the 6-digit code.' }); return; }
    setLoading(true); setMsg({ type: '', text: '' });
    const agreed = JSON.parse(sessionStorage.getItem('terms_agree') || '{}');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname, email: form.email,
          password: form.password, verifyCode: form.verifyCode,
          agree_terms: agreed.agree_terms || false,
          agree_privacy: agreed.agree_privacy || false,
          agree_content: agreed.agree_content || false,
          agree_location: agreed.agree_location || false,
          agree_marketing: agreed.agree_marketing || false,
          nationality: form.nationality || 'KR',
          wish_countries: JSON.stringify(wishCountries),
        })
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.removeItem('terms_agree');
        setUserId(data.userId || data.id || null);
        setStep(3); // preference selection step
        setMsg({ type: '', text: '' });
      } else setMsg({ type: 'err', text: data.detail || data.error || 'Sign up failed' });
    } catch { setMsg({ type: 'err', text: 'Server connect Error' }); }
    setLoading(false);
  };

  const saveStyles = async () => {
    if (userId && SelectedStyles.length > 0) {
      try {
        await fetch(`/api/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredStyles: SelectedStyles })
        });
      } catch (e) { console.error(e); }
    }
    setStep(4);
  };

  return (
    <div style={S.wrap}>
      <div style={S.logo}>✈ Spagenio</div>
      <div style={S.box}>
        {/* Step indicator */}
        <div style={S.steps}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={S.dot(step === s.n, step > s.n)}>{step > s.n? '✓' : s.n}</div>
                <div style={{ fontSize: 10, color: '#8A919C' }}>{s.label}</div>
              </div>
              {i < STEPS.length - 1 && <div style={{...S.line(step > s.n), marginBottom: 18 }} />}
            </React.Fragment>
          ))}
        </div>

        {msg.text && <div style={msg.type === 'err'? S.err : S.ok}>{msg.text}</div>}

        {/* STEP 1: Info Enter */}
        {step === 1 && (
          <div>
            <div style={S.title}>Basic Info Enter</div>
            <input style={S.inp} placeholder="Nickname (2~20 chars)" value={form.nickname}
              onChange={e => setForm(p => ({...p, nickname: e.target.value}))} />
            <select style={{...S.inp, color: form.nationality? '#1E2A3A' : '#8A919C'}}
              value={form.nationality}
              onChange={e => setForm(p => ({...p, nationality: e.target.value}))}>
              <option value="KR">🇰🇷 Korea</option>
              <option value="JP">🇯🇵 Japan</option>
              <option value="US">🇺🇸 USA</option>
              <option value="EU">🇪🇺 Europe (EUR)</option>
              <option value="TH">🇹🇭 Thailand</option>
              <option value="CN">🇨🇳 China</option>
              <option value="GB">🇬🇧 UK</option>
              <option value="AU">🇦🇺 Australia</option>
              <option value="SG">🇸🇬 Singapore</option>
              <option value="MY">🇲🇾 Malaysia</option>
              <option value="VN">🇻🇳 Vietnam</option>
              <option value="ID">🇮🇩 Indonesia</option>
              <option value="PH">🇵🇭 Philippines</option>
            </select>

            {/* Countries you want to visit SELECT (optional) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>Countries you want to visit <span style={{ color: '#8A919C', fontWeight: 400 }}>(SELECT, Multiple selectable)</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { code: 'JP', label: '🇯🇵 Japan' }, { code: 'US', label: '🇺🇸 USA' },
                  { code: 'FR', label: '🇫🇷 France' }, { code: 'IT', label: '🇮🇹 Italy' },
                  { code: 'TH', label: '🇹🇭 Thailand' }, { code: 'ID', label: '🇮🇩 Bali' },
                  { code: 'ES', label: '🇪🇸 Spain' }, { code: 'GB', label: '🇬🇧 UK' },
                  { code: 'AU', label: '🇦🇺 Australia' }, { code: 'SG', label: '🇸🇬 Singapore' },
                  { code: 'VN', label: '🇻🇳 Vietnam' }, { code: 'CN', label: '🇨🇳 China' },
                  { code: 'HK', label: '🇭🇰 Hong Kong' }, { code: 'TR', label: '🇹🇷 Turkey' },
                  { code: 'MA', label: '🇲🇦 Morocco' }, { code: 'MX', label: '🇲🇽 Mexico' },
                  { code: 'CZ', label: '🇨🇿 Czechia' }, { code: 'NL', label: '🇳🇱 Netherlands' },
                  { code: 'AE', label: '🇦🇪 Dubai' }, { code: 'HW', label: '🌺 Hawaii' },
                ].map(c => {
                  const Selected = wishCountries.includes(c.code);
                  return (
                    <button key={c.code} type="button"
                      onClick={() => setWishCountries(prev =>
                        prev.includes(c.code)? prev.filter(x => x!== c.code) : [...prev, c.code]
                      )}
                      style={{ padding: '6px 12px', borderRadius: 3, border: `1.5px solid ${Selected? '#1E2A3A' : '#E2E0DC'}`, background: Selected? '#EEEDEA' : 'white', color: Selected? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: Selected? 700 : 400, cursor: 'pointer', transition: 'all 0.1s' }}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <input style={S.inp} type="email" placeholder="Email Address" value={form.email}
              onChange={e => setForm(p => ({...p, email: e.target.value}))} />
            <input style={S.inp} type="password" placeholder="Password" value={form.password}
              onChange={e => { setForm(p => ({...p, password: e.target.value})); checkPw(e.target.value); }} />
            <div style={S.pwBar}><div style={S.pwFill(pwCnt)} /></div>
            <div style={S.pwChecks}>
              {[['len','8+ chars'],['upper','Uppercase chars'],['lower','Lowercase chars'],['num','Number chars']].map(([k,label]) => (
                <div key={k} style={S.pwCheck(pwStrength[k])}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: pwStrength[k]? '#10b981' : '#E2E0DC' }} />
                  {label}
                </div>
              ))}
            </div>
            <input style={{...S.inp, marginTop: 12}} type="password" placeholder="Password OK" value={form.passwordConfirm}
              onChange={e => setForm(p => ({...p, passwordConfirm: e.target.value}))} />
            {form.passwordConfirm && (
              <div style={{ fontSize: 12, color: cfOk? '#10b981' : '#ef4444', marginBottom: 8 }}>
                {cfOk? '✓ Passwords match' : 'Passwords do not match'}
              </div>
            )}
            <button style={S.btn} onClick={sendCode} disabled={loading}>
              {loading? 'Send...' : 'Next → Email verification'}
            </button>
            <button style={S.btnOut} onClick={() => window.location.href = '/terms'}>← Back to Terms</button>
          </div>
        )}

        {/* STEP 2: Email Verify */}
        {step === 2 && (
          <div>
            <div style={S.title}>Email Verify</div>
            <p style={{ fontSize: 13, color: '#8A919C', marginBottom: 16, lineHeight: 1.6 }}>
              <strong>{form.email}</strong>to Enter the 6-digit code.sent.
            </p>
            <input style={S.code} placeholder="000000" maxLength={6} value={form.verifyCode}
              onChange={e => setForm(p => ({...p, verifyCode: e.target.value.replace(/[^0-9]/g, '')}))} />
            {timer > 0? (
              <div style={S.timer}>Time left: {fmtTimer(timer)}</div>
            ) : (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Expired. Please resend.</div>
            )}
            <button style={S.btn} onClick={register} disabled={loading}>{loading? 'Processing...' : 'Verify OK and Sign up complete'}</button>
            <button style={S.btnOut} onClick={resend} disabled={loading}>Verification code Resend</button>
            <button style={S.btnOut} onClick={() => setStep(1)}>← Back</button>
          </div>
        )}

        {/* STEP 3: TRAVEL Preferences SELECT */}
        {step === 3 && (
          <div>
            <div style={S.title}>✈️ Which TRAVEL like?</div>
            <p style={{ fontSize: 13, color: '#8A919C', marginBottom: 18, lineHeight: 1.6 }}>
              Posts matching your preferences will be shown First in your feed.<br/>
              <span style={{ color: '#8A919C' }}>multi selectable · your profilefrom changeable</span>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {TRAVEL_STYLES.map(s => {
                const Selected = SelectedStyles.includes(s.key);
                return (
                  <button key={s.key} onClick={() => toggleStyle(s.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px', borderRadius: 24,
                      border: `2px solid ${Selected? s.color : '#E2E0DC'}`,
                      background: Selected? s.bg : 'white',
                      color: Selected? s.color : '#8A919C',
                      fontSize: 13, fontWeight: Selected? 700 : 500,
                      cursor: 'pointer', transition: 'all 0.1s',
                      boxShadow: Selected? `0 0 0 3px ${s.bg}` : 'none'
                    }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    {s.label}
                    {Selected && <span style={{ marginLeft: 4, fontSize: 12 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            {SelectedStyles.length > 0 && (
              <div style={{ fontSize: 12, color: '#1E2A3A', marginBottom: 14, fontWeight: 600 }}>
                ✓ {SelectedStyles} selected
              </div>
            )}
            <button style={S.btn} onClick={saveStyles}>
              {SelectedStyles.length > 0? `${SelectedStyles.length} Selected →` : 'SELECT Start'}
            </button>
            <button style={S.btnSkip} onClick={() => setStep(4)}>
              Skip (your profilefrom Settings)
            </button>
          </div>
        )}

        {/* STEP 4: DONE */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1E2A3A', marginBottom: 10 }}>Sign up complete!</div>
            <div style={{ fontSize: 14, color: '#8A919C', marginBottom: 16, lineHeight: 1.7 }}>
              Spagenio in Welcome.<br/>Share travel stories and discover new routes!
            </div>
            {SelectedStyles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
                {SelectedStyles.map(key => {
                  const s = TRAVEL_STYLES.find(t => t.key === key);
                  if (!s) return null;
                  return (
                    <span key={key} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 3, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontWeight: 700 }}>
                      {s.icon} {s.label}
                    </span>
                  );
                })}
              </div>
            )}
            <button style={S.btn} onClick={() => window.location.replace('/')}>🏠 Go to login</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#8A919C' }}>© 2026 Spagenio</div>
    </div>
  );
}
