// ===== Lotto Module =====
    (() => {
      const LOTTO_STORAGE_KEY = 'spagenio_lotto_weights_v1';
      const LOTTO_TG_TOKEN_KEY = 'spagenio_lotto_tg_token_v1';
      const LOTTO_TG_CHATID_KEY = 'spagenio_lotto_tg_chatid_v1';

      const DEFAULT_ALGOS = [
        { id: 'freq', name: '빈도 분석', weight: 20, desc: '역대 많이 출현한 번호 비중 반영' },
        { id: 'hot', name: '핫넘버', weight: 20, desc: '최근 출현 빈도가 높은 번호 반영' },
        { id: 'cold', name: '미출현 주기', weight: 10, desc: '오랫동안 안 나온 번호 반영' },
        { id: 'balance', name: '홀짝 균형', weight: 15, desc: '홀짝 균형 유지' },
        { id: 'zone', name: '구간 분포', weight: 10, desc: '1~15 / 16~30 / 31~45 분산 반영' },
        { id: 'ac', name: 'AC값 최적화', weight: 10, desc: '조합 다양성 반영' },
        { id: 'prime', name: '소수 패턴', weight: 5, desc: '소수 비중 반영' },
        { id: 'delta', name: '델타 시퀀스', weight: 10, desc: '간격 패턴 반영' }
      ];

      let lottoInitialized = false;
      let lottoHistory = [];
      let lottoLastGames = [];
      let lottoAlgos = DEFAULT_ALGOS.map(a => ({ ...a }));
      let lottoDbWeights = {};  // DB에서 로드한 번호별 가중치 (반복출현 패턴 반영)

      function $id(id) {
        return document.getElementById(id);
      }

      async function lottoLoadWeights() {
        // ── DB 번호별 가중치 로드 (반복출현 패턴) ──
        try {
          const wRes = await fetch('/api/lotto/weights');
          if (wRes.ok) {
            const wData = await wRes.json();
            if (wData.weights?.length) {
              lottoDbWeights = {};
              wData.weights.forEach(w => { lottoDbWeights[w.num] = parseFloat(w.weight) || 1.0; });
            }
          }
        } catch(e) {}

        try {
          // 서버에서 사용자별 비중 로드 시도
          const res = await fetch('/api/lotto/algorithm-weights');
          if (res.ok) {
            const data = await res.json();
            lottoAlgos = DEFAULT_ALGOS.map(def => ({
              ...def,
              weight: data[def.id] !== undefined
                ? Math.max(0, Math.min(100, Number(data[def.id])))
                : def.weight
            }));
            return;
          }
        } catch (e) {
          // 서버 실패 시 localStorage fallback
        }
        try {
          const raw = localStorage.getItem(LOTTO_STORAGE_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          lottoAlgos = DEFAULT_ALGOS.map(def => {
            const found = parsed.find(x => x.id === def.id);
            return {
              ...def,
              weight: found && Number.isFinite(Number(found.weight))
                ? Math.max(0, Math.min(100, Number(found.weight)))
                : def.weight
            };
          });
        } catch (e) {
          console.warn('lottoLoadWeights error', e);
        }
      }

      function lottoSaveWeights() {
        // 슬라이더 조작 중 localStorage에만 임시 저장
        localStorage.setItem(
          LOTTO_STORAGE_KEY,
          JSON.stringify(lottoAlgos.map(({ id, weight }) => ({ id, weight })))
        );
      }

      window.lottoSaveWeightsToServer = async function() {
        const total = lottoAlgos.reduce((s, a) => s + Number(a.weight || 0), 0);
        if (total !== 100) { showToast('⚠️ 비중 합계가 ' + total + '%입니다. 100%로 맞춰주세요.'); return; }
        const btn = document.getElementById('lotto-save-weights-btn');
        if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
        try {
          const body = {};
          lottoAlgos.forEach(a => { body[a.id] = a.weight; });
          const res = await fetch('/api/lotto/algorithm-weights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = await res.json();
          if (data.ok) {
            lottoSaveWeights();
            showToast('알고리즘 비중 저장 완료! ✅');
          } else {
            showToast('저장 실패: ' + (data.error || '오류'));
          }
        } catch (e) {
          showToast('저장 오류: ' + e.message);
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = '💾 저장'; }
        }
      }

      function lottoNormalizeWeights() {
        const total = lottoAlgos.reduce((sum, a) => sum + Number(a.weight || 0), 0);
        if (total <= 0) {
          lottoAlgos = DEFAULT_ALGOS.map(a => ({ ...a }));
          lottoSaveWeights();
        }
      }

      function lottoRenderAlgos() {
        const wrap = $id('lotto-algo-grid');
        if (!wrap) return;

        wrap.innerHTML = lottoAlgos.map(algo => `
        <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;background:#fff;">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px;">
            <div style="font-weight:800;color:#111827;">${algo.name}</div>
            <div style="font-size:0.82rem;color:#6366f1;font-weight:800;">
              <span id="lotto-weight-label-${algo.id}">${algo.weight}</span>%
            </div>
          </div>
          <div style="font-size:0.8rem;color:#6b7280;margin-bottom:8px;">${algo.desc}</div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value="${algo.weight}"
            oninput="lottoUpdateWeight('${algo.id}', this.value)"
            style="width:100%;"
          />
        </div>
      `).join('');
      }

      function lottoUpdateWeightInternal(id, value) {
        const target = lottoAlgos.find(a => a.id === id);
        if (!target) return;

        target.weight = Number(value);
        const label = $id(`lotto-weight-label-${id}`);
        if (label) label.textContent = target.weight;
        lottoSaveWeights();
      }

      window.lottoUpdateWeight = lottoUpdateWeightInternal;

      window.lottoResetWeights = function lottoResetWeights() {
        lottoAlgos = DEFAULT_ALGOS.map(a => ({ ...a }));
        lottoSaveWeights();
        lottoRenderAlgos();
      };

      function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }

      function pickWeighted(items) {
        const total = items.reduce((sum, item) => sum + item.weight, 0);
        if (total <= 0) return items[randInt(0, items.length - 1)];

        let r = Math.random() * total;
        for (const item of items) {
          r -= item.weight;
          if (r <= 0) return item;
        }
        return items[items.length - 1];
      }

      function getNumberScore(n) {
        // ── DB 반복출현 가중치 기반 기본 점수 ──
        const dbW = lottoDbWeights[n] || 1.0;

        // 캐시된 streakMultiplier 사용 (lottoGenerate에서 1회 계산)
        const streakMul = _streakCache ? (_streakCache[n] || 1.0) : 1.0;

        let score = dbW * streakMul;  // 반복출현 패턴 × 연속 패턴 동시 반영

        // ── 이력 기반 동적 hot/cold 계산 ──
        const primeSet = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]);

        // 최근 10회차에서 동적으로 hot/cold 계산
        const recentHistory = lottoHistory.slice(-10);
        const recentFlat = recentHistory.flat ? recentHistory.flat() : [].concat(...recentHistory);
        const recentFreq = {};
        recentFlat.forEach(num => { recentFreq[num] = (recentFreq[num] || 0) + 1; });
        const hotThreshold = 2;  // 최근 10회차 중 2번 이상 = hot
        const isHot = (recentFreq[n] || 0) >= hotThreshold;
        const isCold = (recentFreq[n] || 0) === 0;  // 최근 10회차 미출현 = cold

        // 전체 이력 출현 빈도
        const allFlat = lottoHistory.flat ? lottoHistory.flat() : [].concat(...lottoHistory);
        const totalFreq = {};
        allFlat.forEach(num => { totalFreq[num] = (totalFreq[num] || 0) + 1; });
        const avgFreq = allFlat.length / 45;
        const freqRatio = (totalFreq[n] || 0) / (avgFreq || 1);

        for (const algo of lottoAlgos) {
          if (algo.weight <= 0) continue;

          switch (algo.id) {
            case 'freq':
              // 실제 전체 이력 출현 빈도 반영
              score += algo.weight * freqRatio * 0.03;
              break;
            case 'hot':
              // 동적 hot: 최근 10회차 출현 빈도 기반
              if (isHot) score += algo.weight * (recentFreq[n] || 0) * 0.05;
              break;
            case 'cold':
              // 동적 cold: 최근 미출현 번호 반영
              if (isCold) score += algo.weight * 0.07;
              break;
            case 'balance':
              if ((n % 2) === 0) score += algo.weight * 0.02;
              break;
            case 'zone':
              if (n <= 15 || (n >= 16 && n <= 30) || n >= 31) score += algo.weight * 0.015;
              break;
            case 'ac':
              score += algo.weight * ((n * 7) % 11) * 0.005;
              break;
            case 'prime':
              if (primeSet.has(n)) score += algo.weight * 0.04;
              break;
            case 'delta':
              score += algo.weight * ((46 - n) % 6) * 0.005;
              break;
          }
        }

        return score;
      }

      function generateOneGame() {
        const picked = new Set();

        while (picked.size < 6) {
          const pool = [];
          for (let n = 1; n <= 45; n++) {
            if (!picked.has(n)) {
              pool.push({ number: n, weight: getNumberScore(n) });
            }
          }
          const selected = pickWeighted(pool);
          picked.add(selected.number);
        }

        const nums = [...picked].sort((a, b) => a - b);

        const odd = nums.filter(n => n % 2 === 1).length;
        const low = nums.filter(n => n <= 22).length;

        return {
          numbers: nums,
          meta: {
            oddEven: `${odd}:${6 - odd}`,
            lowHigh: `${low}:${6 - low}`,
            sum: nums.reduce((a, b) => a + b, 0)
          }
        };
      }

      function ballColor(n) {
        if (n <= 10) return '#fbbf24';
        if (n <= 20) return '#60a5fa';
        if (n <= 30) return '#ef4444';
        if (n <= 40) return '#a78bfa';
        return '#34d399';
      }

      function renderGames(games) {
        const wrap = $id('lotto-results');
        if (!wrap) return;

        if (!games.length) {
          wrap.innerHTML = `<div style="text-align:center;color:#6b7280;padding:32px;font-size:0.9rem;">번호 추천 버튼을 눌러주세요</div>`;
          return;
        }

        wrap.innerHTML = games.map((game, idx) => `
        <div style="border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;background:#fff;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="font-weight:800;color:#111827;">${idx + 1}번 게임</div>
            <div style="font-size:0.78rem;color:#6b7280;">
              홀짝 ${game.meta.oddEven} · 저고 ${game.meta.lowHigh} · 합 ${game.meta.sum}
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${game.numbers.map(n => `
              <div style="
                width:42px;height:42px;border-radius:999px;
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-weight:800;background:${ballColor(n)};
                box-shadow:0 2px 8px rgba(0,0,0,0.08);
              ">${n}</div>
            `).join('')}
          </div>
        </div>
      `).join('');
      }

      function updateStats() {
        const statRound = $id('stat-round');
        const statHot = $id('stat-hot');
        const statCold = $id('stat-cold');

        if (statRound) statRound.textContent = lottoHistory.length ? lottoHistory.length : 1180;
        if (statHot) statHot.textContent = '34';
        if (statCold) statCold.textContent = '44';
      }

      function loadTelegramSettings() {
        const tokenEl = $id('lotto-tg-token');
        const chatEl = $id('lotto-tg-chatid');
        if (tokenEl) tokenEl.value = localStorage.getItem(LOTTO_TG_TOKEN_KEY) || '';
        if (chatEl) chatEl.value = localStorage.getItem(LOTTO_TG_CHATID_KEY) || '';
      }

      // 레이어 팝업
      function lottoShowToast(icon, title, msg) {
        const layer = $id('lotto-toast-layer');
        if (!layer) return;
        $id('lotto-toast-icon').textContent = icon;
        $id('lotto-toast-title').textContent = title;
        // ✅ 줄바꿈(\n) 지원
        const safeMsg = String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>');
        $id('lotto-toast-msg').innerHTML = safeMsg;
        layer.style.display = 'flex';
      }
      window.lottoClearToast = function() {
        const layer = $id('lotto-toast-layer');
        if (layer) layer.style.display = 'none';
      };

      function lottoConfirm(icon, title, msg, onOk) {
        const layer = $id('lotto-confirm-layer');
        if (!layer) { spConfirm(msg, title, icon).then(ok => { if (ok) onOk(); }); return; }
        $id('lotto-confirm-icon').textContent = icon;
        $id('lotto-confirm-title').textContent = title;
        $id('lotto-confirm-msg').textContent = msg;
        layer.style.display = 'flex';
        $id('lotto-confirm-ok').onclick = () => { layer.style.display = 'none'; onOk(); };
        $id('lotto-confirm-cancel').onclick = () => { layer.style.display = 'none'; };
      }

      window.lottoSaveTg = async function lottoSaveTg() {
        const token = ($id('lotto-tg-token')?.value?.trim() || '');
        const chatId = ($id('lotto-tg-chatid')?.value?.trim() || '');
        if (!chatId) { lottoShowToast('⚠️', '입력 오류', 'Chat ID를 입력하세요'); return; }
        const cleanToken = token.startsWith('bot') ? token.slice(3) : token;
        localStorage.setItem(LOTTO_TG_TOKEN_KEY, cleanToken);
        localStorage.setItem(LOTTO_TG_CHATID_KEY, chatId);
        try {
          const r = await fetch('/api/lotto/telegram/config', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,bot_token:cleanToken})});
          const d = await r.json();
          if (d.duplicate) {
            lottoShowToast('ℹ️', '이미 등록됨', d.message || '이미 등록된 Chat ID입니다.');
            lottoLoadTgConfig(); if (typeof lottoLoadTgList === "function") lottoLoadTgList();
          } else if (d.ok) {
            lottoShowToast('✅', '저장 완료', '텔레그램 설정이 저장되었습니다.');
            lottoLoadTgConfig(); if (typeof lottoLoadTgList === "function") lottoLoadTgList();
          } else {
            lottoShowToast('❌', '저장 실패', d.error || '알 수 없는 오류');
          }
        } catch(e) { lottoShowToast('❌', '오류', e.message); }
      };

      window.lottoTestTg = async function lottoTestTg() {
        try {
          const res = await fetch('/api/lotto/telegram', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'🔔 spagenio 로또 봇 연결 테스트!\n정상 수신되면 성공입니다 🍀'})});
          const data = await res.json();
          if (data.ok) lottoShowToast('📱', '전송 성공', '텔레그램으로 테스트 메시지가 전송되었습니다!');
          else lottoShowToast('❌', '전송 실패', data.error || '알 수 없는 오류');
        } catch(err) { lottoShowToast('❌', '오류', err.message); }
      };

      window.lottoSaveAndSend = async function lottoSaveAndSend() {
        if (!lottoLastGames.length) { lottoShowToast('⚠️', '번호 없음', '먼저 번호 추천받기를 눌러주세요!'); return; }
        const date = new Date().toISOString().split('T')[0];
        const algosStr = lottoAlgos.filter(a=>a.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,3).map(a=>a.name).join('+');
        try {
          const r = await fetch('/api/lotto/picks', {method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({pick_date:date, games:lottoLastGames.map(g=>g.numbers), algorithms:algosStr})});
          const d = await r.json();
          if (!d.ok) throw new Error(d.error);
        } catch(e) { lottoShowToast('❌', '저장 실패', e.message); return; }
        const lines = lottoLastGames.map((g,i)=>String.fromCharCode(65+i)+'게임: '+g.numbers.join(' ')).join('\n');
        const msg = '🍀 *로또 번호 추천* ('+date+')\n\n'+lines+'\n\n📊 '+algosStr+'\n🕐 '+new Date().toLocaleString('ko-KR');
        try {
          // ✅ broadcast: lotto_telegram에 등록된 모든 사용자에게 발송
          const r = await fetch('/api/lotto/telegram/broadcast', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:msg})});
          const d = await r.json();
          if (d.ok) {
            const failMsg = d.failed > 0 ? ' ('+d.failed+'명 실패)' : '';
            lottoShowToast('🍀', '전송 완료!', '번호 저장 + '+d.sent+'명에게 텔레그램 전송됨'+failMsg);
          } else {
            lottoShowToast('💾', '저장 완료', '번호가 저장되었습니다. (텔레그램: '+(d.error || '실패')+')');
          }
        } catch(e) { lottoShowToast('💾', '저장 완료', '번호가 저장되었습니다. (텔레그램 오류)'); }
        lottoLoadHistory();
      };

      window.lottoSendTelegram = window.lottoSaveAndSend;

      async function lottoLoadTgConfig() {
        try {
          // localStorage 또는 입력란의 chat_id로 조회
          const chatId = ($id('lotto-tg-chatid')?.value?.trim() || localStorage.getItem(LOTTO_TG_CHATID_KEY) || '').trim();
          const url = chatId ? '/api/lotto/telegram/config?chat_id=' + encodeURIComponent(chatId) : '/api/lotto/telegram/config';
          const r = await fetch(url);
          const d = await r.json();
          const chatEl = $id('lotto-tg-chatid');
          const tokenEl = $id('lotto-tg-token');
          if (chatEl && d.chat_id) chatEl.value = d.chat_id;
          if (tokenEl && d.bot_token) tokenEl.value = d.bot_token;
          const status = $id('lotto-tg-status');
          if (status) {
            const registered = !!d.chat_id;
            status.textContent = registered ? '✅ 등록됨' : '미등록';
            status.style.color = registered ? '#10b981' : '#6b7280';
          }
        } catch(e) {}
      }

      // 요일 단일 선택
      window.lottoDayToggle = function(btn) {
        document.querySelectorAll('.lotto-day-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };

      // 저장버튼으로 스케줄 저장 + 일주일에 1번 수정 제한
      window.lottoResetSchedule = async function() {
        lottoConfirm('⚠️', '초기화 확인', '자동 발송 설정을 초기화하시겠습니까?\n설정이 삭제되고 자동 발송이 중단됩니다.', async () => {
          try {
            const chatId = ($id('lotto-tg-chatid')?.value?.trim() || localStorage.getItem(LOTTO_TG_CHATID_KEY) || '').trim();
            if (!chatId) { lottoShowToast('⚠️', '안내', '먼저 텔레그램 Chat ID를 입력하세요'); return; }
            const r = await fetch('/api/lotto/schedule?chat_id=' + encodeURIComponent(chatId), { method: 'DELETE' });
            const d = await r.json();
            if (d.ok) {
              document.querySelectorAll('.lotto-day-btn').forEach(btn => btn.classList.remove('active'));
              if ($id('lotto-sch-hour')) $id('lotto-sch-hour').value = '';
              if ($id('lotto-sch-count')) $id('lotto-sch-count').value = '';
              if ($id('lotto-sch-last')) $id('lotto-sch-last').textContent = '';
              const curText = $id('lotto-sch-current-text');
              if (curText) { curText.textContent = '자동 발송 설정을 하지 않았습니다'; curText.style.color = '#9ca3af'; }
              lottoShowToast('✅', '초기화 완료', '자동 발송 설정이 삭제되었습니다.');
            } else {
              lottoShowToast('❌', '초기화 실패', d.error || '다시 시도해주세요');
            }
          } catch(e) { lottoShowToast('❌', '오류', e.message); }
        });
      };

      window.lottoSaveSchedule = async function() {
        // ✅ chat_id 필수
        const chatId = ($id('lotto-tg-chatid')?.value?.trim() || localStorage.getItem(LOTTO_TG_CHATID_KEY) || '').trim();
        if (!chatId) { lottoShowToast('⚠️', '텔레그램 미설정', '먼저 텔레그램 Chat ID를 저장해주세요'); return; }

        // ✅ [FIX] 요일 - 반드시 1개만 선택
        const activeDays = [...document.querySelectorAll('.lotto-day-btn.active')].map(b => b.dataset.day);
        if (activeDays.length === 0) { lottoShowToast('⚠️', '요일 미선택', '발송 요일을 선택해주세요'); return; }
        if (activeDays.length > 1)   { lottoShowToast('⚠️', '요일 초과', '요일은 1개만 선택할 수 있습니다'); return; }
        const days = activeDays[0];

        // ✅ [FIX] 발송 시각 - 반드시 선택
        const hourVal = $id('lotto-sch-hour')?.value;
        if (hourVal === '' || hourVal === null || hourVal === undefined) {
          lottoShowToast('⚠️', '시각 미선택', '발송 시각을 선택해주세요'); return;
        }
        const hour = parseInt(hourVal);

        // ✅ [FIX] 게임 수 - 반드시 선택
        const countVal = $id('lotto-sch-count')?.value;
        if (countVal === '' || countVal === null || countVal === undefined) {
          lottoShowToast('⚠️', '게임 수 미선택', '게임 수를 선택해주세요'); return;
        }
        const game_count = parseInt(countVal);

        try {
          // ✅ [FIX] 일주일 수정 제한 - DB(updated_at) 기준, 서버 응답 status로 분기
          const r = await fetch('/api/lotto/schedule', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId, enabled:1, days, hour, game_count})});
          const d = await r.json();
          if (d.remain_days) {
            // 수정 제한 (일주일 미경과)
            lottoShowToast('⚠️', '수정 제한', '자동발송 설정은 일주일에 1번만 수정할 수 있습니다.\n' + d.remain_days + '일 후에 다시 시도하세요.');
          } else if (d.ok) {
            const dayNames = ['','월','화','수','목','금','토','일'];
            lottoShowToast('✅', '저장 완료', '매주 ' + dayNames[parseInt(days)] + '요일 ' + String(hour).padStart(2,'0') + '시에 자동 발송됩니다.');
            lottoLoadSchedule();
            if (typeof lottoLoadTgList === 'function') lottoLoadTgList();
          } else {
            lottoShowToast('❌', '저장 실패', d.error || '다시 시도해주세요');
          }
        } catch(e) { lottoShowToast('❌', '오류', e.message); }
      };

      async function lottoLoadSchedule() {
        try {
          const chatId = ($id('lotto-tg-chatid')?.value?.trim() || localStorage.getItem(LOTTO_TG_CHATID_KEY) || '').trim();
          if (!chatId) return; // chat_id 없으면 빈 상태로 둠
          const r = await fetch('/api/lotto/schedule?chat_id=' + encodeURIComponent(chatId));
          const d = await r.json();
          if (!d) return;

          // ✅ [FIX] 설정한 적 없는 유저는 요일/시각/게임수 모두 미선택 상태로
          // ✅ [FIX] DB 직접 수정 등으로 여러 개 저장된 경우 → 첫 번째 값만 사용
          const rawDays = (d && d.days) ? d.days.split(',').map(x => x.trim()).filter(Boolean) : [];
          const safeDay = rawDays.length > 0 ? rawDays[0] : null; // 항상 1개만
          const hasSchedule = safeDay !== null;

          // 요일 버튼 반영 - 설정 없으면 전부 비활성, 있으면 1개만 활성
          document.querySelectorAll('.lotto-day-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.day === safeDay);
          });

          // 시각/게임수 - 설정 없으면 placeholder(빈값) 표시
          if ($id('lotto-sch-hour')) {
            $id('lotto-sch-hour').value = hasSchedule ? (d.hour ?? '') : '';
          }
          if ($id('lotto-sch-count')) {
            $id('lotto-sch-count').value = hasSchedule ? (d.game_count || '') : '';
          }

          // 현재 등록된 스케줄 표시
          const dayNames = ['','월','화','수','목','금','토','일'];
          const curEl = $id('lotto-sch-current');
          const curText = $id('lotto-sch-current-text');
          if (curEl && curText) {
            if (hasSchedule) {
              const dayName = dayNames[parseInt(safeDay)] || '';
              curText.textContent = '매주 ' + dayName + '요일 ' + String(d.hour||9).padStart(2,'0') + '시 · ' + (d.game_count||5) + '게임 · ' + (d.enabled ? '✅ 활성' : '⏸ 비활성');
              curText.style.color = '#374151';
            } else {
              curText.textContent = '자동 발송 설정을 하지 않았습니다';
              curText.style.color = '#9ca3af';
            }
          }
          if (d.last_sent_at) {
            const el = $id('lotto-sch-last');
            if (el) el.textContent = '마지막 발송: ' + new Date(d.last_sent_at).toLocaleString('ko-KR');
          }
        } catch(e) {}
      }

      function lottoBallClass(n) {
        if (n<=10) return 'lb1'; if (n<=20) return 'lb2';
        if (n<=30) return 'lb3'; if (n<=40) return 'lb4'; return 'lb5';
      }

      function lottoRenderBalls(nums, winning=[]) {
        return nums.map(n => {
          const hit = winning.length && winning.includes(n);
          return '<span class="lotto-ball '+lottoBallClass(n)+'" style="'+(hit?'box-shadow:0 0 0 3px #22c55e,0 2px 6px rgba(0,0,0,.3)':'')+'">'+n+'</span>';
        }).join(' ');
      }

      let lottoHistoryPage = 1;
      const LOTTO_PAGE_SIZE = 10;

      // ── 텔레그램 등록자 관리 ──
      window.lottoLoadTgList = async function() {
        const el = $id('lotto-tg-list');
        if (!el) return;
        el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;">로딩 중...</div>';
        try {
          const r = await fetch('/api/lotto/telegram/list');
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || '로드 실패');
          if (!d.rows?.length) {
            el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">등록된 텔레그램이 없습니다</div>';
            return;
          }

          const dayBtnsHtml = (selectedDay) => ['1','2','3','4','5','6'].map(d => {
            const names = {'1':'월','2':'화','3':'수','4':'목','5':'금','6':'토'};
            const isActive = String(selectedDay) === d;
            return `<button type="button" data-day="${d}" onclick="lottoTgRowDayToggle(this)" style="padding:4px 10px;border-radius:6px;border:1px solid ${isActive?'#6366f1':'#e5e7eb'};background:${isActive?'#6366f1':'#fff'};color:${isActive?'#fff':'#374151'};cursor:pointer;font-size:0.78rem;font-weight:${isActive?'700':'500'};">${names[d]}</button>`;
          }).join('');

          const hourOptionsHtml = (selectedHour) => {
            let html = '<option value="">시각</option>';
            for (let h = 0; h <= 23; h++) {
              html += `<option value="${h}" ${parseInt(selectedHour)===h?'selected':''}>${String(h).padStart(2,'0')}시</option>`;
            }
            return html;
          };

          const countOptionsHtml = (selectedCount) => {
            return [1,3,5,10].map(n => `<option value="${n}" ${parseInt(selectedCount)===n?'selected':''}>${n}게임</option>`).join('');
          };

          el.innerHTML = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.85rem;min-width:780px;">' +
            '<thead><tr style="border-bottom:2px solid #f3f4f6;color:#6b7280;font-weight:700;">' +
            '<th style="padding:8px;text-align:left;">Chat ID</th>' +
            '<th style="padding:8px;text-align:center;">요일</th>' +
            '<th style="padding:8px;text-align:center;">발송시각</th>' +
            '<th style="padding:8px;text-align:center;">게임수</th>' +
            '<th style="padding:8px;text-align:center;">활성</th>' +
            '<th style="padding:8px;text-align:center;">작업</th></tr></thead><tbody>' +
            d.rows.map((row, idx) => {
              const safeOldId = row.chat_id;
              return `<tr data-old-chatid="${safeOldId}" style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px;"><input type="text" value="${row.chat_id}" data-field="chat_id" style="width:140px;padding:4px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.82rem;" /></td>
                <td style="padding:8px;text-align:center;"><div data-field="days" data-value="${row.days||''}" style="display:flex;gap:3px;justify-content:center;">${dayBtnsHtml(row.days)}</div></td>
                <td style="padding:8px;text-align:center;"><select data-field="hour" style="padding:4px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.82rem;">${hourOptionsHtml(row.hour)}</select></td>
                <td style="padding:8px;text-align:center;"><select data-field="game_count" style="padding:4px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.82rem;">${countOptionsHtml(row.game_count)}</select></td>
                <td style="padding:8px;text-align:center;"><input type="checkbox" data-field="enabled" ${row.enabled?'checked':''} style="width:18px;height:18px;cursor:pointer;" /></td>
                <td style="padding:8px;text-align:center;white-space:nowrap;">
                  <button onclick="lottoSaveTgRow(this, '${safeOldId}')" class="sp-btn" style="font-size:0.78rem;padding:4px 10px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-right:4px;">저장</button>
                  <button onclick="lottoDeleteTgRow('${safeOldId}')" class="sp-btn sp-btn-ghost" style="font-size:0.78rem;padding:4px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;cursor:pointer;">삭제</button>
                </td>
              </tr>`;
            }).join('') + '</tbody></table></div>';
        } catch(e) {
          el.innerHTML = '<div style="color:#ef4444;padding:16px;">로드 실패: ' + e.message + '</div>';
        }
      };

      // 행 안에서 요일 버튼 단일 선택 토글
      window.lottoTgRowDayToggle = function(btn) {
        const wrap = btn.parentElement;
        wrap.querySelectorAll('button').forEach(b => {
          b.style.background = '#fff';
          b.style.color = '#374151';
          b.style.borderColor = '#e5e7eb';
          b.style.fontWeight = '500';
        });
        btn.style.background = '#6366f1';
        btn.style.color = '#fff';
        btn.style.borderColor = '#6366f1';
        btn.style.fontWeight = '700';
        wrap.dataset.value = btn.dataset.day;
      };

      // 행 저장
      window.lottoSaveTgRow = async function(btn, oldChatId) {
        const tr = btn.closest('tr');
        const newChatId = tr.querySelector('[data-field="chat_id"]').value.trim();
        const days = tr.querySelector('[data-field="days"]').dataset.value || '';
        const hour = tr.querySelector('[data-field="hour"]').value;
        const game_count = tr.querySelector('[data-field="game_count"]').value;
        const enabled = tr.querySelector('[data-field="enabled"]').checked ? 1 : 0;

        if (!newChatId) { lottoShowToast('⚠️', '입력 오류', 'Chat ID를 입력하세요'); return; }
        if (!days)      { lottoShowToast('⚠️', '입력 오류', '요일을 선택하세요'); return; }
        if (hour === '' || hour === null) { lottoShowToast('⚠️', '입력 오류', '발송 시각을 선택하세요'); return; }
        if (!game_count) { lottoShowToast('⚠️', '입력 오류', '게임 수를 선택하세요'); return; }

        btn.disabled = true; btn.textContent = '저장 중...';
        try {
          const r = await fetch('/api/lotto/telegram/' + encodeURIComponent(oldChatId), {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ chat_id: newChatId, days, hour: parseInt(hour), game_count: parseInt(game_count), enabled })
          });
          const d = await r.json();
          if (d.ok) {
            lottoShowToast('✅', '저장 완료', 'Chat ID ' + newChatId + ' 스케줄이 저장되었습니다.');
            lottoLoadTgList();
          } else {
            lottoShowToast('❌', '저장 실패', d.error || '다시 시도해주세요');
          }
        } catch(e) { lottoShowToast('❌', '오류', e.message); }
        finally { btn.disabled = false; btn.textContent = '저장'; }
      };

      // 행 삭제
      window.lottoDeleteTgRow = function(chatId) {
        lottoConfirm('⚠️', '삭제 확인', 'Chat ID ' + chatId + '의 텔레그램 등록 + 자동발송 설정을 모두 삭제할까요?', async () => {
          try {
            const r = await fetch('/api/lotto/telegram?chat_id=' + encodeURIComponent(chatId), { method: 'DELETE' });
            const d = await r.json();
            if (d.ok) {
              lottoShowToast('✅', '삭제 완료', 'Chat ID ' + chatId + ' 삭제됨');
              lottoLoadTgList();
            } else {
              lottoShowToast('❌', '삭제 실패', d.error || '다시 시도해주세요');
            }
          } catch(e) { lottoShowToast('❌', '오류', e.message); }
        });
      };

      window.lottoLoadHistory = async function(page = 1) {
        lottoHistoryPage = page;
        const el = $id('lotto-history-list');
        if (!el) return;
        el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;">로딩 중...</div>';
        try {
          const r = await fetch(`/api/lotto/picks?page=${page}&limit=${LOTTO_PAGE_SIZE}`);
          const d = await r.json();
          if (!d.picks?.length) { el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">추천 이력이 없습니다</div>'; return; }

          const isAdmin = d.is_admin;

          // 관리자: 유저명 + 날짜별 개별 표시
          // 일반 유저: 날짜별 표시
          const thead = isAdmin
            ? '<th style="padding:8px;text-align:left;">날짜</th><th style="padding:8px;text-align:center;">유저</th><th style="padding:8px;text-align:center;">게임수</th><th style="padding:8px;text-align:center;">회차</th><th style="padding:8px;text-align:center;">최고 등수</th><th style="padding:8px;text-align:center;">최다 일치</th><th style="padding:8px;text-align:center;">상세</th>'
            : '<th style="padding:8px;text-align:left;">날짜</th><th style="padding:8px;text-align:center;">게임수</th><th style="padding:8px;text-align:center;">회차</th><th style="padding:8px;text-align:center;">최고 등수</th><th style="padding:8px;text-align:center;">최다 일치</th><th style="padding:8px;text-align:center;">상세</th>';

          el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
            '<thead><tr style="border-bottom:2px solid #f3f4f6;color:#6b7280;font-weight:700;">' + thead + '</tr></thead><tbody>' +
            d.picks.map(p =>
              '<tr style="border-bottom:1px solid #f3f4f6;">' +
              '<td style="padding:8px;">'+p.pick_date+'</td>' +
              (isAdmin ? '<td style="padding:8px;text-align:center;"><span style="padding:2px 8px;border-radius:999px;background:#eef2ff;color:#6366f1;font-size:0.78rem;font-weight:700;">'+(p.username||'-')+'</span></td>' : '') +
              '<td style="padding:8px;text-align:center;">'+p.game_count+'게임</td>' +
              '<td style="padding:8px;text-align:center;">'+(p.drw_no ? p.drw_no+'회' : '미확인')+'</td>' +
              '<td style="padding:8px;text-align:center;">'+(p.best_rank ? '<span class="lotto-rank-badge rank-'+p.best_rank+'">'+p.best_rank+'등</span>' : '<span class="lotto-rank-badge rank-0">미확인</span>')+'</td>' +
              '<td style="padding:8px;text-align:center;">'+(p.max_match != null ? p.max_match+'개' : '-')+'</td>' +
              '<td style="padding:8px;text-align:center;"><button class="sp-btn sp-btn-ghost" style="font-size:0.78rem;padding:3px 10px;" data-date="' + p.pick_date + '" data-userid="' + (p.user_id||'') + '" onclick="lottoShowDetail(this.dataset.date, this.dataset.userid)">보기</button></td>' +
              '</tr>'
            ).join('') + '</tbody></table>';

          // 페이징 버튼
          if (d.totalPages > 1) {
            const totalPages = d.totalPages;
            let pagingHtml = '<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;">';
            pagingHtml += `<button onclick="lottoLoadHistory(${page-1})" ${page<=1?'disabled':''} style="padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;background:${page<=1?'#f9fafb':'#fff'};cursor:${page<=1?'default':'pointer'};font-size:0.82rem;">← 이전</button>`;
            pagingHtml += `<span style="font-size:0.82rem;color:#6b7280;">${page} / ${totalPages}</span>`;
            pagingHtml += `<button onclick="lottoLoadHistory(${page+1})" ${page>=totalPages?'disabled':''} style="padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;background:${page>=totalPages?'#f9fafb':'#fff'};cursor:${page>=totalPages?'default':'pointer'};font-size:0.82rem;">다음 →</button>`;
            pagingHtml += '</div>';
            el.innerHTML += pagingHtml;
          }
        } catch(e) { el.innerHTML = '<div style="color:#ef4444;padding:16px;">이력 로드 실패</div>'; }
      };

      const DAY_NAMES = ['일','월','화','수','목','금','토'];

      let lottoScheduleLogPage = 1;

      window.lottoLoadScheduleLog = async function(page = 1) {
        lottoScheduleLogPage = page;
        const el = $id('lotto-schedule-log-list');
        if (!el) return;
        el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;">로딩 중...</div>';
        try {
          const _chatId = ($id("lotto-tg-chatid")?.value?.trim() || localStorage.getItem(LOTTO_TG_CHATID_KEY) || "").trim();
          const r = await fetch(`/api/lotto/schedule/log?page=${page}&limit=5` + (_chatId ? "&chat_id=" + encodeURIComponent(_chatId) : ""));
          const d = await r.json();
          if (!d.logs?.length) {
            el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">스케줄 변경 이력이 없습니다</div>';
            return;
          }
          const hasUsername = d.logs[0]?.username !== undefined;
          el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
            '<thead><tr style="border-bottom:2px solid #f3f4f6;color:#6b7280;font-weight:700;">' +
            '<th style="padding:8px;text-align:left;">변경일시</th>' +
            (hasUsername ? '<th style="padding:8px;text-align:center;">유저</th>' : '') +
            '<th style="padding:8px;text-align:center;">요일</th>' +
            '<th style="padding:8px;text-align:center;">시각</th>' +
            '<th style="padding:8px;text-align:center;">게임수</th></tr></thead><tbody>' +
            d.logs.map(p => {
              const dt = new Date(p.sent_at || p.created_at);
              const dateStr = dt.toLocaleDateString('ko-KR') + ' ' + dt.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
              const dayName = (p.days||'').split(',').map(x=>DAY_NAMES[parseInt(x)]||'').filter(Boolean).join(',') + '요일';
              return '<tr style="border-bottom:1px solid #f3f4f6;">' +
              '<td style="padding:8px;font-size:0.78rem;">'+dateStr+'</td>' +
              (hasUsername ? '<td style="padding:8px;text-align:center;color:#6366f1;font-weight:700;">'+(p.username||'-')+'</td>' : '') +
              '<td style="padding:8px;text-align:center;">'+dayName+'</td>' +
              '<td style="padding:8px;text-align:center;">'+String(p.hour).padStart(2,'0')+':00</td>' +
              '<td style="padding:8px;text-align:center;">'+p.game_count+'게임</td>' +
              '</tr>';
            }).join('') + '</tbody></table>';

          // 페이징
          if (d.totalPages > 1) {
            let pagingHtml = '<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;">';
            pagingHtml += `<button onclick="lottoLoadScheduleLog(${page-1})" ${page<=1?'disabled':''} style="padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;background:${page<=1?'#f9fafb':'#fff'};cursor:${page<=1?'default':'pointer'};font-size:0.82rem;">← 이전</button>`;
            pagingHtml += `<span style="font-size:0.82rem;color:#6b7280;">${page} / ${d.totalPages}</span>`;
            pagingHtml += `<button onclick="lottoLoadScheduleLog(${page+1})" ${page>=d.totalPages?'disabled':''} style="padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;background:${page>=d.totalPages?'#f9fafb':'#fff'};cursor:${page>=d.totalPages?'default':'pointer'};font-size:0.82rem;">다음 →</button>`;
            pagingHtml += '</div>';
            el.innerHTML += pagingHtml;
          }
        } catch(e) { el.innerHTML = '<div style="color:#ef4444;padding:16px;">이력 로드 실패</div>'; }
      };

      let lottoAutoHistoryPage = 1;

      window.lottoLoadAutoHistory = async function(page = 1) {
        lottoAutoHistoryPage = page;
        const el = $id('lotto-auto-history-list');
        if (!el) return;
        el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:16px;">로딩 중...</div>';
        try {
          const _chatId = ($id("lotto-tg-chatid")?.value?.trim() || localStorage.getItem(LOTTO_TG_CHATID_KEY) || "").trim();
          const r = await fetch(`/api/lotto/schedule/log?page=${page}&limit=5` + (_chatId ? "&chat_id=" + encodeURIComponent(_chatId) : ""));
          const d = await r.json();
          if (!d.logs?.length) {
            el.innerHTML = '<div style="text-align:center;color:#6b7280;padding:24px;">자동발송 설정 이력이 없습니다</div>';
            return;
          }
          const hasUsername = d.logs[0]?.username !== undefined;
          el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;">' +
            '<thead><tr style="border-bottom:2px solid #f3f4f6;color:#6b7280;font-weight:700;">' +
            '<th style="padding:8px;text-align:left;">등록/수정일</th>' +
            (hasUsername ? '<th style="padding:8px;text-align:center;">유저</th>' : '') +
            '<th style="padding:8px;text-align:center;">요일</th>' +
            '<th style="padding:8px;text-align:center;">발송시각</th>' +
            '<th style="padding:8px;text-align:center;">게임수</th></tr></thead><tbody>' +
            d.logs.map(p => {
              const dt = new Date(p.created_at);
              const dateStr = dt.toLocaleDateString('ko-KR') + ' ' + dt.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});
              const dayName = (p.days||'').split(',').map(d=>DAY_NAMES[parseInt(d)]||'').filter(Boolean).join(',') + '요일';
              const timeStr = String(p.hour).padStart(2,'0') + ':00';
              return '<tr style="border-bottom:1px solid #f3f4f6;">' +
              '<td style="padding:8px;font-size:0.82rem;">'+dateStr+'</td>' +
              (hasUsername ? '<td style="padding:8px;text-align:center;color:#6366f1;font-weight:700;">'+(p.username||'-')+'</td>' : '') +
              '<td style="padding:8px;text-align:center;">'+dayName+'</td>' +
              '<td style="padding:8px;text-align:center;">'+timeStr+'</td>' +
              '<td style="padding:8px;text-align:center;">'+p.game_count+'게임</td>' +
              '</tr>';
            }).join('') + '</tbody></table>';

          // 페이징
          if (d.totalPages > 1) {
            let pagingHtml = '<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;">';
            pagingHtml += `<button onclick="lottoLoadAutoHistory(${page-1})" ${page<=1?'disabled':''} style="padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;background:${page<=1?'#f9fafb':'#fff'};cursor:${page<=1?'default':'pointer'};font-size:0.82rem;">← 이전</button>`;
            pagingHtml += `<span style="font-size:0.82rem;color:#6b7280;">${page} / ${d.totalPages}</span>`;
            pagingHtml += `<button onclick="lottoLoadAutoHistory(${page+1})" ${page>=d.totalPages?'disabled':''} style="padding:4px 10px;border-radius:6px;border:1px solid #e5e7eb;background:${page>=d.totalPages?'#f9fafb':'#fff'};cursor:${page>=d.totalPages?'default':'pointer'};font-size:0.82rem;">다음 →</button>`;
            pagingHtml += '</div>';
            el.innerHTML += pagingHtml;
          }
        } catch(e) { el.innerHTML = '<div style="color:#ef4444;padding:16px;">이력 로드 실패</div>'; }
      };
      window.lottoShowDetail = async function(date, userId) {
        const card = $id('lotto-detail-card');
        const title = $id('lotto-detail-title');
        const gamesEl = $id('lotto-detail-games');
        if (!card || !gamesEl) return;
        card.style.display = 'block';
        title.textContent = '📅 ' + date + ' 추천 번호';
        card.dataset.date = date;
        card.dataset.userId = userId || '';
        gamesEl.innerHTML = '<div style="color:#6b7280;padding:16px;">로딩 중...</div>';
        card.scrollIntoView({behavior:'smooth', block:'start'});
        try {
          const url = userId ? `/api/lotto/picks?date=${date}&user_id=${userId}` : `/api/lotto/picks?date=${date}`;
          const r = await fetch(url);
          const d = await r.json();
          gamesEl.innerHTML = d.picks.map(p => {
            const rankLabel = p.rank
              ? '<span class="lotto-rank-badge rank-'+p.rank+'">'+p.rank+'등 ('+p.matched_count+'개 일치)</span>'
              : (p.matched_count != null ? '<span class="lotto-rank-badge rank-0">'+p.matched_count+'개 일치</span>' : '<span class="lotto-rank-badge rank-0">미확인</span>');
            return '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:8px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span style="font-weight:700;font-size:0.85rem;">'+String.fromCharCode(65+p.game_index)+'게임</span>'+rankLabel+'</div>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+lottoRenderBalls(p.numbers)+'</div></div>';
          }).join('');
        } catch(e) { gamesEl.innerHTML = '<div style="color:#ef4444;">로드 실패</div>'; }
      };

      window.lottoCheckResult = async function() {
        const card = $id('lotto-detail-card');
        const date = card?.dataset.date;
        const drw_no = $id('lotto-check-drwno')?.value?.trim();
        const btn = document.querySelector('button[onclick="lottoCheckResult()"]');

        if (!date) { await spAlert('먼저 추천 이력에서 "보기"를 눌러주세요.', '안내', '⚠️'); return; }
        if (!drw_no) { await spAlert('회차를 입력하세요.', '입력 오류', '⚠️'); return; }

        if (btn) { btn.disabled = true; btn.textContent = '확인 중...'; }
        const gamesEl = $id('lotto-detail-games');
        if (gamesEl) gamesEl.innerHTML = '<div style="color:#6b7280;padding:16px;text-align:center;">⏳ 당첨번호 확인 중...</div>';

        try {
          const r = await fetch('/api/lotto/picks/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pick_date: date, drw_no: parseInt(drw_no) })
          });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || '확인 실패');

          gamesEl.innerHTML =
            '<div style="background:#f8fafc;border-radius:8px;padding:12px;margin-bottom:12px;">' +
            '<span style="font-size:0.82rem;font-weight:700;color:#6b7280;">'+d.drw_no+'회 당첨 번호</span>' +
            '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">'+lottoRenderBalls(d.winning)+
            ' <span style="margin-left:4px;font-size:0.82rem;color:#6b7280;">보너스: <span class="lotto-ball lb5">'+d.bonus+'</span></span></div></div>' +
            d.results.map(res => {
              const rankLabel = res.rank
                ? '<span class="lotto-rank-badge rank-'+res.rank+'">'+res.rank+'등!</span>'
                : '<span class="lotto-rank-badge rank-0">'+res.matched+'개 일치</span>';
              return '<div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:8px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                '<span style="font-weight:700;font-size:0.85rem;">'+String.fromCharCode(65+res.game_index)+'게임</span>'+rankLabel+'</div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap;">'+lottoRenderBalls(res.numbers, d.winning)+'</div></div>';
            }).join('');
          lottoLoadHistory(lottoHistoryPage);
        } catch(e) {
          console.error('lottoCheckResult error:', e);
          if (gamesEl) gamesEl.innerHTML = '<div style="color:#ef4444;padding:16px;">❌ ' + e.message + '</div>';
          await spAlert(e.message, '확인 실패', '❌');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = '당첨 확인'; }
        }
      };

      // ── streak 캐시 (예측 실행 시 1회만 계산) ──
      let _streakCache = null;

      function buildStreakCache() {
        const maxStreak = {}, curStreak = {};
        for (let i = 1; i < lottoHistory.length; i++) {
          const prev = new Set(lottoHistory[i-1]);
          const cur  = new Set(lottoHistory[i]);
          for (let x = 1; x <= 45; x++) {
            if (prev.has(x) && cur.has(x)) {
              curStreak[x] = (curStreak[x] || 0) + 1;
              if ((curStreak[x]||0) > (maxStreak[x]||0)) maxStreak[x] = curStreak[x];
            } else {
              curStreak[x] = 0;
            }
          }
        }
        // streakMultiplier 미리 계산
        const mul = {};
        for (let x = 1; x <= 45; x++) {
          const cs = curStreak[x] || 0;
          const ms = maxStreak[x] || 0;
          if (cs === 0)                        mul[x] = 1.0;
          else if (ms > 0 && cs >= ms)         mul[x] = 0.3;
          else if (ms > 0 && cs >= ms * 0.7)   mul[x] = 0.6;
          else                                  mul[x] = 1.0 + (cs * 0.3);
        }
        return mul;
      }

      window.lottoGenerate = function lottoGenerate() {
        lottoNormalizeWeights();

        // streak 캐시 1회 계산
        _streakCache = buildStreakCache();

        const count = Number($id('lotto-game-count')?.value || 5);
        const games = Array.from({ length: count }, () => generateOneGame());

        lottoLastGames = games;
        renderGames(games);

        // 사용 후 캐시 초기화
        _streakCache = null;
      };

      async function lottoFetchHistoryData() {
        try {
          const res = await fetch('/api/lotto/history');
          if (!res.ok) throw new Error('history api not available');
          const data = await res.json();
          lottoHistory = Array.isArray(data) ? data : [];
        } catch (e) {
          lottoHistory = [];
        }
        updateStats();
      }

      async function lottoInit() {
        if (lottoInitialized) return;
        lottoInitialized = true;

        await lottoLoadWeights();
        lottoRenderAlgos();
        renderGames([]);
        loadTelegramSettings();
        await lottoFetchHistoryData();
        await lottoLoadTgConfig(); if (typeof lottoLoadTgList === "function") lottoLoadTgList();
        await lottoLoadSchedule();
        lottoLoadTgList();
        lottoLoadHistory();
        lottoLoadAutoHistory();
        lottoLoadScheduleLog();
      }

      // 전역 노출 (admin.html에서 호출 가능하게)
      window.lottoInit = async function() {
        lottoInitialized = false;
        await lottoInit();
      };

      document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
          btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            if (tab === 'lotto') {
              lottoInit();
            }
          });
        });
      });
    })();