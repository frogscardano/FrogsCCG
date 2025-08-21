import { prisma, withDatabase } from '../../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { type = 'teams', limit = 50, offset = 0 } = req.query;

    console.log(`🏆 Fetching leaderboard: type=${type}, limit=${limit}, offset=${offset}`);

    switch (type) {
      case 'teams':
        // Get top teams by win rate and total battles
        const topTeams = await withDatabase(async (db) => {
          const teams = await db.Team.findMany({
            where: {
              isActive: true,
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
              { battlesWon: 'desc' },
              { battlesLost: 'asc' }
            ],
            take: parseInt(limit),
            skip: parseInt(offset)
          });

          // Calculate win rate and total battles for each team
          return teams.map(team => {
            const totalBattles = team.battlesWon + team.battlesLost;
            const winRate = totalBattles > 0 ? (team.battlesWon / totalBattles * 100).toFixed(1) : 0;
            
            return {
              id: team.id,
              name: team.name,
              ownerAddress: team.User.address,
              battlesWon: team.battlesWon,
              battlesLost: team.battlesLost,
              totalBattles,
              winRate: parseFloat(winRate),
              createdAt: team.createdAt,
              updatedAt: team.updatedAt
            };
          }).sort((a, b) => {
            // Sort by win rate first, then by total battles won
            if (b.winRate !== a.winRate) {
              return b.winRate - a.winRate;
            }
            return b.battlesWon - a.battlesWon;
          });
        });

        console.log(`✅ Found ${topTeams.length} teams for leaderboard`);
        return res.status(200).json({
          type: 'teams',
          teams: topTeams,
          total: topTeams.length,
          limit: parseInt(limit),
          offset: parseInt(offset)
        });

      case 'users':
        // Get top users by total team wins
        const topUsers = await withDatabase(async (db) => {
          const users = await db.User.findMany({
            where: {
              teams: {
                some: {
                  OR: [
                    { battlesWon: { gt: 0 } },
                    { battlesLost: { gt: 0 } }
                  ]
                }
              }
            },
            include: {
              teams: {
                where: {
                  OR: [
                    { battlesWon: { gt: 0 } },
                    { battlesLost: { gt: 0 } }
                  ]
                }
              }
            }
          });

          // Calculate user stats
          const userStats = users.map(user => {
            const totalBattlesWon = user.teams.reduce((sum, team) => sum + team.battlesWon, 0);
            const totalBattlesLost = user.teams.reduce((sum, team) => sum + team.battlesLost, 0);
            const totalBattles = totalBattlesWon + totalBattlesLost;
            const winRate = totalBattles > 0 ? (totalBattlesWon / totalBattles * 100).toFixed(1) : 0;
            const activeTeams = user.teams.filter(team => team.isActive).length;

            return {
              address: user.address,
              totalBattlesWon,
              totalBattlesLost,
              totalBattles,
              winRate: parseFloat(winRate),
              activeTeams,
              totalTeams: user.teams.length,
              lastUpdated: user.updatedAt
            };
          }).sort((a, b) => {
            // Sort by total wins first, then by win rate
            if (b.totalBattlesWon !== a.totalBattlesWon) {
              return b.totalBattlesWon - a.totalBattlesWon;
            }
            return b.winRate - a.winRate;
          }).slice(parseInt(offset), parseInt(offset) + parseInt(limit));

          console.log(`✅ Found ${userStats.length} users for leaderboard`);
          return res.status(200).json({
            type: 'users',
            users: userStats,
            total: userStats.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
          });
        });

      default:
        return res.status(400).json({ error: 'Invalid leaderboard type. Use: teams, users' });
    }

  } catch (error) {
    console.error('❌ Leaderboard API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch leaderboard',
      message: error.message 
    });
  }
}

