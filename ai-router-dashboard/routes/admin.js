import express from 'express';
import path from 'path';
const router = express.Router();

export default function adminRoutes({ db, bcrypt, jwt, JWT_SECRET, ADMIN_JWT_SECRET, logger, decryptEmail, saveErrorLog, errorLogDir, fs, logClients, __dirname }) {

  // 슈퍼관리자 판정 — admin_roles seed 가 'superadmin' / 'manager' 두 종류
  const isSuperadmin = (u) => !!u?.is_admin && u.role_name === 'superadmin';
  const requireSuperadmin = (req, res, next) => {
    if (!isSuperadmin(req.user)) return res.status(403).json({ error: '슈퍼관리자 권한이 필요합니다.' });
    next();
  };

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

  // ✅ 가입자 삭제 (스키마 드리프트 안전: 존재하는 테이블만 삭제)
  router.delete('/api/admin/users/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const targetId = parseInt(req.params.id);
    if (!Number.isFinite(targetId) || targetId <= 0) return res.status(400).json({ error: 'invalid id' });

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(targetId);
    if (!user) return res.status(404).json({ error: '사용자 없음' });
    // users 테이블에는 is_admin 컬럼이 없음. admins 테이블 cross-check 로 보호.
    const adminMirror = db.prepare('SELECT id FROM admins WHERE username=?').get(user.username);
    if (adminMirror) return res.status(400).json({ error: '관리자 계정은 삭제할 수 없습니다. 관리자 메뉴에서 처리하세요.' });

    const candidateTables = [
      'user_broker_keys', 'terms_agreements',
      'auto_trade_settings', 'auto_trade_log', 'auto_strategy_settings',
      'trade_setting_type3', 'trade_setting_type4',
      'portfolio_performance', 'backtest_results', 'quant_analysis_log',
    ];
    const existing = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
    const tablesToClear = candidateTables.filter(t => existing.has(t));

    const deleteAll = db.transaction(() => {
      for (const t of tablesToClear) {
        db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(targetId);
      }
      db.prepare('DELETE FROM users WHERE id=?').run(targetId);
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

  // ✅ 접속 로그 조회 — limit/page 정수+범위 클램프 (NaN/거대값 방지)
  router.get('/api/admin/logs', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { type } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM access_logs WHERE 1=1';
    const params = [];
    if (type && type !== 'all') { query += ' AND event_type = ?'; params.push(type); }
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const logs = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as cnt FROM access_logs' + (type && type !== 'all' ? ' WHERE event_type = ?' : '')).get(...(type && type !== 'all' ? [type] : []));
    return res.json({ logs, total: total.cnt, page, limit });
  });

  // ✅ 실시간 로그 SSE — authMiddleware 가 cookie(auth_token)/Bearer 로 인증.
  // 쿼리 토큰은 access_logs/브라우저 히스토리/프록시 로그에 누출되어 폐기.
  // 클라이언트는 same-origin EventSource 로 호출 → httpOnly auth_token 쿠키 자동 송신.
  router.get('/api/admin/logs/stream', (req, res) => {
    if (!req.user?.is_admin) return res.status(403).end();

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

  // ✅ 임시 비밀번호 발급 — crypto.randomBytes 사용 (Math.random 폐기)
  router.post('/api/admin/reset-password', async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { request_id } = req.body;
    const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(request_id);
    if (!request) return res.status(404).json({ error: '요청을 찾을 수 없습니다.' });
    const crypto = await import('crypto');
    const raw = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
    const tempPassword = raw + 'A1!';
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

  // SSRF 가드: scheme 제한 + private/loopback/metadata 호스트 차단
  // (cloud metadata 169.254.169.254, 10.x, 172.16-31.x, 192.168.x, 127.x, ::1, localhost 등)
  function isSsrfBlocked(urlString) {
    let u;
    try { u = new URL(urlString); } catch { return '잘못된 URL'; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'http(s) 만 허용';
    const host = u.hostname.toLowerCase();
    if (!host) return 'host 없음';
    // 호스트네임 기반 차단
    const blockedNames = ['localhost', 'localhost.localdomain', 'ip6-localhost', 'metadata.google.internal'];
    if (blockedNames.includes(host)) return 'private/loopback host';
    // IPv4 리터럴 검사
    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (m) {
      const [a, b] = [parseInt(m[1]), parseInt(m[2])];
      if (a === 10) return 'private network';
      if (a === 127) return 'loopback';
      if (a === 169 && b === 254) return 'link-local / metadata';
      if (a === 172 && b >= 16 && b <= 31) return 'private network';
      if (a === 192 && b === 168) return 'private network';
      if (a === 0) return 'reserved';
      if (a >= 224) return 'multicast/reserved';
    }
    // IPv6 리터럴 (간이): :: / fc / fd / fe80 prefix
    if (host.includes(':')) {
      const v6 = host.replace(/^\[|\]$/g, '').toLowerCase();
      if (v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80:') || v6.startsWith('::ffff:127.')) return 'IPv6 private/loopback';
    }
    return null;
  }

  // ✅ RSS 수집 테스트
  router.get('/api/admin/rss/test', async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const sources = db.prepare('SELECT * FROM rss_sources WHERE enabled = 1').all();
    const results = await Promise.allSettled(sources.map(async (s) => {
      const blocked = isSsrfBlocked(s.url);
      if (blocked) return { name: s.name, url: s.url, success: false, error: `차단된 호스트 (${blocked})` };
      try {
        const response = await fetch(s.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*'
          },
          redirect: 'manual', // 리다이렉트로 SSRF 우회 차단 (개별 검증 필요 시 추후 확장)
          signal: AbortSignal.timeout(12000)
        });
        if (response.status >= 300 && response.status < 400) {
          return { name: s.name, url: s.url, success: false, error: `redirect ${response.status} 차단` };
        }
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
      const files = fs.existsSync(errorLogDir)
        ? fs.readdirSync(errorLogDir).filter(f => f.endsWith('.jsonl')).sort().reverse()
        : [];
      // ✅ ALL이면 파일 읽지 않고 바로 반환 (블로킹 방지)
      if (!type || type === 'ALL') {
        const dates = files.map(f => f.replace('.jsonl', ''));
        return res.json({ ok: true, dates });
      }
      // ✅ type 필터 시 최근 30개만 체크 (무한 블로킹 방지)
      const dates = files.slice(0, 30).map(f => f.replace('.jsonl', '')).filter(date => {
        try {
          const content = fs.readFileSync(path.join(errorLogDir, `${date}.jsonl`), 'utf8');
          return content.split('\n').filter(Boolean).some(line => {
            try { return JSON.parse(line).event_type?.startsWith(type); } catch { return false; }
          });
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

  // 관리자 등록 — superadmin 만
  router.post('/api/admin/admins', requireSuperadmin, (req, res) => {
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
    logger.warn('ADMIN_CREATED', { actorId: req.user.id, createdUsername: username });
    return res.json({ ok: true, id: result.lastInsertRowid, user_id: userResult.lastInsertRowid });
  });

  // 관리자 수정 — superadmin 만 + 본인 비번 변경 시 current_password 검증.
  // 다른 admin 의 password 직접 변경은 별도 superadmin-reset 엔드포인트로 분리.
  router.put('/api/admin/admins/:id', requireSuperadmin, (req, res) => {
    const { email, role_id, is_active, password, current_password } = req.body;
    const targetId = parseInt(req.params.id);
    if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'invalid id' });
    const admin = db.prepare('SELECT * FROM admins WHERE id=?').get(targetId);
    if (!admin) return res.status(404).json({ error: '관리자 없음' });

    if (password) {
      // 본인 계정만 직접 비번 변경 허용. 그 외 superadmin 도 reset 엔드포인트 거쳐야 함 (감사 로그 남김).
      if (targetId !== req.user.id) {
        return res.status(403).json({ error: '다른 관리자의 비번은 reset 엔드포인트로 변경하세요.' });
      }
      // 본인 비번 변경: current_password 검증 필수
      if (!current_password || !bcrypt.compareSync(current_password, admin.password_hash)) {
        return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
      }
      db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password, 12), targetId);
      logger.warn('ADMIN_PASSWORD_CHANGED_SELF', { adminId: targetId });
    }

    // role_id / is_active 변경: 본인이 본인을 강등하거나 비활성화하지 못하도록 차단
    let nextRoleId = role_id ?? admin.role_id;
    let nextActive = is_active ?? admin.is_active;
    if (targetId === req.user.id && (Number(nextActive) === 0 || nextRoleId !== admin.role_id)) {
      return res.status(400).json({ error: '본인의 role/활성 상태는 변경할 수 없습니다.' });
    }

    db.prepare('UPDATE admins SET email=?, role_id=?, is_active=? WHERE id=?')
      .run(email ?? admin.email, nextRoleId, nextActive, targetId);
    return res.json({ ok: true });
  });

  // 다른 관리자의 비번 강제 리셋 — superadmin 전용 (감사 로그 + 임시비번 발급)
  router.post('/api/admin/admins/:id/reset-password', requireSuperadmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'invalid id' });
    if (targetId === req.user.id) return res.status(400).json({ error: '본인 비번은 일반 변경 절차로 변경하세요.' });
    const admin = db.prepare('SELECT id, username FROM admins WHERE id=?').get(targetId);
    if (!admin) return res.status(404).json({ error: '관리자 없음' });
    const crypto = await import('crypto');
    const raw = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
    const tempPassword = raw + 'A1!';
    db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(tempPassword, 12), targetId);
    logger.warn('ADMIN_PASSWORD_RESET_BY_SUPER', { actorId: req.user.id, targetId, targetUsername: admin.username });
    return res.json({ ok: true, username: admin.username, temp_password: tempPassword });
  });

  // 관리자 삭제 — superadmin 만, 본인 계정 차단, 마지막 superadmin 보호
  router.delete('/api/admin/admins/:id', requireSuperadmin, (req, res) => {
    const targetId = parseInt(req.params.id);
    if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'invalid id' });
    if (targetId === req.user.id) return res.status(400).json({ error: '본인 계정은 삭제할 수 없습니다.' });
    const admin = db.prepare('SELECT a.id, a.username, r.role_name FROM admins a LEFT JOIN admin_roles r ON a.role_id=r.id WHERE a.id=?').get(targetId);
    if (!admin) return res.status(404).json({ error: '관리자 없음' });
    if (admin.role_name === 'superadmin') {
      const remaining = db.prepare(`SELECT COUNT(*) AS c FROM admins a JOIN admin_roles r ON a.role_id=r.id WHERE r.role_name='superadmin' AND a.is_active=1`).get();
      if (remaining.c <= 1) return res.status(400).json({ error: '마지막 슈퍼관리자는 삭제할 수 없습니다.' });
    }
    db.prepare('DELETE FROM admins WHERE id=?').run(targetId);
    logger.warn('ADMIN_DELETED', { actorId: req.user.id, deletedId: targetId, deletedUsername: admin.username });
    return res.json({ ok: true });
  });

  // 관리자 롤 목록
  router.get('/api/admin/roles', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const roles = db.prepare('SELECT * FROM admin_roles ORDER BY id').all();
    return res.json({ roles });
  });

  // 관리자 롤 추가 — superadmin 만
  router.post('/api/admin/roles', requireSuperadmin, (req, res) => {
    const { role_name, description } = req.body;
    if (!role_name) return res.status(400).json({ error: 'role_name 필수' });
    try {
      const result = db.prepare('INSERT INTO admin_roles (role_name, description) VALUES (?,?)').run(role_name, description || '');
      return res.json({ ok: true, id: result.lastInsertRowid });
    } catch(e) {
      return res.status(400).json({ error: '이미 존재하는 롤입니다.' });
    }
  });

  // 관리자 롤 삭제 — superadmin 만, 'superadmin' role 자체는 삭제 차단
  router.delete('/api/admin/roles/:id', requireSuperadmin, (req, res) => {
    const role = db.prepare('SELECT role_name FROM admin_roles WHERE id=?').get(req.params.id);
    if (!role) return res.status(404).json({ error: '롤 없음' });
    if (role.role_name === 'superadmin') return res.status(400).json({ error: '슈퍼관리자 롤은 삭제할 수 없습니다.' });
    const used = db.prepare('SELECT id FROM admins WHERE role_id=?').get(req.params.id);
    if (used) return res.status(400).json({ error: '사용 중인 롤은 삭제할 수 없습니다.' });
    db.prepare('DELETE FROM admin_roles WHERE id=?').run(req.params.id);
    return res.json({ ok: true });
  });

  // ===== 스케줄러 관리 API =====

  // 스케줄러 목록 조회
  router.get('/api/admin/schedulers', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const schedulers = db.prepare('SELECT * FROM schedulers ORDER BY id').all();
    res.json({ ok: true, schedulers });
  });

  // 스케줄러 활성/비활성
  router.put('/api/admin/schedulers/:key', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { enabled, interval_sec } = req.body;
    const sch = db.prepare('SELECT id FROM schedulers WHERE key=?').get(req.params.key);
    if (!sch) return res.status(404).json({ error: '스케줄러 없음' });
    const updates = [];
    const params = [];
    if (enabled !== undefined) { updates.push('enabled=?'); params.push(enabled ? 1 : 0); }
    if (interval_sec !== undefined) { updates.push('interval_sec=?'); params.push(parseInt(interval_sec)); }
    if (!updates.length) return res.status(400).json({ error: '변경 항목 없음' });
    params.push(req.params.key);
    db.prepare(`UPDATE schedulers SET ${updates.join(',')} WHERE key=?`).run(...params);
    res.json({ ok: true });
  });

  // 스케줄러 ON/OFF
  router.patch('/api/admin/schedulers/:key/toggle', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { enabled } = req.body;
    db.prepare('UPDATE schedulers SET enabled=? WHERE key=?').run(enabled ? 1 : 0, req.params.key);
    res.json({ ok: true });
  });

  // 스케줄러 주기 변경
  router.patch('/api/admin/schedulers/:key/interval', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { interval_sec } = req.body;
    if (!interval_sec || interval_sec < 10) return res.status(400).json({ error: '최소 10초 이상' });
    db.prepare('UPDATE schedulers SET interval_sec=? WHERE key=?').run(interval_sec, req.params.key);
    res.json({ ok: true });
  });

  // 스케줄러 즉시 실행
  router.post('/api/admin/schedulers/:key/run', async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    // 즉시 실행은 서버 측에서 함수 호출 불가 (front.js에 있으므로)
    // DB 상태만 업데이트
    db.prepare('UPDATE schedulers SET last_run=CURRENT_TIMESTAMP, run_count=run_count+1 WHERE key=?').run(req.params.key);
    res.json({ ok: true, message: '다음 주기에 실행됩니다.' });
  });

  // ===== 메뉴 관리 API =====

  // 메뉴 전체 조회 (관리자용 - disabled 포함)
  router.get('/api/admin/menus', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const menus = db.prepare('SELECT * FROM menus ORDER BY parent_id ASC, sort_order ASC').all();
    res.json({ ok: true, menus });
  });

  // 메뉴 추가
  router.post('/api/admin/menus', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { name, icon = '', parent_id = null, sort_order = 0, tab_key = '', sub_key = null, enabled = 1 } = req.body;
    if (!name) return res.status(400).json({ error: 'name 필수' });
    const result = db.prepare('INSERT INTO menus (name, icon, parent_id, sort_order, tab_key, sub_key, enabled) VALUES (?,?,?,?,?,?,?)')
      .run(name, icon, parent_id, sort_order, tab_key, sub_key, enabled);
    res.json({ ok: true, id: result.lastInsertRowid });
  });

  // 메뉴 수정
  router.put('/api/admin/menus/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { name, icon, parent_id, sort_order, tab_key, sub_key, enabled } = req.body;
    const menu = db.prepare('SELECT * FROM menus WHERE id=?').get(req.params.id);
    if (!menu) return res.status(404).json({ error: '메뉴 없음' });
    db.prepare('UPDATE menus SET name=?,icon=?,parent_id=?,sort_order=?,tab_key=?,sub_key=?,enabled=? WHERE id=?')
      .run(name??menu.name, icon??menu.icon, parent_id??menu.parent_id, sort_order??menu.sort_order, tab_key??menu.tab_key, sub_key??menu.sub_key, enabled??menu.enabled, req.params.id);
    res.json({ ok: true });
  });

  // 메뉴 삭제
  router.delete('/api/admin/menus/:id', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    // 자식 메뉴도 같이 삭제
    db.prepare('DELETE FROM menus WHERE parent_id=?').run(req.params.id);
    db.prepare('DELETE FROM menus WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  });

  // 메뉴 순서 변경 (드래그 앤 드롭용)
  router.post('/api/admin/menus/reorder', (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '권한 없음' });
    const { orders } = req.body; // [{ id, sort_order }]
    const stmt = db.prepare('UPDATE menus SET sort_order=? WHERE id=?');
    const reorder = db.transaction(() => orders.forEach(o => stmt.run(o.sort_order, o.id)));
    reorder();
    res.json({ ok: true });
  });

  return router;
}
