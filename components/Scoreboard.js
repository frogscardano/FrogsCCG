import React, { useState, useEffect } from 'react';
import styles from './Scoreboard.module.css';

const Scoreboard = () => {
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardType, setLeaderboardType] = useState('teams');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchLeaderboard();
  }, [leaderboardType, refreshKey]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/leaderboard?type=${leaderboardType}&limit=100`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      
      const data = await response.json();
      setLeaderboardData(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setError('Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const formatAddress = (address) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getWinRateColor = (winRate) => {
    if (winRate >= 80) return '#4CAF50'; // Green
    if (winRate >= 60) return '#8BC34A'; // Light Green
    if (winRate >= 40) return '#FFC107'; // Yellow
    if (winRate >= 20) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  if (isLoading) {
    return (
      <div className={styles.scoreboard}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.scoreboard}>
        <div className={styles.error}>
          <p>❌ {error}</p>
          <button onClick={handleRefresh} className={styles.refreshButton}>
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.scoreboard}>
      <div className={styles.header}>
        <h2>🏆 Leaderboard</h2>
        <div className={styles.controls}>
          <select 
            value={leaderboardType} 
            onChange={(e) => setLeaderboardType(e.target.value)}
            className={styles.typeSelector}
          >
            <option value="teams">Top Teams</option>
            <option value="users">Top Players</option>
            <option value="recent">Recent Battles</option>
          </select>
          <button onClick={handleRefresh} className={styles.refreshButton}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {leaderboardType === 'teams' && leaderboardData?.teams && (
        <div className={styles.leaderboard}>
          <div className={styles.tableHeader}>
            <span className={styles.rankCol}>Rank</span>
            <span className={styles.nameCol}>Team Name</span>
            <span className={styles.ownerCol}>Owner</span>
            <span className={styles.statsCol}>Wins</span>
            <span className={styles.statsCol}>Losses</span>
            <span className={styles.statsCol}>Win Rate</span>
            <span className={styles.statsCol}>Total Battles</span>
          </div>
          
          {leaderboardData.teams.map((team, index) => (
            <div key={team.id} className={styles.tableRow}>
              <span className={styles.rankCol}>
                <span className={styles.rankIcon}>{getRankIcon(index + 1)}</span>
              </span>
              <span className={styles.nameCol}>
                <strong>{team.name}</strong>
              </span>
              <span className={styles.ownerCol}>
                {formatAddress(team.ownerAddress)}
              </span>
              <span className={styles.statsCol}>
                <span className={styles.wins}>{team.battlesWon}</span>
              </span>
              <span className={styles.statsCol}>
                <span className={styles.losses}>{team.battlesLost}</span>
              </span>
              <span className={styles.statsCol}>
                <span 
                  className={styles.winRate}
                  style={{ color: getWinRateColor(team.winRate) }}
                >
                  {team.winRate}%
                </span>
              </span>
              <span className={styles.statsCol}>
                {team.totalBattles}
              </span>
            </div>
          ))}
        </div>
      )}

      {leaderboardType === 'users' && leaderboardData?.users && (
        <div className={styles.leaderboard}>
          <div className={styles.tableHeader}>
            <span className={styles.rankCol}>Rank</span>
            <span className={styles.ownerCol}>Player Address</span>
            <span className={styles.statsCol}>Total Wins</span>
            <span className={styles.statsCol}>Total Losses</span>
            <span className={styles.statsCol}>Win Rate</span>
            <span className={styles.statsCol}>Active Teams</span>
            <span className={styles.statsCol}>Total Teams</span>
          </div>
          
          {leaderboardData.users.map((user, index) => (
            <div key={user.address} className={styles.tableRow}>
              <span className={styles.rankCol}>
                <span className={styles.rankIcon}>{getRankIcon(index + 1)}</span>
              </span>
              <span className={styles.ownerCol}>
                {formatAddress(user.address)}
              </span>
              <span className={styles.statsCol}>
                <span className={styles.wins}>{user.totalBattlesWon}</span>
              </span>
              <span className={styles.statsCol}>
                <span className={styles.losses}>{user.totalBattlesLost}</span>
              </span>
              <span className={styles.statsCol}>
                <span 
                  className={styles.winRate}
                  style={{ color: getWinRateColor(user.winRate) }}
                >
                  {user.winRate}%
                </span>
              </span>
              <span className={styles.statsCol}>
                {user.activeTeams}
              </span>
              <span className={styles.statsCol}>
                {user.totalTeams}
              </span>
            </div>
          ))}
        </div>
      )}

      {leaderboardType === 'recent' && (
        <div className={styles.comingSoon}>
          <h3>🚧 Coming Soon!</h3>
          <p>Recent battles feature is under development.</p>
          <p>Check back soon to see the latest battle results!</p>
        </div>
      )}

      {leaderboardData && (
        <div className={styles.footer}>
          <p>Showing top {leaderboardData.total} {leaderboardType}</p>
          <p>Last updated: {new Date().toLocaleString()}</p>
        </div>
      )}
    </div>
  );
};

export default Scoreboard;
