// 백업/복원 — JSON 파일을 시스템 공유 시트 / 파일 피커로 입출력
// 어플 재설치 시 미리 내보낸 백업 파일을 가져오면 모든 데이터 복원 가능
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportAllData, importAllData } from './db';

function ts() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`;
}

export async function exportToFile() {
  const data = await exportAllData();
  const filename = `spagenio-lotto-backup-${ts()}.json`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(data, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: '백업 파일 저장',
      UTI: 'public.json',
    });
  }
  return { path, filename, size: JSON.stringify(data).length };
}

export async function importFromFile({ merge = false } = {}) {
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });
  if (r.canceled) return { ok: false, canceled: true };
  const asset = r.assets?.[0];
  if (!asset?.uri) throw new Error('파일 선택이 취소되었습니다');

  const content = await FileSystem.readAsStringAsync(asset.uri);
  const payload = JSON.parse(content);
  await importAllData(payload, { merge });

  return {
    ok: true,
    canceled: false,
    counts: {
      picks: payload.picks?.length || 0,
      purchases: payload.purchases?.length || 0,
      weights: payload.weights?.length || 0,
      settings: payload.settings?.length || 0,
    },
  };
}
