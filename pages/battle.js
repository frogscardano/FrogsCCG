import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Battle.module.css';
import { getEloTier, getEloTierColor, getWinProbability, findBestMatches } from '../utils/elo';

export default function BattleArena() {
  const { address, connected } = useWallet();
  const [myTeams, setMyTeams] = useState([]);
  const [selectedMyTeam, setSelectedMyTeam] = useState(null);
  const [opponentTeam, setOpponentTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [battling, setBattling] = useState(false);
  const [battleResult, setBattleResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Battle animation state
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [battleSpeed, setBattleSpeed] = useState(1000); // ms per action

  useEffect(() => {
    if (connected && address) {
      loadMyTeams();
    }
  }, [connected, address]);

  const loadMyTeams = async () => {
    try {
      setLoading(true);
      console.log(`🔍 Loading teams for address: ${address}`);
      
      const response = await fetch(`/api/teams/${address}`);
      if (!response.ok) {
        throw new Error('Failed to load teams');
      }
      
      const data = await response.json();
      const teams = data.teams || [];
      
      console.log(`✅ Found ${teams.length} teams for user`);
      setMyTeams(teams);
      
      // Auto-select first team
      if (teams.length > 0 && !selectedMyTeam) {
        const firstTeam = teams[0];
        console.log(`🎯 Auto-selected team: ${firstTeam.name}`);
        setSelectedMyTeam(firstTeam);
        
        // Auto-find opponent based on ELO
        await findOpponent(firstTeam);
      }
    } catch (err) {
      console.error('Error loading teams:', err);
      setError(`Failed to load your teams: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const findOpponent = async (myTeam) => {
    try {
      setLoading(true);
      console.log(`🔍 Finding opponent for ${myTeam.name} (ELO: ${myTeam.eloRating || 1000})`);
      
      // Get all teams
      const response = await fetch(`/api/teams/all?limit=100`);
      if (!response.ok) {
        throw new Error('Failed to load opponent teams');
      }
      
      const data = await response.json();
      let allTeams = data.teams || [];
      
      console.log(`📊 Loaded ${allTeams.length} total teams from database`);
      
      // Filter out my teams
      const myOwnerAddress = myTeam.ownerAddress;
      allTeams = allTeams.filter(team => team.ownerAddress !== myOwnerAddress);
      
      console.log(`🔍 After filtering same wallet: ${allTeams.length} opponents`);
      
      if (allTeams.length === 0) {
        setError('No opponents available. Waiting for other players!');
        setOpponentTeam(null);
        return;
      }
      
      // Find best match based on ELO
      const myElo = myTeam.eloRating || 1000;
      const bestMatches = findBestMatches(myElo, allTeams, 5);
      
      // Pick randomly from top 5 matches
      const selectedOpponent = bestMatches[Math.floor(Math.random() * Math.min(5, bestMatches.length))];
      
      console.log(`✅ Auto-matched opponent: ${selectedOpponent.name} (ELO: ${selectedOpponent.eloRating || 1000})`);
      console.log(`📊 ELO difference: ${Math.abs(myElo - (selectedOpponent.eloRating || 1000))}`);
      
      setOpponentTeam(selectedOpponent);
      setError(null);
    } catch (err) {
      console.error('Error finding opponent:', err);
      setError(`Failed to find opponent: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startBattle = async () => {
    if (!selectedMyTeam || !opponentTeam) {
      setError('Please select your team and wait for an opponent!');
      return;
    }

    if (!selectedMyTeam.cards || selectedMyTeam.cards.length === 0) {
      setError('Your team has no cards!');
      return;
    }

    if (!opponentTeam.cards || opponentTeam.cards.length === 0) {
      setError('Opponent team has no cards!');
      return;
    }

    try {
      setBattling(true);
      setError(null);
      setCurrentLogIndex(0);
      
      console.log(`⚔️ Starting battle: ${selectedMyTeam.name} vs ${opponentTeam.name}`);
      console.log(`Team A cards:`, selectedMyTeam.cards);
      console.log(`Team B cards:`, opponentTeam.cards);

      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamA: selectedMyTeam.cards,
          teamB: opponentTeam.cards,
          teamAId: selectedMyTeam.id,
          teamBId: opponentTeam.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Battle failed');
      }

      const result = await response.json();
      console.log(`✅ Battle completed:`, result);
      
      setBattleResult(result);
      
    } catch (err) {
      console.error('Battle error:', err);
      setError(`Battle failed: ${err.message}`);
      setBattling(false);
    }
  };

  // Animate battle log step by step
  useEffect(() => {
    if (battleResult && battling && currentLogIndex < battleResult.battleLog.length) {
      const timer = setTimeout(() => {
        setCurrentLogIndex(prev => prev + 1);
      }, battleSpeed);
      
      return () => clearTimeout(timer);
    } else if (battleResult && currentLogIndex >= battleResult.battleLog.length) {
      // Battle animation complete
      setBattling(false);
    }
  }, [battleResult, battling, currentLogIndex, battleSpeed]);

  const resetBattle = () => {
    setBattleResult(null);
    setCurrentLogIndex(0);
    setBattling(false);
    
    // Auto-find new opponent
    if (selectedMyTeam) {
      findOpponent(selectedMyTeam);
    }
  };

  const changeTeam = async (teamId) => {
    const team = myTeams.find(t => t.id === teamId);
    if (team) {
      setSelectedMyTeam(team);
      setBattleResult(null);
      await findOpponent(team);
    }
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

      <div className={styles.header}>
        <Link href="/">
          <a className={styles.backButton}>← Back to Home</a>
        </Link>
        <h1>⚔️ Battle Arena</h1>
        <p>Challenge other players and climb the leaderboard!</p>
      </div>

      {error && (
        <div className={styles.error}>
          <span>❌</span> {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {battleResult ? (
        <div className={styles.battleAnimation}>
          <div className={styles.battleHeader}>
            <h2>⚔️ Battle in Progress...</h2>
            <div className={styles.speedControl}>
              <label>Speed:</label>
              <button onClick={() => setBattleSpeed(2000)} className={battleSpeed === 2000 ? styles.active : ''}>Slow</button>
              <button onClick={() => setBattleSpeed(1000)} className={battleSpeed === 1000 ? styles.active : ''}>Normal</button>
              <button onClick={() => setBattleSpeed(500)} className={battleSpeed === 500 ? styles.active : ''}>Fast</button>
              <button onClick={() => setCurrentLogIndex(battleResult.battleLog.length)} className={styles.skipButton}>Skip</button>
            </div>
          </div>

          <div className={styles.battleField}>
            <div className={styles.teamSide}>
              <h3>{selectedMyTeam.name}</h3>
              <div className={styles.cardsGrid}>
                {battleResult.finalState?.teamA?.map((card, idx) => (
                  <div 
                    key={idx} 
                    className={`${styles.battleCard} ${!card.isAlive ? styles.defeated : ''}`}
                  >
                    <img src={card.image || card.imageUrl} alt={card.name} />
                    <div className={styles.cardName}>{card.name}</div>
                    <div className={styles.healthBar}>
                      <div 
                        className={styles.healthFill}
                        style={{ 
                          width: `${(card.currentHealth / card.maxHealth) * 100}%`,
                          backgroundColor: card.isAlive ? '#22c55e' : '#ef4444'
                        }}
                      />
                      <span>{card.currentHealth} / {card.maxHealth}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.vsSection}>
              <div className={styles.vsIcon}>⚔️</div>
            </div>

            <div className={styles.teamSide}>
              <h3>{opponentTeam.name}</h3>
              <div className={styles.cardsGrid}>
                {battleResult.finalState?.teamB?.map((card, idx) => (
                  <div 
                    key={idx} 
                    className={`${styles.battleCard} ${!card.isAlive ? styles.defeated : ''}`}
                  >
                    <img src={card.image || card.imageUrl} alt={card.name} />
                    <div className={styles.cardName}>{card.name}</div>
                    <div className={styles.healthBar}>
                      <div 
                        className={styles.healthFill}
                        style={{ 
                          width: `${(card.currentHealth / card.maxHealth) * 100}%`,
                          backgroundColor: card.isAlive ? '#22c55e' : '#ef4444'
                        }}
                      />
                      <span>{card.currentHealth} / {card.maxHealth}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.battleLogContainer}>
            <h3>📜 Battle Log</h3>
            <div className={styles.battleLog}>
              {battleResult.battleLog.slice(0, currentLogIndex).map((log, idx) => (
                <div key={idx} className={`${styles.logEntry} ${styles[log.type]}`}>
                  {log.type === 'attack' && (
                    <div className={styles.attackLog}>
                      <img src={log.attacker.image} alt={log.attacker.name} className={styles.attackerImage} />
                      <span className={styles.attackText}>
                        <strong>{log.attacker.name}</strong> deals <strong className={styles.damage}>{log.damage}</strong> damage to <strong>{log.target.name}</strong>
                        {log.died && <span className={styles.defeated}> 💀 DEFEATED!</span>}
                      </span>
                      <img src={log.target.image} alt={log.target.name} className={styles.targetImage} />
                    </div>
                  )}
                  {log.type === 'round_start' && (
                    <div className={styles.roundStart}>
                      <strong>--- Round {log.round} ---</strong>
                      <span>Team A: {log.aliveTeamA} alive | Team B: {log.aliveTeamB} alive</span>
                    </div>
                  )}
                  {log.type === 'start' && (
                    <div className={styles.battleStart}>⚔️ Battle Started!</div>
                  )}
                  {log.type === 'end' && (
                    <div className={styles.battleEnd}>
                      🏆 <strong>Team {log.winner} wins!</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {currentLogIndex >= battleResult.battleLog.length && (
            <div className={styles.battleResults}>
              <div className={styles.resultsHeader}>
                <h2>
                  {battleResult.winner === 'A' ? '🏆 Victory!' : '💀 Defeat'}
                </h2>
              </div>

              {battleResult.eloChanges && (
                <div className={styles.eloChanges}>
                  <h3>📈 ELO Rating Changes</h3>
                  <div className={styles.eloChangesSummary}>
                    <div className={`${styles.eloChange} ${battleResult.winner === 'A' ? styles.eloWin : styles.eloLoss}`}>
                      <div className={styles.eloChangeTeam}>{selectedMyTeam.name}</div>
                      <div className={styles.eloChangeValues}>
                        <span className={styles.eloOld}>{battleResult.eloChanges.teamA.oldRating}</span>
                        <span className={styles.eloArrow}>→</span>
                        <span className={styles.eloNew}>{battleResult.eloChanges.teamA.newRating}</span>
                        <span className={`${styles.eloChangeAmount} ${battleResult.eloChanges.teamA.change >= 0 ? styles.positive : styles.negative}`}>
                          {battleResult.eloChanges.teamA.change >= 0 ? '+' : ''}{battleResult.eloChanges.teamA.change}
                        </span>
                      </div>
                    </div>
                    <div className={`${styles.eloChange} ${battleResult.winner === 'B' ? styles.eloWin : styles.eloLoss}`}>
                      <div className={styles.eloChangeTeam}>{opponentTeam.name}</div>
                      <div className={styles.eloChangeValues}>
                        <span className={styles.eloOld}>{battleResult.eloChanges.teamB.oldRating}</span>
                        <span className={styles.eloArrow}>→</span>
                        <span className={styles.eloNew}>{battleResult.eloChanges.teamB.newRating}</span>
                        <span className={`${styles.eloChangeAmount} ${battleResult.eloChanges.teamB.change >= 0 ? styles.positive : styles.negative}`}>
                          {battleResult.eloChanges.teamB.change >= 0 ? '+' : ''}{battleResult.eloChanges.teamB.change}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.resultsActions}>
                <button onClick={resetBattle} className={styles.primaryButton}>
                  ⚔️ Next Battle
                </button>
                <Link href="/teams">
                  <a className={styles.secondaryButton}>🏆 View Leaderboard</a>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.battleSetup}>
          <div className={styles.matchup}>
            <div className={styles.teamDisplay}>
              <h2>👤 Your Team</h2>
              {loading && !selectedMyTeam ? (
                <div className={styles.loading}>Loading your teams...</div>
              ) : myTeams.length === 0 ? (
                <div className={styles.noTeams}>
                  <p>You don't have any teams yet!</p>
                  <Link href="/teams">
                    <a className={styles.createTeamButton}>Create a Team</a>
                  </Link>
                </div>
              ) : (
                <>
                  <select 
                    value={selectedMyTeam?.id || ''} 
                    onChange={(e) => changeTeam(e.target.value)}
                    className={styles.teamSelect}
                  >
                    {myTeams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} (ELO: {team.eloRating || 1000})
                      </option>
                    ))}
                  </select>

                  {selectedMyTeam && (
                    <div className={styles.teamPreview}>
                      <h3>{selectedMyTeam.name}</h3>
                      <div 
                        className={styles.eloDisplay}
                        style={{ color: getEloTierColor(selectedMyTeam.eloRating || 1000) }}
                      >
                        <span className={styles.eloValue}>{selectedMyTeam.eloRating || 1000}</span>
                        <span className={styles.eloTier}>({getEloTier(selectedMyTeam.eloRating || 1000)})</span>
                      </div>
                      <div className={styles.teamStats}>
                        <div className={styles.stat}>
                          <span className={styles.statLabel}>W/L:</span>
                          <span className={styles.statValue}>{selectedMyTeam.battlesWon || 0} / {selectedMyTeam.battlesLost || 0}</span>
                        </div>
                      </div>
                      <div className={styles.teamCards}>
                        {selectedMyTeam.cards?.map((card, idx) => (
                          <div key={idx} className={styles.cardMini}>
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
              {selectedMyTeam && opponentTeam && (
                <div className={styles.winProbability}>
                  Win Chance: {getWinProbability(selectedMyTeam.eloRating || 1000, opponentTeam.eloRating || 1000)}%
                </div>
              )}
            </div>

            <div className={styles.teamDisplay}>
              <h2>🎯 Opponent</h2>
              {loading ? (
                <div className={styles.loading}>Finding opponent...</div>
              ) : !opponentTeam ? (
                <div className={styles.noOpponent}>
                  <p>No opponents available</p>
                  <button onClick={() => findOpponent(selectedMyTeam)} className={styles.refreshButton}>
                    🔄 Retry
                  </button>
                </div>
              ) : (
                <div className={styles.teamPreview}>
                  <h3>{opponentTeam.name}</h3>
                  <div 
                    className={styles.eloDisplay}
                    style={{ color: getEloTierColor(opponentTeam.eloRating || 1000) }}
                  >
                    <span className={styles.eloValue}>{opponentTeam.eloRating || 1000}</span>
                    <span className={styles.eloTier}>({getEloTier(opponentTeam.eloRating || 1000)})</span>
                  </div>
                  <div className={styles.teamStats}>
                    <div className={styles.stat}>
                      <span className={styles.statLabel}>W/L:</span>
                      <span className={styles.statValue}>{opponentTeam.battlesWon || 0} / {opponentTeam.battlesLost || 0}</span>
                    </div>
                  </div>
                  <div className={styles.teamCards}>
                    {opponentTeam.cards?.map((card, idx) => (
                      <div key={idx} className={styles.cardMini}>
                        <img src={card.image || card.imageUrl} alt={card.name} />
                        <span className={styles.cardName}>{card.name}</span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => findOpponent(selectedMyTeam)} 
                    className={styles.rerollButton}
                    disabled={loading}
                  >
                    🎲 Find Different Opponent
                  </button>
                </div>
              )}
            </div>
          </div>

          {selectedMyTeam && opponentTeam && (
            <div className={styles.battleActions}>
              <button 
                onClick={startBattle} 
                className={styles.startBattleButton}
                disabled={battling || loading}
              >
                {battling ? '⚔️ Battling...' : '⚔️ Start Battle!'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
