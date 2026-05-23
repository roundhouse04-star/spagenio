/**
 * Triplive 여행 안전 — 데이터 타입 정의
 *
 * 1.2 새 기능 — Phase 1 + Phase 2 통합 설계
 *
 * 정적 데이터: 앱 번들 포함 (embassies, emergencyGuides, diseases)
 * 동적 데이터: Cloudflare Workers + D1 (advisories, alerts, geoAlerts)
 */

// ──────────────────────────────────────────────────────────
// 외교부 여행 경보 단계 (1.2 핵심)
// ──────────────────────────────────────────────────────────

/**
 * 외교부 여행 경보 단계
 * 출처: 외교부 해외안전여행 (0404.go.kr)
 */
export type AdvisoryLevel = 0 | 1 | 2 | 3 | 4;

export const ADVISORY_META: Record<AdvisoryLevel, { color: string; label: string; description: string }> = {
  0: { color: '#3B82F6', label: '안전', description: '특이사항 없음' },
  1: { color: '#3B82F6', label: '여행유의', description: '신변안전 유의 (남색경보)' },
  2: { color: '#F59E0B', label: '여행자제', description: '여행 필요성 신중 검토 (황색경보)' },
  3: { color: '#EF4444', label: '출국권고', description: '긴급용무 외 출국 권고 (적색경보)' },
  4: { color: '#1F2937', label: '여행금지', description: '여행 금지 (흑색경보)' },
};

/**
 * 외교부 경보 데이터 (동적, 백엔드에서 fetch)
 */
export interface TravelAdvisory {
  countryCode: string;       // 'JP', 'KH', ...
  countryName: string;        // '일본', '캄보디아', ...
  level: AdvisoryLevel;
  message: string;            // 외교부 게시 메시지
  updatedAt: string;          // ISO 8601
  source: 'mofa.go.kr';       // 데이터 출처
}

// ──────────────────────────────────────────────────────────
// 안전 공지 (외교부 실시간 알림)
// ──────────────────────────────────────────────────────────

export type AlertType =
  | 'protest'       // 시위
  | 'disaster'      // 자연재해
  | 'accident'      // 사고
  | 'terror'        // 테러
  | 'disease'       // 감염병
  | 'crime'         // 범죄 (소매치기 등)
  | 'other';

export interface SafetyAlert {
  id: string;
  countryCode: string;
  cityId?: string;            // 도시 특정 알림이면
  type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  publishedAt: string;        // ISO 8601
  expiresAt?: string;         // 알림 만료 시점
  source: string;             // 'mofa' | 'who' | 'user' | 'curated'
  geoArea?: GeoArea;          // 위치 기반 알림 영역 (있으면)
}

// ──────────────────────────────────────────────────────────
// 대사관 / 영사관 (정적 데이터, embassies.ts)
// ──────────────────────────────────────────────────────────

export interface Embassy {
  id: string;                 // 'embassy_jp_tokyo'
  countryCode: string;        // 'JP' (소재국)
  cityName: string;           // '도쿄'
  type: 'embassy' | 'consulate' | 'consular_agency';
  nameKo: string;             // '주일본 대한민국 대사관'
  nameLocal?: string;         // 현지어 명칭
  address: string;
  phone: string;              // 정규 시간
  phoneEmergency?: string;    // 야간 / 긴급
  email?: string;
  website?: string;
  hours?: string;             // 영업시간
  latitude: number;
  longitude: number;
}

// ──────────────────────────────────────────────────────────
// 비상 상황 가이드 (정적 데이터, emergencyGuides.ts)
// ──────────────────────────────────────────────────────────

export type EmergencyType =
  | 'passport_lost'      // 여권 분실
  | 'theft'              // 도난
  | 'injury'             // 부상
  | 'illness'            // 질병
  | 'detained'           // 체포/구금
  | 'natural_disaster'   // 자연재해 대피
  | 'lost_money'         // 돈 분실
  | 'language_barrier';  // 언어 문제

export interface EmergencyGuide {
  type: EmergencyType;
  icon: string;
  titleKo: string;
  stepsKo: string[];          // 단계별 안내
  tipsKo?: string[];          // 추가 팁
  relatedContacts?: string[]; // 관련 연락처 (예: '대사관', '경찰', '한국 영사 콜센터')
}

// ──────────────────────────────────────────────────────────
// 감염병 정보 (정적 + 동적 하이브리드)
// ──────────────────────────────────────────────────────────

export interface DiseaseInfo {
  countryCode: string;
  vaccinesRecommended: string[];   // '말라리아', '뎅기열', '황열병', ...
  vaccinesRequired: string[];       // 입국 필수 백신 (예: 황열병 증명서)
  outbreakAlerts?: SafetyAlert[];   // 현재 진행중인 발생 (동적)
  preventionTipsKo: string[];
  source: string;                   // 'WHO' | 'KDCA' (질병관리청)
  lastUpdated: string;
}

// ──────────────────────────────────────────────────────────
// 위치 기반 알림 (지오펜싱, Phase 2)
// ──────────────────────────────────────────────────────────

export interface GeoArea {
  type: 'circle' | 'polygon';
  center?: { lat: number; lng: number };
  radius?: number;                // meters (circle)
  polygon?: { lat: number; lng: number }[];  // polygon
  name?: string;                  // '소매치기 다발 지역 — 에펠탑 주변'
}

export interface GeoAlert {
  id: string;
  alertType: AlertType;
  geoArea: GeoArea;
  alert: SafetyAlert;
  enterMessage?: string;          // "이 지역은 소매치기가 빈번합니다"
  exitMessage?: string;
}

// ──────────────────────────────────────────────────────────
// 사용자 신고 (Phase 3, 1.3+)
// ──────────────────────────────────────────────────────────

export interface UserReport {
  id: string;
  reporterId: string;             // 익명 ID
  countryCode: string;
  cityId?: string;
  location: { lat: number; lng: number };
  type: AlertType;
  description: string;
  reportedAt: string;
  verified: boolean;              // 운영자/시스템 검증
  verifiedAt?: string;
  upvotes: number;                // 다른 사용자 동의
  flagged: number;                // 허위 신고 신고
}
