import React from 'react';

export default function PackageDetail({ pkg, onBackToResults, onBook }) {
  return (
    <div className="page-stack">
      <section className="detail-hero">
        <div>
          <p className="eyebrow">상품 상세</p>
          <h2>{pkg.title}</h2>
          <p>{pkg.summary}</p>
          <div className="detail-tags">
            {pkg.highlights.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className="detail-price-card">
          <span>1인 기준</span>
          <strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong>
          <p>{pkg.durationNights}박 {pkg.durationDays}일 · 평점 {pkg.rating}</p>
          <button className="primary-btn" onClick={onBook}>이 상품 예약하기</button>
          <button className="ghost-btn" onClick={onBackToResults}>검색결과로 돌아가기</button>
        </div>
      </section>

      <section className="detail-layout">
        <article className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">일정 개요</p>
              <h3>여행 일정</h3>
            </div>
          </div>
          <div className="timeline-list">
            {pkg.itinerary.map((item, index) => (
              <div className="timeline-item" key={`${item.day}-${index}`}>
                <div className="timeline-day">DAY {item.day}</div>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <aside className="detail-side">
          <div className="section-card compact">
            <p className="eyebrow">포함사항</p>
            <ul className="bullet-list">
              {pkg.inclusions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="section-card compact">
            <p className="eyebrow">불포함사항</p>
            <ul className="bullet-list">
              {pkg.exclusions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="section-card compact">
            <p className="eyebrow">운영정보</p>
            <ul className="summary-list">
              <li><span>지역</span><strong>{pkg.location}</strong></li>
              <li><span>최소인원</span><strong>{pkg.minimumTravelers}명</strong></li>
              <li><span>카테고리</span><strong>{pkg.categoryLabel}</strong></li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
