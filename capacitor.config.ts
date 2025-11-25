import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aihiitcoach.aihiitcoach',
  appName: 'HIIT Coach',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0A1F2E',
      showSpinner: false
    }
  }
};

export default config;
