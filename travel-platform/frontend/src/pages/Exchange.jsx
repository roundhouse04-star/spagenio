import React, { useEffect, useState, useCallback } from 'react';

const CURRENCIES = [
  { code: 'JPY', name: 'JPY', flag: '🇯🇵', country: 'Japan' },
  { code: 'USD', name: 'USD', flag: '🇺🇸', country: 'USA' },
  { code: 'EUR', name: 'EUR', flag: '🇪🇺', country: 'Europe' },
  { code: 'THB', name: 'THB', flag: '🇹🇭', country: 'Thailand' },
  { code: 'CNY', name: 'CNY', flag: '🇨🇳', country: 'China' },
  { code: 'GBP', name: 'GBP', flag: '🇬🇧', country: 'UK' },
  { code: 'AUD', name: 'AUD', flag: '🇦🇺', country: 'Australia' },
  { code: 'SGD', name: 'SGD', flag: '🇸🇬', country: 'Singapore' },
  { code: 'MYR', name: 'MYR', flag: '🇲🇾', country: 'Malaysia' },
  { code: 'VND', name: 'VND', flag: '🇻🇳', country: 'Vietnam' },
  { code: 'IDR', name: 'IDR', flag: '🇮🇩', country: 'Indonesia' },
  { code: 'PHP', name: 'PHP', flag: '🇵🇭', country: 'Philippines' },
];

const BUDGETS = [
  { label: 'Food per day', icon: '🍜' },
  { label: 'Stays per night', icon: '🏨' },
  { label: 'TRANSIT per day', icon: '🚌' },
  { label: 'Shopping', icon: '🛍️' },
  { label: 'Attraction/Admission', icon: '🎡' },
  { label: 'Other', icon: '💰' },
];

export default function Exchange() {
  // Nationality → Base currency map
  const NATIONALITY_CURRENCY = {
    KR: { code: 'KRW', isBase: true }, // Korea → KRW Basis (Foreign currency Enter)
    JP: { code: 'JPY', isBase: false }, // Japan → JPY Enter
    US: { code: 'USD', isBase: false }, // USA → USD Enter
    EU: { code: 'EUR', isBase: false }, // Europe → EUR Enter
    TH: { code: 'THB', isBase: false }, // Thailand → THB Enter
    CN: { code: 'CNY', isBase: false }, // China → CNY Enter
    GB: { code: 'GBP', isBase: false }, // UK → GBP Enter
    AU: { code: 'AUD', isBase: false }, // Australia → AUD Enter
    SG: { code: 'SGD', isBase: false }, // Singapore → SGD Enter
    MY: { code: 'MYR', isBase: false }, // Malaysia → MYR Enter
    VN: { code: 'VND', isBase: false }, // Vietnam → VND Enter
    ID: { code: 'IDR', isBase: false }, // Indonesia → IDR Enter
    PH: { code: 'PHP', isBase: false }, // Philippines → PHP Enter
  };

  const savedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
  const nationality = savedUser?.nationality || 'KR';
  const natCurrency = NATIONALITY_CURRENCY[nationality] || NATIONALITY_CURRENCY['KR'];
  // Korean users Foreign currency Enter (100 JPY → KRW), Foreign users Home Currency entry
  const defaultForeign = natCurrency.isBase? '100' : '';
  const defaultKrw = natCurrency.isBase? '' : '10000';
  const defaultSelected = natCurrency.isBase? 'JPY' : natCurrency.code;
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [krwInput, setKrwInput] = useState(defaultKrw);
  const [SelectedCurrency, setSelectedCurrency] = useState(defaultSelected);
  const [foreignInput, setForeignInput] = useState(defaultForeign);
  const [tab, setTab] = useState('exchange'); // exchange | budget
  const [budgetItems, setBudgetItems] = useState(
    BUDGETS.map(b => ({...b, amount: '' }))
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
      // USD Basis-based input converted to KRW
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=USD&to=${codes}`);
      const data = await res.json();
      const usdToKrw = data.rates['KRW'];
      // each Currency — KRW Basis EXCHANGE Calculate (1 KRW =? Foreign currency)
      const krwRates = {};
      CURRENCIES.forEach(c => {
        if (data.rates[c.code]) {
          krwRates[c.code] = data.rates[c.code] / usdToKrw;
        }
      });
      setRates(krwRates);
      setLastUpdated(data.date);
    } catch (e) {
      setError('Could not load exchange rates. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  // KRW → Foreign currency
  const toForeign = useCallback((krw, code) => {
    if (!rates ||!krw) return '';
    const val = parseFloat(krw.replace(/,/g, '')) * (rates[code] || 0);
    if (code === 'JPY' || code === 'IDR' || code === 'VND' || code === 'PHP') {
      return Math.round(val).toLocaleString();
    }
    return val.toFixed(2);
  }, [rates]);

  // Foreign currency → KRW
  const toKRW = useCallback((foreign, code) => {
    if (!rates ||!foreign ||!rates[code]) return '';
    const val = parseFloat(foreign.replace(/,/g, '')) / rates[code];
    return Math.round(val).toLocaleString();
  }, [rates]);

  const handleKrwChange = (val) => {
    const raw = val.replace(/[^0-9]/g, '');
    setKrwInput(raw? parseInt(raw).toLocaleString() : '');
    setForeignInput('');
  };

  const handleForeignChange = (val) => {
    const raw = val.replace(/[^0-9.]/g, '');
    setForeignInput(raw);
    setKrwInput('');
  };

  const cur = CURRENCIES.find(c => c.code === SelectedCurrency);

  // Budget calculation
  const budgetRate = rates?.[budgetCurrency] || 1;
  const totalForeign = budgetItems.reduce((sum, item) => {
    const amt = parseFloat(item.amount) || 0;
    if (item.label === 'Stays per night') return sum + amt * nights;
    if (item.label === 'Food per day' || item.label === 'TRANSIT per day') return sum + amt * days;
    return sum + amt;
  }, 0);
  const totalKRW = Math.round(totalForeign / budgetRate);

  const updateBudget = (i, val) => {
    setBudgetItems(prev => prev.map((item, j) => j === i? {...item, amount: val } : item));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 500, color: '#1E2A3A', letterSpacing: -0.8 }}>💱 EXCHANGE & Budget</div>
        {lastUpdated && (
          <div style={{ fontSize: 12, color: '#8A919C' }}>Updated: {lastUpdated} · <span style={{ cursor: 'pointer', color: '#1E2A3A' }} onClick={fetchRates}>Refresh</span></div>
        )}
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 4, background: '#F5F4F0', borderRadius: 3, padding: 4 }}>
        {[['exchange', '💱 EXCHANGE Calculator'], ['budget', '💰 TRAVEL Budget Calculator']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: '9px 4px', borderRadius: 9, border: 'none', background: tab === key? 'white' : 'transparent', color: tab === key? '#1E2A3A' : '#8A919C', fontSize: 13, fontWeight: tab === key? 700 : 500, cursor: 'pointer', boxShadow: tab === key? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {loading? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A919C' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💱</div>
          <div>EXCHANGE Info Loading...</div>
        </div>
      ) : error? (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 3, padding: '16px 20px', color: '#dc2626', fontSize: 13 }}>
          ⚠️ {error}
          <button onClick={fetchRates} style={{ marginLeft: 10, color: '#1E2A3A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Try again</button>
        </div>
      ) : tab === 'exchange'? (
        <>
          {/* EXCHANGE Calculator */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A', marginBottom: 14 }}>🔄 EXCHANGE Calculator</div>

            {/* Currency SELECT */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setSelectedCurrency(c.code); setForeignInput('100'); setKrwInput(''); }}
                  style={{ padding: '6px 12px', borderRadius: 2, border: `1.5px solid ${SelectedCurrency === c.code? '#1E2A3A' : '#E2E0DC'}`, background: SelectedCurrency === c.code? '#EEEDEA' : 'white', color: SelectedCurrency === c.code? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: SelectedCurrency === c.code? 700 : 500, cursor: 'pointer', transition: 'all 0.1s' }}>
                  {c.flag} {c.code}
                </button>
              ))}
            </div>

            {/* Calculate Enter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* KRW Enter */}
              <div style={{ background: '#FAFAF8', border: '1.5px solid #E2E0DC', borderRadius: 3, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 6, fontWeight: 600 }}>🇰🇷 Korea KRW (KRW)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={krwInput}
                    onChange={e => handleKrwChange(e.target.value)}
                    onFocus={() => setForeignInput('')}
                    placeholder="Amount Enter"
                    style={{ flex: 1, fontSize: 22, fontWeight: 800, color: '#1E2A3A', border: 'none', background: 'none', outline: 'none' }}
                  />
                  <span style={{ fontSize: 16, color: '#8A919C', fontWeight: 600 }}>₩</span>
                </div>
              </div>

              {/* Arrow */}
              <div style={{ textAlign: 'center', fontSize: 20, color: '#E2E0DC' }}>⇅</div>

              {/* Foreign currency Enter */}
              <div style={{ background: '#EEEDEA', border: '1.5px solid #E2E0DC', borderRadius: 3, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: '#1E2A3A', marginBottom: 6, fontWeight: 600 }}>
                  {cur?.flag} {cur?.country} ({SelectedCurrency})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    value={foreignInput || (krwInput? toForeign(krwInput, SelectedCurrency) : '')}
                    onChange={e => handleForeignChange(e.target.value)}
                    onFocus={() => setKrwInput('')}
                    placeholder="Amount Enter"
                    style={{ flex: 1, fontSize: 22, fontWeight: 800, color: '#1E2A3A', border: 'none', background: 'none', outline: 'none' }}
                  />
                  <span style={{ fontSize: 16, color: '#818cf8', fontWeight: 600 }}>{SelectedCurrency}</span>
                </div>
                {foreignInput && (
                  <div style={{ fontSize: 12, color: '#1E2A3A', marginTop: 4 }}>
                    = ₩{toKRW(foreignInput, SelectedCurrency)}
                  </div>
                )}
              </div>

              {/* EXCHANGE Basis hint */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 3, padding: '10px 14px', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                💡 {cur?.flag} {(SelectedCurrency === 'JPY' || SelectedCurrency === 'IDR' || SelectedCurrency === 'VND' || SelectedCurrency === 'PHP')? '100' : '1'} {SelectedCurrency} = ₩{rates?.[SelectedCurrency]? Math.round((SelectedCurrency === 'JPY' || SelectedCurrency === 'IDR' || SelectedCurrency === 'VND' || SelectedCurrency === 'PHP'? 100 : 1) / rates[SelectedCurrency]).toLocaleString() : '-'}
              </div>
            </div>

            {/* Quick Amount button */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 8, fontWeight: 600 }}>Quick Amount SELECT</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['10000', '50000', '100000', '500000', '1000000'].map(amt => (
                  <button key={amt} onClick={() => { setKrwInput(parseInt(amt).toLocaleString()); setForeignInput(''); }}
                    style={{ padding: '6px 12px', background: krwInput === parseInt(amt).toLocaleString()? '#1E2A3A' : '#F5F4F0', color: krwInput === parseInt(amt).toLocaleString()? 'white' : '#555', border: 'none', borderRadius: 2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {parseInt(amt).toLocaleString()} KRW
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ALL EXCHANGE List */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #F5F4F0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A' }}>📊 Today's rates</div>
              <div style={{ fontSize: 11, color: '#8A919C', marginTop: 2 }}>Foreign currency → KRW Basis</div>
            </div>
            <div>
              {CURRENCIES.map((c, i) => {
                const rate = rates[c.code]; // 1 KRW = rate Foreign currency
                const unit = (c.code === 'JPY' || c.code === 'IDR' || c.code === 'VND' || c.code === 'PHP')? 100 : 1;
                const krwPerUnit = rate? Math.round(unit / rate) : null;
                const displayKRW = krwPerUnit? krwPerUnit.toLocaleString() : '-';
                return (
                  <div key={c.code}
                    onClick={() => { setSelectedCurrency(c.code); setTab('exchange'); setKrwInput(''); setForeignInput('100'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < CURRENCIES.length - 1? '1px solid #FAFAF8' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <span style={{ fontSize: 24, flexShrink: 0 }}>{c.flag}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{c.country}</div>
                      <div style={{ fontSize: 11, color: '#8A919C' }}>{c.name} · {c.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1E2A3A' }}>₩{displayKRW}</div>
                      <div style={{ fontSize: 10, color: '#8A919C' }}>{unit} {c.code}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Budget Calculator Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A', marginBottom: 14 }}>⚙️ TRAVEL Basic Settings</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {/* Currency SELECT */}
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 6, fontWeight: 600 }}>Local currency</div>
                <select value={budgetCurrency} onChange={e => setBudgetCurrency(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none' }}>
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.country} ({c.code})</option>
                  ))}
                </select>
              </div>
              {/* TRAVEL Period */}
              <div>
                <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 6, fontWeight: 600 }}>Stays</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setNights(n => Math.max(1, n-1))}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#F5F4F0', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{nights}N</span>
                  <button onClick={() => setNights(n => n+1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#F5F4F0', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 6, fontWeight: 600 }}>TRAVELDcan</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setDays(d => Math.max(1, d-1))}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#F5F4F0', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{days}D</span>
                  <button onClick={() => setDays(d => d+1)}
                    style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #eee', background: '#F5F4F0', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
              </div>
            </div>
          </div>

          {/* Budget by category */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 3, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A', marginBottom: 4 }}>📋 Budget by category</div>
            <div style={{ fontSize: 11, color: '#8A919C', marginBottom: 14 }}>Local currency Basisto Enter</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {budgetItems.map((item, i) => {
                const amt = parseFloat(item.amount) || 0;
                let multiply = 1;
                let label = '';
                if (item.label === 'Stays per night') { multiply = nights; label = `${nights}N`; }
                if (item.label === 'Food per day' || item.label === 'TRANSIT per day') { multiply = days; label = `${days}D`; }
                const subtotal = amt * multiply;
                const subtotalKRW = Math.round(subtotal / budgetRate);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 3, fontWeight: 600 }}>
                        {item.label} {label && <span style={{ color: '#8A919C', fontWeight: 400 }}>{label}</span>}
                      </div>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={e => updateBudget(i, e.target.value)}
                        placeholder="0"
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E0DC', borderRadius: 9, fontSize: 14, outline: 'none', fontWeight: 600 }}
                      />
                    </div>
                    {amt > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1E2A3A' }}>{subtotal.toLocaleString()} {budgetCurrency}</div>
                        <div style={{ fontSize: 10, color: '#8A919C' }}>≈ ₩{subtotalKRW.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          {totalForeign > 0 && (
            <div style={{ background: '#1E2A3A', borderRadius: 3, padding: '20px' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>🧳 {nights}N {days}D est. Total Budget</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 4 }}>
                ₩{totalKRW.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                ≈ {Math.round(totalForeign).toLocaleString()} {budgetCurrency}
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>1 Basis per day Avg</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>₩{Math.round(totalKRW / days).toLocaleString()}/D</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>Local rate</div>
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
