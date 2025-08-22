import { prisma } from '../../../utils/db.js';
import { authenticateUser, getUserFromRequest, verifyOwnership } from '../../../utils/auth.js';

export default async function handler(req, res) {
  console.log('🔍 Teams API handler called');
  console.log('🔍 Request method:', req.method);
  console.log('🔍 Request query:', req.query);
  
  // Test database connection first
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
  } catch (dbError) {
    console.error('❌ Database connection failed:', dbError);
    return res.status(500).json({ 
      error: 'Database connection failed', 
      details: dbError.message 
    });
  }
  
  // Authenticate user first
  try {
    await authenticateUser(req, res, async () => {
      const user = getUserFromRequest(req);
      
      console.log(`🔍 Teams API called for user: ${user.id} (${user.address})`);
      
      switch (req.method) {
        case 'GET':
          try {
            console.log(`🔍 Fetching teams for user ID: ${user.id}`);
            
            // Test if Team table exists
            try {
              const tableTest = await prisma.$queryRaw`SELECT 1 FROM "Team" LIMIT 1`;
              console.log('✅ Team table exists and is accessible');
            } catch (tableError) {
              console.error('❌ Team table test failed:', tableError);
              return res.status(500).json({ 
                error: 'Team table not accessible', 
                details: tableError.message 
              });
            }
            
            // Get all teams for the authenticated user
            const teams = await prisma.Team.findMany({
              where: { ownerId: user.id },
              orderBy: { updatedAt: 'desc' }
            });

            console.log(`✅ Found ${teams.length} teams for user ${user.id}`);

            // For each team, fetch the associated NFTs using the nftIds array
            const teamsWithNFTs = await Promise.all(
              teams.map(async (team) => {
                if (team.nftIds && team.nftIds.length > 0) {
                  const nfts = await prisma.NFT.findMany({
                    where: { 
                      id: { in: team.nftIds }
                    }
                  });
                  
                  console.log(`✅ Team ${team.name} has ${nfts.length} NFTs`);
                  
                  // Return team with cards (NFTs) in the expected format
                  return {
                    ...team,
                    cards: nfts
                  };
                } else {
                  console.log(`ℹ️ Team ${team.name} has no NFTs`);
                  // Return team with empty cards array
                  return {
                    ...team,
                    cards: []
                  };
                }
              })
            );

            console.log('✅ Returning teams:', teamsWithNFTs);
            return res.status(200).json(teamsWithNFTs);
          } catch (error) {
            console.error('❌ Error fetching teams:', error);
            return res.status(500).json({ error: 'Failed to fetch teams', details: error.message });
          }

        case 'POST':
          try {
            const { name, nftIds } = req.body;

            if (!name || !nftIds || !Array.isArray(nftIds)) {
              return res.status(400).json({ error: 'Invalid team data' });
            }

            // Verify that all NFTs belong to the user
            const userNfts = await prisma.NFT.findMany({
              where: { 
                id: { in: nftIds },
                ownerId: user.id
              }
            });

            if (userNfts.length !== nftIds.length) {
              throw new Error('Some NFTs do not belong to the user');
            }

            // Create the team with nftIds array
            const team = await prisma.Team.create({
              data: {
                name,
                ownerId: user.id,
                nftIds: nftIds,
                isActive: true,
                battlesWon: 0,
                battlesLost: 0,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });

            // Return the created team with NFTs in the expected format
            return res.status(201).json({
              ...team,
              cards: userNfts
            });
          } catch (error) {
            console.error('❌ Error creating team:', error);
            if (error.message === 'Some NFTs do not belong to the user') {
              return res.status(400).json({ error: error.message });
            }
            return res.status(500).json({ error: 'Failed to create team', details: error.message });
          }

        case 'PUT':
          try {
            const { id, name, nftIds } = req.body;

            if (!id || !name || !nftIds || !Array.isArray(nftIds)) {
              return res.status(400).json({ error: 'Invalid team data' });
            }

            // Verify the team belongs to the user
            const isOwner = await verifyOwnership(req, id, 'team');
            if (!isOwner) {
              throw new Error('Team not found or does not belong to user');
            }

            // Verify that all NFTs belong to the user
            const userNfts = await prisma.NFT.findMany({
              where: { 
                id: { in: nftIds },
                ownerId: user.id
              }
            });

            if (userNfts.length !== nftIds.length) {
              throw new Error('Some NFTs do not belong to the user');
            }

            // Update the team with nftIds array
            const updatedTeam = await prisma.Team.update({
              where: { id },
              data: {
                name,
                nftIds: nftIds,
                updatedAt: new Date()
              }
            });

            // Return the updated team with NFTs in the expected format
            return res.status(200).json({
              ...updatedTeam,
              cards: userNfts
            });
          } catch (error) {
            console.error('❌ Error updating team:', error);
            if (error.message === 'Team not found or does not belong to user') {
              return res.status(403).json({ error: error.message });
            }
            if (error.message === 'Some NFTs do not belong to the user') {
              return res.status(400).json({ error: error.message });
            }
            return res.status(500).json({ error: 'Failed to update team', details: error.message });
          }

        case 'DELETE':
          try {
            const { id } = req.body;

            if (!id) {
              return res.status(400).json({ error: 'Team ID is required' });
            }

            // Verify the team belongs to the user
            const isOwner = await verifyOwnership(req, id, 'team');
            if (!isOwner) {
              throw new Error('Team not found or does not belong to user');
            }

            // Delete the team
            await prisma.Team.delete({
              where: { id }
            });

            return res.status(200).json({ message: 'Team deleted successfully' });
          } catch (error) {
            console.error('❌ Error deleting team:', error);
            if (error.message === 'Team not found or does not belong to user') {
              return res.status(403).json({ error: error.message });
            }
            return res.status(500).json({ error: 'Failed to delete team', details: error.message });
          }

        default:
          res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
          return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
      }
    });
  } catch (error) {
    console.error('Teams API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
} 
