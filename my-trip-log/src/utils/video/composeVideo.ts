/**
 * 여행 영상 합성 — ffmpeg-kit-react-native 로 사진 + BGM + 자막 → mp4
 *
 * 입력: 날짜별 사진 + 자막 + BGM 카테고리
 * 출력: documentDirectory/videos/trip_{tripId}_{timestamp}.mp4 (1080x1920)
 *
 * PRO 기능:
 *  - 무료: 720p, 최대 30초, 사진 10장, BGM 15곡, 워터마크
 *  - PRO:  1080p, 최대 60초, 사진 20장, BGM 45곡, 워터마크 X
 */
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Asset } from 'expo-asset';

export interface VideoPhoto {
  uri: string;       // local file URI (file://...)
  caption: string;   // 영상에 자막으로 들어감 (빈 문자열이면 자막 없음)
}

export interface VideoComposeInput {
  tripId: number;
  tripTitle: string;
  photos: VideoPhoto[];        // 날짜 순서대로 평탄화된 배열
  bgmCategory: 'upbeat' | 'calm' | 'cinematic';
  isPro: boolean;              // PRO 사용자 여부
  watermark?: boolean;         // 워터마크 표시 (무료=true, PRO=false)
}

export interface VideoComposeResult {
  ok: boolean;
  outputPath?: string;          // file:///.../trip_xx_xxxx.mp4
  durationSec: number;
  width: number;
  height: number;
  error?: string;
  logs?: string;
}

// PRO 별 영상 사양
const SPEC = {
  free: { width: 720,  height: 1280, fps: 30, maxPhotos: 10, maxSec: 30, bitrate: '1500k' },
  pro:  { width: 1080, height: 1920, fps: 30, maxPhotos: 20, maxSec: 60, bitrate: '3500k' },
};

const PHOTO_DURATION = 2.5;       // 각 사진 노출 시간 (초)
const TRANSITION = 0.5;            // fade 트랜지션 (초)
const FONT_NAME = 'Pretendard-Bold.ttf';

/** Bundled asset → local file URI 변환 (ffmpeg 가 읽을 수 있는 경로) */
async function getAssetLocalUri(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

/** ffmpeg 입력용 — file:// prefix 제거 + 정규화 */
function normalizePath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

/**
 * 사진을 미리 리사이즈 (1080×1920 또는 720×1280) — ffmpeg 부담 ↓.
 * 가로/세로 비율 보정해서 letterbox 없이 채움.
 */
async function preprocessPhoto(
  uri: string,
  width: number,
  height: number,
  workDir: string,
  index: number,
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(width * 1.05) } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const outPath = `${workDir}/photo_${index}.jpg`;
  await FileSystem.copyAsync({ from: result.uri, to: outPath });
  return outPath;
}

/**
 * ffmpeg-escape 처리 (자막 내 특수문자) — drawtext text= 안의 ':' 등.
 */
function escapeDrawtext(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "’")     // 작은따옴표 → 유니코드 (drawtext 충돌 방지)
    .replace(/"/g, '”');
}

/**
 * 메인 합성 함수.
 *
 * 흐름:
 *  1. workDir 만들기 (documentDirectory/video_work/)
 *  2. 각 사진을 preprocessPhoto 로 미리 리사이즈
 *  3. BGM 파일 준비 (assets 에서 복사)
 *  4. ffmpeg filter_complex 구성:
 *     - 각 사진: scale + crop + fade + drawtext (자막 있을 때)
 *     - concat 으로 합치기
 *     - audio mix
 *  5. ffmpeg 실행
 *  6. 결과 경로 반환
 */
export async function composeVideo(input: VideoComposeInput): Promise<VideoComposeResult> {
  const spec = input.isPro ? SPEC.pro : SPEC.free;
  const { width, height, fps } = spec;

  // 1) 사진 수 제한
  const photos = input.photos.slice(0, spec.maxPhotos);
  if (photos.length < 2) {
    return { ok: false, durationSec: 0, width, height, error: '사진은 최소 2장 필요' };
  }

  // 2) 작업 디렉토리
  const workDir = `${FileSystem.documentDirectory}video_work_${Date.now()}`;
  await FileSystem.makeDirectoryAsync(workDir, { intermediates: true });

  try {
    // 3) 사진 미리 처리
    const processed: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = await preprocessPhoto(photos[i].uri, width, height, workDir, i);
      processed.push(p);
    }

    // 4) BGM 준비 (assets/bgm/{category}.mp3)
    const bgmAsset = BGM_ASSET[input.bgmCategory];
    const bgmLocalUri = await getAssetLocalUri(bgmAsset);
    const bgmPath = normalizePath(bgmLocalUri);

    // 5) 폰트 (assets/fonts/Pretendard-Bold.ttf)
    const fontLocalUri = await getAssetLocalUri(FONT_ASSET);
    const fontPath = normalizePath(fontLocalUri);

    // 6) 총 영상 길이 계산 (PRO 제한 적용)
    const totalSec = Math.min(photos.length * PHOTO_DURATION, spec.maxSec);
    const perPhoto = totalSec / photos.length;

    // 7) ffmpeg 명령 구성
    const inputArgs: string[] = [];
    const filterParts: string[] = [];

    photos.forEach((_, i) => {
      inputArgs.push(`-loop 1 -t ${perPhoto.toFixed(2)} -i "${processed[i]}"`);
    });
    inputArgs.push(`-i "${bgmPath}"`);

    // 각 사진별 비디오 필터: scale + crop + fade + drawtext
    photos.forEach((photo, i) => {
      const isFirst = i === 0;
      const isLast = i === photos.length - 1;
      let parts = [
        `scale=${width}:${height}:force_original_aspect_ratio=increase`,
        `crop=${width}:${height}`,
      ];
      if (!isFirst) parts.push(`fade=t=in:st=0:d=${TRANSITION}`);
      if (!isLast)  parts.push(`fade=t=out:st=${(perPhoto - TRANSITION).toFixed(2)}:d=${TRANSITION}`);

      // 자막 (caption 있을 때만)
      if (photo.caption.trim().length > 0) {
        const safe = escapeDrawtext(photo.caption.trim());
        const fontSize = input.isPro ? 64 : 56;
        parts.push(
          `drawtext=fontfile='${fontPath}':text='${safe}':x=(w-text_w)/2:y=h-text_h-${Math.round(height * 0.12)}:` +
          `fontsize=${fontSize}:fontcolor=white:` +
          `box=1:boxcolor=black@0.55:boxborderw=24:` +
          `shadowcolor=black@0.7:shadowx=2:shadowy=2`
        );
      }

      // 마지막 컷에 워터마크 (무료 사용자)
      if (input.watermark && isLast) {
        parts.push(
          `drawtext=fontfile='${fontPath}':text='🛡 Triplive':x=w-text_w-30:y=h-text_h-30:` +
          `fontsize=36:fontcolor=white@0.7:` +
          `shadowcolor=black@0.5:shadowx=2:shadowy=2`
        );
      }

      filterParts.push(`[${i}:v]${parts.join(',')}[v${i}]`);
    });

    // concat
    const concatInputs = photos.map((_, i) => `[v${i}]`).join('');
    filterParts.push(`${concatInputs}concat=n=${photos.length}:v=1:a=0[v]`);

    // BGM 페이드
    const bgmIdx = photos.length;
    filterParts.push(
      `[${bgmIdx}:a]volume=0.7,afade=t=in:st=0:d=1.0,afade=t=out:st=${(totalSec - 1.0).toFixed(2)}:d=1.0[a]`
    );

    const filterComplex = filterParts.join(';');

    const outputPath = `${normalizePath(FileSystem.documentDirectory ?? '')}videos/trip_${input.tripId}_${Date.now()}.mp4`;
    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}videos`,
      { intermediates: true },
    );

    const command = [
      ...inputArgs,
      `-filter_complex "${filterComplex}"`,
      `-map "[v]" -map "[a]"`,
      `-c:v libx264 -preset ultrafast -pix_fmt yuv420p`,
      `-r ${fps} -b:v ${spec.bitrate}`,
      `-c:a aac -b:a 128k`,
      `-t ${totalSec.toFixed(2)}`,
      `-movflags +faststart`,
      `"${outputPath}"`,
    ].join(' ');

    console.log('[composeVideo] ffmpeg command:', command.slice(0, 300), '...');

    // 8) ffmpeg 실행
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();
    const logs = await session.getAllLogsAsString();

    // 9) 작업 디렉토리 정리 (실패해도 무시)
    await FileSystem.deleteAsync(workDir, { idempotent: true }).catch(() => undefined);

    if (ReturnCode.isSuccess(returnCode)) {
      return {
        ok: true,
        outputPath: `file://${outputPath}`,
        durationSec: totalSec,
        width,
        height,
      };
    }

    return {
      ok: false,
      durationSec: totalSec,
      width,
      height,
      error: `ffmpeg failed (code ${returnCode})`,
      logs: logs?.slice(-1000),
    };
  } catch (err) {
    await FileSystem.deleteAsync(workDir, { idempotent: true }).catch(() => undefined);
    return {
      ok: false,
      durationSec: 0,
      width,
      height,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── BGM / 폰트 자산 매핑 ───────────────────────────────────────────────
// require 시점에 metro 가 자산을 번들에 포함시킴.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FONT_ASSET = require('../../../assets/fonts/Pretendard-Bold.ttf');

const BGM_ASSET = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  upbeat:    require('../../../assets/bgm/upbeat.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  calm:      require('../../../assets/bgm/calm.mp3'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cinematic: require('../../../assets/bgm/cinematic.mp3'),
};
