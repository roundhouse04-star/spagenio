// iOS App Store / TestFlight 환경 감지
// Bundle.main.appStoreReceiptURL.lastPathComponent 기반 (Apple 공식 방법)
//   sandboxReceipt → TestFlight / 샌드박스
//   receipt        → App Store
import { requireOptionalNativeModule } from 'expo-modules-core';

const AdEnvironment = requireOptionalNativeModule('AdEnvironment');

export function getReceiptName() {
  if (!AdEnvironment) return null;
  try {
    return AdEnvironment.getReceiptName();
  } catch (e) {
    return null;
  }
}

export function isTestFlight() {
  if (!AdEnvironment) return false;
  try {
    return AdEnvironment.isTestFlight();
  } catch (e) {
    return false;
  }
}

export function isAppStore() {
  if (!AdEnvironment) return false;
  try {
    return AdEnvironment.isAppStore();
  } catch (e) {
    return false;
  }
}

export default { getReceiptName, isTestFlight, isAppStore };
