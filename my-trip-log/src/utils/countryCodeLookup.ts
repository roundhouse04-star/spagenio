/**
 * 도시/국가 → ISO 2자리 국가 코드 자동 추론
 *
 * 사용처:
 *  - trips/new.tsx 트립 생성/수정 시 country_code 자동 채우기
 *  - 1.2 안전 기능 (외교부 매칭, 위험 region geofencing) 활성화의 핵심 의존
 *
 * 우선순위:
 *  1. cityId 있으면 CITY_TO_ISO 매핑
 *  2. city 텍스트가 CITY_ALIASES alias 와 매칭되면 그 cityId 의 ISO
 *  3. country 텍스트가 KO_COUNTRY_TO_ISO 와 매칭되면 그 ISO
 *  4. 못 찾으면 null
 */
import { CITY_ALIASES } from '@/data/cityHighlights';

// cityHighlights 에 등록된 모든 도시의 ISO 2자리 매핑
export const CITY_TO_ISO: Record<string, string> = {
  // 동아시아
  seoul: 'KR',
  tokyo: 'JP', osaka: 'JP', fukuoka: 'JP', okinawa: 'JP', sapporo: 'JP', kyoto: 'JP',
  taipei: 'TW',
  hongkong: 'HK',
  shanghai: 'CN', qingdao: 'CN', beijing: 'CN',
  busan: 'KR',

  // 동남아
  bangkok: 'TH', phuket: 'TH', chiangmai: 'TH',
  danang: 'VN', nhatrang: 'VN', hochiminh: 'VN', hanoi: 'VN',
  cebu: 'PH', boracay: 'PH', manila: 'PH',
  bali: 'ID', jakarta: 'ID',
  singapore: 'SG',
  kualalumpur: 'MY', kotakinabalu: 'MY',

  // 유럽
  paris: 'FR', london: 'GB', rome: 'IT', milan: 'IT',
  barcelona: 'ES', madrid: 'ES',
  berlin: 'DE', vienna: 'AT', prague: 'CZ',
  amsterdam: 'NL',
  istanbul: 'TR', antalya: 'TR',

  // 미주
  newyork: 'US', losangeles: 'US', lasvegas: 'US', honolulu: 'US',
  cancun: 'MX',
  guam: 'GU',

  // 중동·아프리카
  dubai: 'AE',
  cairo: 'EG',
  mecca: 'SA',

  // 오세아니아
  sydney: 'AU',
};

// 한글/영문 국가명 → ISO 2자리 (자유 입력 백업)
export const KO_COUNTRY_TO_ISO: Record<string, string> = {
  // 동아시아
  '한국': 'KR', '대한민국': 'KR', 'korea': 'KR', 'south korea': 'KR',
  '일본': 'JP', 'japan': 'JP',
  '중국': 'CN', 'china': 'CN',
  '대만': 'TW', 'taiwan': 'TW',
  '홍콩': 'HK', 'hong kong': 'HK', 'hongkong': 'HK',
  '몽골': 'MN', 'mongolia': 'MN',

  // 동남아
  '태국': 'TH', 'thailand': 'TH',
  '베트남': 'VN', 'vietnam': 'VN',
  '필리핀': 'PH', 'philippines': 'PH',
  '인도네시아': 'ID', 'indonesia': 'ID',
  '싱가포르': 'SG', 'singapore': 'SG',
  '말레이시아': 'MY', 'malaysia': 'MY',
  '캄보디아': 'KH', 'cambodia': 'KH',
  '라오스': 'LA', 'laos': 'LA',
  '미얀마': 'MM', 'myanmar': 'MM',

  // 남아시아
  '인도': 'IN', 'india': 'IN',
  '파키스탄': 'PK', 'pakistan': 'PK',
  '네팔': 'NP', 'nepal': 'NP',
  '스리랑카': 'LK', 'sri lanka': 'LK',
  '몰디브': 'MV', 'maldives': 'MV',
  '방글라데시': 'BD', 'bangladesh': 'BD',

  // 유럽
  '영국': 'GB', 'uk': 'GB', 'united kingdom': 'GB', 'britain': 'GB', 'england': 'GB',
  '프랑스': 'FR', 'france': 'FR',
  '독일': 'DE', 'germany': 'DE',
  '이탈리아': 'IT', 'italy': 'IT',
  '스페인': 'ES', 'spain': 'ES',
  '포르투갈': 'PT', 'portugal': 'PT',
  '네덜란드': 'NL', 'netherlands': 'NL', 'holland': 'NL',
  '벨기에': 'BE', 'belgium': 'BE',
  '스위스': 'CH', 'switzerland': 'CH',
  '오스트리아': 'AT', 'austria': 'AT',
  '체코': 'CZ', 'czech': 'CZ',
  '헝가리': 'HU', 'hungary': 'HU',
  '폴란드': 'PL', 'poland': 'PL',
  '그리스': 'GR', 'greece': 'GR',
  '스웨덴': 'SE', 'sweden': 'SE',
  '노르웨이': 'NO', 'norway': 'NO',
  '덴마크': 'DK', 'denmark': 'DK',
  '핀란드': 'FI', 'finland': 'FI',
  '아이슬란드': 'IS', 'iceland': 'IS',
  '아일랜드': 'IE', 'ireland': 'IE',
  '러시아': 'RU', 'russia': 'RU',
  '우크라이나': 'UA', 'ukraine': 'UA',
  '튀르키예': 'TR', '터키': 'TR', 'turkey': 'TR', 'türkiye': 'TR',

  // 미주
  '미국': 'US', 'usa': 'US', 'united states': 'US', 'america': 'US',
  '캐나다': 'CA', 'canada': 'CA',
  '멕시코': 'MX', 'mexico': 'MX',
  '브라질': 'BR', 'brazil': 'BR',
  '아르헨티나': 'AR', 'argentina': 'AR',
  '칠레': 'CL', 'chile': 'CL',
  '페루': 'PE', 'peru': 'PE',
  '콜롬비아': 'CO', 'colombia': 'CO',
  '베네수엘라': 'VE', 'venezuela': 'VE',
  '쿠바': 'CU', 'cuba': 'CU',

  // 오세아니아
  '호주': 'AU', 'australia': 'AU',
  '뉴질랜드': 'NZ', 'new zealand': 'NZ',
  '괌': 'GU', 'guam': 'GU',
  '사이판': 'MP', 'saipan': 'MP',
  '피지': 'FJ', 'fiji': 'FJ',

  // 중동·아프리카
  'uae': 'AE', '아랍에미리트': 'AE', 'dubai': 'AE',
  '사우디': 'SA', '사우디아라비아': 'SA', 'saudi arabia': 'SA',
  '카타르': 'QA', 'qatar': 'QA',
  '이집트': 'EG', 'egypt': 'EG',
  '모로코': 'MA', 'morocco': 'MA',
  '남아공': 'ZA', 'south africa': 'ZA',
  '케냐': 'KE', 'kenya': 'KE',
  '이스라엘': 'IL', 'israel': 'IL',
  '요르단': 'JO', 'jordan': 'JO',
};

/**
 * cityId / city / country 입력에서 ISO 2자리 추출.
 * 못 찾으면 null.
 */
export function inferCountryCode(input: {
  cityId?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  // 1순위: cityId 직접 매핑
  if (input.cityId && CITY_TO_ISO[input.cityId]) {
    return CITY_TO_ISO[input.cityId];
  }

  // 2순위: city 텍스트 → CITY_ALIASES → cityId → ISO
  if (input.city) {
    const q = input.city.trim().toLowerCase();
    if (q) {
      for (const [cityId, meta] of Object.entries(CITY_ALIASES)) {
        if (meta.aliases.some((a) => a.toLowerCase() === q || q.includes(a.toLowerCase()) || a.toLowerCase().includes(q))) {
          const iso = CITY_TO_ISO[cityId];
          if (iso) return iso;
        }
      }
    }
  }

  // 3순위: country 텍스트 → KO_COUNTRY_TO_ISO
  if (input.country) {
    const q = input.country.trim().toLowerCase();
    if (q && KO_COUNTRY_TO_ISO[q]) return KO_COUNTRY_TO_ISO[q];
    // 부분 매칭 (예: "일본 도쿄" → "일본" 추출)
    for (const [name, iso] of Object.entries(KO_COUNTRY_TO_ISO)) {
      if (q.includes(name.toLowerCase())) return iso;
    }
  }

  return null;
}
