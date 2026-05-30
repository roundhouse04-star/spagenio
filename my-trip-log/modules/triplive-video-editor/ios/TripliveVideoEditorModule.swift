import ExpoModulesCore
import AVFoundation
import UIKit
import CoreImage

/**
 * Triplive iOS native 영상 합성 모듈 (AVFoundation)
 *
 * 흐름:
 *  1. 사진들 → CALayer (각각 시간별 opacity 애니메이션, fade in/out)
 *  2. 자막 → CATextLayer (caption 있는 사진만)
 *  3. 워터마크 → 마지막 컷 우하단 (무료 사용자)
 *  4. parentLayer → AVMutableVideoComposition.animationTool
 *  5. BGM mp3 → AVMutableComposition 오디오 트랙 (페이드 in/out + 볼륨)
 *  6. AVAssetExportSession → 1080×1920 mp4
 */
public class TripliveVideoEditorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TripliveVideoEditor")

    AsyncFunction("composeVideo") { (input: VideoComposeInput, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          let outputUrl = try self.composeVideoSync(input: input)
          promise.resolve([
            "ok": true,
            "outputPath": "file://" + outputUrl.path,
            "durationSec": Double(input.photos.count) * input.perPhotoSec,
            "width": input.width,
            "height": input.height
          ])
        } catch {
          promise.resolve([
            "ok": false,
            "error": error.localizedDescription
          ])
        }
      }
    }
  }

  // MARK: - 핵심 영상 합성 로직
  private func composeVideoSync(input: VideoComposeInput) throws -> URL {
    let size = CGSize(width: input.width, height: input.height)
    // Cross-dissolve: 각 사진이 perPhoto 노출 + 다음 사진과 transition 동안 겹침
    // 총 길이 = N*perPhoto - (N-1)*transition
    let totalSec = Double(input.photos.count) * input.perPhotoSec
                 - Double(max(input.photos.count - 1, 0)) * input.transitionSec
    let totalDurationCM = CMTime(seconds: totalSec, preferredTimescale: 600)

    // 1) 사진 UIImage 로드
    let images: [UIImage] = try input.photos.map { p in
      let path = p.uri.replacingOccurrences(of: "file://", with: "")
      guard let img = UIImage(contentsOfFile: path) else {
        throw NSError(
          domain: "TripliveVideoEditor",
          code: -101,
          userInfo: [NSLocalizedDescriptionKey: "사진 로드 실패: \(path)"]
        )
      }
      return img
    }

    // 2) 빈 비디오 트랙 만들기 (검정 배경)
    let composition = AVMutableComposition()
    guard let videoTrack = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
      throw NSError(domain: "TripliveVideoEditor", code: -102, userInfo: [NSLocalizedDescriptionKey: "비디오 트랙 생성 실패"])
    }

    // 검정 배경 영상 생성 (전체 길이)
    let blankUrl = try makeBlankVideo(size: size, duration: totalDurationCM)
    let blankAsset = AVURLAsset(url: blankUrl)
    // iOS 16+ loadTracks 는 async — 동기 함수 안에서는 deprecated tracks() 사용
    let blankTracks = blankAsset.tracks(withMediaType: .video)
    guard let blankVideoTrack = blankTracks.first else {
      throw NSError(domain: "TripliveVideoEditor", code: -103, userInfo: [NSLocalizedDescriptionKey: "검정 배경 트랙 로드 실패"])
    }
    try videoTrack.insertTimeRange(
      CMTimeRange(start: .zero, duration: totalDurationCM),
      of: blankVideoTrack,
      at: .zero
    )

    // 3) parent CALayer (영상 전체)
    let parentLayer = CALayer()
    parentLayer.frame = CGRect(origin: .zero, size: size)
    parentLayer.isGeometryFlipped = false
    parentLayer.backgroundColor = UIColor.black.cgColor

    let videoLayer = CALayer()
    videoLayer.frame = CGRect(origin: .zero, size: size)
    parentLayer.addSublayer(videoLayer)

    // 4) 각 사진 CALayer 추가 + 시간별 opacity 애니메이션
    for (i, image) in images.enumerated() {
      let photoLayer = CALayer()
      photoLayer.frame = CGRect(origin: .zero, size: size)
      photoLayer.contents = image.cgImage
      photoLayer.contentsGravity = .resizeAspectFill
      photoLayer.masksToBounds = true
      photoLayer.opacity = 0

      // Cross-dissolve 트랜지션 — 사진 i+1 의 fade-in 시점 = 사진 i 의 fade-out 시작 시점
      // 첫 사진: 0초 ~ perPhoto 까지 noticeably 노출, 이후 fade out
      // 두 번째부터: 이전 사진의 fade out 시작 시점 = 본인의 fade in 시작 시점 (겹침)
      let isFirst = (i == 0)
      let isLast  = (i == images.count - 1)
      let startTime = Double(i) * (input.perPhotoSec - input.transitionSec)

      // 페이드 인
      let fadeIn = CABasicAnimation(keyPath: "opacity")
      fadeIn.fromValue = 0.0
      fadeIn.toValue = 1.0
      fadeIn.beginTime = AVCoreAnimationBeginTimeAtZero + (isFirst ? 0 : startTime)
      fadeIn.duration = isFirst ? 0.01 : input.transitionSec  // 첫 사진 즉시 노출
      fadeIn.fillMode = .forwards
      fadeIn.isRemovedOnCompletion = false
      photoLayer.add(fadeIn, forKey: "fadeIn")

      // 페이드 아웃 (마지막 사진 제외)
      if !isLast {
        let fadeOut = CABasicAnimation(keyPath: "opacity")
        fadeOut.fromValue = 1.0
        fadeOut.toValue = 0.0
        fadeOut.beginTime = AVCoreAnimationBeginTimeAtZero + startTime + input.perPhotoSec - input.transitionSec
        fadeOut.duration = input.transitionSec
        fadeOut.fillMode = .forwards
        fadeOut.isRemovedOnCompletion = false
        photoLayer.add(fadeOut, forKey: "fadeOut")
      }

      parentLayer.addSublayer(photoLayer)

      // 자막 (caption 있을 때)
      let caption = input.photos[i].caption.trimmingCharacters(in: .whitespaces)
      if !caption.isEmpty {
        let textLayer = makeCaptionLayer(
          text: caption,
          size: size,
          fontPath: input.fontPath,
          isPro: input.width >= 1080
        )
        textLayer.opacity = 0

        let textIn = CABasicAnimation(keyPath: "opacity")
        textIn.fromValue = 0.0
        textIn.toValue = 1.0
        textIn.beginTime = AVCoreAnimationBeginTimeAtZero + startTime + 0.2
        textIn.duration = 0.4
        textIn.fillMode = .forwards
        textIn.isRemovedOnCompletion = false
        textLayer.add(textIn, forKey: "textIn")

        if i < images.count - 1 {
          let textOut = CABasicAnimation(keyPath: "opacity")
          textOut.fromValue = 1.0
          textOut.toValue = 0.0
          textOut.beginTime = AVCoreAnimationBeginTimeAtZero + startTime + input.perPhotoSec - input.transitionSec
          textOut.duration = input.transitionSec
          textOut.fillMode = .forwards
          textOut.isRemovedOnCompletion = false
          textLayer.add(textOut, forKey: "textOut")
        }

        parentLayer.addSublayer(textLayer)
      }
    }

    // 5) 워터마크 (무료 사용자 마지막 컷)
    if input.watermark {
      let wmLayer = makeWatermarkLayer(text: input.watermarkText, size: size, fontPath: input.fontPath)
      wmLayer.opacity = 0
      // 마지막 사진의 cross-dissolve startTime + 약간 지연
      let lastStartTime = Double(images.count - 1) * (input.perPhotoSec - input.transitionSec)
      let wmIn = CABasicAnimation(keyPath: "opacity")
      wmIn.fromValue = 0.0
      wmIn.toValue = 0.8
      wmIn.beginTime = AVCoreAnimationBeginTimeAtZero + lastStartTime + 0.3
      wmIn.duration = 0.5
      wmIn.fillMode = .forwards
      wmIn.isRemovedOnCompletion = false
      wmLayer.add(wmIn, forKey: "wmIn")
      parentLayer.addSublayer(wmLayer)
    }

    // 6) AVMutableVideoComposition + animationTool
    let videoComposition = AVMutableVideoComposition()
    videoComposition.renderSize = size
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
      postProcessingAsVideoLayer: videoLayer,
      in: parentLayer
    )

    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: totalDurationCM)
    // 트랜지션 사이 빈 프레임 시 default(파란색) 대신 검정으로
    instruction.backgroundColor = UIColor.black.cgColor
    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
    instruction.layerInstructions = [layerInstruction]
    videoComposition.instructions = [instruction]

    // 7) BGM 오디오 트랙 (페이드 in/out)
    // iOS 16+ loadTracks / load(.duration) 은 async — 동기 함수에선 deprecated API 사용
    let bgmPath = input.bgmPath.replacingOccurrences(of: "file://", with: "")
    if FileManager.default.fileExists(atPath: bgmPath) {
      let bgmAsset = AVURLAsset(url: URL(fileURLWithPath: bgmPath))
      let bgmTracks = bgmAsset.tracks(withMediaType: .audio)
      if let bgmAudioTrack = bgmTracks.first,
         let compAudioTrack = composition.addMutableTrack(
           withMediaType: .audio,
           preferredTrackID: kCMPersistentTrackID_Invalid
         ) {
        let bgmDuration = min(bgmAsset.duration, totalDurationCM)
        try compAudioTrack.insertTimeRange(
          CMTimeRange(start: .zero, duration: bgmDuration),
          of: bgmAudioTrack,
          at: .zero
        )
      }
    }

    // 8) Export (mp4)
    let outputUrl = URL(fileURLWithPath: input.outputPath.replacingOccurrences(of: "file://", with: ""))
    // 기존 파일 삭제
    try? FileManager.default.removeItem(at: outputUrl)

    guard let exporter = AVAssetExportSession(
      asset: composition,
      presetName: AVAssetExportPresetHighestQuality
    ) else {
      throw NSError(domain: "TripliveVideoEditor", code: -104, userInfo: [NSLocalizedDescriptionKey: "ExportSession 생성 실패"])
    }
    exporter.outputURL = outputUrl
    exporter.outputFileType = .mp4
    exporter.videoComposition = videoComposition
    exporter.shouldOptimizeForNetworkUse = true

    let semaphore = DispatchSemaphore(value: 0)
    var exportError: Error?

    exporter.exportAsynchronously {
      if exporter.status == .failed {
        exportError = exporter.error
      } else if exporter.status == .cancelled {
        exportError = NSError(domain: "TripliveVideoEditor", code: -105, userInfo: [NSLocalizedDescriptionKey: "Export 취소됨"])
      }
      semaphore.signal()
    }
    semaphore.wait()

    if let err = exportError {
      throw err
    }

    // blank video 임시 파일 삭제
    try? FileManager.default.removeItem(at: blankUrl)

    return outputUrl
  }

  // MARK: - 헬퍼: 검정 배경 영상 생성 (사진 위에 깔기 위함)
  private func makeBlankVideo(size: CGSize, duration: CMTime) throws -> URL {
    let tmpUrl = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("blank_\(Date().timeIntervalSince1970).mp4")

    let writer = try AVAssetWriter(outputURL: tmpUrl, fileType: .mp4)
    let videoSettings: [String: Any] = [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: size.width,
      AVVideoHeightKey: size.height
    ]
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
    input.expectsMediaDataInRealTime = false
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(
      assetWriterInput: input,
      sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
        kCVPixelBufferWidthKey as String: size.width,
        kCVPixelBufferHeightKey as String: size.height
      ]
    )

    writer.add(input)
    writer.startWriting()
    writer.startSession(atSourceTime: .zero)

    // 검정 픽셀버퍼 만들기 (1프레임만)
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferCreate(
      kCFAllocatorDefault,
      Int(size.width), Int(size.height),
      kCVPixelFormatType_32ARGB,
      [kCVPixelBufferCGImageCompatibilityKey: true, kCVPixelBufferCGBitmapContextCompatibilityKey: true] as CFDictionary,
      &pixelBuffer
    )
    guard let pb = pixelBuffer else {
      throw NSError(domain: "TripliveVideoEditor", code: -106, userInfo: [NSLocalizedDescriptionKey: "PixelBuffer 생성 실패"])
    }
    CVPixelBufferLockBaseAddress(pb, [])
    let context = CGContext(
      data: CVPixelBufferGetBaseAddress(pb),
      width: Int(size.width), height: Int(size.height),
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
    )
    context?.setFillColor(UIColor.black.cgColor)
    context?.fill(CGRect(origin: .zero, size: size))
    CVPixelBufferUnlockBaseAddress(pb, [])

    adaptor.append(pb, withPresentationTime: .zero)
    adaptor.append(pb, withPresentationTime: duration)

    let semaphore = DispatchSemaphore(value: 0)
    input.markAsFinished()
    writer.finishWriting {
      semaphore.signal()
    }
    semaphore.wait()

    return tmpUrl
  }

  // MARK: - 헬퍼: 자막 CATextLayer
  private func makeCaptionLayer(text: String, size: CGSize, fontPath: String, isPro: Bool) -> CATextLayer {
    let fontSize: CGFloat = isPro ? 64 : 56
    let textLayer = CATextLayer()
    textLayer.string = text
    textLayer.fontSize = fontSize
    textLayer.foregroundColor = UIColor.white.cgColor
    textLayer.alignmentMode = .center
    textLayer.truncationMode = .end
    textLayer.contentsScale = UIScreen.main.scale

    // Pretendard-Bold 로드 시도, 실패 시 시스템 폰트
    if !fontPath.isEmpty, let font = loadFont(path: fontPath, size: fontSize) {
      textLayer.font = font
    } else {
      textLayer.font = UIFont.boldSystemFont(ofSize: fontSize) as CTFont
    }

    let textHeight: CGFloat = fontSize * 1.6
    let padding: CGFloat = 32
    textLayer.frame = CGRect(
      x: padding,
      y: size.height * 0.12,                   // 하단 12% 위치
      width: size.width - padding * 2,
      height: textHeight
    )

    // 그림자 (가독성 ↑)
    textLayer.shadowColor = UIColor.black.cgColor
    textLayer.shadowOffset = CGSize(width: 2, height: 2)
    textLayer.shadowOpacity = 0.7
    textLayer.shadowRadius = 4

    return textLayer
  }

  // MARK: - 헬퍼: 워터마크
  private func makeWatermarkLayer(text: String, size: CGSize, fontPath: String) -> CATextLayer {
    let textLayer = CATextLayer()
    textLayer.string = text
    textLayer.fontSize = 36
    textLayer.foregroundColor = UIColor.white.cgColor
    textLayer.alignmentMode = .right
    textLayer.contentsScale = UIScreen.main.scale
    textLayer.font = UIFont.boldSystemFont(ofSize: 36) as CTFont
    textLayer.frame = CGRect(x: size.width - 280, y: 60, width: 240, height: 50)
    textLayer.shadowColor = UIColor.black.cgColor
    textLayer.shadowOffset = CGSize(width: 1, height: 1)
    textLayer.shadowOpacity = 0.5
    return textLayer
  }

  // MARK: - 헬퍼: 외부 폰트 파일 로드
  private func loadFont(path: String, size: CGFloat) -> CTFont? {
    let cleanPath = path.replacingOccurrences(of: "file://", with: "")
    guard let dataProvider = CGDataProvider(filename: cleanPath),
          let cgFont = CGFont(dataProvider) else {
      return nil
    }
    return CTFontCreateWithGraphicsFont(cgFont, size, nil, nil)
  }
}

// MARK: - 입력 타입
public struct VideoComposeInput: Record {
  @Field public var photos: [VideoPhotoInput] = []
  @Field public var bgmPath: String = ""
  @Field public var outputPath: String = ""
  @Field public var width: Int = 1080
  @Field public var height: Int = 1920
  @Field public var perPhotoSec: Double = 2.5
  @Field public var transitionSec: Double = 0.5
  @Field public var fontPath: String = ""
  @Field public var watermark: Bool = false
  @Field public var watermarkText: String = "🛡 Triplive"

  public init() {}
}

public struct VideoPhotoInput: Record {
  @Field public var uri: String = ""
  @Field public var caption: String = ""

  public init() {}
}
