/**
 * Wikipedia bio 문자열에서 아티스트 구조화 정보 추출.
 *
 * 대상 패턴 예시:
 *   "HYNN(흰, 본명: 박혜원, 1998년 1월 15일 ~ )은 대한민국의 가수이다."
 *   "권진아(1993년 3월 13일 ~ )는 대한민국의 싱어송라이터이다."
 *   "아이유(본명: 이지은, 1993년 5월 16일 ~ )는 대한민국의 가수이자 배우이다."
 *   "유재석(1972년 8월 14일 ~ )은 대한민국의 방송인이다."
 *
 * 파싱 실패 시 해당 필드는 undefined 반환 → UI 에서 숨김 처리.
 */

export type ParsedArtistInfo = {
  realName?: string;       // 본명 (예: 박혜원)
  aliases?: string[];      // 별칭/다른 이름 (예: 흰)
  birthDate?: string;      // 생년월일 (예: 1998년 1월 15일)
  deathDate?: string;      // 사망일 (있는 경우)
  nationality?: string;    // 국적 (예: 대한민국)
  occupations?: string[];  // 직업 목록 (예: ['가수', '배우'])
};

export function parseArtistBio(bio?: string): ParsedArtistInfo {
  if (!bio) return {};
  const info: ParsedArtistInfo = {};

  // 1. 괄호 안의 내용 추출 (첫 괄호만)
  //    예: "HYNN(흰, 본명: 박혜원, 1998년 1월 15일 ~ )"
  //    → parenContent = "흰, 본명: 박혜원, 1998년 1월 15일 ~"
  const parenMatch = bio.match(/[(（]([^)）]+)[)）]/);
  if (parenMatch) {
    const parenContent = parenMatch[1];
    const parts = parenContent.split(/[,，]/).map(s => s.trim()).filter(Boolean);

    for (const part of parts) {
      // 본명: XXX
      const realNameMatch = part.match(/본명\s*[:：]\s*(.+?)$/);
      if (realNameMatch) {
        info.realName = realNameMatch[1].trim();
        continue;
      }

      // 생년월일: 1998년 1월 15일 또는 1998년 1월 15일 ~ 2023년 2월 1일
      const birthMatch = part.match(/^(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)(?:\s*[~\-]\s*(\d{4}년\s*\d{1,2}월\s*\d{1,2}일)?)?/);
      if (birthMatch) {
        info.birthDate = normalizeDate(birthMatch[1]);
        if (birthMatch[2]) {
          info.deathDate = normalizeDate(birthMatch[2]);
        }
        continue;
      }

      // 생년만 있는 경우: 1998년 ~ 또는 1998년생
      const yearMatch = part.match(/^(\d{4})년(?:생)?/);
      if (yearMatch && !info.birthDate) {
        info.birthDate = `${yearMatch[1]}년`;
        continue;
      }

      // 남은 건 별칭으로 취급 (숫자·한자 아닌 짧은 것)
      if (part.length <= 10 && !/\d/.test(part) && !part.includes(':')) {
        info.aliases = info.aliases ?? [];
        info.aliases.push(part);
      }
    }
  }

  // 2. 국적 + 직업 추출
  //    "대한민국의 가수이다" / "대한민국의 가수이자 배우이다" / "한국의 싱어송라이터이자 작곡가이다"
  const afterParen = bio.replace(/^[^)）]+[)）]/, ''); // 괄호 이후 부분
  const natMatch = afterParen.match(/(대한민국|한국|일본|미국|영국|중국|독일|프랑스|캐나다|호주)(?:의|에서)/);
  if (natMatch) {
    info.nationality = natMatch[1];
  }

  // 직업: "XXX이자 YYY이자 ZZZ이다" or "XXX이다" 패턴
  //   "대한민국의 가수이자 배우이다" → ['가수', '배우']
  //   "대한민국의 싱어송라이터이다" → ['싱어송라이터']
  const occMatch = afterParen.match(/(?:의|인)\s*([^.。]+?)(?:이다|입니다|다)[.。]?/);
  if (occMatch) {
    const occChain = occMatch[1];
    // "가수이자 배우" 또는 "가수 겸 배우" 형태 분리
    const occs = occChain
      .split(/이자|\s*겸\s*|\s*및\s*|\s*,\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 15 && !s.includes('의'));
    if (occs.length > 0) {
      info.occupations = occs;
    }
  }

  return info;
}

function normalizeDate(raw: string): string {
  // "1998년 1월 15일" → "1998년 1월 15일" (공백 정규화)
  return raw.replace(/\s+/g, ' ').trim();
}
