/**
 * 외교부 여행경보 클라이언트 — Cloudflare Workers 캐시 경유
 *
 * Phase 2 변경:
 *  - 외교부 API 직접 호출 X (인증키 앱에 포함 안 함)
 *  - Cloudflare Workers (triplive-api) 가 외교부 폴링 + 매 15분 캐싱
 *  - 앱은 Workers 의 /advisories 엔드포인트만 호출
 *  - region 별 데이터 집계 (전체 row > 광범위 remark > 일부 region) 는 Workers 가 처리
 *
 * 보안:
 *  - 외교부 인증키는 Cloudflare Secret 에만 존재
 *  - 앱 빌드에는 키 포함 안 됨 → 디컴파일 시에도 안전
 *
 * 캐싱 전략:
 *  - AsyncStorage 1시간 캐싱 (오프라인 대응 + 호출 빈도 ↓)
 *  - Workers 도 자체적으로 15분 캐시 → 사실상 이중 캐시
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TravelAdvisory, AdvisoryLevel } from '@/data/safety/types';

// Cloudflare Workers 백엔드 (triplive-api)
const API_BASE = 'https://triplive-api.roundhouse04.workers.dev';

const CACHE_KEY = 'mofa_travel_advisories_v2'; // v2 — Worker 응답 포맷으로 변경
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

interface CachedData {
  advisories: TravelAdvisory[];
  fetchedAt: number;
}

// Workers 응답 포맷 (worker.ts handleAdvisoriesList)
interface WorkerAdvisoryRow {
  country_code: string;
  country_name: string;
  level: number;
  message: string | null;
  updated_at: number; // unix ms
}

/**
 * 전체 여행경보 조회 — Worker 캐시 → 로컬 캐시 → 빈 배열
 *
 * @param force true 면 로컬 캐시 무시 + Worker 새로 호출
 */
export async function fetchAllAdvisories(force = false): Promise<TravelAdvisory[]> {
  if (!force) {
    const cached = await loadCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.advisories;
    }
  }

  try {
    const res = await fetch(`${API_BASE}/advisories`);
    if (!res.ok) {
      console.warn(`[mofa] worker HTTP ${res.status} — 로컬 캐시 fallback`);
      const cached = await loadCache();
      return cached?.advisories ?? [];
    }
    const json = (await res.json()) as { advisories: WorkerAdvisoryRow[]; count: number };
    const advisories = json.advisories.map(mapWorkerRowToAdvisory);
    await saveCache(advisories);
    return advisories;
  } catch (err) {
    console.warn('[mofa] worker fetch failed:', err);
    const cached = await loadCache();
    return cached?.advisories ?? [];
  }
}

/** 특정 국가 advisory — Worker 의 /advisories/:cc 직접 호출 (개별 화면용) */
export async function fetchAdvisoryByCountry(
  countryCode: string,
): Promise<TravelAdvisory | undefined> {
  const code = countryCode.toUpperCase();

  // 로컬 캐시에 있으면 그것 사용
  const cached = await loadCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    const hit = cached.advisories.find((a) => a.countryCode === code);
    if (hit) return hit;
  }

  // 단일 조회는 Workers /advisories/:cc 호출 (가벼움)
  try {
    const res = await fetch(`${API_BASE}/advisories/${code}`);
    if (res.status === 404) return undefined;
    if (!res.ok) return undefined;
    const json = (await res.json()) as { advisory: WorkerAdvisoryRow | null };
    return json.advisory ? mapWorkerRowToAdvisory(json.advisory) : undefined;
  } catch {
    return undefined;
  }
}

/** 위험 단계 N 이상 — 메인 화면 "고위험 국가" 섹션용 */
export async function fetchHighRiskCountries(
  minLevel: AdvisoryLevel = 2,
): Promise<TravelAdvisory[]> {
  const all = await fetchAllAdvisories();
  return all.filter((a) => a.level >= minLevel).sort((a, b) => b.level - a.level);
}

// ──────────────────────────────────────────────────────────
// 내부
// ──────────────────────────────────────────────────────────

function mapWorkerRowToAdvisory(row: WorkerAdvisoryRow): TravelAdvisory {
  const lvl = Math.max(0, Math.min(4, row.level)) as AdvisoryLevel;
  return {
    countryCode: row.country_code,
    countryName: row.country_name,
    level: lvl,
    message: cleanHtmlEntities(row.message ?? ''),
    updatedAt: new Date(row.updated_at).toISOString(),
    source: 'mofa.go.kr',
  };
}

/** 외교부 데이터에 섞인 HTML entity 정리 (&middot; 등) */
function cleanHtmlEntities(s: string): string {
  return s
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function loadCache(): Promise<CachedData | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedData;
  } catch {
    return null;
  }
}

async function saveCache(advisories: TravelAdvisory[]): Promise<void> {
  try {
    const data: CachedData = { advisories, fetchedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[mofa] cache save failed:', err);
  }
}

export async function clearAdvisoryCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

export async function getCacheAge(): Promise<{ ageMs: number; fetchedAt: number } | null> {
  const cached = await loadCache();
  if (!cached) return null;
  return {
    ageMs: Date.now() - cached.fetchedAt,
    fetchedAt: cached.fetchedAt,
  };
}
