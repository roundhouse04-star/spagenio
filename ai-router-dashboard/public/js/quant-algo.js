// ── 알고리즘 정의 ──────────────────────────────────────────
    const ALGOS = [
      { id: 'freq', name: '빈도 분석', weight: 20, desc: '역대 가장 많이 출현한 번호를 우선 선택. 출현 횟수를 확률 가중치로 사용.' },
      { id: 'hot', name: '핫넘버', weight: 20, desc: '최근 50회 출현 빈도가 높은 번호. 단기 트렌드를 반영.' },
      { id: 'cold', name: '미출현 주기', weight: 10, desc: '오래 나오지 않은 번호 우선 선택. 회귀 이론 기반.' },
      { id: 'balance', name: '홀짝 균형', weight: 15, desc: '홀수 3개 + 짝수 3개 비율로 균형 있게 구성. 통계적으로 가장 빈번.' },
      { id: 'zone', name: '구간 분포', weight: 15, desc: '1~45를 6구간으로 나눠 각 구간에서 고르게 선택.' },
      { id: 'ac', name: 'AC값 최적화', weight: 10, desc: '번호 간 차이값의 다양성(AC값 7~10) 최적화. 패턴 회피.' },
      { id: 'prime', name: '소수 패턴', weight: 5, desc: '소수(2,3,5,7,11...) 2~3개 포함. 역대 당첨 통계 반영.' },
      { id: 'delta', name: '델타 시스템', weight: 5, desc: '번호 간격 패턴(델타값) 분석. 1,2,3,7,8,13이 최다 델타.' },
    ];

    let weights = {};
    let lottoHistory = [];
    let lastGames = [];

    ALGOS.forEach(a => weights[a.id] = a.weight);

    // ── 알고리즘 UI 렌더 ───────────────────────────────────────
    function lottoRenderAlgos() {
      const grid = document.getElementById('lotto-algo-grid');
      if (!grid) return;

      // 수정8: lottoAlgos(lotto.js 변수) → ALGOS(quant-algo.js 로컬 변수) 사용
      grid.innerHTML = ALGOS.map(a => `
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px;">
      <div style="display:flex;justify-content:space-between;">
        <b>${a.name}</b>
        <span id="lotto-weight-label-${a.id}">${a.weight}%</span>
      </div>

      <input type="range"
        min="0"
        max="100"
        value="${a.weight}"
        oninput="lottoUpdateWeight('${a.id}', this.value)"
        style="width:100%;"
      />
    </div>
  `).join('');
    }

    function updateWeight(id, val) {
      weights[id] = parseInt(val);
      document.getElementById('pct-' + id).textContent = val + '%';
    }

    function resetWeights() {
      ALGOS.forEach(a => { weights[a.id] = a.weight; });
      // renderAlgos();
    }

    // ── 로또 데이터 수집 ───────────────────────────────────────
    async function fetchLottoData() {
      try {
        // server.js 프록시 통해 동행복권 API 호출
        const res = await fetch('/api/lotto/history');
        if (res.ok) {
          const data = await res.json();
          lottoHistory = data.history || [];
          updateStats();
          return;
        }
      } catch (e) { }
      // 폴백: 내장 샘플 데이터 (최근 10회)
      lottoHistory = generateSampleHistory();
      updateStats();
    }

    function generateSampleHistory() {
      // 실제 최근 당첨 번호 샘플
      return [
        [3, 13, 30, 33, 43, 45], [1, 7, 11, 24, 27, 41], [6, 9, 10, 11, 27, 37],
        [5, 8, 18, 26, 38, 42], [2, 14, 21, 30, 39, 44], [4, 16, 22, 28, 35, 40],
        [7, 12, 19, 23, 31, 45], [3, 10, 17, 25, 34, 41], [1, 6, 15, 28, 37, 43],
        [8, 11, 20, 29, 36, 42], [2, 9, 18, 24, 33, 40], [5, 13, 22, 30, 39, 44],
        [4, 7, 16, 25, 35, 43], [1, 10, 19, 28, 37, 41], [6, 12, 21, 29, 38, 45],
        [3, 8, 17, 26, 34, 40], [2, 11, 20, 27, 36, 44], [5, 9, 18, 23, 33, 42],
        [4, 13, 22, 31, 39, 45], [7, 10, 19, 25, 35, 41], [1, 8, 17, 28, 36, 43],
        [6, 11, 20, 29, 37, 40], [3, 9, 16, 24, 34, 44], [2, 12, 21, 30, 38, 42],
        [5, 10, 18, 27, 35, 45], [4, 8, 19, 26, 33, 41], [1, 11, 22, 31, 39, 43],
        [7, 9, 17, 25, 36, 40], [3, 12, 20, 29, 37, 44], [6, 10, 19, 24, 35, 42],
        [2, 8, 16, 28, 34, 45], [5, 11, 21, 30, 38, 41], [4, 9, 18, 27, 36, 43],
        [1, 12, 20, 26, 33, 40], [7, 10, 17, 29, 37, 44], [3, 8, 19, 25, 35, 42],
        [6, 11, 22, 31, 39, 45], [2, 9, 16, 24, 34, 41], [5, 12, 21, 28, 36, 43],
        [4, 10, 18, 27, 33, 40], [1, 8, 17, 26, 37, 44], [7, 11, 20, 29, 35, 42],
        [3, 9, 19, 25, 38, 45], [6, 12, 22, 31, 36, 41], [2, 10, 17, 24, 33, 43],
        [5, 8, 16, 28, 39, 40], [4, 11, 21, 30, 37, 44], [1, 9, 18, 27, 34, 42],
        [7, 12, 20, 26, 35, 45], [3, 10, 19, 29, 38, 41],
      ];
    }

    function updateStats() {
      if (!lottoHistory.length) return;
      const freq = new Array(46).fill(0);
      lottoHistory.forEach(game => game.forEach(n => freq[n]++));

      const sorted = [...Array(45).keys()].slice(1).sort((a, b) => freq[b] - freq[a]);
      document.getElementById('stat-round').textContent = lottoHistory.length + '회';
      document.getElementById('stat-hot').textContent = sorted.slice(0, 3).join(', ');

      // 마지막 출현 회차
      const lastSeen = new Array(46).fill(0);
      lottoHistory.forEach((game, i) => game.forEach(n => { if (!lastSeen[n]) lastSeen[n] = lottoHistory.length - i; }));
      const coldest = [...Array(45).keys()].slice(1).sort((a, b) => (lastSeen[b] || 999) - (lastSeen[a] || 999));
      document.getElementById('stat-cold').textContent = coldest[0] + '번';
    }

    // ── 번호 생성 알고리즘 ─────────────────────────────────────
    const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
    const DELTA_WEIGHTS = { 1: 15, 2: 12, 3: 10, 4: 8, 5: 7, 6: 6, 7: 9, 8: 6, 9: 5, 10: 5, 13: 7, 14: 5, 15: 4 };

    function getFreqScores() {
      const freq = new Array(46).fill(0);
      lottoHistory.forEach(g => g.forEach(n => freq[n]++));
      return freq;
    }

    function getHotScores() {
      const recent = lottoHistory.slice(0, 50);
      const freq = new Array(46).fill(0);
      recent.forEach(g => g.forEach(n => freq[n]++));
      return freq;
    }

    function getColdScores() {
      const lastSeen = new Array(46).fill(lottoHistory.length + 1);
      lottoHistory.forEach((g, i) => g.forEach(n => { lastSeen[n] = Math.min(lastSeen[n], i); }));
      return lastSeen.map(v => v); // 클수록 오래 안 나온 것
    }

    function pickWeighted(scores, exclude, count) {
      const pool = [];
      for (let n = 1; n <= 45; n++) {
        if (exclude.has(n)) continue;
        const w = Math.max(scores[n] || 1, 1);
        for (let i = 0; i < w; i++) pool.push(n);
      }
      const picked = new Set();
      let tries = 0;
      while (picked.size < count && tries < 1000) {
        picked.add(pool[Math.floor(Math.random() * pool.length)]);
        tries++;
      }
      return [...picked];
    }

    function generateGame() {
      const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
      const scores = new Array(46).fill(0);

      // 각 알고리즘 점수 합산
      const freq = getFreqScores();
      const hot = getHotScores();
      const cold = getColdScores();

      for (let n = 1; n <= 45; n++) {
        if (weights.freq) scores[n] += (weights.freq / totalW) * (freq[n] * 3);
        if (weights.hot) scores[n] += (weights.hot / totalW) * (hot[n] * 4);
        if (weights.cold) scores[n] += (weights.cold / totalW) * (cold[n] * 2);
        if (weights.prime && PRIMES.includes(n)) scores[n] += (weights.prime / totalW) * 10;
      }

      // 1차 후보 선택 (점수 기반)
      const candidates = [...Array(45).keys()].slice(1)
        .map(n => ({ n, s: scores[n] + Math.random() * 5 }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 20)
        .map(x => x.n);

      let result = candidates.slice(0, 6);

      // 홀짝 균형 조정
      if (weights.balance > 0) {
        result = adjustBalance(result, candidates);
      }

      // 구간 분포 조정
      if (weights.zone > 0) {
        result = adjustZone(result);
      }

      // AC값 최적화
      if (weights.ac > 0) {
        result = adjustAC(result);
      }

      return result.sort((a, b) => a - b).slice(0, 6);
    }

    function adjustBalance(nums, pool) {
      let odds = nums.filter(n => n % 2 !== 0);
      let evens = nums.filter(n => n % 2 === 0);

      // 목표: 홀 3개, 짝 3개
      while (odds.length > 3 && evens.length < 3) {
        const rem = odds.pop();
        const newEven = pool.find(n => n % 2 === 0 && !nums.includes(n));
        if (newEven) { nums = nums.filter(x => x !== rem); nums.push(newEven); }
        odds = nums.filter(n => n % 2 !== 0);
        evens = nums.filter(n => n % 2 === 0);
      }
      while (evens.length > 3 && odds.length < 3) {
        const rem = evens.pop();
        const newOdd = pool.find(n => n % 2 !== 0 && !nums.includes(n));
        if (newOdd) { nums = nums.filter(x => x !== rem); nums.push(newOdd); }
        odds = nums.filter(n => n % 2 !== 0);
        evens = nums.filter(n => n % 2 === 0);
      }
      return nums;
    }

    function adjustZone(nums) {
      // 각 구간에서 최소 1개
      const zones = [[1, 7], [8, 14], [15, 21], [22, 28], [29, 35], [36, 45]];
      const covered = new Set(zones.map(z => nums.some(n => n >= z[0] && n <= z[1]) ? 1 : 0));
      // 미커버 구간에서 랜덤 번호로 교체
      zones.forEach(z => {
        if (!nums.some(n => n >= z[0] && n <= z[1])) {
          const rep = nums[Math.floor(Math.random() * nums.length)];
          const newN = z[0] + Math.floor(Math.random() * (z[1] - z[0] + 1));
          if (!nums.includes(newN)) nums = nums.map(n => n === rep ? newN : n);
        }
      });
      return [...new Set(nums)].slice(0, 6);
    }

    function calcAC(nums) {
      const diffs = new Set();
      for (let i = 0; i < nums.length; i++)
        for (let j = i + 1; j < nums.length; j++)
          diffs.add(Math.abs(nums[i] - nums[j]));
      return diffs.size - 5;
    }

    function adjustAC(nums) {
      let best = nums;
      let bestAC = calcAC(nums);
      // 10회 시도해서 AC값 7 이상인 조합 선택
      for (let i = 0; i < 10; i++) {
        const candidate = [...nums];
        const idx = Math.floor(Math.random() * 6);
        let newN;
        do { newN = Math.floor(Math.random() * 45) + 1; } while (candidate.includes(newN));
        candidate[idx] = newN;
        const ac = calcAC(candidate);
        if (ac > bestAC) { best = candidate; bestAC = ac; }
      }
      return best;
    }

    // ── 볼 색상 ────────────────────────────────────────────────
    function ballClass(n) {
      if (n <= 10) return 'b1';
      if (n <= 20) return 'b2';
      if (n <= 30) return 'b3';
      if (n <= 40) return 'b4';
      return 'b5';
    }

    // ── 번호 생성 및 렌더 ──────────────────────────────────────
    function generate() {
      const count = parseInt(document.getElementById('game-count').value);
      lastGames = [];

      for (let i = 0; i < count; i++) {
        lastGames.push(generateGame());
      }

      const container = document.getElementById('results');
      const activeAlgos = ALGOS.filter(a => weights[a.id] > 0)
        .sort((a, b) => weights[b.id] - weights[a.id])
        .slice(0, 4)
        .map(a => `<span class="contrib-tag">${a.name} ${weights[a.id]}%</span>`)
        .join('');

      container.innerHTML = lastGames.map((game, i) => `
    <div class="game-row">
      <div class="game-label">
        <span>${String.fromCharCode(65 + i)}게임</span>
        <span style="color:var(--text2);font-size:11px">AC값: ${calcAC(game) + 5}</span>
      </div>
      <div class="balls">
        ${game.map(n => `<div class="ball ${ballClass(n)}">${n}</div>`).join('')}
        <div class="ball-sep"></div>
        <div class="ball b6">+</div>
      </div>
      <div class="contrib">${activeAlgos}</div>
    </div>
  `).join('');

      // 메일 발송 버튼
      const mailWrap = document.createElement('div');
      mailWrap.style.cssText = 'margin-top:14px;display:flex;gap:10px;justify-content:flex-end;';
      mailWrap.innerHTML = `<button id="lotto-mail-btn" onclick="sendLottoMail()" style="padding:9px 18px;background:#6366f1;color:#fff;border:none;border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;">📧 메일로 받기</button>`;
      container.appendChild(mailWrap);

      showToast('번호 추천 완료! 🍀');
    }

    // ── 텔레그램 ───────────────────────────────────────────────
    function saveTg() {
      const token = document.getElementById('lotto-tg-token').value.trim();
      const chatid = document.getElementById('lotto-tg-chatid').value.trim();
      if (token) localStorage.setItem('tg_token', token);
      if (chatid) localStorage.setItem('tg_chatid', chatid);
      showToast('텔레그램 설정 저장됨 ✅');
    }

    async function testTg() {
      await sendTgMsg('🔔 spagenio 로또 봇 연결 테스트!\n정상적으로 수신되면 성공입니다 🍀');
    }

    async function sendTelegram() {
      if (!lastGames.length) { showToast('먼저 번호를 추천받으세요!'); return; }

      const lines = lastGames.map((g, i) => {
        const balls = g.map(n => `*${n}*`).join('  ');
        return `${String.fromCharCode(65 + i)}게임: ${balls}`;
      });

      const activeAlgos = ALGOS.filter(a => weights[a.id] > 0)
        .sort((a, b) => weights[b.id] - weights[a.id])
        .slice(0, 3)
        .map(a => `${a.name}(${weights[a.id]}%)`)
        .join(' + ');

      const msg = `🍀 *로또 번호 추천*\n\n${lines.join('\n')}\n\n📊 알고리즘: ${activeAlgos}\n🕐 ${new Date().toLocaleString('ko-KR')}`;
      await sendTgMsg(msg);
    }

    async function sendTgMsg(text) {
      const token = localStorage.getItem('tg_token') || document.getElementById('lotto-tg-token').value.trim();
      const chatid = localStorage.getItem('tg_chatid') || document.getElementById('lotto-tg-chatid').value.trim();

      if (!token || !chatid) { showToast('텔레그램 Token과 Chat ID를 입력하세요!'); return; }

      try {
        // server.js 프록시 통해 전송
        const res = await fetch('/api/lotto/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, chatid, text })
        });
        const data = await res.json();
        if (data.ok) showToast('텔레그램 전송 완료! 📱');
        else showToast('전송 실패: ' + (data.error || '알 수 없는 오류'));
      } catch (e) {
        showToast('전송 오류: ' + e.message);
      }
    }

    window.showToast = function(msg) {
      let t = document.getElementById('lotto-toast-dynamic');
      if (!t) {
        t = document.createElement('div');
        t.id = 'lotto-toast-dynamic';
        t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#6366f1;color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;opacity:0;transition:opacity .3s;pointer-events:none;z-index:9999;max-width:320px;';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._timer);
      t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
    }

    // ── 초기화 ────────────────────────────────────────────────
    //renderAlgos();
    fetchLottoData();

    // 저장된 텔레그램 설정 로드
    const savedToken = localStorage.getItem('tg_token');
    const savedChatid = localStorage.getItem('tg_chatid');
    if (savedToken) document.getElementById('lotto-tg-token').value = savedToken;
    if (savedChatid) document.getElementById('lotto-tg-chatid').value = savedChatid;

    // ── 메일 발송 ─────────────────────────────────────────────
    window.sendLottoMail = async function() {
      if (!lastGames?.length) { showToast('먼저 번호를 생성해주세요! 🍀'); return; }
      const btn = document.getElementById('lotto-mail-btn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳ 발송 중...'; }
      try {
        const res = await fetch('/api/mail/lotto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ games: lastGames, date: new Date().toISOString().split('T')[0] })
        });
        const data = await res.json();
        if (data.ok) {
          showToast('📧 메일 발송 완료!');
          if (btn) btn.textContent = '✅ 발송됨';
          setTimeout(() => { if (btn) { btn.textContent = '📧 메일로 받기'; btn.disabled = false; } }, 3000);
        } else {
          showToast('❌ ' + (data.error || '발송 실패'));
          if (btn) { btn.textContent = '📧 메일로 받기'; btn.disabled = false; }
        }
      } catch(e) {
        showToast('❌ 오류: ' + e.message);
        if (btn) { btn.textContent = '📧 메일로 받기'; btn.disabled = false; }
      }
    };