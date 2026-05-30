import { registerWebModule, NativeModule } from 'expo';

// AdsEnvironmentModule is not available on the web platform.
class AdsEnvironmentModule extends NativeModule<{}> {
  isTestFlight = false;
}

export default registerWebModule(AdsEnvironmentModule, 'AdsEnvironmentModule');
