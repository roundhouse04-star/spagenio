import React, { useState, useEffect } from 'react';

const STATUS_MAP = {
  draft: { label: '초안', color: '#9ca3af', bg: '#f3f4f6' },
  pending: { label: '심사 중', color: '#f59e0b', bg: '#fffbeb' },
  approved: { label: '승인됨', color: '#3b82f6', bg: '#eff6ff' },
  active: { label: '운영 중', color: '#10b981', bg: '#ecfdf5' },
  paused: { label: '일시정지', color: '#f59e0b', bg: '#fffbeb' },
  ended: { label: '종료', color: '#6b7280', bg: '#f3f4f6' },
  rejected: { label: '거절', color: '#ef4444', bg: '#fef2f2' },
};

export default function AdminAds() {
  const [ads, setAds] = useState([]);
  const [advertisers, setAdvertisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [selectedAd, setSelectedAd] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [adsRes, advRes] = await Promise.all([
        fetch('/api/ads'),
        fetch('/api/advertisers')
      ]);
      setAds(await adsRes.json());
      setAdvertisers(await advRes.json());
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (adId, status, reason = '') => {
    await fetch(`/api/ads/${adId}/status?status=${status}&reject_reason=${encodeURIComponent(reason)}`, { method: 'PUT' });
    load();
  };

  const filtered = tab === 'all' ? ads : ads.filter(a => a.status === tab);
  const pendingCount = ads.filter(a => a.status === 'pending').length;
  const activeCount = ads.filter(a => a.status === 'active').length;

  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const totalCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">📢 광고 관리</div>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FF5A5F' }}>{ads.length}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>전체 광고</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{activeCount}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>운영 중</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{totalImpressions.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>총 노출</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{totalCTR}%</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>평균 CTR</div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: '전체', count: ads.length },
          { key: 'pending', label: '심사 대기', count: pendingCount },
          { key: 'active', label: '운영 중', count: activeCount },
          { key: 'paused', label: '일시정지', count: ads.filter(a => a.status === 'paused').length },
          { key: 'rejected', label: '거절', count: ads.filter(a => a.status === 'rejected').length },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '7px 14px', borderRadius: 10, border: tab === t.key ? '1.5px solid #FF5A5F' : '1px solid #eee',
              background: tab === t.key ? '#fff5f5' : 'white', color: tab === t.key ? '#FF5A5F' : '#6b7280',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer' }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* 광고 목록 */}
      {loading ? <div className="empty">로딩 중...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(ad => {
            const st = STATUS_MAP[ad.status] || STATUS_MAP.draft;
            const advertiser = advertisers.find(a => a.id === ad.advertiser_id);
            return (
              <div key={ad.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 14, padding: 14 }}>
                  {ad.image_url && (
                    <img src={ad.image_url} alt="" style={{ width: 100, height: 70, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{ad.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{ad.description}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>🏢 {advertiser?.company_name || '-'}</span>
                      <span>🌍 {ad.target_country || '전체'}</span>
                      <span>👁 {(ad.impressions || 0).toLocaleString()}</span>
                      <span>👆 {ad.clicks || 0}</span>
                      <span>📊 CTR {ad.ctr || 0}%</span>
                      <span>💰 ₩{(ad.budget_daily || 0).toLocaleString()}/일</span>
                    </div>
                  </div>
                </div>
                {/* 액션 버튼 */}
                <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px', flexWrap: 'wrap' }}>
                  {ad.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(ad.id, 'active')}
                        style={{ padding: '5px 12px', borderRadius: 8, background: '#10b981', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ✅ 승인 & 활성화
                      </button>
                      <button onClick={() => { const reason = prompt('거절 사유:'); if (reason) updateStatus(ad.id, 'rejected', reason); }}
                        style={{ padding: '5px 12px', borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ❌ 거절
                      </button>
                    </>
                  )}
                  {ad.status === 'active' && (
                    <button onClick={() => updateStatus(ad.id, 'paused')}
                      style={{ padding: '5px 12px', borderRadius: 8, background: '#fffbeb', color: '#f59e0b', border: '1px solid #fde68a', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ⏸ 일시정지
                    </button>
                  )}
                  {ad.status === 'paused' && (
                    <button onClick={() => updateStatus(ad.id, 'active')}
                      style={{ padding: '5px 12px', borderRadius: 8, background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ▶ 재개
                    </button>
                  )}
                  {ad.status === 'rejected' && ad.reject_reason && (
                    <span style={{ fontSize: 12, color: '#ef4444', fontStyle: 'italic' }}>사유: {ad.reject_reason}</span>
                  )}
                  <a href={ad.link_url} target="_blank" rel="noreferrer"
                    style={{ padding: '5px 12px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                    🔗 링크 확인
                  </a>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty">해당 상태의 광고가 없어요</div>}
        </div>
      )}
    </div>
  );
}
