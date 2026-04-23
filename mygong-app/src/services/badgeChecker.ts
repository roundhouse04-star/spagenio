/**
 * 뱃지 시스템 — 30개 뱃지 정의 + 자동 체크.
 */
import { getDB } from '@/db/database';
import { getUnlockedBadgeIds, unlockBadge } from '@/db/badges';
import { createNotification } from '@/db/notifications';

export const BADGE_DEFINITIONS: {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'special';
}[] = [
  // 첫 걸음
  { id: 'first_ticket',    name: '첫 기록',       description: '첫 번째 티켓 등록',         icon: '🎟️', tier: 'bronze' },
  { id: 'first_concert',   name: '첫 콘서트',     description: '콘서트 첫 관람',            icon: '🎤', tier: 'bronze' },
  { id: 'first_musical',   name: '첫 뮤지컬',     description: '뮤지컬 첫 관람',            icon: '🎭', tier: 'bronze' },
  { id: 'first_play',      name: '첫 연극',       description: '연극 첫 관람',              icon: '🎪', tier: 'bronze' },
  { id: 'first_fanmeeting',name: '첫 팬미팅',     description: '팬미팅 첫 참가',            icon: '💖', tier: 'bronze' },
  // 카테고리 마스터
  { id: 'concert_master_5',  name: '콘서트 마니아',  description: '콘서트 5회 관람',   icon: '🎤', tier: 'silver' },
  { id: 'concert_master_10', name: '콘서트 킹',      description: '콘서트 10회 관람',  icon: '👑', tier: 'gold' },
  { id: 'musical_master_5',  name: '뮤지컬 러버',    description: '뮤지컬 5회 관람',   icon: '🎭', tier: 'silver' },
  { id: 'musical_master_10', name: '뮤지컬 마스터',  description: '뮤지컬 10회 관람',  icon: '🌟', tier: 'gold' },
  { id: 'festival_3',        name: '페스티벌러',     description: '페스티벌 3회 참여', icon: '🎉', tier: 'silver' },
  { id: 'exhibit_5',         name: '전시 애호가',    description: '전시 5회 관람',     icon: '🖼️', tier: 'silver' },
  // 티켓 개수
  { id: 'collector_5',   name: '티켓 컬렉터',    description: '총 5장 등록',    icon: '🎫', tier: 'bronze' },
  { id: 'collector_10',  name: '진성 컬렉터',    description: '총 10장 등록',   icon: '📚', tier: 'silver' },
  { id: 'collector_30',  name: '대수집가',       description: '총 30장 등록',   icon: '🏆', tier: 'gold' },
  { id: 'collector_100', name: '전설의 수집가',  description: '총 100장 등록',  icon: '💎', tier: 'special' },
  // 팬심
  { id: 'true_fan_3',     name: '진정한 팬',   description: '한 아티스트 3회 관람',   icon: '💕', tier: 'silver' },
  { id: 'true_fan_5',     name: '찐팬',        description: '한 아티스트 5회 관람',   icon: '💖', tier: 'gold' },
  { id: 'true_fan_10',    name: '영혼의 팬',   description: '한 아티스트 10회 관람',  icon: '💗', tier: 'special' },
  // 기록 충실도
  { id: 'photographer_5', name: '사진가',         description: '사진 첨부 5장',       icon: '📷', tier: 'bronze' },
  { id: 'photographer_20',name: '프로 사진가',    description: '사진 첨부 20장',      icon: '📸', tier: 'silver' },
  { id: 'reviewer_10',    name: '꼼꼼한 기록자',  description: '메모 10개 작성',      icon: '📝', tier: 'silver' },
  { id: 'detailed_5',     name: '평가자',         description: '항목별 별점 5회',     icon: '⭐', tier: 'silver' },
  // 별점
  { id: 'rater_10',       name: '평론가',         description: '별점 10회 매김',      icon: '⭐', tier: 'bronze' },
  { id: 'perfect_5',      name: '최고의 순간',    description: '5점 별점 5회',        icon: '🌟', tier: 'silver' },
  { id: 'harsh_critic',   name: '냉정한 평가자',  description: '3점 이하 5회',        icon: '🧐', tier: 'silver' },
  // 다양성
  { id: 'diverse_3',      name: '장르 탐험가',    description: '3개 카테고리',        icon: '🎨', tier: 'silver' },
  { id: 'diverse_6',      name: '문화 마스터',    description: '6개 카테고리 모두',   icon: '🏅', tier: 'gold' },
  { id: 'multi_artist_5', name: '다양한 덕질',    description: '5명 이상 아티스트',   icon: '🌈', tier: 'silver' },
  // 스페셜
  { id: 'big_spender',    name: '통 큰 팬',       description: '단일 공연 20만원+',   icon: '💰', tier: 'gold' },
  { id: 'year_traveler',  name: '올해의 팬',      description: '올해 10회 관람',      icon: '🎊', tier: 'gold' },
];

export async function checkAndUnlockBadges(): Promise<string[]> {
  const already = await getUnlockedBadgeIds();
  const newly: string[] = [];
  const stats = await getBadgeStats();

  for (const badge of BADGE_DEFINITIONS) {
    if (already.has(badge.id)) continue;

    let achieved = false;
    switch (badge.id) {
      case 'first_ticket':      achieved = stats.total >= 1; break;
      case 'first_concert':     achieved = stats.byCategory['콘서트'] >= 1; break;
      case 'first_musical':     achieved = stats.byCategory['뮤지컬'] >= 1; break;
      case 'first_play':        achieved = stats.byCategory['연극'] >= 1; break;
      case 'first_fanmeeting':  achieved = stats.byCategory['팬미팅'] >= 1; break;
      case 'concert_master_5':  achieved = stats.byCategory['콘서트'] >= 5; break;
      case 'concert_master_10': achieved = stats.byCategory['콘서트'] >= 10; break;
      case 'musical_master_5':  achieved = stats.byCategory['뮤지컬'] >= 5; break;
      case 'musical_master_10': achieved = stats.byCategory['뮤지컬'] >= 10; break;
      case 'festival_3':        achieved = stats.byCategory['페스티벌'] >= 3; break;
      case 'exhibit_5':         achieved = stats.byCategory['전시'] >= 5; break;
      case 'collector_5':       achieved = stats.total >= 5; break;
      case 'collector_10':      achieved = stats.total >= 10; break;
      case 'collector_30':      achieved = stats.total >= 30; break;
      case 'collector_100':     achieved = stats.total >= 100; break;
      case 'true_fan_3':        achieved = stats.maxArtistCount >= 3; break;
      case 'true_fan_5':        achieved = stats.maxArtistCount >= 5; break;
      case 'true_fan_10':       achieved = stats.maxArtistCount >= 10; break;
      case 'photographer_5':    achieved = stats.withPhoto >= 5; break;
      case 'photographer_20':   achieved = stats.withPhoto >= 20; break;
      case 'reviewer_10':       achieved = stats.withNotes >= 10; break;
      case 'detailed_5':        achieved = stats.withDetailedRatings >= 5; break;
      case 'rater_10':          achieved = stats.withRating >= 10; break;
      case 'perfect_5':         achieved = stats.fiveStarCount >= 5; break;
      case 'harsh_critic':      achieved = stats.lowRatingCount >= 5; break;
      case 'diverse_3':         achieved = stats.uniqueCategories >= 3; break;
      case 'diverse_6':         achieved = stats.uniqueCategories >= 6; break;
      case 'multi_artist_5':    achieved = stats.uniqueArtists >= 5; break;
      case 'big_spender':       achieved = stats.maxPrice >= 200000; break;
      case 'year_traveler':     achieved = stats.thisYearCount >= 10; break;
    }

    if (achieved) {
      const ok = await unlockBadge(badge.id);
      if (ok) {
        newly.push(badge.id);
        await createNotification({
          kind: 'new_info',
          title: `🎉 새 뱃지 획득!`,
          subtitle: `${badge.icon} ${badge.name} — ${badge.description}`,
          icon: badge.icon,
        }).catch(() => {});
      }
    }
  }

  return newly;
}

async function getBadgeStats() {
  const db = await getDB();

  const totalRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets`);
  const total = totalRow?.c ?? 0;

  const catRows = await db.getAllAsync<{ category: string; c: number }>(
    `SELECT category, COUNT(*) as c FROM tickets GROUP BY category`);
  const byCategory: Record<string, number> = {};
  for (const r of catRows) byCategory[r.category] = r.c;
  for (const cat of ['콘서트','뮤지컬','연극','팬미팅','페스티벌','전시']) {
    if (!(cat in byCategory)) byCategory[cat] = 0;
  }

  const maxArtistRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets
     WHERE artist_id IS NOT NULL GROUP BY artist_id ORDER BY c DESC LIMIT 1`);
  const uniqueArtistsRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(DISTINCT artist_id) as c FROM tickets WHERE artist_id IS NOT NULL`);
  const uniqueCategoriesRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(DISTINCT category) as c FROM tickets`);
  const withPhotoRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE photo_uri IS NOT NULL AND photo_uri != ''`);
  const withNotesRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE notes IS NOT NULL AND TRIM(notes) != ''`);
  const withRatingRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE rating > 0`);
  const withDetailedRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE ratings_json IS NOT NULL`);
  const fiveStarRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE rating = 5`);
  const lowRatingRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE rating > 0 AND rating <= 3`);
  const maxPriceRow = await db.getFirstAsync<{ p: number }>(
    `SELECT MAX(price) as p FROM tickets`);
  const thisYearRow = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM tickets WHERE substr(date, 1, 4) = strftime('%Y', 'now')`);

  return {
    total,
    byCategory,
    maxArtistCount: maxArtistRow?.c ?? 0,
    uniqueArtists: uniqueArtistsRow?.c ?? 0,
    uniqueCategories: uniqueCategoriesRow?.c ?? 0,
    withPhoto: withPhotoRow?.c ?? 0,
    withNotes: withNotesRow?.c ?? 0,
    withRating: withRatingRow?.c ?? 0,
    withDetailedRatings: withDetailedRow?.c ?? 0,
    fiveStarCount: fiveStarRow?.c ?? 0,
    lowRatingCount: lowRatingRow?.c ?? 0,
    maxPrice: maxPriceRow?.p ?? 0,
    thisYearCount: thisYearRow?.c ?? 0,
  };
}
