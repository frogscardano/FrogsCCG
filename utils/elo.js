/**
 * ELO Rating System for Team Battles
 * 
 * Standard ELO formula with K-factor adjustments
 */

// K-factor determines how much ratings change per game
const K_FACTOR_BASE = 32; // Standard chess K-factor
const K_FACTOR_NEW_PLAYER = 40; // Higher for new players (< 10 games)
const K_FACTOR_MASTER = 16; // Lower for established players (> 50 games)

/**
 * Calculate expected score for a team
 * @param {number} ratingA - ELO rating of team A
 * @param {number} ratingB - ELO rating of team B
 * @returns {number} - Expected score (0 to 1)
 */
export function calculateExpectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Get K-factor based on number of games played
 * @param {number} totalGames - Total number of games played
 * @returns {number} - K-factor value
 */
export function getKFactor(totalGames) {
  if (totalGames < 10) {
    return K_FACTOR_NEW_PLAYER; // New players change faster
  } else if (totalGames > 50) {
    return K_FACTOR_MASTER; // Established players change slower
  }
  return K_FACTOR_BASE; // Standard K-factor
}

/**
 * Calculate new ELO ratings after a battle
 * @param {Object} teamA - Team A data with eloRating and total games
 * @param {Object} teamB - Team B data with eloRating and total games
 * @param {string} winner - 'A' or 'B'
 * @returns {Object} - New ratings for both teams
 */
export function calculateNewRatings(teamA, teamB, winner) {
  const ratingA = teamA.eloRating || 1000;
  const ratingB = teamB.eloRating || 1000;
  
  const totalGamesA = (teamA.battlesWon || 0) + (teamA.battlesLost || 0);
  const totalGamesB = (teamB.battlesWon || 0) + (teamB.battlesLost || 0);
  
  // Calculate expected scores
  const expectedA = calculateExpectedScore(ratingA, ratingB);
  const expectedB = calculateExpectedScore(ratingB, ratingA);
  
  // Actual scores (1 for win, 0 for loss)
  const actualA = winner === 'A' ? 1 : 0;
  const actualB = winner === 'B' ? 1 : 0;
  
  // Get K-factors
  const kA = getKFactor(totalGamesA);
  const kB = getKFactor(totalGamesB);
  
  // Calculate rating changes
  const changeA = Math.round(kA * (actualA - expectedA));
  const changeB = Math.round(kB * (actualB - expectedB));
  
  // Calculate new ratings (minimum 100, no upper limit)
  const newRatingA = Math.max(100, ratingA + changeA);
  const newRatingB = Math.max(100, ratingB + changeB);
  
  return {
    teamA: {
      oldRating: ratingA,
      newRating: newRatingA,
      change: changeA,
      expectedScore: expectedA
    },
    teamB: {
      oldRating: ratingB,
      newRating: newRatingB,
      change: changeB,
      expectedScore: expectedB
    }
  };
}

/**
 * Get ELO tier name based on rating
 * @param {number} rating - ELO rating
 * @returns {string} - Tier name
 */
export function getEloTier(rating) {
  if (rating >= 2000) return 'Grandmaster';
  if (rating >= 1800) return 'Master';
  if (rating >= 1600) return 'Expert';
  if (rating >= 1400) return 'Advanced';
  if (rating >= 1200) return 'Intermediate';
  if (rating >= 1000) return 'Novice';
  return 'Beginner';
}

/**
 * Get ELO tier color
 * @param {number} rating - ELO rating
 * @returns {string} - Hex color code
 */
export function getEloTierColor(rating) {
  if (rating >= 2000) return '#fbbf24'; // Gold
  if (rating >= 1800) return '#a78bfa'; // Purple
  if (rating >= 1600) return '#3b82f6'; // Blue
  if (rating >= 1400) return '#22c55e'; // Green
  if (rating >= 1200) return '#84cc16'; // Light Green
  if (rating >= 1000) return '#94a3b8'; // Gray
  return '#6b7280'; // Dark Gray
}

/**
 * Calculate matchmaking score (lower is better match)
 * @param {number} ratingA - ELO rating of team A
 * @param {number} ratingB - ELO rating of team B
 * @returns {number} - Matchmaking score (difference)
 */
export function getMatchmakingScore(ratingA, ratingB) {
  return Math.abs(ratingA - ratingB);
}

/**
 * Find best matches for a team based on ELO
 * @param {number} teamRating - Current team's ELO rating
 * @param {Array} availableTeams - Array of available opponent teams
 * @param {number} limit - Number of matches to return
 * @returns {Array} - Sorted array of best matches
 */
export function findBestMatches(teamRating, availableTeams, limit = 10) {
  return availableTeams
    .map(team => ({
      ...team,
      matchmakingScore: getMatchmakingScore(teamRating, team.eloRating || 1000)
    }))
    .sort((a, b) => a.matchmakingScore - b.matchmakingScore)
    .slice(0, limit);
}

/**
 * Get matchmaking range for fair games
 * @param {number} rating - Current ELO rating
 * @returns {Object} - Min and max rating for matchmaking
 */
export function getMatchmakingRange(rating) {
  // ±200 rating points for fair matches
  const range = 200;
  return {
    min: Math.max(100, rating - range),
    max: rating + range
  };
}

/**
 * Calculate win probability
 * @param {number} ratingA - ELO rating of team A
 * @param {number} ratingB - ELO rating of team B
 * @returns {number} - Win probability percentage (0-100)
 */
export function getWinProbability(ratingA, ratingB) {
  const expected = calculateExpectedScore(ratingA, ratingB);
  return Math.round(expected * 100);
}

export default {
  calculateExpectedScore,
  getKFactor,
  calculateNewRatings,
  getEloTier,
  getEloTierColor,
  getMatchmakingScore,
  findBestMatches,
  getMatchmakingRange,
  getWinProbability
};
