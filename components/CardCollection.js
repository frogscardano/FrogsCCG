import React, { useState, useEffect } from 'react';
import Card from './Card';
import styles from './CardCollection.module.css';

const CardCollection = ({ cards, title, isLoading, onCardClick, onDeleteCard }) => {
  const [filteredCards, setFilteredCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRarity, setFilterRarity] = useState('');
  const [filterCollection, setFilterCollection] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 12;
  
  // Initialize and update filtered cards whenever the cards prop changes
  useEffect(() => {
    if (cards && Array.isArray(cards)) {
      setFilteredCards(cards);
      setCurrentPage(1); // Reset to first page when cards change
    }
  }, [cards]);
  
  // Get unique rarities for filtering
  const rarities = cards && Array.isArray(cards) 
    ? [...new Set(cards.filter(card => card && card.rarity).map(card => card.rarity))]
    : [];
    
  // Get unique collections for filtering
  const collections = cards && Array.isArray(cards)
    ? [...new Set(cards.filter(card => card && card.attributes)
        .map(card => {
          const collectionAttr = card.attributes.find(attr => attr.trait_type === "Collection");
          return collectionAttr ? collectionAttr.value : null;
        })
        .filter(Boolean))]
    : [];
  
  // Handle search input change
  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    filterAndSortCards(term, filterRarity, filterCollection, sortBy, sortOrder);
  };
  
  // Handle rarity filter change
  const handleRarityFilter = (e) => {
    const rarity = e.target.value;
    setFilterRarity(rarity);
    filterAndSortCards(searchTerm, rarity, filterCollection, sortBy, sortOrder);
  };
  
  // Handle collection filter change
  const handleCollectionFilter = (e) => {
    const collection = e.target.value;
    setFilterCollection(collection);
    filterAndSortCards(searchTerm, filterRarity, collection, sortBy, sortOrder);
  };
  
  // Handle sort change
  const handleSort = (e) => {
    const [newSortBy, newSortOrder] = e.target.value.split('-');
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    filterAndSortCards(searchTerm, filterRarity, filterCollection, newSortBy, newSortOrder);
  };
  
  // Apply filters and sorting
  const filterAndSortCards = (term, rarity, collection, sortField, order) => {
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
    
    // Apply collection filter
    if (collection) {
      filtered = filtered.filter(card => {
        const collectionAttr = card.attributes?.find(attr => attr.trait_type === "Collection");
        return collectionAttr && collectionAttr.value === collection;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      const comparison = aValue.toString().localeCompare(bValue.toString());
      return order === 'asc' ? comparison : -comparison;
    });
    
    setFilteredCards(filtered);
  };
  
  // Group cards by collection
  const groupCardsByCollection = (cards) => {
    const grouped = {};
    
    cards.forEach(card => {
      const collectionAttr = card.attributes?.find(attr => attr.trait_type === "Collection");
      const collection = collectionAttr ? collectionAttr.value : "Other";
      
      if (!grouped[collection]) {
        grouped[collection] = [];
      }
      
      grouped[collection].push(card);
    });
    
    return grouped;
  };
  
  // Calculate pagination
  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  const indexOfLastCard = currentPage * cardsPerPage;
  const indexOfFirstCard = indexOfLastCard - cardsPerPage;
  const currentCards = filteredCards.slice(indexOfFirstCard, indexOfLastCard);
  
  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Add double-click handler
  const handleCardDoubleClick = (card) => {
    // Find the next card in sequence
    if (!card || !card.name) return;
    const sequence = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const currentIndex = sequence.findIndex(val => val.toUpperCase() === card.name.toUpperCase());
    if (currentIndex === -1 || currentIndex === sequence.length - 1) return; // No next card
    const nextName = sequence[currentIndex + 1];

    // Find the index of the next card in filteredCards
    const nextCardIndex = filteredCards.findIndex(c => c && c.name && c.name.toUpperCase() === nextName);
    if (nextCardIndex === -1) return; // No next card slot

    // Find the index of the current card
    const currentCardIndex = filteredCards.findIndex(c => c && c.id === card.id);
    if (currentCardIndex === -1) return;

    // Swap the cards
    const newCards = [...filteredCards];
    const temp = newCards[nextCardIndex];
    newCards[nextCardIndex] = newCards[currentCardIndex];
    newCards[currentCardIndex] = temp;
    setFilteredCards(newCards);
  };
  
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading cards...</p>
      </div>
    );
  }
  
  // Group current cards by collection if no specific collection filter is applied
  const groupedCards = filterCollection ? null : groupCardsByCollection(currentCards);
  
  return (
    <div className={styles.container} role="region" aria-label="Card Collection">
      <h2 className={styles.title}>{title || 'Card Collection'}</h2>
      
      <div className={styles.filtersContainer}>
        <div className={styles.searchFilter}>
          <input
            type="text"
            placeholder="Search cards..."
            value={searchTerm}
            onChange={handleSearch}
            aria-label="Search cards"
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
          {rarities.length > 0 && (
            <div className={styles.filterGroup}>
              <label htmlFor="rarity-filter" className={styles.filterLabel}>Filter by Rarity:</label>
              <select
                id="rarity-filter"
                value={filterRarity}
                onChange={handleRarityFilter}
                aria-label="Filter by rarity"
                className={styles.filterSelect}
              >
                <option value="">All Rarities</option>
                {rarities.map((rarity, index) => (
                  <option key={index} value={rarity}>{rarity}</option>
                ))}
              </select>
            </div>
          )}
          
          {collections.length > 0 && (
            <div className={styles.filterGroup}>
              <label htmlFor="collection-filter" className={styles.filterLabel}>Filter by Collection:</label>
              <select
                id="collection-filter"
                value={filterCollection}
                onChange={handleCollectionFilter}
                aria-label="Filter by collection"
                className={styles.filterSelect}
              >
                <option value="">All Collections</option>
                {collections.map((collection, index) => (
                  <option key={index} value={collection}>{collection}</option>
                ))}
              </select>
            </div>
          )}
          
          <div className={styles.filterGroup}>
            <label htmlFor="sort-filter" className={styles.filterLabel}>Sort by:</label>
            <select
              id="sort-filter"
              value={`${sortBy}-${sortOrder}`}
              onChange={handleSort}
              aria-label="Sort cards"
              className={styles.filterSelect}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="rarity-asc">Rarity (Low-High)</option>
              <option value="rarity-desc">Rarity (High-Low)</option>
            </select>
          </div>
        </div>
      </div>
      
      {filterCollection || !groupedCards ? (
        // Regular grid view when filtering by collection or no groups available
        <div className={styles.grid} role="grid">
          {currentCards.length > 0 ? (
            currentCards.map((card, index) => (
              <div key={card.id || index} className={styles.cardWrapper}>
                <Card 
                  card={card}
                  onClick={onCardClick}
                  onDoubleClick={handleCardDoubleClick}
                  onDelete={onDeleteCard}
                />
              </div>
            ))
          ) : (
            <p className={styles.noCards}>No cards found matching your filters.</p>
          )}
        </div>
      ) : (
        // Grouped by collection view
        Object.keys(groupedCards).map(collection => (
          <div key={collection} className={styles.collectionGroup}>
            <h3 className={styles.collectionTitle}>{collection}</h3>
            <div className={styles.grid} role="grid">
              {groupedCards[collection].map((card, index) => (
                <div key={card.id || index} className={styles.cardWrapper}>
                  <Card 
                    key={card.id || index} 
                    card={card}
                    onClick={onCardClick}
                    onDoubleClick={handleCardDoubleClick}
                    onDelete={onDeleteCard}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      
      {totalPages > 1 && (
        <div className={styles.pagination} role="navigation" aria-label="Pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className={styles.paginationButton}
          >
            Previous
          </button>
          <span className={styles.paginationText}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className={styles.paginationButton}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CardCollection; 
