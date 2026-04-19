/**
 * 도시 데이터 + 꿀팁
 *
 * 탐색 탭에서 사용
 */

export interface DestinationCity {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  countryCode: string;
  flag: string;
  icon: string;
  categories: Category[];
  seasons: Season[];
  highlights: string[]; // 대표 명소
  tips: string[];       // 여행 팁
  bestMonths: number[]; // 1-12
  currency: string;
  language: string;
  timeZone: string;
  flightHours?: string; // 한국 출발 기준
}

export type Category = 'leisure' | 'culture' | 'shopping' | 'food' | 'nature' | 'city';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const CATEGORIES = [
  { key: 'leisure' as Category, label: '휴양', icon: '🏖️' },
  { key: 'culture' as Category, label: '문화', icon: '🏛️' },
  { key: 'shopping' as Category, label: '쇼핑', icon: '🛍️' },
  { key: 'food' as Category, label: '미식', icon: '🍜' },
  { key: 'nature' as Category, label: '자연', icon: '🌿' },
  { key: 'city' as Category, label: '도시', icon: '🏙️' },
];

export const DESTINATIONS: DestinationCity[] = [
  {
    id: 'tokyo',
    name: '도쿄',
    nameEn: 'Tokyo',
    country: '일본',
    countryCode: 'JP',
    flag: '🇯🇵',
    icon: '🗼',
    categories: ['culture', 'food', 'shopping', 'city'],
    seasons: ['spring', 'autumn'],
    highlights: ['시부야 교차로', '센소지', '도쿄 타워', '츠키지 시장', '아키하바라'],
    tips: [
      '지하철 패스 (Tokyo Subway Ticket) 24/48/72시간권이 저렴해요',
      '편의점에서 교통카드 Suica 충전 가능',
      '식당 대부분 현금 결제 (일부만 카드)',
      '벚꽃은 3월 말~4월 초, 단풍은 11월 중순',
    ],
    bestMonths: [3, 4, 10, 11],
    currency: 'JPY',
    language: '일본어',
    timeZone: 'UTC+9',
    flightHours: '2시간 30분',
  },
  {
    id: 'osaka',
    name: '오사카',
    nameEn: 'Osaka',
    country: '일본',
    countryCode: 'JP',
    flag: '🇯🇵',
    icon: '🏯',
    categories: ['food', 'culture', 'shopping'],
    seasons: ['spring', 'autumn'],
    highlights: ['도톤보리', '오사카성', '신사이바시', 'USJ', '쿠로몬 시장'],
    tips: [
      '타코야키, 오코노미야키, 쿠시카츠는 꼭 먹어보세요',
      '오사카 아마징 패스로 많은 관광지 무료',
      '교토, 나라까지 당일치기 가능',
      'USJ는 평일 예약 추천',
    ],
    bestMonths: [3, 4, 5, 10, 11],
    currency: 'JPY',
    language: '일본어',
    timeZone: 'UTC+9',
    flightHours: '2시간',
  },
  {
    id: 'bangkok',
    name: '방콕',
    nameEn: 'Bangkok',
    country: '태국',
    countryCode: 'TH',
    flag: '🇹🇭',
    icon: '🛕',
    categories: ['culture', 'food', 'shopping'],
    seasons: ['winter'],
    highlights: ['왕궁', '왓 아룬', '차이나타운', '짜뚜짝 시장', '카오산 로드'],
    tips: [
      '11월~2월이 시원해서 여행하기 좋아요',
      'Grab 앱으로 택시/툭툭 예약 가능',
      '현지 음식점 1인 2000원대부터',
      '마사지는 2시간 300바트 정도',
    ],
    bestMonths: [11, 12, 1, 2],
    currency: 'THB',
    language: '태국어',
    timeZone: 'UTC+7',
    flightHours: '6시간',
  },
  {
    id: 'paris',
    name: '파리',
    nameEn: 'Paris',
    country: '프랑스',
    countryCode: 'FR',
    flag: '🇫🇷',
    icon: '🗼',
    categories: ['culture', 'food', 'city'],
    seasons: ['spring', 'autumn'],
    highlights: ['에펠탑', '루브르 박물관', '노트르담', '몽마르트', '샹젤리제'],
    tips: [
      '루브르는 온라인 예약 필수 (현장 대기 1시간+)',
      '메트로 10회권 카르네가 경제적',
      '파리 뮤지엄 패스로 주요 명소 무료',
      '식당 팁 문화 없음 (서비스료 포함)',
    ],
    bestMonths: [4, 5, 6, 9, 10],
    currency: 'EUR',
    language: '프랑스어',
    timeZone: 'UTC+1',
    flightHours: '14시간',
  },
  {
    id: 'newyork',
    name: '뉴욕',
    nameEn: 'New York',
    country: '미국',
    countryCode: 'US',
    flag: '🇺🇸',
    icon: '🗽',
    categories: ['city', 'culture', 'shopping', 'food'],
    seasons: ['spring', 'autumn'],
    highlights: ['자유의 여신상', '센트럴 파크', '타임스퀘어', 'MoMA', '브루클린 브릿지'],
    tips: [
      '서브웨이는 MetroCard 또는 OMNY 탭으로',
      '레스토랑 팁 15~20% 필수',
      '브로드웨이 TKTS 매표소 당일 할인',
      '5~6월, 9~10월이 날씨 좋아요',
    ],
    bestMonths: [5, 6, 9, 10],
    currency: 'USD',
    language: '영어',
    timeZone: 'UTC-5',
    flightHours: '14시간',
  },
  {
    id: 'london',
    name: '런던',
    nameEn: 'London',
    country: '영국',
    countryCode: 'GB',
    flag: '🇬🇧',
    icon: '🎡',
    categories: ['culture', 'city', 'shopping'],
    seasons: ['summer'],
    highlights: ['빅 벤', '대영박물관', '런던 아이', '타워 브릿지', '옥스포드 스트리트'],
    tips: [
      'Oyster 카드 또는 컨택트리스 결제가 편해요',
      '대부분의 박물관 무료 입장!',
      '비가 자주 오니 우산 필수',
      '펍 문화 체험 (18시 이후 북적)',
    ],
    bestMonths: [5, 6, 7, 8, 9],
    currency: 'GBP',
    language: '영어',
    timeZone: 'UTC+0',
    flightHours: '14시간',
  },
  {
    id: 'singapore',
    name: '싱가포르',
    nameEn: 'Singapore',
    country: '싱가포르',
    countryCode: 'SG',
    flag: '🇸🇬',
    icon: '🦁',
    categories: ['city', 'food', 'shopping', 'leisure'],
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    highlights: ['마리나 베이 샌즈', '가든스 바이 더 베이', '센토사', '차이나타운', '호커센터'],
    tips: [
      '연중 무더우니 선크림 필수 (28~32도)',
      '호커센터에서 저렴한 현지 음식',
      'MRT 하루권 저렴해요',
      '껌 반입 금지, 공공장소 흡연 금지',
    ],
    bestMonths: [2, 3, 4, 7, 8],
    currency: 'SGD',
    language: '영어·중국어',
    timeZone: 'UTC+8',
    flightHours: '6시간 30분',
  },
  {
    id: 'barcelona',
    name: '바르셀로나',
    nameEn: 'Barcelona',
    country: '스페인',
    countryCode: 'ES',
    flag: '🇪🇸',
    icon: '⛪',
    categories: ['culture', 'food', 'leisure'],
    seasons: ['spring', 'summer', 'autumn'],
    highlights: ['사그라다 파밀리아', '구엘 공원', '람블라스', '고딕 지구', '바르셀로네타 해변'],
    tips: [
      '사그라다 파밀리아는 온라인 예약 필수',
      '타파스 투어 추천',
      '시에스타 (15~17시)에 상점 닫음',
      '소매치기 조심 (특히 관광지)',
    ],
    bestMonths: [4, 5, 6, 9, 10],
    currency: 'EUR',
    language: '스페인어',
    timeZone: 'UTC+1',
    flightHours: '15시간',
  },
  {
    id: 'hongkong',
    name: '홍콩',
    nameEn: 'Hong Kong',
    country: '홍콩',
    countryCode: 'HK',
    flag: '🇭🇰',
    icon: '🌃',
    categories: ['city', 'food', 'shopping'],
    seasons: ['autumn', 'winter'],
    highlights: ['빅토리아 피크', '침사추이', '디즈니랜드', '란콰이퐁', '스타의 거리'],
    tips: [
      '10~12월이 가장 시원하고 좋아요',
      '옥토퍼스 카드 (교통+편의점)',
      '심포니 오브 라이츠 20시 무료',
      '딤섬은 아침~점심이 가장 싱싱',
    ],
    bestMonths: [10, 11, 12, 1],
    currency: 'HKD',
    language: '광둥어·영어',
    timeZone: 'UTC+8',
    flightHours: '3시간 30분',
  },
  {
    id: 'rome',
    name: '로마',
    nameEn: 'Rome',
    country: '이탈리아',
    countryCode: 'IT',
    flag: '🇮🇹',
    icon: '🏛️',
    categories: ['culture', 'food'],
    seasons: ['spring', 'autumn'],
    highlights: ['콜로세움', '바티칸', '트레비 분수', '판테온', '스페인 계단'],
    tips: [
      '콜로세움+포로 로마노 통합권 추천',
      '바티칸 박물관은 예약 필수',
      '트레비 분수 동전 던지기 → 다시 온다는 전설',
      '7~8월은 매우 더움',
    ],
    bestMonths: [4, 5, 6, 9, 10],
    currency: 'EUR',
    language: '이탈리아어',
    timeZone: 'UTC+1',
    flightHours: '13시간',
  },
  {
    id: 'berlin',
    name: '베를린',
    nameEn: 'Berlin',
    country: '독일',
    countryCode: 'DE',
    flag: '🇩🇪',
    icon: '🏛️',
    categories: ['culture', 'city'],
    seasons: ['summer'],
    highlights: ['브란덴부르크 문', '베를린 장벽', '박물관섬', '포츠담 광장', '이스트 사이드 갤러리'],
    tips: [
      '베를린 WelcomeCard로 교통+할인',
      '역사 유적지는 무료 많음',
      '밤문화 유명 (베르크하인)',
      '여름 해 길어서 21시까지 밝음',
    ],
    bestMonths: [5, 6, 7, 8, 9],
    currency: 'EUR',
    language: '독일어',
    timeZone: 'UTC+1',
    flightHours: '13시간',
  },
  {
    id: 'amsterdam',
    name: '암스테르담',
    nameEn: 'Amsterdam',
    country: '네덜란드',
    countryCode: 'NL',
    flag: '🇳🇱',
    icon: '🚲',
    categories: ['culture', 'city'],
    seasons: ['spring', 'summer'],
    highlights: ['반 고흐 미술관', '안네의 집', '운하 크루즈', '라익스 미술관', '요르단 지구'],
    tips: [
      '자전거 왕국! 자전거 투어 추천',
      '운하 크루즈 1시간 15유로',
      '안네의 집은 2달 전 예약',
      '튤립은 4월 중순~5월 초',
    ],
    bestMonths: [4, 5, 6, 7, 8],
    currency: 'EUR',
    language: '네덜란드어·영어',
    timeZone: 'UTC+1',
    flightHours: '12시간',
  },
];

export interface TravelTip {
  id: string;
  category: 'flight' | 'accommodation' | 'payment' | 'packing' | 'safety' | 'culture';
  icon: string;
  title: string;
  summary: string;
  details: string[];
}

export const TRAVEL_TIPS: TravelTip[] = [
  {
    id: 'flight-booking',
    category: 'flight',
    icon: '✈️',
    title: '항공권 예약 팁',
    summary: '화요일 새벽이 가장 저렴해요',
    details: [
      '항공사마다 가격 조정 시간이 달라요. 화요일 오전 3~5시 한국 시간이 평균적으로 가장 저렴해요.',
      '출발 6~8주 전 예약이 가장 좋은 가격대 (성수기는 3~4개월 전).',
      '구글 플라이트, 스카이스캐너 가격 알림 설정 추천.',
      '주중 출발 + 주중 도착이 주말보다 저렴.',
      '경유 항공권이 직항보다 30~40% 저렴한 경우 많음.',
    ],
  },
  {
    id: 'currency',
    category: 'payment',
    icon: '💱',
    title: '환전 똑똑하게',
    summary: '트래블월렛 vs 현금 vs 카드',
    details: [
      '트래블월렛: 실시간 환율 + 수수료 낮음. 많은 국가 지원.',
      '하나 트래블로그: 무제한 수수료 면제. 간단한 발급.',
      '소액은 국내 은행 환전 우대쿠폰 활용.',
      '공항 환전은 수수료가 3~5% 높으니 피하기.',
      '유럽/미국은 대부분 카드 결제 가능, 팁 문화 주의.',
    ],
  },
  {
    id: 'accommodation',
    category: 'accommodation',
    icon: '🏨',
    title: '숙소 선택 팁',
    summary: '예산에 맞는 숙소 찾기',
    details: [
      '가격 비교: 호텔스닷컴, 아고다, 부킹닷컴 교차 비교.',
      '에어비앤비는 장기 체류나 현지 체험형에 유리.',
      '위치가 가격보다 중요 (교통비 + 시간 절약).',
      '리뷰 100개 이상 + 평점 8.0 이상 기준 추천.',
      '조식 포함 여부 체크 (아침 외식비 절약).',
    ],
  },
  {
    id: 'packing',
    category: 'packing',
    icon: '🧳',
    title: '짐 싸기 체크리스트',
    summary: '필수품 빠트리지 않기',
    details: [
      '여권은 유효기간 6개월 이상 남아야 입국 가능한 나라 많음.',
      '비상약: 감기약, 지사제, 밴드, 소화제, 진통제.',
      '변환 플러그 + 멀티 충전기 필수.',
      '세면도구는 100ml 이하 투명 용기 (기내 반입용).',
      '복사본: 여권, 보험증, 예약 확인서 따로 보관.',
    ],
  },
  {
    id: 'safety',
    category: 'safety',
    icon: '🛡️',
    title: '안전 여행 수칙',
    summary: '사고/도난 예방',
    details: [
      '여행자 보험 가입 (의료비 + 도난 보장).',
      '현금과 카드 나눠서 보관. 복사본 클라우드에 백업.',
      '관광지에서 휴대폰 가방 앞쪽 지퍼.',
      '영사콜센터 +82-2-3210-0404 저장.',
      '숙소 금고에 여권 보관, 외출 시 사본 지참.',
    ],
  },
  {
    id: 'culture',
    category: 'culture',
    icon: '🌏',
    title: '문화 차이 알아두기',
    summary: '현지에서 실수하지 않기',
    details: [
      '일본: 팁 없음, 식당에서 조용히. 카드 안 받는 곳 많음.',
      '미국/유럽: 팁 필수 (15~20%). 눈 마주치면 인사.',
      '동남아 사원: 노출 의상 금지. 신발 벗고 입장.',
      '중동 국가: 라마단 기간 공공장소 음식 주의.',
      '유럽 식당: 물이 유료. 화장실도 유료 많음.',
    ],
  },
  {
    id: 'communication',
    category: 'culture',
    icon: '📱',
    title: '통신 & 인터넷',
    summary: '유심 vs eSIM vs 와이파이',
    details: [
      'eSIM (Airalo, Ubigi): 기기 지원 시 가장 편리.',
      '유심: 공항에서 구매. 단기 여행 저렴.',
      '포켓 와이파이: 여러 명 함께 사용 시 경제적.',
      '한국 통신사 로밍: 편하지만 요금 비쌈.',
      '구글 번역 앱 + 오프라인 사전 다운로드 추천.',
    ],
  },
  {
    id: 'visa',
    category: 'safety',
    icon: '📄',
    title: '비자 & 입국 준비',
    summary: '나라별 입국 요건',
    details: [
      '한국 여권: 190+ 개국 무비자 (90일 이내 체류).',
      '미국: ESTA 사전 신청 (21달러, 2년 유효).',
      '캐나다: eTA 사전 신청 (7캐나다달러).',
      '영국: 2025년부터 ETA 도입.',
      '호주: ETA/eVisitor 사전 신청.',
      '입국 시 왕복 티켓 + 호텔 예약증 필요한 경우 있음.',
    ],
  },
];

export const TIP_CATEGORIES = [
  { key: 'flight', label: '항공권', icon: '✈️' },
  { key: 'accommodation', label: '숙소', icon: '🏨' },
  { key: 'payment', label: '결제', icon: '💳' },
  { key: 'packing', label: '짐싸기', icon: '🧳' },
  { key: 'safety', label: '안전', icon: '🛡️' },
  { key: 'culture', label: '문화', icon: '🌏' },
];

export const SEASON_INFO: Record<Season, { label: string; months: number[]; icon: string }> = {
  spring: { label: '봄', months: [3, 4, 5], icon: '🌸' },
  summer: { label: '여름', months: [6, 7, 8], icon: '☀️' },
  autumn: { label: '가을', months: [9, 10, 11], icon: '🍁' },
  winter: { label: '겨울', months: [12, 1, 2], icon: '❄️' },
};

export function getCurrentSeason(): Season {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}
