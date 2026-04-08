import React, { useEffect, useState } from 'react';
import { api } from '../api';

function timeUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return '여행 중';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '오늘 출발!';
  if (days === 1) return '내일 출발';
  return `${days}일 후 출발`;
}

function isSamePlace(items1, items2) {
  const names1 = new Set(items1.map(i => i.placeName?.toLowerCase()));
  return items2.some(i => names1.has(i.placeName?.toLowerCase()));
}

export default function Share({ currentUser, onProfile }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all'); // all | schedule | places
  const [myPlans, setMyPlans] = useState([]);

  useEffect(() => {
    if (currentUser) load();
  }, [currentUser]);

  const load = async () => {
    setLoading(true);
    try {
      const [shared, mine] = await Promise.all([
        api.getSharedPlans(currentUser.id),
        api.getUserPlans(currentUser.id),
      ]);
      setPlans(shared || []);
      setMyPlans(mine || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // 일정 공유 — 날짜 있는 것만
  const schedulePlans = plans.filter(p => p.shareSchedule && p.startDate);
  // 장소 공유 — 장소 있는 것만
  const placePlans = plans.filter(p => p.sharePlaces && p.items?.length > 0);

  // 같은 장소 가는 친구 찾기
  const myAllItems = myPlans.flatMap(p => p.items || []);
  const sameDestFriends = placePlans.filter(p =>
    myAllItems.length > 0 && isSamePlace(myAllItems, p.items || [])
  );

  const filtered = tab === 'schedule' ? schedulePlans : tab === 'places' ? placePlans : plans;

  if (!currentUser) return <div className="empty">로그인이 필요해요.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">✈ 정보공유</div>
      </div>

      {/* 같은 곳 가는 친구 알림 */}
      {sameDestFriends.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #4f46e5, #818cf8)', borderRadius: 18, padding: '18px 20px', color: 'white' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>🎉 같은 곳 가는 친구가 있어요!</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {sameDestFriends.slice(0, 3).map(p => (
              <div key={p.id} onClick={() => onProfile?.(p.userId)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer' }}>
                <img src={`https://ui-avatars.com/api/?name=${p.userNickname}&background=fff&color=4f46e5&size=32`}
                  style={{ width: 28, height: 28, borderRadius: '50%' }} alt="" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.userNickname}</div>
                  <div style={{ fontSize: 11, opacity: 0.8 }}>{p.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['all','전체'], ['schedule','📅 일정 공유'], ['places','📍 장소 공유']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`feed-tab${tab === key ? ' active' : ''}`}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="empty" style={{ lineHeight: 2 }}>
          {tab === 'all' ? '팔로우한 친구의 공유된 일정이 없어요.' : tab === 'schedule' ? '공유된 일정이 없어요.' : '공유된 장소가 없어요.'}<br/>
          친구들이 일정을 공유하면 여기서 볼 수 있어요!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(plan => (
            <PlanShareCard key={plan.id} plan={plan} currentUser={currentUser} myItems={myAllItems} onProfile={onProfile} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanShareCard({ plan, currentUser, myItems, onProfile }) {
  const [expanded, setExpanded] = useState(false);
  const until = timeUntil(plan.startDate);
  const samePlace = myItems.length > 0 && isSamePlace(myItems, plan.items || []);

  return (
    <div style={{ background: 'white', border: `1px solid ${samePlace ? '#c7d2fe' : '#eee'}`, borderRadius: 20, overflow: 'hidden', boxShadow: samePlace ? '0 0 0 2px #eef2ff' : 'none' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <img src={plan.userProfileImage || `https://ui-avatars.com/api/?name=${plan.userNickname}&background=4f46e5&color=fff&size=40`}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
            alt={plan.userNickname} onClick={() => onProfile?.(plan.userId)} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', cursor: 'pointer' }}
              onClick={() => onProfile?.(plan.userId)}>{plan.userNickname}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>일정 공유</div>
          </div>
          {samePlace && (
            <div style={{ background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: '1px solid #c7d2fe' }}>
              같은 곳 여행 🎉
            </div>
          )}
        </div>

        <div style={{ fontWeight: 800, fontSize: 16, color: '#1a1a2e', marginBottom: 6 }}>{plan.title}</div>

        {/* 일정 날짜 */}
        {plan.shareSchedule && plan.startDate && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '5px 12px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>📅 {plan.startDate}{plan.endDate ? ` ~ ${plan.endDate}` : ''}</span>
            </div>
            {until && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: until === '여행 중' ? '#fffbeb' : '#eef2ff', border: `1px solid ${until === '여행 중' ? '#fde68a' : '#c7d2fe'}`, borderRadius: 10, padding: '5px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: until === '여행 중' ? '#d97706' : '#4f46e5' }}>✈ {until}</span>
              </div>
            )}
          </div>
        )}

        {/* 장소 미리보기 */}
        {plan.sharePlaces && plan.items?.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>📍 방문 예정 장소 {plan.items.length}곳</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {plan.items.slice(0, expanded ? plan.items.length : 4).map((item, i) => {
                const isSame = myItems.some(m => m.placeName?.toLowerCase() === item.placeName?.toLowerCase());
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: isSame ? '#eef2ff' : '#f9fafb', border: `1px solid ${isSame ? '#c7d2fe' : '#eee'}`, borderRadius: 10, padding: '5px 12px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isSame ? '#4f46e5' : '#374151' }}>
                      {isSame ? '🎉 ' : ''}{item.placeName}
                    </span>
                    {item.date && <span style={{ fontSize: 11, color: '#9ca3af' }}>· {item.date}</span>}
                  </div>
                );
              })}
              {!expanded && plan.items.length > 4 && (
                <button onClick={() => setExpanded(true)}
                  style={{ background: '#f3f4f6', border: '1px solid #eee', borderRadius: 10, padding: '5px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}>
                  +{plan.items.length - 4}곳 더 보기
                </button>
              )}
            </div>

            {/* 상세 장소 목록 */}
            {expanded && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.items.map((item, i) => {
                  const isSame = myItems.some(m => m.placeName?.toLowerCase() === item.placeName?.toLowerCase());
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isSame ? '#eef2ff' : '#f9fafb', border: `1px solid ${isSame ? '#c7d2fe' : '#eee'}`, borderRadius: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: isSame ? '#4f46e5' : '#e5e7eb', color: isSame ? 'white' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i+1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{item.placeName} {isSame && '🎉'}</div>
                        {item.address && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.address}</div>}
                        {item.date && <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 1 }}>📅 {item.date}</div>}
                        {item.memo && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>📝 {item.memo}</div>}
                      </div>
                      {item.lat && item.lng && (
                        <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#4f46e5', textDecoration: 'none', padding: '4px 8px', background: 'white', border: '1px solid #c7d2fe', borderRadius: 8, flexShrink: 0 }}>
                          🗺
                        </a>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => setExpanded(false)}
                  style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>접기 ▲</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
