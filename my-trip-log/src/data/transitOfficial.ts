/**
 * 도시별 공식 지하철 노선도 URL.
 * 한국어 페이지 우선, 없으면 영어 공식 페이지.
 * 운영사 사이트 구조 변경 시 여기만 수정하면 됨.
 *
 * 사용처:
 *  - app/(tabs)/tools.tsx (도구 탭 카드 → 인앱 transit 화면 진입)
 *  - app/transit/[city]/index.tsx (인앱 transit 화면 상단에서 "공식 노선도" 링크)
 */

export const OFFICIAL_TRANSIT_URLS: Record<string, { url: string; agency: string }> = {
  // 한국 — 한국어
  seoul: { url: 'https://www.seoulmetro.co.kr/kr/cyberStation.do', agency: '서울교통공사' },
  busan: { url: 'https://www.humetro.busan.kr/homepage/default/page/sub01_03_01.do?menuCd=00065', agency: '부산교통공사' },
  // 일본 — 한국어 페이지 제공
  tokyo: { url: 'https://www.tokyometro.jp/lang_kr/subwaymap/index.html', agency: 'Tokyo Metro' },
  osaka: { url: 'https://subway.osakametro.co.jp/guide/file/route_map_kr.pdf', agency: 'Osaka Metro' },
  kyoto: { url: 'https://www2.city.kyoto.lg.jp/kotsu/cmsfiles/contents/0000027/27184/kor_subway_map.pdf', agency: '교토시 교통국' },
  fukuoka: { url: 'https://subway.city.fukuoka.lg.jp/kor/', agency: '후쿠오카 시영지하철' },
  // 대만 — 한국어
  taipei: { url: 'https://web.metro.taipei/c/routemap.aspx?lang=kr', agency: 'Taipei Metro' },
  // 동남아·중화권 — 영어
  bangkok: { url: 'https://www.bts.co.th/eng/routemap.html', agency: 'BTS Bangkok' },
  singapore: { url: 'https://www.smrt.com.sg/Trains/SystemMap', agency: 'SMRT Singapore' },
  hongkong: { url: 'https://www.mtr.com.hk/en/customer/services/system_map.html', agency: 'MTR Hong Kong' },
  shanghai: { url: 'http://service.shmetro.com/en/index.htm', agency: 'Shanghai Metro' },
  beijing: { url: 'https://www.bjsubway.com/en/', agency: 'Beijing Subway' },
  // 미주·유럽 — 영어
  newyork: { url: 'https://new.mta.info/maps/subway-map', agency: 'MTA New York' },
  london: { url: 'https://tfl.gov.uk/maps/track/tube', agency: 'Transport for London' },
  paris: { url: 'https://www.ratp.fr/en/plans', agency: 'RATP Paris' },
  berlin: { url: 'https://www.bvg.de/en/connections/route-network-and-map', agency: 'BVG Berlin' },
  amsterdam: { url: 'https://en.gvb.nl/lijnenkaart-rapide', agency: 'GVB Amsterdam' },
  barcelona: { url: 'https://www.tmb.cat/en/barcelona/maps/metro', agency: 'TMB Barcelona' },
  rome: { url: 'https://www.atac.roma.it/page/maps/231/0', agency: 'ATAC Roma' },
};

export function getOfficialTransitInfo(cityId: string): { url: string; agency: string } | null {
  return OFFICIAL_TRANSIT_URLS[cityId] ?? null;
}
