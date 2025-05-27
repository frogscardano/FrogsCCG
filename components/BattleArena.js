import React, { useState, useEffect } from 'react';
import styles from './CardCollection.module.css';
import Card from './Card';

const BattleArena = ({ cards, onGameComplete }) => {
  const [playerTeam, setPlayerTeam] = useState([]);
  const [enemyTeam, setEnemyTeam] = useState([]);
  const [availableCards, setAvailableCards] = useState([]);
  const [phase, setPhase] = useState('setup'); // setup, battle, results
  const [currentTurn, setCurrentTurn] = useState(null); // player or enemy
  const [battleLog, setBattleLog] = useState([]);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null);
  const [targetCardIndex, setTargetCardIndex] = useState(null);
  const [turnNumber, setTurnNumber] = useState(1);
  const [winner, setWinner] = useState(null);
  
  // Setup the game
  useEffect(() => {
    if (cards && cards.length > 0) {
      // Process cards to ensure all have consistent properties
      const processedCards = cards.map(card => ({
        ...card,
        id: card.id || card.tokenId || `card_${Math.random().toString(36).substr(2, 9)}`,
        name: card.name || 'Unknown Card',
        image: card.image || card.image_url || '/placeholder-card.png',
        attack: card.attack || Math.floor(Math.random() * 5) + 1,
        health: card.health || Math.floor(Math.random() * 8) + 5,
        speed: card.speed || Math.floor(Math.random() * 10) + 1
      }));
      
      console.log("Processed cards for battle:", processedCards);
      setAvailableCards(processedCards);
    }
  }, [cards]);
  
  // Start battle
  const startBattle = () => {
    if (playerTeam.length === 0) {
      alert('Please select at least one card for your team');
      return;
    }
    
    // Create enemy team based on player team strength
    const totalPlayerPower = playerTeam.reduce((sum, card) => 
      sum + (card.attack || 0) + (card.health || 0) + (card.speed || 0), 0);
    
    // Choose random cards for enemy team with similar power
    const shuffled = [...availableCards].sort(() => 0.5 - Math.random());
    let enemyPower = 0;
    const enemyCards = [];
    
    // Try to match player team size
    const targetTeamSize = playerTeam.length;
    
    for (const card of shuffled) {
      if (enemyCards.length >= targetTeamSize) break;
      
      // Skip cards already in player team
      if (playerTeam.some(playerCard => playerCard.id === card.id)) continue;
      
      const cardPower = (card.attack || 0) + (card.health || 0) + (card.speed || 0);
      enemyCards.push(card);
      enemyPower += cardPower;
      
      // If we've added enough cards and have similar power, stop
      if (enemyCards.length >= targetTeamSize && enemyPower >= totalPlayerPower * 0.8) {
        break;
      }
    }
    
    // Initialize teams with health and state
    const preparedPlayerTeam = playerTeam.map(card => ({
      ...card,
      currentHealth: card.health || 10,
      isAlive: true
    }));
    
    const preparedEnemyTeam = enemyCards.map(card => ({
      ...card,
      currentHealth: card.health || 10,
      isAlive: true
    }));
    
    setPlayerTeam(preparedPlayerTeam);
    setEnemyTeam(preparedEnemyTeam);
    setBattleLog(['Battle started!']);
    setPhase('battle');
    
    // Determine who goes first based on speed
    const playerFastest = Math.max(...preparedPlayerTeam.map(card => card.speed || 0));
    const enemyFastest = Math.max(...preparedEnemyTeam.map(card => card.speed || 0));
    
    if (playerFastest >= enemyFastest) {
      setCurrentTurn('player');
      setBattleLog(prev => [...prev, "Player's turn"]);
    } else {
      setCurrentTurn('enemy');
      setBattleLog(prev => [...prev, "Enemy's turn"]);
      // If enemy goes first, trigger their turn
      setTimeout(() => enemyTurn(preparedPlayerTeam, preparedEnemyTeam), 1000);
    }
  };
  
  // Handle card selection for player's team
  const handleCardSelect = (card) => {
    if (phase !== 'setup') return;
    
    if (playerTeam.find(c => c.id === card.id)) {
      // Remove from team if already selected
      setPlayerTeam(playerTeam.filter(c => c.id !== card.id));
    } else if (playerTeam.length < 5) {
      // Add to team if not already full
      setPlayerTeam([...playerTeam, card]);
    } else {
      alert('Maximum team size is 5 cards');
    }
  };
  
  // Player selects a card to attack with
  const selectAttacker = (index) => {
    if (currentTurn !== 'player' || !playerTeam[index].isAlive) return;
    
    setSelectedCardIndex(index);
    setTargetCardIndex(null);
    setBattleLog(prev => [...prev, `Selected ${playerTeam[index].name} to attack`]);
  };
  
  // Player selects an enemy card to attack
  const selectTarget = (index) => {
    if (currentTurn !== 'player' || selectedCardIndex === null || !enemyTeam[index].isAlive) return;
    
    setTargetCardIndex(index);
    
    // Execute attack
    const attacker = playerTeam[selectedCardIndex];
    const target = enemyTeam[index];
    const damage = Math.max(1, attacker.attack || 1);
    
    // Create updated enemy team
    const updatedEnemyTeam = [...enemyTeam];
    updatedEnemyTeam[index] = {
      ...target,
      currentHealth: Math.max(0, target.currentHealth - damage),
      isAlive: target.currentHealth - damage > 0
    };
    
    // Update state and battle log
    setEnemyTeam(updatedEnemyTeam);
    setBattleLog(prev => [
      ...prev, 
      `${attacker.name} attacks ${target.name} for ${damage} damage!`
    ]);
    
    // Check if target is defeated
    if (updatedEnemyTeam[index].currentHealth <= 0) {
      setBattleLog(prev => [...prev, `${target.name} is defeated!`]);
    }
    
    // Reset selection
    setSelectedCardIndex(null);
    setTargetCardIndex(null);
    
    // Check if battle is over
    const remainingEnemies = updatedEnemyTeam.filter(card => card.isAlive).length;
    if (remainingEnemies === 0) {
      endBattle('player');
      return;
    }
    
    // Switch to enemy turn
    setCurrentTurn('enemy');
    setTurnNumber(turnNumber + 1);
    setBattleLog(prev => [...prev, "Enemy's turn"]);
    
    // Execute enemy turn after a delay
    setTimeout(() => enemyTurn(playerTeam, updatedEnemyTeam), 1000);
  };
  
  // Enemy AI turn
  const enemyTurn = (currentPlayerTeam, currentEnemyTeam) => {
    // Find all alive enemy cards
    const aliveEnemies = currentEnemyTeam.filter(card => card.isAlive);
    if (aliveEnemies.length === 0) return;
    
    // Choose a random attacker
    const attackerIndex = currentEnemyTeam.findIndex(card => 
      card.isAlive && card.id === aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)].id
    );
    const attacker = currentEnemyTeam[attackerIndex];
    
    // Find all alive player cards
    const alivePlayerCards = currentPlayerTeam.filter(card => card.isAlive);
    if (alivePlayerCards.length === 0) {
      endBattle('enemy');
      return;
    }
    
    // Choose a random target from player's team
    const targetCard = alivePlayerCards[Math.floor(Math.random() * alivePlayerCards.length)];
    const targetIndex = currentPlayerTeam.findIndex(card => card.id === targetCard.id);
    const target = currentPlayerTeam[targetIndex];
    
    // Calculate damage
    const damage = Math.max(1, attacker.attack || 1);
    
    // Create updated player team
    const updatedPlayerTeam = [...currentPlayerTeam];
    updatedPlayerTeam[targetIndex] = {
      ...target,
      currentHealth: Math.max(0, target.currentHealth - damage),
      isAlive: target.currentHealth - damage > 0
    };
    
    // Update state and battle log
    setPlayerTeam(updatedPlayerTeam);
    setBattleLog(prev => [
      ...prev, 
      `Enemy's ${attacker.name} attacks ${target.name} for ${damage} damage!`
    ]);
    
    // Check if target is defeated
    if (updatedPlayerTeam[targetIndex].currentHealth <= 0) {
      setBattleLog(prev => [...prev, `${target.name} is defeated!`]);
    }
    
    // Check if battle is over
    const remainingPlayers = updatedPlayerTeam.filter(card => card.isAlive).length;
    if (remainingPlayers === 0) {
      endBattle('enemy');
      return;
    }
    
    // Switch back to player turn
    setCurrentTurn('player');
    setBattleLog(prev => [...prev, "Player's turn"]);
  };
  
  // End battle and determine rewards
  const endBattle = (winner) => {
    setWinner(winner);
    setPhase('results');
    
    const rewardPoints = winner === 'player' ? 10 + (playerTeam.length * 2) : 2;
    
    // Call the completion callback
    if (onGameComplete) {
      onGameComplete({
        winner,
        rewardPoints,
        playerTeam,
        enemyTeam,
        turns: turnNumber
      });
    }
    
    setBattleLog(prev => [
      ...prev, 
      winner === 'player' ? "Victory! You've defeated all enemies!" : "Defeat! Your team has been eliminated."
    ]);
  };
  
  const resetGame = () => {
    setPlayerTeam([]);
    setEnemyTeam([]);
    setPhase('setup');
    setCurrentTurn(null);
    setBattleLog([]);
    setSelectedCardIndex(null);
    setTargetCardIndex(null);
    setTurnNumber(1);
    setWinner(null);
  };
  
  // Render the battle setup screen
  const renderSetup = () => {
    return (
      <div className={styles.battleSetup}>
        <h2>Battle Arena</h2>
        <p>Select up to 5 cards for your team</p>
        
        <div className={styles.teamSide}>
          <h3>Your Team ({playerTeam.length}/5)</h3>
          <div className={styles.teamGrid}>
            {Array(5).fill(null).map((_, index) => {
              const card = playerTeam[index];
              
              return card ? (
                <div 
                  key={`team-${index}`} 
                  className={styles.cardWrapper}
                  onClick={() => handleCardSelect(card)}
                >
                  <img 
                    src={card.image || '/placeholder-card.png'} 
                    alt={card.name}
                    className={styles.cardImage}
                  />
                  <div className={styles.cardName}>{card.name}</div>
                  <div className={styles.cardStats}>
                    <span>ATK: {card.attack || '?'}</span>
                    <span>HP: {card.health || '?'}</span>
                    <span>SPD: {card.speed || '?'}</span>
                  </div>
                </div>
              ) : (
                <div 
                  key={`empty-${index}`} 
                  className={styles.emptySlot}
                >
                  Select Card
                </div>
              );
            })}
          </div>
          
          <button 
            className={styles.actionButton}
            onClick={startBattle}
            disabled={playerTeam.length === 0}
          >
            Start Battle
          </button>
        </div>
        
        <h3>Available Cards</h3>
        <div className={styles.availableCards}>
          {availableCards.length === 0 ? (
            <div className={styles.noCards}>
              No cards available. Open packs to collect cards!
            </div>
          ) : (
            <div className={styles.cardGrid}>
              {availableCards.map((card, index) => (
                <div 
                  key={card.id || index}
                  className={`${styles.cardWrapper} ${playerTeam.some(c => c.id === card.id) ? styles.selected : ''}`}
                  onClick={() => handleCardSelect(card)}
                >
                  <img 
                    src={card.image || '/placeholder-card.png'} 
                    alt={card.name}
                    className={styles.cardImage}
                  />
                  <div className={styles.cardName}>{card.name}</div>
                  <div className={styles.cardStats}>
                    <span>ATK: {card.attack || '?'}</span>
                    <span>HP: {card.health || '?'}</span>
                    <span>SPD: {card.speed || '?'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Render battle screen
  const renderBattle = () => {
    return (
      <div className={styles.battleArena}>
        <div className={styles.battleInfo}>
          <div className={styles.turnIndicator}>
            Turn {turnNumber}: {currentTurn === 'player' ? 'Your Turn' : 'Enemy Turn'}
          </div>
        </div>
        
        <div className={styles.battleField}>
          <div className={styles.teamSide}>
            <h3>Enemy Team</h3>
            <div className={styles.teamGrid}>
              {enemyTeam.map((card, index) => (
                <div 
                  key={`enemy-${card.id}-${index}`} 
                  className={`${styles.cardWrapper} ${!card.isAlive ? styles.defeated : ''} ${targetCardIndex === index ? styles.targeted : ''}`}
                  onClick={() => currentTurn === 'player' && selectedCardIndex !== null ? selectTarget(index) : null}
                >
                  <Card card={card} />
                  <div className={styles.healthBar}>
                    <div 
                      className={styles.healthFill} 
                      style={{ width: `${(card.currentHealth / card.health) * 100}%` }}
                    ></div>
                    <span>{card.currentHealth}/{card.health}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className={styles.battleLog}>
            <h3>Battle Log</h3>
            <div className={styles.logEntries}>
              {battleLog.map((entry, index) => (
                <div key={index} className={styles.logEntry}>{entry}</div>
              ))}
            </div>
          </div>
          
          <div className={styles.teamSide}>
            <h3>Your Team</h3>
            <div className={styles.teamGrid}>
              {playerTeam.map((card, index) => (
                <div 
                  key={`player-${card.id}-${index}`} 
                  className={`${styles.cardWrapper} ${!card.isAlive ? styles.defeated : ''} ${selectedCardIndex === index ? styles.selected : ''}`}
                  onClick={() => currentTurn === 'player' ? selectAttacker(index) : null}
                >
                  <Card card={card} />
                  <div className={styles.healthBar}>
                    <div 
                      className={styles.healthFill} 
                      style={{ width: `${(card.currentHealth / card.health) * 100}%` }}
                    ></div>
                    <span>{card.currentHealth}/{card.health}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render results screen
  const renderResults = () => {
    return (
      <div className={styles.battleResults}>
        <h2>{winner === 'player' ? 'Victory!' : 'Defeat!'}</h2>
        <div className={styles.resultsContent}>
          <p className={styles.resultsSummary}>
            {winner === 'player' 
              ? "Congratulations! You've defeated all enemies." 
              : "Your team has been defeated. Better luck next time!"}
          </p>
          
          <div className={styles.rewardsInfo}>
            <h3>Rewards</h3>
            <p>
              {winner === 'player' 
                ? `Victory Reward: ${10 + (playerTeam.length * 2)} points` 
                : "Participation Reward: 2 points"}
            </p>
          </div>
          
          <button 
            className={styles.actionButton}
            onClick={resetGame}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  };
  
  // Render the appropriate phase
  if (phase === 'setup') {
    return renderSetup();
  } else if (phase === 'battle') {
    return renderBattle();
  } else {
    return renderResults();
  }
};

export default BattleArena; 