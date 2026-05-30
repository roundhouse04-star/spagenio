package expo.modules.adsenvironment

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AdsEnvironmentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AdsEnvironment")

    // Android(Play 내부 테스트 트랙)은 런타임에 신뢰성 있게 판별하기 어려워 기본 false.
    // iOS TestFlight 영수증 판별과 동일한 인터페이스만 맞춰 둔다.
    Constant("isTestFlight") {
      false
    }
  }
}
