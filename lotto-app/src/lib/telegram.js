// 텔레그램 Bot API 클라이언트 (서버 없이 클라이언트 직결)
// 토큰/채팅ID는 SQLite app_settings 테이블에 저장
import { getSetting, setSetting } from './db';

const TG_TOKEN_KEY = 'tg_token';
const TG_CHATID_KEY = 'tg_chat_id';

function cleanToken(token) {
  if (!token) return '';
  const t = String(token).trim();
  return t.startsWith('bot') ? t.slice(3) : t;
}

export async function loadTelegramConfig() {
  const [t, c] = await Promise.all([
    getSetting(TG_TOKEN_KEY, ''),
    getSetting(TG_CHATID_KEY, ''),
  ]);
  return { token: t || '', chatId: c || '' };
}

export async function saveTelegramConfig({ token, chatId }) {
  await setSetting(TG_TOKEN_KEY, cleanToken(token));
  await setSetting(TG_CHATID_KEY, (chatId || '').toString().trim());
}

export async function clearTelegramConfig() {
  await setSetting(TG_TOKEN_KEY, null);
  await setSetting(TG_CHATID_KEY, null);
}

export async function sendTelegramMessage({ token, chatId, text, parseMode = 'Markdown' }) {
  const t = cleanToken(token);
  if (!t) throw new Error('Bot Token이 비어있습니다');
  if (!chatId) throw new Error('Chat ID가 비어있습니다');
  const url = `https://api.telegram.org/bot${t}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.description || `HTTP ${res.status}`);
  }
  return data.result;
}

export async function sendTelegramFromConfig(text) {
  const cfg = await loadTelegramConfig();
  return sendTelegramMessage({ token: cfg.token, chatId: cfg.chatId, text });
}

export function formatLottoMessage(games, { round, kind = '추천' } = {}) {
  const today = new Date().toLocaleDateString('ko-KR');
  const lines = games
    .map((g, i) => `${i + 1}게임 *${g.numbers.map((n) => String(n).padStart(2, '0')).join(', ')}*`)
    .join('\n');
  const head = `🍀 *로또 ${kind}번호*\n📅 ${today}` + (round ? ` · 기준 ${round}회` : '');
  return `${head}\n\n${lines}`;
}
