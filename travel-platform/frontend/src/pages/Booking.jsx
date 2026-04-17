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

  const update = (key, value) => setForm((prev) => ({...prev, [key]: value }));

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
        <p className="empty-state">Please select a product First.</p>
      </section>
    );
  }

  return (
    <div className="page-stack">
      <section className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reservation</p>
            <h3>{pkg.title}</h3>
            <p>Enter guest info and travel schedule — reservation data is saved to the backend.</p>
          </div>
        </div>
        <div className="booking-layout">
          <form className="booking-form" onSubmit={submit}>
            <div className="form-grid">
              <label>
                Guest name
                <input required value={form.customerName} onChange={(e) => update('customerName', e.target.value)} />
              </label>
              <label>
                Email
                <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              </label>
              <label>
                Contact
                <input required value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              </label>
              <label>
                Travelers
                <input required type="number" min={pkg.minimumTravelers} max="10" value={form.travelers} onChange={(e) => update('travelers', e.target.value)} />
              </label>
              <label>
                Departure date
                <input required type="date" value={form.travelDate} onChange={(e) => update('travelDate', e.target.value)} />
              </label>
              <label className="full-width">
                Requests
                <textarea rows="5" value={form.requests} onChange={(e) => update('requests', e.target.value)} placeholder="e.g. vegan meals, early check-in, airport pickup" />
              </label>
            </div>
            <div className="search-actions">
              <button className="primary-btn" type="submit" disabled={loading}>Reservation DONE</button>
              <button className="ghost-btn" type="button" onClick={onBack}>Back</button>
            </div>
          </form>

          <aside className="booking-summary section-card compact">
            <p className="eyebrow">Reservation Summary</p>
            <ul className="summary-list">
              <li><span>Productname</span><strong>{pkg.title}</strong></li>
              <li><span>Destination</span><strong>{pkg.location}</strong></li>
              <li><span>Travel period</span><strong>{pkg.durationNights}N {pkg.durationDays}D</strong></li>
              <li><span>1 Fare</span><strong>₩ {pkg.pricePerPerson.toLocaleString()}</strong></li>
              <li><span>Estimated total</span><strong>₩ {(Number(form.travelers) * pkg.pricePerPerson).toLocaleString()}</strong></li>
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}
