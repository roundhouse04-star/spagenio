// 동행복권(로또645) 복권 QR 파서
// QR이 인코딩하는 URL 형식 (실물 복권/자동발권 영수증 모두 동일):
//   http://m.dhlottery.co.kr/qr.do?method=winQr&v={DATA}
// DATA = 4자리 회차 + 게임별 (선택구분 1글자 + 6×2자리 번호) * N + 발권코드
//   선택구분: q=자동, m=수동, s=반자동 (구버전 영수증은 구분자 없이 12자리만 반복하기도 함)

export function parseLottoQR(input) {
  if (!input || typeof input !== 'string') return null;

  // URL이 아니어도 v= 파라미터만 추출 시도 (단순 데이터 페이로드 케이스 대응)
  const m = input.match(/[?&]v=([^&\s]+)/i);
  let v = m ? m[1] : null;
  if (!v) {
    // 동행복권 도메인 없이 v= 만 있는 케이스 / 일부 자동발권 슬립
    const m2 = input.match(/v=([A-Za-z0-9]+)/i);
    if (m2) v = m2[1];
  }
  if (!v) {
    // 마지막 폴백: 입력 자체가 데이터 페이로드인 경우
    v = input.trim();
  }
  if (!/^\d{4}/.test(v)) return null;

  const round = parseInt(v.slice(0, 4), 10);
  if (isNaN(round) || round < 1) return null;

  const rest = v.slice(4);
  // 마커(q/m/s/Q/M/S) 또는 영문자/언더바를 구분자로 사용해 숫자 청크 분리
  const chunks = rest.split(/[^0-9]+/).filter(Boolean);

  const games = [];
  for (const chunk of chunks) {
    // 한 청크에 여러 게임이 붙어있을 수 있으므로 12자리씩 잘라 처리
    for (let i = 0; i + 12 <= chunk.length; i += 12) {
      const seg = chunk.slice(i, i + 12);
      const nums = [];
      let valid = true;
      for (let j = 0; j < 6; j++) {
        const n = parseInt(seg.slice(j * 2, j * 2 + 2), 10);
        if (isNaN(n) || n < 1 || n > 45) { valid = false; break; }
        nums.push(n);
      }
      if (valid && new Set(nums).size === 6) {
        games.push(nums.sort((a, b) => a - b));
      }
    }
  }

  if (games.length === 0) return null;
  return { round, games };
}

// 동행복권 모바일 검증 페이지 URL (QR 그대로 열기 / 외부 검증용)
export function dhlotteryVerifyUrl(round, games) {
  if (!round || !games?.length) return null;
  const v = String(round).padStart(4, '0') +
    games.map((g) => 'q' + g.map((n) => String(n).padStart(2, '0')).join('')).join('');
  return `https://m.dhlottery.co.kr/qr.do?method=winQr&v=${v}`;
}
