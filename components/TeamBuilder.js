import React, { useState, useEffect, useContext } from 'react';
import styles from './TeamBuilder.module.css';
import Team from './Team';
import CardCollection from './CardCollection';
import { WalletContext } from '../contexts/WalletContext';

const TeamBuilder = ({ cards = [], onBattleComplete }) => {
  // Check if we're in the browser environment
  const isBrowser = typeof window !== 'undefined';
  
  const walletContext = useContext(WalletContext);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [battleMode, setBattleMode] = useState(false);
  const [team1, setTeam1] = useState(null);
  const [team2, setTeam2] = useState(null);
  const [battleResult, setBattleResult] = useState(null);
  const [isBattleLoading, setIsBattleLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debug: Log the cards prop
  console.log('🔍 TeamBuilder received cards:', cards);
  console.log('🔍 TeamBuilder cards length:', cards?.length || 0);

  // Handle case when context is not available (during build time)
  if (!isBrowser || !walletContext) {
    console.log('❌ TeamBuilder: Browser or wallet context not available');
    return (
      <div className={styles.notAuthenticated}>
        <p>Wallet context not available. Please refresh the page.</p>
      </div>
    );
  }

  const { connected, address, loading } = walletContext;
  
  console.log('🔍 TeamBuilder wallet context:', { connected, address, loading });

  // Show loading state while wallet is being determined
  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show message if not connected to wallet
  if (!connected || !address) {
    return (
      <div className={styles.notAuthenticated}>
        <p>Please connect your wallet to access the team builder.</p>
      </div>
    );
  }

  // Load teams from database on mount
  useEffect(() => {
    // Only run in browser environment
    if (!isBrowser || !address) return;
    
    const fetchTeams = async () => {
      try {
        console.log('🔍 Fetching teams for address:', address);
        const response = await fetch(`/api/teams/${address}`);
        console.log('🔍 Teams API response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Teams API error response:', errorText);
          throw new Error('Failed to fetch teams');
        }
        
        const data = await response.json();
        console.log('✅ Teams API response data:', data);
        setTeams(data.teams || []);
      } catch (error) {
        console.error('❌ Error fetching teams:', error);
        setError('Failed to load teams. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, [address, isBrowser]);

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

  const handleDeleteTeam = async (teamToDelete) => {
    if (!isBrowser || !address) return;
    
    try {
              const response = await fetch(`/api/teams/${address}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: teamToDelete.id })
      });

      if (!response.ok) throw new Error('Failed to delete team');

      setTeams(teams.filter(team => team.id !== teamToDelete.id));
      if (selectedTeam?.id === teamToDelete.id) {
        setSelectedTeam(null);
        setSelectedCards([]);
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      setError('Failed to delete team');
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

  const handleSaveTeam = async ({ name, cards }) => {
    if (!isBrowser || !address) return;
    
    console.log('🔍 Attempting to save team:', { name, cardsCount: cards.length, address });
    
    try {
      const nftIds = cards.map(card => card.id);
      const method = selectedTeam ? 'PUT' : 'POST'; // Use PUT for updates, POST for new teams
      const url = `/api/teams/${address}`;
      const body = selectedTeam 
        ? { id: selectedTeam.id, name, nftIds }
        : { name, nftIds };

      console.log('🔍 Saving team with:', { method, url, body });

      const response = await fetch(`${url}`, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      console.log('🔍 Save team response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Save team error response:', errorText);
        throw new Error('Failed to save team');
      }

      const savedTeam = await response.json();
      console.log('✅ Team saved successfully:', savedTeam);
      
      if (selectedTeam) {
        setTeams(teams.map(team => 
          team.id === savedTeam.id ? savedTeam : team
        ));
      } else {
        setTeams([...teams, savedTeam]);
      }

      setIsCreatingTeam(false);
      setSelectedTeam(null);
      setSelectedCards([]);
    } catch (error) {
      console.error('❌ Error saving team:', error);
      setError('Failed to save team');
    }
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
    if (!isBrowser) return;
    
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
          teamAId: teamA.id,
          teamBId: teamB.id
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setBattleResult(result);
        
        // Refresh teams to get updated battle records
        const teamsResponse = await fetch(`/api/teams?walletAddress=${address}`);
        if (teamsResponse.ok) {
          const updatedTeams = await teamsResponse.json();
          setTeams(updatedTeams);
        }
        
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

  // Don't render anything during build time
  if (!isBrowser) {
    return null;
  }

  if (isLoading) {
    return <div className={styles.loading}>Loading teams...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

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
