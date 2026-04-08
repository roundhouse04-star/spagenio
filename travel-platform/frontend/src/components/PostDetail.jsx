import React, { useState } from 'react';

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

export default function PostDetail({ post, currentUserId, plans, onLike, onComment, onProfile, onAddToPlanner, onBack }) {
  const [activeImg, setActiveImg] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [showPlanModal, setShowPlanModal] = useState(null); // place
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const liked = post.likedUserIds?.includes(currentUserId);

  const submitComment = () => {
    if (!commentText.trim()) return;
    onComment?.(post.id, commentText);
    setCommentText('');
  };

  const openMapExternal = (place) => {
    window.open(`https://maps.google.com/?q=${place.lat},${place.lng}`, '_blank');
  };

  const handleAddToPlanner = () => {
    if (!selectedPlanId || !showPlanModal) return;
    onAddToPlanner?.(selectedPlanId, showPlanModal, post);
    setShowPlanModal(null);
    setSelectedPlanId('');
  };

  return (
    <div>
      <button className="btn-secondary" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }} onClick={onBack}>
        ← 뒤로
      </button>

      <div className="post-detail">
        {/* 이미지 */}
        <div className="post-detail-images card">
          {post.images?.length > 0 ? (
            <>
              <img className="post-detail-img" src={post.images[activeImg]} alt={post.title} />
              {post.images.length > 1 && (
                <div className="post-detail-img-thumbs">
                  {post.images.map((img, i) => (
                    <img key={i} className={`post-detail-img-thumb${i === activeImg ? ' active' : ''}`}
                      src={img} alt="" onClick={() => setActiveImg(i)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ height: 300, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
              사진 없음
            </div>
          )}
        </div>

        {/* 사이드 패널 */}
        <div className="post-detail-panel">
          {/* 작성자 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img className="avatar avatar-md" style={{ cursor: 'pointer' }}
              src={post.userProfileImage || `https://ui-avatars.com/api/?name=${post.userNickname}&background=4f46e5&color=fff`}
              alt={post.userNickname} onClick={() => onProfile?.(post.userId)} />
            <div>
              <div style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onProfile?.(post.userId)}>{post.userNickname}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{post.city && post.country ? `${post.city}, ${post.country}` : ''} · {timeAgo(post.createdAt)}</div>
            </div>
          </div>

          <hr className="divider" />

          <div className="post-detail-title">{post.title}</div>
          <div className="post-detail-content">{post.content}</div>

          {post.tags?.length > 0 && (
            <div className="post-tags">
              {post.tags.map(t => <span key={t} className="tag">#{t}</span>)}
            </div>
          )}

          {/* 좋아요 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`action-btn${liked ? ' liked' : ''}`} onClick={() => onLike?.(post.id)}>
              <span className="icon">{liked ? '❤️' : '🤍'}</span> {post.likedUserIds?.length || 0}
            </button>
            <button className="action-btn">
              <span className="icon">💬</span> {post.comments?.length || 0}
            </button>
          </div>

          <hr className="divider" />

          {/* 장소 목록 — 핵심 기능 */}
          {post.places?.length > 0 && (
            <div className="places-section">
              <div className="places-title">📍 여행 코스 ({post.places.length}곳)</div>
              {post.places.map((place, i) => (
                <div key={i} className="place-card">
                  <div className="place-num">{place.order || i + 1}</div>
                  <div className="place-info">
                    <div className="place-name">{place.name}</div>
                    {place.address && <div className="place-address">{place.address}</div>}
                    {place.howToGet && <div className="place-how">🚇 {place.howToGet}</div>}
                    {place.tip && <div className="place-tip">💡 {place.tip}</div>}
                  </div>
                  <div className="place-actions">
                    <button className="btn-map" onClick={() => openMapExternal(place)}>지도 보기</button>
                    <button className="btn-add-plan" onClick={() => { setShowPlanModal(place); setSelectedPlanId(plans?.[0]?.id || ''); }}>
                      + 내 일정
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <hr className="divider" />

          {/* 댓글 */}
          <div className="comments-section">
            <div className="places-title">댓글</div>
            {post.comments?.length === 0 && <div style={{ fontSize: 13, color: '#aaa' }}>아직 댓글이 없어요.</div>}
            {post.comments?.map((c) => (
              <div key={c.id} className="comment-item">
                <img className="avatar avatar-sm"
                  src={c.userProfileImage || `https://ui-avatars.com/api/?name=${c.userNickname}&background=4f46e5&color=fff`}
                  alt={c.userNickname} />
                <div className="comment-body">
                  <div className="comment-name">{c.userNickname}</div>
                  <div className="comment-text">{c.content}</div>
                  <div className="comment-time">{timeAgo(c.createdAt)}</div>
                </div>
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
        </div>
      </div>

      {/* 내 일정에 추가 모달 */}
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
