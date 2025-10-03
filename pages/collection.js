import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../contexts/WalletContext.js';
import WalletConnect from '../components/WalletConnect.js';
import Link from 'next/link';
import styles from '../styles/Collection.module.css';
import { getCardImage } from '../utils/gameHelpers';

export default function Collection() {
  const { connected, address } = useWallet();
  const [collection, setCollection] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    if (connected && address) {
      fetchCollection();
    }
  }, [connected, address]);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/collections/${address}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch collection');
      }
      
      const responseData = await response.json();
      
      // Handle new response format with metadata
      let collectionData = responseData;
      if (responseData.collection && Array.isArray(responseData.collection)) {
        collectionData = responseData.collection;
        console.log(`📊 Collection loaded: ${collectionData.length} cards, Message: ${responseData.message}`);
      } else if (Array.isArray(responseData)) {
        collectionData = responseData;
        console.log(`📊 Legacy format: ${collectionData.length} cards`);
      } else {
        console.error(`❌ Unexpected response format:`, responseData);
        throw new Error('Unexpected response format from API');
      }
      
      setCollection(collectionData);
    } catch (error) {
      console.error('Error fetching collection:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Group cards by rarity for display
  const groupedCards = collection.reduce((acc, userCard) => {
    const rarity = userCard.card.rarity || 'unknown';
    if (!acc[rarity]) {
      acc[rarity] = [];
    }
    acc[rarity].push(userCard);
    return acc;
  }, {});

  const rarityOrder = ['legendary', 'rare', 'common', 'unknown'];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Card Collection</h1>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            Home
          </Link>
          <Link href="/collection" className={styles.navLink}>
            Collection
          </Link>
        </nav>
      </header>

      <div className={styles.walletSection}>
        <WalletConnect />
      </div>

      {!connected ? (
        <div className={styles.connectPrompt}>
          <p>Connect your wallet to view your card collection</p>
        </div>
      ) : loading ? (
        <div className={styles.loading}>Loading your collection...</div>
      ) : error ? (
        <div className={styles.error}>{error}</div>
      ) : collection.length === 0 ? (
        <div className={styles.emptyCollection}>
          <p>You don't have any cards yet.</p>
          <button 
            className={styles.shopButton}
            onClick={() => router.push('/')}
          >
            Buy Card Packs
          </button>
        </div>
      ) : (
        <div className={styles.collectionContainer}>
          {rarityOrder.map(rarity => {
            if (!groupedCards[rarity] || groupedCards[rarity].length === 0) return null;
            
            return (
              <div key={rarity} className={styles.raritySection}>
                <h2 className={styles.rarityTitle}>{rarity.charAt(0).toUpperCase() + rarity.slice(1)}</h2>
                <div className={styles.cardsGrid}>
                  {groupedCards[rarity].map(userCard => (
                    <div key={userCard.id} className={styles.cardItem}>
                      <div className={styles.cardImage}>
                        <img src={getCardImage(userCard.card)} alt={userCard.card.name} />
                      </div>
                      <div className={styles.cardInfo}>
                        <h3 className={styles.cardName}>{userCard.card.name}</h3>
                        <p className={styles.cardRarity}>{userCard.card.rarity}</p>
                        <p className={styles.cardQuantity}>Owned: {userCard.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 
