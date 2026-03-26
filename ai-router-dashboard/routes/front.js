import express from 'express';
import path from 'path';
const router = express.Router();

export default function frontRoutes({ db, anthropic, CONFIG, PRESETS, requestStats, startedAt, saveErrorLog, encryptEmail, decryptEmail, getUserAlpacaKeys, buildPayload, forwardToTarget, callClaude, summarizeProviders, __dirname }) {

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
    if (!keys) return res.status(400).json({ error: 'Alpaca 키가 등록되지 않았습니다.' });
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

  // ✅ 뉴스 API
  router.post('/api/news/trigger', async (req, res) => {
    try {
      const source = req.body.source || 'rss';
      const n8nWebhookUrl = process.env.NEWS_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/news-collect';
      const response = await fetch(n8nWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ use_claude: source === 'claude', use_gpt: source === 'gpt', source }) });
      if (response.ok) return res.json({ status: 'ok', source });
      return res.status(500).json({ error: 'n8n webhook call failed' });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  });

  router.post('/api/news/save', (req, res) => {
    try {
      const { category, content, use_claude, source } = req.body;
      const date = new Date().toISOString().slice(0, 10);
      const savedAt = new Date().toISOString();
      const src = (source && ['rss', 'claude', 'gpt'].includes(source)) ? source : (use_claude ? 'claude' : 'rss');
      const cleanContent = (content || '').replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();
      if (!cleanContent || cleanContent === '제목없음' || cleanContent === '-' || cleanContent === 'undefined') return res.json({ status: 'ignored', reason: 'content is empty or invalid' });
      const existing = db.prepare('SELECT id FROM news WHERE category = ? AND date = ? AND content = ?').get(category, date, cleanContent);
      if (existing) return res.json({ status: 'exists', message: '이미 동일한 내용의 뉴스가 저장되어 있습니다.', id: existing.id });
      db.prepare('INSERT INTO news (category, date, saved_at, use_claude, source, content) VALUES (?, ?, ?, ?, ?, ?)').run(category, date, savedAt, src === 'claude' ? 1 : 0, src, cleanContent);
      return res.json({ status: 'ok', category, date, content_length: cleanContent.length, message: '신규 뉴스 저장 완료' });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  });

  router.get('/api/news/list', (req, res) => {
    try {
      const { date, category, source, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;
      let query = 'SELECT * FROM news WHERE 1=1';
      const params = [];
      if (date) { query += ' AND date = ?'; params.push(date); }
      if (category && category !== 'ALL') { query += ' AND category = ?'; params.push(category); }
      if (source) { query += ' AND source = ?'; params.push(source); }
      query += ' ORDER BY saved_at DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), Number(offset));
      const news = db.prepare(query).all(...params);
      const total = db.prepare('SELECT COUNT(*) as cnt FROM news WHERE 1=1' + (date ? ' AND date = ?' : '') + (category && category !== 'ALL' ? ' AND category = ?' : '') + (source ? ' AND source = ?' : '')).get(...params.slice(0, -2));
      return res.json({ news, total: total.cnt, page: Number(page), limit: Number(limit) });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  });

  router.get('/api/news/dates', (req, res) => {
    try {
      const rows = db.prepare("SELECT DISTINCT date FROM news ORDER BY date DESC LIMIT 30").all();
      return res.json({ dates: rows.map(r => r.date) });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  });

  router.delete('/api/news/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
      return res.json({ status: 'ok' });
    } catch (error) { return res.status(500).json({ error: error.message }); }
  });

  // ✅ 로또 API
  router.get('/api/lotto/telegram/config', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const row = db.prepare('SELECT chat_id, bot_token FROM user_telegram WHERE user_id = ?').get(req.user.id);
    res.json({ chat_id: row?.chat_id || '', has_token: !!row?.bot_token });
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
    const { date, limit = 50 } = req.query;
    if (date) {
      const rows = db.prepare('SELECT * FROM lotto_picks WHERE user_id=? AND pick_date=? ORDER BY game_index').all(req.user.id, date);
      return res.json({ picks: rows.map(r => ({ ...r, numbers: JSON.parse(r.numbers) })) });
    }
    const rows = db.prepare(`SELECT pick_date, COUNT(*) as game_count, MAX(drw_no) as drw_no, MIN(CASE WHEN rank > 0 THEN rank END) as best_rank, MAX(matched_count) as max_match, SUM(CASE WHEN rank > 0 THEN 1 ELSE 0 END) as checked_count FROM lotto_picks WHERE user_id=? GROUP BY pick_date ORDER BY pick_date DESC LIMIT ?`).all(req.user.id, parseInt(limit));
    res.json({ picks: rows });
  });

  router.post('/api/lotto/picks/check', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { pick_date, drw_no } = req.body;
    try {
      const apiRes = await fetch(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drw_no}`);
      const data = await apiRes.json();
      if (data.returnValue !== 'success') return res.status(400).json({ error: '회차 정보 없음' });
      const winning = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
      const bonus = data.bnusNo;
      const picks = db.prepare('SELECT * FROM lotto_picks WHERE user_id=? AND pick_date=?').all(req.user.id, pick_date);
      if (!picks.length) return res.status(404).json({ error: '픽 없음' });
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
    } catch (e) { res.status(500).json({ error: e.message }); }
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
    const rows = db.prepare('SELECT * FROM lotto_schedule_log WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    res.json({ logs: rows });
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
    res.json(row || { enabled: 0, symbols: 'QQQ,SPY,AAPL', balance_ratio: 0.1, take_profit: 0.05, stop_loss: 0.05, signal_mode: 'combined' });
  });

  router.post('/api/auto-trade/settings', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const { enabled, symbols, balance_ratio, take_profit, stop_loss, signal_mode } = req.body;
    const existing = db.prepare('SELECT id FROM auto_trade_settings WHERE user_id=?').get(req.user.id);
    if (existing) { db.prepare('UPDATE auto_trade_settings SET enabled=?,symbols=?,balance_ratio=?,take_profit=?,stop_loss=?,signal_mode=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode, req.user.id); }
    else { db.prepare('INSERT INTO auto_trade_settings (user_id,enabled,symbols,balance_ratio,take_profit,stop_loss,signal_mode) VALUES (?,?,?,?,?,?,?)').run(req.user.id, enabled ? 1 : 0, symbols, balance_ratio, take_profit, stop_loss, signal_mode); }
    res.json({ ok: true });
  });

  router.get('/api/auto-trade/log', (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const rows = db.prepare('SELECT * FROM auto_trade_log WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
    res.json({ logs: rows });
  });

  router.post('/api/auto-trade/run', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: '로그인 필요' });
    const result = await req.runAutoTrade(req.user.id);
    res.json(result);
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

  return router;
}
