/**
 * 외교부 여행경보 API 클라이언트
 *
 * 출처: data.go.kr 공공데이터
 *  - API 명: 외교부_국가・지역별 여행경보
 *  - End Point: https://apis.data.go.kr/1262000/TravelAlarmService2
 *  - Endpoint: /getTravelAlarmList2
 *  - 일일 트래픽: 10,000 (활용신청 기준)
 *
 * ## 응답 형식 (예상, 외교부 기술문서 v1.4 기준)
 *  - JSON: { response: { body: { items: [...], totalCount, numOfRows, pageNo } } }
 *  - 각 item: { country_iso_alp2, country_nm, country_eng_nm, alarm_lvl, mapDownloadUrl, remark }
 *
 * ## 캐싱 전략
 *  - 외교부 데이터는 자주 안 바뀜 (일/주 단위)
 *  - AsyncStorage 1시간 캐싱
 *  - 1.2 백엔드 도입 후엔 Cloudflare Workers 가 캐싱 (앱은 그 결과만)
 *
 * ## 보안
 *  - 인증키는 .env 또는 빌드 시 주입
 *  - 출시 빌드에서는 Cloudflare Workers 경유 권장 (키 노출 X)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TravelAdvisory, AdvisoryLevel } from '@/data/safety/types';

const API_BASE = 'https://apis.data.go.kr/1262000/TravelAlarmService2';
const ENDPOINT = '/getTravelAlarmList2';

/**
 * 인증키 — Phase 1 임시 (앱 빌드에 포함됨, Cloudflare 백엔드 도입 전까지)
 * Phase 2 부터는 백엔드가 키 관리 + 앱은 백엔드 URL 만 호출
 *
 * ⚠️ 보안: 이 키는 1.2 출시 직전 data.go.kr 에서 재발급 후
 *         Cloudflare Workers Secret 으로 옮길 것
 */
const TEMP_SERVICE_KEY =
  '339437c3bdb393b6de02e60c22d1b943918a4a42ec300726c2e957876d13fe39';

const CACHE_KEY = 'mofa_travel_advisories_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

interface CachedData {
  advisories: TravelAdvisory[];
  fetchedAt: number; // epoch ms
}

interface MofaApiItem {
  country_iso_alp2: string;
  country_nm: string;
  country_eng_nm?: string;
  alarm_lvl: string | number;
  mapDownloadUrl?: string;
  remark?: string;
  written_dt?: string;
}

interface MofaApiResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: MofaApiItem[];
      totalCount?: number;
      numOfRows?: number;
      pageNo?: number;
    };
  };
}

/**
 * 외교부 전체 여행경보 조회 (모든 국가)
 *
 * @param force true 면 캐시 무시하고 강제 fetch
 * @returns 전체 국가의 여행경보 목록
 */
export async function fetchAllAdvisories(force = false): Promise<TravelAdvisory[]> {
  // 1) 캐시 확인
  if (!force) {
    const cached = await loadCache();
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.advisories;
    }
  }

  // 2) 외교부 API 호출 (전체 = numOfRows 충분히 크게)
  const url =
    `${API_BASE}${ENDPOINT}` +
    `?ServiceKey=${TEMP_SERVICE_KEY}` +
    `&numOfRows=300` + // 전 세계 국가 약 200 < 300
    `&pageNo=1` +
    `&returnType=JSON`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[mofa] HTTP ${res.status} — using cache or empty`);
      const cached = await loadCache();
      return cached?.advisories ?? [];
    }

    const json = (await res.json()) as MofaApiResponse;
    const items = json.response?.body?.items ?? [];
    const advisories = items.map(mapApiItemToAdvisory);

    // 3) 캐시 저장
    await saveCache(advisories);
    return advisories;
  } catch (err) {
    console.warn('[mofa] fetch failed:', err);
    const cached = await loadCache();
    return cached?.advisories ?? [];
  }
}

/**
 * 특정 국가의 여행경보 조회
 *
 * @param countryCode ISO 2자리 (예: 'JP', 'TH')
 */
export async function fetchAdvisoryByCountry(
  countryCode: string,
): Promise<TravelAdvisory | undefined> {
  const all = await fetchAllAdvisories();
  return all.find((a) => a.countryCode === countryCode.toUpperCase());
}

/**
 * 위험 단계 N 이상인 국가만 필터
 *
 * @param minLevel 최소 경보 단계 (예: 2 면 황색·적색·흑색만)
 */
export async function fetchHighRiskCountries(
  minLevel: AdvisoryLevel = 2,
): Promise<TravelAdvisory[]> {
  const all = await fetchAllAdvisories();
  return all.filter((a) => a.level >= minLevel).sort((a, b) => b.level - a.level);
}

// ──────────────────────────────────────────────────────────
// 내부 — 매핑 / 캐시
// ──────────────────────────────────────────────────────────

function mapApiItemToAdvisory(item: MofaApiItem): TravelAdvisory {
  // alarm_lvl 은 외교부 API 에서 "0" ~ "4" 문자열로 옴
  const lvlNum = parseInt(String(item.alarm_lvl), 10);
  const level: AdvisoryLevel =
    Number.isFinite(lvlNum) && lvlNum >= 0 && lvlNum <= 4 ? (lvlNum as AdvisoryLevel) : 0;

  return {
    countryCode: item.country_iso_alp2,
    countryName: item.country_nm,
    level,
    message: item.remark ?? '',
    updatedAt: item.written_dt ?? new Date().toISOString(),
    source: 'mofa.go.kr',
  };
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
    const data: CachedData = {
      advisories,
      fetchedAt: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[mofa] cache save failed:', err);
  }
}

/**
 * 캐시 강제 삭제 (사용자가 "새로고침" 누를 때)
 */
export async function clearAdvisoryCache(): Promise<void> {
  await AsyncStorage.removeItem(CACHE_KEY);
}

/**
 * 현재 캐시된 데이터의 fetched 시각 (UI 표시용)
 *  - "1시간 전 업데이트" 같은 표시
 */
export async function getCacheAge(): Promise<{ ageMs: number; fetchedAt: number } | null> {
  const cached = await loadCache();
  if (!cached) return null;
  return {
    ageMs: Date.now() - cached.fetchedAt,
    fetchedAt: cached.fetchedAt,
  };
}
