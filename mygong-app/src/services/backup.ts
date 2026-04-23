/**
 * 자동 백업 서비스 (Phase 1: 로컬).
 *
 * 흐름:
 *   • 앱 시작 시: 마지막 백업 24시간 지났으면 자동 백업
 *   • 데이터 변경 시: 5초 디바운스 후 자동 백업
 *   • 사용자 액션: 즉시 백업 (수동)
 *
 * 보관 정책: 자동 백업 7개 + 수동 백업 무제한
 *
 * 저장 위치 (Phase 1 - 로컬):
 *   /Documents/backups/
 *     - mygong-auto-2026-04-23T12-34-56.json  (자동)
 *     - mygong-manual-2026-04-23T15-20-00.json  (수동)
 *
 * Phase 2 (iCloud) 준비:
 *   - 저장 경로만 iCloud Documents 로 변경하면 됨
 *   - 모든 함수 시그니처 그대로 유지
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getDB, getAppMeta, setAppMeta } from '@/db/database';
import { getAllArtists } from '@/db/artists';
import { getAllEvents } from '@/db/events';
import { getAllTickets } from '@/db/tickets';
import { getAllNotifications } from '@/db/notifications';
import { SCHEMA_VERSION } from '@/db/schema';
import type { Artist, Event, Ticket, Notification } from '@/types';

// ─── 설정 ──────────────────────────────────────────────────────
const BACKUP_DIR = (FileSystem.documentDirectory ?? '') + 'backups/';
const AUTO_BACKUP_KEEP_COUNT = 7;       // 자동 백업 최대 보관 개수
const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;  // 24시간
const DEBOUNCE_MS = 5000;                // 5초 디바운스
const META_LAST_BACKUP_AT = 'last_backup_at';

// ─── 타입 ──────────────────────────────────────────────────────
export type BackupTrigger =
  | 'startup'        // 앱 시작 시 자동
  | 'data-change'    // 데이터 변경 시 자동
  | 'manual';        // 사용자 수동

export type BackupSnapshot = {
  version: 1;
  schemaVersion: number;
  exportedAt: string;       // ISO timestamp
  trigger: BackupTrigger;
  stats: {
    artistCount: number;
    eventCount: number;
    ticketCount: number;
    notificationCount: number;
  };
  artists: Artist[];
  events: Event[];
  tickets: Ticket[];
  notifications: Notification[];
};

export type BackupFile = {
  uri: string;
  name: string;
  trigger: BackupTrigger;
  createdAt: string;        // ISO
  sizeBytes: number;
};

// ─── 디렉토리 보장 ─────────────────────────────────────────────
async function ensureBackupDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(BACKUP_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
  }
}

// ─── 스냅샷 생성 ─────────────────────────────────────────────
export async function createSnapshot(trigger: BackupTrigger): Promise<BackupSnapshot> {
  const [artists, events, tickets, notifications] = await Promise.all([
    getAllArtists('all'),
    getAllEvents(),
    getAllTickets(),
    getAllNotifications(),
  ]);

  return {
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    trigger,
    stats: {
      artistCount: artists.length,
      eventCount: events.length,
      ticketCount: tickets.length,
      notificationCount: notifications.length,
    },
    artists,
    events,
    tickets,
    notifications,
  };
}

// ─── 백업 생성 (파일로 저장) ──────────────────────────────────
export async function createBackup(trigger: BackupTrigger): Promise<string> {
  await ensureBackupDir();

  const snapshot = await createSnapshot(trigger);

  // 데이터 없으면 백업 생략
  if (snapshot.stats.artistCount === 0 &&
      snapshot.stats.ticketCount === 0 &&
      snapshot.stats.eventCount === 0) {
    console.log('[backup] skip - no data');
    throw new Error('백업할 데이터가 없습니다.');
  }

  const tag = trigger === 'manual' ? 'manual' : 'auto';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `mygong-${tag}-${stamp}.json`;
  const uri = BACKUP_DIR + fileName;

  await FileSystem.writeAsStringAsync(uri, JSON.stringify(snapshot, null, 2));
  await setAppMeta(META_LAST_BACKUP_AT, snapshot.exportedAt);

  console.log(`[backup] created (${trigger}): ${fileName}`);

  // 자동 백업이면 오래된 것 정리
  if (trigger !== 'manual') {
    cleanOldAutoBackups().catch(e =>
      console.warn('[backup] cleanup failed:', e?.message ?? e)
    );
  }

  return uri;
}

// ─── 백업 목록 ────────────────────────────────────────────────
export async function listBackups(): Promise<BackupFile[]> {
  await ensureBackupDir();
  const names = await FileSystem.readDirectoryAsync(BACKUP_DIR);

  const files: BackupFile[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const uri = BACKUP_DIR + name;
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) continue;

    const trigger: BackupTrigger = name.includes('manual') ? 'manual' : 'startup';
    // ISO 타임스탬프 추출 (파일명에서)
    const match = name.match(/(\d{4}-\d{2}-\d{2}T[\d-]+(?:\.\d+)?Z?)/);
    const createdAt = match
      ? match[1].replace(/-(\d{2})-(\d{2})-(\d{3})Z?$/, ':$1:$2.$3Z')
      : new Date(info.modificationTime ? info.modificationTime * 1000 : Date.now()).toISOString();

    files.push({
      uri,
      name,
      trigger,
      createdAt,
      sizeBytes: (info as any).size ?? 0,
    });
  }

  // 최신순 정렬
  files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return files;
}

// ─── 오래된 자동 백업 정리 ─────────────────────────────────────
export async function cleanOldAutoBackups(keep = AUTO_BACKUP_KEEP_COUNT): Promise<number> {
  const all = await listBackups();
  // 자동만 추리기 (수동은 사용자가 직접 관리)
  const autos = all.filter(f => f.trigger !== 'manual');
  if (autos.length <= keep) return 0;

  const toDelete = autos.slice(keep); // keep개 이후는 모두 삭제
  let deleted = 0;
  for (const f of toDelete) {
    try {
      await FileSystem.deleteAsync(f.uri, { idempotent: true });
      deleted++;
    } catch (e) {
      console.warn('[backup] delete failed:', f.name, e);
    }
  }
  if (deleted > 0) console.log(`[backup] cleaned ${deleted} old auto backups`);
  return deleted;
}

// ─── 백업에서 복원 ────────────────────────────────────────────
export type RestoreResult = {
  success: boolean;
  message: string;
  stats?: BackupSnapshot['stats'];
};

export async function restoreFromFile(uri: string): Promise<RestoreResult> {
  try {
    const text = await FileSystem.readAsStringAsync(uri);
    const snapshot: BackupSnapshot = JSON.parse(text);

    if (!snapshot.version || !snapshot.artists || !snapshot.tickets) {
      return { success: false, message: '백업 파일 형식이 올바르지 않습니다.' };
    }

    const db = await getDB();
    const now = new Date().toISOString();

    // 트랜잭션으로 통째 복원 (실패 시 자동 롤백)
    await db.withTransactionAsync(async () => {
      for (const a of snapshot.artists ?? []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO artists (id, external_id, name, name_en, role, tag, emoji, avatar_url, thumb_color,
            bio, followers, is_following, notify_enabled, last_synced_at, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [a.id, a.externalId, a.name, a.nameEn, a.role, a.tag, a.emoji, a.avatarUrl, a.thumbColor,
           a.bio, a.followers, a.isFollowing ? 1 : 0, a.notifyEnabled ? 1 : 0,
           a.lastSyncedAt, a.createdAt ?? now, a.updatedAt ?? now]
        );
      }
      for (const e of snapshot.events ?? []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO events (id, artist_id, external_id, title, category, cat_icon, date, weekday,
            time, venue, city, price, ticket_url, poster_url, notify_enabled, notes, source, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [e.id, e.artistId, e.externalId, e.title, e.category, e.catIcon, e.date, e.weekday,
           e.time, e.venue, e.city, e.price, e.ticketUrl, e.posterUrl,
           e.notifyEnabled ? 1 : 0, e.notes, e.source, e.createdAt ?? now, e.updatedAt ?? now]
        );
      }
      for (const t of snapshot.tickets ?? []) {
        await db.runAsync(
          `INSERT OR REPLACE INTO tickets (id, artist_id, event_id, title, category, cat_icon, date, month,
            venue, seat, photo_uri, rating, notes, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [t.id, t.artistId, t.eventId, t.title, t.category, t.catIcon, t.date, t.month,
           t.venue, t.seat, t.photoUri, t.rating ?? 0, t.notes,
           t.createdAt ?? now, t.updatedAt ?? now]
        );
      }
    });

    return {
      success: true,
      message: '복원 완료',
      stats: snapshot.stats,
    };
  } catch (e: any) {
    console.error('[backup] restore failed:', e);
    return { success: false, message: e?.message ?? '복원 실패' };
  }
}

// ─── 백업 삭제 ────────────────────────────────────────────────
export async function deleteBackup(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

// ─── 백업 공유 (AirDrop / iCloud Drive / 카톡 등) ─────────────
export async function shareBackup(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('이 기기에서는 공유 기능을 사용할 수 없습니다.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: '내공연 백업 공유',
    UTI: 'public.json',
  });
}

// ─── 마지막 백업 정보 ────────────────────────────────────────
export type LastBackupInfo = {
  at?: Date;
  ageMs?: number;          // 마지막 백업 후 경과 시간
  display: string;         // "1시간 전" 등 사람이 읽는 형식
};

export async function getLastBackupInfo(): Promise<LastBackupInfo> {
  const at = await getAppMeta(META_LAST_BACKUP_AT);
  if (!at) return { display: '없음' };

  const date = new Date(at);
  const ageMs = Date.now() - date.getTime();

  return {
    at: date,
    ageMs,
    display: humanizeTimeAgo(ageMs),
  };
}

function humanizeTimeAgo(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.floor(day / 30);
  return `${month}개월 전`;
}

// ─── 시작 시 자동 백업 체크 ───────────────────────────────────
export async function checkAndRunStartupBackup(): Promise<void> {
  try {
    const last = await getLastBackupInfo();
    if (last.ageMs == null || last.ageMs >= AUTO_BACKUP_INTERVAL_MS) {
      console.log('[backup] startup auto-backup triggered');
      await createBackup('startup');
    } else {
      console.log(`[backup] skip startup (last: ${last.display})`);
    }
  } catch (e: any) {
    console.warn('[backup] startup check failed:', e?.message ?? e);
  }
}

// ─── 데이터 변경 시 디바운스 자동 백업 ─────────────────────────
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerAutoBackup(reason: 'data-change' = 'data-change'): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    createBackup(reason).catch(e =>
      console.warn('[backup] auto backup failed:', e?.message ?? e)
    );
  }, DEBOUNCE_MS);
}
