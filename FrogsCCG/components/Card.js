import React, { useState } from 'react';
import Image from 'next/image';
import { getIpfsGatewayUrl } from '../utils/ipfs';

const Card = ({ card = {} }) => {
  const [flipped, setFlipped] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Determine image URL (front and back if available)
  let frontImageUrl = '/placeholder.png'; // Default to placeholder
  
  if (card && card.image) {
    if (card.image.startsWith('ipfs://')) {
      frontImageUrl = getIpfsGatewayUrl(card.image);
    } else if (card.image.startsWith('http')) {
      frontImageUrl = card.image;
    } else if (card.image.startsWith('/')) {
      // Local image
      frontImageUrl = card.image;
    }
  }
  
  const backImageUrl = card && card.backImage ? 
    (card.backImage.startsWith('ipfs://') ? getIpfsGatewayUrl(card.backImage) : card.backImage) : 
    '/card-back.png';
  
  const handleFlip = () => {
    setFlipped(!flipped);
  };
  
  const handleImageError = () => {
    console.log('Image failed to load:', frontImageUrl);
    setImageError(true);
  };
  
  return (
    <div 
      className="card-container" 
      onClick={handleFlip}
    >
      <div className={`card ${flipped ? 'flipped' : ''}`}>
        <div className="card-front">
          <div className="card-image-container">
            <Image
              src={imageError ? '/placeholder.png' : frontImageUrl}
              alt={(card && card.name) || 'Card'}
              width={250}
              height={350}
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain'
              }}
              priority
              onError={handleImageError}
              unoptimized={true}
            />
          </div>
          <div className="card-details">
            <h3>{(card && card.name) || 'Unknown Card'}</h3>
            {card && card.rarity && <p className="rarity">{card.rarity}</p>}
          </div>
        </div>
        
        <div className="card-back">
          <div className="card-image-container">
            <Image
              src={backImageUrl}
              alt="Card Back"
              width={250}
              height={350}
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain'
              }}
              onError={() => {}}
              unoptimized={true}
            />
          </div>
          <div className="card-details back-details">
            {card && card.description && <p>{card.description}</p>}
            {card && card.attributes && (
              <div className="attributes">
                {card.attributes.map((attr, index) => (
                  <div key={index} className="attribute">
                    <span className="attribute-name">{attr.trait_type || 'Trait'}:</span>
                    <span className="attribute-value">{attr.value || '-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card; 