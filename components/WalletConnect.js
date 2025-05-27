import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/authContext';
import { useWallet } from '../contexts/WalletContext';
import styles from '../styles/WalletConnect.module.css';

const WalletConnect = () => {
  const { user, updateUser } = useAuth();
  const { 
    connected, 
    address, 
    loading, 
    error, 
    connect, 
    disconnect, 
    availableWallets 
  } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState(null);

  const connectWallet = async (walletId) => {
    if (!user || !user.id) {
      return;
    }
    
    try {
      // Connect using Mesh SDK
      await connect(walletId);
      
      // Save wallet connection to our backend
      const response = await fetch('/api/walletConnection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          walletAddress: address,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to connect wallet');
      }
      
      // Update user state with connected wallet
      updateUser(data.user);
      
      // Store selected wallet for later use
      setSelectedWallet(walletId);
    } catch (err) {
      console.error('Error connecting wallet:', err);
    }
  };

  const disconnectWallet = async () => {
    if (!user || !user.id) {
      return;
    }
    
    try {
      // Call our API to disconnect the wallet
      const response = await fetch('/api/walletConnection', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to disconnect wallet');
      }
      
      // Update user state with disconnected wallet
      updateUser(data.user);
      
      // Disconnect from Mesh SDK
      disconnect();
      
      // Clear selected wallet
      setSelectedWallet(null);
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Wallet Connection</h2>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      {connected ? (
        <div className={styles.connectedWallet}>
          <p className={styles.walletAddress}>
            Connected: {address.slice(0, 8)}...{address.slice(-8)}
          </p>
          <button 
            className={styles.disconnectButton}
            onClick={disconnectWallet}
            disabled={loading}
          >
            {loading ? 'Disconnecting...' : 'Disconnect Wallet'}
          </button>
        </div>
      ) : (
        <div className={styles.walletOptions}>
          <p className={styles.walletPrompt}>Connect a Cardano wallet to purchase packs:</p>
          
          {availableWallets.length === 0 ? (
            <p className={styles.noWallets}>
              No Cardano wallets detected. Please install Eternl wallet.
            </p>
          ) : (
            <div className={styles.walletList}>
              {availableWallets.map(wallet => (
                <button
                  key={wallet.name}
                  className={styles.walletButton}
                  onClick={() => connectWallet(wallet.name)}
                  disabled={loading}
                >
                  {loading && selectedWallet === wallet.name 
                    ? 'Connecting...' 
                    : `Connect ${wallet.name}`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletConnect; 