import React, { useState, useRef } from 'react';
import { api } from '../api';
import { TRAVEL_STYLES } from '../travelStyles';

const emptyPlace = () => ({ name: '', address: '', lat: '', lng: '', category: 'Attraction', howToGet: '', tip: '' });

// EXIF GPS Extract function
async function extractGPS(file) {
  try {
    // exifr Dynamic Load
    const exifr = await import('https://cdn.jsdelivr.net/npm/exifr/dist/full.esm.mjs');
    const result = await exifr.parse(file, ['GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef']);
    if (!result ||!result.GPSLatitude) return null;

    let lat = result.GPSLatitude[0] + result.GPSLatitude[1]/60 + result.GPSLatitude[2]/3600;
    let lng = result.GPSLongitude[0] + result.GPSLongitude[1]/60 + result.GPSLongitude[2]/3600;
    if (result.GPSLatitudeRef === 'S') lat = -lat;
    if (result.GPSLongitudeRef === 'W') lng = -lng;

    return { lat: lat.toFixed(6), lng: lng.toFixed(6) };
  } catch (e) {
    return null;
  }
}

export default function Write({ currentUser, onDone, draft }) {
  const [form, setForm] = useState({
    title: draft?.title || '',
    content: draft?.content || '',
    country: draft?.country || '',
    city: draft?.city || '',
    tags: draft?.tags?.join(', ') || '',
    images: [],
    visibility: 'public'
  });
  const [travelStyles, setTravelStyles] = useState(draft?.tags || []);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeInfo, setYoutubeInfo] = useState(null); // { title, thumbnail }
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [places, setPlaces] = useState([emptyPlace()]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [gpsFound, setGpsFound] = useState([]);
  const fileRef = useRef();

  const update = (key, val) => setForm(p => ({...p, [key]: val }));
  const removeImg = (i) => setForm(p => ({...p, images: p.images.filter((_, j) => j!== i) }));
  const updatePlace = (i, key, val) => setPlaces(prev => prev.map((p, j) => j === i? {...p, [key]: val } : p));
  const addPlace = () => setPlaces(p => [...p, emptyPlace()]);
  const removePlace = (i) => setPlaces(p => p.filter((_, j) => j!== i));

  // file Upload + EXIF GPS Extract
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));

    if (form.images.length + imageFiles.length > 10) { setError('You can add up to 10 photos.'); return; }

    const overImg = imageFiles.filter(f => f.size > 30 * 1024 * 1024);
    if (overImg.length > 0) {
      setError(overImg.map(f => f.name).join(', ') + ' files exceed 30MB.');
      e.target.value = ''; return;
    }
    const overVid = videoFiles.filter(f => f.size > 500 * 1024 * 1024);
    if (overVid.length > 0) {
      setError(overVid.map(f => f.name).join(', ') + ' Video exceeds 500MB.');
      e.target.value = ''; return;
    }

    setUploading(true); setError('');

    if (imageFiles.length > 0) {
      const gpsResults = [];
      for (const file of imageFiles) {
        const gps = await extractGPS(file);
        if (gps) gpsResults.push({ filename: file.name,...gps });
      }
      if (gpsResults.length > 0) autoApplyGPS(gpsResults);
      try {
        const formData = new FormData();
        imageFiles.forEach(f => formData.append('files', f));
        const res = await fetch('/api/upload/multiple', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
          setForm(p => ({...p, images: [...p.images,...data.urls] }));
        } else { setError(data.error || 'Image Upload failed'); }
      } catch (err) { setError('An error occurred while uploading the image.'); }
    }

    for (const vf of videoFiles) {
      try {
        setError('Converting video... (up to 5 min)');
        const vFormData = new FormData();
        vFormData.append('file', vf);
        const vRes = await fetch('/api/upload/video', { method: 'POST', body: vFormData });
        const vData = await vRes.json();
        if (vRes.ok) {
          setForm(p => ({...p, images: [...p.images, vData.url] }));
          setError('');
        } else { setError(vData.detail || 'Video Upload failed'); }
      } catch (err) { setError('Video Upload failed: ' + vf.name); }
    }

    setUploading(false);
    e.target.value = '';
  };

  // Auto-apply GPS info to place apply
  const applyGPS = (gps, placeIdx) => {
    updatePlace(placeIdx, 'lat', gps.lat);
    updatePlace(placeIdx, 'lng', gps.lng);
    setGpsFound(prev => prev.filter(g => g!== gps));
  };

  // First GPS Auto apply
  const autoApplyGPS = (gpsResults) => {
    gpsResults.forEach((gps, i) => {
      if (i < places.length) {
        setPlaces(prev => prev.map((p, j) => j === i? {...p, lat: gps.lat, lng: gps.lng } : p));
      }
    });
  };

  const addUrl = () => {
    if (!urlInput.trim()) return;
    if (form.images.length >= 10) { setError('You can add up to 10 photos.'); return; }
    setForm(p => ({...p, images: [...p.images, urlInput.trim()] }));
    setUrlInput('');
  };

  const toggleStyle = (key) => {
    setTravelStyles(prev => prev.includes(key)? prev.filter(s => s!== key) : [...prev, key]);
  };

  // YouTube URLfrom oEmbed Info Extract
  const fetchYoutubeInfo = async (url) => {
    if (!url.trim()) { setYoutubeInfo(null); return; }
    const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(ytRegex);
    if (!match) { setYoutubeInfo(null); return; }
    const videoId = match[1];
    setYoutubeLoading(true);
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (res.ok) {
        const data = await res.json();
        setYoutubeInfo({ title: data.title, thumbnail: `https://img.youtube.com/vi/${videoId}/resdefault.jpg`, videoId, url });
      } else {
        setYoutubeInfo({ videoId, url, title: '', thumbnail: `https://img.youtube.com/vi/${videoId}/resdefault.jpg` });
      }
    } catch (e) {
      setYoutubeInfo({ videoId, url, title: '', thumbnail: `https://img.youtube.com/vi/${videoId}/resdefault.jpg` });
    }
    setYoutubeLoading(false);
  };

  const submit = async () => {
    if (!form.title.trim()) { setError('Enter a title.'); return; }
    if (!currentUser) { setError('LOGIN required.'); return; }
    setLoading(true); setError('');
    try {
      const tags = form.tags.split(/[,#\s]+/).map(t => t.trim()).filter(Boolean);
      const validPlaces = places
       .filter(p => p.name.trim())
       .map((p, i) => ({...p, order: i + 1, lat: parseFloat(p.lat) || 0, lng: parseFloat(p.lng) || 0 }));
      await api.createPost({...form, tags, travelStyles, places: validPlaces, userId: currentUser.id, youtubeUrl: youtubeInfo?.url || '', youtubeTitle: youtubeInfo?.title || '', youtubeThumbnail: youtubeInfo?.thumbnail || '' });
      onDone?.();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="page-header">
        <div className="page-title">✍️ Write travel post</div>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="post-form">
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" placeholder="Enter a travel title" value={form.title} onChange={e => update('title', e.target.value)} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Country</label>
            <input className="form-input" placeholder="e.g. Japan" value={form.country} onChange={e => update('country', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" placeholder="e.g. Osaka" value={form.city} onChange={e => update('city', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Travel stories</label>
          <textarea className="form-textarea" placeholder="Share your travel story freely..." value={form.content} onChange={e => update('content', e.target.value)} rows={5} />
        </div>

        <div className="form-group">
          <label className="form-label">TRAVEL STYLE (Multiple selectable)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TRAVEL_STYLES.map(s => {
              const Selected = travelStyles.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggleStyle(s.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 2, border: `1.5px solid ${Selected? s.color : '#E2E0DC'}`, background: Selected? s.bg : 'white', color: Selected? s.color : '#8A919C', fontSize: 13, fontWeight: Selected? 700 : 500, cursor: 'pointer', transition: 'all 0.1s' }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span> {s.label}
                </button>
              );
            })}
          </div>
          {travelStyles.length === 0 && <div style={{ fontSize: 11, color: '#8A919C', marginTop: 4 }}>Optional, but selected styles help discovery in Explore.</div>}
        </div>

        <div className="form-group">
          <label className="form-label">🎬 Related YouTube video (optional)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-input" style={{ flex: 1, marginBottom: 0 }}
              placeholder="YouTube URL (e.g. https://youtube.com/watch?v=...)"
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              onBlur={() => fetchYoutubeInfo(youtubeUrl)}
              onKeyDown={e => e.key === 'Enter' && fetchYoutubeInfo(youtubeUrl)} />
            <button type="button" onClick={() => fetchYoutubeInfo(youtubeUrl)}
              className="btn-secondary" style={{ fontSize: 13, padding: '0 14px', flexShrink: 0 }}>
              {youtubeLoading? '...' : 'OK'}
            </button>
          </div>
          {youtubeInfo && (
            <div style={{ marginTop: 10, display: 'flex', gap: 10, background: '#FAFAF8', border: '1px solid #E2E0DC', borderRadius: 3, padding: '10px 12px', alignItems: 'center' }}>
              <img src={youtubeInfo.thumbnail} alt="" style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2A3A', marginBottom: 2 }}>{youtubeInfo.title || 'YouTube Video'}</div>
                <a href={youtubeInfo.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1E2A3A' }}>▶ Watch on YouTube</a>
              </div>
              <button onClick={() => { setYoutubeInfo(null); setYoutubeUrl(''); }}
                style={{ color: '#8A919C', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Tags (Comma or # as separated)</label>
          <input className="form-input" placeholder="e.g. Osaka, Japan travel, foodie" value={form.tags} onChange={e => update('tags', e.target.value)} />
        </div>

        {/* Photo Upload */}
        <div className="form-group">
          <label className="form-label">Public Settings</label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => update('visibility', 'public')}
              style={{ flex: 1, padding: '10px', borderRadius: 2, border: `2px solid ${form.visibility === 'public'? '#1E2A3A' : '#E2E0DC'}`, background: form.visibility === 'public'? '#EEEDEA' : 'white', color: form.visibility === 'public'? '#1E2A3A' : '#8A919C', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🌏 Public
            </button>
            <button onClick={() => update('visibility', 'private')}
              style={{ flex: 1, padding: '10px', borderRadius: 2, border: `2px solid ${form.visibility === 'private'? '#1E2A3A' : '#E2E0DC'}`, background: form.visibility === 'private'? '#EEEDEA' : 'white', color: form.visibility === 'private'? '#1E2A3A' : '#8A919C', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              🔒 Only me
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Photo ({form.images.length}/10)</label>

          {form.images.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
              {form.images.map((img, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: 2, overflow: 'hidden', aspectRatio: '1' }}>
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
              {uploading? 'Upload...' : '📁 Photo/Video SELECT'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" style={{ flex: 1, marginBottom: 0 }} placeholder="or Image URL directly Enter"
              value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUrl()} />
            <button className="btn-secondary" style={{ fontSize: 13, padding: '11px 16px', flexShrink: 0 }} onClick={addUrl}>ADD</button>
          </div>
          <div style={{ fontSize: 11, color: '#8A919C', marginTop: 4 }}>jpg, png, gif, webp / file 30MB / 10</div>
        </div>

        {/* GPS Auto apply DONE ALERTS */}
        {gpsFound.length === 0 && places.some(p => p.lat && p.lng) && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 3, padding: 12, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            📍 Photo location auto-saved!
          </div>
        )}

        {/* Place */}
        <div className="form-group">
          <label className="form-label">TRAVEL Route (Place)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {places.map((place, i) => (
              <div key={i} className="place-form-item">
                <div className="place-form-header">
                  <span className="place-form-label">Place {i + 1}</span>
                  {places.length > 1 && <button className="btn-remove" onClick={() => removePlace(i)}>✕</button>}
                </div>
                <input className="form-input" placeholder="place names *" value={place.name} onChange={e => updatePlace(i, 'name', e.target.value)} />
                <input className="form-input" placeholder="Address" value={place.address} onChange={e => updatePlace(i, 'address', e.target.value)} />
                {place.lat && place.lng && (
                  <div style={{ fontSize: 12, color: '#10b981', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2, padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>📍 Location Info SAVED</span>
                    <a href={`https://maps.google.com/?q=${place.lat},${place.lng}`} target="_blank" rel="noreferrer"
                      style={{ color: '#1E2A3A', textDecoration: 'none', fontWeight: 600 }}>Map OK →</a>
                  </div>
                )}
                <input className="form-input" placeholder="How to get there (e.g. Namba Stn Exit 14, 3 min walk)" value={place.howToGet} onChange={e => updatePlace(i, 'howToGet', e.target.value)} />
                <input className="form-input" placeholder="Tip (optional)" value={place.tip} onChange={e => updatePlace(i, 'tip', e.target.value)} />
              </div>
            ))}
            <button className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 13, padding: '7px 14px' }} onClick={addPlace}>+ Place ADD</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading? 'Posting...' : 'Post'}</button>
          <button className="btn-secondary" onClick={onDone}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}
