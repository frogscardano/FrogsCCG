import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Battle.module.css';

export default function BattlePage() {
  const { connected, address } = useWallet();
  const [myTeams, setMyTeams] = useState([]);
  const [selectedMyTeam, setSelectedMyTeam] = useState(null);
  const [opponentTeams, setOpponentTeams] = useState([]);
  const [selectedOpponentTeam, setSelectedOpponentTeam] = useState(null);
  const [battleInProgress, setBattleInProgress] = useState(false);
  const [battleResult, setBattleResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all'); // all, top, random
  const [showAllOpponents, setShowAllOpponents] = useState(true);

  // Load user's teams
  useEffect(() => {
    if (connected && address) {
      loadMyTeams();
    }
  }, [connected, address]);

  // Load opponent teams when a team is selected
  useEffect(() => {
    if (selectedMyTeam) {
      loadOpponentTeams();
    }
  }, [selectedMyTeam, filterBy]);

  const loadMyTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔍 Loading teams for address: ${address}`);
      
      const response = await fetch(`/api/teams/${address}`);
      if (!response.ok) {
        throw new Error(`Failed to load teams: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Received teams data:', data);
      
      const teams = data.teams || [];
      console.log(`✅ Found ${teams.length} teams for user`);
      
      // Log owner addresses for debugging
      if (teams.length > 0) {
        console.log('👤 My teams owner addresses:', teams.map(t => ({
          name: t.name,
          owner: t.ownerAddress || 'MISSING'
        })));
      }
      
      setMyTeams(teams);
      
      if (teams.length > 0 && !selectedMyTeam) {
        setSelectedMyTeam(teams[0]);
        console.log(`🎯 Auto-selected team: ${teams[0].name} (Owner: ${teams[0].ownerAddress})`);
      } else if (teams.length === 0) {
        setError('You don\'t have any teams yet. Please create a team first!');
      }
    } catch (err) {
      console.error('❌ Error loading teams:', err);
      setError(`Failed to load your teams: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadOpponentTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get all teams from database
      const response = await fetch(`/api/teams/all?limit=100`);
      if (!response.ok) {
        throw new Error('Failed to load opponent teams');
      }
      
      const data = await response.json();
      let teams = data.teams || [];
      
      console.log(`📊 Loaded ${teams.length} total teams from database`);
      console.log('🔍 All teams:', teams.map(t => ({
        name: t.name,
        owner: t.ownerAddress
      })));
      
      // Filter out teams from the same owner (same wallet address)
      if (selectedMyTeam && selectedMyTeam.ownerAddress) {
        const myOwnerAddress = selectedMyTeam.ownerAddress;
        console.log(`🔍 Filtering out teams from my wallet: ${myOwnerAddress}`);
        
        const beforeCount = teams.length;
        teams = teams.filter(team => team.ownerAddress !== myOwnerAddress);
        const afterCount = teams.length;
        
        console.log(`🔍 Filtered: ${beforeCount} total → ${afterCount} opponents (removed ${beforeCount - afterCount} teams from same wallet)`);
        console.log('✅ Remaining opponent teams:', teams.map(t => ({
          name: t.name,
          owner: t.ownerAddress
        })));
      }
      
      // Apply filters
      if (filterBy === 'top') {
        // Sort by win rate first, then by total wins
        teams = teams
          .sort((a, b) => {
            if (b.winRate !== a.winRate) {
              return b.winRate - a.winRate;
            }
            return b.battlesWon - a.battlesWon;
          })
          .slice(0, 20); // Top 20 teams
      } else if (filterBy === 'random') {
        teams = teams.sort(() => Math.random() - 0.5).slice(0, 20);
      }
      
      // Apply search filter
      if (searchTerm) {
        teams = teams.filter(team => 
          team.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      setOpponentTeams(teams);
      
      if (teams.length === 0) {
        setError('No opponent teams found. Teams from other wallets will appear here!');
      } else {
        console.log(`✅ ${teams.length} opponent teams ready for battle (from different wallets)`);
      }
    } catch (err) {
      console.error('Error loading opponent teams:', err);
      setError(`Failed to load opponents: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateTeamPower = (team) => {
    if (!team.cards || team.cards.length === 0) return 0;
    
    return team.cards.reduce((total, card) => {
      return total + (card.attack || 0) + (card.health || 0) + (card.speed || 0);
    }, 0);
  };

  const startBattle = async () => {
    if (!selectedMyTeam || !selectedOpponentTeam) {
      setError('Please select both teams to battle');
      return;
    }

    try {
      setBattleInProgress(true);
      setError(null);
      setBattleResult(null);

      // Prepare team data for battle
      const teamAData = selectedMyTeam.cards.map(card => ({
        id: card.id,
        name: card.name,
        attack: card.attack || 1,
        health: card.health || 1,
        speed: card.speed || 1,
        rarity: card.rarity || 'Common'
      }));

      const teamBData = selectedOpponentTeam.cards.map(card => ({
        id: card.id,
        name: card.name,
        attack: card.attack || 1,
        health: card.health || 1,
        speed: card.speed || 1,
        rarity: card.rarity || 'Common'
      }));

      console.log('Starting battle:', {
        teamA: selectedMyTeam.name,
        teamB: selectedOpponentTeam.name
      });

      // Call battle API
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamA: teamAData,
          teamB: teamBData,
          teamAId: selectedMyTeam.id,
          teamBId: selectedOpponentTeam.id
        })
      });

      if (!response.ok) {
        throw new Error('Battle simulation failed');
      }

      const result = await response.json();
      setBattleResult(result);

      // Refresh teams to update battle stats
      setTimeout(() => {
        loadMyTeams();
        loadOpponentTeams();
      }, 2000);

    } catch (err) {
      console.error('Battle error:', err);
      setError(err.message);
    } finally {
      setBattleInProgress(false);
    }
  };

  const resetBattle = () => {
    setBattleResult(null);
    setSelectedOpponentTeam(null);
  };

  const getRandomOpponent = () => {
    if (opponentTeams.length === 0) {
      setError('No teams available. Please refresh the page.');
      return;
    }
    
    // Get a random team that's not currently selected
    const availableTeams = opponentTeams.filter(team => 
      !selectedOpponentTeam || team.id !== selectedOpponentTeam.id
    );
    
    if (availableTeams.length === 0) {
      // If only one team, just select it again
      setSelectedOpponentTeam(opponentTeams[0]);
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableTeams.length);
    const randomTeam = availableTeams[randomIndex];
    setSelectedOpponentTeam(randomTeam);
    console.log(`🎲 Random opponent selected: ${randomTeam.name}`);
  };

  if (!connected) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Battle Arena - Frogs CCG</title>
        </Head>
        <div className={styles.notConnected}>
          <h1>🔌 Connect Your Wallet</h1>
          <p>Please connect your wallet to access the Battle Arena</p>
          <Link href="/">
            <a className={styles.backButton}>← Back to Home</a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Battle Arena - Frogs CCG</title>
        <meta name="description" content="Challenge other players in epic team battles" />
      </Head>

      <header className={styles.header}>
        <Link href="/">
          <a className={styles.backButton}>← Back to Home</a>
        </Link>
        <h1>⚔️ Battle Arena</h1>
        <p>Challenge other players and climb the leaderboard!</p>
      </header>

      {error && (
        <div className={styles.error}>
          <span>❌</span> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {battleResult ? (
        <div className={styles.battleResults}>
          <div className={styles.resultsHeader}>
            <h2>⚔️ Battle Complete!</h2>
          </div>

          <div className={styles.battleSummary}>
            <div className={`${styles.teamResult} ${battleResult.winner === 'A' ? styles.winner : styles.loser}`}>
              <h3>{selectedMyTeam.name}</h3>
              <div className={styles.teamStatus}>
                {battleResult.winner === 'A' ? '🏆 Victory!' : '💀 Defeat'}
              </div>
              <div className={styles.finalStats}>
                <p>Final Health: {battleResult.finalHealth.teamA}</p>
                <p>Total Power: {battleResult.teamStats.teamA.totalPower}</p>
              </div>
            </div>

            <div className={styles.vsIcon}>VS</div>

            <div className={`${styles.teamResult} ${battleResult.winner === 'B' ? styles.winner : styles.loser}`}>
              <h3>{selectedOpponentTeam.name}</h3>
              <div className={styles.teamStatus}>
                {battleResult.winner === 'B' ? '🏆 Victory!' : '💀 Defeat'}
              </div>
              <div className={styles.finalStats}>
                <p>Final Health: {battleResult.finalHealth.teamB}</p>
                <p>Total Power: {battleResult.teamStats.teamB.totalPower}</p>
              </div>
            </div>
          </div>

          <div className={styles.battleLog}>
            <h3>📜 Battle Log</h3>
            <div className={styles.logContent}>
              {battleResult.battleLog.map((log, index) => (
                <p key={index} className={styles.logEntry}>{log}</p>
              ))}
            </div>
          </div>

          <div className={styles.resultsActions}>
            <button onClick={resetBattle} className={styles.primaryButton}>
              ⚔️ Battle Again
            </button>
            <Link href="/teams">
              <a className={styles.secondaryButton}>🏆 View Leaderboard</a>
            </Link>
          </div>
        </div>
      ) : (
        <div className={styles.battleSetup}>
          <div className={styles.teamSelection}>
            <div className={styles.myTeamSection}>
              <h2>👤 Your Team</h2>
              {loading && !selectedMyTeam ? (
                <div className={styles.loading}>Loading your teams...</div>
              ) : myTeams.length === 0 ? (
                <div className={styles.noTeams}>
                  <p>You don't have any teams yet!</p>
                  <Link href="/">
                    <a className={styles.createTeamButton}>Create a Team</a>
                  </Link>
                </div>
              ) : (
                <>
                  <select 
                    value={selectedMyTeam?.id || ''} 
                    onChange={(e) => {
                      const team = myTeams.find(t => t.id === e.target.value);
                      setSelectedMyTeam(team);
                    }}
                    className={styles.teamSelect}
                  >
                    {myTeams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} (Power: {calculateTeamPower(team)})
                      </option>
                    ))}
                  </select>

                  {selectedMyTeam && (
                    <div className={styles.teamPreview}>
                      <h3>{selectedMyTeam.name}</h3>
                      <div className={styles.teamStats}>
                        <div className={styles.stat}>
                          <span className={styles.statLabel}>Cards:</span>
                          <span className={styles.statValue}>{selectedMyTeam.cards?.length || 0}</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.statLabel}>Power:</span>
                          <span className={styles.statValue}>{calculateTeamPower(selectedMyTeam)}</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.statLabel}>Wins:</span>
                          <span className={styles.statValue}>{selectedMyTeam.battlesWon || 0}</span>
                        </div>
                        <div className={styles.stat}>
                          <span className={styles.statLabel}>Losses:</span>
                          <span className={styles.statValue}>{selectedMyTeam.battlesLost || 0}</span>
                        </div>
                      </div>
                      <div className={styles.teamCards}>
                        {selectedMyTeam.cards?.map(card => (
                          <div key={card.id} className={styles.cardMini}>
                            <img src={card.image || card.imageUrl} alt={card.name} />
                            <span className={styles.cardName}>{card.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={styles.vsSection}>
              <div className={styles.vsIcon}>⚔️</div>
            </div>

            <div className={styles.opponentSection}>
              <h2>🎯 Select Opponent</h2>
              
              <div className={styles.opponentFilters}>
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
                <select 
                  value={filterBy} 
                  onChange={(e) => setFilterBy(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">All Teams</option>
                  <option value="top">Top Ranked</option>
                  <option value="random">Random</option>
                </select>
              </div>

              <div className={styles.opponentActions}>
                <button 
                  onClick={getRandomOpponent}
                  className={styles.randomButton}
                  disabled={loading || opponentTeams.length === 0}
                  title="Pick a random opponent"
                >
                  🎲 Random Opponent
                </button>
                <button
                  onClick={() => setShowAllOpponents(!showAllOpponents)}
                  className={styles.toggleButton}
                >
                  {showAllOpponents ? '📋 Show List' : '🎯 Quick Match'}
                </button>
                <button
                  onClick={loadOpponentTeams}
                  className={styles.refreshButton}
                  disabled={loading}
                  title="Refresh opponent list"
                >
                  🔄 Refresh
                </button>
              </div>

              {loading ? (
                <div className={styles.loading}>Loading opponents...</div>
              ) : opponentTeams.length === 0 ? (
                <div className={styles.noOpponents}>
                  <p>😔 No opponent teams found</p>
                  {error ? (
                    <p className={styles.errorHint}>{error}</p>
                  ) : (
                    <>
                      <p>Waiting for teams from other wallet addresses!</p>
                      <p className={styles.hint}>💡 Teams from the same wallet cannot battle each other</p>
                    </>
                  )}
                </div>
              ) : showAllOpponents ? (
                <div className={styles.opponentsList}>
                  {opponentTeams.map(team => (
                    <div
                      key={team.id}
                      className={`${styles.opponentCard} ${selectedOpponentTeam?.id === team.id ? styles.selected : ''}`}
                      onClick={() => setSelectedOpponentTeam(team)}
                    >
                      <div className={styles.opponentHeader}>
                        <h4>{team.name}</h4>
                        {selectedOpponentTeam?.id === team.id && (
                          <span className={styles.selectedBadge}>✓ Selected</span>
                        )}
                      </div>
                      <div className={styles.opponentStats}>
                        <span>Power: {calculateTeamPower(team)}</span>
                        <span>W: {team.battlesWon || 0} / L: {team.battlesLost || 0}</span>
                        {team.winRate !== undefined && team.totalBattles > 0 && (
                          <span className={styles.winRate}>
                            {team.winRate.toFixed(1)}% WR
                          </span>
                        )}
                      </div>
                      <div className={styles.opponentOwner}>
                        Owner: {team.ownerAddress?.slice(0, 8)}...{team.ownerAddress?.slice(-6)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.quickMatch}>
                  {selectedOpponentTeam ? (
                    <div className={styles.quickMatchCard}>
                      <h3>🎯 {selectedOpponentTeam.name}</h3>
                      <div className={styles.quickMatchStats}>
                        <div className={styles.quickStat}>
                          <span className={styles.quickLabel}>Power:</span>
                          <span className={styles.quickValue}>{calculateTeamPower(selectedOpponentTeam)}</span>
                        </div>
                        <div className={styles.quickStat}>
                          <span className={styles.quickLabel}>Wins:</span>
                          <span className={styles.quickValue}>{selectedOpponentTeam.battlesWon || 0}</span>
                        </div>
                        <div className={styles.quickStat}>
                          <span className={styles.quickLabel}>Losses:</span>
                          <span className={styles.quickValue}>{selectedOpponentTeam.battlesLost || 0}</span>
                        </div>
                        {selectedOpponentTeam.totalBattles > 0 && (
                          <div className={styles.quickStat}>
                            <span className={styles.quickLabel}>Win Rate:</span>
                            <span className={styles.quickValue}>{selectedOpponentTeam.winRate.toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.quickMatchCards}>
                        {selectedOpponentTeam.cards?.slice(0, 5).map(card => (
                          <div key={card.id} className={styles.quickCardMini}>
                            <img src={card.image || card.imageUrl} alt={card.name} />
                          </div>
                        ))}
                      </div>
                      <p className={styles.quickMatchHint}>Click "Random Opponent" to change</p>
                    </div>
                  ) : (
                    <div className={styles.quickMatchEmpty}>
                      <p>Click "Random Opponent" to select a team!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedMyTeam && selectedOpponentTeam && (
            <div className={styles.battleActions}>
              <button
                onClick={startBattle}
                disabled={battleInProgress}
                className={styles.battleButton}
              >
                {battleInProgress ? '⚔️ Battle in Progress...' : '⚔️ Start Battle!'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
