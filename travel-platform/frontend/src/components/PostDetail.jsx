import React, { useState } from 'react';
import MapView from './MapView';
import { api } from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const getTabs = (post) => {
  const tabs = [
    { key: 'info', label: 'Post' },
  ];
  if (post?.places && post.places.length > 0) {
    tabs.push({ key: 'course', label: '📍 Route ' + post.places.length });
  }
  tabs.push({ key: 'map', label: '🗺️ Info' });
  tabs.push({ key: 'comments', label: '💬 Comments' });
  return tabs;
};

export default function PostDetail({ post: initialPost, currentUserId, plans, onLike, onComment, onProfile, onAddToPlanner, onBack, onDelete, onUpdate, currentUser, onBookmark }) {
  const [post, setPost] = useState(initialPost);
  const [activeImg, setActiveImg] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [showPlanModal, setShowPlanModal] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [tab, setTab] = useState('info');
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ title: post.title, content: post.content });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isMyPost = post.userId === currentUserId;
  const liked = post.likedUserIds?.includes(currentUserId);
  const firstPlace = post.places?.find(p => p.lat && p.lng);
  const gpsLat = firstPlace?.lat;
  const gpsLng = firstPlace?.lng;

  const handleLike = async () => {
    const updated = await onLike?.(post.id);
    if (updated) setPost(updated);
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    const updated = await onComment?.(post.id, commentText);
    if (updated) setPost(updated);
    setCommentText('');
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const updated = await api.deleteComment(post.id, commentId);
      if (updated) setPost(updated);
    } catch (e) { console.error(e); }
  };

  const handleSaveEdit = async () => {
    if (!editData.title.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updatePost(post.id, { title: editData.title, content: editData.content });
      if (updated) { setPost(updated); onUpdate?.(updated); }
      setEditing(false);
    } catch (e) { alert('Edit failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.deletePost(post.id);
      onDelete?.(post.id);
      onBack?.();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  const handleAddToPlanner = () => {
    if (!selectedPlanId || !showPlanModal) return;
    onAddToPlanner?.(selectedPlanId, showPlanModal, post);
    setShowPlanModal(null);
    setSelectedPlanId('');
  };

  return (
    <div onClick={() => showMenu && setShowMenu(false)}>
      <button className="btn-secondary" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }} onClick={onBack}>
        ← Back
      </button>

      <div className="post-detail">
        {/* Image */}
        <div className="post-detail-images card">
          {post.images?.length > 0 ? (
            <>
              {post.images[activeImg]?.endsWith('.mp4') ? (
                <video className="post-detail-main-img" src={post.images[activeImg]} controls playsInline preload="metadata" style={{ background: '#000' }} />
              ) : (
                <img className="post-detail-main-img" src={post.images[activeImg]} alt={post.title} />
              )}
              {post.images.length > 1 && (
                <div className="post-detail-thumbs">
                  {post.images.map((img, i) => (
                    img.endsWith('.mp4') ? (
                      <div key={i} className={'post-detail-thumb' + (i === activeImg ? ' active' : '')}
                        onClick={() => setActiveImg(i)}
                        style={{ position: 'relative', cursor: 'pointer', overflow: 'hidden' }}>
                        <img src={img.replace('_video.mp4', '_thumb.jpg')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                          <span style={{ fontSize: 20, color: 'white' }}>▶</span>
                        </div>
                      </div>
                    ) : (
                      <img key={i} className={'post-detail-thumb' + (i === activeImg ? ' active' : '')}
                        src={img} alt="" onClick={() => setActiveImg(i)} />
                    )
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 300, background: '#F5F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>No photo</div>
          )}
        </div>

        {/* Side panel */}
        <div className="post-detail-panel">
          {/* Author + menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img className="avatar avatar-md" style={{ cursor: 'pointer' }}
              src={post.userProfileImage || `https://ui-avatars.com/api/?name=${post.userNickname}&background=1E2A3A&color=fff`}
              alt={post.userNickname} onClick={() => onProfile?.(post.userId)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onProfile?.(post.userId)}>{post.userNickname}</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {post.city && post.country ? `${post.city}, ${post.country}` : ''} · {timeAgo(post.createdAt)}
              </div>
            </div>
            {/* ⋯ menu */}
            {isMyPost && (
              <div style={{ position: 'relative' }}>
                <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                  style={{ background: 'none', border: 'none', fontSize: 18, color: '#8A919C', cursor: 'pointer', padding: '4px 8px' }}>⋯</button>
                {showMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #E2E0DC', borderRadius: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 140, overflow: 'hidden' }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditing(true); setEditData({ title: post.title, content: post.content }); setShowMenu(false); }}
                      style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#1E2A3A', background: 'none', border: 'none', borderBottom: '1px solid #F5F4F0', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => { setDeleteConfirm(true); setShowMenu(false); }}
                      style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                      🗑 Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <hr className="divider" />

          {/* Edit form */}
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E2A3A' }}>Edit post</div>
              <input value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                style={{ padding: '10px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 14, outline: 'none' }}
                placeholder="Title" />
              <textarea value={editData.content} onChange={e => setEditData(p => ({ ...p, content: e.target.value }))}
                rows={5} style={{ padding: '10px 12px', border: '1px solid #E2E0DC', borderRadius: 2, fontSize: 13, outline: 'none', resize: 'vertical' }}
                placeholder="Content" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveEdit} disabled={saving}
                  style={{ flex: 1, padding: '10px', background: '#1E2A3A', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: '10px', background: '#F5F4F0', color: '#555', border: 'none', borderRadius: 2, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#F5F4F0', borderRadius: 3, padding: 4 }}>
                {getTabs(post).map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#1E2A3A' : '#8A919C', fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Post tab */}
              {tab === 'info' && (
                <>
                  <div className="post-detail-title">{post.title}</div>
                  <div className="post-detail-content">{post.content}</div>
                  {post.tags?.length > 0 && (
                    <div className="post-tags">
                      {post.tags.map(t => <span key={t} className="tag">#{t}</span>)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`action-btn${liked ? ' liked' : ''}`} onClick={handleLike}>
                      <span className="icon">{liked ? '❤️' : '🤍'}</span> {post.likedUserIds?.length || 0}
                    </button>
                    <button className="action-btn" onClick={() => setTab('comments')}>
                      <span className="icon">💬</span> {post.comments?.length || 0}
                    </button>
                    {currentUser && (
                      <button className="action-btn" onClick={async () => {
                        try {
                          const updated = await api.toggleBookmark(currentUser.id, post.id);
                          onBookmark?.(updated);
                        } catch(e) { console.error(e); }
                      }} style={{ marginLeft: 'auto' }}>
                        <span className="icon">🔖</span>
                        {currentUser?.savedPostIds?.includes(post.id) ? 'Saved' : 'Save'}
                      </button>
                    )}
                    {currentUser && (
                      <button className="action-btn" onClick={async () => {
                        try {
                          const updated = await api.toggleWishlist(currentUser.id, post.id);
                          onWishlist?.(updated);
                        } catch(e) { console.error(e); }
                      }}>
                        <span className="icon">{currentUser?.wishlistPostIds?.includes(post.id) ? '✈️' : '✈️'}</span>
                        {currentUser?.wishlistPostIds?.includes(post.id) ? 'Wishlisted ✓' : 'Wishlist'}
                      </button>
                    )}
                  </div>

                  {/* YouTube video */}
                  {post.youtubeUrl && (
                    <a href={post.youtubeUrl} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 3, textDecoration: 'none' }}>
                      {post.youtubeThumbnail && <img src={post.youtubeThumbnail} style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} alt="" />}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>▶ Related YouTube video</div>
                        {post.youtubeTitle && <div style={{ fontSize: 12, color: '#8A919C' }}>{post.youtubeTitle}</div>}
                      </div>
                    </a>
                  )}
                  <hr className="divider" />
                  {post.places?.length > 0 && (
                    <div>
                      <div className="section-label" style={{ marginBottom: 10 }}>Travel route ({post.places.length})</div>
                      {post.places.map((place, i) => (
                        <div key={i} className="place-card" style={{ marginBottom: 8 }}>
                          <div className="place-num">{place.order || i + 1}</div>
                          <div className="place-info">
                            <div className="place-name">{place.name}</div>
                            {place.address && <div className="place-address">{place.address}</div>}
                            {place.howToGet && <div className="place-how">🚇 {place.howToGet}</div>}
                            {place.tip && <div className="place-tip">💡 {place.tip}</div>}
                          </div>
                          <div className="place-btns">
                            {place.lat && place.lng && (
                              <button className="btn-map" onClick={() => window.open(`https://maps.google.com/?q=${place.lat},${place.lng}`, '_blank')}>Map</button>
                            )}
                            <button className="btn-add-plan" onClick={() => { setShowPlanModal(place); setSelectedPlanId(plans?.[0]?.id || ''); }}>+ Schedule</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {gpsLat && gpsLng && (
                    <button onClick={() => setTab('map')}
                      style={{ width: '100%', padding: '12px', borderRadius: 3, border: '1.5px solid #c7d2fe', background: '#EEEDEA', color: '#1E2A3A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      🗺️ Nearby places · transit · attractions →
                    </button>
                  )}
                </>
              )}

              {/* Travel info tab */}
        
      {tab === 'course' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {post.places && post.places.length > 0 ? (
            <>
              {/* Map */}
              <div style={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #F0EEE9' }}>
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    Math.min(...post.places.map(p => p.lng)) - 0.01},${
                    Math.min(...post.places.map(p => p.lat)) - 0.005},${
                    Math.max(...post.places.map(p => p.lng)) + 0.01},${
                    Math.max(...post.places.map(p => p.lat)) + 0.005
                  }&layer=mapnik`}
                  style={{ width: '100%', height: 250, border: 'none' }}
                  loading="lazy"
                />
              </div>
              {/* Route list */}
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A' }}>📍 Route ({post.places.length})</div>
              {post.places.sort((a, b) => (a.placeOrder || 0) - (b.placeOrder || 0)).map((place, i) => (
                <div key={place.id || i} style={{ display: 'flex', gap: 12, padding: 14, background: '#FAFAF8', borderRadius: 3, border: '1px solid #F0EEE9' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1E2A3A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A3A', marginBottom: 2 }}>{place.name}</div>
                    {place.category && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 2, background: '#FAFAF8', color: '#1E2A3A', fontWeight: 600 }}>{place.category}</span>
                    )}
                    {place.tip && <div style={{ fontSize: 12, color: '#8A919C', marginTop: 4 }}>💡 {place.tip}</div>}
                    {place.howToGet && (
                      <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🚇 {place.howToGet}
                      </div>
                    )}
                    {place.lat && place.lng && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: '#8A919C', marginTop: 4, display: 'inline-block', textDecoration: 'none' }}>
                        📍 View on map →
                      </a>
                    )}
                  </div>
                  {i < post.places.length - 1 && (
                    <div style={{ position: 'absolute', left: 28, bottom: -8, fontSize: 16, color: '#B8BCC4' }}>↓</div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#8A919C' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📍</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#4A5568' }}>No route added</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>No place info for this post</div>
            </div>
          )}
        </div>
      )}

      {tab === 'map' && (
                <MapView lat={gpsLat} lng={gpsLng} placeName={firstPlace?.name || post.title}
                  places={post.places || []} onAddToPlanner={(planId, place) => onAddToPlanner?.(planId, place, post)} plans={plans} />
              )}

              {/* Comments tab */}
              {tab === 'comments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="section-label">Comments {post.comments?.length || 0}</div>
                  {post.comments?.length === 0 && <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>No comments yet.</div>}
                  {post.comments?.map((c) => (
                    <div key={c.id} className="comment-item" style={{ alignItems: 'flex-start' }}>
                      <img className="avatar avatar-sm"
                        src={c.userProfileImage || `https://ui-avatars.com/api/?name=${c.userNickname}&background=1E2A3A&color=fff`}
                        alt={c.userNickname} />
                      <div className="comment-body" style={{ flex: 1 }}>
                        <div className="comment-name">{c.userNickname}</div>
                        <div className="comment-text">{c.content}</div>
                        <div className="comment-time">{timeAgo(c.createdAt)}</div>
                      </div>
                      {/* My comment delete button */}
                      {c.userId === currentUserId && (
                        <button onClick={() => handleDeleteComment(c.id)}
                          style={{ fontSize: 11, color: '#8A919C', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
                          onMouseEnter={e => e.target.style.color = '#ef4444'}
                          onMouseLeave={e => e.target.style.color = '#8A919C'}>
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                  {currentUserId && (
                    <div className="comment-input-row">
                      <input className="comment-input" placeholder="Write a comment..." value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitComment()} />
                      <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={submitComment}>Post</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-title">Delete this post?</div>
            <p style={{ fontSize: 14, color: '#8A919C', lineHeight: 1.7 }}>This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(false)}>Cancel</button>
              <button className="btn-cancel" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add to schedule modal */}
      {showPlanModal && (
        <div className="modal-overlay" onClick={() => setShowPlanModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📍 Add "{showPlanModal.name}" to my schedule</div>
            {plans?.length === 0 ? (
              <div className="message info">No schedules yet. Create one first!</div>
            ) : (
              <div className="plan-select-list">
                {plans?.map(plan => (
                  <div key={plan.id} className={`plan-select-item${selectedPlanId === plan.id ? ' selected' : ''}`}
                    onClick={() => setSelectedPlanId(plan.id)}>
                    <div className="plan-select-name">{plan.title}</div>
                    <div className="plan-select-dates">{plan.startDate} ~ {plan.endDate}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPlanModal(null)}>Cancel</button>
              {plans?.length > 0 && <button className="btn-primary" onClick={handleAddToPlanner}>Add</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
