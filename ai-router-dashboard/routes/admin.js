import express from 'express';
import path from 'path';
const router = express.Router();

export default function adminRoutes({ db, bcrypt, jwt, JWT_SECRET, ADMIN_JWT_SECRET, logger, decryptEmail, saveErrorLog, errorLogDir, fs, logClients, __dirname }) {

  // ✅ 어드민 페이지
  router.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  router.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));

  // ✅ 가입자 목록 조회
  router.get('/api/admin/users', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { search } = req.query;
    let query = 'SELECT id, username, email, created_at, last_login FROM users WHERE 1=1';
    const params = [];
    if (search) { query += ' AND username LIKE ?'; params.push('%' + search + '%'); }
    query += ' ORDER BY created_at DESC';
    const users = db.prepare(query).all(...params);
    const result = users.map(u => ({ ...u, email: u.email ? (decryptEmail(u.email) || '(복호화 실패)') : '-' }));
    return res.json({ users: result });
  });

  // ✅ 가입자 삭제
  router.delete('/api/admin/users/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    if (user.is_admin) return res.status(400).json({ error: '관리자는 삭제할 수 없습니다.' });
    const uid = parseInt(req.params.id);
    // 연관 데이터 전체 삭제 (트랜잭션)
    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM lotto_picks WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM lotto_schedule WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM lotto_schedule_log WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM lotto_algorithm_weights WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM user_telegram WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM user_broker_keys WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM terms_agreements WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM auto_trade_settings WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM auto_trade_log WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM auto_strategy_settings WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM portfolio_performance WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM backtest_results WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM telegram_alert_log WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM quant_analysis_log WHERE user_id=?').run(uid);
      db.prepare('DELETE FROM users WHERE id=?').run(uid);
    });
    deleteAll();
    logger.warn('USER_DELETED', { adminId: req.user.id, deletedUsername: user.username });
    return res.json({ status: 'ok' });
  });

  // ✅ 접속 통계
  router.get('/api/admin/stats', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const dailyStats = db.prepare(`SELECT DATE(timestamp) as date, COUNT(*) as total_requests, COUNT(DISTINCT ip) as unique_ips, COUNT(DISTINCT username) as unique_users,
      SUM(CASE WHEN event_type = 'login_success' THEN 1 ELSE 0 END) as logins,
      SUM(CASE WHEN event_type = 'login_failed' THEN 1 ELSE 0 END) as failed_logins,
      SUM(CASE WHEN event_type = 'suspicious' THEN 1 ELSE 0 END) as suspicious
      FROM access_logs WHERE timestamp >= datetime('now', '-30 days') GROUP BY DATE(timestamp) ORDER BY date DESC`).all();
    const userStats = db.prepare(`SELECT username, COUNT(*) as total_requests, COUNT(DISTINCT DATE(timestamp)) as active_days,
      MAX(timestamp) as last_seen, MIN(timestamp) as first_seen FROM access_logs WHERE username IS NOT NULL
      GROUP BY username ORDER BY total_requests DESC LIMIT 20`).all();
    const hourlyStats = db.prepare(`SELECT strftime('%H', timestamp) as hour, COUNT(*) as cnt FROM access_logs
      WHERE timestamp >= datetime('now', '-7 days') GROUP BY hour ORDER BY hour`).all();
    return res.json({ dailyStats, userStats, hourlyStats });
  });

  // ✅ 보안 통계
  router.get('/api/admin/security-stats', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const stats = {
      total_requests: db.prepare("SELECT COUNT(*) as cnt FROM access_logs").get().cnt,
      login_success: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'login_success'").get().cnt,
      login_failed: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'login_failed'").get().cnt,
      suspicious: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'suspicious'").get().cnt,
      rate_limited: db.prepare("SELECT COUNT(*) as cnt FROM access_logs WHERE event_type = 'rate_limit'").get().cnt,
      unique_ips: db.prepare("SELECT COUNT(DISTINCT ip) as cnt FROM access_logs").get().cnt,
      top_ips: db.prepare("SELECT ip, COUNT(*) as cnt FROM access_logs GROUP BY ip ORDER BY cnt DESC LIMIT 10").all(),
      recent_suspicious: db.prepare("SELECT * FROM access_logs WHERE event_type = 'suspicious' ORDER BY timestamp DESC LIMIT 5").all(),
      recent_failed: db.prepare("SELECT * FROM access_logs WHERE event_type = 'login_failed' ORDER BY timestamp DESC LIMIT 5").all()
    };
    return res.json(stats);
  });

  // ✅ 접속 로그 조회
  router.get('/api/admin/logs', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { type, limit = 100, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM access_logs WHERE 1=1';
    const params = [];
    if (type && type !== 'all') { query += ' AND event_type = ?'; params.push(type); }
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const logs = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as cnt FROM access_logs' + (type && type !== 'all' ? ' WHERE event_type = ?' : '')).get(...(type && type !== 'all' ? [type] : []));
    return res.json({ logs, total: total.cnt, page: Number(page), limit: Number(limit) });
  });

  // ✅ 실시간 로그 SSE
  router.get('/api/admin/logs/stream', (req, res) => {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).end();
    try {
      // ADMIN_JWT_SECRET으로 먼저 검증, 실패 시 JWT_SECRET 시도
      let decoded;
      try { decoded = jwt.verify(token, ADMIN_JWT_SECRET); }
      catch(e) { decoded = jwt.verify(token, JWT_SECRET); }
      const streamUser = db.prepare('SELECT a.id, 1 as is_admin FROM admins a WHERE a.id=? AND a.is_active=1').get(decoded.id);
      if (!streamUser?.is_admin) return res.status(403).end();
    } catch (e) { return res.status(401).end(); }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ level: 'info', message: '🔌 실시간 로그 연결됨', time: new Date().toISOString().slice(11, 19) })}\n\n`);

    try {
      const recent = db.prepare('SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 20').all();
      recent.reverse().forEach(log => {
        const entry = {
          level: log.event_type === 'suspicious' ? 'warn' : log.event_type === 'login_failed' ? 'error' : 'info',
          message: `[${log.event_type}] ${log.method} ${log.path}`,
          time: log.timestamp?.slice(11, 19) || '',
          ip: log.ip, username: log.username, status: log.status_code, isHistory: true
        };
        res.write(`data: ${JSON.stringify(entry)}\n\n`);
      });
    } catch (e) { }

    logClients.add(res);
    req.on('close', () => { logClients.delete(res); });
  });

  // ✅ 비밀번호 초기화 요청 목록
  router.get('/api/admin/reset-requests', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    db.exec(`CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, username TEXT NOT NULL,
      status TEXT DEFAULT 'pending', temp_password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    const rows = db.prepare("SELECT * FROM password_reset_requests WHERE status = 'pending' ORDER BY created_at DESC").all();
    return res.json({ requests: rows });
  });

  // ✅ 임시 비밀번호 발급
  router.post('/api/admin/reset-password', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { request_id } = req.body;
    const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(request_id);
    if (!request) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    const tempPassword = Math.random().toString(36).substring(2, 10) + '!A1';
    const hash = bcrypt.hashSync(tempPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, request.user_id);
    db.prepare("UPDATE password_reset_requests SET status = 'done', temp_password = ? WHERE id = ?").run(tempPassword, request_id);
    return res.json({ status: 'ok', username: request.username, temp_password: tempPassword });
  });

  // ✅ RSS 소스 관리
  router.get('/api/admin/rss/sources', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const sources = db.prepare('SELECT * FROM rss_sources ORDER BY category, name').all();
    return res.json({ sources });
  });

  router.post('/api/admin/rss/sources', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { name, url, category = 'global' } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'name, url 필수' });
    try {
      const result = db.prepare('INSERT INTO rss_sources (name, url, category) VALUES (?, ?, ?)').run(name, url, category);
      return res.json({ status: 'ok', id: result.lastInsertRowid });
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(400).json({ error: '이미 등록된 URL입니다.' });
      return res.status(500).json({ error: e.message });
    }
  });

  router.patch('/api/admin/rss/sources/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { enabled } = req.body;
    db.prepare('UPDATE rss_sources SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
    return res.json({ status: 'ok' });
  });

  router.delete('/api/admin/rss/sources/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    db.prepare('DELETE FROM rss_sources WHERE id = ?').run(req.params.id);
    return res.json({ status: 'ok' });
  });

  // ✅ RSS 수집 테스트
  router.get('/api/admin/rss/test', async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const sources = db.prepare('SELECT * FROM rss_sources WHERE enabled = 1').all();
    const results = await Promise.allSettled(sources.map(async (s) => {
      try {
        const response = await fetch(s.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          },
          signal: AbortSignal.timeout(12000)
        });
        const xml = await response.text();
        const count = (xml.match(/<item>/g) || []).length;
        if (count === 0) throw new Error('아이템 없음 (차단 또는 빈 피드)');
        return { name: s.name, url: s.url, success: true, count };
      } catch (e) {
        return { name: s.name, url: s.url, success: false, error: e.message };
      }
    }));
    return res.json({ results: results.map(r => r.value || r.reason) });
  });

  // ✅ 에러 로그 날짜 목록
  router.get('/api/admin/error-logs/dates', (req, res) => {
    try {
      if (!req.user || !req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
      const { type } = req.query;
      const files = fs.existsSync(errorLogDir) ? fs.readdirSync(errorLogDir).filter(f => f.endsWith('.jsonl')).sort().reverse() : [];
      const dates = files.map(f => f.replace('.jsonl', '')).filter(date => {
        if (!type || type === 'ALL') return true;
        try {
          const content = fs.readFileSync(path.join(errorLogDir, `${date}.jsonl`), 'utf8');
          return content.split('\n').filter(Boolean).some(line => { try { return JSON.parse(line).event_type?.startsWith(type); } catch { return false; } });
        } catch { return false; }
      });
      res.json({ ok: true, dates });
    } catch (e) {
      logger.error('ERROR_LOG_DATES', { error: e.message });
      res.status(500).json({ error: '서버 오류' });
    }
  });

  // ✅ 에러 로그 상세 조회
  router.get('/api/admin/error-logs', (req, res) => {
    try {
      if (!req.user || !req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
      const { date, type } = req.query;
      if (!date) return res.json({ ok: true, logs: [] });
      const filePath = path.join(errorLogDir, `${date}.jsonl`);
      if (!fs.existsSync(filePath)) return res.json({ ok: true, logs: [] });
      const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
      let logs = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      if (type && type !== 'ALL') logs = logs.filter(l => l.event_type?.startsWith(type));
      logs.reverse();
      res.json({ ok: true, logs });
    } catch (e) {
      logger.error('ERROR_LOG_FETCH', { error: e.message });
      res.status(500).json({ error: '서버 오류' });
    }
  });


  // ===== 관리자 관리 API =====

  // 관리자 목록 조회
  router.get('/api/admin/admins', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const admins = db.prepare('SELECT a.id, a.username, a.email, a.is_active, a.created_at, a.last_login, r.role_name, r.id as role_id FROM admins a LEFT JOIN admin_roles r ON a.role_id=r.id ORDER BY a.created_at DESC').all();
    return res.json({ admins });
  });

  // 관리자 등록
  router.post('/api/admin/admins', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { username, password, email, role_id } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username, password 필수' });
    const existing = db.prepare('SELECT id FROM admins WHERE username=?').get(username);
    if (existing) return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    // 일반 유저 테이블과도 중복 체크
    const existingUser = db.prepare('SELECT id FROM users WHERE username=?').get(username);
    if (existingUser) return res.status(400).json({ error: '이미 일반 회원으로 등록된 아이디입니다.' });
    const hash = bcrypt.hashSync(password, 12);
    // admins 테이블에 등록
    const result = db.prepare('INSERT INTO admins (username, password_hash, email, role_id) VALUES (?,?,?,?)').run(username, hash, email || null, role_id || 1);
    // users 테이블에도 자동 등록 (created_type=1: 관리자생성, 일반 로그인 불가)
    const userResult = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, email, created_type) VALUES (?,?,?,?)').run(username, hash, email || null, 1);
    return res.json({ ok: true, id: result.lastInsertRowid, user_id: userResult.lastInsertRowid });
  });

  // 관리자 수정
  router.put('/api/admin/admins/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { email, role_id, is_active, password } = req.body;
    const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(req.params.id);
    if (!admin) return res.status(404).json({ error: '관리자 없음' });
    if (password) {
      db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password, 12), req.params.id);
    }
    db.prepare('UPDATE admins SET email=?, role_id=?, is_active=? WHERE id=?').run(email ?? admin.email, role_id ?? admin.role_id, is_active ?? admin.is_active, req.params.id);
    return res.json({ ok: true });
  });

  // 관리자 삭제
  router.delete('/api/admin/admins/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
    db.prepare('DELETE FROM admins WHERE id=?').run(req.params.id);
    return res.json({ ok: true });
  });

  // 관리자 롤 목록
  router.get('/api/admin/roles', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const roles = db.prepare('SELECT * FROM admin_roles ORDER BY id').all();
    return res.json({ roles });
  });

  // 관리자 롤 추가
  router.post('/api/admin/roles', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { role_name, description } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name 필수' });
    try {
      const result = db.prepare('INSERT INTO admin_roles (role_name, description) VALUES (?,?)').run(role_name, description || '');
      return res.json({ ok: true, id: result.lastInsertRowid });
    } catch(e) {
      return res.status(400).json({ error: '이미 존재하는 롤입니다.' });
    }
  });

  // 관리자 롤 삭제
  router.delete('/api/admin/roles/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const used = db.prepare('SELECT id FROM admins WHERE role_id=?').get(req.params.id);
    if (used) return res.status(400).json({ error: '사용 중인 롤은 삭제할 수 없습니다.' });
    db.prepare('DELETE FROM admin_roles WHERE id=?').run(req.params.id);
    return res.json({ ok: true });
  });

  return router;
}
