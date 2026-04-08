import React, { useEffect, useState } from 'react';
import { api } from '../api';
import MapView from '../components/MapView';

export default function Planner({ currentUser, plans, onUpdatePlans }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ title: '', startDate: '', endDate: '' });
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (currentUser) load();
  }, [currentUser]);

  useEffect(() => {
    if (plans?.length > 0 && !selected) setSelected(plans[0]);
  }, [plans]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getUserPlans(currentUser.id);
      onUpdatePlans?.(data || []);
      if (data?.length > 0) setSelected(data[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const createPlan = async () => {
    if (!newPlan.title.trim()) return;
    try {
      const created = await api.createPlan({ ...newPlan, userId: currentUser.id });
      onUpdatePlans?.([created, ...(plans || [])]);
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
      onUpdatePlans?.(plans.map(p => p.id === updated.id ? updated : p));
    } catch (e) { console.error(e); }
  };

  const deletePlan = async (planId) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    try {
      await api.deletePlan(planId);
      const next = plans.filter(p => p.id !== planId);
      onUpdatePlans?.(next);
      setSelected(next[0] || null);
    } catch (e) { console.error(e); }
  };

  const handleAddFromMap = async (planId, place) => {
    try {
      const item = {
        placeName: place.name, lat: place.lat, lng: place.lng,
        address: place.address || '', category: place.category || '기타',
        howToGet: place.howToGet || '', tip: place.tip || '',
        fromPostId: '', fromPostTitle: '', fromUserNickname: '',
        date: '', memo: '',
      };
      const updated = await api.addPlanItem(planId, item);
      onUpdatePlans?.(plans.map(p => p.id === planId ? updated : p));
      if (selected?.id === planId) setSelected(updated);
      alert(`"${place.name}"을 일정에 추가했어요! ✅`);
    } catch (e) { console.error(e); }
  };

  // 선택된 일정의 장소들에서 GPS 중심 계산
  const getCenter = () => {
    const items = selected?.items?.filter(i => i.lat && i.lng) || [];
    if (!items.length) return { lat: null, lng: null };
    const lat = items.reduce((s, i) => s + i.lat, 0) / items.length;
    const lng = items.reduce((s, i) => s + i.lng, 0) / items.length;
    return { lat, lng };
  };

  const mapPlaces = selected?.items?.filter(i => i.lat && i.lng).map(i => ({
    name: i.placeName, lat: i.lat, lng: i.lng, address: i.address,
  })) || [];

  if (!currentUser) return <div className="empty">로그인이 필요해요.</div>;
  if (loading) return <div className="empty">불러오는 중...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">내 여행 플래너</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected?.items?.length > 0 && (
            <button className="btn-secondary" onClick={() => setShowMap(v => !v)}>
              {showMap ? '📋 목록 보기' : '🗺️ 지도 보기'}
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowNewPlan(true)}>+ 새 일정</button>
        </div>
      </div>

      {showNewPlan && (
        <div className="post-form" style={{ padding: 20, gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>새 일정 만들기</div>
          <input className="form-input" placeholder="일정 이름 (예: 오사카 3박 4일)" value={newPlan.title}
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

      {(!plans || plans.length === 0) && !showNewPlan ? (
        <div className="empty">아직 일정이 없어요.<br/>다른 사람의 여행 게시물에서 장소를 추가해보세요!</div>
      ) : (
        <div className="plan-layout">
          {/* 일정 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(plans || []).map(plan => (
              <div key={plan.id} className="plan-card"
                onClick={() => { setSelected(plan); setShowMap(false); }}
                style={{ outline: selected?.id === plan.id ? '2px solid #4f46e5' : 'none', position: 'relative' }}>
                <div className="plan-card-title">{plan.title}</div>
                <div className="plan-card-meta">{plan.startDate} ~ {plan.endDate}</div>
                <div className="plan-card-count">{plan.items?.length || 0}개 장소</div>
                <button onClick={e => { e.stopPropagation(); deletePlan(plan.id); }}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#e5e7eb', fontSize: 16, padding: 2 }}
                  onMouseEnter={e => e.target.style.color = '#ef4444'}
                  onMouseLeave={e => e.target.style.color = '#e5e7eb'}>✕</button>
              </div>
            ))}
          </div>

          {/* 일정 상세 */}
          {selected && (
            <div className="plan-panel">
              <div className="plan-panel-title">{selected.title}</div>
              <div className="plan-panel-dates">{selected.startDate} ~ {selected.endDate}</div>

              {/* 지도 보기 */}
              {showMap && mapPlaces.length > 0 ? (
                <MapView
                  lat={getCenter().lat}
                  lng={getCenter().lng}
                  placeName={selected.title}
                  places={mapPlaces}
                  onAddToPlanner={handleAddFromMap}
                  plans={plans}
                />
              ) : (
                <>
                  {selected.items?.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '24px 0', lineHeight: 1.8 }}>
                      아직 추가된 장소가 없어요.<br/>여행 게시물에서 장소를 추가해보세요!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selected.items.map((item, idx) => (
                        <div key={item.id} className="plan-item">
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{idx+1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{item.placeName}</div>
                            {item.address && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.address}</div>}
                            {item.howToGet && <div className="place-how">🚇 {item.howToGet}</div>}
                            {item.tip && <div className="place-tip">💡 {item.tip}</div>}
                            {item.date && <div className="plan-item-date">📅 {item.date}</div>}
                            {item.fromUserNickname && (
                              <div className="plan-item-from">출처: @{item.fromUserNickname}</div>
                            )}
                            {item.lat && item.lng && (
                              <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                                style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', display: 'inline-block', marginTop: 4 }}>🗺 지도 보기</a>
                            )}
                          </div>
                          <button className="btn-remove" onClick={() => removeItem(item.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
