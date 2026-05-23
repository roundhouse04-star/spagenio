/**
 * 국가별 감염병 / 권장 백신 정보 (정적 데이터)
 *
 * 사용처:
 *  - 도구 탭 → 여행 안전 → 감염병 정보
 *  - 트립 만들 때 출국 4~6주 전 알림 (백신 준비)
 *
 * 출처:
 *  - WHO International Travel and Health
 *  - 질병관리청 (KDCA) 해외감염병NOW
 *  - 한국인 자주 방문 국가 위주 큐레이션
 *
 * 업데이트 주기:
 *  - 백신 정보: 거의 안 바뀜 (정적)
 *  - 발생 알림 (outbreakAlerts): WHO API (Phase 2 동적)
 */
import type { DiseaseInfo } from './types';

export const DISEASE_INFO: DiseaseInfo[] = [
  // ── 동남아 (열대 / 모기 매개) ──
  {
    countryCode: 'TH',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스', '일본뇌염', '광견병'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '모기 매개 질병 (뎅기열·말라리아) 주의 — 긴 옷 + 모기 기피제',
      '식수는 생수만 (얼음 포함)',
      '거리 음식 — 충분히 익힌 것 위주',
      '동물 (개·원숭이) 접촉 자제 — 광견병',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'VN',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스', '일본뇌염'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '뎅기열 위험 — 우기 (5~10월) 특히 주의',
      '깨끗한 물 사용 (양치질도)',
      '거리 음식 — 익은 음식, 익혀먹기',
      'A형간염 백신 권장 (위생 상태 변동)',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'PH',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스', '일본뇌염', '광견병'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '뎅기열 + 말라리아 위험 (지역별 차이)',
      '주의지역: Palawan, Mindanao (말라리아)',
      '도서 지역: 안전한 식수 + 식사',
      '광견병 백신 권장 (장기 체류)',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'ID',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스', '일본뇌염'],
    vaccinesRequired: ['황열병 (위험국가 경유 시)'],
    preventionTipsKo: [
      '뎅기열 + 말라리아 + 일본뇌염 위험',
      '발리 위험도: 모기 + 위장염',
      '안전한 식수 + 익힌 음식',
      '오토바이 사고 빈번 — 헬멧 필수',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'SG',
    vaccinesRecommended: ['A형간염', 'B형간염'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '뎅기열 — 도심에서도 발생 (모기 기피제 권장)',
      '위생 상태 좋음 — 일반 여행 시 큰 주의 X',
      'COVID-19 등 호흡기 감염병 일반 주의',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },

  // ── 동북아 ──
  {
    countryCode: 'JP',
    vaccinesRecommended: ['A형간염', 'B형간염', '독감 (시즌)'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '위생 상태 한국과 유사 — 일반 주의면 충분',
      '겨울철 — 독감 + 노로바이러스 주의',
      '온천 — 피부염/감염 있으면 자제',
      '여름철 일본뇌염 (드물지만 산간지역)',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'CN',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스', '일본뇌염', '광견병'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '대기 오염 심각 — 마스크 필수 (특히 베이징·시안)',
      '식수 생수만, 양치질도 생수 권장',
      '지방 도시 위장염 빈번',
      '광견병 — 야생동물·노상견 접촉 자제',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'TW',
    vaccinesRecommended: ['A형간염', 'B형간염', '일본뇌염'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '뎅기열 — 남부 (가오슝, 타이난) 여름 주의',
      '위생 상태 좋음',
      '여름철 모기 기피제 권장',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },

  // ── 유럽 ──
  {
    countryCode: 'GB',
    vaccinesRecommended: ['독감 (시즌)'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '위생 상태 우수 — 특별한 주의 X',
      '겨울 호흡기 감염 (독감, RSV) 일반 주의',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'FR',
    vaccinesRecommended: ['독감 (시즌)'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '위생 상태 우수',
      '여름철 진드기 매개 라임병 (시골 지역)',
      '겨울 호흡기 일반 주의',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'IT',
    vaccinesRecommended: ['독감 (시즌)'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '위생 우수',
      '여름철 — 식중독 (마요네즈/생크림) 주의',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },

  // ── 북미 ──
  {
    countryCode: 'US',
    vaccinesRecommended: ['독감 (시즌)', 'COVID-19 부스터'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '위생 우수',
      '여름철 모기 매개 (West Nile, 동부)',
      '진드기 매개 라임병 (북동부)',
      'COVID-19 등 호흡기 일반 주의',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },

  // ── 중남미 ──
  {
    countryCode: 'MX',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '뎅기열 + 지카 — 모기 기피제 필수',
      '"Moctezuma\'s revenge" — 위장염 주의',
      '얼음·생야채 자제',
      '여행자 설사 약 준비',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'BR',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스', '광견병'],
    vaccinesRequired: ['황열병 (일부 지역 입국 시)'],
    preventionTipsKo: [
      '황열병 백신 필수 (아마존 지역)',
      '뎅기열 + 지카 + 치쿤구니야 — 모기 매개',
      '말라리아 위험 (아마존)',
      'A형간염 + 위장염 주의',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },

  // ── 중동 ──
  {
    countryCode: 'AE',
    vaccinesRecommended: ['A형간염', 'B형간염'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '위생 상태 양호 (도시)',
      '여름 폭염 — 열사병 주의 (실외 30분 이상 X)',
      '낙타 접촉 자제 — MERS 위험 (드물지만)',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
  {
    countryCode: 'TR',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스'],
    vaccinesRequired: [],
    preventionTipsKo: [
      '위생 상태 도시는 양호',
      '시골 + 동부 — A형간염 + 장티푸스 주의',
      '여름철 식중독 (해산물)',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },

  // ── 호주 ──
  {
    countryCode: 'AU',
    vaccinesRecommended: ['독감 (시즌)'],
    vaccinesRequired: ['황열병 (위험국가 경유 시)'],
    preventionTipsKo: [
      '위생 우수',
      '북부 (다윈) — 모기 매개 (Ross River, 뎅기열)',
      '독사·해파리 등 자연 위험 — 안내판 준수',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },

  // ── 아프리카 (대표) ──
  {
    countryCode: 'EG',
    vaccinesRecommended: ['A형간염', 'B형간염', '장티푸스', '광견병'],
    vaccinesRequired: [],
    preventionTipsKo: [
      'A형간염 + 장티푸스 위험 (위생)',
      '식수 생수만, 양치질도 생수',
      '나일강 주변 — 주혈흡충 (수영 자제)',
      '광견병 — 야생동물 접촉 자제',
    ],
    source: 'WHO + KDCA',
    lastUpdated: '2026-05-23',
  },
];

/**
 * 국가 코드로 감염병 정보 조회
 */
export function getDiseaseInfo(countryCode: string): DiseaseInfo | undefined {
  return DISEASE_INFO.find((d) => d.countryCode === countryCode.toUpperCase());
}

/**
 * 백신 권장 강도 평가 (UI 색상 등에 사용)
 *  none: 권장 백신 없음 (위생 우수 선진국)
 *  basic: A형/B형 간염 등 일반 백신
 *  medium: 장티푸스, 일본뇌염 등 동남아 권장 백신
 *  high: 황열병 등 필수 백신 또는 다수 권장
 */
export function getVaccinationRisk(countryCode: string): 'none' | 'basic' | 'medium' | 'high' {
  const info = getDiseaseInfo(countryCode);
  if (!info) return 'none';
  if (info.vaccinesRequired.length > 0) return 'high';
  if (info.vaccinesRecommended.length >= 4) return 'medium';
  if (info.vaccinesRecommended.length >= 1) return 'basic';
  return 'none';
}
