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
