import { prisma } from '../../../utils/db.js';
import { v4 as uuid4 } from 'uuid';

// Helper function to generate team ID
const generateTeamId = (name, ownerId) => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `team_${timestamp}_${randomStr}`;
};

// Simple database connection test
async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}

// Function to validate team data
function validateTeamData(teamData) {
  if (!teamData.name || !teamData.nftIds || !Array.isArray(teamData.nftIds)) {
    return {
      isValid: false,
      error: 'Team must have a name and an array of NFT IDs'
    };
  }

  if (teamData.name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Team name cannot be empty'
    };
  }

  if (teamData.nftIds.length === 0) {
    return {
      isValid: false,
      error: 'Team must have at least one NFT'
    };
  }

  if (teamData.nftIds.length > 5) {
    return {
      isValid: false,
      error: 'Team cannot have more than 5 NFTs'
    };
  }

  return { isValid: true };
}

export default async function handler(req, res) {
  const { address } = req.query;
  
  console.log(`🔍 Teams API called with address: ${address}, method: ${req.method}`);
  
  // Add CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Test database connection by trying to access the user model
  try {
    if (!prisma || !prisma.user) {
      throw new Error('Prisma client or user model not available');
    }
  } catch (connectionError) {
    console.error('❌ Database connection test failed:', connectionError);
    return res.status(503).json({ 
      error: 'Database connection failed', 
      message: 'Unable to connect to database. Please try again later.',
      retryAfter: 10
    });
  }
  
  // Accept both bech32 and hex addresses; minimal sanity check only
  const cleanAddress = (address || '').trim();
  if (!cleanAddress) {
    console.log('❌ No address provided');
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  if (!prisma) {
    console.error('❌ Prisma client is completely undefined');
    return res.status(503).json({ 
      error: 'Database temporarily unavailable',
      message: 'Database connection is not available. Teams will be stored locally.',
      fallback: true
    });
  }
  
  if (!prisma.user) {
    console.error('❌ Prisma.user is undefined');
    console.log('Available Prisma methods:', prisma ? Object.keys(prisma).filter(key => !key.startsWith('$')) : 'null');
    return res.status(503).json({ 
      error: 'Database models not available',
      message: 'Database models are not properly initialized. Teams will be stored locally.',
      fallback: true
    });
  }

  // proceed; address may be reward/bech32 or CIP-30 hex

  try {
    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      console.log('🔄 Database connection issue detected, returning service unavailable');
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        message: 'Database connection issue detected. Please try again in a moment.',
        retryAfter: 5
      });
    }

    console.log(`🔄 Attempting to upsert user with address: ${cleanAddress}`);
    
    // Simple user upsert like in the working examples
    let user = await prisma.user.findUnique({ where: { address: cleanAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { id: uuid4(), address: cleanAddress } });
    }
    
    console.log(`✅ User found/created: ${user.id} for address: ${user.address}`);

    switch (req.method) {
      case 'GET':
        try {
          console.log(`🔍 Fetching teams for user ID: ${user.id}`);
          
          // Simple query to get teams
          const userTeams = await prisma.team.findMany({
            where: { ownerId: user.id },
            orderBy: { updatedAt: 'desc' }
          });
          
          console.log(`📊 Found ${userTeams.length} teams for user ID: ${user.id}`);
          
          // For each team, fetch the associated NFTs
          const teamsWithNFTs = await Promise.all(
            userTeams.map(async (team) => {
              if (team.nftIds && team.nftIds.length > 0) {
                const nfts = await prisma.nFT.findMany({
                  where: { 
                    id: { in: team.nftIds }
                  }
                });
                
                return {
                  ...team,
                  cards: nfts
                };
              } else {
                return {
                  ...team,
                  cards: []
                };
              }
            })
          );
          
          return res.status(200).json({
            teams: teamsWithNFTs,
            userInfo: {
              id: user.id,
              address: user.address,
              hasTeams: teamsWithNFTs.length > 0
            },
            message: teamsWithNFTs.length > 0 
              ? `Found ${teamsWithNFTs.length} teams` 
              : "You have no teams yet. Create your first team to get started!"
          });
        } catch (error) {
          console.error('❌ Error fetching teams:', error);
          return res.status(500).json({ error: 'Failed to fetch teams', details: error.message });
        }

      case 'POST':
        try {
          let newTeamsData = req.body;
          console.log(`📥 Received POST data for ${newTeamsData?.length || 0} teams`);
          
          if (!Array.isArray(newTeamsData)) {
            newTeamsData = [newTeamsData];
          }
          
          if (newTeamsData.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty team data' });
          }

          // Validate the data structure
          for (const teamData of newTeamsData) {
            const validation = validateTeamData(teamData);
            if (!validation.isValid) {
              return res.status(400).json({ 
                error: 'Invalid team data structure', 
                details: validation.error
              });
            }
          }

          const savedTeams = [];

          for (const newTeamData of newTeamsData) {
            try {
              // Validate that all NFTs belong to the user
              const userNfts = await prisma.nFT.findMany({
                where: { 
                  id: { in: newTeamData.nftIds },
                  ownerId: user.id
                }
              });

              if (userNfts.length !== newTeamData.nftIds.length) {
                throw new Error('Some NFTs do not belong to the user');
              }

              // Check if team with same name already exists for this user
              const existingTeam = await prisma.team.findFirst({
                where: {
                  name: newTeamData.name,
                  ownerId: user.id
                }
              });

              let teamRecord;
              if (existingTeam) {
                // Update existing team
                teamRecord = await prisma.team.update({
                  where: { id: existingTeam.id },
                  data: { 
                    nftIds: newTeamData.nftIds,
                    isActive: newTeamData.isActive !== false,
                    battlesWon: newTeamData.battlesWon || 0,
                    battlesLost: newTeamData.battlesLost || 0,
                    updatedAt: new Date() 
                  }
                });
              } else {
                // Create new team
                teamRecord = await prisma.team.create({
                  data: {
                    id: generateTeamId(newTeamData.name, user.id),
                    name: newTeamData.name,
                    ownerId: user.id,
                    nftIds: newTeamData.nftIds,
                    isActive: newTeamData.isActive !== false,
                    battlesWon: newTeamData.battlesWon || 0,
                    battlesLost: newTeamData.battlesLost || 0
                  }
                });
              }
              
              const teamWithNFTs = {
                ...teamRecord,
                cards: userNfts
              };
              
              savedTeams.push(teamWithNFTs);
            } catch (teamError) {
              console.error(`❌ Failed to process team:`, teamError);
              continue;
            }
          }
          
          return res.status(200).json(savedTeams);
        } catch (error) {
          console.error('❌ Error adding teams:', error);
          return res.status(500).json({ error: `Failed to add teams: ${error.message}` });
        }

      case 'PUT':
        try {
          const { id, name, nftIds } = req.body;
          
          if (!id || !name || !nftIds || !Array.isArray(nftIds)) {
            return res.status(400).json({ error: 'Invalid team data' });
          }

          const updatedTeam = await prisma.team.findFirst({
            where: {
              id: id,
              ownerId: user.id
            }
          });

          if (!updatedTeam) {
            return res.status(403).json({ error: 'Team not found or does not belong to user' });
          }

          // Verify that all NFTs belong to the user
          const userNfts = await prisma.nFT.findMany({
            where: { 
              id: { in: nftIds },
              ownerId: user.id
            }
          });

          if (userNfts.length !== nftIds.length) {
            return res.status(400).json({ error: 'Some NFTs do not belong to the user' });
          }

          // Update the team
          const updated = await prisma.team.update({
            where: { id: id },
            data: {
              name: name,
              nftIds: nftIds,
              updatedAt: new Date()
            }
          });

          return res.status(200).json({
            ...updated,
            cards: userNfts
          });
        } catch (error) {
          console.error('❌ Error updating team:', error);
          return res.status(500).json({ error: 'Failed to update team', details: error.message });
        }

      case 'DELETE':
        try {
          const { id } = req.body;
          
          if (!id) {
            return res.status(400).json({ error: 'Team ID is required' });
          }

          const team = await prisma.team.findFirst({
            where: {
              id: id,
              ownerId: user.id
            }
          });

          if (!team) {
            return res.status(403).json({ error: 'Team not found or does not belong to user' });
          }

          await prisma.team.delete({
            where: { id: id }
          });

          return res.status(200).json({ message: 'Team deleted successfully' });
        } catch (error) {
          console.error('❌ Error deleting team:', error);
          return res.status(500).json({ error: 'Failed to delete team', details: error.message });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (e) {
    console.error('❌ Error processing user or team data:', e);
    return res.status(500).json({ error: `Failed to process request: ${e.message}` });
  }
}
