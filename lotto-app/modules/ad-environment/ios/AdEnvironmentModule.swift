import ExpoModulesCore

public class AdEnvironmentModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AdEnvironment")

    // Returns the last path component of Bundle.main.appStoreReceiptURL.
    //   "sandboxReceipt" → TestFlight / Sandbox
    //   "receipt"        → App Store
    //   "no_url"         → URL unavailable (rare)
    Function("getReceiptName") { () -> String in
      guard let url = Bundle.main.appStoreReceiptURL else {
        return "no_url"
      }
      return url.lastPathComponent
    }

    Function("isTestFlight") { () -> Bool in
      guard let url = Bundle.main.appStoreReceiptURL else { return false }
      return url.lastPathComponent == "sandboxReceipt"
    }

    Function("isAppStore") { () -> Bool in
      guard let url = Bundle.main.appStoreReceiptURL else { return false }
      return url.lastPathComponent == "receipt"
    }
  }
}
