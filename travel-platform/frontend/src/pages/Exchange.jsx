import React, { useEffect, useState, useCallback } from 'react';

const CURRENCIES = [
  { code: 'JPY', name: '일본 엔', flag: '🇯🇵', country: '일본' },
  { code: 'USD', name: '미국 달러', flag: '🇺🇸', country: '미국' },
  { code: 'EUR', name: '유로', flag: '🇪🇺', country: '유럽' },
  { code: 'THB', name: '태국 바트', flag: '🇹🇭', country: '태국' },
  { code: 'CNY', name: '중국 위안', flag: '🇨🇳', country: '중국' },
  { code: 'GBP', name: '영국 파운드', flag: '🇬🇧', country: '영국' },
  { code: 'AUD', name: '호주 달러', flag: '🇦🇺', country: '호주' },
  { code: 'SGD', name: '싱가포르 달러', flag: '🇸🇬', country: '싱가포르' },
  { code: 'MYR', name: '말레이시아 링깃', flag: '🇲🇾', country: '말레이시아' },
  { code: 'VND', name: '베트남 동', flag: '🇻🇳', country: '베트남' },
  { code: 'IDR', name: '인도네시아 루피아', flag: '🇮🇩', country: '인도네시아' },
  { code: 'PHP', name: '필리핀 페소', flag: '🇵🇭', country: '필리핀' },
];

const BUDGETS = [
  { label: '식비 (1일)', icon: '🍜' },
  { label: '숙박 (1박)', icon: '🏨' },
  { label: '교통 (1일)', icon: '🚌' },
  { label: '쇼핑', icon: '🛍️' },
  { label: '관광/입장료', icon: '🎡' },
  { label: '기타', icon: '💰' },
];

export default function Exchange() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [krwInput, setKrwInput] = useState('10000');
  const [selectedCurrency, setSelectedCurrency] = useState('JPY');
  const [foreignInput, setForeignInput] = useState('');
  const [tab, setTab] = useState('exchange'); // exchange | budget
  const [budgetItems, setBudgetItems] = useState(
    BUDGETS.map(b => ({ ...b, amount: '' }))
  );
  const [budgetCurrency, setBudgetCurrency] = useState('JPY');
  const [nights, setNights] = useState(3);
  const [days, setDays] = useState(4);

  useEffect(() => { fetchRates(); }, []);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const codes = [...CURRENCIES.map(c => c.code), 'KRW'].join(',');
      // USD 기준으로 받아서 KRW 기준으로 역산
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=USD&to=${codes}`);
      const data = await res.json();
      const usdToKrw = data.rates['KRW'];
      // 각 통화의 KRW 기준 환율 계산 (1 KRW = ? 외화)
      const krwRates = {};
      CURRENCIES.forEach(c => {
        if (data.rates[c.code]) {
          krwRates[c.code] = data.rates[c.code] / usdToKrw;
        }
      });
      setRates(krwRates);
      setLastUpdated(data.date);
    } catch (e) {
      setError('환율 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // KRW → 외화
  const toForeign = useCallback((krw, code) => {
    if (!rates || !krw) return '';
    const val = parseFloat(krw.replace(/,/g, '')) * (rates[code] || 0);
    if (code === 'JPY' || code === 'IDR' || code === 'VND' || code === 'PHP') {
      return Math.round(val).toLocaleString();
    }
    return val.toFixed(2);
  }, [rates]);

  // 외화 → KRW
  const toKRW = useCallback((foreign, code) => {
    if (!rates || !foreign || !rates[code]) return '';
    const val = parseFloat(foreign.replace(/,/g, '')) / rates[code];
    return Math.round(val).toLocaleString();
  }, [rates]);

  const handleKrwChange = (val) => {
    const raw = val.replace(/[^0-9]/g, '');
    setKrwInput(raw ? parseInt(raw).toLocaleString() : '');
    setForeignInput('');
  };

  const handleForeignChange = (val) => {
    const raw = val.replace(/[^0-9.]/g, '');
    setForeignInput(raw);
    setKrwInput('');
  };

  const cur = CURRENCIES.find(c => c.code === selectedCurrency);

  // 예산 계산
  const budgetRate = rates?.[budgetCurrency] || 1;
  const totalForeign = budgetItems.reduce((sum, item) => {
    const amt = parseFloat(item.amount) || 0;
    if (item.label === '숙박 (1박)') return sum + amt * nights;
    if (item.label === '식비 (1일)' || item.label === '교통 (1일)') return sum + amt * days;
    return sum + amt;
  }, 0);
  const totalKRW = Math.round(totalForeign / budgetRate);

  const updateBudget = (i, val) => {
    setBudgetItems(prev => prev.map((item, j) => j === i ? { ...item, amount: val } : item));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">💱 환율 & 예산</div>
        {lastUpdated && (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>기준일: {lastUpdated} · <span style={{ cursor: 'pointer', color: '#4f46e5' }} onClick={fetchRates}>새로고침</span></div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 12, padding: 4 }}>
        {[['exchange', '💱 환율 계산기'], ['budget', '💰 여행 예산 계산기']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none', background: tab === key ? 'white' : 'transparent', color: tab === key ? '#4f46e5' : '#9ca3af', fontSize: 13, fontWeight: tab === key ? 700 : 500, cursor: 'pointer', boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💱</div>
          <div>환율 정보 불러오는 중...</div>
        </div>
      ) : error ? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '16px 20px', color: '#dc2626', fontSize: 13 }}>
          ⚠️ {error}
          <button onClick={fetchRates} style={{ marginLeft: 10, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>다시 시도</button>
        </div>
      ) : tab === 'exchange' ? (
        <>
          {/* 환율 계산기 */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 18, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>🔄 환율 계산기</div>

            {/* 통화 선택 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setSelectedCurrency(c.code); setForeignInput(''); setKrwInput('10000'); }}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${selectedCurrency === c.code ? '#4f46e5' : '#eee'}`, background: selectedCurrency === c.code ? '#eef2ff' : 'white', color: selectedCurrency === c.code ? '#4f46e5' : '#6b7280', fontSize: 12, fontWeight: selectedCurrency === c.code ? 700 : 500, cursor: 'pointer', transition: 'all 0.1s' }}>
                  {c.flag} {c.code}
                </button>
              ))}
            </div>

            {/* 계산 입력 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* KRW 입력 */}
              <div style={{ background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>🇰🇷 한국 원 (KRW)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={krwInput}
                    onChange={e => handleKrwChange(e.target.value)}
                    onFocus={() => setForeignInput('')}
                    placeholder="금액 입력"
                    style={{ flex: 1, fontSize: 22, fontWeight: 800, color: '#1a1a2e', border: 'none', background: 'none', outline: 'none' }}
                  />
                  <span style={{ fontSize: 16, color: '#9ca3af', fontWeight: 600 }}>₩</span>
                </div>
              </div>

              {/* 화살표 */}
              <div style={{ textAlign: 'center', fontSize: 20, color: '#c7d2fe' }}>⇅</div>

              {/* 외화 입력 */}
              <div style={{ background: '#eef2ff', border: '1.5px solid #c7d2fe', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#6366f1', marginBottom: 6, fontWeight: 600 }}>
                  {cur?.flag} {cur?.country} ({selectedCurrency})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={foreignInput || (krwInput ? toForeign(krwInput, selectedCurrency) : '')}
                    onChange={e => handleForeignChange(e.target.value)}
                    onFocus={() => setKrwInput('')}
                    placeholder="금액 입력"
                    style={{ flex: 1, fontSize: 22, fontWeight: 800, color: '#4f46e5', border: 'none', background: 'none', outline: 'none' }}
                  />
                  <span style={{ fontSize: 16, color: '#818cf8', fontWeight: 600 }}>{selectedCurrency}</span>
                </div>
                {foreignInput && (
                  <div style={{ fontSize: 12, color: '#6366f1', marginTop: 4 }}>
                    = ₩{toKRW(foreignInput, selectedCurrency)}
                  </div>
                )}
              </div>

              {/* 환율 기준 힌트 */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                💡 {cur?.flag} {(selectedCurrency === 'JPY' || selectedCurrency === 'IDR' || selectedCurrency === 'VND' || selectedCurrency === 'PHP') ? '100' : '1'} {selectedCurrency} = ₩{rates?.[selectedCurrency] ? Math.round((selectedCurrency === 'JPY' || selectedCurrency === 'IDR' || selectedCurrency === 'VND' || selectedCurrency === 'PHP' ? 100 : 1) / rates[selectedCurrency]).toLocaleString() : '-'}
              </div>
            </div>

            {/* 빠른 금액 버튼 */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8, fontWeight: 600 }}>빠른 금액 선택</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['10000', '50000', '100000', '500000', '1000000'].map(amt => (
                  <button key={amt} onClick={() => { setKrwInput(parseInt(amt).toLocaleString()); setForeignInput(''); }}
                    style={{ padding: '6px 12px', background: krwInput === parseInt(amt).toLocaleString() ? '#4f46e5' : '#f3f4f6', color: krwInput === parseInt(amt).toLocaleString() ? 'white' : '#555', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {parseInt(amt).toLocaleString()}원
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 전체 환율 목록 */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>📊 오늘의 환율</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>외화 → 원화 기준</div>
            </div>
            <div>
              {CURRENCIES.map((c, i) => {
                const rate = rates[c.code]; // 1 KRW = rate 외화
                const unit = (c.code === 'JPY' || c.code === 'IDR' || c.code === 'VND' || c.code === 'PHP') ? 100 : 1;
                const krwPerUnit = rate ? Math.round(unit / rate) : null;
                const displayKRW = krwPerUnit ? krwPerUnit.toLocaleString() : '-';
                return (
                  <div key={c.code}
                    onClick={() => { setSelectedCurrency(c.code); setTab('exchange'); setKrwInput('10000'); setForeignInput(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < CURRENCIES.length - 1 ? '1px solid #f9fafb' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{c.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{c.country}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.name} · {c.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#4f46e5' }}>₩{displayKRW}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{unit} {c.code}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* 예산 계산기 탭 */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 18, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>⚙️ 여행 기본 설정</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {/* 통화 선택 */}
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>현지 통화</div>
                <select value={budgetCurrency} onChange={e => setBudgetCurrency(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }}>
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.country} ({c.code})</option>
                  ))}
                </select>
              </div>
              {/* 여행 기간 */}
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>숙박</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setNights(n => Math.max(1, n-1))}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#f3f4f6', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{nights}박</span>
                  <button onClick={() => setNights(n => n+1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#f3f4f6', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>여행일수</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setDays(d => Math.max(1, d-1))}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#f3f4f6', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{days}일</span>
                  <button onClick={() => setDays(d => d+1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#f3f4f6', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            </div>
          </div>

          {/* 항목별 예산 입력 */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 18, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📋 항목별 예산 입력</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>현지 통화 기준으로 입력하세요</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {budgetItems.map((item, i) => {
                const amt = parseFloat(item.amount) || 0;
                let multiply = 1;
                let label = '';
                if (item.label === '숙박 (1박)') { multiply = nights; label = `× ${nights}박`; }
                if (item.label === '식비 (1일)' || item.label === '교통 (1일)') { multiply = days; label = `× ${days}일`; }
                const subtotal = amt * multiply;
                const subtotalKRW = Math.round(subtotal / budgetRate);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 3, fontWeight: 600 }}>
                        {item.label} {label && <span style={{ color: '#9ca3af', fontWeight: 400 }}>{label}</span>}
                      </div>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={e => updateBudget(i, e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 9, fontSize: 14, outline: 'none', fontWeight: 600 }}
                      />
                    </div>
                    {amt > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>{subtotal.toLocaleString()} {budgetCurrency}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>≈ ₩{subtotalKRW.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 합계 */}
          {totalForeign > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: 18, padding: '20px' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>🧳 {nights}박 {days}일 예상 총 예산</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 4 }}>
                ₩{totalKRW.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                ≈ {Math.round(totalForeign).toLocaleString()} {budgetCurrency}
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>1인 기준 1일 평균</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>₩{Math.round(totalKRW / days).toLocaleString()}/일</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>현지 환율</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>₩1,000 = {(1000 * (rates?.[budgetCurrency] || 0)).toFixed(2)} {budgetCurrency}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
