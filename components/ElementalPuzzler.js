import React, { useState, useEffect } from 'react';
import styles from './CardCollection.module.css';
import Card from './Card';

const ElementalPuzzler = ({ cards, onGameComplete }) => {
  const GRID_SIZE = 6; // 6x6 grid
  const MIN_MATCH = 3; // Minimum 3 cards to match
  
  const [gridCards, setGridCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); // 60 second game
  const [gameStatus, setGameStatus] = useState('setup'); // setup, playing, complete
  const [matches, setMatches] = useState(0);
  const [difficulty, setDifficulty] = useState('easy');
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [intervalId, setIntervalId] = useState(null);
  
  // Game settings based on difficulty
  const difficultySettings = {
    easy: { timeLimit: 90, scoreGoal: 1000, rows: 6, cols: 6 },
    medium: { timeLimit: 60, scoreGoal: 2000, rows: 6, cols: 6  },
    hard: { timeLimit: 45, scoreGoal: 3000, rows: 6, cols: 6 }
  };
  
  // Get a random element for cards
  const getRandomElement = () => {
    const elements = ['fire', 'water', 'earth', 'air', 'light', 'dark'];
    return elements[Math.floor(Math.random() * elements.length)];
  };
  
  // Get a random rarity for cards
  const getRandomRarity = () => {
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
  
  // Ensure the grid has at least a few potential matches
  const ensureMatches = (grid, rows, cols) => {
    // Check if there are any matches already
    const hasMatches = checkForPotentialMatches(grid, rows, cols);
    if (hasMatches) return grid;
    
    // If no matches, create at least one match
    const newGrid = [...grid];
    const row = Math.floor(Math.random() * (rows - 2)); // Avoid last 2 rows
    const col = Math.floor(Math.random() * (cols - 2)); // Avoid last 2 columns
    
    // Choose a random card to duplicate
    const randomCard = { ...newGrid[row][Math.floor(Math.random() * cols)] };
    
    // Create a horizontal match (3 in a row)
    newGrid[row][col] = { ...randomCard, row, col };
    newGrid[row][col+1] = { ...randomCard, row, col: col+1 };
    newGrid[row][col+2] = { ...randomCard, row, col: col+2 };
    
    return newGrid;
  };
  
  // Check if there are any potential matches in the grid
  const checkForPotentialMatches = (grid, rows, cols) => {
    // Check horizontal matches
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 2; c++) {
        const card1 = grid[r][c];
        const card2 = grid[r][c+1];
        const card3 = grid[r][c+2];
        
        if (areCardsMatching(card1, card2) && areCardsMatching(card1, card3)) {
          return true;
        }
      }
    }
    
    // Check vertical matches
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows - 2; r++) {
        const card1 = grid[r][c];
        const card2 = grid[r+1][c];
        const card3 = grid[r+2][c];
        
        if (areCardsMatching(card1, card2) && areCardsMatching(card1, card3)) {
          return true;
        }
      }
    }
    
    return false;
  };
  
  // Initialize game
  const startGame = () => {
    if (!cards || cards.length === 0) return;
    
    // Process cards to ensure all have consistent properties
    const processedCards = cards.map(card => ({
      ...card,
      id: card.id || card.tokenId || `card_${Math.random().toString(36).substr(2, 9)}`,
      name: card.name || 'Unknown Card',
      image: card.image || card.image_url || '/placeholder-card.png',
      element: card.element || getRandomElement(),
      rarity: card.rarity || getRandomRarity()
    }));
    
    console.log("Processed cards:", processedCards.length);
    
    // Reset game state
    setGridCards([]);
    setScore(0);
    setMatches(0);
    setSelectedCard(null);
    setGameStatus('playing');
    setTimeLeft(difficultySettings[difficulty].timeLimit);
    setMoves(0);
    setComboMultiplier(1);
    
    // Clear any existing timer
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    // Start timer
    const id = setInterval(() => {
      if (gameStatus === 'playing' && timeLeft > 0) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(id);
            endGame(false);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    
    setIntervalId(id);
    
    // Initialize grid
    const numRows = difficultySettings[difficulty].rows;
    const numCols = difficultySettings[difficulty].cols;
    
    // Create initial grid with random cards
    let newGrid = [];
    
    for (let r = 0; r < numRows; r++) {
      let row = [];
      for (let c = 0; c < numCols; c++) {
        // Pick a random card from the processed cards
        const randomIndex = Math.floor(Math.random() * processedCards.length);
        const card = processedCards[randomIndex];
        
        row.push({
          ...card,
          matched: false,
          row: r,
          col: c
        });
      }
      newGrid.push(row);
    }
    
    // Ensure grid has at least a few potential matches
    newGrid = ensureMatches(newGrid, numRows, numCols);
    
    setGridCards(newGrid);
  };
  
  // Get unique card properties for matching (collections, rarities, etc.)
  const getCardTypes = (cardList) => {
    const collections = new Set();
    const rarities = new Set();
    
    cardList.forEach(card => {
      if (card.rarity) rarities.add(card.rarity);
      
      // Extract collection from attributes if available
      if (card.attributes) {
        const collectionAttr = card.attributes.find(attr => 
          attr.trait_type === "Collection"
        );
        if (collectionAttr && collectionAttr.value) {
          collections.add(collectionAttr.value);
        }
      }
    });
    
    return {
      collections: [...collections],
      rarities: [...rarities]
    };
  };
  
  // Generate a grid with guaranteed matches possible
  const generateBalancedGrid = (cardList, cardTypes) => {
    const grid = [];
    const shuffledCards = [...cardList].sort(() => 0.5 - Math.random());
    
    // Fill grid with random cards
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const randomIndex = Math.floor(Math.random() * shuffledCards.length);
      const cardToAdd = {
        ...shuffledCards[randomIndex],
        gridId: `grid-${i}`,
        gridPosition: i
      };
      grid.push(cardToAdd);
    }
    
    // Ensure at least a few matches are possible at start
    let hasInitialMatches = false;
    
    // Check for potential matches
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (hasPotentialMatch(grid, r, c)) {
          hasInitialMatches = true;
          break;
        }
      }
      if (hasInitialMatches) break;
    }
    
    // If no matches found, force at least one match
    if (!hasInitialMatches) {
      // Create a horizontal match at a random position
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * (GRID_SIZE - 2));
      
      const matchCard = shuffledCards[0];
      grid[row * GRID_SIZE + col] = { ...matchCard, gridId: `grid-${row * GRID_SIZE + col}`, gridPosition: row * GRID_SIZE + col };
      grid[row * GRID_SIZE + col + 1] = { ...matchCard, gridId: `grid-${row * GRID_SIZE + col + 1}`, gridPosition: row * GRID_SIZE + col + 1 };
      grid[row * GRID_SIZE + col + 2] = { ...matchCard, gridId: `grid-${row * GRID_SIZE + col + 2}`, gridPosition: row * GRID_SIZE + col + 2 };
    }
    
    return grid;
  };
  
  // Check if a position has a potential match
  const hasPotentialMatch = (grid, row, col) => {
    const index = row * GRID_SIZE + col;
    const card = grid[index];
    
    if (!card) return false;
    
    // Check horizontally
    if (col < GRID_SIZE - 2) {
      const card1 = grid[index + 1];
      const card2 = grid[index + 2];
      if (areCardsMatching(card, card1) && areCardsMatching(card, card2)) {
        return true;
      }
    }
    
    // Check vertically
    if (row < GRID_SIZE - 2) {
      const card1 = grid[index + GRID_SIZE];
      const card2 = grid[index + GRID_SIZE * 2];
      if (areCardsMatching(card, card1) && areCardsMatching(card, card2)) {
        return true;
      }
    }
    
    return false;
  };
  
  // Check if two cards match based on properties
  const areCardsMatching = (card1, card2) => {
    if (!card1 || !card2) return false;
    
    // Match by rarity
    if (card1.rarity && card2.rarity && card1.rarity === card2.rarity) {
      return true;
    }
    
    // Match by collection (from attributes)
    if (card1.attributes && card2.attributes) {
      const collection1 = card1.attributes.find(attr => attr.trait_type === "Collection")?.value;
      const collection2 = card2.attributes.find(attr => attr.trait_type === "Collection")?.value;
      
      if (collection1 && collection2 && collection1 === collection2) {
        return true;
      }
    }
    
    return false;
  };
  
  // Handle card selection
  const handleCardSelect = (index) => {
    if (gameStatus !== 'playing') return;
    
    if (selectedCard === null) {
      setSelectedCard(index);
    } else if (selectedCard === index) {
      setSelectedCard(null);
    } else {
      // Try to swap cards
      if (areAdjacent(selectedCard, index)) {
        swapCards(selectedCard, index);
        setSelectedCard(null);
        setMoves(moves + 1);
      } else {
        setSelectedCard(index);
      }
    }
  };
  
  // Check if two positions are adjacent
  const areAdjacent = (pos1, pos2) => {
    const row1 = Math.floor(pos1 / GRID_SIZE);
    const col1 = pos1 % GRID_SIZE;
    const row2 = Math.floor(pos2 / GRID_SIZE);
    const col2 = pos2 % GRID_SIZE;
    
    return (
      (row1 === row2 && Math.abs(col1 - col2) === 1) || // Adjacent horizontally
      (col1 === col2 && Math.abs(row1 - row2) === 1)    // Adjacent vertically
    );
  };
  
  // Swap two cards
  const swapCards = (pos1, pos2) => {
    const newGrid = [...gridCards];
    const temp = { ...newGrid[pos1] };
    
    // Update grid positions
    newGrid[pos1] = { ...newGrid[pos2], gridPosition: pos1 };
    newGrid[pos2] = { ...temp, gridPosition: pos2 };
    
    setGridCards(newGrid);
    
    // After swapping, check for matches
    setTimeout(() => {
      const matchFound = findAndRemoveMatches(newGrid);
      
      // If no match found, swap back
      if (!matchFound) {
        const revertGrid = [...newGrid];
        revertGrid[pos2] = { ...newGrid[pos1], gridPosition: pos2 };
        revertGrid[pos1] = { ...newGrid[pos2], gridPosition: pos1 };
        setGridCards(revertGrid);
      }
    }, 300);
  };
  
  // Find and remove matches
  const findAndRemoveMatches = (grid) => {
    const matches = findMatches(grid);
    
    if (matches.length === 0) {
      return false;
    }
    
    // Remove matched cards (replace with null)
    let newGrid = [...grid];
    let matchedCardCount = 0;
    
    matches.forEach(matchGroup => {
      matchedCardCount += matchGroup.length;
      
      matchGroup.forEach(pos => {
        // Calculate score based on card rarity and match size
        const card = newGrid[pos];
        let pointValue = 10; // Base points
        
        if (card.rarity) {
          switch(card.rarity.toLowerCase()) {
            case 'common': pointValue = 10; break;
            case 'uncommon': pointValue = 15; break;
            case 'rare': pointValue = 25; break;
            case 'epic': pointValue = 40; break;
            case 'legendary': pointValue = 75; break;
            default: pointValue = 10;
          }
        }
        
        // Multiply by combo multiplier
        const earnedPoints = pointValue * comboMultiplier * (matchGroup.length > MIN_MATCH ? 1.5 : 1);
        setScore(prev => Math.floor(prev + earnedPoints));
        
        // Replace with null (empty space)
        newGrid[pos] = null;
      });
    });
    
    setMatches(prev => prev + matches.length);
    
    // Increase combo multiplier
    setComboMultiplier(prev => Math.min(5, prev + 0.5));
    
    // Fill in empty spaces
    newGrid = fillEmptySpaces(newGrid);
    setGridCards(newGrid);
    
    // Check for additional matches after filling
    setTimeout(() => {
      const hasMoreMatches = findAndRemoveMatches(newGrid);
      
      // If no more matches, reset combo multiplier
      if (!hasMoreMatches) {
        setComboMultiplier(1);
      }
    }, 500);
    
    return true;
  };
  
  // Find all matches in the grid
  const findMatches = (grid) => {
    const matches = [];
    
    // Check horizontal matches
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE - 2; col++) {
        const pos1 = row * GRID_SIZE + col;
        const pos2 = pos1 + 1;
        const pos3 = pos1 + 2;
        
        const card1 = grid[pos1];
        const card2 = grid[pos2];
        const card3 = grid[pos3];
        
        if (card1 && card2 && card3 && areCardsMatching(card1, card2) && areCardsMatching(card1, card3)) {
          // Check if we can extend the match further
          let matchGroup = [pos1, pos2, pos3];
          
          if (col < GRID_SIZE - 3) {
            const pos4 = pos1 + 3;
            const card4 = grid[pos4];
            
            if (card4 && areCardsMatching(card1, card4)) {
              matchGroup.push(pos4);
              
              if (col < GRID_SIZE - 4) {
                const pos5 = pos1 + 4;
                const card5 = grid[pos5];
                
                if (card5 && areCardsMatching(card1, card5)) {
                  matchGroup.push(pos5);
                }
              }
            }
          }
          
          matches.push(matchGroup);
        }
      }
    }
    
    // Check vertical matches
    for (let col = 0; col < GRID_SIZE; col++) {
      for (let row = 0; row < GRID_SIZE - 2; row++) {
        const pos1 = row * GRID_SIZE + col;
        const pos2 = pos1 + GRID_SIZE;
        const pos3 = pos1 + (GRID_SIZE * 2);
        
        const card1 = grid[pos1];
        const card2 = grid[pos2];
        const card3 = grid[pos3];
        
        if (card1 && card2 && card3 && areCardsMatching(card1, card2) && areCardsMatching(card1, card3)) {
          // Check if we can extend the match further
          let matchGroup = [pos1, pos2, pos3];
          
          if (row < GRID_SIZE - 3) {
            const pos4 = pos1 + (GRID_SIZE * 3);
            const card4 = grid[pos4];
            
            if (card4 && areCardsMatching(card1, card4)) {
              matchGroup.push(pos4);
              
              if (row < GRID_SIZE - 4) {
                const pos5 = pos1 + (GRID_SIZE * 4);
                const card5 = grid[pos5];
                
                if (card5 && areCardsMatching(card1, card5)) {
                  matchGroup.push(pos5);
                }
              }
            }
          }
          
          matches.push(matchGroup);
        }
      }
    }
    
    return matches;
  };
  
  // Fill empty spaces in the grid by shifting cards down and adding new ones
  const fillEmptySpaces = (grid) => {
    const newGrid = [...grid];
    
    // For each column, starting from the bottom
    for (let col = 0; col < GRID_SIZE; col++) {
      // Find empty cells and shift cards down
      for (let row = GRID_SIZE - 1; row >= 0; row--) {
        const pos = row * GRID_SIZE + col;
        
        if (newGrid[pos] === null) {
          // Find the nearest non-null cell above
          let sourceRow = row - 1;
          let sourcePos = -1;
          
          while (sourceRow >= 0) {
            const currentPos = sourceRow * GRID_SIZE + col;
            if (newGrid[currentPos] !== null) {
              sourcePos = currentPos;
              break;
            }
            sourceRow--;
          }
          
          if (sourcePos !== -1) {
            // Move the card down
            newGrid[pos] = { ...newGrid[sourcePos], gridPosition: pos };
            newGrid[sourcePos] = null;
          }
        }
      }
      
      // Fill any remaining empty cells at the top with new cards
      for (let row = 0; row < GRID_SIZE; row++) {
        const pos = row * GRID_SIZE + col;
        
        if (newGrid[pos] === null) {
          // Choose a random card from the deck
          const randomIndex = Math.floor(Math.random() * cards.length);
          newGrid[pos] = { 
            ...cards[randomIndex], 
            gridId: `grid-new-${Date.now()}-${pos}`,
            gridPosition: pos
          };
        }
      }
    }
    
    return newGrid;
  };
  
  // Timer effect
  useEffect(() => {
    let timerId;
    
    if (gameStatus === 'playing' && timeLeft > 0) {
      timerId = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerId);
            endGame(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [gameStatus, timeLeft]);
  
  // End the game
  const endGame = (goalAchieved) => {
    setGameStatus('complete');
    
    // Calculate final score and rewards
    const scoreGoal = difficultySettings[difficulty].scoreGoal;
    const isGoalAchieved = score >= scoreGoal;
    
    // Base reward on score and difficulty
    let rewardPoints = Math.floor(score / 100);
    
    // Bonus for achieving goal
    if (isGoalAchieved) {
      rewardPoints += 10;
    }
    
    // Bonus for higher difficulties
    if (difficulty === 'medium') {
      rewardPoints = Math.floor(rewardPoints * 1.5);
    } else if (difficulty === 'hard') {
      rewardPoints = Math.floor(rewardPoints * 2);
    }
    
    // Call the completion callback
    if (onGameComplete) {
      onGameComplete({
        score,
        moves,
        matches,
        timeElapsed: difficultySettings[difficulty].timeLimit - timeLeft,
        difficulty,
        goalAchieved: isGoalAchieved,
        rewardPoints
      });
    }
  };
  
  // Format time remaining
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Restart game
  const restartGame = () => {
    setGameStatus('setup');
  };
  
  // Render setup screen
  if (gameStatus === 'setup') {
    return (
      <div className={styles.puzzleSetup}>
        <h2>Elemental Puzzler</h2>
        <p>Match 3 or more cards with the same rarity or collection to earn points!</p>
        
        <div className={styles.difficultySelect}>
          <h3>Select Difficulty</h3>
          <div className={styles.difficultyOptions}>
            <button 
              className={`${styles.difficultyButton} ${difficulty === 'easy' ? styles.selected : ''}`}
              onClick={() => setDifficulty('easy')}
            >
              Easy
              <span className={styles.difficultyInfo}>90 seconds, 1000 points to win</span>
            </button>
            
            <button 
              className={`${styles.difficultyButton} ${difficulty === 'medium' ? styles.selected : ''}`}
              onClick={() => setDifficulty('medium')}
            >
              Medium
              <span className={styles.difficultyInfo}>60 seconds, 2000 points to win</span>
            </button>
            
            <button 
              className={`${styles.difficultyButton} ${difficulty === 'hard' ? styles.selected : ''}`}
              onClick={() => setDifficulty('hard')}
            >
              Hard
              <span className={styles.difficultyInfo}>45 seconds, 3000 points to win</span>
            </button>
          </div>
          
          <button 
            className={styles.actionButton} 
            onClick={startGame}
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }
  
  // Render complete screen
  if (gameStatus === 'complete') {
    const isGoalAchieved = score >= difficultySettings[difficulty].scoreGoal;
    
    return (
      <div className={styles.puzzleComplete}>
        <h2>{isGoalAchieved ? 'Victory!' : 'Game Over'}</h2>
        
        <div className={styles.resultsContainer}>
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Final Score:</span>
            <span className={styles.resultValue}>{score}</span>
          </div>
          
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Goal:</span>
            <span className={styles.resultValue}>{difficultySettings[difficulty].scoreGoal}</span>
          </div>
          
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Matches Made:</span>
            <span className={styles.resultValue}>{matches}</span>
          </div>
          
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Moves Used:</span>
            <span className={styles.resultValue}>{moves}</span>
          </div>
          
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Time Elapsed:</span>
            <span className={styles.resultValue}>{formatTime(difficultySettings[difficulty].timeLimit - timeLeft)}</span>
          </div>
          
          <div className={styles.resultItem}>
            <span className={styles.resultLabel}>Difficulty:</span>
            <span className={styles.resultValue}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
          </div>
          
          <div className={styles.rewardInfo}>
            <h3>Rewards Earned</h3>
            <p>{Math.floor(score / 100) + (isGoalAchieved ? 10 : 0)} points</p>
          </div>
          
          <button 
            className={styles.actionButton} 
            onClick={restartGame}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }
  
  // Render game screen
  return (
    <div className={styles.puzzleGame}>
      <div className={styles.gameHeader}>
        <div className={styles.scoreContainer}>
          <div className={styles.scoreItem}>
            <span className={styles.scoreLabel}>Score:</span>
            <span className={styles.scoreValue}>{score}</span>
          </div>
          
          <div className={styles.scoreItem}>
            <span className={styles.scoreLabel}>Goal:</span>
            <span className={styles.scoreValue}>{difficultySettings[difficulty].scoreGoal}</span>
          </div>
          
          <div className={styles.scoreItem}>
            <span className={styles.scoreLabel}>Combo:</span>
            <span className={styles.scoreValue}>{comboMultiplier.toFixed(1)}x</span>
          </div>
        </div>
        
        <div className={styles.timerContainer}>
          <div className={styles.timer}>
            <div 
              className={styles.timerBar} 
              style={{ 
                width: `${(timeLeft / difficultySettings[difficulty].timeLimit) * 100}%`,
                backgroundColor: timeLeft < 10 ? '#e74c3c' : '#2ecc71'
              }}
            ></div>
            <span className={styles.timerText}>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>
      
      <div className={styles.puzzleGrid}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
          const card = gridCards[index];
          
          return (
            <div 
              key={card ? card.gridId : `empty-${index}`} 
              className={`${styles.puzzleCell} ${selectedCard === index ? styles.selected : ''}`}
              onClick={() => handleCardSelect(index)}
            >
              {card && (
                <div className={styles.puzzleCardContainer}>
                  <img 
                    src={card.image || '/placeholder.png'} 
                    alt={card.name} 
                    className={styles.puzzleCardImage}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/placeholder.png';
                    }}
                  />
                  <div className={styles.puzzleCardOverlay}>
                    {card.rarity && (
                      <div className={styles.cardRarityIndicator} style={{
                        backgroundColor: 
                          card.rarity.toLowerCase() === 'common' ? '#aaa' :
                          card.rarity.toLowerCase() === 'uncommon' ? '#4db33d' :
                          card.rarity.toLowerCase() === 'rare' ? '#3d85c6' :
                          card.rarity.toLowerCase() === 'epic' ? '#9900ff' :
                          card.rarity.toLowerCase() === 'legendary' ? '#f1c232' : '#aaa'
                      }}></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ElementalPuzzler; 