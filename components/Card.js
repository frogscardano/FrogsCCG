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

  // Extract IPFS hash from URL
  const getIpfsHash = (url) => {
    if (!url) return null;
    // Match patterns like: https://ipfs.io/ipfs/QmXXX or ipfs://QmXXX
    const match = url.match(/ipfs[:/]+([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  // Get image URL - convert ALL IPFS URLs to Cloudflare gateway (most reliable)
  const getImageUrl = () => {
    const imageUrl = card.image || card.imageUrl;
    
    // Convert ALL IPFS URLs to use Cloudflare gateway
    const ipfsHash = getIpfsHash(imageUrl);
    if (ipfsHash) {
      // Use Cloudflare IPFS gateway - most reliable public gateway
      return `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
    }
    
    // If not IPFS, return as is
    return imageUrl || '/placeholder.png';
  };
  
  // Get fallback image URL - try alternative gateways
  const getFallbackImage = () => {
    const imageUrl = card.image || card.imageUrl;
    const ipfsHash = getIpfsHash(imageUrl);
    
    if (ipfsHash) {
      // Try different gateways in order
      if (gatewayIndex === 0) return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
      if (gatewayIndex === 1) return `https://dweb.link/ipfs/${ipfsHash}`;
      if (gatewayIndex === 2) return `https://ipfs.io/ipfs/${ipfsHash}`;
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
                console.log(`Image load failed for ${card.name}, trying gateway ${gatewayIndex + 1}`);
                // Try up to 3 different gateways
                if (gatewayIndex < 2) {
                  setGatewayIndex(gatewayIndex + 1);
                } else if (!imgError) {
                  // All gateways failed
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
