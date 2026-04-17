import React from 'react';

export default function PackageDetail({ pkg, onBackToResults, onBook }) {
  return (
    <div className="page-stack">
      <section className="detail-hero">
        <div>
          <p className="eyebrow">Product Details</p>
          <h2>{pkg.title}</h2>
          <p>{pkg.summary}</p>
          <div className="detail-tags">
            {pkg.highlights.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className="detail-price-card">
          <span>1 Basis</span>
          <strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong>
          <p>{pkg.durationNights}N {pkg.durationDays}D · Rating {pkg.rating}</p>
          <button className="primary-btn" onClick={onBook}> Product Reservation</button>
          <button className="ghost-btn" onClick={onBackToResults}>Back to results</button>
        </div>
      </section>

      <section className="detail-layout">
        <article className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Schedule summary</p>
              <h3>TRAVEL SCHEDULE</h3>
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
            <p className="eyebrow">Included</p>
            <ul className="bullet-list">
              {pkg.inclusions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="section-card compact">
            <p className="eyebrow">Excluded</p>
            <ul className="bullet-list">
              {pkg.exclusions.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div className="section-card compact">
            <p className="eyebrow">Operation info</p>
            <ul className="summary-list">
              <li><span>Region</span><strong>{pkg.location}</strong></li>
              <li><span>Min travelers</span><strong>{pkg.minimumTravelers}name</strong></li>
              <li><span>Category</span><strong>{pkg.categoryLabel}</strong></li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
