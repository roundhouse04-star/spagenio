import React, { useEffect, useState } from 'react';
import { api } from '../api';

function timeUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'Departed';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today From!';
  if (days === 1) return 'MyD From';
  return `D-${days}`;
}

export default function Companion({ currentUser, onProfile }) {
  const [companions, setCompanions] = useState([]);
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCountry, setFilterCountry] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', destination: '', country: '',
    startDate: '', endDate: '', People: 2
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, [filterCountry]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getCompanions(filterCountry);
      setCompanions(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!form.title.trim() ||!form.destination.trim()) return;
    setSubmitting(true);
    try {
      await api.createCompanion({...form, userId: currentUser.id, People: Number(form.People) });
      setShowForm(false);
      setForm({ title: '', description: '', destination: '', country: '', startDate: '', endDate: '', People: 2 });
      load();
    } catch (e) { showToast('REGISTER failed: ' + e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this travel buddy post?')) return;
    try { await api.deleteCompanion(id); load(); }
    catch (e) { showToast('DELETE failed'); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const activeCompanions = companions.filter(c =>!c.startDate || c.startDate >= today);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="page-title">🤝 Companion find</div>
        <button onClick={() => setShowForm(v =>!v)}
          style={{ padding: '9px 18px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Companion find
        </button>
      </div>

      {/* REGISTER Form */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>✈️ Companion find REGISTER</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Title (e.g. Looking for Osaka 3N4D travel buddy!)" value={form.title}
              onChange={e => setForm(p => ({...p, title: e.target.value }))}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="Destination (e.g. Osaka)" value={form.destination}
                onChange={e => setForm(p => ({...p, destination: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }} />
              <input placeholder="Country (e.g. Japan)" value={form.country}
                onChange={e => setForm(p => ({...p, country: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'block' }}>Departure date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'block' }}>Return date</label>
                <input type="date" value={form.endDate} onChange={e => setForm(p => ({...p, endDate: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'block' }}>Recruiting People</label>
                <select value={form.People} onChange={e => setForm(p => ({...p, People: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                  {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}name</option>)}
                </select>
              </div>
            </div>
            <textarea placeholder="Share your bio and travel style (e.g. foodie, photo-heavy, laid-back)" value={form.description}
              onChange={e => setForm(p => ({...p, description: e.target.value }))} rows={3}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} disabled={submitting}
                style={{ flex: 1, padding: '10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {submitting? 'REGISTER...' : 'REGISTER'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Country Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['', 'Japan', 'Thailand', 'France', 'Italy', 'Spain', 'USA', 'Vietnam', 'Indonesia'].map(c => (
          <button key={c} onClick={() => setFilterCountry(c)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterCountry === c? '#4f46e5' : '#eee'}`, background: filterCountry === c? '#eef2ff' : 'white', color: filterCountry === c? '#4f46e5' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {c || '🌍 ALL'}
          </button>
        ))}
      </div>

      {loading? (
        <div className="empty">Loading...</div>
      ) : activeCompanions.length === 0? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>No companion posts yet</div>
          <div style={{ fontSize: 13 }}>First as Companion try finding!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeCompanions.map(c => {
            const until = timeUntil(c.startDate);
            const isMe = c.userId === currentUser?.id;
            const spotsLeft = c.People - c.currentPeople;
            return (
              <div key={c.id} style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <img src={c.userProfileImage || `https://ui-avatars.com/api/?name=${c.userNickname}&background=4f46e5&color=fff&size=40`}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => onProfile?.(c.userId)} alt="" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', cursor: 'pointer' }}
                        onClick={() => onProfile?.(c.userId)}>{c.userNickname}</span>
                      {until && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: until === 'Departed'? '#f3f4f6' : '#eef2ff', color: until === 'Departed'? '#9ca3af' : '#4f46e5' }}>
                          {until}
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: spotsLeft > 0? '#f0fdf4' : '#fef2f2', color: spotsLeft > 0? '#16a34a' : '#dc2626', marginLeft: 'auto' }}>
                        {spotsLeft > 0? `${spotsLeft} spots left` : 'Closed'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 6 }}>{c.title}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>📍 {c.destination}{c.country? `, ${c.country}` : ''}</span>
                      {c.startDate && <span style={{ fontSize: 12, color: '#6b7280' }}>📅 {c.startDate}{c.endDate? ` ~ ${c.endDate}` : ''}</span>}
                      <span style={{ fontSize: 12, color: '#6b7280' }}>👥 {c.currentPeople}/{c.People}name</span>
                    </div>
                    {c.description && <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{c.description}</div>}
                  </div>
                  {isMe && (
                    <button onClick={() => handleDelete(c.id)}
                      style={{ fontSize: 11, padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                      DELETE
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#1E2A3A' : '#fef2f2',
          color: toast.type === 'success' ? 'white' : '#991b1b',
          border: toast.type === 'success' ? 'none' : '1px solid #fecaca',
          borderRadius: 3, padding: '14px 20px',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 9999, maxWidth: 420, textAlign: 'center',
          fontFamily: "'Inter', sans-serif", letterSpacing: 0.2,
        }}>
          {toast.type === 'success' ? '✓ ' : '⚠ '}{toast.message}
        </div>
      )}
      </div>
  );
}
