import React, { useMemo, useState } from 'react';

export default function SearchResults({ search, results, onSearch, onOpenPackage }) {
  const [sortBy, setSortBy] = useState('recommended');

  const sortedResults = useMemo(() => {
    const items = [...results];
    if (sortBy === 'priceAsc') {
      items.sort((a, b) => a.pricePerPerson - b.pricePerPerson);
    } else if (sortBy === 'ratingDesc') {
      items.sort((a, b) => b.rating - a.rating);
    }
    return items;
  }, [results, sortBy]);

  return (
    <div className="page-stack">
      <section className="section-card compact">
        <div className="section-heading split">
          <div>
            <p className="eyebrow">검색결과</p>
            <h3>{search.destination || '전체 지역'} 추천 여행상품</h3>
            <p>{search.travelers}명 기준, 선택한 조건에 맞춘 여행 옵션입니다.</p>
          </div>
          <div className="toolbar">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recommended">추천순</option>
              <option value="priceAsc">낮은 가격순</option>
              <option value="ratingDesc">평점 높은순</option>
            </select>
            <button className="ghost-btn" onClick={() => onSearch(search)}>새로고침</button>
          </div>
        </div>
      </section>

      <section className="results-layout">
        <aside className="filter-panel section-card compact">
          <p className="eyebrow">조건 요약</p>
          <ul className="summary-list">
            <li><span>목적지</span><strong>{search.destination || '전체'}</strong></li>
            <li><span>출발일</span><strong>{search.startDate || '미정'}</strong></li>
            <li><span>도착일</span><strong>{search.endDate || '미정'}</strong></li>
            <li><span>인원</span><strong>{search.travelers}명</strong></li>
            <li><span>예산</span><strong>{search.budget}</strong></li>
            <li><span>카테고리</span><strong>{search.category}</strong></li>
          </ul>
        </aside>

        <div className="results-column">
          {sortedResults.length ? sortedResults.map((pkg) => (
            <article className="result-card" key={pkg.id}>
              <div className="result-copy">
                <div className="travel-card-top">
                  <span className="pill">{pkg.categoryLabel}</span>
                  <span className="rating">★ {pkg.rating}</span>
                </div>
                <h4>{pkg.title}</h4>
                <p>{pkg.summary}</p>
                <div className="result-highlights">
                  {pkg.highlights.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
                </div>
              </div>
              <div className="result-side">
                <div className="meta-block">
                  <strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong>
                  <span>1인 기준 / {pkg.durationNights}박 {pkg.durationDays}일</span>
                </div>
                <button className="primary-btn" onClick={() => onOpenPackage(pkg.id)}>상세 확인</button>
              </div>
            </article>
          )) : <div className="section-card"><p className="empty-state">검색 결과가 없습니다.</p></div>}
        </div>
      </section>
    </div>
  );
}
