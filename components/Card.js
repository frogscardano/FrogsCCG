import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import styles from './Card.module.css';
import { generateStatBars } from '../utils/frogData';

// Known fallback IPFS CIDs for collections
const COLLECTION_FALLBACK_CIDS = {
  Frogs: 'QmXwXzVg8CvnzFwxnvsjMNq7JAHVn3qyMbwpGumi5AJhXC',
  Snekkies: 'QmbtcFbvt8F9MRuzHkRAZ63cE2WcfTj7NDNeFSSPkw3PY3',
  Titans: 'QmZGxPG7zLmYbNVZijx1Z6P3rZ2UFLtN5rWhrqFTJc9bMx',
};

function normalizeIpfsUrl(url, gateway = 'ipfs.io') {
  if (!url) return null;
  if (url.startsWith('ipfs://')) {
    const path = url.slice('ipfs://'.length);
    return `https://${gateway}/ipfs/${path}`;
  }
  const m = url.match(/^https?:\/\/[^/]*ipfs[^/]*\/ipfs\/(.+)$/i);
  if (m) return `https://${gateway}/ipfs/${m[1]}`;
  return url;
}

function buildImageCandidates(card) {
  const urls = [];
  const gateways = ['ipfs.io', 'cloudflare-ipfs.com', 'dweb.link', 'gateway.pinata.cloud'];

  const primary = card?.image || card?.imageUrl;
  if (primary) {
    const normalized = normalizeIpfsUrl(primary, 'ipfs.io');
    if (normalized) {
      urls.push(normalized);
      const match = normalized.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i);
      if (match) {
        const path = match[1];
        gateways.forEach(gw => urls.push(`https://${gw}/ipfs/${path}`));
      }
    } else {
      urls.push(primary);
    }
  }

  // Collection-specific number-based fallback
  const numberAttr = card?.attributes?.find(a => a.trait_type === 'Number');
  const collectionAttr = card?.attributes?.find(a => a.trait_type === 'Collection');
  const number = numberAttr?.value;
  const collection = collectionAttr?.value;
  const cid = collection ? COLLECTION_FALLBACK_CIDS[collection] : null;
  if (cid && number) {
    gateways.forEach(gw => urls.push(`https://${gw}/ipfs/${cid}/${number}.png`));
  }

  // Deduplicate while preserving order
  return Array.from(new Set(urls.filter(Boolean)));
}

const Card = ({ card, onClick, onDoubleClick, onDelete }) => {
  const stats = {
    attack: card?.attack || 0,
    health: card?.health || 0,
    speed: card?.speed || 0
  };

  // Generate stat bars HTML
  const statBars = generateStatBars(stats);

  // Get frog number from attributes
  const getFrogNumber = () => {
    if (!card || !card.attributes) return null;
    const numberAttr = card.attributes.find(attr => attr.trait_type === "Number");
    return numberAttr ? numberAttr.value : null;
  };

  const frogNumber = getFrogNumber();

  // Robust image loading with multi-gateway and collection fallback
  const candidates = useMemo(() => buildImageCandidates(card), [card]);
  const [imgIndex, setImgIndex] = useState(0);
  const currentSrc = candidates[imgIndex] || '/placeholder.png';

  const handleImageError = (e) => {
    setImgIndex(prev => {
      const next = prev + 1;
      if (next < candidates.length) {
        return next;
      }
      // Last resort placeholder
      if (e && e.target) {
        try {
          e.target.src = '/placeholder.png';
        } catch (_) {}
      }
      return prev; // stay on last; src already swapped to placeholder
    });
    // Log once per failure step
    console.warn('Image failed, trying next candidate', {
      name: card?.name,
      tried: candidates[imgIndex]
    });
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
            <Image
              key={currentSrc}
              src={currentSrc}
              alt={card.name || 'Card'}
              width={160}
              height={160}
              style={{
                objectFit: 'contain',
                borderRadius: '4px',
                maxWidth: '100%',
                height: 'auto'
              }}
              priority
              unoptimized={true}
              onError={handleImageError}
            />
            {frogNumber && <div className={styles.cardNumber}>#{frogNumber}</div>}
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
