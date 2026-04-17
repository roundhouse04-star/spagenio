import express from 'express';
import path from 'path';
const router = express.Router();

// ============================================================
// 거래량 급등 감지
// ============================================================
async function detectVolumeSurge(symbols, alpacaKeys = null) {
  // Alpaca Paper 계좌는 data.alpaca.markets 미지원 → yfinance proxy 사용
  const STOCK_API = process.env.STOCK_API_URL || 'http://localhost:5001';
  const results = [];
  await Promise.allSettled(symbols.map(async (symbol) => {
    try {
      const resp = await fetch(`${STOCK_API}/api/stock/history?symbol=${encodeURIComponent(symbol)}&period=1mo&interval=1d`);
      const json = await resp.json();
      const bars = json.data || json.bars || [];
      if (bars.length < 10) return;
      const volumes = bars.map(b => b.volume || b.v || 0).filter(v => v > 0);
      if (volumes.length < 5) return;
      const recentVolume = volumes[volumes.length - 2] || volumes[volumes.length - 1];
      const avgVolume = volumes.slice(0, -2).reduce((a, b) => a + b, 0) / Math.max(volumes.length - 2, 1);
      const todayVolume = recentVolume;
      const ratio = avgVolume > 0 ? todayVolume / avgVolume : 0;
      const closes = bars.map(b => b.close || b.c || 0).filter(v => v > 0);
      const price = closes[closes.length - 1] || 0;
      const change_pct = closes.length >= 2
        ? ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100
        : 0;
      if (ratio >= 1.5) {
        results.push({
          symbol, today_volume: todayVolume, avg_volume: Math.round(avgVolume),
          volume_ratio: parseFloat(ratio.toFixed(2)), price,
          change_pct: parseFloat(change_pct.toFixed(2)),
          surge_level: ratio >= 3 ? 'extreme' : ratio >= 2 ? 'high' : 'moderate'
        });
      }
    } catch (e) { }
  }));
  return results.sort((a, b) => b.volume_ratio - a.volume_ratio);
}

// ============================================================
// 뉴스 촉매 탐지 (RSS 기반)
// ============================================================
async function detectNewsCatalyst(db, symbols) {
  const catalysts = [];
  try {
    const rssRows = db.prepare("SELECT url FROM rss_sources WHERE enabled=1 LIMIT 5").all();
    const newsItems = [];
    await Promise.allSettled(rssRows.map(async (row) => {
      try {
        const resp = await fetch(row.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
        const text = await resp.text();
        const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
        items.slice(0, 10).forEach(m => {
          const title = (m[1].match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) || m[1].match(/<title>(.*?)<\/title>/i) || [])[1] || '';
          const pub = (m[1].match(/<pubDate>(.*?)<\/pubDate>/i) || [])[1] || '';
          const link = (m[1].match(/<link>(.*?)<\/link>/i) || [])[1] || '';
          if (title) newsItems.push({ title, pub, link });
        });
      } catch (e) { }
    }));
    symbols.forEach(symbol => {
      const matched = newsItems.filter(n => n.title.toUpperCase().includes(symbol.toUpperCase()));
      if (matched.length > 0) {
        catalysts.push({ symbol, news_count: matched.length, latest_title: matched[0].title, latest_time: matched[0].pub, link: matched[0].link });
      }
    });
  } catch (e) { }
  return catalysts;
}

// ============================================================
// 리스크 계산
// ============================================================
function calcRiskPosition(accountBalance, price, stopLossPct = 0.05, riskRatio = 0.02) {
  const riskAmount = accountBalance * riskRatio;
  const stopLossAmount = price * stopLossPct;
  const qty = Math.floor(riskAmount / stopLossAmount);
  const totalCost = qty * price;
  const actualRiskPct = (qty * stopLossAmount / accountBalance) * 100;
  return {
    qty: Math.max(qty, 0), total_cost: parseFloat(totalCost.toFixed(2)),
    risk_amount: parseFloat((qty * stopLossAmount).toFixed(2)),
    risk_pct: parseFloat(actualRiskPct.toFixed(2)),
    stop_price: parseFloat((price * (1 - stopLossPct)).toFixed(2)),
    take_profit_price: parseFloat((price * (1 + stopLossPct * 2)).toFixed(2))
  };
}


// ============================================================
// 공통 유틸: NaN/Infinity → null 안전 변환
// ============================================================
function safeJson(text) {
  return JSON.parse(text.replace(/:\s*NaN/g, ': null').replace(/:\s*Infinity/g, ': null').replace(/:\s*-Infinity/g, ': null'));
}
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, data: safeJson(text) };
}

export default function frontRoutes({ db, anthropic, CONFIG, PRESETS, requestStats, startedAt, saveErrorLog, encryptEmail, decryptEmail, getUserAlpacaKeys, buildPayload, forwardToTarget, callClaude, summarizeProviders, runAutoTradeForUser, getNasdaqTop3, saveTradeLog, __dirname, lottoBuildGames }) {

  // ── portfolio_performance 마이그레이션: broker_key_id 컬럼 추가 ──
  try {
    const cols = db.prepare(`PRAGMA table_info(portfolio_performance)`).all();
    if (cols.length && !cols.find(c => c.name === 'broker_key_id')) {
      db.prepare(`ALTER TABLE portfolio_performance ADD COLUMN broker_key_id INTEGER`).run();
      console.log('[migration] portfolio_performance.broker_key_id 컬럼 추가 완료');
    }
  } catch (e) { console.error('[migration] portfolio_performance 마이그레이션 실패:', e.message); }

  // ✅ 페이지 라우트
  router.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
  router.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
  router.get('/register-complete.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-complete.html')));
  router.get('/change-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'change-password.html')));
  router.get('/withdraw', (req, res) => res.sendFile(path.join(__dirname, 'public', 'withdraw.html')));
  router.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')));
  router.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
  router.get('/lotto', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lotto.html')));

  // ✅ 설정/상태 API
  router.get('/api/config', (req, res) => res.json({ ...CONFIG, providers: summarizeProviders(), presets: PRESETS }));
  router.get('/api/health', (req, res) => res.json({ ok: true, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), perfProfile: CONFIG.perfProfile, stats: requestStats, providers: summarizeProviders() }));
  router.get('/api/presets', (req, res) => res.json(PRESETS));

  // ✅ AI 라우팅
  router.post('/api/route-decision', (req, res) => {
    requestStats.preview += 1;
    res.json(buildPayload(req.body));
  });

  router.post('/api/run', async (req, res) => {
    requestStats.run += 1;
    const payload = buildPayload(req.body);
    const engine = payload.engineDecision.engine;
    const model = payload.modelDecision.model;
    try {
      if (model === 'claude' && CONFIG.hasKeys.anthropic) {
        const result = await callClaude(payload.userRequest, payload.taskType, payload.taskComplexity);
        return res.json({ mode: 'live', target: 'claude', latencyMs: result.durationMs, payload, result: result.body });
      }
      if (engine === 'n8n' && CONFIG.n8nWebhookUrl) {
        const result = await forwardToTarget(CONFIG.n8nWebhookUrl, payload);
        return res.json({ mode: 'live', target: 'n8n', latencyMs: result.durationMs, payload, result: result.body });
      }
      if (engine === 'openclaw' && CONFIG.openclawWebhookUrl) {
        const result = await forwardToTarget(CONFIG.openclawWebhookUrl, payload);
        return res.json({ mode: 'live', target: 'openclaw', latencyMs: result.durationMs, payload, result: result.body });
      }
      return res.json({ mode: 'simulation', target: engine, latencyMs: 0, payload, result: { summary: `현재 ${engine} 실서버 URL이 비어 있어 시뮬레이션으로 응답했습니다.` } });
    } catch (error) {
      requestStats.errors += 1;
      return res.status(500).json({ error: '실행 중 오류가 발생했습니다.', detail: error.message, payload });
    }
  });

  router.post('/api/chat', async (req, res) => {
    const { message, taskType = 'general', taskComplexity = 'medium' } = req.body;
    if (!message) return res.status(400).json({ error: '메시지가 필요합니다.' });
    if (!CONFIG.hasKeys.anthropic) return res.status(400).json({ error: 'Anthropic API 키가 설정되지 않았습니다.' });
    try {
      const result = await callClaude(message, taskType, taskComplexity);
      return res.json({ mode: 'live', target: 'claude', latencyMs: result.durationMs, result: result.body });
    } catch (error) {
      return res.status(500).json({ error: 'Claude API 호출 중 오류가 발생했습니다.', detail: error.message });
    }
  });

  // ✅ Alpaca 키 관련
  router.post('/api/alpaca-test', async (req, res) => {
    const { api_key, secret_key, paper } = req.body;
    if (!api_key || !secret_key) return res.status(400).json({ error: 'API Key와 Secret Key를 입력해주세요.' });
    try {
      const baseUrl = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const response = await fetch(`${baseUrl}/v2/account`, { headers: { 'APCA-API-KEY-ID': api_key, 'APCA-API-SECRET-KEY': secret_key } });
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: data.message || '유효하지 않은 API 키입니다.' });
      return res.json({ ok: true, status: data.status });
    } catch (e) { return res.status(500).json({ error: 'Alpaca 서버 연결 실패: ' + e.message }); }
  });

  router.get('/api/user/broker-keys', (req, res) => {
    const rows = db.prepare('SELECT id, account_name, alpaca_api_key, alpaca_paper, is_active, account_type, updated_at FROM user_broker_keys WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
    if (!rows.length) return res.json({ registered: false, accounts: [] });
    return res.json({
      registered: true, accounts: rows.map(r => {
        let key_preview = '****';
        try { key_preview = decryptEmail(r.alpaca_api_key).slice(0, 10) + '...'; } catch (e) { }
        return { id: r.id, account_name: r.account_name, key_preview, alpaca_paper: r.alpaca_paper === 1, is_active: r.is_active === 1, account_type: r.account_type || 0, updated_at: r.updated_at };
      })
    });
  });

  router.post('/api/user/broker-keys', (req, res) => {
    const { account_name, alpaca_api_key, alpaca_secret_key, alpaca_paper } = req.body;
    if (!alpaca_api_key || !alpaca_secret_key) return res.status(400).json({ error: 'API 키와 Secret 키를 입력해주세요.' });
    try {
      const encKey = encryptEmail(alpaca_api_key);
      const encSecret = encryptEmail(alpaca_secret_key);
      const paper = alpaca_paper ? 1 : 0;
      const name = account_name || (paper ? '페이퍼 트레이딩' : '실거래 계좌');
      const count = db.prepare('SELECT COUNT(*) as cnt FROM user_broker_keys WHERE user_id = ?').get(req.user.user_id || req.user.id).cnt;
      const isActive = count === 0 ? 1 : 0;
      const { account_type = 0 } = req.body;
      // account_type 중복 체크 (1=수동, 2=자동은 각 1개만 허용)
      if (account_type === 1 || account_type === 2) {
        const existing = db.prepare('SELECT id FROM user_broker_keys WHERE user_id=? AND account_type=?').get(req.user.id, account_type);
        if (existing) return res.status(400).json({ error: account_type === 1 ? '수동 전용 계좌는 1개만 등록 가능합니다.' : '자동매매 전용 계좌는 1개만 등록 가능합니다.' });
      }
      db.prepare('INSERT INTO user_broker_keys (user_id, account_name, alpaca_api_key, alpaca_secret_key, alpaca_paper, is_active, account_type) VALUES (?,?,?,?,?,?,?)').run(req.user.id, name, encKey, encSecret, paper, isActive, account_type);
      return res.json({ status: 'ok', message: `'${name}' 계좌가 등록됐습니다.` });
    } catch (e) {
      saveErrorLog({ event_type: 'BROKER_KEY_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId: req.user?.id } });
      return res.status(500).json({ error: e.message });
    }
  });

  router.delete('/api/user/broker-keys/:id', (req, res) => {
    const row = db.prepare('SELECT id, is_active, account_type FROM user_broker_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: '계좌를 찾을 수 없습니다.' });
    db.prepare('DELETE FROM user_broker_keys WHERE id = ?').run(req.params.id);
    if (row.is_active) {
      const next = db.prepare('SELECT id FROM user_broker_keys WHERE user_id = ? LIMIT 1').get(req.user.id);
      if (next) db.prepare('UPDATE user_broker_keys SET is_active = 1 WHERE id = ?').run(next.id);
    }
    return res.json({ status: 'ok', message: '계좌가 삭제됐습니다.' });
  });

  // 계좌 타입 변경 API (포지션 없을 때만 가능)
  router.post('/api/user/broker-keys/:id/type', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { account_type } = req.body;
    if (![0, 1, 2].includes(account_type)) return res.status(400).json({ error: '잘못된 계좌 타입' });
    const row = db.prepare('SELECT * FROM user_broker_keys WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: '계좌를 찾을 수 없음' });

    // 타입 변경 시 기존 타입과 다를 경우에만 포지션 체크
    if (row.account_type !== account_type && (row.account_type === 1 || row.account_type === 2)) {
      try {
        const keys = getUserAlpacaKeys(req.user.id, row.id);
        if (keys) {
          const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
          const posRes = await fetch(`${baseUrl}/v2/positions`, {
            headers: { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key }
          });
          const positions = await posRes.json();
          const posList = Array.isArray(positions) ? positions : [];
          if (posList.length > 0) {
            return res.status(400).json({ error: `보유 종목 ${posList.length}개가 있어 계좌 타입을 변경할 수 없습니다. 모든 포지션을 정리 후 변경해주세요.` });
          }
        }
      } catch (e) { }
    }

    // 동일 타입 중복 체크 (1=수동, 2=자동은 각 1개만)
    if (account_type === 1 || account_type === 2) {
      const existing = db.prepare('SELECT id FROM user_broker_keys WHERE user_id=? AND account_type=? AND id!=?').get(req.user.id, account_type, row.id);
      if (existing) return res.status(400).json({ error: account_type === 1 ? '수동 전용 계좌가 이미 있습니다.' : '자동매매 전용 계좌가 이미 있습니다.' });
    }

    db.prepare('UPDATE user_broker_keys SET account_type=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(account_type, row.id);
    res.json({ ok: true });
  });

  router.post('/api/user/broker-keys/:id/activate', (req, res) => {
    const row = db.prepare('SELECT id FROM user_broker_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: '계좌를 찾을 수 없습니다.' });
    db.prepare('UPDATE user_broker_keys SET is_active = 0 WHERE user_id = ?').run(req.user.id);
    db.prepare('UPDATE user_broker_keys SET is_active = 1 WHERE id = ?').run(req.params.id);
    return res.json({ status: 'ok', message: '활성 계좌가 변경됐습니다.' });
  });

  // ✅ Alpaca 프록시
  router.all('/api/alpaca-user/*', async (req, res) => {
    const accountId = req.headers['x-account-id'] || req.query.accountId;
    const keys = getUserAlpacaKeys(req.user.id, accountId);
    if (!keys) return res.status(200).json({ ok: false, no_account: true, error: 'Alpaca 계좌를 먼저 등록해주세요.', positions: [], orders: [] });
    try {
      const alpacaPath = req.originalUrl.split('?')[0].replace('/api/alpaca-user', '');
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const query = Object.keys(req.query).filter(k => k !== 'accountId').length ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(req.query).filter(([k]) => k !== 'accountId'))).toString() : '';
      const response = await fetch(`${baseUrl}${alpacaPath}${query}`, { method: req.method, headers: { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' }, body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined });
      return res.status(response.status).json(await response.json());
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  // ✅ 퀀트/주식 프록시
  router.all('/proxy/quant/*', async (req, res) => {
    try {
      const quantPath = req.path.replace('/proxy/quant', '');
      const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
      const response = await fetch(`http://localhost:5002${quantPath}${query}`, { method: req.method, headers: { 'Content-Type': 'application/json' }, body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined });
      const rawText = await response.text();
      res.json(safeJson(rawText));
    } catch (error) { res.status(500).json({ error: '퀀트 서버 연결 실패', detail: error.message }); }
  });

  router.all('/proxy/stock/*', async (req, res) => {
    try {
      const stockPath = req.path.replace('/proxy/stock', '');
      const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
      const response = await fetch(`http://localhost:5001${stockPath}${query}`, { method: req.method, headers: { 'Content-Type': 'application/json' }, body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined });
      const rawText = await response.text();
      res.json(safeJson(rawText));
    } catch (error) { res.status(500).json({ error: '주식 서버 연결 실패', detail: error.message }); }
  });

  // ✅ 뉴스 API (RSS 실시간 조회 - DB 저장 없음)

  // RSS XML 파싱 헬퍼
  async function fetchRss(url) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; spagenio/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    const xml = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRegex.exec(xml)) !== null) {
      const block = m[1];
      const get = (tag) => {
        const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i');
        const hit = r.exec(block);
        return hit ? hit[1].trim() : '';
      };
      // <link> 태그는 RSS에서 특수하게 처리 (텍스트 노드 방식)
      const getLinkFromBlock = (block) => {
        // 방법1: <link>URL</link> 형식
        const r1 = /<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(block);
        if (r1 && r1[1].trim().startsWith("http") && r1[1].trim().split("/").length > 4) return r1[1].trim();
        // 방법2: <link>뒤에 바로 URL이 오는 형식 (BBC 등)
        const r2 = /<link\s*\/?>([^<]+)/i.exec(block);
        if (r2 && r2[1].trim().startsWith('http')) return r2[1].trim();
        // 방법3: guid가 URL인 경우
        const r3 = /<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i.exec(block);
        if (r3 && r3[1].trim().startsWith('http')) return r3[1].trim();
        return '';
      };
      const link = getLinkFromBlock(block);
      const title = get('title');
      const pubDate = get('pubDate');
      if (title && link) items.push({ title, url: link, pubDate });
    }
    return items;
  }

  // 뉴스 조회 (활성화된 RSS 소스 전체 또는 카테고리별)
  router.get('/api/news/fetch', async (req, res) => {
    try {
      const { category = 'all' } = req.query;
      let sources = category === 'all'
        ? db.prepare('SELECT * FROM rss_sources WHERE enabled = 1').all()
        : db.prepare('SELECT * FROM rss_sources WHERE enabled = 1 AND category = ?').all(category);

      if (!sources.length) return res.json({ news: [], total: 0 });

      // 병렬로 RSS 수집
      const results = await Promise.allSettled(sources.map(async (s) => {
        const items = await fetchRss(s.url);
        return items.map(item => ({
          title: item.title,
          url: item.url,
          source: s.name,
          category: s.category,
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : null
        }));
      }));

      // 성공한 것만 합치고 최신순 정렬
      const news = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value)
        .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
        .slice(0, 100);

      return res.json({ news, total: news.length });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  });

  // ✅ 로또 API — chat_id 키값 기반 (로그인 아이디 매핑 불필요)
  router.get('/api/lotto/telegram/config', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    // chat_id query로 조회 (없으면 빈 응답)
    const { chat_id } = req.query;
    if (!chat_id) return res.json({ chat_id: '', has_token: false });
    const row = db.prepare('SELECT chat_id, bot_token FROM lotto_telegram WHERE chat_id = ?').get(String(chat_id));
    res.json({ chat_id: row?.chat_id || '', has_token: !!row?.bot_token });
  });

  // ✅ 텔레그램 설정 공통 API (성과 대시보드용 - 기존 user_telegram 유지)
  router.get('/api/user/telegram', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id = ?').get(req.user.user_id || req.user.id);
    res.json({ chat_id: row?.chat_id || '', bot_token: row?.bot_token || '' });
  });

  router.post('/api/user/telegram', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    let { chat_id, bot_token } = req.body;
    if (!chat_id) return res.status(400).json({ error: 'chat_id 필요' });
    if (bot_token && bot_token.startsWith('bot')) bot_token = bot_token.slice(3);
    const existing = db.prepare('SELECT id FROM user_telegram WHERE user_id = ?').get(req.user.user_id || req.user.id);
    if (existing) {
      db.prepare(`UPDATE user_telegram SET chat_id=?, bot_token=COALESCE(NULLIF(?,''),bot_token), updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(chat_id, bot_token || '', req.user.user_id || req.user.id);
    } else {
      db.prepare('INSERT INTO user_telegram (user_id, chat_id, bot_token) VALUES (?,?,?)').run(req.user.user_id || req.user.id, chat_id, bot_token || '');
    }
    res.json({ ok: true });
  });

  // ✅ 로또 텔레그램 설정 저장 - chat_id를 키값으로만 사용
  router.post('/api/lotto/telegram/config', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const { chat_id } = req.body;
      let { bot_token } = req.body;
      if (!chat_id) return res.status(400).json({ ok: false, error: 'chat_id 필요' });
      if (bot_token && bot_token.startsWith('bot')) bot_token = bot_token.slice(3);

      const cid = String(chat_id);
      const existing = db.prepare('SELECT chat_id FROM lotto_telegram WHERE chat_id = ?').get(cid);
      if (existing) {
        // 같은 chat_id가 이미 등록된 경우 → 안내 + bot_token이 있으면 갱신
        if (bot_token) {
          db.prepare(`UPDATE lotto_telegram SET bot_token=?, updated_at=CURRENT_TIMESTAMP WHERE chat_id=?`).run(bot_token, cid);
        }
        return res.json({ ok: true, duplicate: true, message: '이미 등록된 Chat ID입니다.' });
      }
      db.prepare('INSERT INTO lotto_telegram (chat_id, bot_token) VALUES (?,?)').run(cid, bot_token || '');
      res.json({ ok: true });
    } catch (e) {
      console.error('[lotto/telegram/config POST]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/api/lotto/telegram', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    let { token, chatid, text } = req.body;
    if (!chatid) {
      // chat_id 미지정 시 → 가장 최근 등록된 lotto_telegram 사용
      const tg = db.prepare('SELECT chat_id, bot_token FROM lotto_telegram ORDER BY updated_at DESC LIMIT 1').get();
      if (!tg) return res.status(400).json({ ok: false, error: '텔레그램 Chat ID를 먼저 등록하세요.' });
      chatid = tg.chat_id;
      token = token || tg.bot_token || process.env.TG_BOT_TOKEN;
    } else {
      // chat_id 지정 시 → 해당 chat_id의 bot_token 사용
      const tg = db.prepare('SELECT bot_token FROM lotto_telegram WHERE chat_id=?').get(String(chatid));
      token = token || tg?.bot_token || process.env.TG_BOT_TOKEN;
    }
    if (!token) return res.status(400).json({ ok: false, error: 'Bot Token 없음' });
    try {
      const { execSync } = await import('child_process');
      const bodyStr = JSON.stringify({ chat_id: chatid, text, parse_mode: 'Markdown' });
      const curlCmd = `curl -s -X POST https://api.telegram.org/bot${token}/sendMessage -H 'Content-Type: application/json' --data-binary @-`;
      const result = execSync(curlCmd, { input: bodyStr }).toString();
      const data = JSON.parse(result);
      res.json(data.ok ? { ok: true } : { ok: false, error: data.description });
    } catch (e) { console.error('[telegram error]', e.message, e.stack); res.status(500).json({ ok: false, error: e.message }); }
  });

  // ✅ 로또 텔레그램 broadcast — lotto_telegram 등록된 모든 사용자에게 발송
  router.post('/api/lotto/telegram/broadcast', async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const { text } = req.body;
      if (!text) return res.status(400).json({ ok: false, error: 'text 필요' });

      const recipients = db.prepare('SELECT chat_id, bot_token FROM lotto_telegram').all();
      if (recipients.length === 0) {
        return res.json({ ok: false, error: '등록된 텔레그램 사용자가 없습니다.' });
      }

      // 모든 chat_id에 병렬 발송
      const results = await Promise.all(recipients.map(async (r) => {
        const token = r.bot_token || process.env.TG_BOT_TOKEN;
        if (!token) return { chat_id: r.chat_id, ok: false, error: 'no token' };
        try {
          const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: r.chat_id, text, parse_mode: 'Markdown' })
          });
          const data = await resp.json();
          return { chat_id: r.chat_id, ok: !!data.ok, error: data.description };
        } catch (e) {
          return { chat_id: r.chat_id, ok: false, error: e.message };
        }
      }));

      const sent = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).length;
      const errors = results.filter(r => !r.ok).map(r => `${r.chat_id}: ${r.error}`).slice(0, 5);

      res.json({ ok: sent > 0, sent, failed, total: recipients.length, errors });
    } catch (e) {
      console.error('[lotto/telegram/broadcast]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ✅ 신규 통합 등록 (텔레그램 + 자동발송 한 번에) — 중복만 체크, 그 외 제약 없음
  router.post('/api/lotto/telegram/register', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const { chat_id, bot_token, days, hour, game_count, enabled = 1 } = req.body;

      if (!chat_id) return res.json({ ok: false, error: 'Chat ID를 입력하세요' });
      if (!days)    return res.json({ ok: false, error: '요일을 선택하세요' });
      if (hour === undefined || hour === null || hour === '') return res.json({ ok: false, error: '발송 시각을 선택하세요' });
      if (!game_count) return res.json({ ok: false, error: '게임 수를 선택하세요' });

      const cid = String(chat_id).trim();
      const cleanToken = (bot_token && String(bot_token).startsWith('bot')) ? String(bot_token).slice(3) : (bot_token || '');

      // 중복 체크 (유일한 제약)
      const existing = db.prepare('SELECT chat_id FROM lotto_telegram WHERE chat_id=?').get(cid);
      if (existing) {
        return res.json({ ok: false, duplicate: true, error: '이미 등록된 Chat ID입니다. 아래 등록자 리스트에서 수정하세요.' });
      }

      // 트랜잭션으로 두 테이블 동시 INSERT
      const tx = db.transaction(() => {
        db.prepare('INSERT INTO lotto_telegram (chat_id, bot_token) VALUES (?,?)').run(cid, cleanToken);
        db.prepare('INSERT INTO lotto_schedule (chat_id, enabled, days, hour, game_count) VALUES (?,?,?,?,?)')
          .run(cid, enabled ? 1 : 0, String(days), parseInt(hour), parseInt(game_count));
        const today = new Date().toISOString().split('T')[0];
        const drw_no = Math.floor((new Date(today) - new Date('2002-12-07')) / (7 * 24 * 60 * 60 * 1000)) + 1;
        db.prepare('INSERT INTO lotto_schedule_log (chat_id, days, hour, game_count, drw_no, action) VALUES (?,?,?,?,?,?)')
          .run(cid, String(days), parseInt(hour), parseInt(game_count), drw_no, 'create');
      });
      tx();

      res.json({ ok: true, chat_id: cid });
    } catch (e) {
      console.error('[lotto/telegram/register]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ✅ 로또 텔레그램 등록자 + 스케줄 통합 리스트 (관리자 화면용)
  router.get('/api/lotto/telegram/list', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const rows = db.prepare(`
        SELECT lt.chat_id, lt.bot_token, lt.created_at, lt.updated_at AS tg_updated_at,
               ls.enabled, ls.days, ls.hour, ls.game_count, ls.last_sent_at, ls.updated_at AS sch_updated_at
        FROM lotto_telegram lt
        LEFT JOIN lotto_schedule ls ON ls.chat_id = lt.chat_id
        ORDER BY lt.created_at DESC
      `).all();
      res.json({ ok: true, rows });
    } catch (e) {
      console.error('[lotto/telegram/list]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ✅ 텔레그램+스케줄 통합 수정 (chat_id 자체 변경도 지원)
  router.put('/api/lotto/telegram/:oldChatId', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const oldId = String(req.params.oldChatId);
      const { chat_id, bot_token, days, hour, game_count, enabled } = req.body;
      const newId = String(chat_id || oldId);
      // bot_token이 'bot' prefix면 제거
      const cleanToken = (bot_token != null && String(bot_token).startsWith('bot')) ? String(bot_token).slice(3) : (bot_token != null ? String(bot_token) : null);

      // chat_id 변경 시 새 ID가 이미 존재하면 충돌
      if (newId !== oldId) {
        const dup = db.prepare('SELECT chat_id FROM lotto_telegram WHERE chat_id=?').get(newId);
        if (dup) return res.json({ ok: false, error: '이미 등록된 Chat ID입니다.' });
      }

      const tx = db.transaction(() => {
        if (newId !== oldId) {
          db.prepare('UPDATE lotto_telegram SET chat_id=?, updated_at=CURRENT_TIMESTAMP WHERE chat_id=?').run(newId, oldId);
          db.prepare('UPDATE lotto_schedule SET chat_id=? WHERE chat_id=?').run(newId, oldId);
        }
        // bot_token 변경 (제공됐을 때만)
        if (cleanToken !== null && cleanToken !== '') {
          db.prepare('UPDATE lotto_telegram SET bot_token=?, updated_at=CURRENT_TIMESTAMP WHERE chat_id=?').run(cleanToken, newId);
        }
        // 스케줄 upsert
        const existing = db.prepare('SELECT chat_id FROM lotto_schedule WHERE chat_id=?').get(newId);
        if (existing) {
          db.prepare('UPDATE lotto_schedule SET enabled=?, days=?, hour=?, game_count=?, updated_at=CURRENT_TIMESTAMP WHERE chat_id=?')
            .run(enabled ? 1 : 0, days, hour, game_count, newId);
        } else {
          db.prepare('INSERT INTO lotto_schedule (chat_id, enabled, days, hour, game_count) VALUES (?,?,?,?,?)')
            .run(newId, enabled ? 1 : 0, days, hour, game_count);
        }
        // 변경 이력
        const today = new Date().toISOString().split('T')[0];
        const drw_no = Math.floor((new Date(today) - new Date('2002-12-07')) / (7 * 24 * 60 * 60 * 1000)) + 1;
        db.prepare('INSERT INTO lotto_schedule_log (chat_id, days, hour, game_count, drw_no, action) VALUES (?,?,?,?,?,?)')
          .run(newId, days, hour, game_count, drw_no, 'update');
      });
      tx();

      res.json({ ok: true, chat_id: newId });
    } catch (e) {
      console.error('[lotto/telegram PUT]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ✅ 텔레그램 등록자 삭제 (스케줄도 같이 삭제)
  router.delete('/api/lotto/telegram', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const chatId = req.query.chat_id || req.body?.chat_id;
      if (!chatId) return res.json({ ok: false, error: 'chat_id 필요' });
      const cid = String(chatId);
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM lotto_schedule WHERE chat_id=?').run(cid);
        db.prepare('DELETE FROM lotto_telegram WHERE chat_id=?').run(cid);
      });
      tx();
      res.json({ ok: true });
    } catch (e) {
      console.error('[lotto/telegram DELETE]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.get('/api/lotto/schedule', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { chat_id } = req.query;
    if (!chat_id) return res.json(null);
    const row = db.prepare('SELECT * FROM lotto_schedule WHERE chat_id=?').get(String(chat_id));
    res.json(row || null);
  });

  router.post('/api/lotto/schedule', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const { chat_id, enabled, days, hour, game_count } = req.body;
      if (!chat_id) return res.json({ ok: false, error: '먼저 텔레그램 설정(Chat ID)을 저장해주세요.' });

      const cid = String(chat_id);

      // ✅ chat_id가 lotto_telegram에 등록되어 있어야 자동발송 JOIN 매칭이 됨
      const tgExists = db.prepare('SELECT chat_id FROM lotto_telegram WHERE chat_id=?').get(cid);
      if (!tgExists) {
        return res.json({ ok: false, error: '먼저 텔레그램 설정(Chat ID)을 저장해주세요.' });
      }

      const existing = db.prepare('SELECT chat_id, updated_at FROM lotto_schedule WHERE chat_id=?').get(cid);
      // ✅ 일주일 제약 제거 — 자유롭게 수정 가능
      if (existing) {
        db.prepare('UPDATE lotto_schedule SET enabled=?,days=?,hour=?,game_count=?,updated_at=CURRENT_TIMESTAMP WHERE chat_id=?')
          .run(enabled ? 1 : 0, days, hour, game_count, cid);
      } else {
        db.prepare('INSERT INTO lotto_schedule (chat_id,enabled,days,hour,game_count) VALUES (?,?,?,?,?)')
          .run(cid, enabled ? 1 : 0, days, hour, game_count);
      }
      // 스케줄 변경 이력 저장 (현재 날짜 기준 회차 계산)
      const today = new Date().toISOString().split('T')[0];
      const drw_no = Math.floor((new Date(today) - new Date('2002-12-07')) / (7 * 24 * 60 * 60 * 1000)) + 1;
      db.prepare('INSERT INTO lotto_schedule_log (chat_id, days, hour, game_count, drw_no) VALUES (?,?,?,?,?)')
        .run(cid, days, hour, game_count, drw_no);
      res.json({ ok: true });
    } catch (e) {
      console.error('[lotto/schedule POST]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.delete('/api/lotto/schedule', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const chat_id = req.query.chat_id || req.body?.chat_id;
    if (!chat_id) return res.json({ ok: false, error: 'chat_id 필요' });
    db.prepare('DELETE FROM lotto_schedule WHERE chat_id=?').run(String(chat_id));
    res.json({ ok: true });
  });

  router.get('/api/lotto/schedule/log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { page = 1, limit = 5, chat_id } = req.query;
    const isAdmin = req.user.is_admin;
    const pageSize = parseInt(limit);
    const offset = (parseInt(page) - 1) * pageSize;
    // 관리자는 모든 chat_id, 일반 유저는 query의 chat_id로 필터
    const total = isAdmin
      ? db.prepare('SELECT COUNT(*) as cnt FROM lotto_schedule_log').get()?.cnt || 0
      : (chat_id ? db.prepare('SELECT COUNT(*) as cnt FROM lotto_schedule_log WHERE chat_id=?').get(String(chat_id))?.cnt || 0 : 0);
    const rows = isAdmin
      ? db.prepare('SELECT * FROM lotto_schedule_log ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset)
      : (chat_id ? db.prepare('SELECT * FROM lotto_schedule_log WHERE chat_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(String(chat_id), pageSize, offset) : []);
    res.json({ logs: rows, total, page: parseInt(page), totalPages: Math.ceil(total / pageSize) });
  });

  router.get('/api/lotto/history', async (req, res) => {
    try {
      const rows = db.prepare('SELECT drw_no, numbers, bonus, drw_date FROM lotto_history ORDER BY drw_no DESC LIMIT 100').all();
      const history = rows.map(r => JSON.parse(r.numbers));
      res.json({ history, latest_round: rows[0]?.drw_no || 0, count: history.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ===== 로또 가중치 + 예측 시스템 =====

  router.get('/api/lotto/weights', (req, res) => {
    try {
      const rows = db.prepare('SELECT num, weight, appear_count, hit_count, updated_at FROM lotto_weights ORDER BY num').all();
      res.json({ ok: true, weights: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/lotto/prediction/save', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const { based_on_round, predicted_for_round, picks } = req.body;
      if (!based_on_round || !picks) return res.status(400).json({ error: '필수값 누락' });
      // 동일 회차 + 동일 번호 중복 저장 방지
      const picksJson = JSON.stringify(picks);
      const existing = db.prepare('SELECT id FROM lotto_predictions WHERE based_on_round=? AND picks=?').get(based_on_round, picksJson);
      if (existing) return res.json({ ok: true, skipped: true, message: '이미 동일한 예측번호가 저장되어 있습니다.' });
      db.prepare('INSERT INTO lotto_predictions (based_on_round, predicted_for_round, picks) VALUES (?,?,?)')
        .run(based_on_round, predicted_for_round || null, picksJson);
      res.json({ ok: true, skipped: false });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ✅ 예측 실행 — 서버에서 lottoBuildGames(N) 실행 → lotto_predictions에 저장 → 결과 리턴
  router.post('/api/lotto/prediction/run', (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: '로그인 필요' });
      const count = parseInt(req.body?.count) || 10;
      if (typeof lottoBuildGames !== 'function') return res.status(500).json({ ok: false, error: 'lottoBuildGames 미연결' });

      const games = lottoBuildGames(count);
      if (!games.length) return res.json({ ok: false, error: '로또 당첨번호 이력이 없습니다.' });

      const latest = db.prepare('SELECT drw_no FROM lotto_history ORDER BY drw_no DESC LIMIT 1').get();
      if (!latest) return res.json({ ok: false, error: '최신 회차 조회 실패' });

      // 10게임 INSERT
      const stmt = db.prepare('INSERT INTO lotto_predictions (based_on_round, predicted_for_round, picks) VALUES (?,?,?)');
      const tx = db.transaction(() => {
        games.forEach(picks => stmt.run(latest.drw_no, latest.drw_no + 1, JSON.stringify(picks)));
      });
      tx();

      res.json({
        ok: true,
        saved: games.length,
        based_on_round: latest.drw_no,
        predicted_for_round: latest.drw_no + 1,
        games
      });
    } catch (e) {
      console.error('[prediction/run]', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/api/lotto/prediction/check', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const { prediction_id } = req.body;
      if (!prediction_id) return res.status(400).json({ error: '필수값 누락' });
      const pred = db.prepare('SELECT * FROM lotto_predictions WHERE id=?').get(prediction_id);
      if (!pred) return res.status(404).json({ error: '예측 없음' });
      const picks = JSON.parse(pred.picks);
      // based_on_round 다음 회차로 자동 계산
      const actual_round = pred.predicted_for_round || (pred.based_on_round + 1);
      const actual = db.prepare('SELECT numbers FROM lotto_history WHERE drw_no=?').get(actual_round);
      if (!actual) return res.status(200).json({ ok: false, pending: true, error: `${actual_round}회 아직 추첨 전입니다` });
      const actualNums = JSON.parse(actual.numbers);
      const hits = picks.filter(n => actualNums.includes(n));
      const updateWeight = db.prepare('UPDATE lotto_weights SET weight=MAX(0.1,MIN(5.0,weight*?)),appear_count=appear_count+1,hit_count=hit_count+?,updated_at=CURRENT_TIMESTAMP WHERE num=?');
      picks.forEach(n => updateWeight.run(hits.includes(n) ? 1.15 : 0.92, hits.includes(n) ? 1 : 0, n));
      actualNums.filter(n => !picks.includes(n)).forEach(n => updateWeight.run(1.05, 0, n));
      db.prepare('UPDATE lotto_predictions SET hit_count=?,predicted_for_round=?,result_checked=1 WHERE id=?')
        .run(hits.length, actual_round, prediction_id);
      res.json({ ok: true, hit_count: hits.length, hits, picks, actual_nums: actualNums });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/lotto/prediction/history', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM lotto_predictions ORDER BY created_at DESC LIMIT 20').all();
      res.json({ ok: true, predictions: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // 반복출현번호 분석용 - drw_no, numbers, bonus, drw_date 전체 반환
  router.get('/api/lotto/history-full', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 500);
      const rows = db.prepare('SELECT drw_no, numbers, bonus, drw_date FROM lotto_history ORDER BY drw_no DESC LIMIT ?').all(limit);
      const history = rows.map(r => ({
        drw_no: r.drw_no,
        numbers: typeof r.numbers === 'string' ? JSON.parse(r.numbers) : r.numbers,
        bonus: r.bonus,
        drw_date: r.drw_date
      }));
      res.json({ ok: true, history, count: history.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/lotto/algorithm-weights', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const DEFAULT_WEIGHTS = { freq: 20, hot: 20, cold: 10, balance: 15, zone: 10, ac: 10, prime: 5, delta: 10 };
    const row = db.prepare('SELECT weights FROM lotto_algorithm_weights WHERE user_id=?').get(req.user.user_id || req.user.id);
    if (!row) return res.json(DEFAULT_WEIGHTS);
    try { res.json({ ...DEFAULT_WEIGHTS, ...JSON.parse(row.weights) }); } catch { res.json(DEFAULT_WEIGHTS); }
  });

  router.post('/api/lotto/algorithm-weights', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const weights = JSON.stringify(req.body);
      const existing = db.prepare('SELECT id FROM lotto_algorithm_weights WHERE user_id=?').get(req.user.user_id || req.user.id);
      if (existing) { db.prepare('UPDATE lotto_algorithm_weights SET weights=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(weights, req.user.id); }
      else { db.prepare('INSERT INTO lotto_algorithm_weights (user_id, weights) VALUES (?,?)').run(req.user.id, weights); }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ✅ 자동매매 API
  router.get('/api/trade4/positions', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const keys = getUserAlpacaKeys(req.user.id, null);
    if (!keys) return res.json({ positions: [] });
    try {
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key };
      const posData = await (await fetch(`${baseUrl}/v2/positions`, { headers })).json();
      const positions = Array.isArray(posData) ? posData : (posData.positions || []);
      const autoSymbols = new Set(db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=4 AND action='BUY' AND status='active'").all(req.user.id).map(r => r.symbol));
      res.json({ positions: positions.filter(p => autoSymbols.has(p.symbol)) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/trade4/cancel/:symbol', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { symbol } = req.params;
    const keys = getUserAlpacaKeys(req.user.id, null);
    if (!keys) return res.status(400).json({ error: 'Alpaca 키 없음' });
    try {
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };
      const pos = await (await fetch(`${baseUrl}/v2/positions/${symbol}`, { headers })).json();
      if (!pos.qty) return res.status(404).json({ error: '포지션 없음' });
      const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) })).json();
      const plPct = parseFloat(pos.unrealized_plpc) || 0;
      // [레거시 제거] auto_trade_log SELL_MANUAL 제거
      saveTradeLog({ user_id: req.user.id, trade_type: 4, symbol, action: 'SELL_MANUAL', qty: pos.qty, price: pos.current_price, reason: '수동 취소', order_id: order.id || '', profit_pct: plPct * 100, status: 'closed' });
      db.prepare("UPDATE trade_log SET status='closed' WHERE user_id=? AND symbol=? AND trade_type=4 AND action='BUY' AND status='active'").run(req.user.id, symbol);
      res.json({ ok: true, order });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/trade4/stop_all', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const keys = getUserAlpacaKeys(req.user.id, null);
    if (!keys) return res.status(400).json({ error: 'Alpaca 키 없음' });
    try {
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };
      db.prepare('UPDATE trade_setting_type4 SET enabled=0 WHERE user_id=?').run(req.user.id);
      const autoSymbols = db.prepare("SELECT DISTINCT symbol FROM trade_log WHERE user_id=? AND trade_type=4 AND action='BUY' AND status='active'").all(req.user.id);
      const results = [];
      for (const { symbol } of autoSymbols) {
        try {
          const pos = await (await fetch(`${baseUrl}/v2/positions/${symbol}`, { headers })).json();
          if (!pos.qty) continue;
          const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) })).json();
          const plPct = parseFloat(pos.unrealized_plpc) || 0;
          // [레거시 제거] auto_trade_log SELL_STOP_ALL 제거
          saveTradeLog({ user_id: req.user.id, trade_type: 4, symbol, action: 'SELL_STOP_ALL', qty: pos.qty, price: pos.current_price, reason: '전체 종료', order_id: order.id || '', profit_pct: plPct * 100, status: 'closed' });
          db.prepare("UPDATE trade_log SET status='closed' WHERE user_id=? AND symbol=? AND trade_type=4 AND action='BUY' AND status='active'").run(req.user.id, symbol);
          results.push(symbol);
        } catch (e) { }
      }
      res.json({ ok: true, closed: results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/trade4/settings', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const bkId4 = req.query.broker_key_id || req.body?.broker_key_id || null;
    const row = bkId4 ? db.prepare('SELECT * FROM trade_setting_type4 WHERE user_id=? AND broker_key_id=?').get(req.user.id, bkId4) : db.prepare('SELECT * FROM trade_setting_type4 WHERE user_id=? ORDER BY broker_key_id DESC LIMIT 1').get(req.user.id);
    res.json(row || { enabled: 0, symbols: 'QQQ,SPY,AAPL', balance_ratio: 0.1, take_profit: 0.05, stop_loss: 0.05, signal_mode: 'combined', factor_strategy: 'value_quality', factor_market: 'nasdaq' });
  });

  router.post('/api/trade4/settings_save', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { enabled, symbols, balance_ratio, take_profit, stop_loss, signal_mode, factor_strategy, factor_market, kr_candidate_symbols } = req.body;
    const fs = factor_strategy || 'value_quality';
    const fm = factor_market || 'nasdaq';
    const { broker_key_id: bkId4s } = req.body;
    const existing = bkId4s ? db.prepare('SELECT id FROM trade_setting_type4 WHERE user_id=? AND broker_key_id=?').get(req.user.id, bkId4s) : db.prepare('SELECT id FROM trade_setting_type4 WHERE user_id=? AND broker_key_id IS NULL').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE trade_setting_type4 SET enabled=?,symbols=?,balance_ratio=?,take_profit=?,stop_loss=?,signal_mode=?,factor_strategy=?,factor_market=?,kr_candidate_symbols=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode, fs, fm, kr_candidate_symbols || null, existing.id);
    } else {
      db.prepare('INSERT INTO trade_setting_type4 (user_id,broker_key_id,enabled,symbols,balance_ratio,take_profit,stop_loss,signal_mode,factor_strategy,factor_market,kr_candidate_symbols) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(req.user.id, bkId4s || null, enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode, fs, fm, kr_candidate_symbols || null);
    }
    res.json({ ok: true });
  });

  router.get('/api/trade4/log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const rows = db.prepare("SELECT tl.*, CASE tl.trade_type WHEN 1 THEN '수동' WHEN 2 THEN '단순자동' WHEN 3 THEN '완전자동' WHEN 4 THEN '일반자동' ELSE '기타' END as type_name FROM trade_log tl WHERE tl.user_id=? ORDER BY tl.created_at DESC LIMIT 100").all(req.user.id);
    res.json({ logs: rows });
  });

  router.post('/api/trade4/run', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const result = await runAutoTradeForUser(req.user.id);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ 나스닥100/다우존스30 TOP3 분석
  // ✅ 메뉴 조회 API (프론트용)
  router.get('/api/menus', (req, res) => {
    try {
      const menus = db.prepare('SELECT * FROM menus WHERE enabled=1 ORDER BY sort_order').all();
      const topLevel = menus.filter(m => m.parent_id === null);
      const result = topLevel.map(m => ({
        ...m,
        children: menus.filter(c => c.parent_id === m.id).sort((a, b) => a.sort_order - b.sort_order)
      }));
      res.json({ ok: true, menus: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── 수동 거래 trade_log 저장 API ──
  router.post('/api/manual-trade/log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const { symbol, action, qty, price, order_id, reason, broker_key_id } = req.body;
      if (!symbol || !action || !qty || !price) return res.status(400).json({ error: '필수값 누락' });
      if (action === 'CHECK') {
        // 매수 전 중복 체크만 (실제 저장 안 함)
        const existing = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND broker_key_id=? AND action='BUY' AND status='active'").get(req.user.id, symbol, broker_key_id || null);
        if (existing) return res.json({ duplicate: true, error: `이미 매수된 종목입니다. (${symbol})` });
        return res.json({ duplicate: false });
      } else if (action === 'BUY') {
        // ✅ 동일 계좌 + 종목 active 포지션 중복 체크
        const existing = db.prepare("SELECT id FROM trade_log WHERE user_id=? AND symbol=? AND broker_key_id=? AND action='BUY' AND status='active'").get(req.user.id, symbol, broker_key_id || null);
        if (existing) return res.status(400).json({ error: `이미 매수된 종목입니다. (${symbol})`, duplicate: true });
        saveTradeLog({ user_id: req.user.id, trade_type: 1, symbol, action: 'BUY', qty, price, reason: reason || '수동 매수', order_id: order_id || '', profit_pct: 0, status: 'active', broker_key_id: broker_key_id || null });
      } else if (action === 'SELL') {
        const buyLog = db.prepare("SELECT price, qty FROM trade_log WHERE user_id=? AND symbol=? AND trade_type=1 AND action='BUY' AND status='active' ORDER BY created_at DESC LIMIT 1").get(req.user.id, symbol);
        const profitPct = buyLog ? ((price - buyLog.price) / buyLog.price * 100) : 0;
        saveTradeLog({ user_id: req.user.id, trade_type: 1, symbol, action: 'SELL', qty, price, reason: reason || '수동 매도', order_id: order_id || '', profit_pct: profitPct, status: 'closed', broker_key_id: broker_key_id || null });
        db.prepare("UPDATE trade_log SET status='closed' WHERE user_id=? AND symbol=? AND trade_type=1 AND action='BUY' AND status='active'").run(req.user.id, symbol);
      }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── 수동 보유종목 조회 (trade_type=1 active) ──
  router.get('/api/manual-trade/positions', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const rows = db.prepare("SELECT * FROM trade_log WHERE user_id=? AND trade_type=1 AND action='BUY' AND status='active' ORDER BY created_at DESC").all(req.user.id);
      res.json({ positions: rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ✅ 단순 자동매매 API
  router.get('/api/trade2/state', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const userId = req.user.user_id || req.user.id;
    const bkId2 = req.query.broker_key_id || null;
    const state = bkId2 ? db.prepare('SELECT * FROM trade_setting_type2 WHERE user_id=? AND broker_key_id=?').get(userId, bkId2) : db.prepare('SELECT * FROM trade_setting_type2 WHERE user_id=? ORDER BY broker_key_id DESC LIMIT 1').get(userId);
    const logs = db.prepare("SELECT * FROM trade_log WHERE user_id=? AND trade_type=2 ORDER BY created_at DESC LIMIT 20").all(userId);
    res.json({ ok: true, state: state || null, logs });
  });

  router.post('/api/trade2/toggle', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const userId = req.user.user_id || req.user.id;
    const { enabled } = req.body;
    const existing = db.prepare('SELECT * FROM trade_setting_type2 WHERE user_id=?').get(userId);
    if (existing) {
      db.prepare('UPDATE trade_setting_type2 SET enabled=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
        .run(enabled ? 1 : 0, enabled ? 'idle' : 'idle', userId);
    } else {
      db.prepare('INSERT INTO trade_setting_type2 (user_id,enabled,status) VALUES (?,?,?)').run(userId, enabled ? 1 : 0, 'idle');
    }
    res.json({ ok: true, enabled });
  });

  router.post('/api/trade2/settings_save', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const userId = req.user.user_id || req.user.id;
    const { balance_ratio = 0.3, take_profit = 0.05, stop_loss = 0.05, broker_key_id: bkId2s } = req.body;
    const existing = bkId2s
      ? db.prepare('SELECT id FROM trade_setting_type2 WHERE user_id=? AND broker_key_id=?').get(userId, bkId2s)
      : db.prepare('SELECT id FROM trade_setting_type2 WHERE user_id=? AND broker_key_id IS NULL').get(userId);
    if (existing) {
      db.prepare('UPDATE trade_setting_type2 SET balance_ratio=?,take_profit=?,stop_loss=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(balance_ratio, take_profit, stop_loss, existing.id);
    } else {
      db.prepare('INSERT INTO trade_setting_type2 (user_id,broker_key_id,balance_ratio,take_profit,stop_loss) VALUES (?,?,?,?,?)').run(userId, bkId2s || null, balance_ratio, take_profit, stop_loss);
    }
    res.json({ ok: true });
  });


  // ✅ 한국 TOP5 추천 종목 (KOSPI/KOSDAQ)
  router.get('/api/trade4/kr_top_picks', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const KR_SYMBOLS = [
        { symbol: '005930.KS', name: '삼성전자', market: 'KOSPI' },
        { symbol: '000660.KS', name: 'SK하이닉스', market: 'KOSPI' },
        { symbol: '035420.KS', name: 'NAVER', market: 'KOSPI' },
        { symbol: '005380.KS', name: '현대차', market: 'KOSPI' },
        { symbol: '051910.KS', name: 'LG화학', market: 'KOSPI' },
        { symbol: '006400.KS', name: '삼성SDI', market: 'KOSPI' },
        { symbol: '035720.KS', name: '카카오', market: 'KOSPI' },
        { symbol: '068270.KS', name: '셀트리온', market: 'KOSPI' },
        { symbol: '105560.KS', name: 'KB금융', market: 'KOSPI' },
        { symbol: '055550.KS', name: '신한지주', market: 'KOSPI' },
        { symbol: '247540.KQ', name: '에코프로비엠', market: 'KOSDAQ' },
        { symbol: '086520.KQ', name: '에코프로', market: 'KOSDAQ' },
        { symbol: '028300.KQ', name: 'HLB', market: 'KOSDAQ' },
        { symbol: '041510.KQ', name: '에스엠', market: 'KOSDAQ' },
        { symbol: '112040.KQ', name: 'Wisekey', market: 'KOSDAQ' },
      ];
      const results = await Promise.allSettled(KR_SYMBOLS.map(async (item) => {
        try {
          const r = await fetch(`http://localhost:5001/api/stock/history?symbol=${item.symbol}&period=60`);
          const text = await r.text();
          const d = safeJson(text);
          const closes = (d.data || []).map(x => x.close).filter(v => v !== null && !isNaN(v));
          const volumes = (d.data || []).map(x => x.volume).filter(v => v !== null && !isNaN(v));
          if (closes.length < 15) return null;
          // RSI 계산
          const period = 14;
          const changes = closes.slice(1).map((c, i) => c - closes[i]);
          const recent = changes.slice(-period);
          const avgGain = recent.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
          const avgLoss = recent.filter(c => c < 0).reduce((a, b) => a - b, 0) / period;
          const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
          const last = closes[closes.length - 1];
          const prev = closes[closes.length - 2];
          const change_pct = prev ? ((last - prev) / prev * 100) : 0;
          // 거래량 급등
          const avgVol = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / Math.max(volumes.slice(-20, -1).length, 1);
          const volRatio = avgVol > 0 ? (volumes[volumes.length - 1] || 0) / avgVol : 1;
          // SMA20 vs SMA5
          const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
          const sma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
          const signals = [];
          let score = 0;
          if (rsi < 30) { signals.push(`RSI ${rsi.toFixed(0)} 강한매수`); score += 3; }
          else if (rsi < 40) { signals.push(`RSI ${rsi.toFixed(0)} 과매도`); score += 2; }
          else if (rsi < 50) { signals.push(`RSI ${rsi.toFixed(0)}`); score += 1; }
          if (volRatio > 2) { signals.push(`거래량 ${volRatio.toFixed(1)}x 급등`); score += 3; }
          else if (volRatio > 1.5) { signals.push(`거래량 ${volRatio.toFixed(1)}x`); score += 2; }
          if (sma5 > sma20) { signals.push('단기 상승추세'); score += 1; }
          if (change_pct < -3) { signals.push(`${change_pct.toFixed(1)}% 급락조정`); score += 1; }
          if (score === 0) return null;
          return {
            symbol: item.symbol.replace('.KS', '').replace('.KQ', ''),
            full_symbol: item.symbol,
            name: item.name,
            market: item.market,
            price: last,
            change_pct: parseFloat(change_pct.toFixed(2)),
            rsi: parseFloat(rsi.toFixed(1)),
            score,
            signals
          };
        } catch (e) { return null; }
      }));
      const picks = results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      return res.json({ ok: true, picks });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ✅ 오늘의 추천 종목 (거래량 + 뉴스 + 기술적 신호 종합)
  router.get('/api/trade4/top_picks', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    if (req.query.market === 'kr') return res.redirect('/api/trade4/kr_top_picks');
    try {
      const userId = req.user.user_id || req.user.id;
      const keys = getUserAlpacaKeys(userId, null);
      const settings = db.prepare('SELECT candidate_symbols FROM trade_setting_type4 WHERE user_id=?').get(userId);
      const market = req.query.market || 'nasdaq';
      const marketSymbols = {
        nasdaq: ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD', 'QQQ', 'NFLX', 'PYPL', 'INTC', 'CRM', 'ADBE', 'COST'],
        sp500: ['SPY', 'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'LLY', 'JPM', 'V', 'UNH', 'XOM', 'MA', 'PG', 'HD'],
        dow: ['AAPL', 'MSFT', 'JPM', 'V', 'UNH', 'HD', 'PG', 'JNJ', 'WMT', 'CVX', 'MCD', 'CAT', 'BA', 'GS', 'AXP'],
        russell1000: ['IWB', 'IWF', 'IWD', 'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'UNH', 'XOM', 'PG']
      };
      // market이 명시적으로 지정된 경우 market별 종목 사용, nasdaq(기본)일 때만 DB 설정 반영
      const symbols = (market !== 'nasdaq' || !settings?.candidate_symbols)
        ? (marketSymbols[market] || marketSymbols.nasdaq)
        : settings.candidate_symbols.split(',').map(s => s.trim()).filter(Boolean);

      const alpacaHeaders = keys
        ? { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key }
        : {};

      // 1. 거래량 급등 감지
      const surges = await detectVolumeSurge(symbols, keys);
      const surgeMap = new Map(surges.map(s => [s.symbol, s]));

      // 2. 뉴스 촉매 탐지
      const catalysts = await detectNewsCatalyst(db, symbols);
      const newsMap = new Map(catalysts.map(c => [c.symbol, c]));

      // 3. 기술적 신호 (MACD + RSI) 분석
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      function calcEMA(prices, period) {
        const k = 2 / (period + 1);
        let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < prices.length; i++) ema = prices[i] * k + ema * (1 - k);
        return ema;
      }
      function calcMACD(closes) {
        if (closes.length < 35) return null;
        const macdLine = [];
        for (let i = 26; i <= closes.length; i++) macdLine.push(calcEMA(closes.slice(0, i), 12) - calcEMA(closes.slice(0, i), 26));
        if (macdLine.length < 9) return null;
        const macd = macdLine[macdLine.length - 1];
        const signal = calcEMA(macdLine, 9);
        const prevMacd = macdLine[macdLine.length - 2];
        const prevSignal = calcEMA(macdLine.slice(0, -1), 9);
        return { macd, signal, goldenCross: prevMacd < prevSignal && macd > signal };
      }
      function calcRSI(closes, period = 14) {
        if (closes.length < period + 1) return null;
        const changes = closes.slice(1).map((c, i) => c - closes[i]);
        const avgGain = changes.slice(-period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
        const avgLoss = changes.slice(-period).filter(c => c < 0).reduce((a, b) => a - b, 0) / period;
        return avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
      }

      const scored = [];
      await Promise.allSettled(symbols.map(async (symbol) => {
        try {
          let score = 0;
          const signals = [];

          // 거래량 점수
          const surge = surgeMap.get(symbol);
          if (surge) {
            if (surge.surge_level === 'extreme') { score += 3; signals.push(`🔥 거래량 ${surge.volume_ratio}x`); }
            else if (surge.surge_level === 'high') { score += 2; signals.push(`⚡ 거래량 ${surge.volume_ratio}x`); }
            else { score += 1; signals.push(`📈 거래량 ${surge.volume_ratio}x`); }
          }

          // 뉴스 점수
          const news = newsMap.get(symbol);
          if (news) { score += 2; signals.push(`📰 뉴스 ${news.news_count}건`); }

          // 기술적 신호 점수
          const STOCK_API2 = process.env.STOCK_API_URL || 'http://localhost:5001';
          const resp = await fetch(`${STOCK_API2}/api/stock/history?symbol=${encodeURIComponent(symbol)}&period=3mo&interval=1d`);
          const json = await resp.json();
          const bars = json.data || json.bars || [];
          if (bars.length >= 35) {
            const closes = bars.map(b => b.close || b.c);
            const price = closes[closes.length - 1];
            const macd = calcMACD(closes);
            const rsi = calcRSI(closes);
            if (macd?.goldenCross) { score += 3; signals.push('✅ MACD 골든크로스'); }
            else if (macd?.macd > 0) { score += 1; signals.push('MACD 양수'); }
            if (rsi && rsi < 30) { score += 3; signals.push(`RSI ${rsi.toFixed(0)} 강한매수`); }
            else if (rsi && rsi < 40) { score += 2; signals.push(`RSI ${rsi.toFixed(0)} 과매도`); }
            else if (rsi && rsi < 50) { score += 1; signals.push(`RSI ${rsi.toFixed(0)}`); }

            if (score > 0 || (rsi && rsi < 60)) {
              if (score === 0) { score = 1; signals.push('RSI ' + rsi?.toFixed(0)); }
              const change_pct = surge?.change_pct || ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2] * 100);
              scored.push({ symbol, score, price, change_pct: parseFloat(change_pct.toFixed(2)), signals, rsi: rsi ? parseFloat(rsi.toFixed(1)) : null, macd_cross: macd?.goldenCross || false, has_news: !!news, has_surge: !!surge });
            }
          }
        } catch (e) { console.error('top_picks error:', symbol, e.message); }
      }));

      scored.sort((a, b) => b.score - a.score);
      res.json({ ok: true, picks: scored.slice(0, 5), total_analyzed: symbols.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ✅ 거래량 급등 감지
  router.get('/api/trade4/volume_surge', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const userId = req.user.user_id || req.user.id;
      const market = req.query.market || 'us'; // us 또는 kr
      const keys = getUserAlpacaKeys(userId, null);
      const settings = db.prepare('SELECT candidate_symbols, kr_candidate_symbols FROM trade_setting_type4 WHERE user_id=?').get(userId);
      let symbols;
      if (market === 'kr') {
        symbols = settings?.kr_candidate_symbols
          ? settings.kr_candidate_symbols.split(',').map(s => s.trim()).filter(Boolean)
          : ['005930.KS', '000660.KS', '035420.KS', '035720.KS', '051910.KS'];
      } else {
        symbols = settings?.candidate_symbols
          ? settings.candidate_symbols.split(',').map(s => s.trim()).filter(Boolean)
          : ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD', 'QQQ', 'SPY'];
      }
      const result = await detectVolumeSurge(symbols, keys);
      res.json({ ok: true, surges: result, market });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ✅ 뉴스 촉매 탐지
  router.get('/api/trade4/news_catalyst', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const userId = req.user.user_id || req.user.id;
      const market = req.query.market || 'us';
      const settings = db.prepare('SELECT candidate_symbols, kr_candidate_symbols FROM trade_setting_type4 WHERE user_id=?').get(userId);
      let symbols;
      if (market === 'kr') {
        symbols = settings?.kr_candidate_symbols
          ? settings.kr_candidate_symbols.split(',').map(s => s.trim()).filter(Boolean)
          : ['005930.KS', '000660.KS', '035420.KS', '035720.KS', '051910.KS'];
      } else {
        symbols = settings?.candidate_symbols
          ? settings.candidate_symbols.split(',').map(s => s.trim()).filter(Boolean)
          : ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'AMD'];
      }
      const result = await detectNewsCatalyst(db, symbols);
      res.json({ ok: true, catalysts: result, market });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ✅ 리스크 계산
  router.post('/api/trade4/risk_calc', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const userId = req.user.user_id || req.user.id;
      const { symbol, stop_loss_pct = 0.05, risk_ratio = 0.02 } = req.body;
      if (!symbol) return res.status(400).json({ error: 'symbol 필수' });

      // 계좌 잔고 조회 (Alpaca)
      let balance = 100000; // 기본값
      try {
        const keys = getUserAlpacaKeys(userId, null);
        if (keys) {
          const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
          const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key };
          const account = await (await fetch(`${baseUrl}/v2/account`, { headers })).json();
          balance = parseFloat(account.equity) || balance;
        }
      } catch (e) { }

      // 현재가 조회 - stock_server.py(yfinance) 우선, 실패 시 Alpaca
      let price = 0;
      try {
        const stockBase = process.env.STOCK_SERVER_URL || 'http://localhost:5001';
        const priceRes = await fetch(`${stockBase}/api/stock/prices?symbols=${symbol}`);
        const priceData = await priceRes.json();
        const stock = (priceData.stocks || [])[0];
        if (stock?.price) price = stock.price;
      } catch (e) { }

      // yfinance 실패 시 Alpaca bars 시도
      if (!price) {
        try {
          const keys = getUserAlpacaKeys(userId, null);
          if (keys) {
            const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key };
            const end = new Date().toISOString().split('T')[0];
            const start = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const _sapi = process.env.STOCK_API_URL || 'http://localhost:5001';
            const _sresp = await fetch(`${_sapi}/api/stock/history?symbol=${encodeURIComponent(symbol)}&period=5d&interval=1d`);
            const _sdata = await _sresp.json();
            const bars = _sdata.data || _sdata.bars || [];
            if (bars.length) price = bars[bars.length - 1].c;
          }
        } catch (e) { }
      }

      if (!price) return res.status(400).json({ error: '현재가 조회 실패 — 종목 심볼을 확인해주세요' });
      const result = calcRiskPosition(balance, price, stop_loss_pct, risk_ratio);
      res.json({ ok: true, symbol, price, balance, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/trade4/nasdaq_top3', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const { signal_mode = 'combined', market = 'nasdaq' } = req.body;
      const keys = getUserAlpacaKeys(req.user.id, null);
      const top3 = await getNasdaqTop3(signal_mode, keys, market);
      res.json({ ok: true, top3, market });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ 클라이언트 에러 수신
  router.post('/api/client-error', (req, res) => {
    try {
      const { event_type, error_message, stack_trace, meta } = req.body;
      if (!event_type || !error_message) return res.json({ ok: false });
      saveErrorLog({ event_type, error_message, stack_trace, meta });
      res.json({ ok: true });
    } catch (e) { res.json({ ok: false }); }
  });

  // ✅ 퀀트 분석 이력 저장
  router.post('/api/quant/analysis-log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const { symbol, strategy, signal, price, value, score, reason, indicators } = req.body;
      if (!symbol || !strategy) return res.status(400).json({ error: '종목과 전략은 필수입니다.' });
      db.prepare(`
        INSERT INTO quant_analysis_log (user_id, symbol, strategy, signal, price, value, score, reason, indicators)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id, symbol.toUpperCase(), strategy,
        signal || null, price || null, value || null, score || null,
        reason || null, indicators ? JSON.stringify(indicators) : null
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ 퀀트 분석 이력 조회
  router.get('/api/quant/analysis-log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const { symbol, limit = 50 } = req.query;
      let rows;
      if (symbol) {
        rows = db.prepare(`
          SELECT * FROM quant_analysis_log
          WHERE user_id=? AND symbol=?
          ORDER BY created_at DESC LIMIT ?
        `).all(req.user.id, symbol.toUpperCase(), parseInt(limit));
      } else {
        rows = db.prepare(`
          SELECT * FROM quant_analysis_log
          WHERE user_id=?
          ORDER BY created_at DESC LIMIT ?
        `).all(req.user.id, parseInt(limit));
      }
      res.json({ logs: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ 퀀트 분석 이력 삭제
  router.delete('/api/quant/analysis-log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      db.prepare('DELETE FROM quant_analysis_log WHERE user_id=?').run(req.user.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ============================================================
  // 완전자동매매 전략 API
  // ============================================================

  // 설정 조회
  router.get('/api/trade3/settings', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const bkId3 = req.query.broker_key_id || null;
    const row = bkId3 ? db.prepare('SELECT * FROM trade_setting_type3 WHERE user_id=? AND broker_key_id=?').get(req.user.id, bkId3) : db.prepare('SELECT * FROM trade_setting_type3 WHERE user_id=? ORDER BY broker_key_id DESC LIMIT 1').get(req.user.id);
    res.json({ ok: true, settings: row || { enabled: 0, market: 'nasdaq', roe_min: 15, debt_max: 100, revenue_min: 10, momentum_top: 30, sma200_filter: 1, use_macd: 1, use_rsi: 1, rsi_threshold: 40, use_bb: 1, balance_ratio: 0.2, max_positions: 5, take_profit1: 0.1, take_profit2: 0.2, stop_loss: 0.05, factor_exit: 1, sma200_exit: 1 } });
  });

  // 설정 저장
  router.post('/api/trade3/settings_save', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { market, roe_min, debt_max, revenue_min, momentum_top, sma200_filter, use_macd, use_rsi, rsi_threshold, use_bb, balance_ratio, max_positions, take_profit1, take_profit2, stop_loss, factor_exit, sma200_exit } = req.body;
    const existing = db.prepare('SELECT id FROM trade_setting_type3 WHERE user_id=?').get(req.user.user_id || req.user.id);
    if (existing) {
      db.prepare('UPDATE trade_setting_type3 SET market=?,roe_min=?,debt_max=?,revenue_min=?,momentum_top=?,sma200_filter=?,use_macd=?,use_rsi=?,rsi_threshold=?,use_bb=?,balance_ratio=?,max_positions=?,take_profit1=?,take_profit2=?,stop_loss=?,factor_exit=?,sma200_exit=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
        .run(market, roe_min, debt_max, revenue_min, momentum_top, sma200_filter ? 1 : 0, use_macd ? 1 : 0, use_rsi ? 1 : 0, rsi_threshold, use_bb ? 1 : 0, balance_ratio, max_positions, take_profit1, take_profit2, stop_loss, factor_exit ? 1 : 0, sma200_exit ? 1 : 0, req.user.id);
    } else {
      db.prepare('INSERT INTO trade_setting_type3 (user_id,broker_key_id,market,roe_min,debt_max,revenue_min,momentum_top,sma200_filter,use_macd,use_rsi,rsi_threshold,use_bb,balance_ratio,max_positions,take_profit1,take_profit2,stop_loss,factor_exit,sma200_exit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(req.user.id, market, roe_min, debt_max, revenue_min, momentum_top, sma200_filter ? 1 : 0, use_macd ? 1 : 0, use_rsi ? 1 : 0, rsi_threshold, use_bb ? 1 : 0, balance_ratio, max_positions, take_profit1, take_profit2, stop_loss, factor_exit ? 1 : 0, sma200_exit ? 1 : 0);
    }
    res.json({ ok: true });
  });

  // 활성화 토글
  router.post('/api/trade3/toggle', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { enabled } = req.body;
    const existing = db.prepare('SELECT id FROM trade_setting_type3 WHERE user_id=?').get(req.user.user_id || req.user.id);
    if (existing) {
      db.prepare('UPDATE trade_setting_type3 SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(enabled ? 1 : 0, req.user.id);
    } else {
      db.prepare('INSERT INTO trade_setting_type3 (user_id,enabled) VALUES (?,?)').run(req.user.id, enabled ? 1 : 0);
    }
    res.json({ ok: true, enabled: !!enabled });
  });

  // 종목 풀 조회
  router.get('/api/trade3/pool', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const rows = db.prepare('SELECT * FROM trade_pool_type3 WHERE user_id=? ORDER BY factor_score DESC').all(req.user.id);
    res.json({ ok: true, pool: rows });
  });

  // type3 pool 종목 저장
  router.post('/api/trade3/pool_save', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { symbol, factor_score } = req.body;
    if (!symbol) return res.status(400).json({ error: '종목 필요' });
    const existing = db.prepare('SELECT id FROM trade_pool_type3 WHERE user_id=? AND symbol=?').get(req.user.id, symbol);
    if (existing) return res.json({ ok: true, message: '이미 저장된 종목' });
    db.prepare('INSERT INTO trade_pool_type3 (user_id, symbol, factor_score) VALUES (?,?,?)').run(req.user.id, symbol, factor_score || 0);
    res.json({ ok: true });
  });

  // type3 pool 종목 삭제
  router.delete('/api/trade3/pool/:symbol', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { symbol } = req.params;
    db.prepare('DELETE FROM trade_pool_type3 WHERE user_id=? AND symbol=?').run(req.user.id, symbol);
    res.json({ ok: true });
  });

  // ============================================================
  // 투자 성향 (Investor Profile) API
  // ============================================================

  // 성향 조회
  router.get('/api/investor-profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT * FROM investor_profile WHERE user_id=?').get(req.user.user_id || req.user.id);
    res.json({ ok: true, profile: row || null });
  });

  // 성향 설문 저장 + 자동 분류
  router.post('/api/investor-profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { q_period, q_loss, q_return, q_style, q_experience } = req.body;

    const total = (q_period || 2) + (q_loss || 2) + (q_return || 2) + (q_style || 2) + (q_experience || 2);

    // 성향 분류 + 가중치 결정
    let profile_type, w_momentum, w_value, w_quality, w_news;
    let risk_take_profit, risk_stop_loss, risk_max_positions, risk_balance_ratio;

    if (total <= 6) {
      // 🛡️ 안정형 (conservative)
      profile_type = 'conservative';
      w_momentum = 0.15; w_value = 0.45; w_quality = 0.30; w_news = 0.10;
      risk_take_profit = 0.07; risk_stop_loss = 0.03;
      risk_max_positions = 5; risk_balance_ratio = 0.15;
    } else if (total <= 9) {
      // ⚖️ 안정성장형 (moderate)
      profile_type = 'moderate';
      w_momentum = 0.25; w_value = 0.35; w_quality = 0.30; w_news = 0.10;
      risk_take_profit = 0.10; risk_stop_loss = 0.05;
      risk_max_positions = 5; risk_balance_ratio = 0.18;
    } else if (total <= 12) {
      // 📊 균형형 (balanced)
      profile_type = 'balanced';
      w_momentum = 0.35; w_value = 0.30; w_quality = 0.25; w_news = 0.10;
      risk_take_profit = 0.12; risk_stop_loss = 0.06;
      risk_max_positions = 5; risk_balance_ratio = 0.20;
    } else {
      // 🚀 공격형 (aggressive)
      profile_type = 'aggressive';
      w_momentum = 0.50; w_value = 0.15; w_quality = 0.20; w_news = 0.15;
      risk_take_profit = 0.20; risk_stop_loss = 0.08;
      risk_max_positions = 7; risk_balance_ratio = 0.25;
    }

    // 초보자 보정 (경험 1점이면 안전하게)
    if ((q_experience || 2) === 1) {
      profile_type = 'beginner';
      w_momentum = 0.20; w_value = 0.40; w_quality = 0.30; w_news = 0.10;
      risk_take_profit = 0.07; risk_stop_loss = 0.03;
      risk_max_positions = 3; risk_balance_ratio = 0.10;
    }

    const existing = db.prepare('SELECT id FROM investor_profile WHERE user_id=?').get(req.user.user_id || req.user.id);
    if (existing) {
      db.prepare(`UPDATE investor_profile SET
        q_period=?, q_loss=?, q_return=?, q_style=?, q_experience=?,
        profile_type=?, profile_score=?,
        w_momentum=?, w_value=?, w_quality=?, w_news=?,
        risk_take_profit=?, risk_stop_loss=?, risk_max_positions=?, risk_balance_ratio=?,
        completed=1, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
        .run(q_period, q_loss, q_return, q_style, q_experience,
          profile_type, total,
          w_momentum, w_value, w_quality, w_news,
          risk_take_profit, risk_stop_loss, risk_max_positions, risk_balance_ratio,
          req.user.id);
    } else {
      db.prepare(`INSERT INTO investor_profile
        (user_id, q_period, q_loss, q_return, q_style, q_experience,
         profile_type, profile_score, w_momentum, w_value, w_quality, w_news,
         risk_take_profit, risk_stop_loss, risk_max_positions, risk_balance_ratio, completed)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`)
        .run(req.user.id, q_period, q_loss, q_return, q_style, q_experience,
          profile_type, total,
          w_momentum, w_value, w_quality, w_news,
          risk_take_profit, risk_stop_loss, risk_max_positions, risk_balance_ratio);
    }

    res.json({
      ok: true, profile_type, profile_score: total,
      w_momentum, w_value, w_quality, w_news,
      risk_take_profit, risk_stop_loss, risk_max_positions, risk_balance_ratio
    });
  });

  // ============================================================
  // 1. 성과 대시보드 API
  // ============================================================

  // 성과 스냅샷 저장 (Alpaca 계좌 조회 후 저장)
  router.post('/api/performance/snapshot', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const today = new Date().toISOString().split('T')[0];
      const results = {};

      // 계좌별로 스냅샷 저장하는 헬퍼
      async function saveSnapshot(accountType, keysOverride = null) {
        const keys = keysOverride || getUserAlpacaKeys(req.user.id, null, accountType || null);
        if (!keys) return null;
        const brokerKeyId = keys.id || null;
        const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
        const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key };

        const account = await (await fetch(`${baseUrl}/v2/account`, { headers })).json();
        const equity = parseFloat(account.equity) || 0;
        const cash = parseFloat(account.cash) || 0;
        const portfolioValue = parseFloat(account.portfolio_value) || 0;

        const yesterday = db.prepare(`SELECT total_equity, total_pnl, peak_equity, win_count, loss_count FROM portfolio_performance WHERE user_id=? AND account_type=? ORDER BY snapshot_date DESC LIMIT 1`).get(req.user.id, accountType);
        const prevEquity = yesterday?.total_equity || equity;
        const dailyPnl = equity - prevEquity;
        const dailyPnlPct = prevEquity > 0 ? (dailyPnl / prevEquity * 100) : 0;

        // 계좌 타입별 trade_log 승/패 집계
        const tradeTypes = accountType === 1 ? [1] : accountType === 2 ? [2, 3, 4] : [1, 2, 3, 4];
        const placeholders = tradeTypes.map(() => '?').join(',');
        const trades = db.prepare(`SELECT action, profit_pct FROM trade_log WHERE user_id=? AND trade_type IN (${placeholders}) AND action IN ('SELL_PROFIT','SELL_PROFIT1','SELL_PROFIT2','SELL_STOP','SELL_LOSS','SELL','SELL_MANUAL','SELL_STOP_ALL','SELL_FACTOR')`).all(req.user.id, ...tradeTypes);
        const winCount = trades.filter(t => t.action.includes('PROFIT') || ((t.action === 'SELL' || t.action === 'SELL_MANUAL') && (t.profit_pct || 0) > 0)).length;
        const lossCount = trades.filter(t => t.action.includes('STOP') || t.action.includes('LOSS') || ((t.action === 'SELL' || t.action === 'SELL_MANUAL') && (t.profit_pct || 0) <= 0)).length;

        const first = db.prepare(`SELECT total_equity FROM portfolio_performance WHERE user_id=? AND account_type=? ORDER BY snapshot_date ASC LIMIT 1`).get(req.user.id, accountType);
        const initialEquity = first?.total_equity || equity;
        const totalPnl = equity - initialEquity;
        const totalPnlPct = initialEquity > 0 ? (totalPnl / initialEquity * 100) : 0;

        const allPeaks = db.prepare(`SELECT MAX(peak_equity) as peak FROM portfolio_performance WHERE user_id=? AND account_type=?`).get(req.user.id, accountType);
        const maxPeak = Math.max(allPeaks?.peak || equity, equity);
        const maxDrawdown = maxPeak > 0 ? ((maxPeak - equity) / maxPeak * 100) : 0;
        const peakEquity = Math.max(yesterday?.peak_equity || equity, equity);

        db.prepare(`INSERT OR REPLACE INTO portfolio_performance
          (user_id, snapshot_date, account_type, broker_key_id, total_equity, cash, portfolio_value, daily_pnl, daily_pnl_pct, total_pnl, total_pnl_pct, win_count, loss_count, max_drawdown, peak_equity)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(req.user.id, today, accountType, brokerKeyId, equity || 0, cash || 0, portfolioValue || 0, dailyPnl || 0, dailyPnlPct || 0, totalPnl || 0, totalPnlPct || 0, winCount || 0, lossCount || 0, maxDrawdown || 0, peakEquity || equity || 0);

        return { equity, cash, portfolioValue, dailyPnl, dailyPnlPct, totalPnl, totalPnlPct, winCount, lossCount, maxDrawdown };
      }

      // 수동 계좌 (account_type=1)
      const manualKeys = getUserAlpacaKeys(req.user.id, null, 1);
      if (manualKeys) results.manual = await saveSnapshot(1, manualKeys);

      // 자동 계좌 (account_type=2)
      const autoKeys = getUserAlpacaKeys(req.user.id, null, 2);
      if (autoKeys) results.auto = await saveSnapshot(2, autoKeys);

      // 전체 (account_type=0) — is_active 계좌 기준
      const allKeys = getUserAlpacaKeys(req.user.id, null);
      if (allKeys) results.all = await saveSnapshot(0, allKeys);

      res.json({ ok: true, ...results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // 성과 이력 조회
  router.get('/api/performance/history', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const days = parseInt(req.query.days || 30);
    const accountType = parseInt(req.query.account_type ?? 0);
    const accountId = req.query.account_id ? parseInt(req.query.account_id) : null;
    let rows;
    if (accountId) {
      rows = db.prepare(`SELECT * FROM portfolio_performance WHERE user_id=? AND broker_key_id=? ORDER BY snapshot_date DESC LIMIT ?`).all(req.user.id, accountId, days);
    } else {
      rows = db.prepare(`SELECT * FROM portfolio_performance WHERE user_id=? AND account_type=? ORDER BY snapshot_date DESC LIMIT ?`).all(req.user.id, accountType, days);
    }
    res.json({ ok: true, history: rows.reverse() });
  });

  // 성과 요약 (홈 화면용)
  router.get('/api/performance/summary', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const accountType = parseInt(req.query.account_type ?? 0);
    const accountId = req.query.account_id ? parseInt(req.query.account_id) : null;
    let latest, weekAgo, monthPnl, maxMdd;
    if (accountId) {
      latest = db.prepare(`SELECT * FROM portfolio_performance WHERE user_id=? AND broker_key_id=? ORDER BY snapshot_date DESC LIMIT 1`).get(req.user.id, accountId);
      weekAgo = db.prepare(`SELECT total_equity FROM portfolio_performance WHERE user_id=? AND broker_key_id=? ORDER BY snapshot_date DESC LIMIT 7`).all(req.user.id, accountId);
      monthPnl = db.prepare(`SELECT SUM(daily_pnl) as pnl FROM portfolio_performance WHERE user_id=? AND broker_key_id=? AND snapshot_date >= date('now','-30 days')`).get(req.user.id, accountId);
      maxMdd = db.prepare(`SELECT MAX(max_drawdown) as mdd FROM portfolio_performance WHERE user_id=? AND broker_key_id=?`).get(req.user.id, accountId);
    } else {
      latest = db.prepare(`SELECT * FROM portfolio_performance WHERE user_id=? AND account_type=? ORDER BY snapshot_date DESC LIMIT 1`).get(req.user.id, accountType);
      weekAgo = db.prepare(`SELECT total_equity FROM portfolio_performance WHERE user_id=? AND account_type=? ORDER BY snapshot_date DESC LIMIT 7`).all(req.user.id, accountType);
      monthPnl = db.prepare(`SELECT SUM(daily_pnl) as pnl FROM portfolio_performance WHERE user_id=? AND account_type=? AND snapshot_date >= date('now','-30 days')`).get(req.user.id, accountType);
      maxMdd = db.prepare(`SELECT MAX(max_drawdown) as mdd FROM portfolio_performance WHERE user_id=? AND account_type=?`).get(req.user.id, accountType);
    }
    const winRate = latest ? (latest.win_count + latest.loss_count > 0 ? (latest.win_count / (latest.win_count + latest.loss_count) * 100) : 0) : 0;
    res.json({ ok: true, latest, weekHistory: weekAgo.reverse(), monthPnl: monthPnl?.pnl || 0, maxMdd: maxMdd?.mdd || 0, winRate });
  });

  // ============================================================
  // 2. 백테스트 결과 저장/조회 API
  // ============================================================

  // 결과 저장
  router.post('/api/backtest/save', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { name, symbol, strategy, start_date, end_date, initial_capital, final_capital,
      total_return, annual_return, max_drawdown, sharpe_ratio, win_rate,
      total_trades, win_trades, loss_trades, take_profit, stop_loss, result_json } = req.body;
    const result = db.prepare(`INSERT INTO backtest_results
      (user_id, name, symbol, strategy, start_date, end_date, initial_capital, final_capital,
       total_return, annual_return, max_drawdown, sharpe_ratio, win_rate,
       total_trades, win_trades, loss_trades, take_profit, stop_loss, result_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.user.id, name || `${symbol} ${strategy}`, symbol, strategy, start_date, end_date,
        initial_capital, final_capital, total_return, annual_return, max_drawdown,
        sharpe_ratio, win_rate, total_trades, win_trades, loss_trades, take_profit, stop_loss,
        result_json ? JSON.stringify(result_json) : null);
    res.json({ ok: true, id: result.lastInsertRowid });
  });

  // 결과 목록 조회
  router.get('/api/backtest/results', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const rows = db.prepare(`SELECT id, name, symbol, strategy, start_date, end_date,
      total_return, annual_return, max_drawdown, sharpe_ratio, win_rate, total_trades, created_at
      FROM backtest_results WHERE user_id=? ORDER BY created_at DESC LIMIT 20`).all(req.user.id);
    res.json({ ok: true, results: rows });
  });

  // 결과 상세 조회
  router.get('/api/backtest/results/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare(`SELECT * FROM backtest_results WHERE id=? AND user_id=?`).get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: '없음' });
    if (row.result_json) try { row.result_json = JSON.parse(row.result_json); } catch (e) { }
    res.json({ ok: true, result: row });
  });

  // 결과 삭제
  router.delete('/api/backtest/results/:id', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    db.prepare(`DELETE FROM backtest_results WHERE id=? AND user_id=?`).run(req.params.id, req.user.id);
    res.json({ ok: true });
  });

  // ============================================================
  // 3. 텔레그램 알림 API
  // ============================================================

  // 알림 발송 헬퍼
  async function sendTelegramAlert(userId, message, alertType = 'TRADE') {
    try {
      const tg = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id=?').get(userId);
      if (!tg?.chat_id || !tg?.bot_token) return false;
      const token = tg.bot_token.startsWith('bot') ? tg.bot_token.slice(3) : tg.bot_token;
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tg.chat_id, text: message, parse_mode: 'HTML' })
      });
      const d = await res.json();
      if (d.ok) {
        db.prepare('INSERT INTO telegram_alert_log (user_id, alert_type, message) VALUES (?,?,?)').run(userId, alertType, message);
      }
      return d.ok;
    } catch (e) { return false; }
  }

  // 수동 테스트 발송
  router.post('/api/telegram/alert/test', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const ok = await sendTelegramAlert(req.user.id, '🤖 <b>spagenio 알림 테스트</b>\n\n텔레그램 알림이 정상적으로 연결됐어요!', 'TEST');
    res.json({ ok });
  });

  // 알림 로그 조회
  router.get('/api/telegram/alert/log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const rows = db.prepare('SELECT * FROM telegram_alert_log WHERE user_id=? ORDER BY sent_at DESC LIMIT 50').all(req.user.id);
    res.json({ ok: true, logs: rows });
  });

  // 종목 검색 (stock_server.py 프록시)
  router.get('/api/stock/search', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    try {
      const fetch = (await import('node-fetch')).default;
      const r = await fetch(`http://localhost:5001/api/stock/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      return res.json(d);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });

  // 로또 이력 일괄 수집 (1회 ~ 지정 회차)
  router.post('/api/lotto/history/bulk', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { from = 1, to = 799 } = req.body;
    const fetch = (await import('node-fetch')).default;

    let saved = 0, skipped = 0, errors = 0;
    // 5개씩 병렬 처리
    const CHUNK = 5;
    for (let start = from; start <= to; start += CHUNK) {
      const chunk = [];
      for (let i = start; i < start + CHUNK && i <= to; i++) chunk.push(i);
      await Promise.all(chunk.map(async (drw_no) => {
        try {
          const existing = db.prepare('SELECT id FROM lotto_history WHERE drw_no=?').get(drw_no);
          if (existing) { skipped++; return; }
          const r = await fetch(`https://lotto.oot.kr/api/lotto/${drw_no}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000)
          });
          if (!r.ok) { errors++; return; }
          const d = await r.json();
          if (!d.drwtNo1) { errors++; return; }
          const winning = [d.drwtNo1, d.drwtNo2, d.drwtNo3, d.drwtNo4, d.drwtNo5, d.drwtNo6].sort((a, b) => a - b);
          const bonus = d.bnusNo;
          db.prepare('INSERT OR IGNORE INTO lotto_history (drw_no, numbers, bonus, drw_date) VALUES (?,?,?,?)')
            .run(drw_no, JSON.stringify(winning), bonus, d.drwNoDate || '');
          saved++;
        } catch (e) { errors++; }
      }));
    }
    res.json({ ok: true, saved, skipped, errors, total: to - from + 1 });
  });

  // ── 로또 bias_map 조회 ──
  router.get('/api/lotto/bias-map', async (req, res) => {
    try {
      const row = db.prepare('SELECT data FROM lotto_algorithm_config WHERE key=?').get('bias_map');
      if (row) return res.json({ ok: true, bias_map: JSON.parse(row.data) });
      // 없으면 즉시 계산
      const biasMap = computeLottoBiasMap(db);
      res.json({ ok: true, bias_map: biasMap });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── bias_map 수동 재계산 트리거 ──
  router.post('/api/lotto/bias-map/recalc', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const biasMap = computeLottoBiasMap(db);
      res.json({ ok: true, bias_map: biasMap });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── bias_map 계산 함수 ──
  function computeLottoBiasMap(db) {
    const rows = db.prepare('SELECT numbers FROM lotto_history ORDER BY drw_no ASC').all();
    const data = rows.map(r => JSON.parse(r.numbers));
    if (data.length < 50) return null;

    function getZoneIdx(n) {
      if (n <= 9) return 0; if (n <= 19) return 1; if (n <= 29) return 2; if (n <= 39) return 3; return 4;
    }

    const stats1 = {}; // {zoneIdx: {zoneIdx: [counts]}}
    const stats2 = {}; // {'z1+z2': {zoneIdx: [counts]}}

    for (let i = 1; i < data.length; i++) {
      const prev = new Set(data[i - 1]);
      const curr = data[i];
      const carry = data[i - 1].filter(n => prev.has(n) && curr.includes(n));

      if (carry.length === 1) {
        const zi = getZoneIdx(carry[0]);
        if (!stats1[zi]) stats1[zi] = Array.from({ length: 5 }, () => []);
        const cnt = [0, 0, 0, 0, 0];
        curr.filter(n => !carry.includes(n)).forEach(n => cnt[getZoneIdx(n)]++);
        cnt.forEach((c, z) => stats1[zi][z].push(c));

      } else if (carry.length === 2) {
        const [z1, z2] = [getZoneIdx(carry[0]), getZoneIdx(carry[1])].sort((a, b) => a - b);
        const key = `${z1}+${z2}`;
        if (!stats2[key]) stats2[key] = Array.from({ length: 5 }, () => []);
        const cnt = [0, 0, 0, 0, 0];
        curr.filter(n => !carry.includes(n)).forEach(n => cnt[getZoneIdx(n)]++);
        cnt.forEach((c, z) => stats2[key][z].push(c));
      }
    }

    function toWeights(zoneCounts) {
      const avgs = zoneCounts.map(arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
      const total = avgs.reduce((a, b) => a + b, 0);
      return avgs.map(v => total > 0 ? Math.round(v / total * 100) / 100 : 0.2);
    }

    const biasMap = {};
    for (const zi in stats1) {
      if (stats1[zi][0].length >= 10)
        biasMap[String(zi)] = toWeights(stats1[zi]);
    }
    for (const key in stats2) {
      if (stats2[key][0].length >= 5)
        biasMap[key] = toWeights(stats2[key]);
    }

    // DB 저장
    try {
      const existing = db.prepare('SELECT key FROM lotto_algorithm_config WHERE key=?').get('bias_map');
      if (existing) db.prepare('UPDATE lotto_algorithm_config SET data=?,updated_at=CURRENT_TIMESTAMP WHERE key=?').run(JSON.stringify(biasMap), 'bias_map');
      else db.prepare('INSERT INTO lotto_algorithm_config (key,data) VALUES (?,?)').run('bias_map', JSON.stringify(biasMap));
    } catch (e) {
      // 테이블 없으면 생성 후 재시도
      db.prepare('CREATE TABLE IF NOT EXISTS lotto_algorithm_config (key TEXT PRIMARY KEY, data TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run();
      const existing = db.prepare('SELECT key FROM lotto_algorithm_config WHERE key=?').get('bias_map');
      if (existing) db.prepare('UPDATE lotto_algorithm_config SET data=?,updated_at=CURRENT_TIMESTAMP WHERE key=?').run(JSON.stringify(biasMap), 'bias_map');
      else db.prepare('INSERT INTO lotto_algorithm_config (key,data) VALUES (?,?)').run('bias_map', JSON.stringify(biasMap));
    }
    return biasMap;
  }

  // ── 매주 토요일 21시 이후 bias_map 자동 재계산 스케줄러 ──
  function scheduleLottoBiasRecalc() {
    const now = new Date();
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kst = new Date(now.getTime() + KST_OFFSET);
    const day = kst.getUTCDay(); // 6 = 토요일
    const hour = kst.getUTCHours();

    // 토요일 22시에 재계산 (추첨 21시 이후)
    const next = new Date(kst);
    next.setUTCHours(22, 0, 0, 0);
    if (day > 6 || (day === 6 && hour >= 22)) next.setUTCDate(next.getUTCDate() + (13 - day));
    else next.setUTCDate(next.getUTCDate() + (6 - day));

    const delay = next.getTime() - kst.getTime();
    setTimeout(() => {
      try {
        console.log('[로또] bias_map 자동 재계산 시작...');
        computeLottoBiasMap(db);
        console.log('[로또] bias_map 재계산 완료');
      } catch (e) { console.error('[로또] bias_map 재계산 오류:', e.message); }
      scheduleLottoBiasRecalc(); // 다음 주 예약
    }, delay);

    console.log(`[로또] bias_map 재계산 예약: ${new Date(now.getTime() + delay).toISOString()}`);
  }

  // 서버 시작 시 bias_map 초기화 + 스케줄러 등록
  try {
    db.prepare('CREATE TABLE IF NOT EXISTS lotto_algorithm_config (key TEXT PRIMARY KEY, data TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)').run();
    const existing = db.prepare('SELECT key FROM lotto_algorithm_config WHERE key=?').get('bias_map');
    if (!existing) computeLottoBiasMap(db);
  } catch (e) { console.error('[로또] bias_map 초기화 오류:', e.message); }
  scheduleLottoBiasRecalc();

  return router;
}
