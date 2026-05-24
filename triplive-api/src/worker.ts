/**
 * Triplive 1.2 안전 — Cloudflare Workers 엔트리
 *
 * 라우트:
 *   POST /push/register     디바이스 토큰 + 관심 국가 등록 (UPSERT)
 *   DELETE /push/register   토큰 삭제 (사용자가 알림 끄기)
 *   GET  /advisories        전체 advisory 캐시 반환 (앱이 직접 가져갈 수 있게)
 *   GET  /advisories/:cc    국가별 advisory
 *   GET  /alerts/:cc        국가별 최근 안전공지 (시간순)
 *   GET  /health            상태 + 마지막 cron 결과
 *
 * Cron (every 15 min):
 *   - 외교부 여행경보 fetch → advisories UPSERT
 *   - 외교부 안전공지 fetch → 신규는 safety_alerts INSERT
 *   - 디바이스-국가 매칭 → Expo Push 전송 (notified=0 인 것만)
 *
 * Free tier 최적화:
 *   - 외교부 호출 빈도 15분 = 하루 96회 (무료 한도 안)
 *   - Expo Push: 배치 100개씩 (Expo 권장)
 */

interface Env {
  DB: D1Database;
  MOFA_SERVICE_KEY: string;
  MOFA_BASE_URL: string;
  EXPO_PUSH_URL: string;
  ENVIRONMENT: string;
}

// ─── 유틸 ──────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      ...init.headers,
    },
  });
}

function corsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
  };
}

function badRequest(message: string): Response {
  return jsonResponse({ error: 'bad_request', message }, { status: 400 });
}

function serverError(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[server]', message);
  return jsonResponse({ error: 'server_error', message }, { status: 500 });
}

// ─── /push/register ────────────────────────────────────────────────────

interface RegisterBody {
  expoToken: string;
  platform: 'ios' | 'android';
  appVersion?: string;
  locale?: string;
  countries?: { code: string; status: 'planning' | 'ongoing' }[];
}

async function handleRegister(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as RegisterBody | null;
  if (!body?.expoToken || !body.platform) {
    return badRequest('expoToken + platform required');
  }
  if (!body.expoToken.startsWith('ExponentPushToken[') && !body.expoToken.startsWith('ExpoPushToken[')) {
    return badRequest('invalid expo token format');
  }

  const now = Date.now();

  // UPSERT devices
  await env.DB.prepare(
    `INSERT INTO devices (expo_token, platform, app_version, locale, push_enabled, created_at, updated_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5, ?5)
     ON CONFLICT(expo_token) DO UPDATE SET
       platform = excluded.platform,
       app_version = excluded.app_version,
       locale = excluded.locale,
       updated_at = excluded.updated_at,
       last_seen_at = excluded.last_seen_at`
  )
    .bind(body.expoToken, body.platform, body.appVersion ?? null, body.locale ?? 'ko', now)
    .run();

  // 국가 매핑: 전체 삭제 후 새로 INSERT (간단한 동기화)
  if (body.countries) {
    await env.DB.prepare(`DELETE FROM device_countries WHERE expo_token = ?1`)
      .bind(body.expoToken)
      .run();

    const valid = body.countries
      .filter((c) => c.code && /^[A-Z]{2}$/.test(c.code) && (c.status === 'planning' || c.status === 'ongoing'))
      .slice(0, 50); // 안전상 50개 제한

    if (valid.length > 0) {
      const stmt = env.DB.prepare(
        `INSERT INTO device_countries (expo_token, country_code, trip_status, added_at) VALUES (?1, ?2, ?3, ?4)`
      );
      const batch = valid.map((c) => stmt.bind(body.expoToken, c.code, c.status, now));
      await env.DB.batch(batch);
    }
  }

  return jsonResponse({ ok: true, countries: body.countries?.length ?? 0 });
}

async function handleUnregister(req: Request, env: Env): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { expoToken?: string } | null;
  if (!body?.expoToken) return badRequest('expoToken required');
  await env.DB.prepare(`UPDATE devices SET push_enabled = 0, updated_at = ?2 WHERE expo_token = ?1`)
    .bind(body.expoToken, Date.now())
    .run();
  return jsonResponse({ ok: true });
}

// ─── /advisories ────────────────────────────────────────────────────────

async function handleAdvisoriesList(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT country_code, country_name, level, message, updated_at
     FROM advisories
     ORDER BY level DESC, country_name ASC`
  ).all();
  return jsonResponse({ advisories: results, count: results.length });
}

async function handleAdvisoryByCountry(env: Env, code: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT country_code, country_name, level, message, updated_at
     FROM advisories WHERE country_code = ?1`
  )
    .bind(code.toUpperCase())
    .first();
  if (!row) return jsonResponse({ advisory: null }, { status: 404 });
  return jsonResponse({ advisory: row });
}

// ─── /alerts ────────────────────────────────────────────────────────────

async function handleAlertsByCountry(env: Env, code: string): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, country_code, title, body, category, severity, published_at
     FROM safety_alerts
     WHERE country_code = ?1
     ORDER BY published_at DESC
     LIMIT 50`
  )
    .bind(code.toUpperCase())
    .all();
  return jsonResponse({ alerts: results, count: results.length });
}

async function handleAlertsAll(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, country_code, title, body, category, severity, published_at
     FROM safety_alerts
     ORDER BY published_at DESC
     LIMIT 50`
  ).all();
  return jsonResponse({ alerts: results, count: results.length });
}

// ─── /health ────────────────────────────────────────────────────────────

async function handleHealth(env: Env): Promise<Response> {
  const advCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM advisories`).first<{ c: number }>();
  const alertCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM safety_alerts`).first<{ c: number }>();
  const deviceCount = await env.DB.prepare(`SELECT COUNT(*) as c FROM devices WHERE push_enabled = 1`).first<{ c: number }>();
  const lastCron = await env.DB.prepare(
    `SELECT job, status, details, started_at, finished_at FROM cron_log ORDER BY started_at DESC LIMIT 1`
  ).first();

  return jsonResponse({
    ok: true,
    environment: env.ENVIRONMENT,
    counts: {
      advisories: advCount?.c ?? 0,
      alerts: alertCount?.c ?? 0,
      devices: deviceCount?.c ?? 0,
    },
    lastCron,
    timestamp: Date.now(),
  });
}

// ─── 외교부 폴링 + Expo Push (Cron) ─────────────────────────────────────

interface MofaAdvisoryItem {
  country_iso_alp2?: string;
  country_nm?: string;
  alarm_lvl?: string;
  travel_warn?: string;
  txt_origin_cn?: string;
  region_ty?: string; // '전체' | '일부'
  remark?: string;
}

interface CountryAggregate {
  code: string;
  name: string;
  baseLevel: number;
  baseLabel: string | null;
  message: string;
}

/**
 * 외교부는 region 별로 여러 row 를 보냄 (예: 태국은 lvl 1/2/3 row 3개).
 * 국가 단위로 집계하여 "기본 level + 위험 region 메시지" 형태로 변환.
 *
 * 알고리즘:
 *  1. region_ty='전체' row 있으면 그게 국가 기본 level (1순위)
 *  2. 없으면 remark 에 "제외 / 이외 / 외" 가 있는 광범위 row 가 기본 (태국 케이스)
 *  3. 둘 다 없으면 → 국가 기본 lvl 0 (안전) + 메시지에 위험 region 정보 (일본 케이스)
 */
function aggregateByCountry(items: MofaAdvisoryItem[]): CountryAggregate[] {
  const grouped = new Map<string, MofaAdvisoryItem[]>();
  for (const it of items) {
    if (!it.country_iso_alp2) continue;
    const code = it.country_iso_alp2.toUpperCase();
    const arr = grouped.get(code) ?? [];
    arr.push(it);
    grouped.set(code, arr);
  }

  const result: CountryAggregate[] = [];
  for (const [code, rows] of grouped) {
    const name = rows[0].country_nm ?? code;

    // 1순위: 전체 row
    const wholeRow = rows.find((r) => r.region_ty === '전체');
    if (wholeRow) {
      result.push({
        code,
        name,
        baseLevel: parseLevel(wholeRow.alarm_lvl),
        baseLabel: wholeRow.alarm_lvl ?? null,
        message: wholeRow.remark ?? '',
      });
      continue;
    }

    // 2순위: "제외/이외/외" 패턴 (사실상 "기본") row
    const broadRow = rows.find((r) => r.remark && /제외|이외|외\s*지역|및 외/.test(r.remark));
    if (broadRow) {
      // 같은 국가의 더 위험한 region 메시지 부착
      const dangerousRegions = rows
        .filter((r) => r !== broadRow && parseLevel(r.alarm_lvl) > parseLevel(broadRow.alarm_lvl))
        .map((r) => `[${levelLabel(parseLevel(r.alarm_lvl))}] ${r.remark ?? ''}`)
        .join(' · ');
      const base = parseLevel(broadRow.alarm_lvl);
      result.push({
        code,
        name,
        baseLevel: base,
        baseLabel: broadRow.alarm_lvl ?? null,
        message: dangerousRegions
          ? `${broadRow.remark}\n특별 위험 지역: ${dangerousRegions}`
          : broadRow.remark ?? '',
      });
      continue;
    }

    // 3순위: 일부 region 만 있고 기본 row 없음 → 국가 자체는 lvl 0, region 메시지만
    const partial = rows
      .map((r) => `[${levelLabel(parseLevel(r.alarm_lvl))}] ${r.remark ?? ''}`)
      .join(' · ');
    result.push({
      code,
      name,
      baseLevel: 0,
      baseLabel: '0',
      message: `일부 지역만 경보 — ${partial}`,
    });
  }
  return result;
}

async function pollMofaAdvisories(env: Env): Promise<{ fetched: number; updated: number }> {
  const url = `${env.MOFA_BASE_URL}/TravelAlarmService2/getTravelAlarmList2?serviceKey=${encodeURIComponent(
    env.MOFA_SERVICE_KEY
  )}&returnType=JSON&numOfRows=300&pageNo=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`mofa fetch failed: ${res.status}`);
  const json = (await res.json()) as any;
  const items: MofaAdvisoryItem[] = json?.response?.body?.items?.item ?? json?.data ?? [];

  const aggregated = aggregateByCountry(items);
  const now = Date.now();
  const stmt = env.DB.prepare(
    `INSERT INTO advisories (country_code, country_name, level, level_str, message, updated_at, fetched_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
     ON CONFLICT(country_code) DO UPDATE SET
       country_name = excluded.country_name,
       level = excluded.level,
       level_str = excluded.level_str,
       message = excluded.message,
       updated_at = CASE WHEN advisories.level != excluded.level THEN excluded.updated_at ELSE advisories.updated_at END,
       fetched_at = excluded.fetched_at`
  );

  const batch: D1PreparedStatement[] = aggregated.map((a) =>
    stmt.bind(a.code, a.name, a.baseLevel, a.baseLabel, a.message, now)
  );
  if (batch.length > 0) {
    await env.DB.batch(batch);
  }
  return { fetched: items.length, updated: aggregated.length };
}

function parseLevel(raw: string | undefined | null): number {
  if (!raw) return 0;
  const s = raw.toString();
  if (s.includes('4') || s.includes('금지') || s.includes('흑색')) return 4;
  if (s.includes('3') || s.includes('출국') || s.includes('적색')) return 3;
  if (s.includes('2') || s.includes('자제') || s.includes('황색')) return 2;
  if (s.includes('1') || s.includes('유의') || s.includes('남색')) return 1;
  return 0;
}

// 신규 advisory level 변경분에 대해 매칭 디바이스에게 푸시
async function pushAdvisoryChanges(env: Env, since: number): Promise<{ matched: number; sent: number }> {
  const { results: changed } = await env.DB.prepare(
    `SELECT country_code, country_name, level, message FROM advisories
     WHERE updated_at >= ?1 AND level >= 2
     ORDER BY level DESC`
  )
    .bind(since)
    .all<{ country_code: string; country_name: string; level: number; message: string | null }>();

  if (changed.length === 0) return { matched: 0, sent: 0 };

  let totalSent = 0;
  for (const adv of changed) {
    const { results: targets } = await env.DB.prepare(
      `SELECT d.expo_token, d.locale
       FROM device_countries dc
       JOIN devices d ON d.expo_token = dc.expo_token
       WHERE dc.country_code = ?1 AND d.push_enabled = 1`
    )
      .bind(adv.country_code)
      .all<{ expo_token: string; locale: string }>();

    if (targets.length === 0) continue;

    const messages = targets.map((t) => ({
      to: t.expo_token,
      title: `⚠️ ${adv.country_name} 여행경보 ${levelLabel(adv.level)}`,
      body: adv.message?.slice(0, 140) ?? '외교부 여행경보가 변경되었습니다.',
      data: { type: 'advisory', countryCode: adv.country_code, level: adv.level },
      sound: 'default',
      priority: 'high' as const,
    }));

    totalSent += await sendExpoPushBatch(env, messages, { advisoryCountry: adv.country_code });
  }
  return { matched: changed.length, sent: totalSent };
}

function levelLabel(level: number): string {
  return ['안전', '유의', '자제', '출국권고', '여행금지'][level] ?? '안전';
}

// Expo Push 전송 (100개씩 배치)
async function sendExpoPushBatch(
  env: Env,
  messages: any[],
  ctx: { alertId?: string; advisoryCountry?: string }
): Promise<number> {
  if (messages.length === 0) return 0;
  let sentOk = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(env.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
          'content-type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const json = (await res.json()) as any;
      const tickets: any[] = json?.data ?? [];
      const now = Date.now();
      const logStmt = env.DB.prepare(
        `INSERT INTO push_log (expo_token, alert_id, advisory_country, status, error_message, sent_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      );
      const logBatch: D1PreparedStatement[] = [];
      tickets.forEach((t, idx) => {
        const msg = chunk[idx];
        if (t.status === 'ok') {
          sentOk += 1;
          logBatch.push(logStmt.bind(msg.to, ctx.alertId ?? null, ctx.advisoryCountry ?? null, 'sent', null, now));
        } else {
          const err = t.details?.error ?? t.message ?? 'unknown';
          // DeviceNotRegistered → 해당 토큰 비활성화
          if (err === 'DeviceNotRegistered') {
            env.DB.prepare(`UPDATE devices SET push_enabled = 0 WHERE expo_token = ?1`)
              .bind(msg.to)
              .run()
              .catch(() => undefined);
          }
          logBatch.push(logStmt.bind(msg.to, ctx.alertId ?? null, ctx.advisoryCountry ?? null, 'error', err, now));
        }
      });
      if (logBatch.length > 0) await env.DB.batch(logBatch);
    } catch (err) {
      console.error('[push] batch failed:', err);
    }
  }
  return sentOk;
}

// ─── 외교부 국가·지역별 안전공지 (CountrySafetyService, 데이터셋 15076239) ────
// 사용자가 data.go.kr 에서 활용신청 완료. 자동승인이지만 키 권한 활성화에 시차 있음
// (TravelAlarmService2 도 처음 24h 걸림). 403 Forbidden = 활성화 대기 중.

const COUNTRY_NOTICE_URL = (key: string) =>
  `https://apis.data.go.kr/1262000/CountrySafetyService/getCountrySafetyList` +
  `?ServiceKey=${encodeURIComponent(key)}&returnType=JSON&numOfRows=50&pageNo=1&country_nm=ALL`;

// 한글 국가명 → ISO 2자리 (안전공지 제목 매칭용, 점진 확장)
const KO_COUNTRY_TO_ISO: Record<string, string> = {
  과테말라: 'GT', 일본: 'JP', 미국: 'US', 중국: 'CN', 태국: 'TH', 베트남: 'VN',
  필리핀: 'PH', 인도네시아: 'ID', 싱가포르: 'SG', 말레이시아: 'MY', 대만: 'TW',
  홍콩: 'HK', 영국: 'GB', 프랑스: 'FR', 독일: 'DE', 이탈리아: 'IT', 스페인: 'ES',
  네덜란드: 'NL', 호주: 'AU', 뉴질랜드: 'NZ', 캐나다: 'CA', 멕시코: 'MX',
  브라질: 'BR', 아르헨티나: 'AR', 칠레: 'CL', 페루: 'PE', 베네수엘라: 'VE',
  콜롬비아: 'CO', 우크라이나: 'UA', 러시아: 'RU', 튀르키예: 'TR', 터키: 'TR',
  이스라엘: 'IL', 시리아: 'SY', 이라크: 'IQ', 이란: 'IR', 사우디: 'SA',
  아랍에미리트: 'AE', UAE: 'AE', 이집트: 'EG', 모로코: 'MA', 남아공: 'ZA',
  케냐: 'KE', 인도: 'IN', 파키스탄: 'PK', 방글라데시: 'BD', 네팔: 'NP',
  미얀마: 'MM', 캄보디아: 'KH', 라오스: 'LA', 몽골: 'MN', 카자흐스탄: 'KZ',
  우즈베키스탄: 'UZ', 그리스: 'GR', 포르투갈: 'PT', 스위스: 'CH', 오스트리아: 'AT',
  체코: 'CZ', 헝가리: 'HU', 폴란드: 'PL', 스웨덴: 'SE', 노르웨이: 'NO',
  덴마크: 'DK', 핀란드: 'FI', 아일랜드: 'IE', 벨기에: 'BE', 룩셈부르크: 'LU',
  레바논: 'LB', 요르단: 'JO', 예멘: 'YE', 소말리아: 'SO', 리비아: 'LY',
  아프가니스탄: 'AF',
};

interface NoticeItem {
  id: string;            // 외교부 공지 ID (title_idx 또는 hash)
  title: string;
  body: string | null;
  category: string;      // '주의' / '긴급' / '일반' 등
  countryCode: string | null;
  publishedAt: number;
}

// 외교부 CountrySafetyService 응답 (포맷 추정 — 활성화 후 검증 필요)
interface MofaNoticeApiItem {
  title?: string;
  title_idx?: string | number;
  country_iso_alp2?: string;
  country_nm?: string;
  txt_origin_cn?: string;   // 본문 (HTML 가능성)
  written_dt?: string;      // YYYY-MM-DD HH:MM:SS
  txt_emergency_step?: string; // 긴급도
  url_alarm_inq?: string;   // 원문 URL
}

function parseNoticeDate(s: string | undefined): number {
  if (!s) return Date.now();
  // "2026-05-23 14:30:00" 또는 "20260523143000"
  const iso = s.length === 14
    ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`
    : s.replace(' ', 'T');
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Date.now();
}

function detectCountryFromTitle(title: string): string | null {
  for (const [ko, iso] of Object.entries(KO_COUNTRY_TO_ISO)) {
    if (title.includes(ko)) return iso;
  }
  return null;
}

async function fetchSafetyNotices(env: Env): Promise<NoticeItem[]> {
  const res = await fetch(COUNTRY_NOTICE_URL(env.MOFA_SERVICE_KEY));
  if (!res.ok) throw new Error(`CountrySafetyService HTTP ${res.status}`);
  const text = await res.text();
  // 활성화 대기 중이면 "Forbidden" 같은 plain text 가 옴
  if (!text.startsWith('{') && !text.startsWith('[')) {
    throw new Error(`CountrySafetyService not JSON: ${text.slice(0, 80)}`);
  }
  const json = JSON.parse(text) as any;
  const items: MofaNoticeApiItem[] = json?.response?.body?.items?.item ?? json?.data ?? [];

  return items
    .filter((it) => it.title && it.title.length > 5)
    .map((it) => {
      const isoFromField = it.country_iso_alp2?.toUpperCase();
      const iso = isoFromField || detectCountryFromTitle(it.title ?? '');
      const id = String(it.title_idx ?? `${it.country_iso_alp2 ?? ''}_${it.written_dt ?? ''}_${it.title?.slice(0, 30)}`);
      return {
        id,
        title: it.title ?? '',
        body: it.txt_origin_cn ?? null,
        category: it.txt_emergency_step ?? '일반',
        countryCode: iso ?? null,
        publishedAt: parseNoticeDate(it.written_dt),
      };
    });
}

async function pollSafetyNotices(env: Env): Promise<{ fetched: number; newCount: number }> {
  const notices = await fetchSafetyNotices(env);
  if (notices.length === 0) return { fetched: 0, newCount: 0 };

  const now = Date.now();
  const stmt = env.DB.prepare(
    `INSERT OR IGNORE INTO safety_alerts
     (id, country_code, title, body, category, severity, published_at, fetched_at, notified)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)`
  );
  const fetchedAt = Date.now();
  const batch = notices.map((n) =>
    stmt.bind(
      n.id,
      n.countryCode,
      n.title,
      n.body,
      n.category || '안전공지',
      n.category.includes('긴급') ? 'critical' : n.category.includes('주의') ? 'warning' : 'info',
      n.publishedAt,
      fetchedAt
    )
  );
  const results = await env.DB.batch(batch);
  // INSERT OR IGNORE 의 changes 합산 = 실제 신규 row 수
  const newCount = results.reduce((sum, r) => sum + ((r.meta as any)?.changes ?? 0), 0);
  return { fetched: notices.length, newCount };
}

async function pushNoticeAlerts(env: Env): Promise<{ matched: number; sent: number }> {
  // 아직 notified=0 이고 국가 매칭되는 공지만 처리
  const { results: pending } = await env.DB.prepare(
    `SELECT id, country_code, title, severity FROM safety_alerts
     WHERE notified = 0 AND country_code IS NOT NULL
     ORDER BY published_at DESC LIMIT 30`
  ).all<{ id: string; country_code: string; title: string; severity: string }>();

  if (pending.length === 0) return { matched: 0, sent: 0 };

  let totalSent = 0;
  for (const alert of pending) {
    const { results: targets } = await env.DB.prepare(
      `SELECT d.expo_token, d.locale
       FROM device_countries dc
       JOIN devices d ON d.expo_token = dc.expo_token
       WHERE dc.country_code = ?1 AND d.push_enabled = 1`
    )
      .bind(alert.country_code)
      .all<{ expo_token: string; locale: string }>();

    if (targets.length > 0) {
      const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : '📢';
      const messages = targets.map((t) => ({
        to: t.expo_token,
        title: `${emoji} ${alert.country_code} 안전공지`,
        body: alert.title.slice(0, 200),
        data: { type: 'safety_alert', alertId: alert.id, countryCode: alert.country_code },
        sound: 'default',
        priority: 'high' as const,
      }));
      totalSent += await sendExpoPushBatch(env, messages, { alertId: alert.id });
    }
    // 매칭 디바이스 유무 무관하게 notified=1 (반복 전송 방지)
    await env.DB.prepare(`UPDATE safety_alerts SET notified = 1 WHERE id = ?1`)
      .bind(alert.id)
      .run();
  }
  return { matched: pending.length, sent: totalSent };
}

// ─── Cron Handler ──────────────────────────────────────────────────────

async function runCronJob(env: Env): Promise<{ ok: boolean; details: any }> {
  const started = Date.now();
  try {
    const since = started - 16 * 60 * 1000; // 마지막 16분 변경 분만
    const adv = await pollMofaAdvisories(env);
    const push = await pushAdvisoryChanges(env, since);

    // 외교부 안전공지 (HTML 스크래핑)
    let notice = { fetched: 0, newCount: 0 };
    let noticePush = { matched: 0, sent: 0 };
    try {
      notice = await pollSafetyNotices(env);
      noticePush = await pushNoticeAlerts(env);
    } catch (err) {
      console.warn('[notice] failed:', err instanceof Error ? err.message : String(err));
    }

    const details = { ...adv, ...push, notice, noticePush };
    await env.DB.prepare(
      `INSERT INTO cron_log (job, status, details, started_at, finished_at)
       VALUES ('mofa_poll', 'ok', ?1, ?2, ?3)`
    )
      .bind(JSON.stringify(details), started, Date.now())
      .run();
    return { ok: true, details };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      `INSERT INTO cron_log (job, status, details, started_at, finished_at)
       VALUES ('mofa_poll', 'error', ?1, ?2, ?3)`
    )
      .bind(JSON.stringify({ error: message }), started, Date.now())
      .run()
      .catch(() => undefined);
    return { ok: false, details: { error: message } };
  }
}

// ─── 라우터 ────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (req.method === 'POST' && pathname === '/push/register') return handleRegister(req, env);
      if (req.method === 'DELETE' && pathname === '/push/register') return handleUnregister(req, env);
      if (req.method === 'GET' && pathname === '/advisories') return handleAdvisoriesList(env);
      const advMatch = pathname.match(/^\/advisories\/([A-Za-z]{2})$/);
      if (req.method === 'GET' && advMatch) return handleAdvisoryByCountry(env, advMatch[1]);
      if (req.method === 'GET' && pathname === '/alerts') return handleAlertsAll(env);
      const alertMatch = pathname.match(/^\/alerts\/([A-Za-z]{2})$/);
      if (req.method === 'GET' && alertMatch) return handleAlertsByCountry(env, alertMatch[1]);
      if (req.method === 'GET' && pathname === '/health') return handleHealth(env);

      // 관리자용 — Cron 즉시 트리거. Secret key 헤더 검증.
      if (req.method === 'POST' && pathname === '/admin/cron') {
        const auth = req.headers.get('x-admin-key');
        if (!auth || auth !== env.MOFA_SERVICE_KEY) {
          return jsonResponse({ error: 'unauthorized' }, { status: 401 });
        }
        const result = await runCronJob(env);
        return jsonResponse(result);
      }


      return jsonResponse({ error: 'not_found', path: pathname }, { status: 404 });
    } catch (err) {
      return serverError(err);
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCronJob(env).then((r) => console.log('[cron]', JSON.stringify(r))));
  },
};
