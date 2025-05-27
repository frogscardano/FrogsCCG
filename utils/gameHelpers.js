/**
 * Utility functions for card games
 */

// Process card data to ensure consistent properties
export const processCardData = (card) => {
  return {
    ...card,
    id: card.id || card.tokenId || `card_${Math.random().toString(36).substr(2, 9)}`,
    name: card.name || 'Unknown Card',
    image: getCardImage(card),
    attack: card.attack || Math.floor(Math.random() * 5) + 1,
    health: card.health || Math.floor(Math.random() * 8) + 5,
    speed: card.speed || Math.floor(Math.random() * 10) + 1,
    element: card.element || getRandomElement(),
    rarity: card.rarity || getRandomRarity()
  };
};

// Get card image, handling different image property names
export const getCardImage = (card) => {
  if (!card) return '/placeholder-card.png';
  
  // Check various possible image properties
  if (card.image) return card.image;
  if (card.image_url) return card.image_url;
  if (card.imageUrl) return card.imageUrl;
  
  // Check for image in metadata
  if (card.metadata) {
    const metadata = typeof card.metadata === 'string' 
      ? JSON.parse(card.metadata) 
      : card.metadata;
    
    if (metadata.image) return metadata.image;
    if (metadata.image_url) return metadata.image_url;
  }
  
  return '/placeholder-card.png';
};

// Get a random element
export const getRandomElement = () => {
  const elements = ['fire', 'water', 'earth', 'air', 'light', 'dark'];
  return elements[Math.floor(Math.random() * elements.length)];
};

// Get a random rarity
export const getRandomRarity = () => {
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const weights = [50, 30, 15, 4, 1]; // Weighted chances
  
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i]) {
      return rarities[i];
    }
    random -= weights[i];
  }
  
  return rarities[0]; // Default to common
};

// Get color for element
export const getElementColor = (element) => {
  switch (element?.toLowerCase()) {
    case 'fire': return '#f44336';
    case 'water': return '#2196f3';
    case 'earth': return '#795548';
    case 'air': return '#9e9e9e';
    case 'light': return '#ffeb3b';
    case 'dark': return '#673ab7';
    default: return '#9e9e9e';
  }
};

// Get color for rarity
export const getRarityColor = (rarity) => {
  switch (rarity?.toLowerCase()) {
    case 'common': return '#9e9e9e';
    case 'uncommon': return '#4caf50';
    case 'rare': return '#2196f3';
    case 'epic': return '#9c27b0';
    case 'legendary': return '#ffc107';
    default: return '#9e9e9e';
  }
}; 