import { useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import '../styles/globals.css';
import { initTelegramWebApp } from '../utils/telegram';
import { WalletProvider } from '../contexts/WalletContext';
import { AuthProvider } from '../contexts/authContext';

function MyApp({ Component, pageProps }) {
  // Initialize Telegram WebApp when the component mounts
  useEffect(() => {
    initTelegramWebApp();

    // Apply Telegram Theme CSS variables
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const webApp = window.Telegram.WebApp;
      
      // Apply CSS variables for theme
      document.documentElement.style.setProperty('--tg-theme-bg-color', webApp.backgroundColor);
      document.documentElement.style.setProperty('--tg-theme-text-color', webApp.textColor);
      document.documentElement.style.setProperty('--tg-theme-hint-color', webApp.hintColor);
      document.documentElement.style.setProperty('--tg-theme-link-color', webApp.linkColor);
      document.documentElement.style.setProperty('--tg-theme-button-color', webApp.buttonColor);
      document.documentElement.style.setProperty('--tg-theme-button-text-color', webApp.buttonTextColor);
      document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', webApp.secondaryBgColor);
    }
  }, []);

  return (
    <AuthProvider>
      <WalletProvider>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="color-scheme" content="light dark" />
          <title>Frogs Card Collection</title>
        </Head>
        
        {/* Include the Telegram WebApp script */}
        <Script 
          src="https://telegram.org/js/telegram-web-app.js" 
          strategy="beforeInteractive"
        />
        
        <Component {...pageProps} />
      </WalletProvider>
    </AuthProvider>
  );
}

export default MyApp; 