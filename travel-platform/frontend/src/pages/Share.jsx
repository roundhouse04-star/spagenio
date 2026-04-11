import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { TRAVEL_STYLES } from '../travelStyles';

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
  const [myPlans, setMyPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');       // all | schedule | places
  const [searchQuery, setSearchQuery] = useState('');
  const [showMine, setShowMine] = useState(false);
  const [styleFilter, setStyleFilter] = useState(''); // 여행 스타일 필터

  useEffect(() => {
    if (currentUser) load();
  }, [currentUser]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [shared, mine] = await Promise.all([
        api.getSharedPlans(currentUser.id),
        api.getUserPlans(currentUser.id),
      ]);
      setPlans(shared || []);
      setMyPlans(mine || []);
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const myAllItems = myPlans.flatMap(p => p.items || []);

  // 내 공유 일정 (public/friends로 설정한 것)
  const mySharedPlans = myPlans.filter(p => p.shareType === 'public' || p.shareType === 'friends');

  // 탭 필터
  const basePlans = showMine ? mySharedPlans : plans;
  const allPlans      = basePlans;
  const schedulePlans = basePlans.filter(p => p.shareSchedule && p.startDate);
  const placePlans    = basePlans.filter(p => p.sharePlaces && p.items?.length > 0);

  const tabFiltered = tab === 'schedule' ? schedulePlans
                    : tab === 'places'   ? placePlans
                    : allPlans;

  // 검색 필터 (제목 or 작성자 닉네임 or 장소명)
  const q = searchQuery.trim().toLowerCase();
  const filtered = tabFiltered.filter(p => {
    const matchSearch = !q || (
      p.title?.toLowerCase().includes(q) ||
      p.userNickname?.toLowerCase().includes(q) ||
      p.items?.some(i => i.placeName?.toLowerCase().includes(q))
    );
    return matchSearch;
  });

  // 같은 장소 가는 친구 (내 공유정보 모드 아닐 때만)
  const sameDestFriends = !showMine
    ? placePlans.filter(p => myAllItems.length > 0 && isSamePlace(myAllItems, p.items || []))
    : [];

  if (!currentUser) return <div className="empty">로그인이 필요해요.</div>;

  const emptyMsg = {
    all:      { icon: showMine ? '🔗' : '✈', title: showMine ? '공유한 일정이 없어요' : '공유된 일정이 없어요', sub: showMine ? '일정을 전체공개 또는 친구공개로 설정하면 여기에 표시돼요.' : '친구들이 일정을 전체공개 또는 친구공개로 설정하면 여기서 볼 수 있어요.' },
    schedule: { icon: '📅', title: '공유된 일정이 없어요', sub: '일정 공유를 켜면 여행 날짜를 볼 수 있어요.' },
    places:   { icon: '📍', title: '공유된 장소가 없어요', sub: '장소 공유를 켜면 방문 예정 장소를 볼 수 있어요.' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="page-header">
        <div className="page-title">✈ 정보공유</div>
      </div>

      {/* 검색 + 내 공유정보 토글 */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#9ca3af', pointerEvents: 'none' }}>🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="일정 이름, 작성자, 장소명으로 검색"
            style={{ width: '100%', padding: '10px 14px 10px 36px', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: '0 4px' }}>✕</button>
          )}
        </div>
        {/* 내 공유정보 토글 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', flexShrink: 0, padding: '8px 14px', borderRadius: 12, border: `2px solid ${showMine ? '#4f46e5' : '#e5e7eb'}`, background: showMine ? '#eef2ff' : 'white', transition: 'all 0.15s', userSelect: 'none' }}>
          <input type="checkbox" checked={showMine} onChange={e => setShowMine(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: '#4f46e5', cursor: 'pointer' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: showMine ? '#4f46e5' : '#6b7280', whiteSpace: 'nowrap' }}>🔗 내 공유정보</span>
        </label>
      </div>

      {/* 여행 스타일 필터 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setStyleFilter('')}
          style={{ padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${!styleFilter ? '#4f46e5' : '#eee'}`, background: !styleFilter ? '#eef2ff' : 'white', color: !styleFilter ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: !styleFilter ? 700 : 500, cursor: 'pointer' }}>
          🌍 전체
        </button>
        {TRAVEL_STYLES.map(s => {
          const isSel = styleFilter === s.key;
          return (
            <button key={s.key} onClick={() => setStyleFilter(isSel ? '' : s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${isSel ? s.color : '#eee'}`, background: isSel ? s.bg : 'white', color: isSel ? s.color : '#9ca3af', fontSize: 12, fontWeight: isSel ? 700 : 500, cursor: 'pointer', transition: 'all 0.1s' }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span> {s.label}
            </button>
          );
        })}
      </div>

      {/* 같은 곳 가는 친구 알림 */}
      {!showMine && sameDestFriends.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #4f46e5, #818cf8)', borderRadius: 18, padding: '16px 20px', color: 'white' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>🎉 같은 곳 가는 친구가 있어요!</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {sameDestFriends.slice(0, 3).map(p => (
              <div key={p.id} onClick={() => onProfile?.(p.userId)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 14px', cursor: 'pointer' }}>
                <img src={p.userProfileImage || `https://ui-avatars.com/api/?name=${p.userNickname}&background=fff&color=4f46e5&size=32`}
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
        {[
          ['all',      `전체${allPlans.length > 0 ? ` (${allPlans.length})` : ''}`],
          ['schedule', `📅 일정 공유${schedulePlans.length > 0 ? ` (${schedulePlans.length})` : ''}`],
          ['places',   `📍 장소 공유${placePlans.length > 0 ? ` (${placePlans.length})` : ''}`],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`feed-tab${tab === key ? ' active' : ''}`}>{label}</button>
        ))}
      </div>

      {/* 검색 결과 카운트 */}
      {q && (
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          "{searchQuery}" 검색 결과 <strong style={{ color: '#1a1a2e' }}>{filtered.length}개</strong>
        </div>
      )}

      {/* 내 공유정보 모드 안내 */}
      {showMine && (
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>
          🔗 내가 공유한 일정만 표시하고 있어요. 전체공개 {mySharedPlans.filter(p=>p.shareType==='public').length}개 · 친구공개 {mySharedPlans.filter(p=>p.shareType==='friends').length}개
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#dc2626' }}>
          ⚠️ 데이터를 불러오지 못했어요.<br/>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{q ? '🔍' : emptyMsg[tab].icon}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
            {q ? `"${searchQuery}"에 해당하는 일정이 없어요` : emptyMsg[tab].title}
          </div>
          <div style={{ fontSize: 13 }}>
            {q ? '다른 키워드로 검색해보세요' : emptyMsg[tab].sub}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(plan => (
            <PlanShareCard key={plan.id} plan={plan} currentUser={currentUser}
              myItems={myAllItems} onProfile={onProfile}
              isMyPlan={plan.userId === currentUser.id}
              myPlans={myPlans} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanShareCard({ plan, currentUser, myItems, onProfile, isMyPlan, myPlans }) {
  const [expanded, setExpanded] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [copyTarget, setCopyTarget] = useState('');

  const until = timeUntil(plan.startDate);
  const samePlace = !isMyPlan && myItems.length > 0 && isSamePlace(myItems, plan.items || []);
  const showSchedule = plan.shareSchedule && plan.startDate;
  const showPlaces   = plan.sharePlaces && plan.items?.length > 0;

  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  // 오늘 이후 일정만 복사 대상 (endDate가 오늘 이상이거나 날짜 미설정)
  const copyablePlans = (myPlans || []).filter(p =>
    p.userId === currentUser.id &&
    (!p.endDate || p.endDate >= today)
  );

  const copyToPlan = async (targetPlanId, targetPlanTitle) => {
    if (!plan.items?.length) return;
    setCopying(true);
    setCopyTarget(targetPlanTitle);
    setShowCopyMenu(false);
    try {
      for (const item of plan.items) {
        await api.addPlanItem(targetPlanId, {
          placeName: item.placeName,
          lat: item.lat || 0,
          lng: item.lng || 0,
          address: item.address || '',
          howToGet: item.howToGet || '',
          tip: item.tip || '',
          category: item.category || 'attraction',
          date: item.date || '',
          memo: item.memo ? `[${plan.userNickname || '공유'}] ${item.memo}` : `[${plan.userNickname || '공유'} 일정에서 복사]`,
          fromPostTitle: plan.title,
          fromUserNickname: plan.userNickname || '',
        });
      }
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 3000);
    } catch (e) {
      console.error('복사 실패:', e);
      alert('복사 중 오류가 발생했어요.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${isMyPlan ? '#c7d2fe' : samePlace ? '#bbf7d0' : '#eee'}`,
      borderRadius: 20, overflow: 'hidden',
      boxShadow: isMyPlan ? '0 0 0 2px #eef2ff' : samePlace ? '0 0 0 2px #f0fdf4' : 'none',
      position: 'relative',
    }}>
      {/* 복사 완료 토스트 */}
      {copyDone && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#1a1a2e', color: 'white', fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 20, zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          ✅ "{copyTarget}"에 {plan.items?.length}개 장소 복사 완료!
        </div>
      )}

      <div style={{ padding: '16px 20px' }}>
        {/* 유저 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <img
            src={plan.userProfileImage || `https://ui-avatars.com/api/?name=${plan.userNickname || '?'}&background=4f46e5&color=fff&size=40`}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
            alt={plan.userNickname} onClick={() => onProfile?.(plan.userId)} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', cursor: 'pointer' }}
                onClick={() => onProfile?.(plan.userId)}>{plan.userNickname || '알 수 없음'}</span>
              {isMyPlan && <span style={{ fontSize: 10, background: '#4f46e5', color: 'white', borderRadius: 6, padding: '1px 7px', fontWeight: 700 }}>내 일정</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: plan.shareType === 'public' ? '#16a34a' : '#4f46e5',
                background: plan.shareType === 'public' ? '#f0fdf4' : '#eef2ff',
                border: `1px solid ${plan.shareType === 'public' ? '#bbf7d0' : '#c7d2fe'}`,
                borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>
                {plan.shareType === 'public' ? '🌍 전체공개' : '👥 친구공개'}
              </span>
              {showSchedule && <span style={{ fontSize: 11, color: '#9ca3af' }}>📅 일정공유</span>}
              {showPlaces   && <span style={{ fontSize: 11, color: '#9ca3af' }}>📍 장소공유</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {samePlace && (
              <div style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>
                같은 곳 여행 🎉
              </div>
            )}
            {/* 내 일정에 복사 버튼 — 내 일정이 아니고 장소공유=ON이고 items가 있을 때만 */}
            {!isMyPlan && (plan.sharePlaces || plan.shareSchedule) && plan.items?.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowCopyMenu(v => !v)}
                  disabled={copying}
                  style={{ padding: '6px 12px', background: copying ? '#e5e7eb' : '#f0fdf4', color: copying ? '#9ca3af' : '#16a34a', border: `1px solid ${copying ? '#e5e7eb' : '#bbf7d0'}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: copying ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {copying ? '복사 중...' : '📋 내 일정에 복사'}
                </button>
                {/* 일정 선택 드롭다운 */}
                {showCopyMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 220, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: 12, fontWeight: 700, color: '#6b7280' }}>
                      어느 일정에 추가할까요?
                    </div>
                    {copyablePlans.length === 0 ? (
                      <div style={{ padding: '14px', fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>
                        추가 가능한 일정이 없어요.<br />
                        <span style={{ fontSize: 12 }}>오늘 이후 일정을 먼저 만들어주세요!</span>
                      </div>
                    ) : (
                      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {copyablePlans.map(p => (
                          <button key={p.id} onClick={() => copyToPlan(p.id, p.title)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #f9fafb', transition: 'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📋</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                                {p.startDate || '날짜 미설정'} · {p.items?.length || 0}개 장소
                              </div>
                            </div>
                            <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700, flexShrink: 0 }}>+{plan.items.length}개 추가</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setShowCopyMenu(false)}
                      style={{ width: '100%', padding: '10px', border: 'none', borderTop: '1px solid #f3f4f6', background: '#f9fafb', fontSize: 12, color: '#9ca3af', cursor: 'pointer' }}>
                      닫기
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 제목 */}
        <div style={{ fontWeight: 800, fontSize: 16, color: '#1a1a2e', marginBottom: 8 }}>{plan.title}</div>

        {/* 날짜 */}
        {showSchedule && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '5px 12px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                📅 {plan.startDate}{plan.endDate ? ` ~ ${plan.endDate}` : ''}
              </span>
            </div>
            {until && (
              <div style={{ background: until === '여행 중' ? '#fffbeb' : '#eef2ff', border: `1px solid ${until === '여행 중' ? '#fde68a' : '#c7d2fe'}`, borderRadius: 10, padding: '5px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: until === '여행 중' ? '#d97706' : '#4f46e5' }}>✈ {until}</span>
              </div>
            )}
          </div>
        )}

        {/* 장소 */}
        {showPlaces && (
          <>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>📍 방문 예정 장소 {plan.items.length}곳</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {plan.items.slice(0, expanded ? plan.items.length : 4).map((item, i) => {
                const isSame = !isMyPlan && myItems.some(m => m.placeName?.toLowerCase() === item.placeName?.toLowerCase());
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
            {expanded && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.items.map((item, i) => {
                  const isSame = !isMyPlan && myItems.some(m => m.placeName?.toLowerCase() === item.placeName?.toLowerCase());
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isSame ? '#eef2ff' : '#f9fafb', border: `1px solid ${isSame ? '#c7d2fe' : '#eee'}`, borderRadius: 12 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: isSame ? '#4f46e5' : '#e5e7eb', color: isSame ? 'white' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i+1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{item.placeName} {isSame && '🎉'}</div>
                        {item.address && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.address}</div>}
                        {item.date    && <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 1 }}>📅 {item.date}</div>}
                        {item.memo    && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>📝 {item.memo}</div>}
                      </div>
                      {item.lat && item.lng && (
                        <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#4f46e5', textDecoration: 'none', padding: '4px 8px', background: 'white', border: '1px solid #c7d2fe', borderRadius: 8, flexShrink: 0 }}>🗺</a>
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

        {!showSchedule && !showPlaces && (
          <div style={{ fontSize: 12, color: '#9ca3af', padding: '4px 0' }}>일정이나 장소를 공유하지 않았어요.</div>
        )}
      </div>
    </div>
  );
}
