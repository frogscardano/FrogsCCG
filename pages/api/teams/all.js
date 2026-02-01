import { prisma, withDatabase } from '../../../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { excludeAddress, limit = 100, offset = 0 } = req.query;

    console.log(`🔍 Fetching all teams for battle matching, excluding: ${excludeAddress}`);

    const allTeams = await withDatabase(async (db) => {
      const teams = await db.Team.findMany({
        where: {
          isActive: true,
          // Only exclude teams by address if explicitly requested
          ...(excludeAddress && excludeAddress !== 'undefined' && {
            User: {
              address: {
                not: excludeAddress
              }
            }
          })
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
          { createdAt: 'desc' }
        ],
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      // Parse nftIds if stored as JSON string
      const parseIds = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return value.includes(',') ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
          }
        }
        return [];
      };

      // Fetch cards for each team
      return Promise.all(teams.map(async (team) => {
        const ids = parseIds(team.nftIds);
        let cards = [];
        
        if (ids.length > 0) {
          try {
            cards = await db.NFT.findMany({ 
              where: { id: { in: ids } }
            });
          } catch (error) {
            console.error(`Error loading cards for team ${team.id}:`, error);
          }
        }

        const totalBattles = team.battlesWon + team.battlesLost;
        const winRate = totalBattles > 0 
          ? (team.battlesWon / totalBattles * 100).toFixed(1)
          : 0;

        return {
          id: team.id,
          name: team.name,
          ownerAddress: team.User.address,
          battlesWon: team.battlesWon,
          battlesLost: team.battlesLost,
          totalBattles,
          winRate: parseFloat(winRate),
          eloRating: team.eloRating || 1000,
          cards: cards,
          nftIds: ids,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt
        };
      }));
    });

    console.log(`✅ Found ${allTeams.length} teams for battle matching`);
    
    return res.status(200).json({
      success: true,
      teams: allTeams,
      total: allTeams.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('❌ All teams API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch teams',
      message: error.message 
    });
  }
}
