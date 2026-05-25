/**
 * triplive-video-editor — JS interface
 *
 * iOS native 영상 합성 (AVFoundation) wrapper.
 * 다음 세션에서 Swift 구현 완성 후 동작.
 */
import { requireNativeModule } from 'expo';

export interface VideoPhotoInput {
  uri: string;
  caption: string;
}

export interface VideoComposeInput {
  photos: VideoPhotoInput[];
  bgmPath: string;
  outputPath: string;
  width: number;
  height: number;
  perPhotoSec: number;
  transitionSec: number;
  fontPath: string;
  watermark: boolean;
  watermarkText?: string;
}

export interface VideoComposeResult {
  ok: boolean;
  outputPath?: string;
  durationSec?: number;
  width?: number;
  height?: number;
  error?: string;
}

interface TripliveVideoEditorModule {
  composeVideo(input: VideoComposeInput): Promise<VideoComposeResult>;
}

const TripliveVideoEditor = requireNativeModule<TripliveVideoEditorModule>('TripliveVideoEditor');

export async function composeVideo(input: VideoComposeInput): Promise<VideoComposeResult> {
  return TripliveVideoEditor.composeVideo(input);
}
