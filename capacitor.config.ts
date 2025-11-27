import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aihiitcoach.aihiitcoach',
  appName: 'HIIT Coach',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0A1F2E',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0A1F2E'
    }
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false
  }
};

export default config;
