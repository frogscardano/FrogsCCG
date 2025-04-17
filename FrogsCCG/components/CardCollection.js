import React, { useState, useEffect } from 'react';
import Card from './Card';

const CardCollection = ({ cards, title }) => {
  const [filteredCards, setFilteredCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  
  // Initialize and update filtered cards whenever the cards prop changes
  useEffect(() => {
    if (cards && Array.isArray(cards)) {
      setFilteredCards(cards);
    }
  }, [cards]);
  
  // Get unique rarities for filtering
  const rarities = cards && Array.isArray(cards) 
    ? [...new Set(cards.filter(card => card && card.rarity).map(card => card.rarity))]
    : [];
  
  // Handle search input change
  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    filterCards(term, filterRarity);
  };
  
  // Handle rarity filter change
  const handleRarityFilter = (e) => {
    const rarity = e.target.value;
    setFilterRarity(rarity);
    filterCards(searchTerm, rarity);
  };
  
  // Apply filters
  const filterCards = (term, rarity) => {
    if (!cards || !Array.isArray(cards)) return;
    
    let filtered = [...cards];
    
    // Apply search term filter
    if (term) {
      const lowerTerm = term.toLowerCase();
      filtered = filtered.filter(card => 
        (card.name && card.name.toLowerCase().includes(lowerTerm)) ||
        (card.description && card.description.toLowerCase().includes(lowerTerm))
      );
    }
    
    // Apply rarity filter
    if (rarity) {
      filtered = filtered.filter(card => card.rarity === rarity);
    }
    
    setFilteredCards(filtered);
  };
  
  return (
    <div className="card-collection">
      <h2>{title || 'Card Collection'}</h2>
      
      <div className="filters">
        <div className="search-filter">
          <input
            type="text"
            placeholder="Search cards..."
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
        
        {rarities.length > 0 && (
          <div className="rarity-filter">
            <select value={filterRarity} onChange={handleRarityFilter}>
              <option value="">All Rarities</option>
              {rarities.map((rarity, index) => (
                <option key={index} value={rarity}>{rarity}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="cards-grid">
        {filteredCards.length > 0 ? (
          filteredCards.map((card, index) => (
            <Card key={index} card={card} />
          ))
        ) : (
          <p className="no-cards">No cards found matching your filters.</p>
        )}
      </div>
    </div>
  );
};

export default CardCollection; 