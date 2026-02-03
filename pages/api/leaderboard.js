import { prisma, withDatabase } from '../../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { type = 'teams', limit = 50 } = req.query;
    const limitNum = parseInt(limit);

    console.log(`📊 Fetching leaderboard: type=${type}, limit=${limitNum}`);

    await withDatabase(async (db) => {
      // Try both Team and team (case-sensitive Prisma models)
      const teamModel = db.Team || db.team;
      const userModel = db.User || db.user;

      if (type === 'teams') {
        // Get teams leaderboard
        const teams = await teamModel.findMany({
          where: {
            isActive: true,
            // Only include teams with at least one battle
            OR: [
              { battlesWon: { gt: 0 } },
              { battlesLost: { gt: 0 } }
            ]
          },
          include: {
            User: {
              select: {
                address: true
              }
            }
          },
          orderBy: [
            { eloRating: 'desc' },
            { battlesWon: 'desc' }
          ],
          take: limitNum
        });

        console.log(`✅ Found ${teams.length} teams for leaderboard`);

        // Format teams data
        const formattedTeams = teams.map(team => {
          const totalBattles = (team.battlesWon || 0) + (team.battlesLost || 0);
          const winRate = totalBattles > 0 
            ? ((team.battlesWon || 0) / totalBattles * 100) 
            : 0;

          return {
            id: team.id,
            name: team.name,
            ownerAddress: team.User?.address || 'unknown',
            eloRating: team.eloRating || 1000,
            battlesWon: team.battlesWon || 0,
            battlesLost: team.battlesLost || 0,
            totalBattles,
            winRate: parseFloat(winRate.toFixed(2)),
            createdAt: team.createdAt,
            updatedAt: team.updatedAt
          };
        });

        console.log(`📈 Team ELO ratings:`, formattedTeams.slice(0, 3).map(t => ({
          name: t.name,
          elo: t.eloRating,
          wins: t.battlesWon
        })));

        return res.status(200).json({
          success: true,
          teams: formattedTeams,
          count: formattedTeams.length
        });
      } else if (type === 'users') {
        // Get users leaderboard (aggregated from all their teams)
        const users = await userModel.findMany({
          include: {
            teams: {
              where: {
                isActive: true
              },
              select: {
                battlesWon: true,
                battlesLost: true,
                eloRating: true
              }
            }
          }
        });

        // Aggregate user stats
        const formattedUsers = users
          .map(user => {
            const totalBattlesWon = user.teams.reduce((sum, team) => sum + (team.battlesWon || 0), 0);
            const totalBattlesLost = user.teams.reduce((sum, team) => sum + (team.battlesLost || 0), 0);
            const totalBattles = totalBattlesWon + totalBattlesLost;
            const winRate = totalBattles > 0 ? (totalBattlesWon / totalBattles * 100) : 0;
            
            // Average ELO across all teams
            const avgElo = user.teams.length > 0
              ? user.teams.reduce((sum, team) => sum + (team.eloRating || 1000), 0) / user.teams.length
              : 1000;

            return {
              address: user.address,
              totalBattlesWon,
              totalBattlesLost,
              totalBattles,
              winRate: parseFloat(winRate.toFixed(2)),
              teamCount: user.teams.length,
              averageElo: Math.round(avgElo)
            };
          })
          .filter(user => user.totalBattles > 0) // Only users with battles
          .sort((a, b) => b.averageElo - a.averageElo) // Sort by ELO first
          .slice(0, limitNum);

        console.log(`✅ Found ${formattedUsers.length} users for leaderboard`);

        return res.status(200).json({
          success: true,
          users: formattedUsers,
          count: formattedUsers.length
        });
      } else {
        return res.status(400).json({ 
          error: 'Invalid type parameter',
          message: 'Type must be "teams" or "users"'
        });
      }
    });
  } catch (error) {
    console.error('❌ Leaderboard API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch leaderboard',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
