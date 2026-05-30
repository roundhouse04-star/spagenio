import ExpoModulesCore

public class AdsEnvironmentModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AdsEnvironment")

    // TestFlight(샌드박스 영수증) 설치본이면 true → 호출부에서 테스트 광고로 전환.
    // App Store 정식 설치본은 영수증 이름이 "receipt"라 false → 실제 광고.
    Constant("isTestFlight") {
      isRunningInTestFlight()
    }
  }

  private func isRunningInTestFlight() -> Bool {
    guard let receiptURL = Bundle.main.appStoreReceiptURL else { return false }
    return receiptURL.lastPathComponent == "sandboxReceipt"
  }
}
