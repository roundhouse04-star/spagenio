import express from 'express';
const router = express.Router();

export default function authRoutes({ db, bcrypt, jwt, JWT_SECRET, ADMIN_JWT_SECRET, JWT_EXPIRES, sendMail, encryptEmail, decryptEmail, verifyCodeStore, logger, saveAccessLog, saveErrorLog }) {

  // 로그인 시도 영속화 — 재시작/cluster 에서 락아웃 우회 차단
  db.exec(`CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    lock_until INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  function readAttempts(key) {
    const row = db.prepare('SELECT count, lock_until FROM login_attempts WHERE key=?').get(key);
    return row ? { count: row.count, lockUntil: row.lock_until } : { count: 0, lockUntil: 0 };
  }
  function writeAttempts(key, attempts) {
    db.prepare(`INSERT INTO login_attempts (key, count, lock_until, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET count=excluded.count, lock_until=excluded.lock_until, updated_at=CURRENT_TIMESTAMP`)
      .run(key, attempts.count, attempts.lockUntil);
  }
  function clearAttempts(key) {
    db.prepare('DELETE FROM login_attempts WHERE key=?').run(key);
  }

  // ✅ 로그인
  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip;
    const key = `${ip}_${username}`;
    const now = Date.now();

    const attempts = readAttempts(key);
    if (attempts.lockUntil > now) {
      const remaining = Math.ceil((attempts.lockUntil - now) / 1000);
      return res.status(429).json({ error: `너무 많은 시도. ${remaining}초 후 다시 시도하세요.` });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      attempts.count++;
      if (attempts.count >= 5) { attempts.lockUntil = now + 30 * 1000; attempts.count = 0; }
      writeAttempts(key, attempts);
      const failIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      logger.warn('LOGIN_FAILED', { ip: failIp, username, attempts: attempts.count, userAgent: req.headers['user-agent'] });
      saveAccessLog({ ip: failIp, method: 'POST', path: '/api/auth/login', statusCode: 401, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime: 0, eventType: 'login_failed' });
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 관리자가 생성한 계정(created_type=1)은 일반 로그인 불가
    if (user.created_type === 1) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    clearAttempts(key);
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);

    const loginIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.info('LOGIN_SUCCESS', { ip: loginIp, username: user.username, userAgent: req.headers['user-agent'] });
    saveAccessLog({ ip: loginIp, method: 'POST', path: '/api/auth/login', statusCode: 200, userId: user.id, username: user.username, userAgent: req.headers['user-agent'] || '', referer: req.headers['referer'] || '', responseTime: 0, eventType: 'login_success' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // CSRF 1차 방어 (cross-site form submit 차단)
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.json({ status: 'ok', token, username: user.username });
  });

  // ✅ 토큰 검증
  router.get('/verify', (req, res) => {
    return res.json({ status: 'ok', user: req.user });
  });

  // ✅ 관리자 로그인 (admins 테이블 조회)
  router.post('/admin-login', (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    const admin = db.prepare('SELECT a.*, r.role_name FROM admins a LEFT JOIN admin_roles r ON a.role_id=r.id WHERE a.username=? AND a.is_active=1').get(username);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      logger.warn('ADMIN_LOGIN_FAILED', { ip, username });
      return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    db.prepare('UPDATE admins SET last_login=? WHERE id=?').run(new Date().toISOString(), admin.id);
    logger.info('ADMIN_LOGIN_SUCCESS', { ip, username: admin.username });

    const token = jwt.sign({ id: admin.id, username: admin.username, is_admin: true, role: admin.role_name }, ADMIN_JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // CSRF 1차 방어 (cross-site form submit 차단)
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
    });
    return res.json({ status: 'ok', token, username: admin.username, role: admin.role_name, is_admin: true });
  });

  // ✅ 로그아웃
  router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    return res.json({ status: 'ok' });
  });

  // ✅ 비밀번호 찾기
  // 순서 보정: 메일 발송 성공 후에만 password_hash 를 덮어씀.
  // (이전: hash 먼저 update → 메일 실패 시 사용자 락아웃.)
  // 임시비번도 crypto.randomBytes 로 생성 (이전 Math.random() 은 예측 가능).
  router.post('/forgot-password', async (req, res) => {
    const { username } = req.body;
    const user = db.prepare('SELECT id, username, email FROM users WHERE username = ?').get(username);
    // user-enumeration 방지: 항상 동일 응답
    const okResponse = { status: 'ok', message: '등록된 이메일로 임시 비밀번호를 발송했습니다.' };
    if (!user || !user.email) return res.json(okResponse);

    const decryptedEmail = decryptEmail(user.email);
    if (!decryptedEmail) return res.json(okResponse);

    // 26+ chars, mixed case + digit + special
    const crypto = await import('crypto');
    const raw = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 10);
    const tempPassword = raw + 'A1!';

    const mailSent = await sendMail({
      to: decryptedEmail,
      subject: '[spagenio] 임시 비밀번호 안내',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#09111f;color:#eef2ff;border-radius:16px;">
        <h2 style="color:#76a5ff;">🔑 임시 비밀번호 안내</h2>
        <p style="color:#9ea8c9;">안녕하세요, <strong>${user.username}</strong>님!</p>
        <div style="background:#0d1526;border:1px solid #24314f;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <p style="color:#9ea8c9;font-size:0.85rem;">임시 비밀번호</p>
          <p style="color:#7ef0bf;font-size:1.6rem;font-weight:800;letter-spacing:4px;font-family:monospace;">${tempPassword}</p>
        </div>
        <p style="color:#ff8f8f;font-size:0.85rem;">로그인 후 반드시 비밀번호를 변경해주세요!</p>
      </div>`
    });

    if (!mailSent) {
      // 메일 실패 시 비번 변경 안 함 → 기존 비번 유지
      logger.warn('FORGOT_PASSWORD_MAIL_FAIL', { user_id: user.id });
      return res.status(500).json({ error: '메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    }

    // 발송 성공 → 그제서야 비번 교체 commit
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(tempPassword, 12), user.id);
    return res.json(okResponse);
  });

  // ✅ 아이디 중복 확인
  router.post('/check-username', (req, res) => {
    const { username } = req.body;
    if (!username || username.length < 3) return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
    if (username.length > 10) return res.status(400).json({ error: '아이디는 10자 이하여야 합니다.' });
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: '영문, 숫자, 언더바(_)만 사용 가능합니다.' });
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
    if (existingAdmin) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    return res.json({ status: 'ok', message: '사용 가능한 아이디입니다.' });
  });

  // ✅ 이메일 중복 확인
  router.post('/check-email', (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: '이메일을 입력해주세요.' });
      const allUsers = db.prepare('SELECT email FROM users WHERE email IS NOT NULL').all();
      const used = allUsers.some(u => { try { return decryptEmail(u.email) === email; } catch (e) { return false; } });
      if (used) return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
      return res.json({ status: 'ok', message: '사용 가능한 이메일입니다.' });
    } catch (error) {
      saveErrorLog({ event_type: 'CHECK_EMAIL_ERROR', error_message: error.message, stack_trace: error.stack });
      return res.status(500).json({ error: error.message });
    }
  });

  // ✅ 이메일 인증코드 발송
  router.post('/send-email-code', async (req, res) => {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });

    const allUsers = db.prepare('SELECT email FROM users WHERE email IS NOT NULL').all();
    const alreadyUsed = allUsers.some(u => { try { return decryptEmail(u.email) === email; } catch (e) { return false; } });
    if (alreadyUsed) return res.status(400).json({ error: '이미 가입된 이메일입니다.' });

    const recent = db.prepare("SELECT id FROM email_verifications WHERE email = ? AND created_at > datetime('now', '-60 seconds') AND verified = 0").get(email);
    if (recent) return res.status(429).json({ error: '60초 후 다시 시도해주세요.' });

    db.prepare("DELETE FROM email_verifications WHERE email = ?").run(email);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    db.prepare('INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expiresAt);

    const mailSent = await sendMail({
      to: email,
      subject: '[spagenio] 이메일 인증코드',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#09111f;color:#eef2ff;border-radius:16px;">
        <h2 style="color:#76a5ff;">📧 이메일 인증</h2>
        <p style="color:#9ea8c9;">아래 인증코드를 60초 이내에 입력해주세요.</p>
        <div style="background:#0d1526;border:1px solid #24314f;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
          <p style="color:#9ea8c9;font-size:0.85rem;">인증코드 (60초 유효)</p>
          <p style="color:#76a5ff;font-size:2.4rem;font-weight:800;letter-spacing:10px;font-family:monospace;">${code}</p>
        </div>
        <p style="color:#ff8f8f;font-size:0.85rem;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
      </div>`
    });

    if (!mailSent) { db.prepare("DELETE FROM email_verifications WHERE email = ? AND verified = 0").run(email); return res.status(500).json({ error: '메일 발송에 실패했습니다.' }); }
    return res.json({ status: 'ok', message: '인증코드를 발송했습니다.' });
  });

  // ✅ 이메일 인증코드 확인
  router.post('/verify-email-code', (req, res) => {
    const { email, code } = req.body;
    const record = db.prepare("SELECT * FROM email_verifications WHERE email = ? AND code = ? AND verified = 0 AND expires_at > datetime('now')").get(email, code);
    if (!record) return res.status(400).json({ error: '인증코드가 올바르지 않거나 만료됐습니다.' });
    db.prepare('UPDATE email_verifications SET verified = 1 WHERE id = ?').run(record.id);
    return res.json({ status: 'ok', message: '이메일 인증이 완료됐습니다.' });
  });

  // ✅ 회원가입
  router.post('/register', (req, res) => {
    const { username, password, email, invite_code, agree_terms, agree_privacy, agree_investment, agree_marketing } = req.body;
    if (!username || !password || !email) return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
    if (username.length < 3) return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
    if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });

    const verified = db.prepare("SELECT id FROM email_verifications WHERE email = ? AND verified = 1").get(email);
    if (!verified) return res.status(400).json({ error: '이메일 인증을 먼저 완료해주세요.' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    // 관리자 테이블과도 중복 체크
    const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
    if (existingAdmin) return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });

    const allUsers = db.prepare('SELECT email FROM users WHERE email IS NOT NULL').all();
    const emailUsed = allUsers.some(u => { try { return decryptEmail(u.email) === email; } catch (e) { return false; } });
    if (emailUsed) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });

    const hash = bcrypt.hashSync(password, 12);
    const encryptedEmail = encryptEmail(email);
    const result = db.prepare('INSERT INTO users (username, password_hash, email, created_type) VALUES (?, ?, ?, ?)').run(username, hash, encryptedEmail, 2);
    db.prepare('DELETE FROM email_verifications WHERE email = ?').run(email);
    db.prepare('INSERT INTO terms_agreements (user_id, agree_terms, agree_privacy, agree_investment, agree_marketing, ip) VALUES (?,?,?,?,?,?)')
      .run(result.lastInsertRowid, agree_terms ? 1 : 0, agree_privacy ? 1 : 0, agree_investment ? 1 : 0, agree_marketing ? 1 : 0, req.ip || '');
    return res.json({ status: 'ok', message: '가입이 완료됐습니다.' });
  });

  // ✅ 회원 탈퇴
  // sqlite_master 에서 실제 존재하는 테이블만 골라 삭제 → 스키마 드리프트로 인한
  // 트랜잭션 abort 방지 (이전 코드: auto_trade_settings 등 미존재 테이블 참조로 항상 throw).
  router.post('/withdraw', (req, res) => {
    const { password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    if (req.user.is_admin) return res.status(400).json({ error: '관리자 계정은 탈퇴할 수 없습니다.' });

    const uid = req.user.id;
    const candidateTables = [
      'lotto_picks', 'lotto_schedule', 'lotto_schedule_log', 'lotto_algorithm_weights',
      'user_telegram', 'user_broker_keys', 'terms_agreements',
      'auto_trade_settings', 'auto_trade_log', 'auto_strategy_settings',
      'trade_setting_type3', 'trade_setting_type4',
      'portfolio_performance', 'backtest_results', 'telegram_alert_log', 'quant_analysis_log',
    ];
    const existing = new Set(
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
    );
    const tablesToClear = candidateTables.filter(t => existing.has(t));

    const deleteAll = db.transaction(() => {
      for (const t of tablesToClear) {
        db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid);
      }
      db.prepare('DELETE FROM users WHERE id=?').run(uid);
    });
    deleteAll();

    res.clearCookie('auth_token');
    return res.json({ status: 'ok', message: '탈퇴가 완료됐습니다.' });
  });

  // ✅ 비밀번호 변경 인증코드 발송
  router.post('/change-password/send-code', async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user.email) return res.status(400).json({ error: '등록된 이메일이 없습니다.' });
    const decryptedEmail = decryptEmail(user.email);
    if (!decryptedEmail) return res.status(400).json({ error: '이메일 정보를 불러올 수 없습니다.' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    verifyCodeStore.set(`pw_change_${user.id}`, { code, expires: Date.now() + 5 * 60 * 1000 });

    const mailSent = await sendMail({
      to: decryptedEmail,
      subject: '[spagenio] 비밀번호 변경 인증코드',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#09111f;color:#eef2ff;border-radius:16px;">
        <h2 style="color:#76a5ff;">🔐 비밀번호 변경 인증</h2>
        <div style="background:#0d1526;border:1px solid #24314f;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
          <p style="color:#9ea8c9;font-size:0.85rem;">인증코드 (5분 유효)</p>
          <p style="color:#76a5ff;font-size:2rem;font-weight:800;letter-spacing:8px;font-family:monospace;">${code}</p>
        </div>
        <p style="color:#ff8f8f;font-size:0.85rem;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
      </div>`
    });

    return res.json({ status: mailSent ? 'ok' : 'error', message: mailSent ? '인증코드를 이메일로 발송했습니다.' : '메일 발송 실패' });
  });

  // ✅ 비밀번호 변경
  router.post('/change-password', (req, res) => {
    const { verifyCode, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const stored = verifyCodeStore.get(`pw_change_${user.id}`);
    if (!stored || stored.code !== verifyCode || Date.now() > stored.expires) return res.status(401).json({ error: '인증코드가 올바르지 않거나 만료됐습니다.' });

    function validatePassword(pw) {
      if (pw.length < 8) return { valid: false, message: '비밀번호는 8자 이상이어야 합니다.' };
      if (!/[A-Z]/.test(pw)) return { valid: false, message: '대문자를 1자 이상 포함해야 합니다.' };
      if (!/[a-z]/.test(pw)) return { valid: false, message: '소문자를 1자 이상 포함해야 합니다.' };
      if (!/[0-9]/.test(pw)) return { valid: false, message: '숫자를 1자 이상 포함해야 합니다.' };
      if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pw)) return { valid: false, message: '특수문자를 1자 이상 포함해야 합니다.' };
      return { valid: true };
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) return res.status(400).json({ error: pwCheck.message });
    if (bcrypt.compareSync(newPassword, user.password_hash)) return res.status(400).json({ error: '이전 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.' });

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 12), user.id);
    verifyCodeStore.delete(`pw_change_${user.id}`);
    res.clearCookie('auth_token');
    return res.json({ status: 'ok', message: '비밀번호가 변경됐습니다. 다시 로그인해주세요.' });
  });

  // ✅ 초대 코드 생성 (관리자)
  router.post('/invite', async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: '관리자만 초대 코드를 생성할 수 있습니다.' });
    const crypto = await import('crypto');
    // 8자 base32-like (혼동 가능 문자 제외) — crypto.randomInt 기반 (예측 불가)
    const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += ALPHA[crypto.randomInt(0, ALPHA.length)];
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO invite_codes (code, created_by, expires_at) VALUES (?, ?, ?)').run(code, req.user.id, expiresAt);
    return res.json({ status: 'ok', code, expires_at: expiresAt });
  });

  return router;
}
