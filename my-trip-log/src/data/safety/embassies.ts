/**
 * 도시별 대한민국 대사관 / 영사관 (정적 데이터)
 *
 * 사용처:
 *  - 도구 탭 → 여행 안전 → 대사관/영사관
 *  - 트립 진행 중 빠르게 위치 확인
 *
 * 출처:
 *  - 외교부 재외공관 정보 (수동 큐레이션)
 *  - 한국인 자주 방문 도시 15개 우선 (1.2 출시 시점)
 *  - 1.3 에서 외교부 API 로 자동 확장 예정
 *
 * 좌표 정확도: 구글맵 검색 기준 (오차 ~50m 이내)
 */
import type { Embassy } from './types';

export const EMBASSIES: Embassy[] = [
  // ── 일본 ──
  {
    id: 'embassy_jp_tokyo',
    countryCode: 'JP',
    cityName: '도쿄',
    type: 'embassy',
    nameKo: '주일본 대한민국 대사관',
    nameLocal: '駐日本国大韓民国大使館',
    address: '東京都港区南麻布1-2-5',
    phone: '+81-3-3452-7611',
    phoneEmergency: '+81-90-1693-5773',
    email: 'tokyo@mofa.go.kr',
    hours: '평일 09:00~16:30 (점심 12:00~13:30 제외)',
    latitude: 35.6510,
    longitude: 139.7340,
  },
  {
    id: 'consulate_jp_osaka',
    countryCode: 'JP',
    cityName: '오사카',
    type: 'consulate',
    nameKo: '주오사카 대한민국 총영사관',
    nameLocal: '駐大阪大韓民国総領事館',
    address: '大阪府大阪市中央区西心斎橋2-3-4',
    phone: '+81-6-4256-2345',
    phoneEmergency: '+81-90-3050-0746',
    hours: '평일 09:00~16:30 (점심 12:00~13:30 제외)',
    latitude: 34.6720,
    longitude: 135.4990,
  },
  {
    id: 'consulate_jp_fukuoka',
    countryCode: 'JP',
    cityName: '후쿠오카',
    type: 'consulate',
    nameKo: '주후쿠오카 대한민국 총영사관',
    address: '福岡県福岡市中央区地行浜1-1-3',
    phone: '+81-92-771-0461',
    phoneEmergency: '+81-90-9486-9760',
    hours: '평일 09:00~17:30',
    latitude: 33.5946,
    longitude: 130.3592,
  },

  // ── 중국 ──
  {
    id: 'embassy_cn_beijing',
    countryCode: 'CN',
    cityName: '베이징',
    type: 'embassy',
    nameKo: '주중국 대한민국 대사관',
    address: '北京市朝阳区东方东路20号',
    phone: '+86-10-8531-0700',
    phoneEmergency: '+86-186-1173-0089',
    hours: '평일 09:00~17:30',
    latitude: 39.9579,
    longitude: 116.4595,
  },
  {
    id: 'consulate_cn_shanghai',
    countryCode: 'CN',
    cityName: '상하이',
    type: 'consulate',
    nameKo: '주상하이 대한민국 총영사관',
    address: '上海市长宁区万山路60号',
    phone: '+86-21-6295-5000',
    phoneEmergency: '+86-138-1755-7575',
    hours: '평일 09:00~17:00',
    latitude: 31.2160,
    longitude: 121.4170,
  },

  // ── 대만 ──
  {
    id: 'representation_tw_taipei',
    countryCode: 'TW',
    cityName: '타이베이',
    type: 'consular_agency',
    nameKo: '주타이베이 대한민국 대표부',
    address: '台北市基隆路一段333號 15樓 (世貿大樓)',
    phone: '+886-2-2758-8320',
    phoneEmergency: '+886-910-204-159',
    hours: '평일 09:00~16:00',
    latitude: 25.0331,
    longitude: 121.5654,
  },

  // ── 동남아 ──
  {
    id: 'embassy_th_bangkok',
    countryCode: 'TH',
    cityName: '방콕',
    type: 'embassy',
    nameKo: '주태국 대한민국 대사관',
    address: '23 Thiam-Ruammit Road, Ratchadaphisek, Huai Khwang, Bangkok 10310',
    phone: '+66-2-247-7537',
    phoneEmergency: '+66-81-914-5803',
    hours: '평일 08:30~16:30',
    latitude: 13.7873,
    longitude: 100.5760,
  },
  {
    id: 'embassy_vn_hanoi',
    countryCode: 'VN',
    cityName: '하노이',
    type: 'embassy',
    nameKo: '주베트남 대한민국 대사관',
    address: 'SQ4 Diplomatic Compound, Do Nhuan Street, Xuan Tao, Bac Tu Liem, Hanoi',
    phone: '+84-24-3831-5111',
    phoneEmergency: '+84-90-402-6126',
    hours: '평일 08:30~17:30',
    latitude: 21.0696,
    longitude: 105.7886,
  },
  {
    id: 'consulate_vn_hochiminh',
    countryCode: 'VN',
    cityName: '호치민',
    type: 'consulate',
    nameKo: '주호치민 대한민국 총영사관',
    address: '107 Nguyen Du Street, Ben Thanh Ward, District 1, HCMC',
    phone: '+84-28-3822-5757',
    phoneEmergency: '+84-93-850-0238',
    hours: '평일 08:30~17:30',
    latitude: 10.7773,
    longitude: 106.6952,
  },
  {
    id: 'embassy_sg_singapore',
    countryCode: 'SG',
    cityName: '싱가포르',
    type: 'embassy',
    nameKo: '주싱가포르 대한민국 대사관',
    address: '47 Scotts Road, #16-03/04 Goldbell Towers, Singapore 228233',
    phone: '+65-6256-1188',
    phoneEmergency: '+65-9654-3528',
    hours: '평일 09:00~17:30',
    latitude: 1.3076,
    longitude: 103.8347,
  },
  {
    id: 'embassy_ph_manila',
    countryCode: 'PH',
    cityName: '마닐라',
    type: 'embassy',
    nameKo: '주필리핀 대한민국 대사관',
    address: '122 Upper McKinley Road, McKinley Hill, Taguig City',
    phone: '+63-2-7-856-9210',
    phoneEmergency: '+63-917-817-5703',
    hours: '평일 08:30~17:30',
    latitude: 14.5460,
    longitude: 121.0470,
  },
  {
    id: 'embassy_my_kualalumpur',
    countryCode: 'MY',
    cityName: '쿠알라룸푸르',
    type: 'embassy',
    nameKo: '주말레이시아 대한민국 대사관',
    address: 'No.9 & 11, Jalan Nipah, off Jalan Ampang, 55000 Kuala Lumpur',
    phone: '+60-3-4251-2336',
    phoneEmergency: '+60-19-383-3328',
    hours: '평일 08:30~17:30',
    latitude: 3.1645,
    longitude: 101.7421,
  },
  {
    id: 'embassy_id_jakarta',
    countryCode: 'ID',
    cityName: '자카르타',
    type: 'embassy',
    nameKo: '주인도네시아 대한민국 대사관',
    address: 'Jalan Gatot Subroto Kav. 57, Jakarta Selatan 12950',
    phone: '+62-21-2967-2555',
    phoneEmergency: '+62-811-852-446',
    hours: '평일 08:30~17:30',
    latitude: -6.2342,
    longitude: 106.8175,
  },

  // ── 유럽 ──
  {
    id: 'embassy_gb_london',
    countryCode: 'GB',
    cityName: '런던',
    type: 'embassy',
    nameKo: '주영국 대한민국 대사관',
    address: '60 Buckingham Gate, London SW1E 6AJ',
    phone: '+44-20-7227-5500',
    phoneEmergency: '+44-78-7650-6895',
    hours: '평일 09:00~17:00',
    latitude: 51.5008,
    longitude: -0.1395,
  },
  {
    id: 'embassy_fr_paris',
    countryCode: 'FR',
    cityName: '파리',
    type: 'embassy',
    nameKo: '주프랑스 대한민국 대사관',
    address: '125 Rue de Grenelle, 75007 Paris',
    phone: '+33-1-4753-0101',
    phoneEmergency: '+33-6-8028-5396',
    hours: '평일 09:30~12:30, 14:30~17:00',
    latitude: 48.8566,
    longitude: 2.3110,
  },
  {
    id: 'embassy_de_berlin',
    countryCode: 'DE',
    cityName: '베를린',
    type: 'embassy',
    nameKo: '주독일 대한민국 대사관',
    address: 'Stülerstraße 8-10, 10787 Berlin',
    phone: '+49-30-260-650',
    phoneEmergency: '+49-160-9605-5739',
    hours: '평일 09:00~12:00, 13:30~16:30',
    latitude: 52.5119,
    longitude: 13.3447,
  },
  {
    id: 'embassy_es_madrid',
    countryCode: 'ES',
    cityName: '마드리드',
    type: 'embassy',
    nameKo: '주스페인 대한민국 대사관',
    address: 'Calle González Amigó, 15, 28033 Madrid',
    phone: '+34-91-353-2000',
    phoneEmergency: '+34-648-924-695',
    hours: '평일 09:00~14:00, 15:00~17:30',
    latitude: 40.4736,
    longitude: -3.6464,
  },
  {
    id: 'embassy_it_rome',
    countryCode: 'IT',
    cityName: '로마',
    type: 'embassy',
    nameKo: '주이탈리아 대한민국 대사관',
    address: 'Via Barnaba Oriani, 30, 00197 Roma',
    phone: '+39-06-802-461',
    phoneEmergency: '+39-348-885-1979',
    hours: '평일 09:00~12:00, 14:30~16:30',
    latitude: 41.9217,
    longitude: 12.4789,
  },

  // ── 북미 ──
  {
    id: 'embassy_us_washington',
    countryCode: 'US',
    cityName: '워싱턴 DC',
    type: 'embassy',
    nameKo: '주미국 대한민국 대사관',
    address: '2450 Massachusetts Avenue NW, Washington DC 20008',
    phone: '+1-202-939-5600',
    phoneEmergency: '+1-202-641-8730',
    hours: '평일 09:00~17:30',
    latitude: 38.9176,
    longitude: -77.0610,
  },
  {
    id: 'consulate_us_newyork',
    countryCode: 'US',
    cityName: '뉴욕',
    type: 'consulate',
    nameKo: '주뉴욕 대한민국 총영사관',
    address: '460 Park Avenue (6th fl), New York, NY 10022',
    phone: '+1-646-674-6000',
    phoneEmergency: '+1-646-965-3639',
    hours: '평일 09:00~16:30',
    latitude: 40.7611,
    longitude: -73.9716,
  },
  {
    id: 'consulate_us_losangeles',
    countryCode: 'US',
    cityName: 'LA (로스앤젤레스)',
    type: 'consulate',
    nameKo: '주로스앤젤레스 대한민국 총영사관',
    address: '3243 Wilshire Boulevard, Los Angeles, CA 90010',
    phone: '+1-213-385-9300',
    phoneEmergency: '+1-213-700-1147',
    hours: '평일 09:00~16:30',
    latitude: 34.0613,
    longitude: -118.3104,
  },

  // ── 호주 ──
  {
    id: 'embassy_au_canberra',
    countryCode: 'AU',
    cityName: '캔버라',
    type: 'embassy',
    nameKo: '주호주 대한민국 대사관',
    address: '113 Empire Circuit, Yarralumla ACT 2600',
    phone: '+61-2-6270-4100',
    phoneEmergency: '+61-408-815-922',
    hours: '평일 09:00~12:30, 13:30~17:30',
    latitude: -35.3061,
    longitude: 149.1086,
  },
  {
    id: 'consulate_au_sydney',
    countryCode: 'AU',
    cityName: '시드니',
    type: 'consulate',
    nameKo: '주시드니 대한민국 총영사관',
    address: 'Level 10, Tower A, 821 Pacific Highway, Chatswood NSW 2067',
    phone: '+61-2-9210-0200',
    phoneEmergency: '+61-403-546-058',
    hours: '평일 09:00~12:30, 14:00~17:00',
    latitude: -33.7969,
    longitude: 151.1830,
  },

  // ── 중동 ──
  {
    id: 'embassy_ae_abudhabi',
    countryCode: 'AE',
    cityName: '아부다비',
    type: 'embassy',
    nameKo: '주아랍에미리트 대한민국 대사관',
    address: 'Al Bateen Area, W-37, Plot 21, Sector 5, Abu Dhabi',
    phone: '+971-2-441-1520',
    phoneEmergency: '+971-50-414-1620',
    hours: '평일 08:30~16:30 (일~목)',
    latitude: 24.4316,
    longitude: 54.3470,
  },
  {
    id: 'embassy_tr_ankara',
    countryCode: 'TR',
    cityName: '앙카라',
    type: 'embassy',
    nameKo: '주튀르키예 대한민국 대사관',
    address: 'Çankaya, Alaçam Sokak No.5, 06550 Ankara',
    phone: '+90-312-468-4822',
    phoneEmergency: '+90-533-743-1239',
    hours: '평일 09:00~12:30, 14:00~17:30',
    latitude: 39.8881,
    longitude: 32.8519,
  },
];

/**
 * 국가 코드로 모든 공관 조회 (대사관 + 영사관)
 */
export function getEmbassiesByCountry(countryCode: string): Embassy[] {
  return EMBASSIES.filter((e) => e.countryCode === countryCode.toUpperCase());
}

/**
 * 도시 이름 (부분 일치) 로 공관 검색
 */
export function searchEmbassyByCity(cityName: string): Embassy[] {
  const q = cityName.toLowerCase();
  return EMBASSIES.filter((e) => e.cityName.toLowerCase().includes(q));
}

/**
 * 사용자 위치 (lat, lng) 기준 가장 가까운 공관 N 개
 */
export function findNearestEmbassies(
  lat: number,
  lng: number,
  countryCode?: string,
  limit = 3,
): (Embassy & { distanceKm: number })[] {
  const candidates = countryCode ? getEmbassiesByCountry(countryCode) : EMBASSIES;
  return candidates
    .map((e) => ({
      ...e,
      distanceKm: haversineDistance(lat, lng, e.latitude, e.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

/**
 * Haversine — 두 좌표 사이 거리 (km)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 지구 반지름 km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
