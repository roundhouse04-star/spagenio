import React from 'react';
import { TRAVEL_STYLES } from '../travelStyles';

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

export default function PostCard({ post, currentUserId, onOpen, onProfile, onLike, onTagClick, onReport }) {
  const liked = post.likedUserIds?.includes(currentUserId);
  const mainImg = post.images?.[0];
  const extraCount = (post.images?.length || 0) - 1;
  const locationText = [post.city, post.country].filter(Boolean).join(', ');

  return (
    <div className="post-card">
      {/* 헤더 - 라이트 */}
      <div className="post-header">
        <div className="post-header-left">
          <div className="avatar-ring" style={{ cursor: 'pointer' }} onClick={() => onProfile?.(post.userId)}>
            <img className="avatar avatar-sm avatar-inner"
              src={post.userProfileImage || `https://ui-avatars.com/api/?name=${post.userNickname}&background=4f46e5&color=fff`}
              alt={post.userNickname} />
          </div>
          <div>
            <div className="post-user-name" onClick={() => onProfile?.(post.userId)}>{post.userNickname}</div>
            <div className="post-meta">{locationText && `${locationText} · `}{timeAgo(post.createdAt)}</div>
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <button style={{ fontSize: 18, color: '#ddd', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            onClick={(e) => { e.stopPropagation(); onReport?.(post); }}>⋯</button>
        </div>
      </div>

      {/* 이미지 - 다크 */}
      <div className="post-image-wrap" onClick={() => onOpen?.(post)}>
        {mainImg ? (
          <img src={mainImg} alt={post.title} />
        ) : (
          <div className="post-image-placeholder" />
        )}
        {locationText && <div className="post-image-tag">📍 {post.city || post.country}</div>}
        {extraCount > 0 && <div className="post-image-count">+{extraCount}</div>}
        <div className="post-image-caption">{post.title}</div>
      </div>

      {/* 푸터 - 라이트 */}
      <div className="post-footer">
        <div className="post-actions">
          <button className={`action-btn${liked ? ' liked' : ''}`} onClick={() => onLike?.(post.id)}>
            <span className="icon">{liked ? '❤️' : '🤍'}</span>
            {post.likedUserIds?.length || 0}
          </button>
          <button className="action-btn" onClick={() => onOpen?.(post)}>
            <span className="icon">💬</span>
            {post.comments?.length || 0}
          </button>
          <button className="action-btn" style={{ marginLeft: 'auto' }}>
            <span className="icon" style={{ fontSize: 13 }}>↗</span>
          </button>
        </div>
        {post.travelStyles?.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
            {post.travelStyles.map(key => {
              const s = TRAVEL_STYLES.find(t => t.key === key);
              if (!s) return null;
              return (
                <span key={key} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                  {s.icon} {s.label}
                </span>
              );
            })}
          </div>
        )}
        {post.tags?.length > 0 && (
          <div className="post-tags">
            {post.tags.slice(0, 4).map(t => (
              <span key={t} className="tag" style={{ cursor: onTagClick ? 'pointer' : 'default' }}
                onClick={() => onTagClick?.(t)}>#{t}</span>
            ))}
          </div>
        )}
        {post.places?.length > 0 && (
          <div className="place-chips" style={{ marginTop: 8 }}>
            <button className="chip chip-green" onClick={() => onOpen?.(post)}>
              📍 장소 {post.places.length}곳
            </button>
            <button className="chip chip-indigo" onClick={() => onOpen?.(post)}>
              + 내 일정 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
