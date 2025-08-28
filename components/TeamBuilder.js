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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(false);

  // Debug: Log the cards prop
  console.log('🔍 TeamBuilder received cards:', cards);
  console.log('🔍 TeamBuilder cards length:', cards?.length || 0);
  console.log('🔍 TeamBuilder cards sample:', cards?.slice(0, 3));

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

  // Try to load teams from database on mount, but don't fail if it doesn't work
  useEffect(() => {
    // Only run in browser environment
    if (!isBrowser || !address) return;
    
    const fetchTeams = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('🔍 Attempting to fetch teams for address:', address);
        
        // First try the API endpoint
        try {
          const response = await fetch(`/api/teams/${address}`);
          console.log('🔍 Teams API response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Teams API response data:', data);
            
            // Check if the API returned a fallback response
            if (data.fallback) {
              console.log('⚠️ API returned fallback response, trying direct database access');
              setApiAvailable(false);
            } else {
              setTeams(data.teams || []);
              setApiAvailable(true);
              setIsLoading(false);
              return;
            }
          } else {
            console.log('⚠️ Teams API failed, trying direct database access');
            setApiAvailable(false);
          }
        } catch (error) {
          console.log('⚠️ Teams API failed, trying direct database access:', error.message);
          setApiAvailable(false);
        }
        
        // Fallback: Try direct database access using Prisma
        try {
          console.log('🔍 Attempting direct database access using Prisma');
          
          // Import Prisma client dynamically to avoid SSR issues
          const { PrismaClient } = await import('@prisma/client');
          const prisma = new PrismaClient();
          
          // Find user by address
          const user = await prisma.user.findUnique({
            where: { address: address }
          });
          
          if (user) {
            // Fetch teams for the user
            const userTeams = await prisma.team.findMany({
              where: { ownerId: user.id },
              orderBy: { createdAt: 'desc' }
            });
            
            console.log('✅ Teams loaded from database directly via Prisma:', userTeams.length);
            setTeams(userTeams);
            setApiAvailable(true);
          } else {
            console.log('ℹ️ No user found in database, using local storage');
            loadTeamsFromLocalStorage();
          }
          
          await prisma.$disconnect();
          
        } catch (dbError) {
          console.error('❌ Direct database access failed:', dbError);
          console.log('⚠️ Falling back to local storage');
          loadTeamsFromLocalStorage();
        }
        
      } catch (error) {
        console.log('⚠️ All database methods failed, using local storage:', error.message);
        setApiAvailable(false);
        loadTeamsFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeams();
  }, [address, isBrowser]);

  // Load teams from local storage as fallback
  const loadTeamsFromLocalStorage = () => {
    try {
      const storageKey = `teams_${address}`;
      const storedTeams = localStorage.getItem(storageKey);
      if (storedTeams) {
        const parsedTeams = JSON.parse(storedTeams);
        console.log('📱 Loaded teams from local storage:', parsedTeams);
        setTeams(parsedTeams);
      } else {
        console.log('📱 No teams found in local storage');
        setTeams([]);
      }
    } catch (error) {
      console.error('❌ Error loading teams from local storage:', error);
      setTeams([]);
    }
  };

  // Save teams to local storage whenever teams change
  useEffect(() => {
    if (!isBrowser || !address || teams.length === 0) return;
    
    try {
      const storageKey = `teams_${address}`;
      localStorage.setItem(storageKey, JSON.stringify(teams));
      console.log('💾 Saved teams to local storage:', teams.length);
    } catch (error) {
      console.error('❌ Error saving teams to local storage:', error);
    }
  }, [teams, address, isBrowser]);

  const handleCreateTeam = () => {
    console.log('🔧 Create team button clicked');
    console.log('🔧 Current state before change:', { isCreatingTeam, selectedCards: selectedCards.length, selectedTeam: !!selectedTeam });
    setIsCreatingTeam(true);
    setSelectedCards([]);
    setSelectedTeam(null);
    console.log('🔧 Team creation state set to:', true);
    
    // Force a re-render to see the change
    setTimeout(() => {
      console.log('🔧 State after timeout:', { isCreatingTeam, selectedCards: selectedCards.length, selectedTeam: !!selectedTeam });
    }, 100);
  };

  const handleEditTeam = (team) => {
    setSelectedTeam(team);
    setSelectedCards([...team.cards]);
    setIsCreatingTeam(true);
  };

  const handleDeleteTeam = async (teamToDelete) => {
    console.log('🔍 Attempting to delete team:', teamToDelete);
    
    try {
      // Try to delete from database first
      if (apiAvailable) {
        try {
          const response = await fetch('/api/teams', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              teamId: teamToDelete.id,
              address: address 
            })
          });
          
          if (response.ok) {
            console.log('✅ Team deleted from database successfully');
          } else {
            console.log('⚠️ API delete failed, trying direct database delete');
          }
        } catch (error) {
          console.log('⚠️ API delete failed, trying direct database delete:', error.message);
        }
      }
      
      // Fallback: Try direct database delete using Prisma
      try {
        console.log('🔍 Attempting direct database delete using Prisma');
        
        // Import Prisma client dynamically to avoid SSR issues
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        
        // Delete the team from the database
        await prisma.team.delete({
          where: { id: teamToDelete.id }
        });
        
        console.log('✅ Team deleted from database directly via Prisma');
        await prisma.$disconnect();
        
      } catch (dbError) {
        console.error('❌ Direct database delete failed:', dbError);
        // Continue with local deletion even if database delete fails
      }
      
    } catch (error) {
      console.error('❌ Error during team deletion:', error);
    }
    
    // Remove from local state
    setTeams(teams.filter(team => team.id !== teamToDelete.id));
    if (selectedTeam?.id === teamToDelete.id) {
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

  const handleSaveTeam = async ({ name, cards }) => {
    console.log('🔍 Attempting to save team:', { name, cardsCount: cards.length, address });
    
    // Create a local team object
    const newTeam = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      cards: cards,
      ownerId: address,
      isActive: true,
      battlesWon: 0,
      battlesLost: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Try to save to database using direct Prisma operations first
    try {
      const nftIds = cards.map(card => card.id);
      
      // First try the API endpoint
      if (apiAvailable) {
        const method = selectedTeam ? 'PUT' : 'POST';
        const url = `/api/teams/${address}`;
        const body = selectedTeam 
          ? { id: selectedTeam.id, name, nftIds }
          : { name, nftIds };

        console.log('🔍 Attempting to save team via API:', { method, url, body });

        const response = await fetch(`${url}`, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const savedTeam = await response.json();
          console.log('✅ Team saved to database via API successfully:', savedTeam);
          
          // Update local state with the database response
          if (selectedTeam) {
            setTeams(teams.map(team => 
              team.id === savedTeam.id ? savedTeam : team
            ));
          } else {
            setTeams([...teams, savedTeam]);
          }
          
          // Show success message
          if (typeof onBattleComplete === 'function') {
            onBattleComplete({ type: 'team_saved', team: savedTeam });
          }
          
          setIsCreatingTeam(false);
          setSelectedTeam(null);
          setSelectedCards([]);
          return;
        } else {
          console.log('⚠️ API save failed, trying direct database save');
        }
      }

      // Fallback: Try direct database save using Prisma
      console.log('🔍 Attempting direct database save using Prisma');
      
      // Import Prisma client dynamically to avoid SSR issues
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      try {
        // First ensure the user exists in the database
        let user = await prisma.user.findUnique({
          where: { address: address }
        });
        
        if (!user) {
          console.log('🔍 Creating new user for address:', address);
          user = await prisma.user.create({
            data: {
              address: address,
              provider: 'eternl'
            }
          });
        }
        
        // Save the team to the database
        let savedTeam;
        if (selectedTeam) {
          // Update existing team
          savedTeam = await prisma.team.update({
            where: { id: selectedTeam.id },
            data: {
              name: name.trim(),
              nftIds: nftIds,
              updatedAt: new Date()
            }
          });
        } else {
          // Create new team
          savedTeam = await prisma.team.create({
            data: {
              name: name.trim(),
              nftIds: nftIds,
              ownerId: user.id,
              isActive: true,
              battlesWon: 0,
              battlesLost: 0
            }
          });
        }
        
        console.log('✅ Team saved to database directly via Prisma:', savedTeam);
        
        // Update local state with the database response
        if (selectedTeam) {
          setTeams(teams.map(team => 
            team.id === savedTeam.id ? savedTeam : team
          ));
        } else {
          setTeams([...teams, savedTeam]);
        }
        
        // Show success message
        if (typeof onBattleComplete === 'function') {
          onBattleComplete({ type: 'team_saved', team: savedTeam });
        }
        
        setApiAvailable(true); // Mark API as available again
        setIsCreatingTeam(false);
        setSelectedTeam(null);
        setSelectedCards([]);
        
        // Close Prisma connection
        await prisma.$disconnect();
        return;
        
      } catch (dbError) {
        console.error('❌ Direct database save failed:', dbError);
        await prisma.$disconnect();
        throw dbError; // Re-throw to be caught by outer catch
      }
      
    } catch (error) {
      console.log('⚠️ All database save methods failed, falling back to local storage:', error.message);
      setApiAvailable(false);
      
      // Fallback to local storage
      console.log('💾 Saving team to local storage');
      if (selectedTeam) {
        setTeams(teams.map(team => 
          team.id === selectedTeam.id ? newTeam : team
        ));
      } else {
        setTeams([...teams, newTeam]);
      }

      setIsCreatingTeam(false);
      setSelectedTeam(null);
      setSelectedCards([]);
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
      // Try to use the battle API if available
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
        
        // Try to refresh teams from API if available
        try {
          const teamsResponse = await fetch(`/api/teams/${address}`);
          if (teamsResponse.ok) {
            const updatedTeams = await teamsResponse.json();
            setTeams(updatedTeams);
          }
        } catch (refreshError) {
          console.log('⚠️ Could not refresh teams from API, using local state');
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
      console.log('⚠️ Battle API not available, using local battle simulation');
      
      // Fallback to local battle simulation
      const localResult = simulateLocalBattle(teamA, teamB);
      setBattleResult(localResult);
      
      // Update local team stats
      updateLocalTeamStats(teamA, teamB, localResult);
      
      // Wait a few seconds before resetting battle mode
      setTimeout(() => {
        if (onBattleComplete) {
          onBattleComplete(localResult);
        }
      }, 5000);
    } finally {
      setIsBattleLoading(false);
    }
  };

  // Local battle simulation when API is not available
  const simulateLocalBattle = (teamA, teamB) => {
    const teamAPower = calculateTeamPower(teamA);
    const teamBPower = calculateTeamPower(teamB);
    
    let winner = 'draw';
    if (teamAPower > teamBPower) {
      winner = 'teamA';
    } else if (teamBPower > teamAPower) {
      winner = 'teamB';
    }
    
    return {
      winner,
      teamAPower,
      teamBPower,
      teamACollection: getTeamCollectionName(teamA),
      teamBCollection: getTeamCollectionName(teamB),
      battleLog: [
        `Team A power: ${teamAPower}`,
        `Team B power: ${teamBPower}`,
        winner === 'draw' ? 'Battle ended in a draw!' : `Team ${winner === 'teamA' ? 'A' : 'B'} wins!`
      ]
    };
  };

  // Calculate team power for local battles
  const calculateTeamPower = (team) => {
    return team.cards.reduce((total, card) => {
      return total + (card.attack || 0) + (card.health || 0) + (card.speed || 0);
    }, 0);
  };

  // Update local team stats after battle
  const updateLocalTeamStats = (teamA, teamB, result) => {
    if (result.winner === 'teamA') {
      setTeams(prevTeams => prevTeams.map(team => 
        team.id === teamA.id 
          ? { ...team, battlesWon: (team.battlesWon || 0) + 1 }
          : team.id === teamB.id
          ? { ...team, battlesLost: (team.battlesLost || 0) + 1 }
          : team
      ));
    } else if (result.winner === 'teamB') {
      setTeams(prevTeams => prevTeams.map(team => 
        team.id === teamB.id 
          ? { ...team, battlesWon: (team.battlesWon || 0) + 1 }
          : team.id === teamA.id
          ? { ...team, battlesLost: (team.battlesLost || 0) + 1 }
          : team
      ));
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
      
      {/* Show info message when using local storage */}
      {!isLoading && teams.length === 0 && (
        <div className={styles.infoMessage}>
          <p>💡 Teams are stored locally in your browser. Create your first team to get started!</p>
        </div>
      )}
      
      {/* Show message if no cards available */}
      {!isLoading && (!cards || cards.length === 0) && (
        <div className={styles.infoMessage} style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.3)' }}>
          <p>⚠️ No cards available. Please open some packs first to get cards for your teams!</p>
        </div>
      )}
      


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
            onAddCard={() => {
              // This should open the card selection, not close team creation
              console.log('➕ Add card button clicked');
            }}
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
