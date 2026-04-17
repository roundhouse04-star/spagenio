import { useEffect, useState } from 'react';

/**
 * Transit Routes Admin Panel
 * - 기존 Admin.jsx에 import 해서 탭/섹션으로 붙여 쓰면 됨
 * - 또는 독립 페이지로 사용 가능
 *
 * 사용 예 (Admin.jsx 안에):
 *   import TransitRoutesAdmin from './TransitRoutesAdmin';
 *   ...
 *   {activeTab === 'transit' && <TransitRoutesAdmin />}
 */

const API_BASE = '';  // same origin

const EMPTY_ROUTE = {
  fromCity: '',
  toCity: '',
  type: 'airplane',
  icon: '✈',
  name: '',
  tag: 'Recommended',
  tagColor: '#1E2A3A',
  time: '',
  price: '',
  priceNum: 0,
  steps: [],
  sortOrder: 1,
};

const TYPE_OPTIONS = [
  { value: 'airplane', icon: '✈', label: 'Airplane' },
  { value: 'train', icon: '🚄', label: 'Train' },
  { value: 'bus', icon: '🚌', label: 'Bus' },
  { value: 'ferry', icon: '🚢', label: 'Ferry' },
];

const TAG_OPTIONS = [
  { value: 'Recommended', color: '#1E2A3A' },
  { value: 'Cheapest', color: '#f59e0b' },
  { value: 'Fastest', color: '#10b981' },
  { value: '', color: '' },
];

export default function TransitRoutesAdmin() {
  const [routes, setRoutes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(50);
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(null);  // null | EMPTY_ROUTE | existingRoute
  const [toast, setToast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page, size });
      if (fromFilter) q.append('from', fromFilter);
      if (toFilter) q.append('to', toFilter);
      const res = await fetch(`${API_BASE}/api/transit/admin/routes?${q}`);
      const data = await res.json();
      setRoutes(data.routes || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
      showToast('Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const applyFilter = () => { setPage(0); load(); };

  const saveRoute = async (route) => {
    // Validate
    const missing = [];
    if (!route.fromCity?.trim()) missing.push('From City');
    if (!route.toCity?.trim()) missing.push('To City');
    if (!route.name?.trim()) missing.push('Name');
    if (missing.length) {
      showToast('Please enter: ' + missing.join(', '));
      return;
    }

    try {
      const isNew = !route.id;
      const url = isNew
        ? `${API_BASE}/api/transit/admin/routes`
        : `${API_BASE}/api/transit/admin/routes/${route.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      showToast(isNew ? 'Route created' : 'Route updated', 'success');
      setEditing(null);
      load();
    } catch (e) {
      console.error(e);
      showToast('Save failed: ' + e.message);
    }
  };

  const deleteRoute = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/transit/admin/routes/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
      showToast('Route deleted', 'success');
      setConfirmDel(null);
      load();
    } catch (e) {
      showToast('Delete failed: ' + e.message);
    }
  };

  const totalPages = Math.ceil(total / size);

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif" }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, letterSpacing: 0.3, marginBottom: 4 }}>
        Transit Routes
      </h2>
      <p style={{ color: '#8A919C', fontSize: 13, marginBottom: 20 }}>
        Manage pre-curated transit options with estimated price ranges
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="form-input" placeholder="Filter by From"
          value={fromFilter} onChange={e => setFromFilter(e.target.value)}
          style={{ width: 160, marginBottom: 0 }}
        />
        <input
          className="form-input" placeholder="Filter by To"
          value={toFilter} onChange={e => setToFilter(e.target.value)}
          style={{ width: 160, marginBottom: 0 }}
        />
        <button onClick={applyFilter} className="btn-secondary" style={{ padding: '8px 16px' }}>
          Filter
        </button>
        <button onClick={() => { setFromFilter(''); setToFilter(''); setPage(0); setTimeout(load, 0); }}
          className="btn-secondary" style={{ padding: '8px 16px' }}>
          Clear
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setEditing({ ...EMPTY_ROUTE })} className="btn-primary" style={{ padding: '8px 16px' }}>
          + New Route
        </button>
      </div>

      <div style={{ fontSize: 13, color: '#8A919C', marginBottom: 12 }}>
        Total: <strong>{total}</strong> option(s) · Page {page + 1} / {totalPages || 1}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #E2E0DC', borderRadius: 3, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F8F6F2', borderBottom: '1px solid #E2E0DC' }}>
              <th style={th}>From → To</th>
              <th style={th}>Type</th>
              <th style={th}>Name</th>
              <th style={th}>Tag</th>
              <th style={th}>Time</th>
              <th style={th}>Price</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8A919C' }}>Loading…</td></tr>
            ) : routes.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8A919C' }}>No routes</td></tr>
            ) : routes.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #F0EDE7' }}>
                <td style={td}><strong>{r.fromCity}</strong> → {r.toCity}</td>
                <td style={td}>{r.icon} {r.type}</td>
                <td style={td}>{r.name}</td>
                <td style={td}>
                  {r.tag && (
                    <span style={{ background: r.tagColor || '#8A919C', color: 'white', padding: '2px 6px', borderRadius: 2, fontSize: 11 }}>
                      {r.tag}
                    </span>
                  )}
                </td>
                <td style={td}>{r.time}</td>
                <td style={td}>{r.price}</td>
                <td style={td}>
                  <button onClick={() => setEditing(r)} style={actionBtn}>Edit</button>
                  <button onClick={() => setConfirmDel(r)} style={{ ...actionBtn, color: '#dc2626' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary" style={{ padding: '6px 14px' }}>
            ← Prev
          </button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="btn-secondary" style={{ padding: '6px 14px' }}>
            Next →
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editing && <EditModal route={editing} onSave={saveRoute} onCancel={() => setEditing(null)} />}

      {/* Delete Confirm */}
      {confirmDel && (
        <div style={modalBackdrop}>
          <div style={{ ...modalBox, maxWidth: 400 }}>
            <h3 style={{ marginTop: 0 }}>Delete route?</h3>
            <p style={{ color: '#6B7280' }}>
              <strong>{confirmDel.fromCity} → {confirmDel.toCity}</strong><br />
              {confirmDel.name}
            </p>
            <p style={{ color: '#dc2626', fontSize: 12 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => deleteRoute(confirmDel.id)}
                style={{ flex: 1, padding: 10, background: '#dc2626', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer' }}>
                Delete
              </button>
              <button onClick={() => setConfirmDel(null)} className="btn-secondary" style={{ flex: 1, padding: 10 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#1E2A3A' : '#fef2f2',
          color: toast.type === 'success' ? 'white' : '#991b1b',
          border: toast.type === 'success' ? 'none' : '1px solid #fecaca',
          borderRadius: 3, padding: '14px 20px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999,
        }}>
          {toast.type === 'success' ? '✓ ' : '⚠ '}{toast.message}
        </div>
      )}
    </div>
  );
}

function EditModal({ route, onSave, onCancel }) {
  const [form, setForm] = useState(route);
  const [stepsText, setStepsText] = useState((route.steps || []).join('\n'));

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean);
    onSave({ ...form, steps });
  };

  const isNew = !form.id;

  return (
    <div style={modalBackdrop}>
      <div style={{ ...modalBox, maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, fontFamily: "'Playfair Display', serif" }}>
          {isNew ? 'New Route' : 'Edit Route'}
        </h3>

        <div style={formGrid}>
          <label style={label}>
            From City *
            <input className="form-input" value={form.fromCity} onChange={e => update('fromCity', e.target.value)} placeholder="Seoul" />
          </label>
          <label style={label}>
            To City *
            <input className="form-input" value={form.toCity} onChange={e => update('toCity', e.target.value)} placeholder="Tokyo" />
          </label>

          <label style={label}>
            Type
            <select className="form-input" value={form.type} onChange={e => {
              const opt = TYPE_OPTIONS.find(o => o.value === e.target.value);
              update('type', e.target.value);
              if (opt) update('icon', opt.icon);
            }}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
            </select>
          </label>

          <label style={label}>
            Sort Order
            <input className="form-input" type="number" value={form.sortOrder || 1}
              onChange={e => update('sortOrder', parseInt(e.target.value) || 1)} />
          </label>

          <label style={{ ...label, gridColumn: '1/-1' }}>
            Name (route description) *
            <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)}
              placeholder="Direct (Incheon→Narita)" />
          </label>

          <label style={label}>
            Tag
            <select className="form-input" value={form.tag || ''} onChange={e => {
              update('tag', e.target.value);
              const opt = TAG_OPTIONS.find(o => o.value === e.target.value);
              if (opt) update('tagColor', opt.color);
            }}>
              <option value="">(none)</option>
              <option value="Recommended">Recommended</option>
              <option value="Cheapest">Cheapest</option>
              <option value="Fastest">Fastest</option>
            </select>
          </label>

          <label style={label}>
            Tag Color (hex)
            <input className="form-input" value={form.tagColor || ''} onChange={e => update('tagColor', e.target.value)}
              placeholder="#1E2A3A" />
          </label>

          <label style={label}>
            Time
            <input className="form-input" value={form.time || ''} onChange={e => update('time', e.target.value)}
              placeholder="2h 30m" />
          </label>

          <label style={label}>
            Price (display)
            <input className="form-input" value={form.price || ''} onChange={e => update('price', e.target.value)}
              placeholder="₩110,000 – ₩280,000" />
          </label>

          <label style={{ ...label, gridColumn: '1/-1' }}>
            Price (number, KRW avg)
            <input className="form-input" type="number" value={form.priceNum || 0}
              onChange={e => update('priceNum', parseInt(e.target.value) || 0)} />
          </label>

          <label style={{ ...label, gridColumn: '1/-1' }}>
            Steps (one per line)
            <textarea
              className="form-input"
              value={stepsText}
              onChange={e => setStepsText(e.target.value)}
              placeholder={'Depart ICN\nBoard Korean Air or Asiana\nArrive NRT\nNarita Express to city (~1h)'}
              rows={5}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button onClick={handleSave} className="btn-primary" style={{ flex: 1, padding: 12 }}>
            {isNew ? 'Create' : 'Save'}
          </button>
          <button onClick={onCancel} className="btn-secondary" style={{ flex: 1, padding: 12 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Styles
const th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#4A4A4A' };
const td = { padding: '10px 12px', color: '#1E2A3A' };
const actionBtn = {
  padding: '4px 10px', background: 'transparent', border: '1px solid #E2E0DC',
  borderRadius: 2, fontSize: 11, cursor: 'pointer', marginRight: 4, color: '#1E2A3A',
};
const modalBackdrop = {
  position: 'fixed', inset: 0, background: 'rgba(30, 42, 58, 0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 20,
};
const modalBox = {
  background: 'white', padding: '28px 32px', borderRadius: 3, maxWidth: 500, width: '100%',
  boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
};
const formGrid = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
};
const label = {
  display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#4A4A4A', fontWeight: 500,
};
