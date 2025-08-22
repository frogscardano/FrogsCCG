import { prisma } from '../../../utils/db.js';
import { authenticateUser, getUserFromRequest, verifyOwnership } from '../../../utils/auth.js';

export default async function handler(req, res) {
  // Authenticate user first
  try {
    await authenticateUser(req, res, async () => {
      const user = getUserFromRequest(req);
      
      console.log(`🔍 Teams API called for user: ${user.id} (${user.address})`);
      
      switch (req.method) {
        case 'GET':
          try {
            console.log(`🔍 Fetching teams for user ID: ${user.id}`);
            
            // Check if the Team table exists by trying to query it
            try {
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
                      },
                      include: {
                        attributes: true
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

              return res.status(200).json(teamsWithNFTs);
            } catch (tableError) {
              console.error('❌ Error accessing Team table:', tableError);
              
              // Check if this is a table doesn't exist error
              if (tableError.message && tableError.message.includes('does not exist')) {
                console.error('❌ Team table does not exist in database');
                return res.status(500).json({ 
                  error: 'Teams functionality not available',
                  message: 'The teams table has not been created in the database. Please run database migrations.',
                  details: tableError.message
                });
              }
              
              throw tableError;
            }
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
              return res.status(400).json({ error: 'Some NFTs do not belong to the user' });
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
            const createdTeam = {
              ...team,
              cards: userNfts
            };

            return res.status(201).json(createdTeam);
          } catch (error) {
            console.error('Error creating team:', error);
            return res.status(500).json({ error: 'Failed to create team' });
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
              return res.status(403).json({ error: 'Team not found or does not belong to user' });
            }

            // Verify that all NFTs belong to the user
            const userNfts = await prisma.NFT.findMany({
              where: { 
                id: { in: nftIds },
                ownerId: user.id
              }
            });

            if (userNfts.length !== nftIds.length) {
              return res.status(400).json({ error: 'Some NFTs do not belong to the user' });
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
            const teamWithNFTs = {
              ...updatedTeam,
              cards: userNfts
            };

            return res.status(200).json(teamWithNFTs);
          } catch (error) {
            console.error('Error updating team:', error);
            return res.status(500).json({ error: 'Failed to update team' });
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
              return res.status(403).json({ error: 'Team not found or does not belong to user' });
            }

            // Delete the team
            await prisma.Team.delete({
              where: { id }
            });

            return res.status(200).json({ message: 'Team deleted successfully' });
          } catch (error) {
            console.error('Error deleting team:', error);
            return res.status(500).json({ error: 'Failed to delete team' });
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
