/**
 * Expo config plugin — ffmpeg-kit-react-native (subspec 'min')
 *
 * ffmpeg-kit 은 React Native autolinking 호환이지만 Expo 의 expo-modules-autolinking
 * 시스템에선 자동 인식이 안 될 수 있음. 또한 default subspec 이 'https' (~30MB) 라
 * 'min' (~15MB, mp4 인코딩만) 으로 명시.
 *
 * Podfile 에 다음 라인 자동 추가:
 *   pod 'ffmpeg-kit-react-native', :subspecs => ['min'], :path => '../node_modules/ffmpeg-kit-react-native'
 */
const { withPodfile } = require('@expo/config-plugins');

module.exports = (config) => {
  return withPodfile(config, (cfg) => {
    let podfile = cfg.modResults.contents;

    // 이미 추가됐으면 skip
    if (podfile.includes("'ffmpeg-kit-react-native'") &&
        podfile.includes(':subspecs')) {
      return cfg;
    }

    // ffmpeg-kit 라인 (subspec 명시)
    const ffmpegLine =
      "  pod 'ffmpeg-kit-react-native', :subspecs => ['min'], :path => '../node_modules/ffmpeg-kit-react-native', :modular_headers => false";

    // use_expo_modules! 라인 다음에 삽입 (Expo 모듈 정의 이후)
    const lines = podfile.split('\n');
    let insertIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('use_expo_modules!')) {
        insertIdx = i + 1;
        break;
      }
    }

    if (insertIdx >= 0) {
      lines.splice(insertIdx, 0, ffmpegLine);
      cfg.modResults.contents = lines.join('\n');
    } else {
      // fallback: target 'X' do 블록 시작 후
      cfg.modResults.contents = podfile.replace(
        /(target '[^']+' do)/,
        `$1\n${ffmpegLine}`,
      );
    }

    return cfg;
  });
};
