import React, { useState } from 'react';
import { api } from '../api';

const REASONS = [
  'Spam / advertising',
  'Abuse / hate speech',
  'False information',
  'Copyright violation',
  'Personal info exposed',
  'Illegal content',
  'Other',
];

export default function ReportModal({ post, currentUser, onClose }) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      await api.createReport({
        reporterId: currentUser?.id || 'anonymous',
        reporterNickname: currentUser?.nickname || 'Anonymous',
        targetType: 'post',
        targetId: post.id,
        targetContent: post.title,
        reason: reason === 'Other' ? custom : reason,
      });
      setDone(true);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Report received</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              We'll review and take action.<br/>Thanks for reporting!
            </div>
            <button className="btn-primary" onClick={onClose}>OK</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title" style={{ marginBottom: 0 }}>Report post</div>
              <button onClick={onClose} style={{ fontSize: 20, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#555', marginBottom: 16 }}>
              "{post.title}"
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${reason === r ? '#4f46e5' : '#eee'}`, background: reason === r ? '#eef2ff' : 'white', cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: '#4f46e5' }} />
                  {r}
                </label>
              ))}
            </div>
            {reason === 'Other' && (
              <textarea value={custom} onChange={e => setCustom(e.target.value)}
                placeholder="Describe the issue" rows={3}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #eee', borderRadius: 10, fontSize: 14, outline: 'none', marginBottom: 12, resize: 'vertical' }} />
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-cancel" onClick={submit} disabled={!reason || loading}>{loading ? 'Reporting...' : 'Submit'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
