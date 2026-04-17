import React, { useState, useEffect } from 'react';
import { TRAVEL_STYLES } from '../travelStyles';

const S = {
  wrap: { minHeight: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 },
  logo: { fontSize: 28, fontWeight: 500, fontFamily: "'Playfair Display', serif", color: '#1E2A3A', letterSpacing: -0.5, marginBottom: 24, textAlign: 'center' },
  box: { background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '32px 36px', width: '100%', maxWidth: 520, boxShadow: '0 4px 20px rgba(79,70,229,0.08)' },
  title: { fontSize: 16, fontWeight: 800, color: '#1E2A3A', marginBottom: 20 },
  inp: { width: '100%', padding: '12px 16px', border: '1px solid #E2E0DC', borderRadius: 3, fontSize: 14, outline: 'none', background: '#FAFAF8', color: '#1E2A3A', marginBottom: 12, boxSizing: 'border-box' },
  btn: { width: '100%', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 3, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  btnOut: { width: '100%', background: 'white', color: '#8A919C', border: '1px solid #eee', borderRadius: 3, padding: 12, fontSize: 14, cursor: 'pointer', marginTop: 8 },
  btnSkip: { width: '100%', background: 'none', color: '#8A919C', border: '1px dashed #E2E0DC', borderRadius: 3, padding: 12, fontSize: 13, cursor: 'pointer', marginTop: 8 },
  err: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 2, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  ok: { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', borderRadius: 2, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
  steps: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 },
  dot: (active, done) => ({ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: done ? '#10b981' : active ? '#1E2A3A' : '#F5F4F0', color: done || active ? 'white' : '#8A919C', border: done ? '2px solid #10b981' : active ? '2px solid #1E2A3A' : '2px solid #E2E0DC' }),
  line: (done) => ({ width: 40, height: 2, background: done ? '#10b981' : '#E2E0DC' }),
  pwBar: { height: 4, borderRadius: 4, background: '#E2E0DC', overflow: 'hidden', marginTop: 8 },
  pwFill: (cnt) => ({ height: '100%', borderRadius: 4, width: `${cnt/4*100}%`, background: cnt <= 1 ? '#ef4444' : cnt <= 3 ? '#f59e0b' : '#10b981', transition: 'width 0.3s, background 0.3s' }),
  pwChecks: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 },
  pwCheck: (pass) => ({ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: pass ? '#10b981' : '#8A919C' }),
  timer: { fontSize: 12, color: '#f59e0b', fontWeight: 600, marginTop: 4 },
  code: { width: '100%', padding: '14px 16px', border: '1px solid #E2E0DC', borderRadius: 3, fontSize: 22, fontWeight: 700, outline: 'none', background: '#FAFAF8', color: '#1E2A3A', letterSpacing: 8, textAlign: 'center', boxSizing: 'border-box' },
};

const STEPS = [
  { n: 1, label: '정보입력' },
  { n: 2, label: '이메일인증' },
  { n: 3, label: '여행성향' },
  { n: 4, label: '완료' },
];

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nickname: '', email: '', password: '', passwordConfirm: '', verifyCode: '', nationality: 'KR' });
  const [wishCountries, setWishCountries] = useState([]);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [pwStrength, setPwStrength] = useState({ len: false, upper: false, lower: false, num: false });
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [userId, setUserId] = useState(null); // 가입 완료 후 유저 ID 저장

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
    setSelectedStyles(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

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
      if (res.ok) { setStep(2); setTimer(300); setMsg({ type: 'ok', text: '인증코드가 발송됐습니다.' }); }
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
      if (res.ok) { setTimer(300); setMsg({ type: 'ok', text: '재발송됐습니다.' }); }
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
          nationality: form.nationality || 'KR',
          wish_countries: JSON.stringify(wishCountries),
        })
      });
      const data = await res.json();
      if (res.ok) {
        sessionStorage.removeItem('terms_agree');
        setUserId(data.userId || data.id || null);
        setStep(3); // 성향 선택 스텝으로
        setMsg({ type: '', text: '' });
      } else setMsg({ type: 'err', text: data.detail || data.error || '가입 실패' });
    } catch { setMsg({ type: 'err', text: '서버 연결 오류' }); }
    setLoading(false);
  };

  const saveStyles = async () => {
    if (userId && selectedStyles.length > 0) {
      try {
        await fetch(`/api/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredStyles: selectedStyles })
        });
      } catch (e) { console.error(e); }
    }
    setStep(4);
  };

  return (
    <div style={S.wrap}>
      <div style={S.logo}>✈ Spagenio</div>
      <div style={S.box}>
        {/* 스텝 인디케이터 */}
        <div style={S.steps}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={S.dot(step === s.n, step > s.n)}>{step > s.n ? '✓' : s.n}</div>
                <div style={{ fontSize: 10, color: '#8A919C' }}>{s.label}</div>
              </div>
              {i < STEPS.length - 1 && <div style={{ ...S.line(step > s.n), marginBottom: 18 }} />}
            </React.Fragment>
          ))}
        </div>

        {msg.text && <div style={msg.type === 'err' ? S.err : S.ok}>{msg.text}</div>}

        {/* STEP 1: 정보 입력 */}
        {step === 1 && (
          <div>
            <div style={S.title}>기본 정보 입력</div>
            <input style={S.inp} placeholder="닉네임 (2~20자)" value={form.nickname}
              onChange={e => setForm(p => ({...p, nickname: e.target.value}))} />
            <select style={{...S.inp, color: form.nationality ? '#1E2A3A' : '#8A919C'}}
              value={form.nationality}
              onChange={e => setForm(p => ({...p, nationality: e.target.value}))}>
              <option value="KR">🇰🇷 대한민국</option>
              <option value="JP">🇯🇵 일본</option>
              <option value="US">🇺🇸 미국</option>
              <option value="EU">🇪🇺 유럽 (유로)</option>
              <option value="TH">🇹🇭 태국</option>
              <option value="CN">🇨🇳 중국</option>
              <option value="GB">🇬🇧 영국</option>
              <option value="AU">🇦🇺 호주</option>
              <option value="SG">🇸🇬 싱가포르</option>
              <option value="MY">🇲🇾 말레이시아</option>
              <option value="VN">🇻🇳 베트남</option>
              <option value="ID">🇮🇩 인도네시아</option>
              <option value="PH">🇵🇭 필리핀</option>
            </select>

            {/* 가고싶은 나라 선택 (선택) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>✈️ 가고싶은 나라 <span style={{ color: '#8A919C', fontWeight: 400 }}>(선택, 복수 선택 가능)</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { code: 'JP', label: '🇯🇵 일본' }, { code: 'US', label: '🇺🇸 미국' },
                  { code: 'FR', label: '🇫🇷 프랑스' }, { code: 'IT', label: '🇮🇹 이탈리아' },
                  { code: 'TH', label: '🇹🇭 태국' }, { code: 'ID', label: '🇮🇩 발리' },
                  { code: 'ES', label: '🇪🇸 스페인' }, { code: 'GB', label: '🇬🇧 영국' },
                  { code: 'AU', label: '🇦🇺 호주' }, { code: 'SG', label: '🇸🇬 싱가포르' },
                  { code: 'VN', label: '🇻🇳 베트남' }, { code: 'CN', label: '🇨🇳 중국' },
                  { code: 'HK', label: '🇭🇰 홍콩' }, { code: 'TR', label: '🇹🇷 터키' },
                  { code: 'MA', label: '🇲🇦 모로코' }, { code: 'MX', label: '🇲🇽 멕시코' },
                  { code: 'CZ', label: '🇨🇿 체코' }, { code: 'NL', label: '🇳🇱 네덜란드' },
                  { code: 'AE', label: '🇦🇪 두바이' }, { code: 'HW', label: '🌺 하와이' },
                ].map(c => {
                  const selected = wishCountries.includes(c.code);
                  return (
                    <button key={c.code} type="button"
                      onClick={() => setWishCountries(prev =>
                        prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code]
                      )}
                      style={{ padding: '6px 12px', borderRadius: 3, border: `1.5px solid ${selected ? '#1E2A3A' : '#E2E0DC'}`, background: selected ? '#EEEDEA' : 'white', color: selected ? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: selected ? 700 : 400, cursor: 'pointer', transition: 'all 0.1s' }}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <input style={S.inp} type="email" placeholder="이메일 주소" value={form.email}
              onChange={e => setForm(p => ({...p, email: e.target.value}))} />
            <input style={S.inp} type="password" placeholder="비밀번호" value={form.password}
              onChange={e => { setForm(p => ({...p, password: e.target.value})); checkPw(e.target.value); }} />
            <div style={S.pwBar}><div style={S.pwFill(pwCnt)} /></div>
            <div style={S.pwChecks}>
              {[['len','8자 이상'],['upper','대문자'],['lower','소문자'],['num','숫자']].map(([k,label]) => (
                <div key={k} style={S.pwCheck(pwStrength[k])}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: pwStrength[k] ? '#10b981' : '#E2E0DC' }} />
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

        {/* STEP 2: 이메일 인증 */}
        {step === 2 && (
          <div>
            <div style={S.title}>이메일 인증</div>
            <p style={{ fontSize: 13, color: '#8A919C', marginBottom: 16, lineHeight: 1.6 }}>
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

        {/* STEP 3: 여행 성향 선택 */}
        {step === 3 && (
          <div>
            <div style={S.title}>✈️ 어떤 여행을 좋아하세요?</div>
            <p style={{ fontSize: 13, color: '#8A919C', marginBottom: 18, lineHeight: 1.6 }}>
              선택한 성향에 맞는 게시물을 피드에서 우선적으로 보여드려요.<br/>
              <span style={{ color: '#8A919C' }}>여러 개 선택 가능 · 나중에 프로필에서 변경 가능</span>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {TRAVEL_STYLES.map(s => {
                const selected = selectedStyles.includes(s.key);
                return (
                  <button key={s.key} onClick={() => toggleStyle(s.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px', borderRadius: 24,
                      border: `2px solid ${selected ? s.color : '#E2E0DC'}`,
                      background: selected ? s.bg : 'white',
                      color: selected ? s.color : '#8A919C',
                      fontSize: 13, fontWeight: selected ? 700 : 500,
                      cursor: 'pointer', transition: 'all 0.1s',
                      boxShadow: selected ? `0 0 0 3px ${s.bg}` : 'none'
                    }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    {s.label}
                    {selected && <span style={{ marginLeft: 4, fontSize: 12 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            {selectedStyles.length > 0 && (
              <div style={{ fontSize: 12, color: '#1E2A3A', marginBottom: 14, fontWeight: 600 }}>
                ✓ {selectedStyles.length}개 선택됨
              </div>
            )}
            <button style={S.btn} onClick={saveStyles}>
              {selectedStyles.length > 0 ? `${selectedStyles.length}개 선택 완료 →` : '선택하고 시작하기'}
            </button>
            <button style={S.btnSkip} onClick={() => setStep(4)}>
              건너뛰기 (나중에 프로필에서 설정)
            </button>
          </div>
        )}

        {/* STEP 4: 완료 */}
        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1E2A3A', marginBottom: 10 }}>가입이 완료됐어요!</div>
            <div style={{ fontSize: 14, color: '#8A919C', marginBottom: 16, lineHeight: 1.7 }}>
              Spagenio에 오신 것을 환영합니다.<br/>여행 이야기를 공유하고 새로운 코스를 발견해보세요!
            </div>
            {selectedStyles.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
                {selectedStyles.map(key => {
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
            <button style={S.btn} onClick={() => window.location.replace('/')}>🏠 로그인하러 가기</button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: '#8A919C' }}>© 2026 Spagenio</div>
    </div>
  );
}
