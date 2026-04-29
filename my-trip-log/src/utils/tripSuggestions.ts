/**
 * 다음 여행 추천 (가본 곳 기반)
 *
 * 가본 도시들의 카테고리·지역 매칭 + 미방문 도시 중 점수 높은 것 추천.
 * 외부 API 호출 없음 — CITY_HIGHLIGHTS 데이터로만 계산.
 */
import { getDB } from '@/db/database';
import {
  CITY_ALIASES, CITY_HIGHLIGHTS,
  findCityIdByName,
  type HighlightTag,
} from '@/data/cityHighlights';

export interface CitySuggestion {
  cityId: string;
  reason: string;
  score: number;
}

/** 가본 도시 cityId 목록 (trips.city / city_id / country로 매칭) */
async function getVisitedCityIds(): Promise<Set<string>> {
  const db = await getDB();
  const trips = await db.getAllAsync<{ city: string | null; city_id: string | null; country: string | null }>(
    'SELECT city, city_id, country FROM trips',
  );
  const set = new Set<string>();
  for (const t of trips) {
    if (t.city_id && CITY_ALIASES[t.city_id]) {
      set.add(t.city_id);
      continue;
    }
    const matched = findCityIdByName(t.city) ?? findCityIdByName(t.country);
    if (matched) set.add(matched);
  }
  return set;
}

/**
 * 도시별 태그·카테고리 시그니처 — 비슷한 도시 매칭용
 */
function getCitySignature(cityId: string): { tags: Set<HighlightTag>; categoryCount: Map<string, number> } {
  const items = CITY_HIGHLIGHTS.filter((h) => h.cityId === cityId);
  const tags = new Set<HighlightTag>();
  const cat = new Map<string, number>();
  for (const h of items) {
    h.tags.forEach((t) => tags.add(t));
    cat.set(h.category, (cat.get(h.category) ?? 0) + 1);
  }
  return { tags, categoryCount: cat };
}

/**
 * 가본 도시들의 통합 시그니처와 후보 도시 시그니처 비교 → 점수
 * 추천 이유도 함께 반환 (가장 매칭되는 태그 1~2개)
 */
export async function getSuggestions(limit = 5): Promise<CitySuggestion[]> {
  const visited = await getVisitedCityIds();
  if (visited.size === 0) return [];

  // 가본 도시들의 통합 태그·카테고리 분포
  const userTags = new Map<HighlightTag, number>();
  const userCat = new Map<string, number>();
  for (const id of visited) {
    const sig = getCitySignature(id);
    sig.tags.forEach((t) => userTags.set(t, (userTags.get(t) ?? 0) + 1));
    sig.categoryCount.forEach((cnt, key) => userCat.set(key, (userCat.get(key) ?? 0) + cnt));
  }

  // 미방문 도시 중 점수 계산
  const candidates: CitySuggestion[] = [];
  for (const cityId of Object.keys(CITY_ALIASES)) {
    if (visited.has(cityId)) continue;
    const sig = getCitySignature(cityId);
    if (sig.tags.size === 0) continue; // 데이터 없는 도시 skip

    let score = 0;
    const matchedTags: HighlightTag[] = [];
    sig.tags.forEach((t) => {
      const userCount = userTags.get(t) ?? 0;
      if (userCount > 0) {
        score += userCount;
        matchedTags.push(t);
      }
    });
    sig.categoryCount.forEach((cnt, key) => {
      const userCnt = userCat.get(key) ?? 0;
      score += Math.min(cnt, userCnt) * 0.5;
    });

    // 추천 이유
    const topTag = matchedTags
      .map((t) => ({ tag: t, count: userTags.get(t) ?? 0 }))
      .sort((a, b) => b.count - a.count)[0];
    let reason = '비슷한 분위기의 새 도시';
    if (topTag) {
      const tagLabels: Record<HighlightTag, string> = {
        classic: '클래식한 명소',
        trending: '최근 트렌드',
        local: '로컬 분위기',
        photogenic: '인스타 감성',
        michelin: '미식·파인다이닝',
        budget: '가성비 여행',
        family: '가족 여행',
        night: '야경·나이트라이프',
        hidden: '숨은 명소',
        beach: '해변·휴양',
      };
      reason = `${tagLabels[topTag.tag]} 좋아하시면 추천`;
    }

    if (score > 0) candidates.push({ cityId, reason, score });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}
