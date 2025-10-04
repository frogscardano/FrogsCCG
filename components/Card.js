import React, { useState } from 'react';
import styles from './Card.module.css';
import { generateStatBars } from '../utils/frogData';

const Card = ({ card, onClick, onDoubleClick, onDelete }) => {
  const [imgError, setImgError] = useState(false);
  const [gatewayIndex, setGatewayIndex] = useState(0);
  
  const stats = {
    attack: card?.attack || 0,
    health: card?.health || 0,
    speed: card?.speed || 0
  };

  // Generate stat bars HTML
  const statBars = generateStatBars(stats);

  // Get frog/NFT number from attributes
  const getNFTNumber = () => {
    if (!card || !card.attributes) return null;
    const numberAttr = card.attributes.find(attr => attr.trait_type === "Number");
    return numberAttr ? numberAttr.value : null;
  };

  // Get collection type
  const getCollection = () => {
    if (!card || !card.attributes) return null;
    const collAttr = card.attributes.find(attr => attr.trait_type === "Collection");
    return collAttr ? collAttr.value : null;
  };

  const nftNumber = getNFTNumber();
  const collection = getCollection();

  // Multiple IPFS gateways to try
  const IPFS_GATEWAYS = [
    'https://cloudflare-ipfs.com/ipfs',
    'https://gateway.pinata.cloud/ipfs',
    'https://ipfs.io/ipfs',
    'https://dweb.link/ipfs',
    'https://nftstorage.link/ipfs'
  ];

  // Collection-specific IPFS hashes for fallback
  const COLLECTION_IPFS = {
    'Snekkies': 'QmbtcFbvt8F9MRuzHkRAZ63cE2WcfTj7NDNeFSSPkw3PY3',
    'Titans': 'QmZGxPG7zLmYbNVZijx1Z6P3rZ2UFLtN5rWhrqFTJc9bMx',
    'Frogs': 'QmXwXzVg8CvnzFwxnvsjMNq7JAHVn3qyMbwpGumi5AJhXC'
  };

  // Get image URL with automatic fallback for Snekkies
  const getImageUrl = () => {
    // For Snekkies, ALWAYS use fallback URL with rotating gateways
    if (collection === 'Snekkies' && nftNumber) {
      const gateway = IPFS_GATEWAYS[gatewayIndex % IPFS_GATEWAYS.length];
      const ipfsHash = COLLECTION_IPFS['Snekkies'];
      return `${gateway}/${ipfsHash}/${nftNumber}.png`;
    }
    
    // For other collections, use the stored image URL
    return card.image || card.imageUrl || '/placeholder.png';
  };
  
  // Get fallback image URL based on collection
  const getFallbackImage = () => {
    if (!nftNumber) return '/placeholder.png';
    
    const ipfsHash = COLLECTION_IPFS[collection];
    if (ipfsHash) {
      // Try next gateway
      const nextGatewayIndex = (gatewayIndex + 1) % IPFS_GATEWAYS.length;
      const gateway = IPFS_GATEWAYS[nextGatewayIndex];
      return `${gateway}/${ipfsHash}/${nftNumber}.png`;
    }
    
    return '/placeholder.png';
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete && window.confirm(`Are you sure you want to delete "${card.name}"?`)) {
      onDelete(card);
    }
  };

  return (
    <div className={styles.card} onClick={() => onClick && onClick(card)} onDoubleClick={onDoubleClick ? (e) => { e.stopPropagation(); onDoubleClick(card); } : undefined}>
      {card ? (
        <>
          <div className={styles.cardImage}>
            <img
              src={imgError ? getFallbackImage() : getImageUrl()}
              alt={card.name || 'Card'}
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
              onError={() => {
                console.log(`Image load failed for ${card.name}, trying next gateway`);
                // Try next gateway
                if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
                  setGatewayIndex(gatewayIndex + 1);
                } else if (!imgError) {
                  // All gateways failed, use final fallback
                  setImgError(true);
                }
              }}
            />
            {nftNumber && <div className={styles.cardNumber}>#{nftNumber}</div>}
            {onDelete && (
              <button 
                className={styles.deleteButton}
                onClick={handleDelete}
                title="Delete card"
                aria-label="Delete card"
              >
                ×
              </button>
            )}
          </div>
          <div className={styles.stats}>
            <div className={styles.statLine}>
              <span className={styles.statLabel}>ATK:</span>
              <span className={styles.statValue}>{stats.attack}</span>
              <div className={styles.statBarContainer} 
                dangerouslySetInnerHTML={{__html: statBars.attackBar}} />
            </div>
            <div className={styles.statLine}>
              <span className={styles.statLabel}>HP:</span>
              <span className={styles.statValue}>{stats.health}</span>
              <div className={styles.statBarContainer} 
                dangerouslySetInnerHTML={{__html: statBars.healthBar}} />
            </div>
            <div className={styles.statLine}>
              <span className={styles.statLabel}>SPD:</span>
              <span className={styles.statValue}>{stats.speed}</span>
              <div className={styles.statBarContainer} 
                dangerouslySetInnerHTML={{__html: statBars.speedBar}} />
            </div>
          </div>
        </>
      ) : (
        <div className={styles.emptySlot}>
          <span>Empty Slot</span>
        </div>
      )}
    </div>
  );
};

export default Card; 
