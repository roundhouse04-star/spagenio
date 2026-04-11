import React, { useState } from 'react';

export default function Booking({ pkg, search, loading, onBack, onSubmit }) {
  const [form, setForm] = useState({
    customerName: '',
    email: '',
    phone: '',
    travelers: search.travelers || 2,
    travelDate: search.startDate || '',
    requests: '',
  });

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!pkg) return;

    onSubmit({
      packageId: pkg.id,
      packageTitle: pkg.title,
      customerName: form.customerName,
      email: form.email,
      phone: form.phone,
      travelers: Number(form.travelers),
      travelDate: form.travelDate,
      requests: form.requests,
      totalPrice: Number(form.travelers) * pkg.pricePerPerson,
    });
  };

  if (!pkg) {
    return (
      <section className="section-card">
        <p className="empty-state">예약할 상품을 먼저 선택해주세요.</p>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">예약</p>
            <h3>{pkg.title}</h3>
            <p>고객 정보와 여행 일정을 입력하면 백엔드에 예약 데이터가 저장됩니다.</p>
          </div>
        </div>
        <div className="booking-layout">
          <form className="booking-form" onSubmit={submit}>
            <div className="form-grid">
              <label>
                예약자명
                <input required value={form.customerName} onChange={(e) => update('customerName', e.target.value)} />
              </label>
              <label>
                이메일
                <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              </label>
              <label>
                연락처
                <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              </label>
              <label>
                인원수
                <input required type="number" min={pkg.minimumTravelers} max="10" value={form.travelers} onChange={(e) => update('travelers', e.target.value)} />
              </label>
              <label>
                출발일
                <input required type="date" value={form.travelDate} onChange={(e) => update('travelDate', e.target.value)} />
              </label>
              <label className="full-width">
                요청사항
                <textarea rows="5" value={form.requests} onChange={(e) => update('requests', e.target.value)} placeholder="예: 비건식, 얼리 체크인, 공항 픽업" />
              </label>
            </div>
            <div className="search-actions">
              <button className="primary-btn" type="submit" disabled={loading}>예약 완료</button>
              <button className="ghost-btn" type="button" onClick={onBack}>이전으로</button>
            </div>
          </form>

          <aside className="booking-summary section-card compact">
            <p className="eyebrow">예약 요약</p>
            <ul className="summary-list">
              <li><span>상품명</span><strong>{pkg.title}</strong></li>
              <li><span>목적지</span><strong>{pkg.location}</strong></li>
              <li><span>여행기간</span><strong>{pkg.durationNights}박 {pkg.durationDays}일</strong></li>
              <li><span>1인 요금</span><strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong></li>
              <li><span>예상 총액</span><strong>₩ {(Number(form.travelers) * pkg.pricePerPerson).toLocaleString()}</strong></li>
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}
