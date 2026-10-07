import type { CapacitorConfig } from '@capacitor/cli';

// Android app: the same Vite build (dist/) inside a native shell.
const config: CapacitorConfig = {
  appId: 'com.cryptdox.mumu',
  appName: 'mumu',
  webDir: 'dist',
  android: {
    backgroundColor: '#0b0b0f',
  },
};

export default config;
