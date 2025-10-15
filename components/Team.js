import React, { useState, useEffect } from 'react';
import styles from './Team.module.css';
import Card from './Card';
import { getTeamSynergies } from '../utils/frogData';
import { checkTitanSynergies } from '../utils/titansData';

const MAX_TEAM_SIZE = 5; // Maximum number of cards in a team

const Team = ({ 
  cards = [], 
  onAddCard, 
  onRemoveCard, 
  onSaveTeam, 
  teamName = '', 
  isEditing = false,
  readOnly = false
}) => {
  const [name, setName] = useState(teamName);
  const [error, setError] = useState('');
  const [teamSynergies, setTeamSynergies] = useState([]);

  useEffect(() => {
    // Calculate team synergies whenever cards change
    if (cards.length > 0) {
      const cardNumbers = cards.map(card => {
        const numberAttr = card.attributes?.find(attr => attr.trait_type === "Number");
        return numberAttr ? parseInt(numberAttr.value) : null;
      }).filter(num => num !== null);
      
      if (cardNumbers.length > 0) {
        // Determine collection type to use appropriate synergy function
        const collection = cards[0]?.attributes?.find(attr => attr.trait_type === "Collection")?.value || 'Unknown';
        let synergies = [];
        
        switch (collection.toLowerCase()) {
          case 'titans':
            synergies = checkTitanSynergies(cardNumbers, cards);
            break;
          case 'frogs':
          case 'babysneklets':
          default:
            synergies = getTeamSynergies(cardNumbers);
            break;
        }
        
        setTeamSynergies(synergies);
      } else {
        setTeamSynergies([]);
      }
    } else {
      setTeamSynergies([]);
    }
  }, [cards]);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }
    
    if (cards.length === 0) {
      setError('Team must have at least one card');
      return;
    }

    if (cards.length > MAX_TEAM_SIZE) {
      setError(`Team cannot have more than ${MAX_TEAM_SIZE} cards`);
      return;
    }

    onSaveTeam({ name: name.trim(), cards });
    setError('');
  };

  // Calculate total stats including synergy bonuses
  const calculateTotalStats = () => {
    if (cards.length === 0) return { attack: 0, health: 0, speed: 0 };
    
    // Base stats from cards
    let totalAttack = cards.reduce((sum, card) => sum + (card.attack || 0), 0);
    let totalHealth = cards.reduce((sum, card) => sum + (card.health || 0), 0);
    let totalSpeed = cards.reduce((sum, card) => sum + (card.speed || 0), 0);
    
    // Add synergy bonuses
    teamSynergies.forEach(synergy => {
      totalAttack += synergy.bonus.attack || 0;
      totalHealth += synergy.bonus.health || 0;
      totalSpeed += synergy.bonus.speed || 0;
    });
    
    return { attack: totalAttack, health: totalHealth, speed: totalSpeed };
  };
  
  const totalStats = calculateTotalStats();

  return (
    <div className={styles.team}>
      <div className={styles.header}>
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter team name"
            className={styles.nameInput}
            disabled={readOnly}
          />
        ) : (
          <h3 className={styles.teamName}>{name || 'Untitled Team'}</h3>
        )}
        
        {!readOnly && isEditing && (
          <button 
            onClick={handleSave}
            className={styles.saveButton}
          >
            Save Team
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.cardList}>
        {cards.map((card, index) => (
          <div key={card.id || index} className={styles.cardWrapper}>
            <Card card={card} />
            {!readOnly && (
              <button
                onClick={() => onRemoveCard(card)}
                className={styles.removeButton}
                aria-label={`Remove ${card.name} from team`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        
        {!readOnly && cards.length < MAX_TEAM_SIZE && (
          <div className={styles.addCard}>
            <button
              onClick={onAddCard}
              className={styles.addButton}
              aria-label="Add card to team"
            >
              + Add Card
            </button>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div className={styles.stats}>
          <p>Team Size: {cards.length}/{MAX_TEAM_SIZE}</p>
          <div className={styles.statLine}>
            <span>Total Attack: {totalStats.attack}</span>
            <span>Total Health: {totalStats.health}</span>
            <span>Total Speed: {totalStats.speed}</span>
          </div>
        </div>
      )}
      
      {teamSynergies.length > 0 && (
        <div className={styles.synergies}>
          <h4>Team Synergies:</h4>
          <ul>
            {teamSynergies.map((synergy, index) => (
              <li key={index} className={styles.synergy}>
                <strong>{synergy.name}</strong>: {synergy.description}
                <div className={styles.synergyBonus}>
                  {synergy.bonus.attack > 0 && <span>+{synergy.bonus.attack} ATK</span>}
                  {synergy.bonus.health > 0 && <span>+{synergy.bonus.health} HP</span>}
                  {synergy.bonus.speed > 0 && <span>+{synergy.bonus.speed} SPD</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Team; 
