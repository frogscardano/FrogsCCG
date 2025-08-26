import React, { useState, useEffect, useContext } from 'react';
import styles from './TeamBuilder.module.css';
import Team from './Team';
import CardCollection from './CardCollection';
import { WalletContext } from '../contexts/WalletContext';

const TeamBuilderUpdated = ({ cards = [], onBattleComplete }) => {
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
  console.log('🔍 TeamBuilderUpdated received cards:', cards);
  console.log('🔍 TeamBuilderUpdated cards length:', cards?.length || 0);

  // Handle case when context is not available (during build time)
  if (!isBrowser || !walletContext) {
    console.log('❌ TeamBuilderUpdated: Browser or wallet context not available');
    return (
      <div className={styles.notAuthenticated}>
        <p>Wallet context not available. Please refresh the page.</p>
      </div>
      );
  }

  const { connected, address, loading } = walletContext;
  
  console.log('🔍 TeamBuilderUpdated wallet context:', { connected, address, loading });

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

  // Load teams from database on mount using the new teams API
  useEffect(() => {
    // Only run in browser environment
    if (!isBrowser || !address) return;
    
    const fetchTeams = async () => {
      try {
        console.log('🔍 Fetching teams for address:', address);
        
        // Use the new teams API endpoint that follows the NFT collections pattern
        const response = await fetch(`/api/teams/${address}`);
        console.log('🔍 Teams API response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Teams API error response:', errorText);
          throw new Error('Failed to fetch teams');
        }
        
        const data = await response.json();
        console.log('✅ Teams API response data:', data);
        
        // The new API returns teams in the expected format
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

  const handleRemoveCard = (cardToRemove) => {
    setSelectedCards(selectedCards.filter(card => card.id !== cardToRemove.id));
  };

  const handleSaveTeam = async ({ name, cards }) => {
    if (!isBrowser || !address) return;
    
    console.log('🔍 Attempting to save team:', { name, cardsCount: cards.length, address });
    
    try {
      const nftIds = cards.map(card => card.id);
      
      // Use the new teams API endpoint that follows the NFT collections pattern
      const teamData = {
        name,
        nftIds,
        isActive: true,
        battlesWon: selectedTeam ? selectedTeam.battlesWon : 0,
        battlesLost: selectedTeam ? selectedTeam.battlesLost : 0
      };

      console.log('🔍 Saving team with data:', teamData);

      const response = await fetch(`/api/teams/${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([teamData]) // Send as array like the NFT API
      });

      console.log('🔍 Save team response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Save team error response:', errorText);
        throw new Error('Failed to save team');
      }

      const savedTeams = await response.json();
      const savedTeam = savedTeams[0]; // Get the first (and only) team
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

  const handleDeleteTeam = async (teamId) => {
    if (!isBrowser || !address) return;
    
    try {
      console.log('🔍 Deleting team:', teamId);
      
      // For deletion, we can use the existing teams API or create a DELETE endpoint
      // For now, let's use the existing API structure
      const response = await fetch('/api/teams', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: teamId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete team');
      }

      // Remove team from local state
      setTeams(teams.filter(team => team.id !== teamId));
      console.log('✅ Team deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting team:', error);
      setError('Failed to delete team');
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

  const startBattle = async (team1, team2) => {
    if (!team1 || !team2) return;
    
    setIsBattleLoading(true);
    try {
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teamA: team1.cards,
          teamB: team2.cards,
          teamAId: team1.id,
          teamBId: team2.id
        })
      });

      if (!response.ok) {
        throw new Error('Battle failed');
      }

      const result = await response.json();
      setBattleResult(result);
      
      // Update team stats
      if (result.winner === 'A') {
        setTeams(teams.map(team => 
          team.id === team1.id 
            ? { ...team, battlesWon: team.battlesWon + 1 }
            : team.id === team2.id
            ? { ...team, battlesLost: team.battlesLost + 1 }
            : team
        ));
      } else if (result.winner === 'B') {
        setTeams(teams.map(team => 
          team.id === team2.id 
            ? { ...team, battlesWon: team.battlesWon + 1 }
            : team.id === team1.id
            ? { ...team, battlesLost: team.battlesLost + 1 }
            : team
        ));
      }
      
      if (onBattleComplete) {
        onBattleComplete(result);
      }
    } catch (error) {
      console.error('❌ Battle error:', error);
      setError('Battle failed. Please try again.');
    } finally {
      setIsBattleLoading(false);
    }
  };

  const getTeamCollectionName = (team) => {
    if (!team.cards || team.cards.length === 0) return 'Empty Team';
    
    const collections = [...new Set(team.cards.map(card => {
      const collectionAttr = card.attributes?.find(attr => attr.trait_type === "Collection");
      return collectionAttr ? collectionAttr.value : 'Unknown';
    }))];
    
    if (collections.length === 1) {
      return `${collections[0]} Team`;
    } else {
      return 'Mixed Collection Team';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (battleMode) {
    return (
      <div className={styles.battleMode}>
        <h2>Select Teams for Battle</h2>
        <div className={styles.battleTeams}>
          <div className={styles.battleTeam}>
            <h3>Team 1</h3>
            {team1 ? (
              <div>
                <p>{team1.name}</p>
                <button onClick={() => setTeam1(null)}>Change</button>
              </div>
            ) : (
              <p>Select a team</p>
            )}
          </div>
          <div className={styles.battleTeam}>
            <h3>Team 2</h3>
            {team2 ? (
              <div>
                <p>{team2.name}</p>
                <button onClick={() => setTeam2(null)}>Change</button>
              </div>
            ) : (
              <p>Select a team</p>
            )}
          </div>
        </div>
        
        {team1 && team2 && (
          <div className={styles.battleStart}>
            <button 
              onClick={() => startBattle(team1, team2)}
              disabled={isBattleLoading}
            >
              {isBattleLoading ? 'Starting Battle...' : 'Start Battle!'}
            </button>
          </div>
        )}
        
        {battleResult && (
          <div className={styles.battleResult}>
            <h3>Battle Result</h3>
            <p>Winner: {battleResult.winner === 'A' ? team1.name : team2.name}</p>
            <p>Score: {battleResult.score}</p>
            <button onClick={() => setBattleMode(false)}>Back to Teams</button>
          </div>
        )}
        
        <button onClick={() => setBattleMode(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div className={styles.teamBuilder}>
      <div className={styles.header}>
        <h2>Team Builder</h2>
        <div className={styles.actions}>
          <button onClick={handleCreateTeam} disabled={isCreatingTeam}>
            Create New Team
          </button>
          <button onClick={handleStartBattle} disabled={teams.length < 2}>
            Start Battle
          </button>
        </div>
      </div>

      {isCreatingTeam && (
        <div className={styles.teamCreation}>
          <Team
            cards={selectedCards}
            onAddCard={(card) => setSelectedCards([...selectedCards, card])}
            onRemoveCard={handleRemoveCard}
            onSaveTeam={handleSaveTeam}
            teamName={selectedTeam?.name || ''}
            isEditing={!!selectedTeam}
          />
          <button onClick={() => setIsCreatingTeam(false)}>Cancel</button>
        </div>
      )}

      <div className={styles.teamsList}>
        <h3>Your Teams ({teams.length})</h3>
        {teams.length === 0 ? (
          <p>No teams yet. Create your first team to get started!</p>
        ) : (
          teams.map(team => (
            <div key={team.id} className={styles.teamItem}>
              <div className={styles.teamInfo}>
                <h4>{team.name}</h4>
                <p>{getTeamCollectionName(team)}</p>
                <p>Cards: {team.cards?.length || 0}</p>
                <p>Record: {team.battlesWon}W - {team.battlesLost}L</p>
              </div>
              <div className={styles.teamActions}>
                <button onClick={() => handleEditTeam(team)}>Edit</button>
                <button onClick={() => handleDeleteTeam(team.id)}>Delete</button>
                <button onClick={() => handleSelectTeamForBattle(team)}>Select for Battle</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.cardCollection}>
        <h3>Available Cards</h3>
        <CardCollection 
          cards={cards} 
          onCardSelect={(card) => {
            if (isCreatingTeam && selectedCards.length < 5) {
              setSelectedCards([...selectedCards, card]);
            }
          }}
          selectedCards={selectedCards}
        />
      </div>
    </div>
  );
};

export default TeamBuilderUpdated;
