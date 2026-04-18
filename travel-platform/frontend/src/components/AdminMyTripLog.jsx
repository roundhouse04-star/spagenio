import React, { useEffect, useMemo, useState } from 'react';

/**
 * My Trip Log 관리 페이지
 * - Admin.jsx 안에서 사용되는 서브 컴포넌트
 * - 동일한 디자인 시스템 (사이드바 + 카드)
 *
 * Props:
 *   styles (S) - Admin.jsx의 스타일 객체
 */
export default function AdminMyTripLog({ styles: S }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [byNat, setByNat] = useState([]);
  const [byOs, setByOs] = useState([]);
  const [byVer, setByVer] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const PAGE_SIZE = 50;

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, n, o, v, d] = await Promise.all([
        fetch('/api/mtl-admin/stats').then((r) => r.json()),
        fetch(`/api/mtl-admin/users?offset=${offset}&limit=${PAGE_SIZE}`).then((r) => r.json()),
        fetch('/api/mtl-admin/by-nationality').then((r) => r.json()),
        fetch('/api/mtl-admin/by-os').then((r) => r.json()),
        fetch('/api/mtl-admin/by-app-version').then((r) => r.json()),
        fetch('/api/mtl-admin/daily-signups').then((r) => r.json()),
      ]);
      setStats(s);
      setUsers(u.users || []);
      setTotal(u.total || 0);
      setByNat(n.data || []);
      setByOs(o.data || []);
      setByVer(v.data || []);
      setDaily(d.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [offset]);

  const dailyMax = useMemo(
    () => Math.max(1, ...daily.map((d) => d.count)),
    [daily]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={S.pageTitle}>📱 My Trip Log</div>
        <button style={S.btn('gray')} onClick={load} disabled={loading}>
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <>
          <div style={S.statsGrid}>
            <StatCard S={S} label="총 가입자" value={stats.totalUsers} color="#4f46e5" />
            <StatCard S={S} label="오늘 신규" value={stats.todayJoined} color="#16a34a" />
            <StatCard S={S} label="7일 신규" value={stats.weekJoined} color="#0891b2" />
            <StatCard S={S} label="30일 신규" value={stats.monthJoined} color="#7c3aed" />
            <StatCard S={S} label="주간 활성 (WAU)" value={stats.activeWeekly} color="#ea580c" />
            <StatCard S={S} label="월간 활성 (MAU)" value={stats.activeMonthly} color="#dc2626" />
          </div>
          <div style={S.statsGrid}>
            <StatCard S={S} label="SNS 알림 신청" value={stats.snsAlertOptIns} color="#d97706" />
            <StatCard S={S} label="총 여행 (전체)" value={stats.totalTrips} color="#0891b2" />
            <StatCard S={S} label="총 기록 (전체)" value={stats.totalLogs} color="#7c3aed" />
            <StatCard
              S={S}
              label="평균 여행 수"
              value={(stats.avgTripCount ?? 0).toFixed(1)}
              color="#6366f1"
            />
            <StatCard
              S={S}
              label="평균 기록 수"
              value={(stats.avgLogCount ?? 0).toFixed(1)}
              color="#6366f1"
            />
          </div>
        </>
      )}

      {/* 일별 가입 추이 */}
      <div style={S.tableWrap}>
        <div style={S.tableHeader}>
          <div style={S.tableTitle}>📈 일별 가입 추이 (최근 30일)</div>
        </div>
        <div style={{ padding: 20 }}>
          {daily.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 40 }}>
              데이터가 없습니다
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              height: 160,
              padding: '8px 0',
            }}>
              {daily.map((d) => (
                <div
                  key={d.day}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title={`${d.day}: ${d.count}명`}
                >
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>
                    {d.count}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 24,
                      height: `${(d.count / dailyMax) * 110}px`,
                      background: '#4f46e5',
                      borderRadius: '4px 4px 0 0',
                      minHeight: 4,
                    }}
                  />
                  <div style={{ fontSize: 9, color: '#9ca3af' }}>
                    {d.day.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 분포 차트 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <DistributionCard S={S} title="🌍 국적별" data={byNat} />
        <DistributionCard S={S} title="📱 OS별" data={byOs} />
        <DistributionCard S={S} title="🔖 앱 버전별" data={byVer} />
      </div>

      {/* 사용자 목록 */}
      <div style={S.tableWrap}>
        <div style={S.tableHeader}>
          <div style={S.tableTitle}>
            👥 가입자 목록 ({total.toLocaleString()}명)
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              style={S.btn('gray')}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
            >
              ← 이전
            </button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {offset + 1} - {Math.min(offset + PAGE_SIZE, total)}
            </span>
            <button
              style={S.btn('gray')}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
            >
              다음 →
            </button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>닉네임</th>
                <th style={S.th}>국적</th>
                <th style={S.th}>OS</th>
                <th style={S.th}>버전</th>
                <th style={S.th}>지역</th>
                <th style={S.th}>여행</th>
                <th style={S.th}>기록</th>
                <th style={S.th}>SNS</th>
                <th style={S.th}>가입일</th>
                <th style={S.th}>마지막 접속</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...S.td, textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                    아직 가입자가 없습니다
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.anonId}>
                    <td style={S.td}>{u.nickname || '-'}</td>
                    <td style={S.td}>
                      <span style={S.badge('blue')}>{u.nationality || '?'}</span>
                    </td>
                    <td style={S.td}>
                      <span style={S.badge(u.os === 'ios' ? 'gray' : 'green')}>
                        {u.os || '?'}
                      </span>
                    </td>
                    <td style={S.td}>{u.appVersion || '-'}</td>
                    <td style={S.td}>{u.deviceLocale || '-'}</td>
                    <td style={S.td}>{u.tripCount}</td>
                    <td style={S.td}>{u.logCount}</td>
                    <td style={S.td}>
                      {u.agreeSnsAlert ? (
                        <span style={S.badge('green')}>구독</span>
                      ) : (
                        <span style={S.badge('gray')}>-</span>
                      )}
                    </td>
                    <td style={{ ...S.td, fontSize: 11, color: '#6b7280' }}>
                      {fmtDate(u.createdAt)}
                    </td>
                    <td style={{ ...S.td, fontSize: 11, color: '#6b7280' }}>
                      {fmtRelativeTime(u.lastSeenAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ S, label, value, color }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statNum(color)}>{(value ?? 0).toLocaleString()}</div>
    </div>
  );
}

function DistributionCard({ S, title, data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <div style={S.tableWrap}>
      <div style={S.tableHeader}>
        <div style={S.tableTitle}>{title}</div>
      </div>
      <div style={{ padding: 16 }}>
        {data.length === 0 ? (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>
            데이터 없음
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.slice(0, 10).map((d) => {
              const pct = total > 0 ? (d.count / total) * 100 : 0;
              return (
                <div key={d.label}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 4,
                  }}>
                    <span style={{ color: '#374151', fontWeight: 600 }}>{d.label}</span>
                    <span style={{ color: '#6b7280' }}>
                      {d.count}명 ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div style={{
                    height: 6,
                    background: '#f3f4f6',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: '#4f46e5',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDate(s) {
  if (!s) return '-';
  try {
    return s.slice(0, 10);
  } catch {
    return s;
  }
}

function fmtRelativeTime(s) {
  if (!s) return '-';
  try {
    const diff = Date.now() - new Date(s).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return '방금';
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}일 전`;
    return s.slice(0, 10);
  } catch {
    return s;
  }
}
