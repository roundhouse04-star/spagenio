import React, { useEffect, useState } from 'react';
import { COUNTRY_INFO } from '../countryInfo';
import { TRAVEL_STYLES } from '../travelStyles';

const WMO_CODE = {
  0: { label: '맑음', icon: '☀️' },
  1: { label: '대체로 맑음', icon: '🌤️' },
  2: { label: '부분 흐림', icon: '⛅' },
  3: { label: '흐림', icon: '☁️' },
  45: { label: '안개', icon: '🌫️' },
  48: { label: '짙은 안개', icon: '🌫️' },
  51: { label: '가벼운 이슬비', icon: '🌦️' },
  53: { label: '이슬비', icon: '🌦️' },
  61: { label: '가벼운 비', icon: '🌧️' },
  63: { label: '비', icon: '🌧️' },
  65: { label: '강한 비', icon: '⛈️' },
  71: { label: '가벼운 눈', icon: '🌨️' },
  73: { label: '눈', icon: '❄️' },
  80: { label: '소나기', icon: '🌦️' },
  85: { label: '눈 소나기', icon: '🌨️' },
  95: { label: '뇌우', icon: '⛈️' },
};

function WeatherWidget({ country, info }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_weather = async () => {
      if (!info) return;
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${info.lat}&longitude=${info.lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&timezone=${info.timezone}`
        );
        const data = await res.json();
        setWeather(data.current);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch_weather();
  }, [country]);

  if (loading) return <div style={{ fontSize: 13, color: '#9ca3af' }}>날씨 불러오는 중...</div>;
  if (!weather) return null;

  const wmo = WMO_CODE[weather.weather_code] || WMO_CODE[Math.floor(weather.weather_code / 10) * 10] || { label: '알 수 없음', icon: '🌡️' };

  return (
    <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>🌡️ 현재 날씨 ({info.capital})</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 36 }}>{wmo.icon}</span>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#1a1a2e' }}>{Math.round(weather.temperature_2m)}°C</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{wmo.label}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>💧 습도 {weather.relative_humidity_2m}%</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>💨 {Math.round(weather.wind_speed_10m)} km/h</div>
        </div>
      </div>
    </div>
  );
}

function ExchangeWidget({ currency }) {
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_rate = async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=KRW&to=${currency}`);
        const data = await res.json();
        setRate(data.rates?.[currency]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch_rate();
  }, [currency]);

  if (loading) return <div style={{ fontSize: 13, color: '#9ca3af' }}>환율 불러오는 중...</div>;
  if (!rate) return null;

  const per10k = rate * 10000;
  const per100k = rate * 100000;
  const isLarge = ['JPY', 'IDR', 'VND', 'PHP'].includes(currency);

  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 10 }}>💱 실시간 환율</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: 'white', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>₩10,000</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>
            {isLarge ? Math.round(per10k).toLocaleString() : per10k.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{currency}</div>
        </div>
        <div style={{ flex: 1, background: 'white', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>₩100,000</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>
            {isLarge ? Math.round(per100k).toLocaleString() : per100k.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{currency}</div>
        </div>
      </div>
    </div>
  );
}

export default function CountryPanel({ countries = [], planTitle = '' }) {
  const [selectedCountry, setSelectedCountry] = useState(countries[0] || '');

  useEffect(() => {
    if (countries.length > 0) setSelectedCountry(countries[0]);
  }, [countries]);

  if (countries.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🌍</div>
        <div style={{ fontSize: 13 }}>장소를 추가하면<br/>여행 정보가 표시돼요!</div>
      </div>
    );
  }

  const info = COUNTRY_INFO[selectedCountry];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 나라 탭 */}
      {countries.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {countries.map(c => {
            const ci = COUNTRY_INFO[c];
            return (
              <button key={c} onClick={() => setSelectedCountry(c)}
                style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${selectedCountry === c ? '#4f46e5' : '#eee'}`, background: selectedCountry === c ? '#eef2ff' : 'white', color: selectedCountry === c ? '#4f46e5' : '#6b7280', fontSize: 12, fontWeight: selectedCountry === c ? 700 : 500, cursor: 'pointer' }}>
                {ci?.flag || '🌍'} {c}
              </button>
            );
          })}
        </div>
      )}

      {!info ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          {selectedCountry} 정보를 준비 중이에요
        </div>
      ) : (
        <>
          {/* 날씨 */}
          <WeatherWidget country={selectedCountry} info={info} />

          {/* 환율 */}
          <ExchangeWidget currency={info.currency} />

          {/* 비자 */}
          <div style={{ background: info.visa.required ? '#fef2f2' : '#f0fdf4', border: `1px solid ${info.visa.required ? '#fecaca' : '#bbf7d0'}`, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: info.visa.required ? '#dc2626' : '#16a34a', marginBottom: 4 }}>
              {info.visa.required ? '🛂 비자 필요' : '✅ 무비자'}
            </div>
            <div style={{ fontSize: 12, color: '#374141' }}>{info.visa.note}</div>
          </div>

          {/* 전기 콘센트 */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>🔌 전기 콘센트</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 3 }}>{info.plug.type} · {info.plug.voltage}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{info.plug.note}</div>
          </div>

          {/* 결제·물 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #eee', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>💳 결제</div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{info.payment}</div>
            </div>
            <div style={{ flex: 1, background: '#f9fafb', border: '1px solid #eee', borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>💧 물</div>
              <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{info.water}</div>
            </div>
          </div>

          {/* SIM */}
          <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>📱 SIM 카드</div>
            <div style={{ fontSize: 12, color: '#374151' }}>{info.sim}</div>
          </div>

          {/* 긴급전화 */}
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>🚨 긴급전화</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(info.emergency).map(([type, num]) => (
                <div key={type} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#dc2626' }}>{num}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{type === 'police' ? '경찰' : type === 'fire' ? '소방' : type === 'ambulance' ? '구급' : type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 필수 준비물 */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>🎒 필수 준비물</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {info.mustPack.map((item, i) => (
                <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#f3f4f6', color: '#374151', fontWeight: 500 }}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* 현지 꿀팁 */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>💡 현지 꿀팁</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {info.tips.map((tip, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, fontSize: 12, color: '#374151' }}>
                  <span style={{ color: '#4f46e5', flexShrink: 0, fontWeight: 700 }}>·</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 계절별 날씨 */}
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>🌤️ 계절별 날씨</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['spring', '봄 🌸'], ['summer', '여름 ☀️'], ['fall', '가을 🍂'], ['winter', '겨울 ❄️']].map(([key, label]) => (
                info.weather[key] && (
                  <div key={key} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span style={{ color: '#6b7280', flexShrink: 0, minWidth: 60 }}>{label}</span>
                    <span style={{ color: '#374151' }}>{info.weather[key]}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
