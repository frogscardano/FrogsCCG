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

  // Check for available wallets
  useEffect(() => {
    const checkWallets = async () => {
      try {
        const wallets = await BrowserWallet.getInstalledWallets();
        setAvailableWallets(wallets);
      } catch (err) {
        console.error('Error checking wallets:', err);
      }
    };

    if (typeof window !== 'undefined') {
      checkWallets();
    }
  }, []);

  const connect = async (walletName = 'eternl') => {
    try {
      setLoading(true);
      setError(null);

      // Connect using Mesh SDK
      const connectedWallet = await BrowserWallet.enable(walletName);
      
      if (!connectedWallet) {
        throw new Error('Failed to connect to wallet');
      }

      // Simplified address retrieval
      const walletAddress = await connectedWallet.getUsedAddresses()
        .then(addresses => addresses[0])
        .catch(() => connectedWallet.getRewardAddresses())
        .then(addresses => addresses[0]);

      if (!walletAddress) {
        throw new Error('No wallet address found');
      }

      // Get balance and assets in parallel
      const [walletBalance, assets] = await Promise.all([
        connectedWallet.getBalance(),
        connectedWallet.getAssets()
      ]);

      console.log('Connected wallet address:', walletAddress);
      console.log('Wallet assets:', assets);

      setApi(connectedWallet);
      setAddress(walletAddress);
      setBalance(walletBalance);
      setConnected(true);

      // Store wallet info in database (non-blocking)
      saveWalletInfo(walletAddress, walletName, walletBalance, assets)
        .catch(err => console.warn('Error saving wallet info:', err));

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

  // Non-blocking wallet info save
  const saveWalletInfo = async (address, provider, balance, assets) => {
    try {
      const lovelaceBalance = balance.find(b => b.unit === 'lovelace')?.quantity || '0';
      await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          provider,
          balance: lovelaceBalance,
          assets: JSON.stringify(assets)
        }),
      });
    } catch (err) {
      console.warn('Error saving wallet info:', err);
    }
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
      availableWallets
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
