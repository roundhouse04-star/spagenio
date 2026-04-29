/**
 * City Highlights — 도시별 추천 장소 데이터
 *
 * 일정 추가(item-new) 화면의 "🌟 추천 장소에서 고르기" 기능에서 사용.
 * 여행에 등록된 도시(trip.city/country)를 fuzzy 매칭해 해당 도시 하이라이트만 노출.
 *
 * 데이터 출처: Google·Tripadvisor·Michelin Guide·여행 매체 (2024–2026 기준)
 * 총 46개 도시 × 평균 10개 = 약 460개 항목
 */

// ============ 타입 ============

export type HighlightCategory =
  | 'attraction'   // 🏛 명소/랜드마크
  | 'food'         // 🍽 음식점/먹거리
  | 'museum'       // 🖼 박물관/미술관
  | 'shopping'     // 🛍 쇼핑/시장
  | 'experience'   // 🎢 체험/액티비티
  | 'nature';      // 🌳 자연/공원/해변

export type HighlightTag =
  | 'classic'      // 클래식
  | 'trending'     // 최근 SNS·미디어 트렌드
  | 'local'        // 현지인 추천
  | 'photogenic'   // 사진 명소
  | 'michelin'     // 미슐랭/파인다이닝
  | 'budget'       // 가성비
  | 'family'       // 가족여행
  | 'night'        // 야경
  | 'hidden'       // 숨은 명소
  | 'beach';       // 해변

export interface CityHighlight {
  cityId: string;
  category: HighlightCategory;
  name: string;
  nameLocal?: string;
  area?: string;
  description: string;
  tags: HighlightTag[];
}

export const HIGHLIGHT_CATEGORIES = [
  { key: 'attraction' as HighlightCategory, label: '명소', icon: '🏛' },
  { key: 'food'       as HighlightCategory, label: '음식', icon: '🍽' },
  { key: 'museum'     as HighlightCategory, label: '박물관', icon: '🖼' },
  { key: 'shopping'   as HighlightCategory, label: '쇼핑', icon: '🛍' },
  { key: 'experience' as HighlightCategory, label: '체험', icon: '🎢' },
  { key: 'nature'     as HighlightCategory, label: '자연', icon: '🌳' },
] as const;

// ============ 도시 별칭 (fuzzy 매칭용) ============
/**
 * trip.city 또는 trip.country 가 자유 입력이라
 * 부분 일치(includes) 검색을 위한 alias 목록.
 * 한글 / 영문 / 현지명 / 약어 모두 등록.
 */
export const CITY_ALIASES: Record<string, { name: string; flag: string; aliases: string[] }> = {
  // 동아시아
  seoul: { name: '서울', flag: '🇰🇷', aliases: ['서울', 'seoul', 'korea', '한국', '대한민국'] },
  tokyo: { name: '도쿄', flag: '🇯🇵', aliases: ['도쿄', 'tokyo', '東京', '동경', 'japan', '일본'] },
  osaka: { name: '오사카', flag: '🇯🇵', aliases: ['오사카', 'osaka', '大阪'] },
  fukuoka: { name: '후쿠오카', flag: '🇯🇵', aliases: ['후쿠오카', 'fukuoka', '福岡'] },
  okinawa: { name: '오키나와', flag: '🇯🇵', aliases: ['오키나와', 'okinawa', '沖縄', '나하', 'naha'] },
  sapporo: { name: '삿포로', flag: '🇯🇵', aliases: ['삿포로', 'sapporo', '札幌', '홋카이도', 'hokkaido'] },
  kyoto: { name: '교토', flag: '🇯🇵', aliases: ['교토', 'kyoto', '京都'] },
  taipei: { name: '타이베이', flag: '🇹🇼', aliases: ['타이베이', 'taipei', '台北', '대만', 'taiwan'] },
  hongkong: { name: '홍콩', flag: '🇭🇰', aliases: ['홍콩', 'hongkong', 'hong kong', '香港'] },
  shanghai: { name: '상하이', flag: '🇨🇳', aliases: ['상하이', 'shanghai', '上海'] },
  qingdao: { name: '칭다오', flag: '🇨🇳', aliases: ['칭다오', 'qingdao', '青島'] },
  // 동남아
  bangkok: { name: '방콕', flag: '🇹🇭', aliases: ['방콕', 'bangkok', '태국', 'thailand'] },
  phuket: { name: '푸켓', flag: '🇹🇭', aliases: ['푸켓', 'phuket', '푸껫'] },
  chiangmai: { name: '치앙마이', flag: '🇹🇭', aliases: ['치앙마이', 'chiang mai', 'chiangmai'] },
  danang: { name: '다낭', flag: '🇻🇳', aliases: ['다낭', 'danang', 'da nang', '베트남', 'vietnam'] },
  nhatrang: { name: '나트랑', flag: '🇻🇳', aliases: ['나트랑', 'nha trang', 'nhatrang'] },
  hochiminh: { name: '호치민', flag: '🇻🇳', aliases: ['호치민', 'ho chi minh', 'hochiminh', '사이공', 'saigon'] },
  cebu: { name: '세부', flag: '🇵🇭', aliases: ['세부', 'cebu', '필리핀', 'philippines'] },
  boracay: { name: '보라카이', flag: '🇵🇭', aliases: ['보라카이', 'boracay'] },
  manila: { name: '마닐라', flag: '🇵🇭', aliases: ['마닐라', 'manila'] },
  bali: { name: '발리', flag: '🇮🇩', aliases: ['발리', 'bali', 'denpasar', '덴파사르', 'indonesia', '인도네시아'] },
  singapore: { name: '싱가포르', flag: '🇸🇬', aliases: ['싱가포르', 'singapore'] },
  kualalumpur: { name: '쿠알라룸푸르', flag: '🇲🇾', aliases: ['쿠알라룸푸르', 'kuala lumpur', 'kualalumpur', 'kl', '말레이시아', 'malaysia'] },
  kotakinabalu: { name: '코타키나발루', flag: '🇲🇾', aliases: ['코타키나발루', 'kota kinabalu', 'kotakinabalu', 'kk'] },
  // 유럽
  paris: { name: '파리', flag: '🇫🇷', aliases: ['파리', 'paris', '프랑스', 'france'] },
  london: { name: '런던', flag: '🇬🇧', aliases: ['런던', 'london', '영국', 'uk', 'england'] },
  rome: { name: '로마', flag: '🇮🇹', aliases: ['로마', 'rome', 'roma', '이탈리아', 'italy'] },
  barcelona: { name: '바르셀로나', flag: '🇪🇸', aliases: ['바르셀로나', 'barcelona', '스페인', 'spain'] },
  madrid: { name: '마드리드', flag: '🇪🇸', aliases: ['마드리드', 'madrid'] },
  milan: { name: '밀라노', flag: '🇮🇹', aliases: ['밀라노', 'milan', 'milano'] },
  berlin: { name: '베를린', flag: '🇩🇪', aliases: ['베를린', 'berlin', '독일', 'germany'] },
  vienna: { name: '비엔나', flag: '🇦🇹', aliases: ['비엔나', 'vienna', 'wien', '빈', '오스트리아', 'austria'] },
  prague: { name: '프라하', flag: '🇨🇿', aliases: ['프라하', 'prague', 'praha', '체코', 'czech'] },
  amsterdam: { name: '암스테르담', flag: '🇳🇱', aliases: ['암스테르담', 'amsterdam', '네덜란드', 'netherlands'] },
  istanbul: { name: '이스탄불', flag: '🇹🇷', aliases: ['이스탄불', 'istanbul', '터키', '튀르키예', 'turkey'] },
  antalya: { name: '안탈리아', flag: '🇹🇷', aliases: ['안탈리아', 'antalya'] },
  // 미주·중동·오세아니아·아프리카
  newyork: { name: '뉴욕', flag: '🇺🇸', aliases: ['뉴욕', 'new york', 'newyork', 'nyc', 'ny'] },
  losangeles: { name: '로스앤젤레스', flag: '🇺🇸', aliases: ['로스앤젤레스', '엘에이', 'los angeles', 'losangeles', 'la'] },
  lasvegas: { name: '라스베가스', flag: '🇺🇸', aliases: ['라스베가스', 'las vegas', 'lasvegas', 'vegas'] },
  cancun: { name: '칸쿤', flag: '🇲🇽', aliases: ['칸쿤', 'cancun', 'cancún', '멕시코', 'mexico'] },
  honolulu: { name: '호놀룰루', flag: '🇺🇸', aliases: ['호놀룰루', 'honolulu', '하와이', 'hawaii', 'oahu', '와이키키'] },
  guam: { name: '괌', flag: '🇬🇺', aliases: ['괌', 'guam'] },
  dubai: { name: '두바이', flag: '🇦🇪', aliases: ['두바이', 'dubai', 'uae'] },
  sydney: { name: '시드니', flag: '🇦🇺', aliases: ['시드니', 'sydney', '호주', 'australia'] },
  cairo: { name: '카이로', flag: '🇪🇬', aliases: ['카이로', 'cairo', '이집트', 'egypt'] },
  mecca: { name: '메카', flag: '🇸🇦', aliases: ['메카', 'mecca', 'makkah', '사우디', 'saudi'] },
};

// ============ 헬퍼 ============

/**
 * trip.city 또는 trip.country 같은 자유 입력 텍스트를 cityId로 매칭.
 * includes 기반이라 "도쿄 (시부야)" "Tokyo, Japan" 같은 변형도 대응.
 *
 * @returns 매칭된 cityId, 못 찾으면 null
 */
export function findCityIdByName(input: string | null | undefined): string | null {
  if (!input) return null;
  const norm = input.trim().toLowerCase();
  if (!norm) return null;
  for (const [id, info] of Object.entries(CITY_ALIASES)) {
    for (const alias of info.aliases) {
      if (norm.includes(alias.toLowerCase())) return id;
    }
  }
  return null;
}

/**
 * Trip 객체로부터 cityId 추출.
 * 우선순위: trip.cityId(명시 저장) > trip.city(includes 매칭) > trip.country(fallback)
 */
export function findCityIdFromTrip(trip: {
  cityId?: string | null;
  city?: string | null;
  country?: string | null;
}): string | null {
  // 1. 명시 저장된 cityId가 alias 테이블에 존재하면 그대로 사용 (가장 신뢰)
  if (trip.cityId && CITY_ALIASES[trip.cityId]) return trip.cityId;
  // 2. 자유 입력 city/country 텍스트로 fuzzy 매칭
  return findCityIdByName(trip.city) ?? findCityIdByName(trip.country);
}

/** cityId의 표시명 (한글) 반환 */
export function getCityDisplayName(cityId: string): string {
  return CITY_ALIASES[cityId]?.name ?? cityId;
}

/** cityId의 국기 이모지 반환 */
export function getCityFlag(cityId: string): string {
  return CITY_ALIASES[cityId]?.flag ?? '🌍';
}

/** 특정 도시의 하이라이트 목록 */
export function getHighlightsByCity(cityId: string): CityHighlight[] {
  return CITY_HIGHLIGHTS.filter(h => h.cityId === cityId);
}

/** HighlightCategory → TripItemCategory 매핑 (item-new 자동 채움용) */
export function highlightCategoryToTripItemCategory(
  cat: HighlightCategory,
): 'sightseeing' | 'food' | 'shopping' | 'activity' {
  switch (cat) {
    case 'food': return 'food';
    case 'shopping': return 'shopping';
    case 'experience': return 'activity';
    case 'attraction':
    case 'museum':
    case 'nature':
    default: return 'sightseeing';
  }
}

// ============ 데이터 (460항목) ============

export const CITY_HIGHLIGHTS: CityHighlight[] = [
  // ───────── 🇰🇷 서울 Seoul ─────────
  { cityId: 'seoul', category: 'attraction', name: '경복궁', nameLocal: '景福宮', area: '종로', description: '조선 정궁·수문장 교대식 명물', tags: ['classic', 'photogenic'] },
  { cityId: 'seoul', category: 'attraction', name: '북촌 한옥마을', area: '가회동', description: '한옥 골목·인생샷 명소', tags: ['classic', 'photogenic'] },
  { cityId: 'seoul', category: 'attraction', name: '롯데월드타워 서울스카이', area: '잠실', description: '555m 전망대·유리 스카이데크', tags: ['trending', 'night'] },
  { cityId: 'seoul', category: 'attraction', name: '익선동 한옥거리', area: '종로', description: '개량 한옥 카페·골목 데이트', tags: ['trending', 'photogenic'] },
  { cityId: 'seoul', category: 'food', name: '광장시장 먹자골목', area: '종로', description: '빈대떡·마약김밥 노포 성지', tags: ['classic', 'local', 'budget'] },
  { cityId: 'seoul', category: 'food', name: '금돼지식당', area: '신당동', description: '숙성 통삼겹 오겹살 핫플', tags: ['trending', 'local'] },
  { cityId: 'seoul', category: 'food', name: '밍글스', nameLocal: 'Mingles', area: '청담동', description: '한식 파인다이닝·미쉐린 3⭐', tags: ['michelin'] },
  { cityId: 'seoul', category: 'museum', name: '국립중앙박물관', area: '용산', description: '반가사유상 전시실로 SNS 역주행', tags: ['classic', 'family'] },
  { cityId: 'seoul', category: 'shopping', name: '성수동', area: '성동구', description: '팝업스토어 1번지·MZ 핫플', tags: ['trending', 'photogenic'] },
  { cityId: 'seoul', category: 'experience', name: '한강 따릉이·치맥', area: '여의도/뚝섬', description: '자전거+편의점 라면 야경 코스', tags: ['local', 'night'] },

  // ───────── 🇯🇵 도쿄 Tokyo ─────────
  { cityId: 'tokyo', category: 'attraction', name: '센소지', nameLocal: '浅草寺', area: '아사쿠사', description: '도쿄 최고(最古) 사찰·카미나리몬', tags: ['classic', 'photogenic'] },
  { cityId: 'tokyo', category: 'attraction', name: '시부야 스카이', nameLocal: 'Shibuya Sky', area: '시부야', description: '360도 옥상 전망대·교차로 부감', tags: ['trending', 'night'] },
  { cityId: 'tokyo', category: 'attraction', name: '메이지 신궁', nameLocal: '明治神宮', area: '하라주쿠', description: '도심 속 거대 숲·도리이', tags: ['classic'] },
  { cityId: 'tokyo', category: 'attraction', name: '도쿄타워', nameLocal: '東京タワー', area: '미나토', description: '빨간 철탑 야경 클래식', tags: ['classic', 'night'] },
  { cityId: 'tokyo', category: 'food', name: '츠키지 장외시장', nameLocal: '築地場外市場', area: '츠키지', description: '다마고야키·해산물 꼬치', tags: ['local', 'budget'] },
  { cityId: 'tokyo', category: 'food', name: '스시 사이토', nameLocal: '鮨さいとう', area: '롯폰기', description: '미쉐린 3⭐ 오마카세', tags: ['michelin'] },
  { cityId: 'tokyo', category: 'museum', name: 'teamLab Borderless 마야오카', nameLocal: 'teamLab Borderless', area: '아자부다이힐스', description: '2024 재개관 디지털 아트', tags: ['trending', 'photogenic'] },
  { cityId: 'tokyo', category: 'shopping', name: '시부야 파르코', nameLocal: 'Parco Shibuya', area: '시부야', description: '닌텐도/포켓몬 공식숍 집결', tags: ['trending', 'family'] },
  { cityId: 'tokyo', category: 'experience', name: '도요스 센캭쿠반라이', nameLocal: '豊洲千客万来', area: '도요스', description: '2024 개장 에도풍 미식 단지', tags: ['trending', 'local'] },
  { cityId: 'tokyo', category: 'nature', name: '신주쿠 교엔', nameLocal: '新宿御苑', area: '신주쿠', description: '벚꽃·단풍 도심 정원', tags: ['classic', 'photogenic'] },

  // ───────── 🇯🇵 오사카 Osaka ─────────
  { cityId: 'osaka', category: 'attraction', name: '오사카성', nameLocal: '大阪城', area: '오사카죠', description: '도요토미 천수각·벚꽃 명소', tags: ['classic', 'photogenic'] },
  { cityId: 'osaka', category: 'attraction', name: '도톤보리 글리코 사인', nameLocal: '道頓堀', area: '난바', description: '네온 운하·러너 간판 인증샷', tags: ['classic', 'night'] },
  { cityId: 'osaka', category: 'attraction', name: '우메다 스카이빌딩 공중정원', nameLocal: '梅田スカイビル', area: '우메다', description: '쌍둥이 빌딩 공중 전망대', tags: ['classic', 'night'] },
  { cityId: 'osaka', category: 'food', name: '쿠로몬시장', nameLocal: '黒門市場', area: '닛폰바시', description: '참치회·와규 꼬치 골목', tags: ['local', 'budget'] },
  { cityId: 'osaka', category: 'food', name: '이치란 라멘 도톤보리점', nameLocal: '一蘭 道頓堀', area: '난바', description: '1인 부스 돈코츠 라멘 본점', tags: ['classic', 'local'] },
  { cityId: 'osaka', category: 'food', name: '아지노야 오코노미야키', nameLocal: '味乃家', area: '난바', description: '줄서는 오코노미야키 노포', tags: ['local'] },
  { cityId: 'osaka', category: 'museum', name: '오사카 중지마 미술관', nameLocal: '大阪中之島美術館', area: '나카노시마', description: '2022 개관 모던 컬렉션', tags: ['trending'] },
  { cityId: 'osaka', category: 'shopping', name: '신사이바시스지', nameLocal: '心斎橋筋', area: '신사이바시', description: '600m 아케이드 쇼핑 거리', tags: ['classic'] },
  { cityId: 'osaka', category: 'experience', name: '유니버설 스튜디오 재팬', nameLocal: 'USJ', area: '코노하나', description: '닌텐도 월드·동키콩 컨트리', tags: ['trending', 'family'] },
  { cityId: 'osaka', category: 'nature', name: '엑스포 70 기념공원', nameLocal: '万博記念公園', area: '스이타', description: '태양의 탑·넓은 잔디', tags: ['local', 'family'] },

  // ───────── 🇯🇵 후쿠오카 Fukuoka ─────────
  { cityId: 'fukuoka', category: 'attraction', name: '다자이후 텐만구', nameLocal: '太宰府天満宮', area: '다자이후', description: '학문의 신·매화 명소', tags: ['classic'] },
  { cityId: 'fukuoka', category: 'attraction', name: '후쿠오카타워', nameLocal: '福岡タワー', area: '모모치', description: '234m 거울 외관 전망대', tags: ['classic', 'night'] },
  { cityId: 'fukuoka', category: 'attraction', name: '캐널시티 하카타', nameLocal: 'キャナルシティ博多', area: '하카타', description: '분수쇼 복합 문화 공간', tags: ['classic', 'family'] },
  { cityId: 'fukuoka', category: 'food', name: '나카스 야타이', nameLocal: '中洲屋台', area: '나카스', description: '강변 포장마차 라멘·텐푸라', tags: ['classic', 'local', 'night'] },
  { cityId: 'fukuoka', category: 'food', name: '이치란 본사총본점', nameLocal: '一蘭 本社総本店', area: '나카스', description: '천연 돈코츠 본점 한정 메뉴', tags: ['local'] },
  { cityId: 'fukuoka', category: 'food', name: '모츠나베 라쿠텐치', nameLocal: 'もつ鍋 楽天地', area: '텐진', description: '후쿠오카 명물 곱창 전골', tags: ['local'] },
  { cityId: 'fukuoka', category: 'museum', name: '후쿠오카 시립 미술관', nameLocal: '福岡市美術館', area: '오호리 공원', description: '쿠사마 야요이 호박 소장', tags: ['photogenic'] },
  { cityId: 'fukuoka', category: 'shopping', name: '텐진 지하상가', nameLocal: '天神地下街', area: '텐진', description: '유럽풍 590m 지하 쇼핑가', tags: ['classic'] },
  { cityId: 'fukuoka', category: 'experience', name: '라라포트 후쿠오카 건담', nameLocal: 'ららぽーと福岡', area: '하카타', description: '25m 실물대 뉴 건담 입상', tags: ['trending', 'family'] },
  { cityId: 'fukuoka', category: 'nature', name: '우미노나카미치 해변공원', nameLocal: '海の中道海浜公園', area: '히가시구', description: '계절 꽃밭·바다 자전거길', tags: ['local', 'family'] },

  // ───────── 🇯🇵 오키나와 Okinawa(Naha) ─────────
  { cityId: 'okinawa', category: 'attraction', name: '슈리성', nameLocal: '首里城', area: '슈리', description: '류큐왕국 정전·복원 공사 중 관람', tags: ['classic'] },
  { cityId: 'okinawa', category: 'attraction', name: '국제거리', nameLocal: '国際通り', area: '나하 중심', description: '1.6km 기념품·이자카야 거리', tags: ['classic', 'night'] },
  { cityId: 'okinawa', category: 'attraction', name: '세나가지마 우미카지 테라스', nameLocal: '瀬長島ウミカジテラス', area: '도미구스쿠', description: '화이트 그리스풍 해변 몰', tags: ['trending', 'photogenic'] },
  { cityId: 'okinawa', category: 'food', name: '마키시 공설시장', nameLocal: '牧志公設市場', area: '나하', description: '2023 신축 재개장 해산물 시장', tags: ['trending', 'local'] },
  { cityId: 'okinawa', category: 'food', name: '슈리소바', nameLocal: '首里そば', area: '슈리', description: '가다랑어 육수 전통 소바', tags: ['local'] },
  { cityId: 'okinawa', category: 'food', name: '야키니쿠 모토부 목장', nameLocal: '焼肉もとぶ牧場', area: '나하', description: '모토부 와규 직영 야키니쿠', tags: ['local'] },
  { cityId: 'okinawa', category: 'museum', name: '오키나와 현립박물관·미술관', nameLocal: '沖縄県立博物館・美術館', area: '오모로마치', description: '류큐 역사·전통 의상 전시', tags: ['classic'] },
  { cityId: 'okinawa', category: 'shopping', name: '돈키호테 국제거리점', nameLocal: 'ドン・キホーテ国際通り店', area: '나하', description: '24시 기념품·면세 쇼핑', tags: ['budget', 'night'] },
  { cityId: 'okinawa', category: 'experience', name: '추라우미 수족관', nameLocal: '美ら海水族館', area: '모토부', description: '거대 고래상어 수조 명물', tags: ['classic', 'family'] },
  { cityId: 'okinawa', category: 'nature', name: '코우리 대교·코우리섬', nameLocal: '古宇利大橋', area: '나키진', description: '에메랄드빛 2km 해상 다리', tags: ['photogenic', 'beach'] },

  // ───────── 🇯🇵 삿포로 Sapporo ─────────
  { cityId: 'sapporo', category: 'attraction', name: '삿포로 시계탑', nameLocal: '札幌市時計台', area: '오도리', description: '메이지 시대 목조 시계탑', tags: ['classic'] },
  { cityId: 'sapporo', category: 'attraction', name: '오도리 공원', nameLocal: '大通公園', area: '중심부', description: '눈축제·옥토버페스트 메인장', tags: ['classic'] },
  { cityId: 'sapporo', category: 'attraction', name: '모이와산 로프웨이', nameLocal: 'もいわ山ロープウェイ', area: '미나미', description: '일본 신 야경 3대 명소', tags: ['classic', 'night'] },
  { cityId: 'sapporo', category: 'food', name: '니조 시장', nameLocal: '二条市場', area: '중심부', description: '성게·연어알 카이센동 아침', tags: ['local'] },
  { cityId: 'sapporo', category: 'food', name: '멘야 사이미', nameLocal: '麺屋 彩未', area: '미야노모리', description: '미소라멘 부동의 1위', tags: ['local'] },
  { cityId: 'sapporo', category: 'food', name: '다루마 본점', nameLocal: 'だるま本店', area: '스스키노', description: '70년 전통 징기스칸 양고기', tags: ['classic', 'local'] },
  { cityId: 'sapporo', category: 'museum', name: '모에레누마 공원·이사무 노구치', nameLocal: 'モエレ沼公園', area: '히가시구', description: '노구치 이사무 설계 조각 공원', tags: ['photogenic'] },
  { cityId: 'sapporo', category: 'shopping', name: '타누키코지 상점가', nameLocal: '狸小路商店街', area: '중심부', description: '1.1km 아케이드·신축 모야이', tags: ['classic'] },
  { cityId: 'sapporo', category: 'experience', name: '삿포로 맥주 박물관 시음', nameLocal: 'サッポロビール博物館', area: '히가시구', description: '일본 유일 맥주 박물관 시음', tags: ['local', 'family'] },
  { cityId: 'sapporo', category: 'nature', name: '시로이코이비토 파크', nameLocal: '白い恋人パーク', area: '니시구', description: '동화풍 과자 공장 견학', tags: ['family', 'photogenic'] },

  // ───────── 🇯🇵 교토 Kyoto ─────────
  { cityId: 'kyoto', category: 'attraction', name: '후시미 이나리 신사', nameLocal: '伏見稲荷大社', area: '후시미', description: '천 개의 붉은 도리이 터널', tags: ['classic', 'photogenic'] },
  { cityId: 'kyoto', category: 'attraction', name: '기요미즈데라', nameLocal: '清水寺', area: '히가시야마', description: '2020 보수 완료 절벽 무대', tags: ['classic'] },
  { cityId: 'kyoto', category: 'attraction', name: '킨카쿠지', nameLocal: '金閣寺', area: '키타구', description: '황금빛 누각·연못 반영', tags: ['classic', 'photogenic'] },
  { cityId: 'kyoto', category: 'attraction', name: '아라시야마 대나무숲', nameLocal: '嵐山 竹林の小径', area: '아라시야마', description: '초록 대나무 터널 산책로', tags: ['classic', 'photogenic'] },
  { cityId: 'kyoto', category: 'food', name: '니시키 시장', nameLocal: '錦市場', area: '나카교', description: '400년 전통 교토 부엌', tags: ['classic', 'local'] },
  { cityId: 'kyoto', category: 'food', name: '%아라비카 교토 아라시야마', nameLocal: '%Arabica Kyoto', area: '아라시야마', description: '강변 뷰 시그니처 라테', tags: ['trending', 'photogenic'] },
  { cityId: 'kyoto', category: 'museum', name: '교토 국립박물관', nameLocal: '京都国立博物館', area: '히가시야마', description: '헤이안 불상·국보 특별전', tags: ['classic'] },
  { cityId: 'kyoto', category: 'shopping', name: '산넨자카·니넨자카', nameLocal: '三年坂・二年坂', area: '히가시야마', description: '기모노 입고 걷는 옛 거리', tags: ['classic', 'photogenic'] },
  { cityId: 'kyoto', category: 'experience', name: '기온 게이샤 거리 산책', nameLocal: '祇園 花見小路', area: '기온', description: '저녁 마이코 마주치는 골목', tags: ['classic', 'night'] },
  { cityId: 'kyoto', category: 'experience', name: '사가노 토롯코 열차', nameLocal: '嵯峨野トロッコ列車', area: '아라시야마', description: '호즈강 협곡 관광 열차', tags: ['family'] },

  // ───────── 🇹🇼 타이베이 Taipei ─────────
  { cityId: 'taipei', category: 'attraction', name: '타이베이 101', nameLocal: '台北101', area: '신이구', description: '89층 전망대·송년 불꽃', tags: ['classic', 'night'] },
  { cityId: 'taipei', category: 'attraction', name: '중정기념당', nameLocal: '中正紀念堂', area: '중정구', description: '위병 교대식·자유광장', tags: ['classic'] },
  { cityId: 'taipei', category: 'attraction', name: '지우펀 옛거리', nameLocal: '九份老街', area: '신베이', description: '홍등 골목·아메이 차루', tags: ['classic', 'photogenic'] },
  { cityId: 'taipei', category: 'food', name: '스린 야시장', nameLocal: '士林夜市', area: '스린구', description: '굴전·후추빵·버블티 천국', tags: ['classic', 'local', 'night'] },
  { cityId: 'taipei', category: 'food', name: '딘타이펑 신성본점', nameLocal: '鼎泰豐 信義店', area: '신이구', description: '2024 신성 플래그십 재오픈', tags: ['trending', 'michelin'] },
  { cityId: 'taipei', category: 'food', name: '푸항 더우장', nameLocal: '阜杭豆漿', area: '중정', description: '줄서는 아침 더우장·요우티아오', tags: ['classic', 'local'] },
  { cityId: 'taipei', category: 'museum', name: '국립고궁박물원', nameLocal: '國立故宮博物院', area: '스린구', description: '취옥배추·동파육 옥조각', tags: ['classic'] },
  { cityId: 'taipei', category: 'shopping', name: '융캉제', nameLocal: '永康街', area: '다안구', description: '망고빙수·디자인숍 거리', tags: ['local'] },
  { cityId: 'taipei', category: 'experience', name: '베이터우 온천 료칸', nameLocal: '北投温泉', area: '베이터우', description: 'MRT 30분 도심 유황 온천', tags: ['local'] },
  { cityId: 'taipei', category: 'nature', name: '양명산 국립공원', nameLocal: '陽明山', area: '베이터우', description: '봄 벚꽃·여름 칼라 군락', tags: ['local'] },

  // ───────── 🇭🇰 홍콩 Hong Kong ─────────
  { cityId: 'hongkong', category: 'attraction', name: '빅토리아 피크', nameLocal: 'Victoria Peak', area: '센트럴', description: '100만불 야경·피크트램', tags: ['classic', 'night'] },
  { cityId: 'hongkong', category: 'attraction', name: '심포니 오브 라이트', nameLocal: '幻彩詠香江', area: '침사추이', description: '빅토리아 하버 야간 레이저쇼', tags: ['classic', 'night'] },
  { cityId: 'hongkong', category: 'attraction', name: '따이오 어촌', nameLocal: '大澳', area: '란타우', description: '수상가옥·핑크돌고래 투어', tags: ['hidden', 'local'] },
  { cityId: 'hongkong', category: 'food', name: '팀호완', nameLocal: '添好運', area: '센트럴/몽콕', description: '세계 최저가 미쉐린 딤섬', tags: ['michelin', 'budget'] },
  { cityId: 'hongkong', category: 'food', name: '카우키', nameLocal: '九記牛腩', area: '센트럴', description: '70년 소힘줄 누들 노포', tags: ['classic', 'local'] },
  { cityId: 'hongkong', category: 'food', name: '모트 32', nameLocal: 'Mott 32', area: '센트럴', description: '모던 광둥 베이징덕 핫플', tags: ['trending', 'michelin'] },
  { cityId: 'hongkong', category: 'museum', name: 'M+ 미술관', nameLocal: 'M+ Museum', area: '서구룡', description: '2021 개관 아시아 최대 현대미술', tags: ['trending'] },
  { cityId: 'hongkong', category: 'shopping', name: '레이디스 마켓', nameLocal: '女人街', area: '몽콕', description: '1km 길거리 패션·기념품', tags: ['classic', 'budget'] },
  { cityId: 'hongkong', category: 'experience', name: '스타페리', nameLocal: 'Star Ferry', area: '센트럴-침사추이', description: '100년 전통 5분 페리', tags: ['classic', 'budget'] },
  { cityId: 'hongkong', category: 'nature', name: '난련 정원·치린수도원', nameLocal: '南蓮園池', area: '다이아몬드힐', description: '당나라풍 무료 정원', tags: ['hidden', 'photogenic'] },

  // ───────── 🇨🇳 상하이 Shanghai ─────────
  { cityId: 'shanghai', category: 'attraction', name: '와이탄', nameLocal: '外灘 The Bund', area: '황푸구', description: '푸동 마천루 야경 부두', tags: ['classic', 'night'] },
  { cityId: 'shanghai', category: 'attraction', name: '상하이타워', nameLocal: '上海中心大厦', area: '푸동', description: '632m 중국 최고 전망대', tags: ['classic', 'night'] },
  { cityId: 'shanghai', category: 'attraction', name: '위위안', nameLocal: '豫園', area: '황푸구', description: '명대 정원·난샹 만두 본점', tags: ['classic'] },
  { cityId: 'shanghai', category: 'attraction', name: '우캉루', nameLocal: '武康路', area: '쉬후이구', description: '노르망디 빌딩·MZ 산책 거리', tags: ['trending', 'photogenic'] },
  { cityId: 'shanghai', category: 'food', name: '난샹 만두점', nameLocal: '南翔饅頭店', area: '위위안', description: '본점 샤오롱바오 100년 노포', tags: ['classic', 'local'] },
  { cityId: 'shanghai', category: 'food', name: '울트라바이올렛', nameLocal: 'Ultraviolet', area: '황푸구', description: '미쉐린 3⭐ 단일 테이블', tags: ['michelin'] },
  { cityId: 'shanghai', category: 'museum', name: '푸동 미술관', nameLocal: '浦東美術館 MAP', area: '푸동', description: '2021 개관 장 누벨 설계', tags: ['trending'] },
  { cityId: 'shanghai', category: 'shopping', name: '신톈디', nameLocal: '新天地 Xintiandi', area: '황푸구', description: '석고문 양옥 리노베 쇼핑가', tags: ['trending'] },
  { cityId: 'shanghai', category: 'experience', name: '상하이 디즈니랜드', nameLocal: '上海迪士尼樂園', area: '푸동', description: '2024 주토피아 랜드 신규', tags: ['trending', 'family'] },
  { cityId: 'shanghai', category: 'nature', name: '톈쯔팡', nameLocal: '田子坊', area: '황푸구', description: '좁은 골목 예술가 공방촌', tags: ['local', 'photogenic'] },

  // ───────── 🇨🇳 칭다오 Qingdao ─────────
  { cityId: 'qingdao', category: 'attraction', name: '잔교', nameLocal: '棧橋 Zhanqiao Pier', area: '시난구', description: '440m 해상 교각·칭다오 상징', tags: ['classic', 'photogenic'] },
  { cityId: 'qingdao', category: 'attraction', name: '팔대관', nameLocal: '八大關', area: '시난구', description: '독일·러시아풍 별장 거리', tags: ['classic', 'photogenic'] },
  { cityId: 'qingdao', category: 'attraction', name: '천주교당', nameLocal: '聖彌厄爾大教堂', area: '시난구', description: '1934년 독일식 쌍둥이 첨탑', tags: ['classic'] },
  { cityId: 'qingdao', category: 'attraction', name: '올림픽 요트센터', nameLocal: '奥帆中心', area: '시베이구', description: '야경 마천루·런닝맨 촬영지', tags: ['night'] },
  { cityId: 'qingdao', category: 'food', name: '피차이위안 야시장', nameLocal: '劈柴院', area: '시난구', description: '100년 골목·해산물 꼬치', tags: ['classic', 'local'] },
  { cityId: 'qingdao', category: 'food', name: '덩저우루 맥주거리', nameLocal: '登州路啤酒街', area: '시베이구', description: '비닐봉지 생맥주 명소', tags: ['local', 'night'] },
  { cityId: 'qingdao', category: 'food', name: '춘허로우', nameLocal: '春和樓', area: '시난구', description: '1891 창업 산둥 요리 노포', tags: ['classic', 'local'] },
  { cityId: 'qingdao', category: 'museum', name: '칭다오 맥주 박물관', nameLocal: '青島啤酒博物館', area: '시베이구', description: '1903 양조장 시음 코스', tags: ['classic', 'family'] },
  { cityId: 'qingdao', category: 'shopping', name: '타이둥 보행거리', nameLocal: '台東步行街', area: '시베이구', description: '칭다오 최대 야시장 쇼핑가', tags: ['local', 'night'] },
  { cityId: 'qingdao', category: 'nature', name: '라오산', nameLocal: '嶗山', area: '라오산구', description: '도교 성지·해안 절경 트레킹', tags: ['classic'] },

  // ───────── 🇹🇭 방콕 Bangkok ─────────
  { cityId: 'bangkok', category: 'attraction', name: '왓 프라깨우', nameLocal: 'Wat Phra Kaew', area: '라따나꼬신', description: '왕궁 안 에메랄드 불상 사원', tags: ['classic'] },
  { cityId: 'bangkok', category: 'attraction', name: '왓 아룬', nameLocal: 'Wat Arun', area: '톤부리', description: '짜오프라야 강변 새벽사원', tags: ['classic', 'photogenic'] },
  { cityId: 'bangkok', category: 'attraction', name: '왓 포', nameLocal: 'Wat Pho', area: '라따나꼬신', description: '46m 와불상·타이마사지 본산', tags: ['classic'] },
  { cityId: 'bangkok', category: 'food', name: '제이 파이', nameLocal: 'Jay Fai', area: '프라나콘', description: '고글 할머니 미슐랭 게살오믈렛', tags: ['michelin'] },
  { cityId: 'bangkok', category: 'food', name: '팁사마이', nameLocal: 'Thip Samai', area: '사오칭차', description: '60년 전통 팟타이 노포', tags: ['local', 'classic'] },
  { cityId: 'bangkok', category: 'food', name: 'Phed Mark', area: '에까마이', description: '한국인 픽 매운 바질볶음 맛집', tags: ['trending', 'local'] },
  { cityId: 'bangkok', category: 'museum', name: '짐 톰슨 하우스', nameLocal: 'Jim Thompson House', area: '빠툼완', description: '실크왕 저택 박물관', tags: ['classic'] },
  { cityId: 'bangkok', category: 'shopping', name: '짜뚜짝 주말시장', nameLocal: 'Chatuchak Market', area: '짜뚜짝', description: '1.5만 점포 동남아 최대 마켓', tags: ['classic', 'local'] },
  { cityId: 'bangkok', category: 'experience', name: '아이콘시암', nameLocal: 'ICONSIAM', area: '끌렁산', description: '강변 럭셔리몰+수상시장 재현', tags: ['trending', 'night'] },
  { cityId: 'bangkok', category: 'experience', name: '짜오프라야 디너크루즈', nameLocal: 'Chao Phraya Cruise', area: '강변', description: '야경+뷔페 강변 유람선', tags: ['night', 'photogenic'] },

  // ───────── 🇹🇭 푸켓 Phuket ─────────
  { cityId: 'phuket', category: 'nature', name: '빠통 비치', nameLocal: 'Patong Beach', area: '빠통', description: '푸켓 대표 번화 해변', tags: ['classic', 'beach'] },
  { cityId: 'phuket', category: 'nature', name: '까따 노이 비치', nameLocal: 'Kata Noi Beach', area: '까따', description: '한적한 가족형 해변', tags: ['beach', 'family'] },
  { cityId: 'phuket', category: 'nature', name: '프리덤 비치', nameLocal: 'Freedom Beach', area: '빠통 남쪽', description: '보트로만 가는 숨겨진 해변', tags: ['hidden', 'beach'] },
  { cityId: 'phuket', category: 'experience', name: '피피섬 투어', nameLocal: 'Phi Phi Islands', area: '안다만해', description: '보트로 도는 에메랄드 라군', tags: ['classic', 'beach'] },
  { cityId: 'phuket', category: 'experience', name: '제임스본드섬', nameLocal: 'James Bond Island', area: '팡아만', description: '카약으로 도는 기암 절벽', tags: ['classic'] },
  { cityId: 'phuket', category: 'attraction', name: '빅 부다', nameLocal: 'Big Buddha', area: '차론', description: '45m 대형 백색 불상 전망대', tags: ['classic', 'photogenic'] },
  { cityId: 'phuket', category: 'attraction', name: '푸켓 올드타운', nameLocal: 'Phuket Old Town', area: '시내', description: '시노포르투갈 파스텔 거리', tags: ['photogenic', 'trending'] },
  { cityId: 'phuket', category: 'food', name: '라야 레스토랑', nameLocal: 'Raya Restaurant', area: '올드타운', description: '현지인 푸켓식 게살커리 명가', tags: ['local', 'michelin'] },
  { cityId: 'phuket', category: 'food', name: '원춘', nameLocal: 'One Chun', area: '올드타운', description: '푸켓 가정식 미슐랭 빕구르망', tags: ['michelin', 'local'] },
  { cityId: 'phuket', category: 'shopping', name: '반잔 시장', nameLocal: 'Banzaan Market', area: '빠통', description: '해산물 사서 즉석 조리', tags: ['local'] },

  // ───────── 🇹🇭 치앙마이 Chiang Mai ─────────
  { cityId: 'chiangmai', category: 'attraction', name: '왓 프라탓 도이수텝', nameLocal: 'Wat Phra That Doi Suthep', area: '도이수텝', description: '산 정상 황금탑 사원', tags: ['classic'] },
  { cityId: 'chiangmai', category: 'attraction', name: '왓 체디 루앙', nameLocal: 'Wat Chedi Luang', area: '올드시티', description: '무너진 거대 체디 유적', tags: ['classic'] },
  { cityId: 'chiangmai', category: 'experience', name: '코끼리 자연공원', nameLocal: 'Elephant Nature Park', area: '매땡', description: '학대 구조 코끼리 보호소', tags: ['trending', 'family'] },
  { cityId: 'chiangmai', category: 'experience', name: '매땡 정글짚라인', nameLocal: 'Flight of the Gibbon', area: '매땡', description: '정글 상공 짚라인 액티비티', tags: ['family'] },
  { cityId: 'chiangmai', category: 'nature', name: '도이인타논 국립공원', nameLocal: 'Doi Inthanon NP', area: '짬텅', description: '태국 최고봉+계단식 논', tags: ['classic'] },
  { cityId: 'chiangmai', category: 'food', name: '카오소이 매사이', nameLocal: 'Khao Soi Mae Sai', area: '산티탐', description: '카레 누들 카오소이 원조집', tags: ['local', 'budget'] },
  { cityId: 'chiangmai', category: 'food', name: 'SP 치킨', nameLocal: 'SP Chicken', area: '올드시티', description: '통닭구이 현지 명가', tags: ['local', 'budget'] },
  { cityId: 'chiangmai', category: 'shopping', name: '일요 워킹스트리트', nameLocal: 'Sunday Walking Street', area: '타패문', description: '올드시티 야시장 거리', tags: ['classic', 'night'] },
  { cityId: 'chiangmai', category: 'museum', name: 'MAIIAM 현대미술관', nameLocal: 'MAIIAM Contemporary', area: '산캄팽', description: '거울 외벽 태국 현대미술관', tags: ['trending', 'photogenic'] },
  { cityId: 'chiangmai', category: 'attraction', name: '닌만해민 카페거리', nameLocal: 'Nimman Road', area: '닌만해민', description: '인스타 감성 카페 밀집지', tags: ['trending', 'photogenic'] },

  // ───────── 🇻🇳 다낭 Da Nang ─────────
  { cityId: 'danang', category: 'nature', name: '미케 비치', nameLocal: 'My Khe Beach', area: '선짜', description: '다낭 시내 30km 백사장', tags: ['classic', 'beach'] },
  { cityId: 'danang', category: 'experience', name: '바나힐 골든브리지', nameLocal: 'Ba Na Hills Golden Bridge', area: '호아방', description: '거대한 손이 받친 다리', tags: ['classic', 'photogenic'] },
  { cityId: 'danang', category: 'attraction', name: '마블 마운틴', nameLocal: 'Marble Mountains', area: '응우한선', description: '동굴 사원 다섯 봉우리', tags: ['classic'] },
  { cityId: 'danang', category: 'attraction', name: '린응사 해수관음', nameLocal: 'Linh Ung Pagoda', area: '선짜반도', description: '67m 해수관음상 전망', tags: ['classic'] },
  { cityId: 'danang', category: 'attraction', name: '용다리', nameLocal: 'Dragon Bridge', area: '한강', description: '주말밤 불뿜는 용 조형 다리', tags: ['night', 'photogenic'] },
  { cityId: 'danang', category: 'food', name: '마담 란', nameLocal: 'Madame Lan', area: '한강변', description: '중부식 미꽝·반쎄오 한국인 픽', tags: ['local'] },
  { cityId: 'danang', category: 'food', name: '반쎄오 바즈엉', nameLocal: 'Banh Xeo Ba Duong', area: '호아쿠에', description: '다낭식 반쎄오 노포', tags: ['local', 'budget'] },
  { cityId: 'danang', category: 'shopping', name: '한 시장', nameLocal: 'Han Market', area: '시내', description: '기념품·과일 재래시장', tags: ['classic'] },
  { cityId: 'danang', category: 'attraction', name: '호이안 올드타운', nameLocal: 'Hoi An Ancient Town', area: '호이안', description: '등불 가득한 유네스코 거리', tags: ['classic', 'night'] },
  { cityId: 'danang', category: 'museum', name: '참 조각 박물관', nameLocal: 'Cham Museum', area: '한강변', description: '참파 왕국 석조 유물관', tags: ['classic'] },

  // ───────── 🇻🇳 나트랑 Nha Trang ─────────
  { cityId: 'nhatrang', category: 'nature', name: '나트랑 비치', nameLocal: 'Nha Trang Beach', area: '시내', description: '시내 7km 해변 산책로', tags: ['classic', 'beach'] },
  { cityId: 'nhatrang', category: 'experience', name: '빈원더스', nameLocal: 'VinWonders Nha Trang', area: '혼째섬', description: '케이블카 타고 가는 테마파크', tags: ['family'] },
  { cityId: 'nhatrang', category: 'experience', name: '혼문섬 호핑', nameLocal: 'Hon Mun Island', area: '앞바다', description: '4섬 스노클링 보트투어', tags: ['beach'] },
  { cityId: 'nhatrang', category: 'experience', name: '머드 스파', nameLocal: 'I-Resort Mud Bath', area: '시내북부', description: '진흙 온천 휴양 스파', tags: ['family'] },
  { cityId: 'nhatrang', category: 'attraction', name: '포나가르 참 탑', nameLocal: 'Po Nagar Cham Towers', area: '비엔까이', description: '7세기 참파 힌두 사원', tags: ['classic'] },
  { cityId: 'nhatrang', category: 'attraction', name: '나트랑 대성당', nameLocal: 'Nha Trang Cathedral', area: '시내', description: '핑크빛 고딕 가톨릭 성당', tags: ['photogenic'] },
  { cityId: 'nhatrang', category: 'food', name: '분짜 까 109', nameLocal: 'Bun Cha Ca 109', area: '시내', description: '어묵 쌀국수 분짜까 노포', tags: ['local', 'budget'] },
  { cityId: 'nhatrang', category: 'food', name: '락깐', nameLocal: 'Lac Canh Restaurant', area: '시내', description: '직화 비프 BBQ 현지 명가', tags: ['local'] },
  { cityId: 'nhatrang', category: 'shopping', name: '담 시장', nameLocal: 'Cho Dam Market', area: '시내', description: '해산물·기념품 재래시장', tags: ['local'] },
  { cityId: 'nhatrang', category: 'experience', name: '폰자가르 야시장', nameLocal: 'Yen Phi Night Market', area: '해변', description: '해변가 한국인 인기 야시장', tags: ['night', 'trending'] },

  // ───────── 🇻🇳 호치민 Ho Chi Minh ─────────
  { cityId: 'hochiminh', category: 'attraction', name: '노트르담 대성당', nameLocal: 'Notre-Dame Saigon', area: '1군', description: '붉은벽돌 프렌치 식민 성당', tags: ['classic'] },
  { cityId: 'hochiminh', category: 'attraction', name: '중앙우체국', nameLocal: 'Saigon Central Post Office', area: '1군', description: '에펠 설계 콜로니얼 우체국', tags: ['classic', 'photogenic'] },
  { cityId: 'hochiminh', category: 'attraction', name: '통일궁', nameLocal: 'Independence Palace', area: '1군', description: '베트남전 종전 현장 궁전', tags: ['classic'] },
  { cityId: 'hochiminh', category: 'museum', name: '전쟁박물관', nameLocal: 'War Remnants Museum', area: '3군', description: '베트남전 사진·유물 전시', tags: ['classic'] },
  { cityId: 'hochiminh', category: 'experience', name: '구찌 터널', nameLocal: 'Cu Chi Tunnels', area: '구찌', description: '베트콩 지하 땅굴 체험', tags: ['classic'] },
  { cityId: 'hochiminh', category: 'food', name: '포 호아 파스퇴르', nameLocal: 'Pho Hoa Pasteur', area: '3군', description: '사이공 대표 쌀국수 노포', tags: ['local', 'classic'] },
  { cityId: 'hochiminh', category: 'food', name: '반미 후잉호아', nameLocal: 'Banh Mi Huynh Hoa', area: '1군', description: '줄서는 반미 황제', tags: ['local', 'trending'] },
  { cityId: 'hochiminh', category: 'food', name: '콤탐 바고', nameLocal: 'Com Tam Ba Ghien', area: '푸뉴언', description: '미슐랭 빕구르망 깨진쌀밥', tags: ['michelin', 'local'] },
  { cityId: 'hochiminh', category: 'shopping', name: '벤탄 시장', nameLocal: 'Ben Thanh Market', area: '1군', description: '호치민 대표 재래시장', tags: ['classic'] },
  { cityId: 'hochiminh', category: 'experience', name: '부이비엔 거리', nameLocal: 'Bui Vien Walking Street', area: '1군', description: '호치민 밤문화 백패커 거리', tags: ['night'] },

  // ───────── 🇵🇭 세부 Cebu ─────────
  { cityId: 'cebu', category: 'experience', name: '막탄 아일랜드 호핑', nameLocal: 'Mactan Island Hopping', area: '막탄', description: '힐루툰간·날루숙 스노클링', tags: ['classic', 'beach'] },
  { cityId: 'cebu', category: 'nature', name: '칼랑가만 섬', nameLocal: 'Kalanggaman Island', area: '레이테 인근', description: '모래톱 끝없는 사주 비치', tags: ['hidden', 'beach'] },
  { cityId: 'cebu', category: 'experience', name: '오슬롭 고래상어', nameLocal: 'Oslob Whale Shark', area: '오슬롭', description: '고래상어와 스노클링', tags: ['trending', 'photogenic'] },
  { cityId: 'cebu', category: 'experience', name: '카와산 폭포 캐녀닝', nameLocal: 'Kawasan Falls Canyoneering', area: '바디안', description: '협곡 점프 캐녀닝 액티비티', tags: ['trending'] },
  { cityId: 'cebu', category: 'experience', name: '모알보알 정어리떼', nameLocal: 'Moalboal Sardine Run', area: '모알보알', description: '수만 마리 정어리 군영', tags: ['trending', 'beach'] },
  { cityId: 'cebu', category: 'attraction', name: '마젤란 십자가', nameLocal: "Magellan's Cross", area: '시티', description: '1521년 세워진 목조 십자가', tags: ['classic'] },
  { cityId: 'cebu', category: 'attraction', name: '산토니뇨 성당', nameLocal: 'Basilica del Santo Niño', area: '시티', description: '필리핀 최고(古) 성당', tags: ['classic'] },
  { cityId: 'cebu', category: 'food', name: "리코스 레춘", nameLocal: "Rico's Lechon", area: '시티', description: '통돼지구이 세부 대표 맛집', tags: ['local', 'classic'] },
  { cityId: 'cebu', category: 'food', name: 'AA BBQ', area: '시티', description: '현지인 픽 꼬치바베큐', tags: ['local', 'budget'] },
  { cityId: 'cebu', category: 'shopping', name: 'SM 시티 세부', nameLocal: 'SM Seaside City', area: '시티', description: '시푸드 푸드코트 대형몰', tags: ['family'] },

  // ───────── 🇵🇭 보라카이 Boracay ─────────
  { cityId: 'boracay', category: 'nature', name: '화이트 비치', nameLocal: 'White Beach', area: '스테이션1~3', description: '4km 백색 파우더 모래 해변', tags: ['classic', 'beach'] },
  { cityId: 'boracay', category: 'nature', name: '푸카쉘 비치', nameLocal: 'Puka Shell Beach', area: '북부', description: '한적한 조개껍질 해변', tags: ['beach', 'hidden'] },
  { cityId: 'boracay', category: 'nature', name: '일릭일리간 비치', nameLocal: 'Ilig-Iligan Beach', area: '동부', description: '동굴 있는 비밀 해변', tags: ['hidden', 'beach'] },
  { cityId: 'boracay', category: 'experience', name: '호핑투어+헬멧다이빙', nameLocal: 'Island Hopping', area: '앞바다', description: '크리스탈코브+헬멧다이빙', tags: ['classic'] },
  { cityId: 'boracay', category: 'experience', name: '패러세일링', nameLocal: 'Parasailing', area: '앞바다', description: '보라카이 상공 낙하산', tags: ['trending'] },
  { cityId: 'boracay', category: 'experience', name: '선셋 세일링', nameLocal: 'Paraw Sunset Sailing', area: '화이트비치', description: '전통 세일보트 일몰투어', tags: ['classic', 'photogenic'] },
  { cityId: 'boracay', category: 'food', name: '디탈리푸안', nameLocal: "D'Talipapa", area: '스테이션2', description: '해산물 사서 즉석 조리', tags: ['local'] },
  { cityId: 'boracay', category: 'food', name: '아리아', nameLocal: 'Aria Cuisine', area: '디몰', description: '화이트비치 정통 이태리식', tags: ['trending'] },
  { cityId: 'boracay', category: 'shopping', name: '디몰', nameLocal: "D'Mall", area: '스테이션2', description: '보라카이 중심 쇼핑·식당가', tags: ['classic', 'night'] },
  { cityId: 'boracay', category: 'attraction', name: '마운트 루호 전망대', nameLocal: 'Mt. Luho View Deck', area: '동부', description: '보라카이 최고봉 360 뷰', tags: ['photogenic'] },

  // ───────── 🇵🇭 마닐라 Manila ─────────
  { cityId: 'manila', category: 'attraction', name: '인트라무로스', nameLocal: 'Intramuros', area: '마닐라', description: '스페인 식민 성벽 도시', tags: ['classic'] },
  { cityId: 'manila', category: 'attraction', name: '산티아고 요새', nameLocal: 'Fort Santiago', area: '인트라무로스', description: '호세 리잘 마지막 감옥', tags: ['classic'] },
  { cityId: 'manila', category: 'attraction', name: '산아구스틴 교회', nameLocal: 'San Agustin Church', area: '인트라무로스', description: '16세기 유네스코 성당', tags: ['classic'] },
  { cityId: 'manila', category: 'museum', name: '필리핀 국립박물관', nameLocal: 'National Museum Complex', area: '리잘공원', description: '자연사·인류·미술 무료 입장', tags: ['classic', 'budget'] },
  { cityId: 'manila', category: 'museum', name: '아얄라 박물관', nameLocal: 'Ayala Museum', area: '마카티', description: '2024 리뉴얼 필리핀 역사관', tags: ['trending'] },
  { cityId: 'manila', category: 'experience', name: '리잘 공원', nameLocal: 'Rizal Park', area: '에르미타', description: '마닐라 중심 국가 영웅 공원', tags: ['classic'] },
  { cityId: 'manila', category: 'food', name: 'Manam Comfort Filipino', area: 'BGC', description: '시니강·아도보 모던 필리핀', tags: ['trending', 'local'] },
  { cityId: 'manila', category: 'food', name: 'Toyo Eatery', area: '마카티', description: '아시아50베스트 모던 필리피노', tags: ['michelin', 'trending'] },
  { cityId: 'manila', category: 'shopping', name: '그린벨트·글로리에타', nameLocal: 'Greenbelt & Glorietta', area: '마카티', description: '마카티 중심 럭셔리 몰', tags: ['classic'] },
  { cityId: 'manila', category: 'experience', name: 'BGC 하이스트리트', nameLocal: 'BGC High Street', area: '보니파시오', description: '벽화·카페 힙한 신도심', tags: ['trending'] },

  // ───────── 🇮🇩 발리 Bali ─────────
  { cityId: 'bali', category: 'attraction', name: '따나롯 사원', nameLocal: 'Tanah Lot', area: '따바난', description: '바위섬 위 일몰 힌두 사원', tags: ['classic', 'photogenic'] },
  { cityId: 'bali', category: 'attraction', name: '울루와뚜 사원', nameLocal: 'Uluwatu Temple', area: '울루와뚜', description: '절벽 사원+케착댄스 일몰', tags: ['classic'] },
  { cityId: 'bali', category: 'nature', name: '짱구 비치', nameLocal: 'Canggu Beach', area: '짱구', description: '서퍼·노마드 핫플 해변', tags: ['trending', 'beach'] },
  { cityId: 'bali', category: 'nature', name: '누사페니다 켈링킹', nameLocal: 'Kelingking Beach', area: '누사페니다', description: '티렉스 모양 절벽 비치', tags: ['trending', 'photogenic'] },
  { cityId: 'bali', category: 'experience', name: '뗏갈랄랑 라이스테라스', nameLocal: 'Tegallalang Rice Terrace', area: '우붓', description: '계단식 논+그네 인스타 핫플', tags: ['classic', 'photogenic'] },
  { cityId: 'bali', category: 'experience', name: '우붓 몽키포레스트', nameLocal: 'Sacred Monkey Forest', area: '우붓', description: '원숭이 가득 정글 사원', tags: ['classic', 'family'] },
  { cityId: 'bali', category: 'food', name: '이부오까', nameLocal: 'Ibu Oka Babi Guling', area: '우붓', description: '통돼지 바비굴링 노포', tags: ['local', 'classic'] },
  { cityId: 'bali', category: 'food', name: '라플란차', nameLocal: 'La Plancha', area: '스미냑', description: '빈백 깔린 일몰 비치바', tags: ['trending', 'photogenic'] },
  { cityId: 'bali', category: 'shopping', name: '우붓 아트마켓', nameLocal: 'Ubud Art Market', area: '우붓', description: '라탄·바틱 공예 시장', tags: ['local'] },
  { cityId: 'bali', category: 'nature', name: '띠르따 강가', nameLocal: 'Tirta Gangga', area: '까랑아슴', description: '연못 디딤돌 왕실 수궁', tags: ['photogenic'] },

  // ───────── 🇸🇬 싱가포르 Singapore ─────────
  { cityId: 'singapore', category: 'attraction', name: '마리나베이 샌즈', nameLocal: 'Marina Bay Sands', area: '마리나베이', description: '옥상 인피니티풀 랜드마크', tags: ['classic', 'photogenic'] },
  { cityId: 'singapore', category: 'attraction', name: '멀라이언 파크', nameLocal: 'Merlion Park', area: '마리나베이', description: '싱가포르 상징 사자상', tags: ['classic'] },
  { cityId: 'singapore', category: 'nature', name: '가든스 바이 더 베이', nameLocal: 'Gardens by the Bay', area: '마리나베이', description: '슈퍼트리 야간 라이트쇼', tags: ['classic', 'night'] },
  { cityId: 'singapore', category: 'attraction', name: '주얼 창이', nameLocal: 'Jewel Changi', area: '창이공항', description: '세계 최대 실내폭포', tags: ['trending', 'photogenic'] },
  { cityId: 'singapore', category: 'experience', name: '센토사 유니버설', nameLocal: 'Universal Studios', area: '센토사', description: '동남아 유일 유니버설', tags: ['classic', 'family'] },
  { cityId: 'singapore', category: 'food', name: '티엔티엔 치킨라이스', nameLocal: 'Tian Tian Hainanese', area: '맥스웰', description: '호커센터 미슐랭 치킨라이스', tags: ['michelin', 'budget'] },
  { cityId: 'singapore', category: 'food', name: '라우파삿 사테거리', nameLocal: 'Lau Pa Sat', area: 'CBD', description: '야간 사테 노점 호커센터', tags: ['local', 'night'] },
  { cityId: 'singapore', category: 'food', name: '송파 바쿠테', nameLocal: 'Song Fa Bak Kut Teh', area: '클락키', description: '후추 갈비탕 바쿠테 노포', tags: ['local', 'classic'] },
  { cityId: 'singapore', category: 'museum', name: '내셔널 갤러리', nameLocal: 'National Gallery', area: '시청', description: '동남아 최대 모던아트관', tags: ['trending'] },
  { cityId: 'singapore', category: 'shopping', name: '하지레인', nameLocal: 'Haji Lane', area: '캄퐁글람', description: '벽화·부티크 힙스터 골목', tags: ['trending', 'photogenic'] },

  // ───────── 🇲🇾 쿠알라룸푸르 Kuala Lumpur ─────────
  { cityId: 'kualalumpur', category: 'attraction', name: '페트로나스 트윈타워', nameLocal: 'Petronas Twin Towers', area: 'KLCC', description: 'KL 상징 452m 쌍둥이 빌딩', tags: ['classic', 'photogenic'] },
  { cityId: 'kualalumpur', category: 'attraction', name: 'KL 타워 스카이박스', nameLocal: 'KL Tower Skybox', area: '부킷빈땅', description: '유리바닥 421m 전망대', tags: ['classic'] },
  { cityId: 'kualalumpur', category: 'attraction', name: '바투 동굴', nameLocal: 'Batu Caves', area: '곰박', description: '272 무지개 계단 힌두사원', tags: ['classic', 'photogenic'] },
  { cityId: 'kualalumpur', category: 'attraction', name: '메르데카 광장', nameLocal: 'Merdeka Square', area: '다운타운', description: '독립선언 콜로니얼 광장', tags: ['classic'] },
  { cityId: 'kualalumpur', category: 'museum', name: '이슬람 예술 박물관', nameLocal: 'Islamic Arts Museum', area: '레이크가든', description: '동남아 최대 이슬람 미술관', tags: ['hidden'] },
  { cityId: 'kualalumpur', category: 'food', name: '잘란 알로 푸드 스트리트', nameLocal: 'Jalan Alor Food Street', area: '부킷빈땅', description: '노점 가득 야시장 거리', tags: ['classic', 'night'] },
  { cityId: 'kualalumpur', category: 'food', name: '림 키 카페', nameLocal: 'Lim Kee', area: '차이나타운', description: '새벽 호커 박쿳떼 노포', tags: ['local'] },
  { cityId: 'kualalumpur', category: 'food', name: '빌리지파크 나시르막', nameLocal: 'Village Park Nasi Lemak', area: '다만사라', description: 'KL 최고의 나시르막 평가', tags: ['local', 'classic'] },
  { cityId: 'kualalumpur', category: 'shopping', name: '페탈링 스트리트', nameLocal: 'Petaling Street', area: '차이나타운', description: 'KL 차이나타운 야시장', tags: ['classic', 'night'] },
  { cityId: 'kualalumpur', category: 'experience', name: '부킷빈땅', nameLocal: 'Bukit Bintang', area: '부킷빈땅', description: '쇼핑·나이트라이프 중심', tags: ['classic', 'night'] },

  // ───────── 🇲🇾 코타키나발루 Kota Kinabalu ─────────
  { cityId: 'kotakinabalu', category: 'nature', name: '마누칸 섬', nameLocal: 'Manukan Island', area: '툰꾸압둘라만', description: 'TARP 5섬 중 호핑 1순위', tags: ['classic', 'beach'] },
  { cityId: 'kotakinabalu', category: 'experience', name: '사피·가야섬 짚라인', nameLocal: 'Sapi & Gaya Zipline', area: 'TARP', description: '섬 사이 바다 짚라인', tags: ['trending'] },
  { cityId: 'kotakinabalu', category: 'nature', name: '탄중아루 비치', nameLocal: 'Tanjung Aru Beach', area: '시내남부', description: '세계 3대 일몰 해변', tags: ['classic', 'photogenic'] },
  { cityId: 'kotakinabalu', category: 'experience', name: '키나발루산 트레킹', nameLocal: 'Mt. Kinabalu', area: '라나우', description: '동남아 최고봉 4,095m', tags: ['trending'] },
  { cityId: 'kotakinabalu', category: 'experience', name: '클리아스강 반딧불', nameLocal: 'Klias River Firefly', area: '클리아스', description: '코주부원숭이+반딧불 투어', tags: ['classic', 'family'] },
  { cityId: 'kotakinabalu', category: 'attraction', name: '수상 모스크', nameLocal: 'KK City Mosque', area: '리카스', description: '호수 위 떠 있는 백색 모스크', tags: ['classic', 'photogenic'] },
  { cityId: 'kotakinabalu', category: 'attraction', name: '시그널 힐 전망대', nameLocal: 'Signal Hill Observatory', area: '시내', description: 'KK 시내 야경 전망대', tags: ['classic', 'night'] },
  { cityId: 'kotakinabalu', category: 'food', name: '웰컴 시푸드', nameLocal: 'Welcome Seafood', area: '시내', description: '한국인 픽 랍스터 시푸드', tags: ['local', 'classic'] },
  { cityId: 'kotakinabalu', category: 'food', name: '오션 시푸드', nameLocal: 'Ocean Seafood', area: '수리아사바', description: '해변뷰 시푸드 레스토랑', tags: ['trending'] },
  { cityId: 'kotakinabalu', category: 'shopping', name: '가야 선데이 마켓', nameLocal: 'Gaya Street Sunday Market', area: '시내', description: '일요일만 열리는 거리시장', tags: ['local'] },

  // ───────── 🇫🇷 파리 Paris ─────────
  { cityId: 'paris', category: 'attraction', name: '에펠탑', nameLocal: 'Tour Eiffel', area: '7구', description: '매 정각 5분 반짝이는 파리 상징', tags: ['classic', 'night'] },
  { cityId: 'paris', category: 'attraction', name: '노트르담 대성당', nameLocal: 'Cathédrale Notre-Dame', area: '4구 시테섬', description: '2024년 12월 재개관·예약 권장', tags: ['classic', 'trending'] },
  { cityId: 'paris', category: 'attraction', name: '사크레쾨르 대성당', nameLocal: 'Sacré-Cœur', area: '18구 몽마르트', description: '언덕 위 백색 돔·야경 명소', tags: ['classic', 'photogenic'] },
  { cityId: 'paris', category: 'attraction', name: '개선문', nameLocal: 'Arc de Triomphe', area: '8구 샹젤리제', description: '옥상서 12방향 방사형 도로', tags: ['classic'] },
  { cityId: 'paris', category: 'museum', name: '루브르 박물관', nameLocal: 'Musée du Louvre', area: '1구', description: '모나리자 보유·사전 예약 필수', tags: ['classic'] },
  { cityId: 'paris', category: 'museum', name: '오르세 미술관', nameLocal: "Musée d'Orsay", area: '7구', description: '인상파 컬렉션·옛 기차역', tags: ['classic'] },
  { cityId: 'paris', category: 'museum', name: '피노 컬렉션', nameLocal: 'Bourse de Commerce', area: '1구 레알', description: '2021 개관·안도 다다오 설계', tags: ['trending'] },
  { cityId: 'paris', category: 'food', name: '셉팀', nameLocal: 'Septime', area: '11구 바스티유', description: '미슐랭 ⭐·두 달 전 예약', tags: ['michelin', 'trending'] },
  { cityId: 'paris', category: 'food', name: '뒤 팽 에 데지데', nameLocal: 'Du Pain et des Idées', area: '10구 운하', description: '에스카르고 페이스트리 명물', tags: ['local', 'budget'] },
  { cityId: 'paris', category: 'shopping', name: '갤러리 라파예트', nameLocal: 'Galeries Lafayette', area: '9구 오스만', description: '스테인드글라스 돔 백화점', tags: ['classic'] },

  // ───────── 🇬🇧 런던 London ─────────
  { cityId: 'london', category: 'attraction', name: '빅 벤 & 국회의사당', nameLocal: 'Big Ben & Westminster', area: '웨스트민스터', description: '2022 복원 완료된 시계탑', tags: ['classic'] },
  { cityId: 'london', category: 'attraction', name: '타워 브리지', nameLocal: 'Tower Bridge', area: '시티 오브 런던', description: '글래스 워크웨이서 템스 부감', tags: ['classic', 'photogenic'] },
  { cityId: 'london', category: 'attraction', name: '런던 아이', nameLocal: 'London Eye', area: '사우스 뱅크', description: '30분 한 바퀴 도는 대관람차', tags: ['classic', 'family'] },
  { cityId: 'london', category: 'museum', name: '대영박물관', nameLocal: 'British Museum', area: '블룸즈버리', description: '로제타석·파르테논 마블 무료', tags: ['classic', 'budget'] },
  { cityId: 'london', category: 'museum', name: '테이트 모던', nameLocal: 'Tate Modern', area: '뱅크사이드', description: '발전소 개조 현대미술관', tags: ['classic'] },
  { cityId: 'london', category: 'museum', name: '빅토리아 앤 앨버트 박물관', nameLocal: 'Victoria and Albert Museum', area: '사우스 켄싱턴', description: '장식미술 세계 1위·무료', tags: ['classic', 'hidden'] },
  { cityId: 'london', category: 'food', name: '보로 마켓', nameLocal: 'Borough Market', area: '사우스워크', description: '1014년 시작 푸드 마켓', tags: ['local', 'trending'] },
  { cityId: 'london', category: 'food', name: '더 리츠 애프터눈 티', nameLocal: 'The Ritz Afternoon Tea', area: '피카딜리', description: '정통 영국 티타임·드레스코드', tags: ['classic'] },
  { cityId: 'london', category: 'shopping', name: '해러즈', nameLocal: 'Harrods', area: '나이츠브리지', description: '1834년 개점 명품 백화점', tags: ['classic'] },
  { cityId: 'london', category: 'nature', name: '하이드 파크', nameLocal: 'Hyde Park', area: '웨스트민스터', description: '시민 일상 공간·서펜타인 호수', tags: ['classic', 'family'] },

  // ───────── 🇮🇹 로마 Rome ─────────
  { cityId: 'rome', category: 'attraction', name: '콜로세움', nameLocal: 'Colosseo', area: '콜로세오', description: '검투사 경기장·지하 투어 추천', tags: ['classic'] },
  { cityId: 'rome', category: 'attraction', name: '판테온', nameLocal: 'Pantheon', area: '콜론나', description: '천장 오쿨루스·2023 유료 전환', tags: ['classic'] },
  { cityId: 'rome', category: 'attraction', name: '트레비 분수', nameLocal: 'Fontana di Trevi', area: '트레비', description: '동전 던지기 의식·야간 조명', tags: ['classic', 'night'] },
  { cityId: 'rome', category: 'attraction', name: '바티칸 시국', nameLocal: 'Città del Vaticano', area: '바티칸', description: '성베드로 대성당+쿠폴라 등반', tags: ['classic'] },
  { cityId: 'rome', category: 'museum', name: '바티칸 박물관', nameLocal: 'Musei Vaticani', area: '바티칸', description: '시스티나 예배당·새벽 입장권', tags: ['classic'] },
  { cityId: 'rome', category: 'museum', name: '보르게세 미술관', nameLocal: 'Galleria Borghese', area: '핀치아노', description: '베르니니 조각·시간제 예약', tags: ['classic', 'hidden'] },
  { cityId: 'rome', category: 'food', name: '로쇼리', nameLocal: 'Roscioli', area: '캄포 데 피오리', description: '카르보나라 성지·살루메리아', tags: ['trending', 'local'] },
  { cityId: 'rome', category: 'food', name: '피자리움', nameLocal: 'Pizzarium', area: '트리온팔레', description: '봉치의 사각피자 한 입', tags: ['local', 'budget'] },
  { cityId: 'rome', category: 'shopping', name: '캄포 데 피오리 시장', nameLocal: 'Mercato Campo de Fiori', area: '캄포 데 피오리', description: '아침 청과·향신료 노천시장', tags: ['local'] },
  { cityId: 'rome', category: 'experience', name: '트라스테베레 야간 산책', nameLocal: 'Trastevere by Night', area: '트라스테베레', description: '골목 와인바 투어', tags: ['night', 'local'] },

  // ───────── 🇪🇸 바르셀로나 Barcelona ─────────
  { cityId: 'barcelona', category: 'attraction', name: '사그라다 파밀리아', nameLocal: 'Sagrada Família', area: '에이샴플레', description: '2026 주탑 완공·가우디 대표작', tags: ['classic', 'trending'] },
  { cityId: 'barcelona', category: 'attraction', name: '카사 바트요', nameLocal: 'Casa Batlló', area: '에이샴플레', description: '가우디 곡선 파사드·야간 투어', tags: ['classic', 'night'] },
  { cityId: 'barcelona', category: 'attraction', name: '구엘 공원', nameLocal: 'Park Güell', area: '그라시아', description: '모자이크 도롱뇽·사전 예약제', tags: ['classic', 'photogenic'] },
  { cityId: 'barcelona', category: 'attraction', name: '고딕 지구 대성당', nameLocal: 'Catedral de Barcelona', area: '고딕 지구', description: '13세기 회랑·옥상 개방', tags: ['classic'] },
  { cityId: 'barcelona', category: 'museum', name: '피카소 미술관', nameLocal: 'Museu Picasso', area: '보른', description: '청년기 작품·일요 오후 무료', tags: ['classic', 'budget'] },
  { cityId: 'barcelona', category: 'museum', name: '호안 미로 미술관', nameLocal: 'Fundació Joan Miró', area: '몬주익', description: '산 위 미로 전용관', tags: ['hidden'] },
  { cityId: 'barcelona', category: 'food', name: '보케리아 시장', nameLocal: 'Mercat de la Boqueria', area: '라발', description: '람블라스 옆 식재료 시장', tags: ['classic', 'local'] },
  { cityId: 'barcelona', category: 'food', name: '디스프루타르', nameLocal: 'Disfrutar', area: '에이샴플레', description: '2024 World 50 Best 1위 ⭐⭐⭐', tags: ['michelin', 'trending'] },
  { cityId: 'barcelona', category: 'shopping', name: '파세이그 데 그라시아', nameLocal: 'Passeig de Gràcia', area: '그라시아', description: '가우디 건축+명품 거리', tags: ['classic'] },
  { cityId: 'barcelona', category: 'nature', name: '바르셀로네타 해변', nameLocal: 'Platja de la Barceloneta', area: '바르셀로네타', description: '도심 옆 해변·타파스 바', tags: ['local'] },

  // ───────── 🇪🇸 마드리드 Madrid ─────────
  { cityId: 'madrid', category: 'attraction', name: '마요르 광장', nameLocal: 'Plaza Mayor', area: '센트로', description: '17세기 적색 회랑 광장', tags: ['classic'] },
  { cityId: 'madrid', category: 'attraction', name: '왕궁', nameLocal: 'Palacio Real', area: '센트로', description: '유럽 최대급 궁전·알무데나 옆', tags: ['classic'] },
  { cityId: 'madrid', category: 'attraction', name: '푸에르타 델 솔', nameLocal: 'Puerta del Sol', area: '센트로', description: '0km 표지석·새해 카운트다운', tags: ['classic'] },
  { cityId: 'madrid', category: 'museum', name: '프라도 미술관', nameLocal: 'Museo del Prado', area: '레티로', description: '벨라스케스·고야·18시 후 무료', tags: ['classic', 'budget'] },
  { cityId: 'madrid', category: 'museum', name: '레이나 소피아', nameLocal: 'Museo Reina Sofía', area: '아토차', description: '피카소 게르니카 소장', tags: ['classic'] },
  { cityId: 'madrid', category: 'museum', name: '티센 보르네미사', nameLocal: 'Museo Thyssen-Bornemisza', area: '레티로', description: '황금 트라이앵글 미술관 마지막', tags: ['classic'] },
  { cityId: 'madrid', category: 'food', name: '산 미겔 시장', nameLocal: 'Mercado de San Miguel', area: '센트로', description: '타파스 1입씩 도는 미식 시장', tags: ['trending', 'local'] },
  { cityId: 'madrid', category: 'food', name: '보틴', nameLocal: 'Sobrino de Botín', area: '라 라티나', description: '1725년 세계 최古·새끼돼지 구이', tags: ['classic'] },
  { cityId: 'madrid', category: 'shopping', name: '엘 라스트로', nameLocal: 'El Rastro', area: '라 라티나', description: '일요일 벼룩시장', tags: ['local', 'budget'] },
  { cityId: 'madrid', category: 'nature', name: '레티로 공원', nameLocal: 'Parque del Retiro', area: '레티로', description: '유리 궁전·뱃놀이·유네스코', tags: ['classic', 'family'] },

  // ───────── 🇮🇹 밀라노 Milan ─────────
  { cityId: 'milan', category: 'attraction', name: '밀라노 두오모', nameLocal: 'Duomo di Milano', area: '두오모', description: '대리석 첨탑 옥상 워크', tags: ['classic'] },
  { cityId: 'milan', category: 'attraction', name: '비토리오 에마누엘레 갤러리아', nameLocal: 'Galleria Vittorio Emanuele II', area: '두오모', description: '황소 모자이크 회전 의식', tags: ['classic', 'photogenic'] },
  { cityId: 'milan', category: 'attraction', name: '스포르체스코 성', nameLocal: 'Castello Sforzesco', area: '카스텔로', description: '다 빈치 벽화·르네상스 성', tags: ['classic'] },
  { cityId: 'milan', category: 'museum', name: '최후의 만찬', nameLocal: 'Cenacolo Vinciano', area: '마젠타', description: '산타마리아 수도원·3개월 전 예약', tags: ['classic', 'hidden'] },
  { cityId: 'milan', category: 'museum', name: '브레라 미술관', nameLocal: 'Pinacoteca di Brera', area: '브레라', description: '라파엘로·카라바조·2024 리뉴얼', tags: ['classic'] },
  { cityId: 'milan', category: 'museum', name: '프라다 재단', nameLocal: 'Fondazione Prada', area: '라르고 이솔라초', description: '웨스 앤더슨 바 Luce 입점', tags: ['trending', 'photogenic'] },
  { cityId: 'milan', category: 'food', name: '트라투리아 마수엘리', nameLocal: 'Trattoria Masuelli', area: '포르타 로마나', description: '사프란 리조토 노포', tags: ['local'] },
  { cityId: 'milan', category: 'food', name: '파스티체리아 마르케시', nameLocal: 'Pasticceria Marchesi', area: '몬테 나폴레오네', description: '프라다 인수 1824년 파티세리', tags: ['classic', 'trending'] },
  { cityId: 'milan', category: 'shopping', name: '몬테 나폴레오네 거리', nameLocal: 'Via Monte Napoleone', area: '콰드릴라테로', description: '2024 세계 1위 명품 거리', tags: ['classic'] },
  { cityId: 'milan', category: 'experience', name: '나빌리 운하', nameLocal: 'Navigli', area: '나빌리', description: '다 빈치 설계 운하·아페리티보', tags: ['trending', 'night'] },

  // ───────── 🇩🇪 베를린 Berlin ─────────
  { cityId: 'berlin', category: 'attraction', name: '브란덴부르크 문', nameLocal: 'Brandenburger Tor', area: '미테', description: '통일 상징·광장 야경', tags: ['classic'] },
  { cityId: 'berlin', category: 'attraction', name: '이스트 사이드 갤러리', nameLocal: 'East Side Gallery', area: '프리드리히스하인', description: '1.3km 베를린 장벽 벽화', tags: ['classic', 'photogenic'] },
  { cityId: 'berlin', category: 'attraction', name: '라이히스타크 돔', nameLocal: 'Reichstag Kuppel', area: '미테', description: '노먼 포스터 유리돔·무료 예약', tags: ['classic', 'budget'] },
  { cityId: 'berlin', category: 'attraction', name: '홀로코스트 메모리얼', nameLocal: 'Stelenfeld', area: '미테', description: '2,711개 콘크리트 블록', tags: ['classic'] },
  { cityId: 'berlin', category: 'museum', name: '페르가몬 박물관', nameLocal: 'Pergamonmuseum', area: '무제움스인젤', description: '일부 폐관 중·2027 재개관 예정', tags: ['classic'] },
  { cityId: 'berlin', category: 'museum', name: '노이에 나치오날갤러리', nameLocal: 'Neue Nationalgalerie', area: '쿨투어포룸', description: '미스 반 데어 로에·2021 재개관', tags: ['trending'] },
  { cityId: 'berlin', category: 'museum', name: '함부르거 반호프', nameLocal: 'Hamburger Bahnhof', area: '모아빗', description: '옛 기차역 현대미술관·2024 확장', tags: ['trending'] },
  { cityId: 'berlin', category: 'food', name: '무스타파 케밥', nameLocal: "Mustafa's Gemüse Kebap", area: '크로이츠베르크', description: '야채 케밥 원조·줄서기 명물', tags: ['local', 'budget'] },
  { cityId: 'berlin', category: 'food', name: '마르크트할레 노이엔', nameLocal: 'Markthalle Neun', area: '크로이츠베르크', description: '목요 스트리트 푸드 데이', tags: ['trending', 'local'] },
  { cityId: 'berlin', category: 'shopping', name: 'KaDeWe', area: '쇼이네베르크', description: '6층 식품관·OMA 리뉴얼', tags: ['classic'] },

  // ───────── 🇦🇹 비엔나 Vienna ─────────
  { cityId: 'vienna', category: 'attraction', name: '쇤브룬 궁전', nameLocal: 'Schloss Schönbrunn', area: '13구', description: '합스부르크 여름궁·글로리에테', tags: ['classic'] },
  { cityId: 'vienna', category: 'attraction', name: '호프부르크 왕궁', nameLocal: 'Hofburg', area: '1구', description: '시시 박물관+스페인 승마학교', tags: ['classic'] },
  { cityId: 'vienna', category: 'attraction', name: '슈테판 대성당', nameLocal: 'Stephansdom', area: '1구', description: '다채 타일 지붕·남탑 등반', tags: ['classic'] },
  { cityId: 'vienna', category: 'museum', name: '벨베데레', nameLocal: 'Belvedere', area: '3구', description: '클림트 키스 원본 소장', tags: ['classic'] },
  { cityId: 'vienna', category: 'museum', name: '알베르티나', nameLocal: 'Albertina', area: '1구', description: '모네·뒤러 그래픽 컬렉션', tags: ['classic'] },
  { cityId: 'vienna', category: 'museum', name: '레오폴드 미술관', nameLocal: 'Leopold Museum', area: '7구 무제움스크바르티에', description: '에곤 실레 최대 컬렉션', tags: ['hidden'] },
  { cityId: 'vienna', category: 'food', name: '카페 첸트랄', nameLocal: 'Café Central', area: '1구', description: '1876년 문학 카페·멜랑쥐', tags: ['classic'] },
  { cityId: 'vienna', category: 'food', name: '데멜', nameLocal: 'Demel', area: '1구', description: '황실 제과점·자허토르테', tags: ['classic'] },
  { cityId: 'vienna', category: 'shopping', name: '나슈마르크트', nameLocal: 'Naschmarkt', area: '6구', description: '1786년 시작 식재료 시장', tags: ['local'] },
  { cityId: 'vienna', category: 'experience', name: '빈 국립 오페라', nameLocal: 'Wiener Staatsoper', area: '1구', description: '입석 4유로·세계 오페라 중심', tags: ['classic', 'budget'] },

  // ───────── 🇨🇿 프라하 Prague ─────────
  { cityId: 'prague', category: 'attraction', name: '프라하 성', nameLocal: 'Pražský hrad', area: '흐라트차니', description: '세계 최대급 고대 성곽', tags: ['classic'] },
  { cityId: 'prague', category: 'attraction', name: '카를교', nameLocal: 'Karlův most', area: '말라스트라나', description: '30개 바로크 조각상 다리', tags: ['classic', 'photogenic'] },
  { cityId: 'prague', category: 'attraction', name: '천문 시계', nameLocal: 'Pražský orloj', area: '구시가지', description: '매시 정각 사도 행진·1410년', tags: ['classic'] },
  { cityId: 'prague', category: 'attraction', name: '틴 성당', nameLocal: 'Týnský chrám', area: '구시가지', description: '쌍둥이 첨탑·광장 랜드마크', tags: ['classic'] },
  { cityId: 'prague', category: 'museum', name: '무하 미술관', nameLocal: 'Muchovo muzeum', area: '신시가지', description: '아르누보 거장 전용관', tags: ['classic'] },
  { cityId: 'prague', category: 'museum', name: 'DOX 현대미술센터', nameLocal: 'DOX', area: '홀레쇼비체', description: '옛 공장 개조·비행선 설치', tags: ['hidden', 'trending'] },
  { cityId: 'prague', category: 'food', name: '로칼', nameLocal: 'Lokál Dlouhááá', area: '구시가지', description: '정통 체코 펍·필스너 탱크맥주', tags: ['local', 'trending'] },
  { cityId: 'prague', category: 'food', name: '카페 사보이', nameLocal: 'Café Savoy', area: '스미호프', description: '1893년 네오 르네상스 카페', tags: ['classic'] },
  { cityId: 'prague', category: 'shopping', name: '하벨 시장', nameLocal: 'Havelské tržiště', area: '구시가지', description: '13세기부터 운영 중인 시장', tags: ['local'] },
  { cityId: 'prague', category: 'nature', name: '페트르진 언덕', nameLocal: 'Petřín', area: '말라스트라나', description: '푸니쿨라로 오르는 미니 에펠탑', tags: ['family', 'photogenic'] },

  // ───────── 🇳🇱 암스테르담 Amsterdam ─────────
  { cityId: 'amsterdam', category: 'attraction', name: '담 광장', nameLocal: 'Dam Square', area: '센트룸', description: '왕궁·뉴어케르크 면한 도심 광장', tags: ['classic'] },
  { cityId: 'amsterdam', category: 'attraction', name: '안네 프랑크의 집', nameLocal: 'Anne Frank Huis', area: '요르단', description: '6주 전 온라인 예약 필수', tags: ['classic'] },
  { cityId: 'amsterdam', category: 'attraction', name: '신트 니콜라스 성당', nameLocal: 'Basiliek Sint Nicolaas', area: '센트룸', description: '중앙역 옆 신로마네스크', tags: ['hidden'] },
  { cityId: 'amsterdam', category: 'museum', name: '국립 박물관', nameLocal: 'Rijksmuseum', area: '뮤지엄플레인', description: '렘브란트 야경+페르메이르', tags: ['classic'] },
  { cityId: 'amsterdam', category: 'museum', name: '반 고흐 미술관', nameLocal: 'Van Gogh Museum', area: '뮤지엄플레인', description: '200점 최대 컬렉션·시간제 예약', tags: ['classic'] },
  { cityId: 'amsterdam', category: 'museum', name: '모코 미술관', nameLocal: 'Moco Museum', area: '뮤지엄플레인', description: '뱅크시·카우스 현대 스트릿', tags: ['trending'] },
  { cityId: 'amsterdam', category: 'food', name: '판네쾨켄부트', nameLocal: 'Pannenkoekenboot', area: '노르트', description: '운하 위 팬케이크 크루즈', tags: ['family'] },
  { cityId: 'amsterdam', category: 'food', name: '푸드할렌', nameLocal: 'Foodhallen', area: '아우드웨스트', description: '옛 트램 차고지 푸드코트', tags: ['trending', 'local'] },
  { cityId: 'amsterdam', category: 'shopping', name: '알베르트 카위프 시장', nameLocal: 'Albert Cuypmarkt', area: '더 페이프', description: '네덜란드 최대 길거리 시장', tags: ['local'] },
  { cityId: 'amsterdam', category: 'nature', name: '폰덜 공원', nameLocal: 'Vondelpark', area: '아우드 자위트', description: '시민 자전거·피크닉 명소', tags: ['classic', 'family'] },

  // ───────── 🇹🇷 이스탄불 Istanbul ─────────
  { cityId: 'istanbul', category: 'attraction', name: '아야 소피아', nameLocal: 'Ayasofya', area: '술탄아흐메트', description: '2024부터 외국인 25유로 입장료', tags: ['classic', 'trending'] },
  { cityId: 'istanbul', category: 'attraction', name: '블루 모스크', nameLocal: 'Sultanahmet Camii', area: '술탄아흐메트', description: '2023 복원 완료·6개 미나레트', tags: ['classic'] },
  { cityId: 'istanbul', category: 'attraction', name: '톱카프 궁전', nameLocal: 'Topkapı Sarayı', area: '술탄아흐메트', description: '오스만 술탄 거처·하렘 별도', tags: ['classic'] },
  { cityId: 'istanbul', category: 'attraction', name: '갈라타 타워', nameLocal: 'Galata Kulesi', area: '베이올루', description: '보스포루스 360도 전망', tags: ['classic', 'night'] },
  { cityId: 'istanbul', category: 'museum', name: '이스탄불 모던', nameLocal: 'İstanbul Modern', area: '카라쾨이', description: '렌조 피아노 설계·2023 신관', tags: ['trending'] },
  { cityId: 'istanbul', category: 'museum', name: '고고학 박물관', nameLocal: 'Arkeoloji Müzeleri', area: '술탄아흐메트', description: '알렉산더 석관 보유', tags: ['hidden'] },
  { cityId: 'istanbul', category: 'food', name: '차야 한', nameLocal: 'Çiya Sofrası', area: '카드쾨이', description: '아나톨리아 향토 요리 성지', tags: ['local', 'trending'] },
  { cityId: 'istanbul', category: 'food', name: '카라쾨이 귤뤼올루', nameLocal: 'Karaköy Güllüoğlu', area: '카라쾨이', description: '1820년 시작 바클라바 본가', tags: ['classic', 'local'] },
  { cityId: 'istanbul', category: 'shopping', name: '그랜드 바자', nameLocal: 'Kapalı Çarşı', area: '베야지트', description: '4,000개 점포 600년 시장', tags: ['classic'] },
  { cityId: 'istanbul', category: 'experience', name: '보스포루스 페리 크루즈', nameLocal: 'Boğaz Vapuru', area: '에미뇌뉘', description: '유럽-아시아 횡단 90분', tags: ['local', 'budget'] },

  // ───────── 🇹🇷 안탈리아 Antalya ─────────
  { cityId: 'antalya', category: 'attraction', name: '칼레이치 구시가지', nameLocal: 'Kaleiçi', area: '무라트파샤', description: '오스만 목조가옥+항구', tags: ['classic'] },
  { cityId: 'antalya', category: 'attraction', name: '하드리아누스 문', nameLocal: 'Hadrian Kapısı', area: '칼레이치', description: '130년 로마 황제 방문 기념문', tags: ['classic'] },
  { cityId: 'antalya', category: 'attraction', name: '이블리 미나레', nameLocal: 'Yivli Minare', area: '칼레이치', description: '셀주크 시대 8각 첨탑', tags: ['classic'] },
  { cityId: 'antalya', category: 'attraction', name: '뒤덴 폭포', nameLocal: 'Düden Şelalesi', area: '라라', description: '절벽서 지중해로 직낙하', tags: ['photogenic'] },
  { cityId: 'antalya', category: 'museum', name: '안탈리아 고고학 박물관', nameLocal: 'Antalya Müzesi', area: '콘얄트', description: '페르게 출토 로마 조각상', tags: ['classic', 'hidden'] },
  { cityId: 'antalya', category: 'museum', name: '수나-인난 크라치 박물관', nameLocal: 'Suna-İnan Kıraç Müzesi', area: '칼레이치', description: '19세기 안탈리아 생활상 복원', tags: ['hidden'] },
  { cityId: 'antalya', category: 'food', name: '7 메흐메트', nameLocal: '7 Mehmet', area: '콘얄트', description: '1937년 시작 정통 케밥 명가', tags: ['local', 'classic'] },
  { cityId: 'antalya', category: 'food', name: '비스트로 사이드', nameLocal: 'Bistro Side', area: '칼레이치', description: '항구 뷰 메제·해산물', tags: ['trending'] },
  { cityId: 'antalya', category: 'shopping', name: '칼레이치 바자르', nameLocal: 'Kaleiçi Bazaar', area: '칼레이치', description: '향신료·수공예품 골목 시장', tags: ['local'] },
  { cityId: 'antalya', category: 'nature', name: '콘얄트 해변', nameLocal: 'Konyaaltı Plajı', area: '콘얄트', description: '토로스 산맥 배경 자갈 해변', tags: ['family', 'photogenic'] },

  // ───────── 🇺🇸 뉴욕 New York ─────────
  { cityId: 'newyork', category: 'attraction', name: '자유의 여신상', nameLocal: 'Statue of Liberty', area: '리버티아일랜드', description: '미국 상징·페리로 입장', tags: ['classic'] },
  { cityId: 'newyork', category: 'attraction', name: '엠파이어 스테이트 빌딩', nameLocal: 'Empire State Building', area: '맨해튼·미드타운', description: '102층 전망대 야경 명소', tags: ['classic', 'night'] },
  { cityId: 'newyork', category: 'attraction', name: '브루클린 브리지', nameLocal: 'Brooklyn Bridge', area: '브루클린', description: '도보 횡단·스카이라인 뷰', tags: ['photogenic'] },
  { cityId: 'newyork', category: 'attraction', name: '서밋 원 밴더빌트', nameLocal: 'Summit One Vanderbilt', area: '맨해튼·미드타운', description: '거울 전망대 2021 오픈', tags: ['trending', 'photogenic'] },
  { cityId: 'newyork', category: 'food', name: '카츠 델리', nameLocal: "Katz's Delicatessen", area: '맨해튼·로어이스트', description: '1888년 파스트라미 샌드위치', tags: ['classic', 'local'] },
  { cityId: 'newyork', category: 'food', name: '르 베르나르댕', nameLocal: 'Le Bernardin', area: '맨해튼·미드타운', description: '미슐랭 3⭐ 시푸드', tags: ['michelin'] },
  { cityId: 'newyork', category: 'food', name: '조스 피자', nameLocal: "Joe's Pizza", area: '맨해튼·그리니치빌리지', description: 'NY 클래식 슬라이스', tags: ['budget', 'local'] },
  { cityId: 'newyork', category: 'museum', name: '메트로폴리탄 박물관', nameLocal: 'The Met', area: '맨해튼·어퍼이스트', description: '200만점 세계 최대급 컬렉션', tags: ['classic'] },
  { cityId: 'newyork', category: 'shopping', name: '첼시 마켓', nameLocal: 'Chelsea Market', area: '맨해튼·첼시', description: '푸드홀+부티크 복합 시장', tags: ['trending'] },
  { cityId: 'newyork', category: 'experience', name: '엣지 NYC', nameLocal: 'Edge NYC', area: '맨해튼·허드슨야드', description: '서반구 최고 야외 전망대', tags: ['trending', 'photogenic'] },

  // ───────── 🇺🇸 LA Los Angeles ─────────
  { cityId: 'losangeles', category: 'attraction', name: '그리피스 천문대', nameLocal: 'Griffith Observatory', area: '로스펠리즈', description: 'LA 야경·할리우드 사인 뷰', tags: ['classic', 'night'] },
  { cityId: 'losangeles', category: 'attraction', name: '할리우드 사인', nameLocal: 'Hollywood Sign', area: '할리우드힐스', description: 'LA 상징 산비탈 사인', tags: ['classic', 'photogenic'] },
  { cityId: 'losangeles', category: 'attraction', name: '워크 오브 페임', nameLocal: 'Hollywood Walk of Fame', area: '할리우드', description: '스타 이름 박힌 명예의 거리', tags: ['classic'] },
  { cityId: 'losangeles', category: 'food', name: "레오스 타코스", nameLocal: "Leo's Tacos", area: '다운타운', description: 'LA 대표 알 파스토르 트럭', tags: ['local', 'budget'] },
  { cityId: 'losangeles', category: 'food', name: '인앤아웃 버거', nameLocal: 'In-N-Out Burger', area: '시내 다수', description: '캘리포니아 패스트푸드 성지', tags: ['classic', 'budget'] },
  { cityId: 'losangeles', category: 'food', name: '베스퍼틴', nameLocal: 'Vespertine', area: '컬버시티', description: '미슐랭 2⭐ 모더니즘', tags: ['michelin'] },
  { cityId: 'losangeles', category: 'museum', name: '더 게티 센터', nameLocal: 'The Getty Center', area: '브렌트우드', description: '무료 입장 언덕 위 미술관', tags: ['classic'] },
  { cityId: 'losangeles', category: 'museum', name: '더 브로드', nameLocal: 'The Broad', area: '다운타운', description: '현대미술·쿠사마 인피니티룸', tags: ['trending', 'photogenic'] },
  { cityId: 'losangeles', category: 'shopping', name: '산타모니카 피어', nameLocal: 'Santa Monica Pier', area: '산타모니카', description: '루트66 종착·놀이공원 부두', tags: ['classic', 'family'] },
  { cityId: 'losangeles', category: 'nature', name: '엘 마타도르 비치', nameLocal: 'El Matador Beach', area: '말리부', description: '바위 절벽의 숨은 해변', tags: ['hidden', 'beach'] },

  // ───────── 🇺🇸 라스베가스 Las Vegas ─────────
  { cityId: 'lasvegas', category: 'attraction', name: '스피어', nameLocal: 'Sphere', area: '스트립 동쪽', description: '2023 오픈 LED 구체 공연장', tags: ['trending', 'night'] },
  { cityId: 'lasvegas', category: 'attraction', name: '벨라지오 분수쇼', nameLocal: 'Bellagio Fountains', area: '스트립 중앙', description: '무료 음악 분수쇼 야간 명물', tags: ['classic', 'night'] },
  { cityId: 'lasvegas', category: 'attraction', name: '프리몬트 스트리트', nameLocal: 'Fremont Street Experience', area: '다운타운', description: 'LED 캐노피·올드베가스', tags: ['classic', 'night'] },
  { cityId: 'lasvegas', category: 'experience', name: '하이 롤러', nameLocal: 'The High Roller', area: '더 링크 프롬나드', description: '167m 세계급 대관람차', tags: ['photogenic'] },
  { cityId: 'lasvegas', category: 'experience', name: '그랜드 캐년 사우스림', nameLocal: 'Grand Canyon South Rim', area: '애리조나(당일투어)', description: '일출 헬기·경비행 인기', tags: ['classic'] },
  { cityId: 'lasvegas', category: 'experience', name: '앤텔로프 캐년', nameLocal: 'Antelope Canyon', area: '페이지·애리조나', description: '빛내림 슬롯캐년 투어', tags: ['photogenic'] },
  { cityId: 'lasvegas', category: 'food', name: '카르본', nameLocal: 'Carbone', area: '아리아 리조트', description: '뉴욕 인기 이탈리안 분점', tags: ['trending'] },
  { cityId: 'lasvegas', category: 'food', name: '조엘 로부숑', nameLocal: 'Joël Robuchon', area: 'MGM 그랜드', description: '미슐랭 3⭐ 프렌치', tags: ['michelin'] },
  { cityId: 'lasvegas', category: 'shopping', name: '포럼 숍스', nameLocal: 'Forum Shops at Caesars', area: '시저스팰리스', description: '로마풍 쇼핑몰 명품가', tags: ['classic'] },
  { cityId: 'lasvegas', category: 'nature', name: '레드락 캐년', nameLocal: 'Red Rock Canyon', area: '베가스 서쪽 30분', description: '붉은 사암 드라이브 코스', tags: ['hidden'] },

  // ───────── 🇲🇽 칸쿤 Cancún ─────────
  { cityId: 'cancun', category: 'nature', name: '플라야 델피네스', nameLocal: 'Playa Delfines', area: '호텔존 남단', description: '칸쿤 사인·공용 해변', tags: ['classic', 'beach'] },
  { cityId: 'cancun', category: 'nature', name: '이슬라 무헤레스', nameLocal: 'Isla Mujeres', area: '칸쿤 북쪽 페리', description: '청록 바다 자전거 섬', tags: ['beach', 'family'] },
  { cityId: 'cancun', category: 'attraction', name: '치첸이트사', nameLocal: 'Chichén Itzá', area: '유카탄(당일투어)', description: '마야 7대 불가사의 피라미드', tags: ['classic'] },
  { cityId: 'cancun', category: 'attraction', name: '툴룸 유적', nameLocal: 'Tulum Ruins', area: '툴룸', description: '카리브해 절벽의 마야 성벽', tags: ['classic', 'photogenic'] },
  { cityId: 'cancun', category: 'experience', name: '세노테 익킬', nameLocal: 'Cenote Ik Kil', area: '치첸이트사 인근', description: '원형 싱크홀 수영 명소', tags: ['photogenic'] },
  { cityId: 'cancun', category: 'experience', name: '셀하 파크', nameLocal: 'Xel-Há Park', area: '리비에라마야', description: '자연 수족관 스노클링', tags: ['family'] },
  { cityId: 'cancun', category: 'food', name: '라 하비체리아', nameLocal: 'La Habichuela', area: '다운타운', description: '마야풍 시푸드 노포', tags: ['local'] },
  { cityId: 'cancun', category: 'food', name: '로스 페스카디토스', nameLocal: 'Los Pescaditos', area: '다운타운', description: '현지인 새우 타코 맛집', tags: ['budget', 'local'] },
  { cityId: 'cancun', category: 'museum', name: '마야 박물관', nameLocal: 'Museo Maya de Cancún', area: '호텔존', description: '유카탄 마야 유물 전시', tags: ['classic'] },
  { cityId: 'cancun', category: 'shopping', name: '메르카도 28', nameLocal: 'Mercado 28', area: '다운타운', description: '기념품·로컬 식당 시장', tags: ['local'] },

  // ───────── 🇺🇸 호놀룰루 Honolulu ─────────
  { cityId: 'honolulu', category: 'nature', name: '와이키키 비치', nameLocal: 'Waikiki Beach', area: '와이키키', description: '하와이 대표 도심 해변', tags: ['classic', 'beach'] },
  { cityId: 'honolulu', category: 'nature', name: '다이아몬드 헤드', nameLocal: 'Diamond Head', area: '와이키키 동쪽', description: '분화구 트레킹 정상 뷰', tags: ['classic', 'photogenic'] },
  { cityId: 'honolulu', category: 'nature', name: '하나우마 베이', nameLocal: 'Hanauma Bay', area: '동남 해안', description: '보존 산호초 스노클링', tags: ['beach'] },
  { cityId: 'honolulu', category: 'nature', name: '노스쇼어 선셋 비치', nameLocal: 'Sunset Beach (North Shore)', area: '노스쇼어', description: '겨울 빅웨이브 서핑 성지', tags: ['local', 'beach'] },
  { cityId: 'honolulu', category: 'attraction', name: '진주만 USS 애리조나', nameLocal: 'Pearl Harbor / USS Arizona', area: '진주만', description: '2차대전 추모관·무료 입장', tags: ['classic'] },
  { cityId: 'honolulu', category: 'attraction', name: '이올라니 궁전', nameLocal: 'ʻIolani Palace', area: '다운타운', description: '미국 유일의 왕궁', tags: ['hidden'] },
  { cityId: 'honolulu', category: 'food', name: '마루카메 우동', nameLocal: 'Marukame Udon', area: '와이키키', description: '가성비 우동·줄서는 맛집', tags: ['budget', 'local'] },
  { cityId: 'honolulu', category: 'food', name: '헬레나스 하와이안 푸드', nameLocal: "Helena's Hawaiian Food", area: '칼리히', description: '1946년 칼루아 포크 노포', tags: ['local'] },
  { cityId: 'honolulu', category: 'shopping', name: '알라모아나 센터', nameLocal: 'Ala Moana Center', area: '알라모아나', description: '세계 최대급 야외 쇼핑몰', tags: ['classic'] },
  { cityId: 'honolulu', category: 'experience', name: '쿠알로아 랜치', nameLocal: 'Kualoa Ranch', area: '동부 해안', description: '쥬라기공원 촬영지 ATV투어', tags: ['trending', 'family'] },

  // ───────── 🇬🇺 괌 Guam ─────────
  { cityId: 'guam', category: 'nature', name: '투몬 비치', nameLocal: 'Tumon Beach', area: '투몬', description: '괌 대표 호텔존 백사장', tags: ['classic', 'beach'] },
  { cityId: 'guam', category: 'nature', name: '사랑의 절벽', nameLocal: 'Two Lovers Point', area: '투몬 북단', description: '전설의 122m 절벽 전망대', tags: ['classic', 'photogenic'] },
  { cityId: 'guam', category: 'nature', name: '이나라한 자연풀', nameLocal: 'Inarajan Natural Pool', area: '남부 이나라한', description: '자연 암석 수영장', tags: ['hidden'] },
  { cityId: 'guam', category: 'experience', name: '언더워터 월드', nameLocal: 'UnderWater World Guam', area: '투몬', description: '100m 해저터널 수족관', tags: ['family'] },
  { cityId: 'guam', category: 'experience', name: '돌핀 크루즈', nameLocal: 'Dolphin Watching Cruise', area: '아프라항', description: '야생 돌고래 보트 투어', tags: ['family'] },
  { cityId: 'guam', category: 'shopping', name: '차모로 빌리지 야시장', nameLocal: 'Chamorro Village Night Market', area: '하갓냐', description: '수요일 BBQ·로컬 음식 야시장', tags: ['local', 'night'] },
  { cityId: 'guam', category: 'shopping', name: '마이크로네시아 몰', nameLocal: 'Micronesia Mall', area: '데데도', description: '괌 최대 실내 쇼핑몰', tags: ['classic'] },
  { cityId: 'guam', category: 'food', name: '프로아', nameLocal: 'PROA', area: '투몬', description: '차모로식 BBQ 인기 식당', tags: ['local'] },
  { cityId: 'guam', category: 'food', name: '메스클라 도스', nameLocal: 'Meskla Dos', area: '데데도', description: '차모로 퓨전 버거 맛집', tags: ['local', 'budget'] },
  { cityId: 'guam', category: 'attraction', name: '라테스톤 공원', nameLocal: 'Latte Stone Park', area: '하갓냐', description: '차모로 고대 석주 유적', tags: ['classic'] },

  // ───────── 🇦🇪 두바이 Dubai ─────────
  { cityId: 'dubai', category: 'attraction', name: '부르즈 할리파', nameLocal: 'Burj Khalifa', area: '다운타운 두바이', description: '828m 세계 최고층 빌딩', tags: ['classic', 'night'] },
  { cityId: 'dubai', category: 'attraction', name: '미래 박물관', nameLocal: 'Museum of the Future', area: '셰이크 자이드 로드', description: '2022 오픈 은빛 타원 건축', tags: ['trending', 'photogenic'] },
  { cityId: 'dubai', category: 'attraction', name: '팜 주메이라', nameLocal: 'Palm Jumeirah', area: '팜 주메이라', description: '야자수형 인공섬·아틀란티스', tags: ['classic'] },
  { cityId: 'dubai', category: 'attraction', name: '두바이 프레임', nameLocal: 'Dubai Frame', area: '자빌 공원', description: '150m 황금 액자형 전망대', tags: ['photogenic'] },
  { cityId: 'dubai', category: 'museum', name: '알 파히디 역사지구', nameLocal: 'Al Fahidi Historical District', area: '부르두바이', description: '옛 두바이 흙벽돌 골목', tags: ['hidden', 'local'] },
  { cityId: 'dubai', category: 'shopping', name: '두바이 몰', nameLocal: 'The Dubai Mall', area: '다운타운', description: '세계 최대급 몰·아쿠아리움', tags: ['classic', 'family'] },
  { cityId: 'dubai', category: 'shopping', name: '골드 수크', nameLocal: 'Gold Souk', area: '데이라', description: '전통 금시장 보석 골목', tags: ['local'] },
  { cityId: 'dubai', category: 'experience', name: '사막 사파리', nameLocal: 'Desert Safari (Lahbab)', area: '두바이 외곽 사막', description: '듄배싱+낙타+베두인 캠프', tags: ['classic', 'family'] },
  { cityId: 'dubai', category: 'experience', name: '아인 두바이', nameLocal: 'Ain Dubai', area: '블루워터스', description: '250m 세계 최대 관람차', tags: ['trending'] },
  { cityId: 'dubai', category: 'food', name: '오르팔리 브로스', nameLocal: 'Orfali Bros Bistro', area: '와슬', description: '시리아 형제 셰프 화제', tags: ['trending', 'michelin'] },

  // ───────── 🇦🇺 시드니 Sydney ─────────
  { cityId: 'sydney', category: 'attraction', name: '오페라 하우스', nameLocal: 'Sydney Opera House', area: '베넬롱 포인트', description: '조개껍질 지붕 세계유산', tags: ['classic', 'photogenic'] },
  { cityId: 'sydney', category: 'attraction', name: '하버 브리지', nameLocal: 'Sydney Harbour Bridge', area: '시드니 하버', description: '아치 등반 브리지클라임', tags: ['classic'] },
  { cityId: 'sydney', category: 'attraction', name: '더 록스', nameLocal: 'The Rocks', area: '시드니 CBD', description: '시드니 발상지·주말 마켓', tags: ['classic', 'local'] },
  { cityId: 'sydney', category: 'nature', name: '본다이 비치', nameLocal: 'Bondi Beach', area: '본다이', description: '시드니 대표 서핑 비치', tags: ['classic', 'beach'] },
  { cityId: 'sydney', category: 'nature', name: '본다이-쿠지 코스털 워크', nameLocal: 'Bondi to Coogee Walk', area: '동부 해안', description: '6km 해안 절벽 산책로', tags: ['photogenic'] },
  { cityId: 'sydney', category: 'nature', name: '블루마운틴 세 자매봉', nameLocal: 'Three Sisters, Blue Mountains', area: '카툼바(당일투어)', description: '유칼립투스 푸른 안개 절경', tags: ['classic'] },
  { cityId: 'sydney', category: 'museum', name: '뉴사우스웨일스 미술관', nameLocal: 'Art Gallery of NSW', area: '더 도메인', description: '2022 신관 시드니 모던', tags: ['trending'] },
  { cityId: 'sydney', category: 'food', name: '퀘이', nameLocal: 'Quay Restaurant', area: '서큘러 키', description: '오페라하우스 뷰 파인다이닝', tags: ['michelin'] },
  { cityId: 'sydney', category: 'food', name: '해리스 카페 드 휠스', nameLocal: "Harry's Café de Wheels", area: '울루물루', description: '1938년 미트파이 명소', tags: ['classic', 'budget'] },
  { cityId: 'sydney', category: 'shopping', name: 'QVB', nameLocal: 'Queen Victoria Building', area: '시드니 CBD', description: '빅토리아풍 쇼핑 아케이드', tags: ['classic'] },

  // ───────── 🇪🇬 카이로 Cairo ─────────
  { cityId: 'cairo', category: 'attraction', name: '기자 피라미드', nameLocal: 'Pyramids of Giza', area: '기자', description: '쿠푸왕 대피라미드·세계유산', tags: ['classic'] },
  { cityId: 'cairo', category: 'attraction', name: '스핑크스', nameLocal: 'Great Sphinx of Giza', area: '기자', description: '사자몸 인면상 거대 석상', tags: ['classic', 'photogenic'] },
  { cityId: 'cairo', category: 'attraction', name: '사카라 계단 피라미드', nameLocal: 'Saqqara Step Pyramid', area: '사카라', description: '최고(最古) 조세르왕 피라미드', tags: ['classic'] },
  { cityId: 'cairo', category: 'attraction', name: '살라딘 시타델', nameLocal: 'Citadel of Saladin', area: '올드카이로', description: '무함마드 알리 모스크', tags: ['classic'] },
  { cityId: 'cairo', category: 'museum', name: '그랜드 이집트 박물관', nameLocal: 'Grand Egyptian Museum (GEM)', area: '기자', description: '2024 정식 개관·투탕카멘', tags: ['trending'] },
  { cityId: 'cairo', category: 'museum', name: '국립 이집트 문명 박물관', nameLocal: 'NMEC', area: '푸스타트', description: '왕족 미라 갤러리 보유', tags: ['trending'] },
  { cityId: 'cairo', category: 'shopping', name: '칸 엘 칼릴리 시장', nameLocal: 'Khan el-Khalili', area: '올드카이로', description: '14C 전통 향신료·기념품 시장', tags: ['classic', 'local'] },
  { cityId: 'cairo', category: 'food', name: '아부 타렉', nameLocal: 'Abou Tarek', area: '다운타운', description: '이집트 국민음식 코샤리 명가', tags: ['local', 'budget'] },
  { cityId: 'cairo', category: 'food', name: '펠펠라', nameLocal: 'Felfela', area: '다운타운', description: '1959년 코샤리·팔라펠', tags: ['classic', 'local'] },
  { cityId: 'cairo', category: 'experience', name: '나일강 펠루카', nameLocal: 'Nile Felucca Sunset', area: '자말렉', description: '전통 돛단배 일몰 크루즈', tags: ['photogenic'] },

  // ───────── 🇸🇦 메카 Mecca (무슬림 한정) ─────────
  { cityId: 'mecca', category: 'attraction', name: '마스지드 알하람', nameLocal: 'Masjid al-Haram', area: '메카 중심부', description: '이슬람 최고 성지·카바 위치', tags: ['classic'] },
  { cityId: 'mecca', category: 'attraction', name: '카바 신전', nameLocal: 'The Kaaba', area: '마스지드 알하람 내', description: '키블라 방향 흑색 정육면체', tags: ['classic'] },
  { cityId: 'mecca', category: 'attraction', name: '흑석', nameLocal: 'Al-Hajar al-Aswad', area: '카바 동쪽 모서리', description: '순례자 입맞춤 신성한 돌', tags: ['classic'] },
  { cityId: 'mecca', category: 'attraction', name: '사파-마르와', nameLocal: 'As-Safa & Al-Marwah', area: '알하람 모스크 내', description: '사이 의례 두 언덕 통로', tags: ['classic'] },
  { cityId: 'mecca', category: 'attraction', name: '잠잠 우물', nameLocal: 'Zamzam Well', area: '알하람 모스크 지하', description: '순례자 성수 식수 우물', tags: ['classic'] },
  { cityId: 'mecca', category: 'attraction', name: '아비쿠바이스 산', nameLocal: 'Jabal Abu Qubays', area: '알하람 동편', description: '메카 최고(最古) 언덕', tags: ['hidden'] },
  { cityId: 'mecca', category: 'attraction', name: '자발 알누르(히라 동굴)', nameLocal: 'Jabal al-Nour / Hira Cave', area: '메카 북동', description: '첫 계시 받은 산·등반 가능', tags: ['classic'] },
  { cityId: 'mecca', category: 'attraction', name: '자발 알사우르', nameLocal: 'Jabal Thawr', area: '메카 남쪽', description: '히즈라 당시 은신 동굴 산', tags: ['hidden'] },
  { cityId: 'mecca', category: 'shopping', name: '아브라즈 알 베이트', nameLocal: 'Abraj Al-Bait / Clock Tower', area: '알하람 인접', description: '시계탑·몰·호텔 복합단지', tags: ['trending'] },
  { cityId: 'mecca', category: 'museum', name: '메카 박물관', nameLocal: 'Makkah Museum', area: '알자히르', description: '메카 역사·이슬람 유물 전시', tags: ['classic'] },
];
