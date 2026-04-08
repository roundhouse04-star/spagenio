import React, { useState, useEffect } from 'react';

const S = {
  wrap: { minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { fontSize: 28, fontWeight: 900, color: '#4f46e5', letterSpacing: -0.5, marginBottom: 24, textAlign: 'center' },
  box: { background: 'white', border: '1px solid #eee', borderRadius: 20, padding: '36px', width: '100%', maxWidth: 440, boxShadow: '0 4px 20px rgba(79,70,229,0.08)' },
  icon: { fontSize: 40, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 6, textAlign: 'center' },
  desc: { fontSize: 13, color: '#6b7280', marginBottom: 24, textAlign: 'center', lineHeight: 1.6 },
  inp: { width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 14, outline: 'none', background: '#fafafa', color: '#1a1a2e', marginBottom: 12 },
  code: { width: '100%', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 22, fontWeight: 700, outline: 'none', background: '#fafafa', color: '#1a1a2e', letterSpacing: 8, textAlign: 'center', marginBottom: 4 },
  btn: { width: '100%', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  btnOut: { width: '100%', background: 'white', color: '#6b7280', border: '1px solid #eee', borderRadius: 12, padding: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
  err: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  ok: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  timer: { fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 12 },
  pwBar: { height: 4, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden', marginTop: 4, marginBottom: 8 },
  pwFill: (cnt) => ({ height: '100%', borderRadius: 4, width: `${cnt/4*100}%`, background: cnt <= 1 ? '#ef4444' : cnt <= 3 ? '#f59e0b' : '#10b981', transition: 'width 0.3s' }),
};

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwCf, setNewPwCf] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [pwS, setPwS] = useState({ len: false, upper: false, lower: false, num: false });

  useEffect(() => {
    let interval;
    if (timer > 0) interval = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const fmtTimer = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const checkPw = (pw) => setPwS({ len: pw.length >= 8, upper: /[A-Z]/.test(pw), lower: /[a-z]/.test(pw), num: /[0-9]/.test(pw) });
  const pwCnt = Object.values(pwS).filter(Boolean).length;
  const pwOk = pwCnt === 4 && newPw === newPwCf && newPwCf.length > 0;

  const sendCode = async (resend = false) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMsg({ type: 'err', text: '올바른 이메일을 입력해주세요.' }); return; }
    setLoading(true); setMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/forgot-password/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) { if (!resend) setStep(2); setTimer(300); setMsg({ type: 'ok', text: '인증코드가 발송됐습니다.' }); }
      else setMsg({ type: 'err', text: '발송에 실패했습니다.' });
    } catch { setMsg({ type: 'err', text: '서버 연결 오류' }); }
    setLoading(false);
  };

  const verifyCode = () => {
    if (code.length !== 6) { setMsg({ type: 'err', text: '6자리 인증코드를 입력해주세요.' }); return; }
    setStep(3); setMsg({ type: 'ok', text: '인증됐습니다. 새 비밀번호를 설정해주세요.' });
  };

  const resetPw = async () => {
    if (!pwOk) { setMsg({ type: 'err', text: '비밀번호 조건을 확인해주세요.' }); return; }
    setLoading(true); setMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, verifyCode: code, newPassword: newPw })
      });
      const data = await res.json();
      if (res.ok) setStep(4);
      else setMsg({ type: 'err', text: data.detail || data.error || '변경 실패' });
    } catch { setMsg({ type: 'err', text: '서버 연결 오류' }); }
    setLoading(false);
  };

  return (
    <div style={S.wrap}>
      <div style={S.logo}>✈ Travellog</div>
      <div style={S.box}>
        {msg.text && <div style={msg.type === 'err' ? S.err : S.ok}>{msg.text}</div>}

        {step === 1 && <>
          <div style={S.icon}>🔑</div>
          <div style={S.title}>비밀번호 찾기</div>
          <div style={S.desc}>가입한 이메일 주소를 입력하면<br/>인증코드를 발송해드립니다.</div>
          <input style={S.inp} type="email" placeholder="이메일 주소" value={email} onChange={e => setEmail(e.target.value)} />
          <button style={S.btn} onClick={() => sendCode()} disabled={loading}>{loading ? '발송 중...' : '인증코드 발송'}</button>
          <button style={S.btnOut} onClick={() => window.location.href = '/'}>← 로그인으로 돌아가기</button>
        </>}

        {step === 2 && <>
          <div style={S.icon}>📧</div>
          <div style={S.title}>인증코드 입력</div>
          <div style={S.desc}>{email}으로<br/>6자리 인증코드를 발송했습니다.</div>
          <input style={S.code} placeholder="000000" maxLength={6} value={code}
            onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} />
          {timer > 0 ? <div style={S.timer}>남은 시간: {fmtTimer(timer)}</div> : <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>만료됐습니다.</div>}
          <button style={S.btn} onClick={verifyCode}>인증 확인</button>
          <button style={S.btnOut} onClick={() => sendCode(true)} disabled={loading}>재발송</button>
          <button style={S.btnOut} onClick={() => setStep(1)}>← 이전으로</button>
        </>}

        {step === 3 && <>
          <div style={S.icon}>🔒</div>
          <div style={S.title}>새 비밀번호 설정</div>
          <input style={S.inp} type="password" placeholder="새 비밀번호" value={newPw}
            onChange={e => { setNewPw(e.target.value); checkPw(e.target.value); }} />
          <div style={S.pwBar}><div style={S.pwFill(pwCnt)} /></div>
          <input style={S.inp} type="password" placeholder="새 비밀번호 확인" value={newPwCf}
            onChange={e => setNewPwCf(e.target.value)} />
          {newPwCf && <div style={{ fontSize: 12, color: newPw === newPwCf ? '#10b981' : '#ef4444', marginBottom: 8 }}>
            {newPw === newPwCf ? '✓ 일치합니다' : '일치하지 않습니다'}
          </div>}
          <button style={S.btn} onClick={resetPw} disabled={loading || !pwOk}>{loading ? '처리 중...' : '비밀번호 변경'}</button>
        </>}

        {step === 4 && <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 10 }}>비밀번호가 변경됐습니다!</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>새 비밀번호로 로그인해주세요.</div>
          <button style={S.btn} onClick={() => window.location.href = '/'}>로그인하러 가기</button>
        </div>}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#9ca3af' }}>© 2026 Travellog</div>
    </div>
  );
}
