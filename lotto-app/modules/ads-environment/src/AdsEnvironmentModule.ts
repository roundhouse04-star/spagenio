import { NativeModule, requireNativeModule } from 'expo';

declare class AdsEnvironmentModule extends NativeModule<{}> {
  isTestFlight: boolean;
}

export default requireNativeModule<AdsEnvironmentModule>('AdsEnvironment');
