import { prisma, withDatabase } from '../../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { address, teamId, limit = 50, offset = 0 } = req.query;

    console.log(`📜 Fetching battle history: address=${address}, teamId=${teamId}, limit=${limit}`);

    // This is a placeholder implementation since we don't have a BattleHistory table yet
    // In a real implementation, you would:
    // 1. Create a BattleHistory table in your schema
    // 2. Record each battle in the table when it occurs
    // 3. Query that table here

    // For now, we'll return team statistics which gives a summary
    if (address) {
      const teams = await withDatabase(async (db) => {
        return await db.Team.findMany({
          where: {
            User: {
              address: address
            }
          },
          include: {
            User: {
              select: {
                address: true
              }
            }
          },
          orderBy: {
            updatedAt: 'desc'
          }
        });
      });

      // Format as battle summary
      const battleSummary = teams.map(team => ({
        teamId: team.id,
        teamName: team.name,
        wins: team.battlesWon || 0,
        losses: team.battlesLost || 0,
        totalBattles: (team.battlesWon || 0) + (team.battlesLost || 0),
        winRate: (team.battlesWon || 0) + (team.battlesLost || 0) > 0 
          ? ((team.battlesWon || 0) / ((team.battlesWon || 0) + (team.battlesLost || 0)) * 100).toFixed(1)
          : 0,
        lastUpdated: team.updatedAt
      }));

      console.log(`✅ Found battle history for ${teams.length} teams`);
      return res.status(200).json({
        summary: battleSummary,
        message: 'Battle history coming soon! This shows your team statistics.',
        note: 'To enable detailed battle history, run the migration to add a BattleHistory table.'
      });
    }

    if (teamId) {
      const team = await withDatabase(async (db) => {
        return await db.Team.findUnique({
          where: { id: teamId },
          include: {
            User: {
              select: {
                address: true
              }
            }
          }
        });
      });

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      const teamStats = {
        teamId: team.id,
        teamName: team.name,
        owner: team.User.address,
        wins: team.battlesWon || 0,
        losses: team.battlesLost || 0,
        totalBattles: (team.battlesWon || 0) + (team.battlesLost || 0),
        winRate: (team.battlesWon || 0) + (team.battlesLost || 0) > 0 
          ? ((team.battlesWon || 0) / ((team.battlesWon || 0) + (team.battlesLost || 0)) * 100).toFixed(1)
          : 0,
        lastBattle: team.updatedAt
      };

      console.log(`✅ Found battle stats for team: ${team.name}`);
      return res.status(200).json({
        team: teamStats,
        message: 'Detailed battle history coming soon!',
        note: 'To enable detailed battle history, run the migration to add a BattleHistory table.'
      });
    }

    return res.status(400).json({ 
      error: 'Please provide either address or teamId parameter' 
    });

  } catch (error) {
    console.error('❌ Battle history API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch battle history',
      message: error.message 
    });
  }
}
