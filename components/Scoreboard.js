import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import styles from '../styles/Scoreboard.module.css';

export default function Scoreboard() {
  const { address } = useWallet();
  const [leaderboardType, setLeaderboardType] = useState('teams');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState('elo'); // elo, winRate, totalWins, totalBattles

  useEffect(() => {
    loadLeaderboard();
  }, [leaderboardType, limit, sortBy]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/leaderboard?type=${leaderboardType}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to load leaderboard');

      const data = await response.json();
      let entries = leaderboardType === 'teams' ? data.teams : data.users;

      // Apply additional sorting
      if (sortBy === 'elo') {
        entries = entries.sort((a, b) => (b.eloRating || 1000) - (a.eloRating || 1000));
      } else if (sortBy === 'winRate') {
        entries = entries.sort((a, b) => b.winRate - a.winRate);
      } else if (sortBy === 'totalWins') {
        const winsKey = leaderboardType === 'teams' ? 'battlesWon' : 'totalBattlesWon';
        entries = entries.sort((a, b) => b[winsKey] - a[winsKey]);
      } else if (sortBy === 'totalBattles') {
        const battlesKey = leaderboardType === 'teams' ? 'totalBattles' : 'totalBattles';
        entries = entries.sort((a, b) => b[battlesKey] - a[battlesKey]);
      }

      setLeaderboardData(entries);

      // Find current user's rank
      if (address) {
        const userIndex = entries.findIndex(entry => {
          if (leaderboardType === 'teams') {
            return entry.ownerAddress === address;
          } else {
            return entry.address === address;
          }
        });
        setMyRank(userIndex >= 0 ? userIndex + 1 : null);
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankClass = (rank) => {
    if (rank === 1) return styles.gold;
    if (rank === 2) return styles.silver;
    if (rank === 3) return styles.bronze;
    return '';
  };

  const formatAddress = (addr) => {
    if (!addr) return 'Unknown';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const getWinRateColor = (winRate) => {
    if (winRate >= 75) return styles.excellent;
    if (winRate >= 50) return styles.good;
    if (winRate >= 25) return styles.average;
    return styles.poor;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>🏆 Global Leaderboard</h2>
        <p>Compete with the best players and climb to the top!</p>
      </div>

      <div className={styles.controls}>
        <div className={styles.typeSelector}>
          <button
            className={`${styles.typeButton} ${leaderboardType === 'teams' ? styles.active : ''}`}
            onClick={() => setLeaderboardType('teams')}
          >
            ⚔️ Teams
          </button>
          <button
            className={`${styles.typeButton} ${leaderboardType === 'users' ? styles.active : ''}`}
            onClick={() => setLeaderboardType('users')}
          >
            👤 Players
          </button>
        </div>

        <div className={styles.filters}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={styles.sortSelect}
          >
            <option value="elo">ELO Rating</option>
            <option value="winRate">Win Rate</option>
            <option value="totalWins">Total Wins</option>
            <option value="totalBattles">Total Battles</option>
          </select>

          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className={styles.limitSelect}
          >
            <option value={25}>Top 25</option>
            <option value={50}>Top 50</option>
            <option value={100}>Top 100</option>
          </select>
        </div>
      </div>

      {myRank && (
        <div className={styles.myRank}>
          <span className={styles.myRankLabel}>Your Rank:</span>
          <span className={styles.myRankValue}>{getRankBadge(myRank)}</span>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <span>❌</span> {error}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading leaderboard...</p>
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className={styles.empty}>
          <p>No {leaderboardType} data available yet.</p>
          <p>Be the first to compete!</p>
        </div>
      ) : (
        <div className={styles.leaderboard}>
          {leaderboardType === 'teams' ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team Name</th>
                    <th>Owner</th>
                    <th>ELO</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Total</th>
                    <th>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.map((team, index) => {
                    const rank = index + 1;
                    const isMyTeam = team.ownerAddress === address;
                    
                    return (
                      <tr
                        key={team.id}
                        className={`${getRankClass(rank)} ${isMyTeam ? styles.highlighted : ''}`}
                      >
                        <td className={styles.rankCell}>
                          <span className={styles.rankBadge}>
                            {getRankBadge(rank)}
                          </span>
                        </td>
                        <td className={styles.nameCell}>
                          <strong>{team.name}</strong>
                          {isMyTeam && <span className={styles.youBadge}>YOU</span>}
                        </td>
                        <td className={styles.addressCell}>
                          {formatAddress(team.ownerAddress)}
                        </td>
                        <td className={styles.statCell}>
                          <span className={styles.elo}>{team.eloRating || 1000}</span>
                        </td>
                        <td className={styles.statCell}>
                          <span className={styles.wins}>{team.battlesWon || 0}</span>
                        </td>
                        <td className={styles.statCell}>
                          <span className={styles.losses}>{team.battlesLost || 0}</span>
                        </td>
                        <td className={styles.statCell}>
                          {team.totalBattles || 0}
                        </td>
                        <td className={styles.statCell}>
                          <span className={`${styles.winRate} ${getWinRateColor(team.winRate)}`}>
                            {team.winRate?.toFixed(1) || '0.0'}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Teams</th>
                    <th>Wins</th>
                    <th>Losses</th>
                    <th>Total</th>
                    <th>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.map((player, index) => {
                    const rank = index + 1;
                    const isMe = player.address === address;
                    
                    return (
                      <tr
                        key={player.address}
                        className={`${getRankClass(rank)} ${isMe ? styles.highlighted : ''}`}
                      >
                        <td className={styles.rankCell}>
                          <span className={styles.rankBadge}>
                            {getRankBadge(rank)}
                          </span>
                        </td>
                        <td className={styles.nameCell}>
                          <strong>{formatAddress(player.address)}</strong>
                          {isMe && <span className={styles.youBadge}>YOU</span>}
                        </td>
                        <td className={styles.statCell}>
                          {player.activeTeams || 0}/{player.totalTeams || 0}
                        </td>
                        <td className={styles.statCell}>
                          <span className={styles.wins}>{player.totalBattlesWon || 0}</span>
                        </td>
                        <td className={styles.statCell}>
                          <span className={styles.losses}>{player.totalBattlesLost || 0}</span>
                        </td>
                        <td className={styles.statCell}>
                          {player.totalBattles || 0}
                        </td>
                        <td className={styles.statCell}>
                          <span className={`${styles.winRate} ${getWinRateColor(player.winRate)}`}>
                            {player.winRate?.toFixed(1) || '0.0'}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className={styles.footer}>
        <button onClick={loadLeaderboard} className={styles.refreshButton}>
          🔄 Refresh
        </button>
        <p className={styles.hint}>
          Battle more to improve your ranking! 🚀
        </p>
      </div>
    </div>
  );
}
