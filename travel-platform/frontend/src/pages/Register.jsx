import React, { useState, useEffect } from 'react';

const S = {
  wrap: { minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { fontSize: 28, fontWeight: 900, color: '#4f46e5', letterSpacing: -0.5, marginBottom: 24, textAlign: 'center' },
  box: { background: 'white', border: '1px solid #eee', borderRadius: 20, padding: '32px 36px', width: '100%', maxWidth: 500, boxShadow: '0 4px 20px rgba(79,70,229,0.08)' },
  title: { fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 20 },
  inp: { width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, outline: 'none', background: '#fafafa', color: '#1a1a2e', marginBottom: 12 },
  btn: { width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  btnOut: { width: '100%', background: 'white', color: '#6b7280', border: '1px solid #eee', borderRadius: 12, padding: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
  hint: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  err: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  ok: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 },
  dot: (active, done) => ({ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: done ? '#10b981' : active ? '#4f46e5' : '#f3f4f6', color: done || active ? 'white' : '#9ca3af', border: done ? '2px solid #10b981' : active ? '2px solid #4f46e5' : '2px solid #e5e7eb' }),
  line: (done) => ({ width: 40, height: 2, background: done ? '#10b981' : '#e5e7eb' }),
  pwBar: { height: 4, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden', marginTop: 8 },
  pwFill: (cnt) => ({ height: '100%', borderRadius: 4, width: `${cnt/4*100}%`, background: cnt <= 1 ? '#ef4444' : cnt <= 3 ? '#f59e0b' : '#10b981', transition: 'width 0.3s, background 0.3s' }),
  pwChecks: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 },
  pwCheck: (pass) => ({ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: pass ? '#10b981' : '#9ca3af' }),
  timer: { fontSize: 12, color: '#f59e0b', fontWeight: 600, marginTop: 4 },
  code: { width: '100%', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 22, fontWeight: 700, outline: 'none', background: '#fafafa', color: '#1a1a2e', letterSpacing: 8, textAlign: 'center' },
};

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nickname: '', email: '', password: '', passwordConfirm: '', verifyCode: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [pwStrength, setPwStrength] = useState({ len: false, upper: false, lower: false, num: false });

  // 약관 동의 확인
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

  const sendCode = async () => {
    if (!form.nickname.trim()) { setMsg({ type: 'err', text: '닉네임을 입력해주세요.' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setMsg({ type: 'err', text: '올바른 이메일을 입력해주세요.' }); return; }
    if (!pwOk) { setMsg({ type: 'err', text: '비밀번호 조건을 확인해주세요.' }); return; }
    if (!cfOk) { setMsg({ type: 'err', text: '비밀번호가 일치하지 않습니다.' }); return; }

    setLoading(true); setMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, nickname: form.nickname })
      });
      const data = await res.json();
      if (res.ok) { setStep(2); setTimer(300); setMsg({ type: 'ok', text: '인증코드가 발송됐습니다. 이메일을 확인해주세요.' }); }
      else setMsg({ type: 'err', text: data.detail || data.error || '발송 실패' });
    } catch { setMsg({ type: 'err', text: '서버 연결 오류' }); }
    setLoading(false);
  };

  const resend = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, nickname: form.nickname })
      });
      if (res.ok) { setTimer(300); setMsg({ type: 'ok', text: '인증코드가 재발송됐습니다.' }); }
    } catch {}
    setLoading(false);
  };

  const register = async () => {
    if (form.verifyCode.length !== 6) { setMsg({ type: 'err', text: '6자리 인증코드를 입력해주세요.' }); return; }
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
        })
      });
      const data = await res.json();
      if (res.ok) { sessionStorage.removeItem('terms_agree'); setStep(3); }
      else setMsg({ type: 'err', text: data.detail || data.error || '가입 실패' });
    } catch { setMsg({ type: 'err', text: '서버 연결 오류' }); }
    setLoading(false);
  };

  return (
    <div style={S.wrap}>
      <div style={S.logo}>✈ Travellog</div>
      <div style={S.box}>
        {/* 스텝 인디케이터 */}
        <div style={S.steps}>
          {[1,2,3].map((n, i) => (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={S.dot(step === n, step > n)}>{step > n ? '✓' : n}</div>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{['정보입력','이메일인증','완료'][i]}</div>
              </div>
              {i < 2 && <div style={{ ...S.line(step > n), marginBottom: 18 }} />}
            </React.Fragment>
          ))}
        </div>

        {msg.text && <div style={msg.type === 'err' ? S.err : S.ok}>{msg.text}</div>}

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div style={S.title}>기본 정보 입력</div>
            <input style={S.inp} placeholder="닉네임 (2~20자)" value={form.nickname}
              onChange={e => setForm(p => ({...p, nickname: e.target.value}))} />
            <input style={S.inp} type="email" placeholder="이메일 주소" value={form.email}
              onChange={e => setForm(p => ({...p, email: e.target.value}))} />
            <input style={S.inp} type="password" placeholder="비밀번호" value={form.password}
              onChange={e => { setForm(p => ({...p, password: e.target.value})); checkPw(e.target.value); }} />
            <div style={S.pwBar}><div style={S.pwFill(pwCnt)} /></div>
            <div style={S.pwChecks}>
              {[['len','8자 이상'],['upper','대문자'],['lower','소문자'],['num','숫자']].map(([k,label]) => (
                <div key={k} style={S.pwCheck(pwStrength[k])}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: pwStrength[k] ? '#10b981' : '#e5e7eb' }} />
                  {label}
                </div>
              ))}
            </div>
            <input style={{...S.inp, marginTop: 12}} type="password" placeholder="비밀번호 확인" value={form.passwordConfirm}
              onChange={e => setForm(p => ({...p, passwordConfirm: e.target.value}))} />
            {form.passwordConfirm && (
              <div style={{ fontSize: 12, color: cfOk ? '#10b981' : '#ef4444', marginBottom: 8 }}>
                {cfOk ? '✓ 비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}
              </div>
            )}
            <button style={S.btn} onClick={sendCode} disabled={loading}>
              {loading ? '발송 중...' : '다음 → 이메일 인증'}
            </button>
            <button style={S.btnOut} onClick={() => window.location.href = '/terms'}>← 약관으로 돌아가기</button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <div style={S.title}>이메일 인증</div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
              <strong>{form.email}</strong>으로 6자리 인증코드를 발송했습니다.
            </p>
            <input style={S.code} placeholder="000000" maxLength={6} value={form.verifyCode}
              onChange={e => setForm(p => ({...p, verifyCode: e.target.value.replace(/[^0-9]/g, '')}))} />
            {timer > 0 ? (
              <div style={S.timer}>남은 시간: {fmtTimer(timer)}</div>
            ) : (
              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>만료됐습니다. 재발송해주세요.</div>
            )}
            <button style={S.btn} onClick={register} disabled={loading}>{loading ? '처리 중...' : '인증 확인 및 가입 완료'}</button>
            <button style={S.btnOut} onClick={resend} disabled={loading}>인증코드 재발송</button>
            <button style={S.btnOut} onClick={() => setStep(1)}>← 이전으로</button>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', marginBottom: 10 }}>가입이 완료됐어요!</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 28, lineHeight: 1.7 }}>
              Travellog에 오신 것을 환영합니다.<br/>여행 이야기를 공유하고 새로운 코스를 발견해보세요!
            </div>
            <button style={S.btn} onClick={() => window.location.href = '/'}>🏠 로그인하러 가기</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>© 2026 Travellog</div>
    </div>
  );
}
