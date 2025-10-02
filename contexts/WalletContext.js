import { createContext, useContext, useState, useEffect } from 'react';
import { BrowserWallet } from '@meshsdk/core';

const WalletContext = createContext();

export { WalletContext };

// List of supported wallet providers
const SUPPORTED_WALLETS = {
  eternl: {
    name: 'Eternl',
    icon: '/images/wallets/eternl.svg',
    key: 'eternl',
  }
};

export function WalletProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [api, setApi] = useState(null);
  const [availableWallets, setAvailableWallets] = useState([]);
  const [checkingWallets, setCheckingWallets] = useState(false);

  // Robustly detect installed wallets with retries and event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let retryTimer = null;
    let attempts = 0;

    const detect = async () => {
      try {
        setCheckingWallets(true);
        const wallets = await BrowserWallet.getInstalledWallets();
        if (!cancelled) {
          setAvailableWallets(wallets || []);
          // Stop retrying once any wallet is detected
          if (wallets && wallets.length > 0) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
        }
      } catch (err) {
        console.error('Error checking wallets:', err);
      } finally {
        if (!cancelled) setCheckingWallets(false);
      }
    };

    // Initial detection
    detect();

    // Some wallets inject late; retry for a short window
    retryTimer = setInterval(() => {
      attempts += 1;
      // Try for up to ~10 seconds (20 attempts x 500ms)
      if (attempts > 20) {
        clearInterval(retryTimer);
        retryTimer = null;
        return;
      }
      detect();
    }, 500);

    // Re-detect when tab becomes visible again
    const handleVisibility = () => {
      if (!document.hidden) detect();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Some wallets emit a custom initialization event
    const handleCardanoInitialized = () => detect();
    window.addEventListener('cardano#initialized', handleCardanoInitialized);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('cardano#initialized', handleCardanoInitialized);
    };
  }, []);

  // Manual refresh for wallet detection (exposed to UI)
  const refreshWallets = async () => {
    if (typeof window === 'undefined') return;
    try {
      setCheckingWallets(true);
      const wallets = await BrowserWallet.getInstalledWallets();
      setAvailableWallets(wallets || []);
    } catch (err) {
      console.error('Error refreshing wallets:', err);
    } finally {
      setCheckingWallets(false);
    }
  };

  const connect = async (walletName = 'eternl') => {
    try {
      setLoading(true);
      setError(null);

      // Connect using Mesh SDK
      const connectedWallet = await BrowserWallet.enable(walletName);
      
      if (!connectedWallet) {
        throw new Error('Failed to connect to wallet');
      }

      // Get wallet address - try used addresses first, then fallback to reward addresses
      let walletAddress;
      try {
        const usedAddresses = await connectedWallet.getUsedAddresses();
        walletAddress = usedAddresses[0];
      } catch (err) {
        console.warn('Failed to get used addresses, trying reward addresses:', err);
        try {
          const rewardAddresses = await connectedWallet.getRewardAddresses();
          walletAddress = rewardAddresses[0];
        } catch (rewardErr) {
          console.error('Failed to get reward addresses:', rewardErr);
          throw new Error('Could not get wallet address');
        }
      }

      if (!walletAddress) {
        throw new Error('No wallet address found');
      }

      // Get balance
      const walletBalance = await connectedWallet.getBalance();
      
      // Get assets
      const assets = await connectedWallet.getAssets();

      console.log('Connected wallet address:', walletAddress);
      console.log('Wallet assets:', assets);

      setApi(connectedWallet);
      setAddress(walletAddress);
      setBalance(walletBalance);
      setConnected(true);

      // Store wallet info in database
      try {
        const lovelaceBalance = walletBalance.find(b => b.unit === 'lovelace')?.quantity || '0';
        const response = await fetch('/api/wallet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: walletAddress,
            provider: walletName,
            balance: lovelaceBalance,
            assets: JSON.stringify(assets)
          }),
        });

        if (!response.ok) {
          console.warn('Failed to save wallet info to database');
        }
      } catch (err) {
        console.warn('Error saving wallet info:', err);
      }

    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(err.message);
      setConnected(false);
      setAddress('');
      setBalance(0);
      setApi(null);
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setConnected(false);
    setAddress('');
    setBalance(0);
    setApi(null);
  };

  return (
    <WalletContext.Provider value={{
      connected,
      address,
      balance,
      loading,
      error,
      connect,
      disconnect,
      api,
      availableWallets,
      refreshWallets,
      checkingWallets
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
} 
