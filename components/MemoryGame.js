import React, { useState, useEffect, useRef } from 'react';
import styles from './CardCollection.module.css';
import Card from './Card';

const MemoryGame = ({ cards, onGameComplete }) => {
  const [gameCards, setGameCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState('easy');
  const [timer, setTimer] = useState(0);
  const [intervalId, setIntervalId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gameContainerRef = useRef(null);
  
  // Initialize game
  const startGame = () => {
    if (!cards || cards.length === 0) return;
    
    // Determine number of pairs based on difficulty
    let numPairs;
    switch (difficulty) {
      case 'easy': numPairs = 6; break;
      case 'medium': numPairs = 9; break;
      case 'hard': numPairs = 12; break;
      default: numPairs = 6;
    }
    
    // Reset game state
    setFlippedIndices([]);
    setMatchedPairs([]);
    setMoves(0);
    setTimer(0);
    
    // Clear any existing timer
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    // Start timer
    const id = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
    setIntervalId(id);
    
    // Select random cards for the game
    const shuffledCards = [...cards].sort(() => 0.5 - Math.random());
    const selectedCards = shuffledCards.slice(0, Math.min(numPairs, cards.length));
    
    // Create pairs (double the cards)
    const gameDeck = [...selectedCards, ...selectedCards].map((card, index) => ({
      ...card,
      gameId: `${card.id}_${index}` // Create unique ID for each card instance
    }));
    
    // Shuffle the deck
    const shuffledDeck = gameDeck.sort(() => 0.5 - Math.random());
    
    setGameCards(shuffledDeck);
    setGameStarted(true);
  };
  
  // Handle card click
  const handleCardClick = (index) => {
    // Prevent clicking if already flipped or matched
    if (
      flippedIndices.includes(index) || 
      matchedPairs.some(pair => pair.includes(index)) ||
      flippedIndices.length >= 2
    ) {
      return;
    }
    
    // Flip card
    const newFlippedIndices = [...flippedIndices, index];
    setFlippedIndices(newFlippedIndices);
    
    // If two cards are flipped, check for match
    if (newFlippedIndices.length === 2) {
      setMoves(moves + 1);
      
      const [firstIndex, secondIndex] = newFlippedIndices;
      const firstCard = gameCards[firstIndex];
      const secondCard = gameCards[secondIndex];
      
      // Check if it's a match (same card ID)
      if (firstCard.id === secondCard.id) {
        // Add to matched pairs
        setMatchedPairs([...matchedPairs, newFlippedIndices]);
        setFlippedIndices([]);
      } else {
        // Flip back after delay
        setTimeout(() => {
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };
  
  // Check for game completion
  useEffect(() => {
    if (gameStarted && matchedPairs.length > 0 && matchedPairs.length * 2 === gameCards.length) {
      // Game completed
      
      // Stop timer
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
      
      // Calculate score
      const baseScore = 1000;
      const timePenalty = Math.min(500, timer * 2);
      const movesPenalty = Math.min(500, moves * 10);
      const score = Math.max(0, baseScore - timePenalty - movesPenalty);
      
      // Determine rewards based on difficulty and score
      let rewardPoints = 0;
      
      if (difficulty === 'easy') {
        rewardPoints = Math.floor(score / 200);
      } else if (difficulty === 'medium') {
        rewardPoints = Math.floor(score / 150);
      } else {
        rewardPoints = Math.floor(score / 100);
      }
      
      // Call the completion callback
      if (onGameComplete) {
        onGameComplete({
          score,
          moves,
          timeSeconds: timer,
          rewardPoints
        });
      }
    }
  }, [matchedPairs, gameCards, gameStarted, moves, timer, intervalId, difficulty, onGameComplete]);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);
  
  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      gameContainerRef.current.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };
  
  // Effect to listen for fullscreen changes (e.g., user pressing Esc)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  if (!gameStarted) {
    return (
      <div className={styles.gameSetup}>
        <h2>Memory Match Game</h2>
        <p>Match pairs of cards to earn rewards! Better score = better rewards.</p>
        
        <div className={styles.difficultySelect}>
          <div className={styles.formGroup}>
            <label>Difficulty:</label>
            <select 
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">Easy (6 pairs)</option>
              <option value="medium">Medium (9 pairs)</option>
              <option value="hard">Hard (12 pairs)</option>
            </select>
          </div>
        </div>
        
        <button 
          className={styles.actionButton}
          onClick={startGame}
        >
          Start Game
        </button>
      </div>
    );
  }
  
  return (
    <div className={styles.gameContainer} ref={gameContainerRef}>
      <div className={styles.gameInfo}>
        <div className={styles.gameStats}>
          <span>Moves: {moves}</span>
          <span>Time: {formatTime(timer)}</span>
        </div>
        <button 
          className={styles.restartButton}
          onClick={startGame}
        >
          Restart
        </button>
        <button 
          className={styles.actionButton}
          onClick={toggleFullscreen}
          style={{marginLeft: '10px'}}
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>
      
      <div className={`${styles.memoryGrid} ${styles[difficulty]}`}>
        {gameCards.map((card, index) => (
          <div
            key={card.gameId}
            className={`${styles.memoryCard} ${
              flippedIndices.includes(index) || matchedPairs.some(pair => pair.includes(index))
                ? styles.flipped
                : ''
            } ${
              matchedPairs.some(pair => pair.includes(index)) ? styles.matched : ''
            }`}
            onClick={() => handleCardClick(index)}
          >
            <div className={styles.cardInner}>
              <div className={styles.cardFront}>
                <div className={styles.cardBack}>
                  <img src="/card-back.png" alt="Card back" width="100%" height="auto" />
                </div>
              </div>
              <div className={styles.cardBack}>
                <Card card={card} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemoryGame; 