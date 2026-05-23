/**
 * 위험 지역 좌표 데이터셋 — 외교부 출국권고+여행금지 지역 수동 큐레이션
 *
 * 사용:
 *  - 사용자가 해당 국가로 여행 시작 (status='ongoing') 하면
 *    그 국가의 region 들을 expo-location Geofencing 에 등록
 *  - iOS 최대 20개 region 동시 모니터링 제약 → 진행중 트립 국가만 등록
 *  - 진입 시 알림 + 영사 콜센터 안내
 *
 * 좌표 출처: OSM / Wikipedia / 외교부 데이터 매핑 (수동 검증)
 * 1.3 에서 외교부 신규 위험 지역 자동 추출 (LLM) 으로 확장 예정
 */

export interface DangerRegion {
  /** 고유 ID — iOS region identifier 로도 사용 */
  id: string;
  /** ISO 2자리 국가 코드 */
  countryCode: string;
  /** 한글 지역명 */
  nameKo: string;
  /** 영문 지역명 (디버깅용) */
  nameEn: string;
  /** 중심 좌표 */
  latitude: number;
  longitude: number;
  /** 반경 (m) — iOS 권장 100~1000m, 최대 ~수십km 까지 OK */
  radiusMeters: number;
  /** 외교부 단계 (0~4) */
  level: 1 | 2 | 3 | 4;
  /** 짧은 사용자 메시지 */
  message: string;
  /** 외교부 원문 인용 */
  mofaSource: string;
}

export const DANGER_REGIONS: DangerRegion[] = [
  // ─── 동아시아 ─────────────────────────────────────────
  {
    id: 'jp_fukushima_npp',
    countryCode: 'JP',
    nameKo: '후쿠시마 원전 반경 30km',
    nameEn: 'Fukushima Daiichi NPP 30km zone',
    latitude: 37.4209,
    longitude: 141.0327,
    radiusMeters: 30000,
    level: 3,
    message: '후쿠시마 원전 반경 30km 출국권고 지역입니다. 즉시 안전 지역으로 이동을 권장합니다.',
    mofaSource: '후쿠시마 원전 반경 30km 이내 및 일본 정부 지정 피난지시구역',
  },

  // ─── 동남아 — 태국 남부 (분쟁 지역) ────────────────────
  {
    id: 'th_songkhla_south',
    countryCode: 'TH',
    nameKo: '송클라 주 남부 (말레이 접경)',
    nameEn: 'Songkhla southern districts',
    latitude: 6.6,
    longitude: 100.7,
    radiusMeters: 50000,
    level: 3,
    message: '태국 남부 분쟁 지역입니다. 외교부 출국권고. 영사 콜센터로 즉시 연락하세요.',
    mofaSource: '송클라 주 남부 말레이시아 접경지역',
  },
  {
    id: 'th_pattani',
    countryCode: 'TH',
    nameKo: '파타니 주',
    nameEn: 'Pattani Province',
    latitude: 6.87,
    longitude: 101.25,
    radiusMeters: 35000,
    level: 3,
    message: '파타니 주는 외교부 출국권고 지역입니다. 안전한 지역으로 이동하세요.',
    mofaSource: '파타니 주',
  },
  {
    id: 'th_narathiwat',
    countryCode: 'TH',
    nameKo: '나라티왓 주',
    nameEn: 'Narathiwat Province',
    latitude: 6.42,
    longitude: 101.82,
    radiusMeters: 35000,
    level: 3,
    message: '나라티왓 주는 외교부 출국권고 지역입니다. 안전한 지역으로 이동하세요.',
    mofaSource: '나라티왓 주',
  },
  {
    id: 'th_yala',
    countryCode: 'TH',
    nameKo: '얄라 주',
    nameEn: 'Yala Province',
    latitude: 6.54,
    longitude: 101.28,
    radiusMeters: 35000,
    level: 3,
    message: '얄라 주는 외교부 출국권고 지역입니다. 안전한 지역으로 이동하세요.',
    mofaSource: '얄라 주',
  },
  {
    id: 'th_tak',
    countryCode: 'TH',
    nameKo: '딱 주 (미얀마 접경)',
    nameEn: 'Tak Province (Myanmar border)',
    latitude: 16.87,
    longitude: 99.13,
    radiusMeters: 50000,
    level: 2,
    message: '딱 주는 외교부 여행자제 지역입니다. 야간 이동을 피하세요.',
    mofaSource: '딱 주',
  },
  {
    id: 'th_cambodia_border',
    countryCode: 'TH',
    nameKo: '태국-캄보디아 국경 50km',
    nameEn: 'Thailand-Cambodia border',
    latitude: 14.4,
    longitude: 103.5,
    radiusMeters: 50000,
    level: 3,
    message: '태국-캄보디아 국경 지역은 출국권고 지역입니다. 즉시 안전 지역으로 이동하세요.',
    mofaSource: '태국-캄보디아 국경 50km 이내',
  },

  // ─── 동남아 기타 ──────────────────────────────────────
  {
    id: 'ph_mindanao',
    countryCode: 'PH',
    nameKo: '필리핀 민다나오 일부',
    nameEn: 'Mindanao (Philippines)',
    latitude: 7.0,
    longitude: 124.5,
    radiusMeters: 100000,
    level: 3,
    message: '민다나오 일부 지역은 외교부 출국권고 지역입니다.',
    mofaSource: '민다나오 술루 군도 및 일부 지역',
  },
  {
    id: 'mm_general',
    countryCode: 'MM',
    nameKo: '미얀마 양곤',
    nameEn: 'Yangon, Myanmar',
    latitude: 16.87,
    longitude: 96.2,
    radiusMeters: 50000,
    level: 2,
    message: '미얀마 정세 불안정. 시위 / 통금 시간 확인 필요.',
    mofaSource: '미얀마 전 지역',
  },

  // ─── 분쟁 / 전쟁 지역 ─────────────────────────────────
  {
    id: 'ua_kyiv',
    countryCode: 'UA',
    nameKo: '우크라이나 (전국 여행금지)',
    nameEn: 'Ukraine',
    latitude: 50.45,
    longitude: 30.52,
    radiusMeters: 200000,
    level: 4,
    message: '우크라이나 전 지역 여행금지. 즉시 출국 또는 영사 콜센터로 연락하세요.',
    mofaSource: '우크라이나 전 지역 여행금지',
  },
  {
    id: 'sy_damascus',
    countryCode: 'SY',
    nameKo: '시리아 (전국 여행금지)',
    nameEn: 'Syria',
    latitude: 33.51,
    longitude: 36.29,
    radiusMeters: 200000,
    level: 4,
    message: '시리아 전 지역 여행금지. 즉시 영사 콜센터로 연락하세요.',
    mofaSource: '시리아 전 지역',
  },
  {
    id: 'iq_general',
    countryCode: 'IQ',
    nameKo: '이라크 (대부분 출국권고)',
    nameEn: 'Iraq',
    latitude: 33.32,
    longitude: 44.36,
    radiusMeters: 150000,
    level: 3,
    message: '이라크 대부분 지역 출국권고. 영사 콜센터 우선 연락.',
    mofaSource: '이라크',
  },
  {
    id: 'af_kabul',
    countryCode: 'AF',
    nameKo: '아프가니스탄 (여행금지)',
    nameEn: 'Afghanistan',
    latitude: 34.53,
    longitude: 69.17,
    radiusMeters: 200000,
    level: 4,
    message: '아프가니스탄 전 지역 여행금지. 즉시 영사 콜센터로 연락하세요.',
    mofaSource: '아프가니스탄 전 지역',
  },
  {
    id: 'ye_sanaa',
    countryCode: 'YE',
    nameKo: '예멘 (여행금지)',
    nameEn: 'Yemen',
    latitude: 15.37,
    longitude: 44.19,
    radiusMeters: 200000,
    level: 4,
    message: '예멘 전 지역 여행금지. 즉시 영사 콜센터로 연락하세요.',
    mofaSource: '예멘 전 지역',
  },
  {
    id: 'so_mogadishu',
    countryCode: 'SO',
    nameKo: '소말리아 (여행금지)',
    nameEn: 'Somalia',
    latitude: 2.05,
    longitude: 45.32,
    radiusMeters: 200000,
    level: 4,
    message: '소말리아 전 지역 여행금지. 즉시 영사 콜센터로 연락하세요.',
    mofaSource: '소말리아 전 지역',
  },
  {
    id: 'ly_tripoli',
    countryCode: 'LY',
    nameKo: '리비아 (여행금지)',
    nameEn: 'Libya',
    latitude: 32.89,
    longitude: 13.18,
    radiusMeters: 150000,
    level: 4,
    message: '리비아 전 지역 여행금지. 즉시 영사 콜센터로 연락하세요.',
    mofaSource: '리비아 전 지역',
  },
  {
    id: 'il_gaza_border',
    countryCode: 'IL',
    nameKo: '이스라엘 가자/북부 국경',
    nameEn: 'Israel — Gaza & Northern borders',
    latitude: 31.42,
    longitude: 34.4,
    radiusMeters: 30000,
    level: 4,
    message: '가자/북부 국경 지역 여행금지. 즉시 안전 지역으로 이동하세요.',
    mofaSource: '가자지구 및 시리아·레바논 접경',
  },

  // ─── 중남미 ───────────────────────────────────────────
  {
    id: 've_caracas',
    countryCode: 'VE',
    nameKo: '베네수엘라 카라카스',
    nameEn: 'Caracas',
    latitude: 10.49,
    longitude: -66.88,
    radiusMeters: 50000,
    level: 3,
    message: '카라카스는 외교부 출국권고 지역입니다. 강도·납치 위험 높음.',
    mofaSource: '베네수엘라',
  },
  {
    id: 'mx_north_border',
    countryCode: 'MX',
    nameKo: '멕시코 북부 (시우다드후아레스)',
    nameEn: 'Ciudad Juárez',
    latitude: 31.69,
    longitude: -106.42,
    radiusMeters: 30000,
    level: 2,
    message: '멕시코 북부 국경은 외교부 여행자제 지역입니다. 야간 외출 자제.',
    mofaSource: '멕시코 북부 국경',
  },
];

/** 국가 코드별 위험 region 조회 */
export function getDangerRegionsByCountry(countryCode: string): DangerRegion[] {
  return DANGER_REGIONS.filter((r) => r.countryCode === countryCode.toUpperCase());
}

/** 단일 region 조회 (ID 로) */
export function getDangerRegionById(id: string): DangerRegion | undefined {
  return DANGER_REGIONS.find((r) => r.id === id);
}

/**
 * iOS 의 20개 region 제약을 고려해 진행중 트립 국가들의 region 만 추출.
 * 최대 N 개 (기본 20) 까지만 반환 (level 높은 순).
 */
export function pickRegionsForCountries(
  countryCodes: string[],
  max = 20,
): DangerRegion[] {
  const codes = new Set(countryCodes.map((c) => c.toUpperCase()));
  return DANGER_REGIONS.filter((r) => codes.has(r.countryCode))
    .sort((a, b) => b.level - a.level)
    .slice(0, max);
}
