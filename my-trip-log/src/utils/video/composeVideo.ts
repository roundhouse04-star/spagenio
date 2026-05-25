/**
 * 여행 영상 합성 — iOS native module (AVFoundation) wrapper
 *
 * triplive-video-editor 모듈 (modules/triplive-video-editor) 호출.
 * 다음 세션에서 Swift 구현 완성 예정.
 *
 * PRO 기능:
 *  - 무료: 720p, 최대 30초, 사진 10장, 워터마크
 *  - PRO:  1080p, 최대 60초, 사진 20장, 워터마크 X
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Asset } from 'expo-asset';
import {
  composeVideo as nativeComposeVideo,
  type VideoComposeResult as NativeResult,
} from '../../../modules/triplive-video-editor/src';

export interface VideoPhoto {
  uri: string;
  caption: string;
}

export interface VideoComposeInput {
  tripId: number;
  tripTitle: string;
  photos: VideoPhoto[];
  isPro: boolean;
  watermark?: boolean;
}

export interface VideoComposeResult {
  ok: boolean;
  outputPath?: string;
  durationSec: number;
  width: number;
  height: number;
  error?: string;
  logs?: string;
}

const SPEC = {
  free: { width: 720,  height: 1280, fps: 30, maxPhotos: 10, maxSec: 30 },
  pro:  { width: 1080, height: 1920, fps: 30, maxPhotos: 20, maxSec: 60 },
};

const PHOTO_DURATION = 2.5;
const TRANSITION = 0.5;

async function getAssetLocalUri(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

function normalizePath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

async function preprocessPhoto(
  uri: string,
  targetWidth: number,
  workDir: string,
  index: number,
): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.round(targetWidth * 1.05) } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const outPath = `${workDir}/photo_${index}.jpg`;
  await FileSystem.copyAsync({ from: result.uri, to: outPath });
  return outPath;
}

export async function composeVideo(input: VideoComposeInput): Promise<VideoComposeResult> {
  const spec = input.isPro ? SPEC.pro : SPEC.free;
  const { width, height } = spec;

  const photos = input.photos.slice(0, spec.maxPhotos);
  if (photos.length < 2) {
    return { ok: false, durationSec: 0, width, height, error: '사진은 최소 2장 필요' };
  }

  const workDir = `${FileSystem.documentDirectory}video_work_${Date.now()}`;
  await FileSystem.makeDirectoryAsync(workDir, { intermediates: true });

  try {
    // 사진 미리 처리 (resize)
    const processedPaths: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = await preprocessPhoto(photos[i].uri, width, workDir, i);
      processedPaths.push(p);
    }

    // 폰트
    const fontLocalUri = await getAssetLocalUri(FONT_ASSET);
    const fontPath = normalizePath(fontLocalUri);

    // 영상 길이
    const totalSec = Math.min(photos.length * PHOTO_DURATION, spec.maxSec);
    const perPhoto = totalSec / photos.length;

    // 출력 경로
    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}videos`,
      { intermediates: true },
    );
    const outputPath = `${normalizePath(FileSystem.documentDirectory ?? '')}videos/trip_${input.tripId}_${Date.now()}.mp4`;

    // Native module 호출 (BGM 없이 무음 영상)
    const native: NativeResult = await nativeComposeVideo({
      photos: photos.map((p, i) => ({ uri: processedPaths[i], caption: p.caption })),
      bgmPath: '',  // 무음
      outputPath,
      width,
      height,
      perPhotoSec: perPhoto,
      transitionSec: TRANSITION,
      fontPath,
      watermark: !!input.watermark,
      watermarkText: '🛡 Triplive',
    });

    // 작업 디렉토리 정리
    await FileSystem.deleteAsync(workDir, { idempotent: true }).catch(() => undefined);

    if (native.ok && native.outputPath) {
      return {
        ok: true,
        outputPath: native.outputPath,
        durationSec: native.durationSec ?? totalSec,
        width: native.width ?? width,
        height: native.height ?? height,
      };
    }

    return {
      ok: false,
      durationSec: totalSec,
      width,
      height,
      error: native.error ?? '영상 합성 실패',
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

// ─── 자산 매핑 ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FONT_ASSET = require('../../../assets/fonts/Pretendard-Bold.ttf');
// BGM 은 1.3 에서 제거. 사용자가 "이상한 소리" 피드백 + 인스타에서 음악 추가 가능.
// assets/bgm/*.mp3 파일은 남겨두지만 require X (번들 미포함).
