import React, { useState, useEffect } from 'react';

const AD_CATEGORIES = [
  { key: 'restaurant', icon: '🍽️', label: '음식점/카페', desc: '맛집, 카페, 바 등' },
  { key: 'hotel', icon: '🏨', label: '숙소', desc: '호텔, 게스트하우스, 에어비앤비' },
  { key: 'tour', icon: '🎒', label: '투어/액티비티', desc: '가이드 투어, 체험, 클래스' },
  { key: 'city', icon: '🏙️', label: '도시/관광청', desc: '도시 홍보, 관광 캠페인' },
  { key: 'transport', icon: '✈️', label: '교통/항공', desc: '항공사, 렌터카, 교통패스' },
  { key: 'shopping', icon: '🛍️', label: '쇼핑', desc: '면세점, 기념품, 쇼핑몰' },
  { key: 'personal', icon: '👤', label: '개인 홍보', desc: '블로그, 유튜브, 게시물 부스트' },
  { key: 'other', icon: '📢', label: '기타', desc: '보험, 통신, 기타 여행 서비스' },
];

const COUNTRIES = [
  '전체', '한국', '일본', '프랑스', '이탈리아', '태국', '미국', '스페인',
  '영국', '독일', '홍콩', '싱가포르', '인도네시아', '체코', '터키', '네덜란드', 'UAE',
];

const STATUS_MAP = {
  draft: { label: '초안', color: '#9ca3af', bg: '#f3f4f6', icon: '📝' },
  pending: { label: '심사 중', color: '#f59e0b', bg: '#fffbeb', icon: '⏳' },
  approved: { label: '승인됨', color: '#3b82f6', bg: '#eff6ff', icon: '✅' },
  active: { label: '운영 중', color: '#10b981', bg: '#ecfdf5', icon: '🟢' },
  paused: { label: '일시정지', color: '#f59e0b', bg: '#fffbeb', icon: '⏸' },
  ended: { label: '종료', color: '#6b7280', bg: '#f3f4f6', icon: '⏹' },
  rejected: { label: '거절', color: '#ef4444', bg: '#fef2f2', icon: '❌' },
};

export default function AdDashboard({ currentUser }) {
  const [view, setView] = useState('list'); // list, register, create, stats
  const [advertiser, setAdvertiser] = useState(null);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAd, setSelectedAd] = useState(null);

  // 광고주 등록 폼
  const [regForm, setRegForm] = useState({
    company_name: '', contact_email: currentUser?.email || '',
    contact_phone: '', website: '', category: 'restaurant',
  });

  // 광고 생성 폼
  const [adForm, setAdForm] = useState({
    title: '', description: '', image_url: '', link_url: '',
    cta_text: '자세히 보기', ad_type: 'feed', category: 'restaurant',
    target_country: '', target_city: '', target_style: '',
    budget_daily: 10000, budget_total: 300000,
    cost_per_click: 100, cost_per_impression: 10,
    start_date: '', end_date: '',
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const advRes = await fetch('/api/advertisers');
      const advData = await advRes.json();
      const myAdv = advData.find(a => a.user_id === currentUser?.id);
      setAdvertiser(myAdv);

      if (myAdv) {
        const adsRes = await fetch('/api/ads?advertiser_id=' + myAdv.id);
        setAds(await adsRes.json());
      }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  // 광고주 등록
  const registerAdvertiser = async () => {
    if (!regForm.company_name || !regForm.contact_email) {
      alert('업체명과 이메일을 입력해주세요.');
      return;
    }
    try {
      const res = await fetch('/api/advertisers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...regForm, user_id: currentUser?.id }),
      });
      if (res.ok) {
        const data = await res.json();
        alert('광고주 등록이 완료되었습니다!');
        loadData();
        setView('list');
      }
    } catch(e) { alert('등록 실패'); }
  };

  // 광고 이미지 업로드
  const uploadAdImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setAdForm(p => ({ ...p, image_url: data.feed || data.url }));
      }
    } catch(e) { alert('이미지 업로드 실패'); }
    setUploading(false);
  };

  // 광고 생성
  const createAd = async () => {
    if (!adForm.title || !adForm.link_url) {
      alert('제목과 링크를 입력해주세요.');
      return;
    }
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adForm, advertiser_id: advertiser.id }),
      });
      if (res.ok) {
        alert('광고가 등록되었습니다! 관리자 심사 후 활성화됩니다.');
        loadData();
        setView('list');
        setAdForm({
          title: '', description: '', image_url: '', link_url: '',
          cta_text: '자세히 보기', ad_type: 'feed', category: 'restaurant',
          target_country: '', target_city: '', target_style: '',
          budget_daily: 10000, budget_total: 300000,
          cost_per_click: 100, cost_per_impression: 10,
          start_date: '', end_date: '',
        });
      }
    } catch(e) { alert('광고 등록 실패'); }
  };

  // 광고 상태 변경
  const toggleAd = async (adId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await fetch(`/api/ads/${adId}/status?status=${newStatus}`, { method: 'PUT' });
    loadData();
  };

  if (loading) return <div className="empty">로딩 중...</div>;

  // ── 광고주 미등록 ──
  if (!advertiser && view !== 'register') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="page-header">
          <div className="page-title">📢 광고</div>
        </div>

        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📢</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>
            Travellog에 광고하세요
          </div>
          <div style={{ fontSize: 14, color: '#9ca3af', marginBottom: 32, lineHeight: 1.6 }}>
            전 세계 여행자들에게 당신의 서비스를 알려보세요.<br/>
            음식점, 숙소, 투어, 도시 관광청 누구나 광고할 수 있어요.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 600, margin: '0 auto 32px' }}>
            {AD_CATEGORIES.map(cat => (
              <div key={cat.key} style={{ padding: 16, borderRadius: 14, background: '#f9fafb', border: '1px solid #f0f0f0', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{cat.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{cat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: '#fff5f5', borderRadius: 12, textAlign: 'left' }}>
              <span style={{ fontSize: 24 }}>💰</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: '#FF5A5F' }}>하루 1,000원부터</div><div style={{ fontSize: 11, color: '#9ca3af' }}>소액으로 시작 가능</div></div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: '#ecfdf5', borderRadius: 12, textAlign: 'left' }}>
              <span style={{ fontSize: 24 }}>🎯</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>정확한 타겟팅</div><div style={{ fontSize: 11, color: '#9ca3af' }}>국가/도시/여행스타일 맞춤</div></div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: '#eff6ff', borderRadius: 12, textAlign: 'left' }}>
              <span style={{ fontSize: 24 }}>📊</span>
              <div><div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>실시간 성과 확인</div><div style={{ fontSize: 11, color: '#9ca3af' }}>노출, 클릭, CTR 대시보드</div></div>
            </div>
          </div>

          <button onClick={() => setView('register')}
            style={{ marginTop: 32, padding: '14px 40px', borderRadius: 14, background: '#FF5A5F', color: 'white',
              fontSize: 16, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,90,95,0.3)' }}>
            🚀 광고주 등록하기
          </button>
        </div>
      </div>
    );
  }

  // ── 광고주 등록 폼 ──
  if (view === 'register') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="page-header">
          <div className="page-title">📢 광고주 등록</div>
        </div>

        <div style={{ maxWidth: 500, margin: '0 auto', width: '100%' }}>
          <div style={{ background: 'white', borderRadius: 18, border: '1px solid #f0f0f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>광고 카테고리</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {AD_CATEGORIES.map(cat => (
                <button key={cat.key} onClick={() => setRegForm(p => ({ ...p, category: cat.key }))}
                  style={{ padding: '10px 4px', borderRadius: 12, border: regForm.category === cat.key ? '2px solid #FF5A5F' : '1px solid #eee',
                    background: regForm.category === cat.key ? '#fff5f5' : 'white', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 20 }}>{cat.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: regForm.category === cat.key ? '#FF5A5F' : '#6b7280', marginTop: 4 }}>{cat.label}</div>
                </button>
              ))}
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block' }}>업체명/이름 *</label>
              <input className="form-input" placeholder="예: 도쿄라멘하우스, 방콕게스트하우스, 서울관광재단"
                value={regForm.company_name} onChange={e => setRegForm(p => ({ ...p, company_name: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block' }}>이메일 *</label>
              <input className="form-input" type="email" placeholder="광고 관련 연락받을 이메일"
                value={regForm.contact_email} onChange={e => setRegForm(p => ({ ...p, contact_email: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block' }}>전화번호</label>
              <input className="form-input" placeholder="선택 사항"
                value={regForm.contact_phone} onChange={e => setRegForm(p => ({ ...p, contact_phone: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block' }}>웹사이트</label>
              <input className="form-input" placeholder="https://"
                value={regForm.website} onChange={e => setRegForm(p => ({ ...p, website: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={registerAdvertiser} className="btn-primary" style={{ flex: 1 }}>등록하기</button>
              <button onClick={() => setView('list')} className="btn-secondary">취소</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 광고 생성 폼 ──
  if (view === 'create') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="page-header">
          <div className="page-title">✨ 새 광고 만들기</div>
        </div>

        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <div style={{ background: 'white', borderRadius: 18, border: '1px solid #f0f0f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* 미리보기 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af' }}>📱 미리보기</div>
            <div style={{ background: '#f9fafb', borderRadius: 14, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
              <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: '#FF5A5F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, color: 'white', fontWeight: 800 }}>AD</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e' }}>Sponsored</span>
                <span style={{ fontSize: 9, color: '#d1d5db', marginLeft: 'auto', background: '#f3f4f6', padding: '1px 6px', borderRadius: 6 }}>광고</span>
              </div>
              {adForm.image_url && <img src={adForm.image_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />}
              {!adForm.image_url && <div style={{ width: '100%', aspectRatio: '16/9', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>이미지를 업로드하세요</div>}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{adForm.title || '광고 제목'}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{adForm.description || '광고 설명'}</div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0' }} />

            {/* 기본 정보 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>📝 기본 정보</div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>광고 제목 *</label>
              <input className="form-input" placeholder="예: 도쿄 시부야 인기 라멘집 20% 할인"
                value={adForm.title} onChange={e => setAdForm(p => ({ ...p, title: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>설명</label>
              <textarea className="form-textarea" rows={2} placeholder="광고 내용을 간단히 설명해주세요"
                value={adForm.description} onChange={e => setAdForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>광고 이미지</label>
              {adForm.image_url ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={adForm.image_url} alt="" style={{ width: 200, height: 120, objectFit: 'cover', borderRadius: 10 }} />
                  <button onClick={() => setAdForm(p => ({ ...p, image_url: '' }))}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ) : (
                <div>
                  <input type="file" accept="image/*" onChange={uploadAdImage} style={{ display: 'none' }} id="ad-image-input" />
                  <label htmlFor="ad-image-input" className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', fontSize: 13 }}>
                    {uploading ? '업로드 중...' : '📁 이미지 선택'}
                  </label>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>권장: 1200x628px (16:9 비율)</div>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>링크 URL *</label>
              <input className="form-input" placeholder="https://your-website.com"
                value={adForm.link_url} onChange={e => setAdForm(p => ({ ...p, link_url: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>버튼 텍스트</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['자세히 보기', '예약하기', '둘러보기', '지금 구매', '더 알아보기', '방문하기'].map(txt => (
                  <button key={txt} onClick={() => setAdForm(p => ({ ...p, cta_text: txt }))}
                    style={{ padding: '6px 12px', borderRadius: 8, border: adForm.cta_text === txt ? '1.5px solid #FF5A5F' : '1px solid #eee',
                      background: adForm.cta_text === txt ? '#fff5f5' : 'white', color: adForm.cta_text === txt ? '#FF5A5F' : '#6b7280',
                      fontSize: 12, fontWeight: adForm.cta_text === txt ? 700 : 500, cursor: 'pointer' }}>{txt}</button>
                ))}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0' }} />

            {/* 타겟팅 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>🎯 타겟팅</div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>타겟 국가</label>
              <select className="form-input" value={adForm.target_country} onChange={e => setAdForm(p => ({ ...p, target_country: e.target.value }))}>
                <option value="">전체 국가</option>
                {COUNTRIES.filter(c => c !== '전체').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>타겟 도시</label>
              <input className="form-input" placeholder="예: 도쿄, 파리 (비워두면 전체)"
                value={adForm.target_city} onChange={e => setAdForm(p => ({ ...p, target_city: e.target.value }))} />
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0' }} />

            {/* 예산 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>💰 예산</div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>일일 예산 (원)</label>
                <input className="form-input" type="number" min="1000" step="1000"
                  value={adForm.budget_daily} onChange={e => setAdForm(p => ({ ...p, budget_daily: parseInt(e.target.value) || 0 }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>총 예산 (원)</label>
                <input className="form-input" type="number" min="10000" step="10000"
                  value={adForm.budget_total} onChange={e => setAdForm(p => ({ ...p, budget_total: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div style={{ background: '#f9fafb', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>📊 예상 일일 노출: <b style={{ color: '#1a1a2e' }}>{Math.floor(adForm.budget_daily / (adForm.cost_per_impression || 10)).toLocaleString()}회</b></div>
                <div>👆 예상 일일 클릭: <b style={{ color: '#1a1a2e' }}>{Math.floor(adForm.budget_daily / (adForm.cost_per_click || 100)).toLocaleString()}회</b></div>
                <div>📅 예상 운영 기간: <b style={{ color: '#1a1a2e' }}>{adForm.budget_daily > 0 ? Math.floor(adForm.budget_total / adForm.budget_daily) : 0}일</b></div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #f0f0f0' }} />

            {/* 기간 */}
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>📅 기간</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>시작일</label>
                <input className="form-input" type="date" value={adForm.start_date} onChange={e => setAdForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4, display: 'block' }}>종료일</label>
                <input className="form-input" type="date" value={adForm.end_date} onChange={e => setAdForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={createAd} className="btn-primary" style={{ flex: 1 }}>🚀 광고 등록하기</button>
              <button onClick={() => setView('list')} className="btn-secondary">취소</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 광고 통계 ──
  if (view === 'stats' && selectedAd) {
    const st = STATUS_MAP[selectedAd.status] || STATUS_MAP.draft;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="page-header">
          <button onClick={() => { setView('list'); setSelectedAd(null); }} style={{ background: 'none', border: 'none', fontSize: 14, color: '#9ca3af', cursor: 'pointer' }}>← 뒤로</button>
          <div className="page-title">📊 {selectedAd.title}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6' }}>{(selectedAd.impressions || 0).toLocaleString()}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>👁 노출</div>
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{selectedAd.clicks || 0}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>👆 클릭</div>
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{selectedAd.ctr || 0}%</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>📊 CTR</div>
          </div>
          <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#FF5A5F' }}>₩{((selectedAd.impressions || 0) * (selectedAd.cost_per_impression || 10) + (selectedAd.clicks || 0) * (selectedAd.cost_per_click || 100)).toLocaleString()}</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>💰 소진액</div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>광고 정보</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: '#6b7280' }}>
            <div>상태: <span style={{ fontWeight: 700, color: st.color }}>{st.icon} {st.label}</span></div>
            <div>타겟: {selectedAd.target_country || '전체'} {selectedAd.target_city ? `> ${selectedAd.target_city}` : ''}</div>
            <div>일일 예산: ₩{(selectedAd.budget_daily || 0).toLocaleString()}</div>
            <div>총 예산: ₩{(selectedAd.budget_total || 0).toLocaleString()}</div>
            <div>CPC: ₩{selectedAd.cost_per_click || 0} / CPM: ₩{(selectedAd.cost_per_impression || 0) * 1000}</div>
            <div>기간: {selectedAd.start_date || '미설정'} ~ {selectedAd.end_date || '미설정'}</div>
            {selectedAd.reject_reason && <div style={{ color: '#ef4444' }}>거절 사유: {selectedAd.reject_reason}</div>}
          </div>
        </div>

        {selectedAd.image_url && (
          <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
            <img src={selectedAd.image_url} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
          </div>
        )}
      </div>
    );
  }

  // ── 광고 목록 (메인 대시보드) ──
  const activeAds = ads.filter(a => a.status === 'active');
  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header">
        <div className="page-title">📢 광고 대시보드</div>
      </div>

      {/* 광고주 정보 */}
      <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🏢 {advertiser.company_name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{advertiser.contact_email}</div>
        </div>
        <button onClick={() => setView('create')}
          style={{ padding: '10px 20px', borderRadius: 12, background: '#FF5A5F', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + 새 광고
        </button>
      </div>

      {/* 전체 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{activeAds.length}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>운영 중</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{totalImpressions.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>총 노출</div>
        </div>
        <div style={{ background: 'white', borderRadius: 14, padding: 16, border: '1px solid #f0f0f0', textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{totalClicks}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>총 클릭</div>
        </div>
      </div>

      {/* 광고 목록 */}
      {ads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📢</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>아직 등록한 광고가 없어요</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>새 광고를 만들어보세요!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ads.map(ad => {
            const st = STATUS_MAP[ad.status] || STATUS_MAP.draft;
            return (
              <div key={ad.id} style={{ background: 'white', borderRadius: 14, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 12, padding: 14, cursor: 'pointer' }}
                  onClick={() => { setSelectedAd(ad); setView('stats'); }}>
                  {ad.image_url && <img src={ad.image_url} alt="" style={{ width: 80, height: 56, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{ad.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 8, background: st.bg, color: st.color }}>{st.icon} {st.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 10 }}>
                      <span>👁 {(ad.impressions || 0).toLocaleString()}</span>
                      <span>👆 {ad.clicks || 0}</span>
                      <span>📊 {ad.ctr || 0}%</span>
                      <span>💰 ₩{(ad.budget_daily || 0).toLocaleString()}/일</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
                  {(ad.status === 'active' || ad.status === 'paused') && (
                    <button onClick={() => toggleAd(ad.id, ad.status)}
                      style={{ padding: '4px 12px', borderRadius: 8, background: ad.status === 'active' ? '#fffbeb' : '#ecfdf5',
                        color: ad.status === 'active' ? '#f59e0b' : '#10b981', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {ad.status === 'active' ? '⏸ 일시정지' : '▶ 재개'}
                    </button>
                  )}
                  <button onClick={() => { setSelectedAd(ad); setView('stats'); }}
                    style={{ padding: '4px 12px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    📊 통계
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
