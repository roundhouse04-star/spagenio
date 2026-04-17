import React, { useMemo, useState } from 'react';

const budgetOptions = [
  { value: 'all', label: 'Budget ALL' },
  { value: 'economy', label: 'Budget' },
  { value: 'premium', label: 'Premium' },
  { value: 'luxury', label: 'Luxury' },
];

const categoryOptions = [
  { value: 'all', label: 'Category ALL' },
  { value: 'city', label: 'City' },
  { value: 'resort', label: 'Resort' },
  { value: 'family', label: 'Family travel' },
  { value: 'honeymoon', label: 'Honeymoon' },
];

function SearchPanel({ initialSearch, onSearch }) {
  const [form, setForm] = useState(initialSearch);
  const update = (key, value) => setForm((prev) => ({...prev, [key]: value }));
  const submit = (event) => { event.preventDefault(); onSearch(form); };

  return (
    <form className="search-panel" onSubmit={submit}>
      <div className="search-grid">
        <label>Destination<input value={form.destination} onChange={(e) => update('destination', e.target.value)} placeholder="e.g. Osaka, Tokyo, Bali" /></label>
        <label>Departure date<input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} /></label>
        <label>Arrival date<input type="date" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} /></label>
        <label>Travelers<input type="number" min="1" ="10" value={form.travelers} onChange={(e) => update('travelers', Number(e.target.value))} /></label>
        <label>Budget<select value={form.budget} onChange={(e) => update('budget', e.target.value)}>{budgetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        <label>TRAVELType<select value={form.category} onChange={(e) => update('category', e.target.value)}>{categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
      </div>
      <div className="search-actions">
        <button className="primary-btn" type="submit">Start search</button>
        <button className="ghost-btn" type="button" onClick={() => setForm(initialSearch)}>Reset</button>
      </div>
    </form>
  );
}

export default function Home({ search, featured, recentBookings, onSearch, onOpenPackage, onOpenBookingDetail }) {
  const heroStats = useMemo(() => ([
    { value: '120+', label: 'Partner products' },
    { value: '24/7', label: '24/7 support' },
    { value: '4step', label: 'Reservation flow' },
  ]), []);

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Personalized TRAVEL platform UI</p>
          <h2>Main / Search results / Details / Reservation — connected TRAVEL Service</h2>
          <p>The current version is production-ready — TRAVEL SEARCH, Recommended Product, Reservation Create, recent reservation check flow — all connected.</p>
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
            <span>This week Popular</span>
            <strong>Osaka Cherry blossom City Break</strong>
            <p>Flight + Hotel + Airport Pickup included, Weekend optimized package for short trips</p>
          </div>
          <div className="highlight-box subtle">
            <span>Operation points</span>
            <strong>DB Integrated DONE</strong>
            <p>package List Query and Reservation SAVE connected to backend persistence layer.</p>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SEARCH</p>
            <h3>Enter travel criteria and go to the results page</h3>
          </div>
        </div>
        <SearchPanel initialSearch={search} onSearch={onSearch} />
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recommended Product</p>
            <h3>Main page card Section</h3>
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
                <span>{pkg.durationNights}N {pkg.durationDays}D</span>
              </div>
              <div className="price-row">
                <strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong>
                <button className="ghost-btn" onClick={() => onOpenPackage(pkg.id)}>DetailsView</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent reservations</p>
            <h3>backend SAVE data Preview</h3>
          </div>
        </div>
        <div className="booking-list">
          {recentBookings.length? recentBookings.map((booking) => (
            <div className="booking-row clickable" key={booking.id} onClick={() => onOpenBookingDetail(booking)}>
              <div>
                <strong>{booking.customerName}</strong>
                <p>{booking.packageTitle}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status-badge ${booking.status === 'CANCELLED'? 'cancelled' : 'confirmed'}`}>
                  {booking.status === 'CANCELLED'? 'Cancelled' : 'Confirmed'}
                </span>
                <p>{booking.bookingCode}</p>
                <p>{booking.travelDate}</p>
              </div>
            </div>
          )) : <p className="empty-state">No reservations yet. After search, Reservation start.</p>}
        </div>
      </section>
    </div>
  );
}
