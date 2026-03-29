import express from 'express';
import path from 'path';
const router = express.Router();

export default function frontRoutes({ db, anthropic, CONFIG, PRESETS, requestStats, startedAt, saveErrorLog, encryptEmail, decryptEmail, getUserAlpacaKeys, buildPayload, forwardToTarget, callClaude, summarizeProviders, runAutoTradeForUser, getNasdaqTop3, __dirname }) {

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
    const rows = db.prepare('SELECT id, account_name, alpaca_paper, is_active, updated_at FROM user_broker_keys WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id);
    if (!rows.length) return res.json({ registered: false, accounts: [] });
    return res.json({ registered: true, accounts: rows.map(r => ({ id: r.id, account_name: r.account_name, alpaca_paper: r.alpaca_paper === 1, is_active: r.is_active === 1, updated_at: r.updated_at })) });
  });

  router.post('/api/user/broker-keys', (req, res) => {
    const { account_name, alpaca_api_key, alpaca_secret_key, alpaca_paper } = req.body;
    if (!alpaca_api_key || !alpaca_secret_key) return res.status(400).json({ error: 'API 키와 Secret 키를 입력해주세요.' });
    try {
      const encKey = encryptEmail(alpaca_api_key);
      const encSecret = encryptEmail(alpaca_secret_key);
      const paper = alpaca_paper ? 1 : 0;
      const name = account_name || (paper ? '페이퍼 트레이딩' : '실거래 계좌');
      const count = db.prepare('SELECT COUNT(*) as cnt FROM user_broker_keys WHERE user_id = ?').get(req.user.id).cnt;
      const isActive = count === 0 ? 1 : 0;
      db.prepare('INSERT INTO user_broker_keys (user_id, account_name, alpaca_api_key, alpaca_secret_key, alpaca_paper, is_active) VALUES (?,?,?,?,?,?)').run(req.user.id, name, encKey, encSecret, paper, isActive);
      return res.json({ status: 'ok', message: `'${name}' 계좌가 등록됐습니다.` });
    } catch (e) {
      saveErrorLog({ event_type: 'BROKER_KEY_ERROR', error_message: e.message, stack_trace: e.stack, meta: { userId: req.user?.id } });
      return res.status(500).json({ error: e.message });
    }
  });

  router.delete('/api/user/broker-keys/:id', (req, res) => {
    const row = db.prepare('SELECT id, is_active FROM user_broker_keys WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: '계좌를 찾을 수 없습니다.' });
    db.prepare('DELETE FROM user_broker_keys WHERE id = ?').run(req.params.id);
    if (row.is_active) {
      const next = db.prepare('SELECT id FROM user_broker_keys WHERE user_id = ? LIMIT 1').get(req.user.id);
      if (next) db.prepare('UPDATE user_broker_keys SET is_active = 1 WHERE id = ?').run(next.id);
    }
    return res.json({ status: 'ok', message: '계좌가 삭제됐습니다.' });
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
      res.json(await response.json());
    } catch (error) { res.status(500).json({ error: '퀀트 서버 연결 실패', detail: error.message }); }
  });

  router.all('/proxy/stock/*', async (req, res) => {
    try {
      const stockPath = req.path.replace('/proxy/stock', '');
      const query = Object.keys(req.query).length ? '?' + new URLSearchParams(req.query).toString() : '';
      const response = await fetch(`http://localhost:5001${stockPath}${query}`, { method: req.method, headers: { 'Content-Type': 'application/json' }, body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined });
      res.json(await response.json());
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
        if (r1 && r1[1].trim().startsWith('http')) return r1[1].trim();
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
          title:      item.title,
          url:        item.url,
          source:     s.name,
          category:   s.category,
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

  // ✅ 로또 API
  router.get('/api/lotto/telegram/config', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id = ?').get(req.user.id);
    res.json({ chat_id: row?.chat_id || '', has_token: !!row?.bot_token });
  });

  // ✅ 텔레그램 설정 공통 API (성과 대시보드용)
  router.get('/api/user/telegram', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id = ?').get(req.user.id);
    res.json({ chat_id: row?.chat_id || '', bot_token: row?.bot_token || '' });
  });

  router.post('/api/user/telegram', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    let { chat_id, bot_token } = req.body;
    if (!chat_id) return res.status(400).json({ error: 'chat_id 필요' });
    if (bot_token && bot_token.startsWith('bot')) bot_token = bot_token.slice(3);
    const existing = db.prepare('SELECT id FROM user_telegram WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare(`UPDATE user_telegram SET chat_id=?, bot_token=COALESCE(NULLIF(?,''),bot_token), updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(chat_id, bot_token || '', req.user.id);
    } else {
      db.prepare('INSERT INTO user_telegram (user_id, chat_id, bot_token) VALUES (?,?,?)').run(req.user.id, chat_id, bot_token || '');
    }
    res.json({ ok: true });
  });

  router.post('/api/lotto/telegram/config', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { chat_id } = req.body;
    let { bot_token } = req.body;
    if (!chat_id) return res.status(400).json({ error: 'chat_id 필요' });
    if (bot_token && bot_token.startsWith('bot')) bot_token = bot_token.slice(3);
    const existing = db.prepare('SELECT id FROM user_telegram WHERE user_id = ?').get(req.user.id);
    if (existing) { db.prepare(`UPDATE user_telegram SET chat_id=?, bot_token=COALESCE(NULLIF(?,''),bot_token), updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(chat_id, bot_token || '', req.user.id); }
    else { db.prepare('INSERT INTO user_telegram (user_id, chat_id, bot_token) VALUES (?,?,?)').run(req.user.id, chat_id, bot_token || ''); }
    res.json({ ok: true });
  });

  router.post('/api/lotto/telegram', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    let { token, chatid, text } = req.body;
    if (!chatid) {
      const tg = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id = ?').get(req.user.id);
      if (!tg) return res.status(400).json({ ok: false, error: '텔레그램 Chat ID를 먼저 등록하세요.' });
      chatid = tg.chat_id;
      token = token || tg.bot_token || process.env.TG_BOT_TOKEN;
    }
    if (!token) return res.status(400).json({ ok: false, error: 'Bot Token 없음' });
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatid, text, parse_mode: 'Markdown' }) });
      const data = await r.json();
      res.json(data.ok ? { ok: true } : { ok: false, error: data.description });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/api/lotto/picks', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { pick_date, games, algorithms } = req.body;
    if (!games?.length) return res.status(400).json({ error: '번호 없음' });
    db.prepare('DELETE FROM lotto_picks WHERE user_id=? AND pick_date=?').run(req.user.id, pick_date);
    const stmt = db.prepare('INSERT INTO lotto_picks (user_id, pick_date, game_index, numbers, algorithms) VALUES (?,?,?,?,?)');
    games.forEach((nums, i) => stmt.run(req.user.id, pick_date, i, JSON.stringify(nums), algorithms || ''));
    res.json({ ok: true, saved: games.length });
  });

  router.get('/api/lotto/picks', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { date, limit = 10, page = 1 } = req.query;
    const isAdmin = req.user.is_admin;
    if (date) {
      const rows = isAdmin
        ? db.prepare('SELECT lp.*, u.username FROM lotto_picks lp LEFT JOIN users u ON lp.user_id=u.id WHERE lp.pick_date=? ORDER BY lp.user_id, lp.game_index').all(date)
        : db.prepare('SELECT * FROM lotto_picks WHERE user_id=? AND pick_date=? ORDER BY game_index').all(req.user.id, date);
      return res.json({ picks: rows.map(r => ({ ...r, numbers: JSON.parse(r.numbers) })) });
    }
    const pageSize = isAdmin ? 5 : parseInt(limit);
    const offset = (parseInt(page) - 1) * pageSize;
    const total = isAdmin
      ? db.prepare('SELECT COUNT(DISTINCT pick_date) as cnt FROM lotto_picks').get()?.cnt || 0
      : db.prepare('SELECT COUNT(DISTINCT pick_date) as cnt FROM lotto_picks WHERE user_id=?').get(req.user.id)?.cnt || 0;
    const rows = isAdmin
      ? db.prepare(`SELECT lp.pick_date, COUNT(*) as game_count, MAX(lp.drw_no) as drw_no, MIN(CASE WHEN lp.rank > 0 THEN lp.rank END) as best_rank, MAX(lp.matched_count) as max_match, COUNT(DISTINCT lp.user_id) as user_count FROM lotto_picks lp GROUP BY lp.pick_date ORDER BY lp.pick_date DESC LIMIT ? OFFSET ?`).all(pageSize, offset)
      : db.prepare(`SELECT pick_date, COUNT(*) as game_count, MAX(drw_no) as drw_no, MIN(CASE WHEN rank > 0 THEN rank END) as best_rank, MAX(matched_count) as max_match, SUM(CASE WHEN rank > 0 THEN 1 ELSE 0 END) as checked_count FROM lotto_picks WHERE user_id=? GROUP BY pick_date ORDER BY pick_date DESC LIMIT ? OFFSET ?`).all(req.user.id, pageSize, offset);
    res.json({ picks: rows, total, page: parseInt(page), limit: pageSize, totalPages: Math.ceil(total / pageSize), is_admin: isAdmin });
  });

  router.post('/api/lotto/picks/check', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { pick_date, drw_no } = req.body;
    if (!pick_date || !drw_no) return res.status(400).json({ error: 'pick_date, drw_no 필수' });
    try {
      // lotto.oot.kr JSON API로 당첨번호 조회
      const apiRes = await fetch(`https://lotto.oot.kr/api/lotto/${drw_no}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (!apiRes.ok) return res.status(400).json({ ok: false, error: `${drw_no}회 당첨 정보를 가져올 수 없습니다.` });
      const data = await apiRes.json();
      if (!data.drwtNo1) return res.status(400).json({ ok: false, error: `${drw_no}회 당첨 정보가 없습니다.` });

      const winning = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
      const bonus = data.bnusNo;

      // lotto_history에도 저장 (없으면)
      const existing = db.prepare('SELECT id FROM lotto_history WHERE drw_no=?').get(drw_no);
      if (!existing) {
        db.prepare('INSERT INTO lotto_history (drw_no, numbers, bonus, drw_date) VALUES (?,?,?,?)')
          .run(drw_no, JSON.stringify(winning), bonus, data.drwNoDate || '');
      }

      const picks = db.prepare('SELECT * FROM lotto_picks WHERE user_id=? AND pick_date=?').all(req.user.id, pick_date);
      if (!picks.length) return res.status(404).json({ ok: false, error: '해당 날짜의 추천 번호가 없습니다.' });

      const results = picks.map(pick => {
        const nums = JSON.parse(pick.numbers);
        const matched = nums.filter(n => winning.includes(n)).length;
        const hasBonus = nums.includes(bonus);
        let rank = null;
        if (matched === 6) rank = 1;
        else if (matched === 5 && hasBonus) rank = 2;
        else if (matched === 5) rank = 3;
        else if (matched === 4) rank = 4;
        else if (matched === 3) rank = 5;
        db.prepare('UPDATE lotto_picks SET drw_no=?, rank=?, matched_count=?, bonus_match=? WHERE id=?').run(drw_no, rank, matched, hasBonus ? 1 : 0, pick.id);
        return { game_index: pick.game_index, numbers: nums, matched, rank, has_bonus: hasBonus };
      });
      res.json({ ok: true, winning, bonus, results, drw_no });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/api/lotto/schedule', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT * FROM lotto_schedule WHERE user_id=?').get(req.user.id);
    res.json(row || null);
  });

  router.post('/api/lotto/schedule', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { enabled, days, hour, game_count } = req.body;
    const existing = db.prepare('SELECT id, updated_at FROM lotto_schedule WHERE user_id=?').get(req.user.id);
    if (existing && existing.updated_at) {
      const diffDays = (Date.now() - new Date(existing.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) return res.json({ ok: false, remain_days: Math.ceil(7 - diffDays) });
    }
    if (existing) { db.prepare('UPDATE lotto_schedule SET enabled=?,days=?,hour=?,game_count=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(enabled ? 1 : 0, days, hour, game_count, req.user.id); }
    else { db.prepare('INSERT INTO lotto_schedule (user_id,enabled,days,hour,game_count) VALUES (?,?,?,?,?)').run(req.user.id, enabled ? 1 : 0, days, hour, game_count); }
    res.json({ ok: true });
  });

  router.delete('/api/lotto/schedule', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    db.prepare('DELETE FROM lotto_schedule WHERE user_id=?').run(req.user.id);
    res.json({ ok: true });
  });

  router.get('/api/lotto/schedule/log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { page = 1, limit = 5 } = req.query;
    const isAdmin = req.user.is_admin;
    const pageSize = parseInt(limit);
    const offset = (parseInt(page) - 1) * pageSize;
    const total = isAdmin
      ? db.prepare('SELECT COUNT(*) as cnt FROM lotto_schedule_log').get()?.cnt || 0
      : db.prepare('SELECT COUNT(*) as cnt FROM lotto_schedule_log WHERE user_id=?').get(req.user.id)?.cnt || 0;
    const rows = isAdmin
      ? db.prepare('SELECT sl.*, u.username FROM lotto_schedule_log sl LEFT JOIN users u ON sl.user_id=u.id ORDER BY sl.created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset)
      : db.prepare('SELECT * FROM lotto_schedule_log WHERE user_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(req.user.id, pageSize, offset);
    res.json({ logs: rows, total, page: parseInt(page), totalPages: Math.ceil(total / pageSize) });
  });

  router.get('/api/lotto/history', async (req, res) => {
    try {
      const rows = db.prepare('SELECT drw_no, numbers, bonus, drw_date FROM lotto_history ORDER BY drw_no DESC LIMIT 100').all();
      const history = rows.map(r => JSON.parse(r.numbers));
      res.json({ history, latest_round: rows[0]?.drw_no || 0, count: history.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/lotto/algorithm-weights', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const DEFAULT_WEIGHTS = { freq: 20, hot: 20, cold: 10, balance: 15, zone: 10, ac: 10, prime: 5, delta: 10 };
    const row = db.prepare('SELECT weights FROM lotto_algorithm_weights WHERE user_id=?').get(req.user.id);
    if (!row) return res.json(DEFAULT_WEIGHTS);
    try { res.json({ ...DEFAULT_WEIGHTS, ...JSON.parse(row.weights) }); } catch { res.json(DEFAULT_WEIGHTS); }
  });

  router.post('/api/lotto/algorithm-weights', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const weights = JSON.stringify(req.body);
      const existing = db.prepare('SELECT id FROM lotto_algorithm_weights WHERE user_id=?').get(req.user.id);
      if (existing) { db.prepare('UPDATE lotto_algorithm_weights SET weights=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(weights, req.user.id); }
      else { db.prepare('INSERT INTO lotto_algorithm_weights (user_id, weights) VALUES (?,?)').run(req.user.id, weights); }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ✅ 자동매매 API
  router.get('/api/auto-trade/positions', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const keys = getUserAlpacaKeys(req.user.id, null);
    if (!keys) return res.json({ positions: [] });
    try {
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key };
      const posData = await (await fetch(`${baseUrl}/v2/positions`, { headers })).json();
      const positions = Array.isArray(posData) ? posData : (posData.positions || []);
      const autoSymbols = new Set(db.prepare("SELECT DISTINCT symbol FROM auto_trade_log WHERE user_id=? AND action='BUY' AND status='active'").all(req.user.id).map(r => r.symbol));
      res.json({ positions: positions.filter(p => autoSymbols.has(p.symbol)) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/auto-trade/cancel/:symbol', async (req, res) => {
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
      db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)').run(req.user.id, symbol, 'SELL_MANUAL', pos.qty, pos.current_price, '수동 취소', order.id || '', plPct * 100, 'closed');
      db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'").run(req.user.id, symbol);
      res.json({ ok: true, order });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.post('/api/auto-trade/stop-all', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const keys = getUserAlpacaKeys(req.user.id, null);
    if (!keys) return res.status(400).json({ error: 'Alpaca 키 없음' });
    try {
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key, 'Content-Type': 'application/json' };
      db.prepare('UPDATE auto_trade_settings SET enabled=0 WHERE user_id=?').run(req.user.id);
      const autoSymbols = db.prepare("SELECT DISTINCT symbol FROM auto_trade_log WHERE user_id=? AND action='BUY' AND status='active'").all(req.user.id);
      const results = [];
      for (const { symbol } of autoSymbols) {
        try {
          const pos = await (await fetch(`${baseUrl}/v2/positions/${symbol}`, { headers })).json();
          if (!pos.qty) continue;
          const order = await (await fetch(`${baseUrl}/v2/orders`, { method: 'POST', headers, body: JSON.stringify({ symbol, qty: pos.qty, side: 'sell', type: 'market', time_in_force: 'day' }) })).json();
          const plPct = parseFloat(pos.unrealized_plpc) || 0;
          db.prepare('INSERT INTO auto_trade_log (user_id,symbol,action,qty,price,reason,order_id,profit_pct,status) VALUES (?,?,?,?,?,?,?,?,?)').run(req.user.id, symbol, 'SELL_STOP_ALL', pos.qty, pos.current_price, '전체 종료', order.id || '', plPct * 100, 'closed');
          db.prepare("UPDATE auto_trade_log SET status='closed' WHERE user_id=? AND symbol=? AND action='BUY' AND status='active'").run(req.user.id, symbol);
          results.push(symbol);
        } catch (e) { }
      }
      res.json({ ok: true, closed: results });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  router.get('/api/auto-trade/settings', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT * FROM auto_trade_settings WHERE user_id=?').get(req.user.id);
    res.json(row || { enabled: 0, symbols: 'QQQ,SPY,AAPL', balance_ratio: 0.1, take_profit: 0.05, stop_loss: 0.05, signal_mode: 'combined', factor_strategy: 'value_quality', factor_market: 'nasdaq' });
  });

  router.post('/api/auto-trade/settings', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { enabled, symbols, balance_ratio, take_profit, stop_loss, signal_mode, factor_strategy, factor_market } = req.body;
    const fs = factor_strategy || 'value_quality';
    const fm = factor_market || 'nasdaq';
    const existing = db.prepare('SELECT id FROM auto_trade_settings WHERE user_id=?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE auto_trade_settings SET enabled=?,symbols=?,balance_ratio=?,take_profit=?,stop_loss=?,signal_mode=?,factor_strategy=?,factor_market=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
        .run(enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode, fs, fm, req.user.id);
    } else {
      db.prepare('INSERT INTO auto_trade_settings (user_id,enabled,symbols,balance_ratio,take_profit,stop_loss,signal_mode,factor_strategy,factor_market) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(req.user.id, enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode, fs, fm);
    }
    res.json({ ok: true });
  });

  router.get('/api/auto-trade/log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const rows = db.prepare('SELECT * FROM auto_trade_log WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
    res.json({ logs: rows });
  });

  router.post('/api/auto-trade/run', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const result = await runAutoTradeForUser(req.user.id);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ 나스닥100/다우존스30 TOP3 분석
  router.post('/api/auto-trade/nasdaq-top3', async (req, res) => {
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
  router.get('/api/auto-strategy/settings', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT * FROM auto_strategy_settings WHERE user_id=?').get(req.user.id);
    res.json({ ok: true, settings: row || { enabled: 0, market: 'nasdaq', roe_min: 15, debt_max: 100, revenue_min: 10, momentum_top: 30, sma200_filter: 1, use_macd: 1, use_rsi: 1, rsi_threshold: 40, use_bb: 1, balance_ratio: 0.2, max_positions: 5, take_profit1: 0.1, take_profit2: 0.2, stop_loss: 0.05, factor_exit: 1, sma200_exit: 1 } });
  });

  // 설정 저장
  router.post('/api/auto-strategy/settings', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { market, roe_min, debt_max, revenue_min, momentum_top, sma200_filter, use_macd, use_rsi, rsi_threshold, use_bb, balance_ratio, max_positions, take_profit1, take_profit2, stop_loss, factor_exit, sma200_exit } = req.body;
    const existing = db.prepare('SELECT id FROM auto_strategy_settings WHERE user_id=?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE auto_strategy_settings SET market=?,roe_min=?,debt_max=?,revenue_min=?,momentum_top=?,sma200_filter=?,use_macd=?,use_rsi=?,rsi_threshold=?,use_bb=?,balance_ratio=?,max_positions=?,take_profit1=?,take_profit2=?,stop_loss=?,factor_exit=?,sma200_exit=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?')
        .run(market, roe_min, debt_max, revenue_min, momentum_top, sma200_filter?1:0, use_macd?1:0, use_rsi?1:0, rsi_threshold, use_bb?1:0, balance_ratio, max_positions, take_profit1, take_profit2, stop_loss, factor_exit?1:0, sma200_exit?1:0, req.user.id);
    } else {
      db.prepare('INSERT INTO auto_strategy_settings (user_id,market,roe_min,debt_max,revenue_min,momentum_top,sma200_filter,use_macd,use_rsi,rsi_threshold,use_bb,balance_ratio,max_positions,take_profit1,take_profit2,stop_loss,factor_exit,sma200_exit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(req.user.id, market, roe_min, debt_max, revenue_min, momentum_top, sma200_filter?1:0, use_macd?1:0, use_rsi?1:0, rsi_threshold, use_bb?1:0, balance_ratio, max_positions, take_profit1, take_profit2, stop_loss, factor_exit?1:0, sma200_exit?1:0);
    }
    res.json({ ok: true });
  });

  // 활성화 토글
  router.post('/api/auto-strategy/toggle', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { enabled } = req.body;
    const existing = db.prepare('SELECT id FROM auto_strategy_settings WHERE user_id=?').get(req.user.id);
    if (existing) {
      db.prepare('UPDATE auto_strategy_settings SET enabled=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(enabled?1:0, req.user.id);
    } else {
      db.prepare('INSERT INTO auto_strategy_settings (user_id,enabled) VALUES (?,?)').run(req.user.id, enabled?1:0);
    }
    res.json({ ok: true, enabled: !!enabled });
  });

  // 종목 풀 조회
  router.get('/api/auto-strategy/pool', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const rows = db.prepare('SELECT * FROM auto_strategy_pool WHERE user_id=? ORDER BY factor_score DESC').all(req.user.id);
    res.json({ ok: true, pool: rows });
  });

  // ============================================================
  // 투자 성향 (Investor Profile) API
  // ============================================================

  // 성향 조회
  router.get('/api/investor-profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT * FROM investor_profile WHERE user_id=?').get(req.user.id);
    res.json({ ok: true, profile: row || null });
  });

  // 성향 설문 저장 + 자동 분류
  router.post('/api/investor-profile', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { q_period, q_loss, q_return, q_style, q_experience } = req.body;

    const total = (q_period||2) + (q_loss||2) + (q_return||2) + (q_style||2) + (q_experience||2);

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
    if ((q_experience||2) === 1) {
      profile_type = 'beginner';
      w_momentum = 0.20; w_value = 0.40; w_quality = 0.30; w_news = 0.10;
      risk_take_profit = 0.07; risk_stop_loss = 0.03;
      risk_max_positions = 3; risk_balance_ratio = 0.10;
    }

    const existing = db.prepare('SELECT id FROM investor_profile WHERE user_id=?').get(req.user.id);
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

    res.json({ ok: true, profile_type, profile_score: total,
               w_momentum, w_value, w_quality, w_news,
               risk_take_profit, risk_stop_loss, risk_max_positions, risk_balance_ratio });
  });

  // ============================================================
  // 1. 성과 대시보드 API
  // ============================================================

  // 성과 스냅샷 저장 (Alpaca 계좌 조회 후 저장)
  router.post('/api/performance/snapshot', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    try {
      const keys = getUserAlpacaKeys(req.user.id);
      if (!keys) return res.status(400).json({ error: 'Alpaca 키 없음' });
      const baseUrl = keys.paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
      const headers = { 'APCA-API-KEY-ID': keys.api_key, 'APCA-API-SECRET-KEY': keys.secret_key };

      const account = await (await fetch(`${baseUrl}/v2/account`, { headers })).json();
      const equity = parseFloat(account.equity) || 0;
      const cash = parseFloat(account.cash) || 0;
      const portfolioValue = parseFloat(account.portfolio_value) || 0;

      // 전날 스냅샷으로 일일 손익 계산
      const today = new Date().toISOString().split('T')[0];
      const yesterday = db.prepare(`SELECT total_equity, total_pnl, peak_equity, win_count, loss_count FROM portfolio_performance WHERE user_id=? ORDER BY snapshot_date DESC LIMIT 1`).get(req.user.id);

      const prevEquity = yesterday?.total_equity || equity;
      const dailyPnl = equity - prevEquity;
      const dailyPnlPct = prevEquity > 0 ? (dailyPnl / prevEquity * 100) : 0;

      // 매매 이력에서 승/패 집계
      const trades = db.prepare(`SELECT action, profit_pct FROM auto_trade_log WHERE user_id=? AND action IN ('SELL_PROFIT','SELL_PROFIT1','SELL_PROFIT2','SELL_STOP','SELL_LOSS')`).all(req.user.id);
      const winCount = trades.filter(t => t.action.includes('PROFIT')).length;
      const lossCount = trades.filter(t => t.action.includes('STOP') || t.action.includes('LOSS')).length;

      // 초기 자본 (첫 스냅샷 기준)
      const first = db.prepare(`SELECT total_equity FROM portfolio_performance WHERE user_id=? ORDER BY snapshot_date ASC LIMIT 1`).get(req.user.id);
      const initialEquity = first?.total_equity || equity;
      const totalPnl = equity - initialEquity;
      const totalPnlPct = initialEquity > 0 ? (totalPnl / initialEquity * 100) : 0;

      // MDD 계산
      const peakEquity = Math.max(yesterday?.peak_equity || equity, equity);
      const allPeaks = db.prepare(`SELECT MAX(peak_equity) as peak FROM portfolio_performance WHERE user_id=?`).get(req.user.id);
      const maxPeak = Math.max(allPeaks?.peak || equity, equity);
      const maxDrawdown = maxPeak > 0 ? ((maxPeak - equity) / maxPeak * 100) : 0;

      db.prepare(`INSERT OR REPLACE INTO portfolio_performance
        (user_id, snapshot_date, total_equity, cash, portfolio_value, daily_pnl, daily_pnl_pct, total_pnl, total_pnl_pct, win_count, loss_count, max_drawdown, peak_equity)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(
          req.user.id,
          today,
          equity || 0,
          cash || 0,
          portfolioValue || 0,
          dailyPnl || 0,
          dailyPnlPct || 0,
          totalPnl || 0,
          totalPnlPct || 0,
          winCount || 0,
          lossCount || 0,
          maxDrawdown || 0,
          peakEquity || equity || 0
        );

      res.json({ ok: true, equity, cash, portfolioValue, dailyPnl, dailyPnlPct, totalPnl, totalPnlPct, winCount, lossCount, maxDrawdown });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  // 성과 이력 조회
  router.get('/api/performance/history', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const days = parseInt(req.query.days || 30);
    const rows = db.prepare(`SELECT * FROM portfolio_performance WHERE user_id=? ORDER BY snapshot_date DESC LIMIT ?`).all(req.user.id, days);
    res.json({ ok: true, history: rows.reverse() });
  });

  // 성과 요약 (홈 화면용)
  router.get('/api/performance/summary', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const latest = db.prepare(`SELECT * FROM portfolio_performance WHERE user_id=? ORDER BY snapshot_date DESC LIMIT 1`).get(req.user.id);
    const weekAgo = db.prepare(`SELECT total_equity FROM portfolio_performance WHERE user_id=? ORDER BY snapshot_date DESC LIMIT 7`).all(req.user.id);
    const monthPnl = db.prepare(`SELECT SUM(daily_pnl) as pnl FROM portfolio_performance WHERE user_id=? AND snapshot_date >= date('now','-30 days')`).get(req.user.id);
    const maxMdd = db.prepare(`SELECT MAX(max_drawdown) as mdd FROM portfolio_performance WHERE user_id=?`).get(req.user.id);
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
      .run(req.user.id, name||`${symbol} ${strategy}`, symbol, strategy, start_date, end_date,
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
    if (row.result_json) try { row.result_json = JSON.parse(row.result_json); } catch(e) {}
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
    } catch(e) { return false; }
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

  return router;
}
