import express from 'express';
import path from 'path';
const router = express.Router();

export default function adminRoutes({ db, bcrypt, jwt, JWT_SECRET, logger, decryptEmail, saveErrorLog, errorLogDir, fs, logClients, __dirname }) {

  // ✅ 어드민 페이지
  router.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  router.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));

  // ✅ 가입자 목록 조회
  router.get('/api/admin/users', (req, res) => {
    if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
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
    if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    if (user.username === 'admin') return res.status(400).json({ error: '관리자는 삭제할 수 없습니다.' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    logger.warn('USER_DELETED', { adminId: req.user.id, deletedUsername: user.username });
    return res.json({ status: 'ok' });
  });

  // ✅ 접속 통계
  router.get('/api/admin/stats', (req, res) => {
    if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
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
    if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
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
    if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
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
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.username !== 'admin') return res.status(403).end();
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
    if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
    db.exec(`CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, username TEXT NOT NULL,
      status TEXT DEFAULT 'pending', temp_password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    const rows = db.prepare("SELECT * FROM password_reset_requests WHERE status = 'pending' ORDER BY created_at DESC").all();
    return res.json({ requests: rows });
  });

  // ✅ 임시 비밀번호 발급
  router.post('/api/admin/reset-password', (req, res) => {
    if (req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
    const { request_id } = req.body;
    const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(request_id);
    if (!request) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    const tempPassword = Math.random().toString(36).substring(2, 10) + '!A1';
    const hash = bcrypt.hashSync(tempPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, request.user_id);
    db.prepare("UPDATE password_reset_requests SET status = 'done', temp_password = ? WHERE id = ?").run(tempPassword, request_id);
    return res.json({ status: 'ok', username: request.username, temp_password: tempPassword });
  });

  // ✅ 에러 로그 날짜 목록
  router.get('/api/admin/error-logs/dates', (req, res) => {
    try {
      if (!req.user || req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
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
      if (!req.user || req.user.username !== 'admin') return res.status(403).json({ error: '권한 없음' });
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

  return router;
}
