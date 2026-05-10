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

export default function frontRoutes({ db, requestStats, startedAt, saveErrorLog, encryptEmail, decryptEmail, getUserAlpacaKeys, runAutoTradeForUser, getNasdaqTop3, saveTradeLog, __dirname }) {

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

  // ✅ Alpaca 프록시 — 경로/메서드 화이트리스트 + 주문 본문 검증
  // 대시보드에서 실제로 호출하는 엔드포인트만 허용. 그 외(예: /v2/account/configurations PATCH)는 차단.
  const ALPACA_PROXY_ALLOW = [
    { method: 'GET',    re: /^\/v2\/account$/ },
    { method: 'GET',    re: /^\/v2\/account\/portfolio\/history$/ },
    { method: 'GET',    re: /^\/v2\/positions$/ },
    { method: 'GET',    re: /^\/v2\/positions\/[A-Za-z0-9._-]+$/ },
    { method: 'DELETE', re: /^\/v2\/positions\/[A-Za-z0-9._-]+$/ }, // close position
    { method: 'GET',    re: /^\/v2\/orders$/ },
    { method: 'GET',    re: /^\/v2\/orders\/[A-Za-z0-9-]+$/ },
    { method: 'DELETE', re: /^\/v2\/orders\/[A-Za-z0-9-]+$/ }, // cancel order
    { method: 'POST',   re: /^\/v2\/orders$/ }, // submit order (본문 검증 별도)
    { method: 'GET',    re: /^\/v2\/clock$/ },
    { method: 'GET',    re: /^\/v2\/calendar$/ },
    { method: 'GET',    re: /^\/v2\/assets$/ },
    { method: 'GET',    re: /^\/v2\/assets\/[A-Za-z0-9._-]+$/ },
  ];
  const ORDER_MAX_QTY = parseInt(process.env.MAX_ORDER_QTY || '10', 10);

  function validateOrderBody(body) {
    if (!body || typeof body !== 'object') return 'invalid body';
    const { symbol, qty, side, type, time_in_force, limit_price } = body;
    if (typeof symbol !== 'string' || !/^[A-Z0-9.]{1,10}$/i.test(symbol)) return 'invalid symbol';
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0 || q > ORDER_MAX_QTY) return `qty out of range (1..${ORDER_MAX_QTY})`;
    if (!['buy', 'sell'].includes(side)) return 'invalid side';
    if (!['market', 'limit'].includes(type)) return 'invalid type';
    if (!['day', 'gtc', 'ioc', 'fok'].includes(time_in_force)) return 'invalid time_in_force';
    if (type === 'limit') {
      const lp = Number(limit_price);
      if (!Number.isFinite(lp) || lp <= 0) return 'invalid limit_price';
    }
    // 알 수 없는 필드는 모두 drop (mass-assignment 방지)
    return null;
  }

  router.all('/api/alpaca-user/*', async (req, res) => {
    // accountId는 정수만 허용 (DB row id)
    const rawAccountId = req.headers['x-account-id'] || req.query.accountId;
    const accountId = rawAccountId != null && /^\d+$/.test(String(rawAccountId)) ? parseInt(String(rawAccountId), 10) : null;
    if (rawAccountId && accountId === null) {
      return res.status(400).json({ error: 'invalid accountId' });
    }

    // 경로/메서드 검사
    const alpacaPath = req.originalUrl.split('?')[0].replace('/api/alpaca-user', '');
    const allowed = ALPACA_PROXY_ALLOW.find(r => r.method === req.method && r.re.test(alpacaPath));
    if (!allowed) {
      return res.status(403).json({ error: 'path/method not allowed', method: req.method, path: alpacaPath });
    }

    // POST /v2/orders 본문 검증
    let outboundBody;
    if (req.method === 'POST' && alpacaPath === '/v2/orders') {
      const errMsg = validateOrderBody(req.body);
      if (errMsg) return res.status(400).json({ error: errMsg });
      const { symbol, qty, side, type, time_in_force, limit_price } = req.body;
      const sanitized = { symbol: String(symbol).toUpperCase(), qty: Number(qty), side, type, time_in_force };
      if (type === 'limit') sanitized.limit_price = Number(limit_price);
      outboundBody = JSON.stringify(sanitized);
    } else if (req.method !== 'GET') {
      outboundBody = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : undefined;
    }

    const keys = getUserAlpacaKeys(req.user.id, accountId);
    if (!keys) return res.status(200).json({ ok: false, no_account: true, error: 'Alpaca 계좌를 먼저 등록해주세요.', positions: [], orders: [] });

    try {
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const filteredQuery = Object.fromEntries(Object.entries(req.query).filter(([k]) => k !== 'accountId'));
      const query = Object.keys(filteredQuery).length ? '?' + new URLSearchParams(filteredQuery).toString() : '';
      const response = await fetch(`${baseUrl}${alpacaPath}${query}`, {
        method: req.method,
        headers: { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' },
        body: outboundBody,
      });
      return res.status(response.status).json(await response.json());
    } catch (e) { return res.status(500).json({ error: e.message }); }
  });

  // ✅ 퀀트/주식 프록시 — Python 서비스의 mutating 엔드포인트 보호용 토큰 전달
  const _internalHeaders = () => process.env.INTERNAL_API_TOKEN
    ? { 'X-Internal-Token': process.env.INTERNAL_API_TOKEN }
    : {};

  router.all('/proxy/quant/*', async (req, res) => {
    try {
      const quantPath = req.path.replace('/proxy/quant', '');
      const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
      const response = await fetch(`http://localhost:5002${quantPath}${query}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', ..._internalHeaders() },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      });
      const rawText = await response.text();
      res.json(safeJson(rawText));
    } catch (error) { res.status(500).json({ error: '퀀트 서버 연결 실패', detail: error.message }); }
  });

  router.all('/proxy/stock/*', async (req, res) => {
    try {
      const stockPath = req.path.replace('/proxy/stock', '');
      const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
      const response = await fetch(`http://localhost:5001${stockPath}${query}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', ..._internalHeaders() },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      });
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

  return router;
}
