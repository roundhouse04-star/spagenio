import React, { useMemo, useState } from 'react';

const budgetOptions = [
  { value: 'all', label: '예산 전체' },
  { value: 'economy', label: '가성비' },
  { value: 'premium', label: '프리미엄' },
  { value: 'luxury', label: '럭셔리' },
];

const categoryOptions = [
  { value: 'all', label: '카테고리 전체' },
  { value: 'city', label: '도시' },
  { value: 'resort', label: '리조트' },
  { value: 'family', label: '가족여행' },
  { value: 'honeymoon', label: '허니문' },
];

function SearchPanel({ initialSearch, onSearch }) {
  const [form, setForm] = useState(initialSearch);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = (event) => {
    event.preventDefault();
    onSearch(form);
  };

  return (
    <form className="search-panel" onSubmit={submit}>
      <div className="search-grid">
        <label>
          목적지
          <input value={form.destination} onChange={(e) => update('destination', e.target.value)} placeholder="예: Osaka, Tokyo, Bali" />
        </label>
        <label>
          출발일
          <input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
        </label>
        <label>
          도착일
          <input type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} />
        </label>
        <label>
          인원수
          <input type="number" min="1" max="10" value={form.travelers} onChange={(e) => update('travelers', Number(e.target.value))} />
        </label>
        <label>
          예산
          <select value={form.budget} onChange={(e) => update('budget', e.target.value)}>
            {budgetOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          여행타입
          <select value={form.category} onChange={(e) => update('category', e.target.value)}>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="search-actions">
        <button className="primary-btn" type="submit">검색 시작</button>
        <button className="ghost-btn" type="button" onClick={() => setForm(initialSearch)}>초기화</button>
      </div>
    </form>
  );
}

export default function Home({ search, featured, recentBookings, onSearch, onOpenPackage }) {
  const heroStats = useMemo(() => ([
    { value: '120+', label: '제휴 상품' },
    { value: '24/7', label: '실시간 상담' },
    { value: '4단계', label: '예약 플로우' },
  ]), []);

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">맞춤형 여행 플랫폼 UI</p>
          <h2>메인 / 검색결과 / 상세 / 예약까지 한 번에 연결되는 여행 서비스</h2>
          <p>
            지금 버전은 운영에 바로 붙일 수 있도록 여행 검색, 추천 상품, 예약 생성, 최근 예약 확인 흐름까지 모두 연결되어 있습니다.
          </p>
          <div className="hero-stats">
            {heroStats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-side">
          <div className="highlight-box">
            <span>이번 주 인기</span>
            <strong>오사카 벚꽃 시티 브레이크</strong>
            <p>항공 + 호텔 + 공항 픽업 포함, 주말 단기 일정에 최적화된 패키지</p>
          </div>
          <div className="highlight-box subtle">
            <span>운영 포인트</span>
            <strong>DB 연동 완료</strong>
            <p>패키지 목록 조회와 예약 저장이 백엔드 영속화 레이어와 연결됩니다.</p>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">검색</p>
            <h3>여행 조건을 입력하고 바로 결과 페이지로 이동</h3>
          </div>
        </div>
        <SearchPanel initialSearch={search} onSearch={onSearch} />
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">추천 상품</p>
            <h3>메인페이지 카드 섹션</h3>
          </div>
        </div>
        <div className="card-grid">
          {featured.map((pkg) => (
            <article className="travel-card" key={pkg.id}>
              <div className="travel-card-top">
                <span className="pill">{pkg.categoryLabel}</span>
                <span className="rating">★ {pkg.rating}</span>
              </div>
              <h4>{pkg.title}</h4>
              <p>{pkg.summary}</p>
              <div className="meta-row">
                <span>{pkg.location}</span>
                <span>{pkg.durationNights}박 {pkg.durationDays}일</span>
              </div>
              <div className="price-row">
                <strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong>
                <button className="ghost-btn" onClick={() => onOpenPackage(pkg.id)}>상세보기</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">최근 예약</p>
            <h3>백엔드 저장 데이터 미리보기</h3>
          </div>
        </div>
        <div className="booking-list">
          {recentBookings.length ? recentBookings.map((booking) => (
            <div className="booking-row" key={booking.id}>
              <div>
                <strong>{booking.customerName}</strong>
                <p>{booking.packageTitle}</p>
              </div>
              <div>
                <span>{booking.bookingCode}</span>
                <p>{booking.travelDate}</p>
              </div>
            </div>
          )) : <p className="empty-state">아직 생성된 예약이 없습니다. 검색 후 예약을 진행해보세요.</p>}
        </div>
      </section>
    </div>
  );
}
