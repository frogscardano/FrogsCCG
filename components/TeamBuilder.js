import React, { useState, useEffect } from 'react';
import styles from './TeamBuilder.module.css';
import Team from './Team';
import CardCollection from './CardCollection';

const TeamBuilder = ({ cards = [], onBattleComplete }) => {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [battleMode, setBattleMode] = useState(false);
  const [team1, setTeam1] = useState(null);
  const [team2, setTeam2] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [isBattleLoading, setIsBattleLoading] = useState(false);

  // Load teams from localStorage on mount
  useEffect(() => {
    const savedTeams = localStorage.getItem('teams');
    if (savedTeams) {
      setTeams(JSON.parse(savedTeams));
    }
  }, []);

  // Save teams to localStorage when updated
  useEffect(() => {
    localStorage.setItem('teams', JSON.stringify(teams));
  }, [teams]);

  const handleCreateTeam = () => {
    setIsCreatingTeam(true);
    setSelectedCards([]);
    setSelectedTeam(null);
  };

  const handleEditTeam = (team) => {
    setSelectedTeam(team);
    setSelectedCards([...team.cards]);
    setIsCreatingTeam(true);
  };

  const handleDeleteTeam = (teamToDelete) => {
    setTeams(teams.filter(team => team.name !== teamToDelete.name));
    if (selectedTeam?.name === teamToDelete.name) {
      setSelectedTeam(null);
      setSelectedCards([]);
    }
  };

  const handleAddCard = (card) => {
    if (selectedCards.length < 5) {
      if (!selectedCards.find(c => c.id === card.id)) {
        setSelectedCards(prevCards => [...prevCards, card]);
      }
    }
  };

  const handleRemoveCard = (cardToRemove) => {
    setSelectedCards(selectedCards.filter(card => card.id !== cardToRemove.id));
  };

  const handleSaveTeam = ({ name, cards }) => {
    const teamIndex = teams.findIndex(t => t.name === selectedTeam?.name);
    const newTeam = { name, cards };

    if (teamIndex >= 0) {
      // Update existing team
      const updatedTeams = [...teams];
      updatedTeams[teamIndex] = newTeam;
      setTeams(updatedTeams);
    } else {
      // Create new team
      setTeams([...teams, newTeam]);
    }

    setIsCreatingTeam(false);
    setSelectedTeam(null);
    setSelectedCards([]);
  };

  const handleStartBattle = () => {
    setBattleMode(true);
    setTeam1(null);
    setTeam2(null);
    setBattleResult(null);
  };

  const handleSelectTeamForBattle = (team) => {
    if (!team1) {
      setTeam1(team);
    } else if (!team2) {
      setTeam2(team);
      // Start the battle after both teams are selected
      startBattle(team1, team);
    }
  };

  const getTeamCollectionName = (team) => {
    // Extract collections from each card in the team
    const collections = team.cards.map(card => {
      const collectionAttr = card.attributes?.find(attr => attr.trait_type === "Collection");
      return collectionAttr ? collectionAttr.value : "Unknown";
    });
    
    // Find the most common collection
    const collectionCounts = collections.reduce((acc, collection) => {
      acc[collection] = (acc[collection] || 0) + 1;
      return acc;
    }, {});
    
    let maxCount = 0;
    let mainCollection = "Mixed";
    
    for (const [collection, count] of Object.entries(collectionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mainCollection = collection;
      }
    }
    
    return maxCount === team.cards.length ? mainCollection : `${mainCollection} (Mixed)`;
  };

  const startBattle = async (teamA, teamB) => {
    setIsBattleLoading(true);
    
    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamA: teamA.cards,
          teamB: teamB.cards,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setBattleResult(result);
        
        // Wait a few seconds before resetting battle mode
        setTimeout(() => {
          if (onBattleComplete) {
            onBattleComplete(result);
          }
        }, 5000);
      } else {
        throw new Error(`Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Battle error:', error);
      setBattleResult({
        error: true,
        message: error.message || 'Failed to conduct battle'
      });
    } finally {
      setIsBattleLoading(false);
    }
  };

  const resetBattle = () => {
    setBattleMode(false);
    setTeam1(null);
    setTeam2(null);
    setBattleResult(null);
  };

  return (
    <div className={styles.teamBuilder}>
      <div className={styles.header}>
        <h2>Team Builder</h2>
        {!battleMode && !isCreatingTeam && (
          <div className={styles.actions}>
            <button onClick={handleCreateTeam} className={styles.createButton}>
              Create New Team
            </button>
            {teams.length >= 2 && (
              <button onClick={handleStartBattle} className={styles.battleButton}>
                Start Battle
              </button>
            )}
          </div>
        )}
      </div>

      {battleMode ? (
        <div className={styles.battleMode}>
          <h3>Select Teams for Battle</h3>
          <div className={styles.battleTeams}>
            <div className={styles.teamSlot}>
              <h4>Team 1</h4>
              {team1 ? (
                <>
                  <div className={styles.collectionBadge}>
                    {getTeamCollectionName(team1)}
                  </div>
                  <Team cards={team1.cards} teamName={team1.name} readOnly />
                </>
              ) : (
                <p>Select first team</p>
              )}
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.teamSlot}>
              <h4>Team 2</h4>
              {team2 ? (
                <>
                  <div className={styles.collectionBadge}>
                    {getTeamCollectionName(team2)}
                  </div>
                  <Team cards={team2.cards} teamName={team2.name} readOnly />
                </>
              ) : (
                <p>Select second team</p>
              )}
            </div>
          </div>
          
          {isBattleLoading && (
            <div className={styles.battleLoading}>
              <div className={styles.spinner}></div>
              <p>Battle in progress...</p>
            </div>
          )}
          
          {battleResult && (
            <div className={styles.battleResult}>
              <h3 className={styles.battleTitle}>
                Battle Results
              </h3>
              
              {battleResult.error ? (
                <p className={styles.battleError}>{battleResult.message}</p>
              ) : (
                <>
                  <div className={styles.resultDetails}>
                    <div className={styles.teamResult}>
                      <strong>Team A ({battleResult.teamACollection})</strong>
                      <span>Power: {battleResult.teamAPower}</span>
                    </div>
                    <div className={styles.teamResult}>
                      <strong>Team B ({battleResult.teamBCollection})</strong>
                      <span>Power: {battleResult.teamBPower}</span>
                    </div>
                  </div>
                  
                  <div className={styles.battleOutcome}>
                    {battleResult.winner === 'draw' ? (
                      <h4>It's a draw!</h4>
                    ) : (
                      <h4>
                        {battleResult.winner === 'teamA' 
                          ? `Team A (${battleResult.teamACollection}) wins!` 
                          : `Team B (${battleResult.teamBCollection}) wins!`}
                      </h4>
                    )}
                  </div>
                  
                  <div className={styles.battleLog}>
                    {battleResult.battleLog.map((log, index) => (
                      <p key={index}>{log}</p>
                    ))}
                  </div>
                </>
              )}
              
              <button onClick={resetBattle} className={styles.resetButton}>
                New Battle
              </button>
            </div>
          )}
          
          {!battleResult && !team2 && (
            <div className={styles.teamList}>
              {teams.map(team => (
                <div 
                  key={team.name} 
                  className={styles.teamSelection}
                  onClick={() => handleSelectTeamForBattle(team)}
                >
                  <div className={styles.collectionBadge}>
                    {getTeamCollectionName(team)}
                  </div>
                  <Team 
                    cards={team.cards} 
                    teamName={team.name} 
                    readOnly 
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : isCreatingTeam ? (
        <div className={styles.teamCreation}>
          <Team
            cards={selectedCards}
            onAddCard={() => setIsCreatingTeam(true)}
            onRemoveCard={handleRemoveCard}
            onSaveTeam={handleSaveTeam}
            teamName={selectedTeam?.name || ''}
            isEditing={true}
          />
          <CardCollection
            cards={cards.filter(card => !selectedCards.find(sc => sc.id === card.id))}
            title="Available Cards"
            onCardClick={handleAddCard}
          />
        </div>
      ) : (
        <div className={styles.teamList}>
          {teams.map(team => (
            <div key={team.name} className={styles.teamItem}>
              <div className={styles.collectionBadge}>
                {getTeamCollectionName(team)}
              </div>
              <Team
                cards={team.cards}
                teamName={team.name}
                readOnly
              />
              <div className={styles.teamActions}>
                <button
                  onClick={() => handleEditTeam(team)}
                  className={styles.editButton}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteTeam(team)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamBuilder; 