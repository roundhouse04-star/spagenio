/**
 * 도구 탭 정적 데이터 모음
 * - EMERGENCY_CONTACTS: 국가별 응급 전화번호 + 한국 대사관
 * - VISA_INFO: 한국 여권 무비자 체류 가능 일수 (외교부 기준)
 * - TIMEZONE_CITIES: 시차 계산기용 주요 도시
 *
 * 외부 호출 0건. 정적 데이터 (출시 시점 기준, 변경 시 PR로 갱신).
 * 외교부 무비자 정보는 변동 가능성 있어 사용자 안내 문구 포함.
 */

export interface EmergencyContact {
  countryCode: string;
  flag: string;
  countryNameKo: string;
  police?: string;
  ambulance?: string;
  fire?: string;
  touristPolice?: string;
  embassy?: string;       // 한국 대사관
  embassyEmergency?: string; // 영사 콜센터 (24h)
}

/** 영사 콜센터 (한국 외교부 24시간) */
export const KOREA_CONSULAR_CALL_CENTER = '+82-2-3210-0404';

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    countryCode: 'JP', flag: '🇯🇵', countryNameKo: '일본',
    police: '110', ambulance: '119', fire: '119',
    embassy: '+81-3-3455-2601', // 주일대사관
  },
  {
    countryCode: 'CN', flag: '🇨🇳', countryNameKo: '중국',
    police: '110', ambulance: '120', fire: '119',
    embassy: '+86-10-8531-0700',
  },
  {
    countryCode: 'TW', flag: '🇹🇼', countryNameKo: '대만',
    police: '110', ambulance: '119', fire: '119',
    embassy: '+886-2-2758-8320', // 주타이베이 대표부
  },
  {
    countryCode: 'HK', flag: '🇭🇰', countryNameKo: '홍콩',
    police: '999', ambulance: '999', fire: '999',
    embassy: '+852-2529-4141',
  },
  {
    countryCode: 'TH', flag: '🇹🇭', countryNameKo: '태국',
    police: '191', ambulance: '1669', fire: '199',
    touristPolice: '1155',
    embassy: '+66-2-481-6000',
  },
  {
    countryCode: 'VN', flag: '🇻🇳', countryNameKo: '베트남',
    police: '113', ambulance: '115', fire: '114',
    embassy: '+84-24-3831-5111',
  },
  {
    countryCode: 'PH', flag: '🇵🇭', countryNameKo: '필리핀',
    police: '117', ambulance: '911', fire: '160',
    embassy: '+63-2-857-9000',
  },
  {
    countryCode: 'ID', flag: '🇮🇩', countryNameKo: '인도네시아',
    police: '110', ambulance: '118', fire: '113',
    embassy: '+62-21-2967-2555',
  },
  {
    countryCode: 'SG', flag: '🇸🇬', countryNameKo: '싱가포르',
    police: '999', ambulance: '995', fire: '995',
    embassy: '+65-6256-1188',
  },
  {
    countryCode: 'MY', flag: '🇲🇾', countryNameKo: '말레이시아',
    police: '999', ambulance: '999', fire: '994',
    embassy: '+60-3-4251-2336',
  },
  {
    countryCode: 'US', flag: '🇺🇸', countryNameKo: '미국',
    police: '911', ambulance: '911', fire: '911',
    embassy: '+1-202-939-5600',
  },
  {
    countryCode: 'GB', flag: '🇬🇧', countryNameKo: '영국',
    police: '999', ambulance: '999', fire: '999',
    embassy: '+44-20-7227-5500',
  },
  {
    countryCode: 'FR', flag: '🇫🇷', countryNameKo: '프랑스',
    police: '17', ambulance: '15', fire: '18',
    embassy: '+33-1-4753-0101',
  },
  {
    countryCode: 'DE', flag: '🇩🇪', countryNameKo: '독일',
    police: '110', ambulance: '112', fire: '112',
    embassy: '+49-30-260-65-0',
  },
  {
    countryCode: 'IT', flag: '🇮🇹', countryNameKo: '이탈리아',
    police: '113', ambulance: '118', fire: '115',
    embassy: '+39-06-802461',
  },
  {
    countryCode: 'ES', flag: '🇪🇸', countryNameKo: '스페인',
    police: '091', ambulance: '061', fire: '080',
    embassy: '+34-91-353-2000',
  },
  {
    countryCode: 'NL', flag: '🇳🇱', countryNameKo: '네덜란드',
    police: '112', ambulance: '112', fire: '112',
    embassy: '+31-70-358-6076',
  },
  {
    countryCode: 'CZ', flag: '🇨🇿', countryNameKo: '체코',
    police: '158', ambulance: '155', fire: '150',
    embassy: '+420-234-090-411',
  },
  {
    countryCode: 'AT', flag: '🇦🇹', countryNameKo: '오스트리아',
    police: '133', ambulance: '144', fire: '122',
    embassy: '+43-1-478-1991',
  },
  {
    countryCode: 'TR', flag: '🇹🇷', countryNameKo: '튀르키예',
    police: '155', ambulance: '112', fire: '110',
    embassy: '+90-312-468-4821',
  },
  {
    countryCode: 'AE', flag: '🇦🇪', countryNameKo: 'UAE',
    police: '999', ambulance: '998', fire: '997',
    embassy: '+971-2-441-1520',
  },
  {
    countryCode: 'AU', flag: '🇦🇺', countryNameKo: '호주',
    police: '000', ambulance: '000', fire: '000',
    embassy: '+61-2-6270-4100',
  },
  {
    countryCode: 'EG', flag: '🇪🇬', countryNameKo: '이집트',
    police: '122', ambulance: '123', fire: '180',
    embassy: '+20-2-2761-1234',
  },
  {
    countryCode: 'MX', flag: '🇲🇽', countryNameKo: '멕시코',
    police: '911', ambulance: '911', fire: '911',
    embassy: '+52-55-5202-9866',
  },
];

// ──────────────────────────────────────────────

export interface VisaInfo {
  countryCode: string;
  flag: string;
  countryNameKo: string;
  /** 'visa-free' | 'visa-on-arrival' | 'evisa' | 'required' */
  type: 'visa-free' | 'visa-on-arrival' | 'evisa' | 'required';
  /** 무비자 체류 가능 일수 (visa-free / visa-on-arrival 시) */
  days?: number;
  note?: string;
}

/**
 * 한국 여권(대한민국 일반여권) 기준 무비자 체류 정보.
 * 출처: 외교부 영사서비스 (출시 시점 기준).
 * 정책 변경 가능 — 앱에 안내 문구 포함.
 */
export const VISA_INFO: VisaInfo[] = [
  { countryCode: 'JP', flag: '🇯🇵', countryNameKo: '일본', type: 'visa-free', days: 90 },
  { countryCode: 'CN', flag: '🇨🇳', countryNameKo: '중국', type: 'visa-free', days: 15, note: '단기 관광 한정 (2024.11~)' },
  { countryCode: 'TW', flag: '🇹🇼', countryNameKo: '대만', type: 'visa-free', days: 90 },
  { countryCode: 'HK', flag: '🇭🇰', countryNameKo: '홍콩', type: 'visa-free', days: 90 },
  { countryCode: 'TH', flag: '🇹🇭', countryNameKo: '태국', type: 'visa-free', days: 90 },
  { countryCode: 'VN', flag: '🇻🇳', countryNameKo: '베트남', type: 'visa-free', days: 45 },
  { countryCode: 'PH', flag: '🇵🇭', countryNameKo: '필리핀', type: 'visa-free', days: 30 },
  { countryCode: 'ID', flag: '🇮🇩', countryNameKo: '인도네시아', type: 'visa-on-arrival', days: 30, note: '도착비자 (USD 35)' },
  { countryCode: 'SG', flag: '🇸🇬', countryNameKo: '싱가포르', type: 'visa-free', days: 90 },
  { countryCode: 'MY', flag: '🇲🇾', countryNameKo: '말레이시아', type: 'visa-free', days: 90 },
  { countryCode: 'US', flag: '🇺🇸', countryNameKo: '미국', type: 'evisa', note: 'ESTA 사전 신청 (90일)' },
  { countryCode: 'GB', flag: '🇬🇧', countryNameKo: '영국', type: 'evisa', note: 'ETA 사전 신청 (180일)' },
  { countryCode: 'CA', flag: '🇨🇦', countryNameKo: '캐나다', type: 'evisa', note: 'eTA 사전 신청 (180일)' },
  { countryCode: 'FR', flag: '🇫🇷', countryNameKo: '프랑스', type: 'visa-free', days: 90, note: '쉥겐 90일/180일 룰' },
  { countryCode: 'DE', flag: '🇩🇪', countryNameKo: '독일', type: 'visa-free', days: 90, note: '쉥겐 90일/180일 룰' },
  { countryCode: 'IT', flag: '🇮🇹', countryNameKo: '이탈리아', type: 'visa-free', days: 90, note: '쉥겐 90일/180일 룰' },
  { countryCode: 'ES', flag: '🇪🇸', countryNameKo: '스페인', type: 'visa-free', days: 90, note: '쉥겐 90일/180일 룰' },
  { countryCode: 'NL', flag: '🇳🇱', countryNameKo: '네덜란드', type: 'visa-free', days: 90, note: '쉥겐 90일/180일 룰' },
  { countryCode: 'CZ', flag: '🇨🇿', countryNameKo: '체코', type: 'visa-free', days: 90, note: '쉥겐 90일/180일 룰' },
  { countryCode: 'AT', flag: '🇦🇹', countryNameKo: '오스트리아', type: 'visa-free', days: 90, note: '쉥겐 90일/180일 룰' },
  { countryCode: 'TR', flag: '🇹🇷', countryNameKo: '튀르키예', type: 'visa-free', days: 90 },
  { countryCode: 'AE', flag: '🇦🇪', countryNameKo: 'UAE', type: 'visa-free', days: 90 },
  { countryCode: 'AU', flag: '🇦🇺', countryNameKo: '호주', type: 'evisa', note: 'eVisitor 사전 신청 (90일)' },
  { countryCode: 'NZ', flag: '🇳🇿', countryNameKo: '뉴질랜드', type: 'evisa', note: 'NZeTA 사전 신청 (90일)' },
  { countryCode: 'EG', flag: '🇪🇬', countryNameKo: '이집트', type: 'visa-on-arrival', days: 30, note: '도착비자 (USD 25)' },
  { countryCode: 'MX', flag: '🇲🇽', countryNameKo: '멕시코', type: 'visa-free', days: 180 },
  { countryCode: 'IN', flag: '🇮🇳', countryNameKo: '인도', type: 'evisa', note: 'eVisa 사전 신청' },
  { countryCode: 'SA', flag: '🇸🇦', countryNameKo: '사우디아라비아', type: 'evisa', note: '관광 eVisa 사전 신청' },
];

// ──────────────────────────────────────────────

export interface TimezoneCity {
  id: string;
  flag: string;
  nameKo: string;
  /** IANA TZ identifier — Date.toLocaleString 에 사용 */
  tz: string;
}

/** 시차 계산기용 주요 도시 (IANA timezone). */
export const TIMEZONE_CITIES: TimezoneCity[] = [
  { id: 'seoul', flag: '🇰🇷', nameKo: '서울', tz: 'Asia/Seoul' },
  { id: 'tokyo', flag: '🇯🇵', nameKo: '도쿄', tz: 'Asia/Tokyo' },
  { id: 'osaka', flag: '🇯🇵', nameKo: '오사카', tz: 'Asia/Tokyo' },
  { id: 'beijing', flag: '🇨🇳', nameKo: '베이징', tz: 'Asia/Shanghai' },
  { id: 'shanghai', flag: '🇨🇳', nameKo: '상하이', tz: 'Asia/Shanghai' },
  { id: 'hongkong', flag: '🇭🇰', nameKo: '홍콩', tz: 'Asia/Hong_Kong' },
  { id: 'taipei', flag: '🇹🇼', nameKo: '타이베이', tz: 'Asia/Taipei' },
  { id: 'bangkok', flag: '🇹🇭', nameKo: '방콕', tz: 'Asia/Bangkok' },
  { id: 'hanoi', flag: '🇻🇳', nameKo: '하노이', tz: 'Asia/Ho_Chi_Minh' },
  { id: 'manila', flag: '🇵🇭', nameKo: '마닐라', tz: 'Asia/Manila' },
  { id: 'singapore', flag: '🇸🇬', nameKo: '싱가포르', tz: 'Asia/Singapore' },
  { id: 'kualalumpur', flag: '🇲🇾', nameKo: '쿠알라룸푸르', tz: 'Asia/Kuala_Lumpur' },
  { id: 'jakarta', flag: '🇮🇩', nameKo: '자카르타', tz: 'Asia/Jakarta' },
  { id: 'denpasar', flag: '🇮🇩', nameKo: '발리(덴파사르)', tz: 'Asia/Makassar' },
  { id: 'dubai', flag: '🇦🇪', nameKo: '두바이', tz: 'Asia/Dubai' },
  { id: 'istanbul', flag: '🇹🇷', nameKo: '이스탄불', tz: 'Europe/Istanbul' },
  { id: 'paris', flag: '🇫🇷', nameKo: '파리', tz: 'Europe/Paris' },
  { id: 'london', flag: '🇬🇧', nameKo: '런던', tz: 'Europe/London' },
  { id: 'rome', flag: '🇮🇹', nameKo: '로마', tz: 'Europe/Rome' },
  { id: 'berlin', flag: '🇩🇪', nameKo: '베를린', tz: 'Europe/Berlin' },
  { id: 'newyork', flag: '🇺🇸', nameKo: '뉴욕', tz: 'America/New_York' },
  { id: 'losangeles', flag: '🇺🇸', nameKo: '로스앤젤레스', tz: 'America/Los_Angeles' },
  { id: 'lasvegas', flag: '🇺🇸', nameKo: '라스베가스', tz: 'America/Los_Angeles' },
  { id: 'honolulu', flag: '🇺🇸', nameKo: '호놀룰루', tz: 'Pacific/Honolulu' },
  { id: 'guam', flag: '🇬🇺', nameKo: '괌', tz: 'Pacific/Guam' },
  { id: 'sydney', flag: '🇦🇺', nameKo: '시드니', tz: 'Australia/Sydney' },
  { id: 'cairo', flag: '🇪🇬', nameKo: '카이로', tz: 'Africa/Cairo' },
  { id: 'cancun', flag: '🇲🇽', nameKo: '칸쿤', tz: 'America/Cancun' },
];
