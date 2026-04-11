import React, { useEffect, useState } from 'react';
import { api } from '../api';

const TYPE_COLOR = {
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ️' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠️' },
  event:   { bg: '#f0fdf4', border: '#bbf7d0', color: '#065f46', icon: '🎉' },
};

export default function NoticeBar() {
  const [notices, setNotices] = useState([]);
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    api.getNotices(true).then(data => setNotices(data || [])).catch(() => {});
  }, []);

  const visible = notices.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  const notice = visible[idx % visible.length];
  const style = TYPE_COLOR[notice.type] || TYPE_COLOR.info;

  return (
    <div style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{style.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: style.color }}>{notice.title}</div>
        <div style={{ fontSize: 12, color: style.color, opacity: 0.8, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notice.content}</div>
      </div>
      {visible.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => setIdx(i => (i - 1 + visible.length) % visible.length)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: style.color, fontSize: 14, padding: '2px 4px' }}>‹</button>
          <span style={{ fontSize: 11, color: style.color, alignSelf: 'center' }}>{(idx % visible.length) + 1}/{visible.length}</span>
          <button onClick={() => setIdx(i => (i + 1) % visible.length)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: style.color, fontSize: 14, padding: '2px 4px' }}>›</button>
        </div>
      )}
      <button onClick={() => setDismissed(prev => new Set([...prev, notice.id]))}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: style.color, fontSize: 16, flexShrink: 0, opacity: 0.6, padding: '2px' }}>✕</button>
    </div>
  );
}
