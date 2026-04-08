import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Planner({ currentUser }) {
  const [plans, setPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ title: '', startDate: '', endDate: '' });

  useEffect(() => {
    if (currentUser) load();
  }, [currentUser]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getUserPlans(currentUser.id);
      setPlans(data || []);
      if (data?.length > 0 && !selected) setSelected(data[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const createPlan = async () => {
    if (!newPlan.title.trim()) return;
    try {
      const created = await api.createPlan({ ...newPlan, userId: currentUser.id });
      setPlans(prev => [created, ...prev]);
      setSelected(created);
      setShowNewPlan(false);
      setNewPlan({ title: '', startDate: '', endDate: '' });
    } catch (e) { console.error(e); }
  };

  const removeItem = async (itemId) => {
    if (!selected) return;
    try {
      const updated = await api.removePlanItem(selected.id, itemId);
      setSelected(updated);
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch (e) { console.error(e); }
  };

  const openMapAll = () => {
    if (!selected?.items?.length) return;
    const first = selected.items[0];
    window.open(`https://maps.google.com/?q=${first.lat},${first.lng}`, '_blank');
  };

  const openMapItem = (item) => {
    window.open(`https://maps.google.com/?q=${item.lat},${item.lng}`, '_blank');
  };

  if (!currentUser) return <div className="empty">로그인이 필요해요.</div>;
  if (loading) return <div className="empty">불러오는 중...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">내 여행 플래너</div>
        <button className="btn-primary" onClick={() => setShowNewPlan(true)}>+ 새 일정</button>
      </div>

      {showNewPlan && (
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>새 일정 만들기</div>
          <input className="form-input" placeholder="일정 이름" value={newPlan.title}
            onChange={e => setNewPlan(p => ({ ...p, title: e.target.value }))} />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">출발일</label>
              <input type="date" className="form-input" value={newPlan.startDate}
                onChange={e => setNewPlan(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">도착일</label>
              <input type="date" className="form-input" value={newPlan.endDate}
                onChange={e => setNewPlan(p => ({ ...p, endDate: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={createPlan}>만들기</button>
            <button className="btn-secondary" onClick={() => setShowNewPlan(false)}>취소</button>
          </div>
        </div>
      )}

      {plans.length === 0 && !showNewPlan ? (
        <div className="empty">아직 일정이 없어요.<br />다른 사람의 여행 게시물에서 장소를 추가해보세요!</div>
      ) : (
        <div className="plan-layout">
          <div className="plan-list">
            {plans.map(plan => (
              <div key={plan.id} className={`plan-card${selected?.id === plan.id ? '' : ''}`}
                onClick={() => setSelected(plan)}
                style={{ outline: selected?.id === plan.id ? '2px solid #4f46e5' : 'none' }}>
                <div className="plan-card-title">{plan.title}</div>
                <div className="plan-card-meta">{plan.startDate} ~ {plan.endDate}</div>
                <div className="plan-card-count">{plan.items?.length || 0}개 장소</div>
              </div>
            ))}
          </div>

          {selected && (
            <div className="plan-detail">
              <div className="plan-detail-title">{selected.title}</div>
              <div className="plan-detail-dates">{selected.startDate} ~ {selected.endDate}</div>

              {selected.items?.length > 0 && (
                <button className="plan-map-btn" onClick={openMapAll}>🗺 구글맵에서 전체 보기</button>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {selected.items?.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '20px 0' }}>
                    아직 추가된 장소가 없어요.<br />여행 게시물에서 장소를 추가해보세요!
                  </div>
                ) : (
                  selected.items.map(item => (
                    <div key={item.id} className="plan-item">
                      <div className="place-num" style={{ background: '#4f46e5' }}>📍</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{item.placeName}</div>
                        {item.address && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.address}</div>}
                        {item.howToGet && <div className="place-how">🚇 {item.howToGet}</div>}
                        {item.tip && <div className="place-tip">💡 {item.tip}</div>}
                        {item.date && <div className="plan-item-date">📅 {item.date}</div>}
                        {item.fromUserNickname && (
                          <div className="plan-item-from">출처: @{item.fromUserNickname} — {item.fromPostTitle}</div>
                        )}
                        <button className="btn-map" style={{ marginTop: 6 }} onClick={() => openMapItem(item)}>
                          구글맵으로 보기
                        </button>
                      </div>
                      <button className="btn-remove" onClick={() => removeItem(item.id)}>✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
