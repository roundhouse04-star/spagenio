import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import PackageDetail from './pages/PackageDetail';
import Booking from './pages/Booking';

const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = isLocalHost ? 'http://localhost:19080' : '/travel';

const initialSearch = {
  destination: 'Osaka',
  startDate: '',
  endDate: '',
  travelers: 2,
  budget: 'all',
  category: 'all',
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} @ ${url} :: ${text.slice(0, 200)}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`Not JSON @ ${url} :: ${text.slice(0, 200)}`);
  }

  return JSON.parse(text);
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [search, setSearch] = useState(initialSearch);
  const [results, setResults] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const stats = useMemo(() => ({
    resultCount: results.length,
    bookingCount: bookings.length,
    featuredCount: featured.length,
  }), [results.length, bookings.length, featured.length]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setBooting(true);
        setError('');

        const [featuredRes, bookingRes] = await Promise.all([
          fetchJson(`${API_BASE}/api/packages/featured`),
          fetchJson(`${API_BASE}/api/bookings`),
        ]);

        setFeatured(featuredRes);
        setBookings(bookingRes);
      } catch (err) {
        console.error(err);
        setError(`초기 데이터를 불러오지 못했습니다. ${err.message || err}`);
      } finally {
        setBooting(false);
      }
    };

    bootstrap();
  }, []);

  const runSearch = async (nextSearch) => {
    setLoading(true);
    setError('');
    setNotice('');
    setSearch(nextSearch);

    const params = new URLSearchParams();
    Object.entries(nextSearch).forEach(([key, value]) => {
      if (value !== '' && value !== 'all' && value !== null && value !== undefined) {
        params.append(key, value);
      }
    });

    try {
      const data = await fetchJson(`${API_BASE}/api/packages?${params.toString()}`);
      setResults(data);
      setCurrentPage('results');
      if (!data.length) {
        setNotice('조건에 맞는 상품이 없어 비슷한 추천 상품이 보이도록 검색 조건을 조금 넓혀보는 것을 추천합니다.');
      }
    } catch (err) {
      console.error(err);
      setError('검색 결과를 불러오는 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openPackage = async (packageId) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJson(`${API_BASE}/api/packages/${packageId}`);
      setSelectedPackage(data);
      setCurrentPage('detail');
    } catch (err) {
      console.error(err);
      setError('상품 상세 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const openBooking = () => {
    setCurrentPage('booking');
  };

  const submitBooking = async (bookingPayload) => {
    setLoading(true);
    setError('');
    try {
      const saved = await fetchJson(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload),
      });

      setBookings((prev) => [saved, ...prev]);
      setNotice(`예약이 완료되었습니다. 예약번호는 ${saved.bookingCode} 입니다.`);
      setCurrentPage('home');
    } catch (err) {
      console.error(err);
      setError(`예약 처리 중 오류가 발생했습니다. ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { key: 'home', label: '메인' },
    { key: 'results', label: '검색결과' },
    { key: 'detail', label: '상세' },
    { key: 'booking', label: '예약' },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SPAGENIO TRAVEL PLATFORM</p>
          <h1>Travel App</h1>
        </div>
        <nav className="topnav">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={currentPage === item.key ? 'nav-btn active' : 'nav-btn'}
              onClick={() => {
                if (item.key === 'detail' && !selectedPackage) return;
                setCurrentPage(item.key);
              }}
              disabled={(item.key === 'results' && !results.length) || (item.key === 'detail' && !selectedPackage)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="status-bar">
        <div className="status-chip">추천상품 {stats.featuredCount}</div>
        <div className="status-chip">검색결과 {stats.resultCount}</div>
        <div className="status-chip">예약건수 {stats.bookingCount}</div>
        {loading && <div className="status-chip loading">불러오는 중...</div>}
      </section>

      {error && <div className="message error">{error}</div>}
      {notice && <div className="message success">{notice}</div>}
      {booting && <div className="message neutral">서비스 초기 데이터를 준비하고 있습니다...</div>}

      <main className="page-wrap">
        {currentPage === 'home' && (
          <Home
            search={search}
            featured={featured}
            recentBookings={bookings.slice(0, 3)}
            onSearch={runSearch}
            onOpenPackage={openPackage}
          />
        )}

        {currentPage === 'results' && (
          <SearchResults
            search={search}
            results={results}
            onSearch={runSearch}
            onOpenPackage={openPackage}
          />
        )}

        {currentPage === 'detail' && selectedPackage && (
          <PackageDetail
            pkg={selectedPackage}
            onBackToResults={() => setCurrentPage('results')}
            onBook={openBooking}
          />
        )}

        {currentPage === 'booking' && (
          <Booking
            pkg={selectedPackage}
            search={search}
            loading={loading}
            onBack={() => setCurrentPage(selectedPackage ? 'detail' : 'home')}
            onSubmit={submitBooking}
          />
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
