import React from 'react';
import Image from 'next/image';
import { getCardImage } from '../utils/gameHelpers';
import styles from './Card.module.css';
import { generateStatBars } from '../utils/frogData';

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
              src={getCardImage(card) || '/placeholder.png'}
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
              onError={(e) => {
                console.error('Failed to load image for card:', card.name, 'URL:', getCardImage(card));
                e.target.src = '/placeholder.png';
              }}
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
