import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { TRAVEL_STYLES } from '../travelStyles';

function timeUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'TRAVEL ';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today From!';
  if (days === 1) return 'MyD From';
  return `${days}D after From`;
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
  const [tab, setTab] = useState('all'); // all | schedule | places
  const [searchQuery, setSearchQuery] = useState('');
  const [showMine, setShowMine] = useState(false);
  const [styleFilter, setStyleFilter] = useState(''); // TRAVEL Style Filter

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

  // My shared schedules (public/friends as set as )
  const mySharedPlans = myPlans.filter(p => p.shareType === 'public' || p.shareType === 'friends');

  // Tab Filter
  const basePlans = showMine? mySharedPlans : plans;
  const allPlans = basePlans;
  const schedulePlans = basePlans.filter(p => p.shareSchedule && p.startDate);
  const placePlans = basePlans.filter(p => p.sharePlaces && p.items?.length > 0);

  const tabFiltered = tab === 'schedule'? schedulePlans
                    : tab === 'places'? placePlans
                    : allPlans;

  // Search filter (Title or Write chars Nickname or place names)
  const q = searchQuery.trim().toLowerCase();
  const filtered = tabFiltered.filter(p => {
    const matchSearch =!q || (
      p.title?.toLowerCase().includes(q) ||
      p.userNickname?.toLowerCase().includes(q) ||
      p.items?.some(i => i.placeName?.toLowerCase().includes(q))
    );
    return matchSearch;
  });

  // Friends going to the same place (when not in my-shared mode)
  const sameDestFriends =!showMine
   ? placePlans.filter(p => myAllItems.length > 0 && isSamePlace(myAllItems, p.items || []))
    : [];

  if (!currentUser) return <div className="empty">LOGIN required.</div>;

  const emptyMsg = {
    all: { icon: showMine? '🔗' : '✈', title: showMine? 'No shared schedules yet' : 'No schedules shared with you', sub: showMine? 'Set your schedule to public or friends-only and it will appear here.' : 'Schedules appear here when friends set them to public or friends-only.' },
    schedule: { icon: '📅', title: 'No schedules shared with you', sub: 'Turn on schedule sharing to see travel dates.' },
    places: { icon: '📍', title: 'No shared places', sub: 'Turn on place sharing to see planned places.' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="page-header">
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 500, color: '#1E2A3A', letterSpacing: -0.8 }}>✈ InfoSHARE</div>
      </div>

      {/* SEARCH + My shared toggle */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#8A919C', pointerEvents: 'none' }}>🔍</span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by schedule name, author, or place"
            style={{ width: '100%', padding: '10px 14px 10px 36px', border: '1px solid #E2E0DC', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#8A919C', padding: '0 4px' }}>✕</button>
          )}
        </div>
        {/* My shared toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', flexShrink: 0, padding: '8px 14px', borderRadius: 3, border: `2px solid ${showMine? '#1E2A3A' : '#E2E0DC'}`, background: showMine? '#EEEDEA' : 'white', transition: 'all 0.15s', userSelect: 'none' }}>
          <input type="checkbox" checked={showMine} onChange={e => setShowMine(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: '#1E2A3A', cursor: 'pointer' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: showMine? '#1E2A3A' : '#8A919C', whiteSpace: 'nowrap' }}>🔗 My shared</span>
        </label>
      </div>

      {/* TRAVEL Style Filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setStyleFilter('')}
          style={{ padding: '6px 14px', borderRadius: 2, border: `1.5px solid ${!styleFilter? '#1E2A3A' : '#E2E0DC'}`, background:!styleFilter? '#EEEDEA' : 'white', color:!styleFilter? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight:!styleFilter? 700 : 500, cursor: 'pointer' }}>
          🌍 ALL
        </button>
        {TRAVEL_STYLES.map(s => {
          const isSel = styleFilter === s.key;
          return (
            <button key={s.key} onClick={() => setStyleFilter(isSel? '' : s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 2, border: `1.5px solid ${isSel? s.color : '#E2E0DC'}`, background: isSel? s.bg : 'white', color: isSel? s.color : '#8A919C', fontSize: 12, fontWeight: isSel? 700 : 500, cursor: 'pointer', transition: 'all 0.1s' }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span> {s.label}
            </button>
          );
        })}
      </div>

      {/* friends going to the same places ALERTS */}
      {!showMine && sameDestFriends.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #1E2A3A, #818cf8)', borderRadius: 3, padding: '16px 20px', color: 'white' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>🎉 There are friends going to the same places!</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {sameDestFriends.slice(0, 3).map(p => (
              <div key={p.id} onClick={() => onProfile?.(p.userId)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 3, padding: '8px 14px', cursor: 'pointer' }}>
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

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          ['all', `ALL${allPlans.length > 0? ` (${allPlans.length})` : ''}`],
          ['schedule', `📅 SCHEDULE SHARE${schedulePlans.length > 0? ` (${schedulePlans.length})` : ''}`],
          ['places', `📍 Place SHARE${placePlans.length > 0? ` (${placePlans.length})` : ''}`],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`feed-tab${tab === key? ' active' : ''}`}>{label}</button>
        ))}
      </div>

      {/* Search results */}
      {q && (
        <div style={{ fontSize: 13, color: '#8A919C' }}>
          "{searchQuery}" · <strong style={{ color: '#1E2A3A' }}>{filtered.length}</strong> results
        </div>
      )}

      {/* My shared mode Guide */}
      {showMine && (
        <div style={{ background: '#EEEDEA', border: '1px solid #E2E0DC', borderRadius: 3, padding: '10px 14px', fontSize: 13, color: '#1E2A3A', fontWeight: 600 }}>
          🔗 Showing only my shared schedules · Public {mySharedPlans.filter(p=>p.shareType==='public').length} · Friends-only {mySharedPlans.filter(p=>p.shareType==='friends').length}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 3, padding: '12px 16px', fontSize: 13, color: '#dc2626' }}>
          ⚠️ Could not load data.<br/>
          <span style={{ fontSize: 11, color: '#8A919C' }}>{error}</span>
        </div>
      )}

      {loading? (
        <div className="empty">Loading...</div>
      ) : filtered.length === 0? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A919C' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>{q? '🔍' : emptyMsg[tab].icon}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#4A5568', marginBottom: 6 }}>
            {q? `"${searchQuery}" matches — no schedules` : emptyMsg[tab].title}
          </div>
          <div style={{ fontSize: 13 }}>
            {q? 'other keyword as search again' : emptyMsg[tab].sub}
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
  const samePlace =!isMyPlan && myItems.length > 0 && isSamePlace(myItems, plan.items || []);
  const showSchedule = plan.shareSchedule && plan.startDate;
  const showPlaces = plan.sharePlaces && plan.items?.length > 0;

  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  // From today onwards Only future schedules can be copied (endDate today or lateror Date TBD)
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
          memo: item.memo? `[${plan.userNickname || 'SHARE'}] ${item.memo}` : `[${plan.userNickname || 'SHARE'} copied from schedule]`,
          fromPostTitle: plan.title,
          fromUserNickname: plan.userNickname || '',
        });
      }
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 3000);
    } catch (e) {
      console.error('COPY failed:', e);
      alert('Copy error.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${isMyPlan? '#E2E0DC' : samePlace? '#bbf7d0' : '#E2E0DC'}`,
      borderRadius: 2, overflow: 'hidden',
      boxShadow: isMyPlan? '0 0 0 2px #EEEDEA' : samePlace? '0 0 0 2px #f0fdf4' : 'none',
      position: 'relative',
    }}>
      {/* COPY DONE Toast */}
      {copyDone && (
        <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#1E2A3A', color: 'white', fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 2, zIndex: 10, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          ✅ "{copyTarget}" has Place COPY DONE!
        </div>
      )}

      <div style={{ padding: '16px 20px' }}>
        {/* User header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <img
            src={plan.userProfileImage || `https://ui-avatars.com/api/?name=${plan.userNickname || '?'}&background=1E2A3A&color=fff&size=40`}
            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
            alt={plan.userNickname} onClick={() => onProfile?.(plan.userId)} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1E2A3A', cursor: 'pointer' }}
                onClick={() => onProfile?.(plan.userId)}>{plan.userNickname || 'Unknown'}</span>
              {isMyPlan && <span style={{ fontSize: 10, background: '#1E2A3A', color: 'white', borderRadius: 6, padding: '1px 7px', fontWeight: 700 }}>My SCHEDULE</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: plan.shareType === 'public'? '#16a34a' : '#1E2A3A',
                background: plan.shareType === 'public'? '#f0fdf4' : '#EEEDEA',
                border: `1px solid ${plan.shareType === 'public'? '#bbf7d0' : '#E2E0DC'}`,
                borderRadius: 6, padding: '1px 7px', fontWeight: 600 }}>
                {plan.shareType === 'public'? '🌍 Public' : '👥 Friends-only'}
              </span>
              {showSchedule && <span style={{ fontSize: 11, color: '#8A919C' }}>📅 SCHEDULESHARE</span>}
              {showPlaces && <span style={{ fontSize: 11, color: '#8A919C' }}>📍 PlaceSHARE</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {samePlace && (
              <div style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                Same places TRAVEL 🎉
              </div>
            )}
            {/* my schedule COPY button — My the schedule not (PlaceSHARE or SCHEDULESHARE)=ON items when */}
            {!isMyPlan && (plan.sharePlaces || plan.shareSchedule) && plan.items?.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowCopyMenu(v =>!v)}
                  disabled={copying}
                  style={{ padding: '6px 12px', background: copying? '#E2E0DC' : '#f0fdf4', color: copying? '#8A919C' : '#16a34a', border: `1px solid ${copying? '#E2E0DC' : '#bbf7d0'}`, borderRadius: 2, fontSize: 12, fontWeight: 700, cursor: copying? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {copying? 'COPY...' : '📋 my schedule COPY'}
                </button>
                {/* SCHEDULE SELECT Dropdown */}
                {showCopyMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #E2E0DC', borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 220, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #F5F4F0', fontSize: 12, fontWeight: 700, color: '#8A919C' }}>
                      Add to which schedule?
                    </div>
                    {copyablePlans.length === 0? (
                      <div style={{ padding: '14px', fontSize: 13, color: '#8A919C', textAlign: 'center' }}>
                        ADD availableone the schedule None.<br />
                        <span style={{ fontSize: 12 }}>From today onwards the schedule first Please create one!</span>
                      </div>
                    ) : (
                      <div style={{ height: 240, overflowY: 'auto' }}>
                        {copyablePlans.map(p => (
                          <button key={p.id} onClick={() => copyToPlan(p.id, p.title)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #FAFAF8', transition: 'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#FAFAF8'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <div style={{ width: 32, height: 32, borderRadius: 2, background: '#EEEDEA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📋</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                              <div style={{ fontSize: 11, color: '#8A919C' }}>
                                {p.startDate || 'Date TBD'} · {p.items?.length || 0} Place
                              </div>
                            </div>
                            <span style={{ fontSize: 11, color: '#1E2A3A', fontWeight: 700, flexShrink: 0 }}>+{plan.items.length} places</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setShowCopyMenu(false)}
                      style={{ width: '100%', padding: '10px', border: 'none', borderTop: '1px solid #F5F4F0', background: '#FAFAF8', fontSize: 12, color: '#8A919C', cursor: 'pointer' }}>
                      CLOSE
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <div style={{ fontWeight: 800, fontSize: 16, color: '#1E2A3A', marginBottom: 8 }}>{plan.title}</div>

        {/* Date */}
        {showSchedule && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, padding: '5px 12px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>
                📅 {plan.startDate}{plan.endDate? ` ~ ${plan.endDate}` : ''}
              </span>
            </div>
            {until && (
              <div style={{ background: until === 'TRAVEL '? '#fffbeb' : '#EEEDEA', border: `1px solid ${until === 'TRAVEL '? '#fde68a' : '#E2E0DC'}`, borderRadius: 2, padding: '5px 12px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: until === 'TRAVEL '? '#d97706' : '#1E2A3A' }}>✈ {until}</span>
              </div>
            )}
          </div>
        )}

        {/* Place */}
        {showPlaces && (
          <>
            <div style={{ fontSize: 12, color: '#8A919C', marginBottom: 8 }}>📍 Visit Planned Place {plan.items.length}places</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {plan.items.slice(0, expanded? plan.items.length : 4).map((item, i) => {
                const isSame =!isMyPlan && myItems.some(m => m.placeName?.toLowerCase() === item.placeName?.toLowerCase());
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: isSame? '#EEEDEA' : '#FAFAF8', border: `1px solid ${isSame? '#E2E0DC' : '#E2E0DC'}`, borderRadius: 2, padding: '5px 12px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isSame? '#1E2A3A' : '#4A5568' }}>
                      {isSame? '🎉 ' : ''}{item.placeName}
                    </span>
                    {item.date && <span style={{ fontSize: 11, color: '#8A919C' }}>· {item.date}</span>}
                  </div>
                );
              })}
              {!expanded && plan.items.length > 4 && (
                <button onClick={() => setExpanded(true)}
                  style={{ background: '#F5F4F0', border: '1px solid #eee', borderRadius: 2, padding: '5px 12px', fontSize: 12, color: '#8A919C', cursor: 'pointer', fontWeight: 600 }}>
                  +{plan.items.length - 4}places View more
                </button>
              )}
            </div>
            {expanded && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.items.map((item, i) => {
                  const isSame =!isMyPlan && myItems.some(m => m.placeName?.toLowerCase() === item.placeName?.toLowerCase());
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isSame? '#EEEDEA' : '#FAFAF8', border: `1px solid ${isSame? '#E2E0DC' : '#E2E0DC'}`, borderRadius: 3 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: isSame? '#1E2A3A' : '#E2E0DC', color: isSame? 'white' : '#8A919C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i+1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>{item.placeName} {isSame && '🎉'}</div>
                        {item.address && <div style={{ fontSize: 11, color: '#8A919C', marginTop: 1 }}>{item.address}</div>}
                        {item.date && <div style={{ fontSize: 11, color: '#1E2A3A', marginTop: 1 }}>📅 {item.date}</div>}
                        {item.memo && <div style={{ fontSize: 11, color: '#8A919C', marginTop: 1 }}>📝 {item.memo}</div>}
                      </div>
                      {item.lat && item.lng && (
                        <a href={`https://maps.google.com/?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#1E2A3A', textDecoration: 'none', padding: '4px 8px', background: 'white', border: '1px solid #E2E0DC', borderRadius: 2, flexShrink: 0 }}>🗺</a>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => setExpanded(false)}
                  style={{ fontSize: 12, color: '#8A919C', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>Collapse ▲</button>
              </div>
            )}
          </>
        )}

        {!showSchedule &&!showPlaces && (
          <div style={{ fontSize: 12, color: '#8A919C', padding: '4px 0' }}>No schedule or place shared yet.</div>
        )}
      </div>
    </div>
  );
}
