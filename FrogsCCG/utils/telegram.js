// Safely get the Telegram WebApp object
export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined') {
    // Return a mock object when in development mode and Telegram object is not available
    if (process.env.NODE_ENV === 'development' && !window.Telegram?.WebApp) {
      console.log('Running in development mode with mock Telegram WebApp');
      return {
        ready: () => console.log('Mock WebApp.ready() called'),
        expand: () => console.log('Mock WebApp.expand() called'),
        close: () => console.log('Mock WebApp.close() called'),
        showAlert: (msg) => console.log('Mock WebApp.showAlert() called with:', msg),
        backgroundColor: '#ffffff',
        textColor: '#000000',
        hintColor: '#999999',
        linkColor: '#0088cc',
        buttonColor: '#0088cc',
        buttonTextColor: '#ffffff',
        secondaryBgColor: '#f0f0f0',
        initDataUnsafe: {
          user: {
            id: 12345,
            first_name: 'Test',
            username: 'testuser'
          }
        }
      };
    }
    return window.Telegram?.WebApp || null;
  }
  return null;
};

// Initialize the Telegram Web App
export const initTelegramWebApp = () => {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    // Ready event
    webApp.ready();
    
    // Expand the Web App to its maximum size
    webApp.expand();
    
    // Enable closing confirmation if needed
    // webApp.enableClosingConfirmation();
    
    return webApp;
  }
  
  return null;
};

// Get user data from the Telegram Web App
export const getTelegramUser = () => {
  const webApp = getTelegramWebApp();
  
  if (webApp && webApp.initDataUnsafe && webApp.initDataUnsafe.user) {
    return webApp.initDataUnsafe.user;
  }
  
  return null;
};

// Show a popup alert in the Telegram Web App
export const showAlert = (message) => {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    webApp.showAlert(message);
  } else {
    alert(message);
  }
};

// Close the Web App
export const closeWebApp = () => {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    webApp.close();
  }
};

// Check if the app is running in the Telegram WebView
export const isTelegramWebApp = () => {
  return getTelegramWebApp() !== null;
}; 