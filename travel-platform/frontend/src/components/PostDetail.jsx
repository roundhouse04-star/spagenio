import React, { useState } from 'react';
import MapView from './MapView';
import { api } from '../api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const TABS = [
  { key: 'info',     label: '게시물' },
  { key: 'map',      label: '🗺️ 여행정보' },
  { key: 'comments', label: '💬 댓글' },
];

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
    if (!window.confirm('댓글을 삭제할까요?')) return;
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
    } catch (e) { alert('수정 실패: ' + e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.deletePost(post.id);
      onDelete?.(post.id);
      onBack?.();
    } catch (e) { alert('삭제 실패: ' + e.message); }
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
        ← 뒤로
      </button>

      <div className="post-detail">
        {/* 이미지 */}
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
            <div style={{ height: 300, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>사진 없음</div>
          )}
        </div>

        {/* 사이드 패널 */}
        <div className="post-detail-panel">
          {/* 작성자 + 메뉴 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img className="avatar avatar-md" style={{ cursor: 'pointer' }}
              src={post.userProfileImage || `https://ui-avatars.com/api/?name=${post.userNickname}&background=4f46e5&color=fff`}
              alt={post.userNickname} onClick={() => onProfile?.(post.userId)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onProfile?.(post.userId)}>{post.userNickname}</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {post.city && post.country ? `${post.city}, ${post.country}` : ''} · {timeAgo(post.createdAt)}
              </div>
            </div>
            {/* ⋯ 메뉴 */}
            {isMyPost && (
              <div style={{ position: 'relative' }}>
                <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
                  style={{ background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer', padding: '4px 8px' }}>⋯</button>
                {showMenu && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #eee', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 140, overflow: 'hidden' }}
                    onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditing(true); setEditData({ title: post.title, content: post.content }); setShowMenu(false); }}
                      style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#1a1a2e', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                      ✏️ 수정
                    </button>
                    <button onClick={() => { setDeleteConfirm(true); setShowMenu(false); }}
                      style={{ width: '100%', padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                      🗑 삭제
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <hr className="divider" />

          {/* 수정 폼 */}
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>게시물 수정</div>
              <input value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
                style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, outline: 'none' }}
                placeholder="제목" />
              <textarea value={editData.content} onChange={e => setEditData(p => ({ ...p, content: e.target.value }))}
                rows={5} style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical' }}
                placeholder="내용" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveEdit} disabled={saving}
                  style={{ flex: 1, padding: '10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 탭 */}
              <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 12, padding: 4 }}>
                {TABS.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', background: tab === t.key ? 'white' : 'transparent', color: tab === t.key ? '#4f46e5' : '#9ca3af', fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* 게시물 탭 */}
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
                        {currentUser?.savedPostIds?.includes(post.id) ? '저장됨' : '저장'}
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
                        {currentUser?.wishlistPostIds?.includes(post.id) ? '가고 싶다 ✓' : '가고 싶다'}
                      </button>
                    )}
                  </div>

                  {/* 유튜브 영상 */}
                  {post.youtubeUrl && (
                    <a href={post.youtubeUrl} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, textDecoration: 'none' }}>
                      {post.youtubeThumbnail && <img src={post.youtubeThumbnail} style={{ width: 64, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} alt="" />}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>▶ 관련 유튜브 영상</div>
                        {post.youtubeTitle && <div style={{ fontSize: 12, color: '#6b7280' }}>{post.youtubeTitle}</div>}
                      </div>
                    </a>
                  )}
                  <hr className="divider" />
                  {post.places?.length > 0 && (
                    <div>
                      <div className="section-label" style={{ marginBottom: 10 }}>여행 코스 ({post.places.length}곳)</div>
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
                              <button className="btn-map" onClick={() => window.open(`https://maps.google.com/?q=${place.lat},${place.lng}`, '_blank')}>지도</button>
                            )}
                            <button className="btn-add-plan" onClick={() => { setShowPlanModal(place); setSelectedPlanId(plans?.[0]?.id || ''); }}>+ 일정</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {gpsLat && gpsLng && (
                    <button onClick={() => setTab('map')}
                      style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      🗺️ 주변 맛집 · 교통 · 관광지 보기 →
                    </button>
                  )}
                </>
              )}

              {/* 여행정보 탭 */}
              {tab === 'map' && (
                <MapView lat={gpsLat} lng={gpsLng} placeName={firstPlace?.name || post.title}
                  places={post.places || []} onAddToPlanner={(planId, place) => onAddToPlanner?.(planId, place, post)} plans={plans} />
              )}

              {/* 댓글 탭 */}
              {tab === 'comments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="section-label">댓글 {post.comments?.length || 0}개</div>
                  {post.comments?.length === 0 && <div style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>아직 댓글이 없어요.</div>}
                  {post.comments?.map((c) => (
                    <div key={c.id} className="comment-item" style={{ alignItems: 'flex-start' }}>
                      <img className="avatar avatar-sm"
                        src={c.userProfileImage || `https://ui-avatars.com/api/?name=${c.userNickname}&background=4f46e5&color=fff`}
                        alt={c.userNickname} />
                      <div className="comment-body" style={{ flex: 1 }}>
                        <div className="comment-name">{c.userNickname}</div>
                        <div className="comment-text">{c.content}</div>
                        <div className="comment-time">{timeAgo(c.createdAt)}</div>
                      </div>
                      {/* 내 댓글 삭제 버튼 */}
                      {c.userId === currentUserId && (
                        <button onClick={() => handleDeleteComment(c.id)}
                          style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}
                          onMouseEnter={e => e.target.style.color = '#ef4444'}
                          onMouseLeave={e => e.target.style.color = '#9ca3af'}>
                          삭제
                        </button>
                      )}
                    </div>
                  ))}
                  {currentUserId && (
                    <div className="comment-input-row">
                      <input className="comment-input" placeholder="댓글 달기..." value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitComment()} />
                      <button className="btn-primary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={submitComment}>게시</button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-title">게시물을 삭제할까요?</div>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>삭제하면 복구할 수 없어요.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(false)}>취소</button>
              <button className="btn-cancel" onClick={handleDelete}>삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가 모달 */}
      {showPlanModal && (
        <div className="modal-overlay" onClick={() => setShowPlanModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">📍 "{showPlanModal.name}"을 내 일정에 추가</div>
            {plans?.length === 0 ? (
              <div className="message info">아직 만든 일정이 없어요. 먼저 일정을 만들어주세요!</div>
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
              <button className="btn-secondary" onClick={() => setShowPlanModal(null)}>취소</button>
              {plans?.length > 0 && <button className="btn-primary" onClick={handleAddToPlanner}>추가하기</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
