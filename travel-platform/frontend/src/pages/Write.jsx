import React, { useState, useRef } from 'react';
import { api } from '../api';

const emptyPlace = () => ({ name: '', address: '', lat: '', lng: '', category: '관광', howToGet: '', tip: '' });

// EXIF GPS 추출 함수
async function extractGPS(file) {
  try {
    // exifr 동적 로드
    const exifr = await import('https://cdn.jsdelivr.net/npm/exifr/dist/full.esm.mjs');
    const result = await exifr.parse(file, ['GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef']);
    if (!result || !result.GPSLatitude) return null;

    let lat = result.GPSLatitude[0] + result.GPSLatitude[1]/60 + result.GPSLatitude[2]/3600;
    let lng = result.GPSLongitude[0] + result.GPSLongitude[1]/60 + result.GPSLongitude[2]/3600;
    if (result.GPSLatitudeRef === 'S') lat = -lat;
    if (result.GPSLongitudeRef === 'W') lng = -lng;

    return { lat: lat.toFixed(6), lng: lng.toFixed(6) };
  } catch (e) {
    return null;
  }
}

export default function Write({ currentUser, onDone }) {
  const [form, setForm] = useState({ title: '', content: '', country: '', city: '', tags: '', images: [], visibility: 'public' });
  const [places, setPlaces] = useState([emptyPlace()]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [gpsFound, setGpsFound] = useState([]);
  const fileRef = useRef();

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const removeImg = (i) => setForm(p => ({ ...p, images: p.images.filter((_, j) => j !== i) }));
  const updatePlace = (i, key, val) => setPlaces(prev => prev.map((p, j) => j === i ? { ...p, [key]: val } : p));
  const addPlace = () => setPlaces(p => [...p, emptyPlace()]);
  const removePlace = (i) => setPlaces(p => p.filter((_, j) => j !== i));

  // 파일 업로드 + EXIF GPS 추출
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (form.images.length + files.length > 10) { setError('사진은 최대 10장까지 추가할 수 있어요.'); return; }

    // 파일 크기 검증
    const overSize = files.filter(f => f.size > 5 * 1024 * 1024);
    if (overSize.length > 0) {
      setError(`${overSize.map(f => f.name).join(', ')} 파일이 5MB를 초과합니다.`);
      e.target.value = '';
      return;
    }

    setUploading(true); setError('');

    // EXIF GPS 추출
    const gpsResults = [];
    for (const file of files) {
      const gps = await extractGPS(file);
      if (gps) gpsResults.push({ filename: file.name, ...gps });
    }
    if (gpsResults.length > 0) {
      autoApplyGPS(gpsResults);
    }

    // 업로드
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      const res = await fetch('/api/upload/multiple', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setForm(p => ({ ...p, images: [...p.images, ...data.urls] }));
      } else {
        setError(data.error || '업로드 실패');
      }
    } catch (e) { setError('업로드 중 오류가 발생했습니다.'); }
    setUploading(false);
    e.target.value = '';
  };

  // GPS 정보를 장소에 자동 적용
  const applyGPS = (gps, placeIdx) => {
    updatePlace(placeIdx, 'lat', gps.lat);
    updatePlace(placeIdx, 'lng', gps.lng);
    setGpsFound(prev => prev.filter(g => g !== gps));
  };

  // 첫 GPS 자동 적용
  const autoApplyGPS = (gpsResults) => {
    gpsResults.forEach((gps, i) => {
      if (i < places.length) {
        setPlaces(prev => prev.map((p, j) => j === i ? { ...p, lat: gps.lat, lng: gps.lng } : p));
      }
    });
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    if (form.images.length >= 10) { setError('사진은 최대 10장까지 추가할 수 있어요.'); return; }
    setForm(p => ({ ...p, images: [...p.images, urlInput.trim()] }));
    setUrlInput('');
  };

  const submit = async () => {
    if (!form.title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!currentUser) { setError('로그인이 필요해요.'); return; }
    setLoading(true); setError('');
    try {
      const tags = form.tags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
      const validPlaces = places
        .filter(p => p.name.trim())
        .map((p, i) => ({ ...p, order: i + 1, lat: parseFloat(p.lat) || 0, lng: parseFloat(p.lng) || 0 }));
      await api.createPost({ ...form, tags, places: validPlaces, userId: currentUser.id });
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

        {/* 사진 업로드 */}
        <div className="form-group">
          <label className="form-label">공개 설정</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => update('visibility', 'public')}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${form.visibility === 'public' ? '#4f46e5' : '#eee'}`, background: form.visibility === 'public' ? '#eef2ff' : 'white', color: form.visibility === 'public' ? '#4f46e5' : '#9ca3af', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🌏 전체 공개
            </button>
            <button onClick={() => update('visibility', 'private')}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${form.visibility === 'private' ? '#4f46e5' : '#eee'}`, background: form.visibility === 'private' ? '#eef2ff' : 'white', color: form.visibility === 'private' ? '#4f46e5' : '#9ca3af', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🔒 나만 보기
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">사진 ({form.images.length}/10)</label>

          {form.images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
              {form.images.map((img, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1' }}>
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removeImg(i)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 16px' }}
              onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? '업로드 중...' : '📁 사진 파일 선택'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="또는 이미지 URL 직접 입력"
              value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUrl()} />
            <button className="btn-secondary" style={{ fontSize: 13, padding: '11px 16px', flexShrink: 0 }} onClick={addUrl}>추가</button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>jpg, png, gif, webp / 파일당 최대 5MB / 최대 10장</div>
        </div>

        {/* GPS 자동 적용 완료 알림 */}
        {gpsFound.length === 0 && places.some(p => p.lat && p.lng) && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 12, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            📍 사진 위치 정보가 자동으로 저장됐어요!
          </div>
        )}

        {/* 장소 */}
        <div className="form-group">
          <label className="form-label">여행 코스 (장소)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {places.map((place, i) => (
              <div key={i} className="place-form-item">
                <div className="place-form-header">
                  <span className="place-form-label">장소 {i + 1}</span>
                  {places.length > 1 && <button className="btn-remove" onClick={() => removePlace(i)}>✕</button>}
                </div>
                <input className="form-input" placeholder="장소명 *" value={place.name} onChange={e => updatePlace(i, 'name', e.target.value)} />
                <input className="form-input" placeholder="주소" value={place.address} onChange={e => updatePlace(i, 'address', e.target.value)} />
                {place.lat && place.lng && (
                  <div style={{ fontSize: 12, color: '#10b981', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>📍 위치 정보 저장됨</span>
                    <a href={`https://maps.google.com/?q=${place.lat},${place.lng}`} target="_blank" rel="noreferrer"
                      style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 600 }}>지도 확인 →</a>
                  </div>
                )}
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
