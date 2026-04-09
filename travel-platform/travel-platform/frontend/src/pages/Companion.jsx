import React, { useEffect, useState } from 'react';
import { api } from '../api';

function timeUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return '출발함';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '오늘 출발!';
  if (days === 1) return '내일 출발';
  return `D-${days}`;
}

export default function Companion({ currentUser, onProfile }) {
  const [companions, setCompanions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterCountry, setFilterCountry] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', destination: '', country: '',
    startDate: '', endDate: '', maxPeople: 2
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, [filterCountry]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getCompanions(filterCountry);
      setCompanions(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const submit = async () => {
    if (!form.title.trim() || !form.destination.trim()) return;
    setSubmitting(true);
    try {
      await api.createCompanion({ ...form, userId: currentUser.id, maxPeople: Number(form.maxPeople) });
      setShowForm(false);
      setForm({ title: '', description: '', destination: '', country: '', startDate: '', endDate: '', maxPeople: 2 });
      load();
    } catch (e) { alert('등록 실패: ' + e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('동행 구하기 글을 삭제할까요?')) return;
    try { await api.deleteCompanion(id); load(); }
    catch (e) { alert('삭제 실패'); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const activeCompanions = companions.filter(c => !c.startDate || c.startDate >= today);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="page-title">🤝 동행 구하기</div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ padding: '9px 18px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + 동행 구하기
        </button>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '20px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>✈️ 동행 구하기 등록</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="제목 (예: 오사카 3박4일 동행 구합니다!)" value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="목적지 (예: 오사카)" value={form.destination}
                onChange={e => setForm(p => ({ ...p, destination: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }} />
              <input placeholder="국가 (예: 일본)" value={form.country}
                onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'block' }}>출발일</label>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'block' }}>귀국일</label>
                <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'block' }}>모집 인원</label>
                <select value={form.maxPeople} onChange={e => setForm(p => ({ ...p, maxPeople: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                  {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}명</option>)}
                </select>
              </div>
            </div>
            <textarea placeholder="자기소개 & 여행 스타일을 알려주세요! (맛집 위주, 사진 많이, 느긋하게 등)" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submit} disabled={submitting}
                style={{ flex: 1, padding: '10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {submitting ? '등록 중...' : '등록하기'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 국가 필터 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['', '일본', '태국', '프랑스', '이탈리아', '스페인', '미국', '베트남', '인도네시아'].map(c => (
          <button key={c} onClick={() => setFilterCountry(c)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterCountry === c ? '#4f46e5' : '#eee'}`, background: filterCountry === c ? '#eef2ff' : 'white', color: filterCountry === c ? '#4f46e5' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {c || '🌍 전체'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : activeCompanions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>아직 동행 구하기 글이 없어요</div>
          <div style={{ fontSize: 13 }}>첫 번째로 동행을 구해보세요!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeCompanions.map(c => {
            const until = timeUntil(c.startDate);
            const isMe = c.userId === currentUser?.id;
            const spotsLeft = c.maxPeople - c.currentPeople;
            return (
              <div key={c.id} style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <img src={c.userProfileImage || `https://ui-avatars.com/api/?name=${c.userNickname}&background=4f46e5&color=fff&size=40`}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => onProfile?.(c.userId)} alt="" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', cursor: 'pointer' }}
                        onClick={() => onProfile?.(c.userId)}>{c.userNickname}</span>
                      {until && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: until === '출발함' ? '#f3f4f6' : '#eef2ff', color: until === '출발함' ? '#9ca3af' : '#4f46e5' }}>
                          {until}
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: spotsLeft > 0 ? '#f0fdf4' : '#fef2f2', color: spotsLeft > 0 ? '#16a34a' : '#dc2626', marginLeft: 'auto' }}>
                        {spotsLeft > 0 ? `${spotsLeft}자리 남음` : '마감'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 6 }}>{c.title}</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>📍 {c.destination}{c.country ? `, ${c.country}` : ''}</span>
                      {c.startDate && <span style={{ fontSize: 12, color: '#6b7280' }}>📅 {c.startDate}{c.endDate ? ` ~ ${c.endDate}` : ''}</span>}
                      <span style={{ fontSize: 12, color: '#6b7280' }}>👥 {c.currentPeople}/{c.maxPeople}명</span>
                    </div>
                    {c.description && <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{c.description}</div>}
                  </div>
                  {isMe && (
                    <button onClick={() => handleDelete(c.id)}
                      style={{ fontSize: 11, padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                      삭제
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
