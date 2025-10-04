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

  // Get policy ID for Snekkies
  const getPolicyId = () => {
    if (!card || !card.attributes) return null;
    const policyAttr = card.attributes.find(attr => attr.trait_type === "Policy ID");
    return policyAttr ? policyAttr.value : null;
  };

  const policyId = getPolicyId();

  // Get image URL - for Snekkies use JPG Store CDN
  const getImageUrl = () => {
    // For Snekkies, use JPG Store's CDN which is reliable
    if (collection === 'Snekkies' && nftNumber && policyId) {
      // JPG Store hosts images as: https://ipfs.jpgstoreapis.com/{policyId}{assetNameHex}.png
      // We need to get the asset name hex from attributes
      const assetNameAttr = card.attributes?.find(attr => attr.trait_type === "Asset Name");
      if (assetNameAttr) {
        return `https://ipfs.jpgstoreapis.com/${policyId}${assetNameAttr.value}.png`;
      }
      // Fallback to pool.pm which also serves Cardano NFTs
      return `https://pool.pm/${policyId}.${nftNumber}`;
    }
    
    // For other collections, use the stored image URL
    return card.image || card.imageUrl || '/placeholder.png';
  };
  
  // Get fallback image URL - use pool.pm as ultimate fallback
  const getFallbackImage = () => {
    if (collection === 'Snekkies' && policyId && nftNumber) {
      return `https://pool.pm/${policyId}.${nftNumber}`;
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
