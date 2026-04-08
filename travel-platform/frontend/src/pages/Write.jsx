import React, { useState } from 'react';
import { api } from '../api';

const emptyPlace = () => ({ name: '', address: '', lat: '', lng: '', category: '관광', howToGet: '', tip: '' });

export default function Write({ currentUser, onDone }) {
  const [form, setForm] = useState({ title: '', content: '', country: '', city: '', tags: '', images: [''] });
  const [places, setPlaces] = useState([emptyPlace()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const updateImg = (i, val) => setForm(p => ({ ...p, images: p.images.map((v, j) => j === i ? val : v) }));
  const addImg = () => setForm(p => ({ ...p, images: [...p.images, ''] }));
  const removeImg = (i) => setForm(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }));
  const updatePlace = (i, key, val) => setPlaces(prev => prev.map((p, j) => j === i ? { ...p, [key]: val } : p));
  const addPlace = () => setPlaces(p => [...p, emptyPlace()]);
  const removePlace = (i) => setPlaces(p => p.filter((_, j) => j !== i));

  const submit = async () => {
    if (!form.title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!currentUser) { setError('로그인이 필요해요.'); return; }
    setLoading(true); setError('');
    try {
      const tags = form.tags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
      const images = form.images.filter(Boolean);
      const validPlaces = places
        .filter(p => p.name.trim())
        .map((p, i) => ({ ...p, order: i + 1, lat: parseFloat(p.lat) || 0, lng: parseFloat(p.lng) || 0 }));
      await api.createPost({ ...form, tags, images, places: validPlaces, userId: currentUser.id });
      onDone?.();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">✍️ 여행 게시물 작성</div>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="post-form">
        <div className="form-group">
          <label className="form-label">제목 *</label>
          <input className="form-input" placeholder="여행 제목을 입력하세요" value={form.title} onChange={e => update('title', e.target.value)} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">국가</label>
            <input className="form-input" placeholder="예: 일본" value={form.country} onChange={e => update('country', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">도시</label>
            <input className="form-input" placeholder="예: 오사카" value={form.city} onChange={e => update('city', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">여행 이야기</label>
          <textarea className="form-textarea" placeholder="여행 이야기를 자유롭게 적어주세요..." value={form.content} onChange={e => update('content', e.target.value)} rows={5} />
        </div>

        <div className="form-group">
          <label className="form-label">태그 (쉼표 또는 # 로 구분)</label>
          <input className="form-input" placeholder="예: 오사카, 일본여행, 먹방" value={form.tags} onChange={e => update('tags', e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">사진 URL</label>
          <div className="image-url-list">
            {form.images.map((img, i) => (
              <div key={i} className="image-url-item">
                {img && <img className="image-preview" src={img} alt="" onError={e => e.target.style.display='none'} />}
                <input className="form-input" style={{ flex: 1 }} placeholder="https://..." value={img} onChange={e => updateImg(i, e.target.value)} />
                {form.images.length > 1 && <button className="btn-remove" onClick={() => removeImg(i)}>✕</button>}
              </div>
            ))}
            <button className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '7px 14px' }} onClick={addImg}>+ 사진 추가</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">여행 코스 (장소)</label>
          <div className="place-form-list">
            {places.map((place, i) => (
              <div key={i} className="place-form-item">
                <div className="place-form-header">
                  <span className="place-form-title">장소 {i + 1}</span>
                  {places.length > 1 && <button className="btn-remove" onClick={() => removePlace(i)}>✕</button>}
                </div>
                <input className="form-input" placeholder="장소명 *" value={place.name} onChange={e => updatePlace(i, 'name', e.target.value)} />
                <input className="form-input" placeholder="주소" value={place.address} onChange={e => updatePlace(i, 'address', e.target.value)} />
                <div className="place-form-grid">
                  <input className="form-input" placeholder="위도 (예: 34.6687)" value={place.lat} onChange={e => updatePlace(i, 'lat', e.target.value)} />
                  <input className="form-input" placeholder="경도 (예: 135.5003)" value={place.lng} onChange={e => updatePlace(i, 'lng', e.target.value)} />
                </div>
                <input className="form-input" placeholder="가는 방법 (예: 난바역 14번 출구 도보 3분)" value={place.howToGet} onChange={e => updatePlace(i, 'howToGet', e.target.value)} />
                <input className="form-input" placeholder="꿀팁 (선택)" value={place.tip} onChange={e => updatePlace(i, 'tip', e.target.value)} />
              </div>
            ))}
            <button className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '7px 14px' }} onClick={addPlace}>+ 장소 추가</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? '게시 중...' : '게시하기'}</button>
          <button className="btn-secondary" onClick={onDone}>취소</button>
        </div>
      </div>
    </div>
  );
}
