import { prisma } from '../../../utils/db.js';
import { authenticateUser, getUserFromRequest, verifyOwnership } from '../../../utils/auth.js';

export default async function handler(req, res) {
  // Authenticate user first
  try {
    await authenticateUser(req, res, async () => {
      const user = getUserFromRequest(req);
      
      switch (req.method) {
        case 'GET':
          try {
            // Get all teams for the authenticated user
            const teams = await prisma.Team.findMany({
              where: { ownerId: user.id },
              include: {
                NFTs: {
                  include: {
                    attributes: true
                  }
                }
              },
              orderBy: { updatedAt: 'desc' }
            });

            return res.status(200).json(teams);
          } catch (error) {
            console.error('Error fetching teams:', error);
            return res.status(500).json({ error: 'Failed to fetch teams' });
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

            // Create the team
            const team = await prisma.Team.create({
              data: {
                name,
                ownerId: user.id,
                isActive: true,
                battlesWon: 0,
                battlesLost: 0,
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });

            // Connect NFTs to the team
            await prisma.Team.update({
              where: { id: team.id },
              data: {
                NFTs: {
                  connect: nftIds.map(id => ({ id }))
                }
              }
            });

            // Return the created team with NFTs
            const createdTeam = await prisma.Team.findUnique({
              where: { id: team.id },
              include: {
                NFTs: {
                  include: {
                    attributes: true
                  }
                }
              }
            });

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

            // Update the team
            const updatedTeam = await prisma.Team.update({
              where: { id },
              data: {
                name,
                updatedAt: new Date(),
                NFTs: {
                  set: nftIds.map(id => ({ id }))
                }
              },
              include: {
                NFTs: {
                  include: {
                    attributes: true
                  }
                }
              }
            });

            return res.status(200).json(updatedTeam);
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
