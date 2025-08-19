import { PrismaClient } from '@prisma/client';
import { getSession } from 'next-auth/react';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  const session = await getSession({ req });
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { address } = session.user;

  switch (req.method) {
    case 'GET':
      try {
        const user = await prisma.user.findUnique({
          where: { address },
          include: {
            teams: true
          }
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json(user.teams);
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
        const user = await prisma.User.findUnique({
          where: { address },
          include: { NFT: true }
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        const userNftIds = user.NFT.map(nft => nft.id);
        const invalidNfts = nftIds.filter(id => !userNftIds.includes(id));

        if (invalidNfts.length > 0) {
          return res.status(400).json({ error: 'Some NFTs do not belong to the user' });
        }

        const team = await prisma.Team.create({
          data: {
            name,
            nftIds,
            ownerId: user.id
          }
        });

        return res.status(201).json(team);
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

        // Verify that all NFTs belong to the user
        const user = await prisma.User.findUnique({
          where: { address },
          include: { NFT: true }
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        const userNftIds = user.NFT.map(nft => nft.id);
        const invalidNfts = nftIds.filter(id => !userNftIds.includes(id));

        if (invalidNfts.length > 0) {
          return res.status(400).json({ error: 'Some NFTs do not belong to the user' });
        }

        // Verify the team belongs to the user
        const existingTeam = await prisma.Team.findUnique({
          where: { id }
        });

        if (!existingTeam || existingTeam.ownerId !== user.id) {
          return res.status(404).json({ error: 'Team not found or does not belong to user' });
        }

        const updatedTeam = await prisma.Team.update({
          where: { id },
          data: {
            name,
            nftIds,
            updatedAt: new Date()
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
        const user = await prisma.User.findUnique({
          where: { address }
        });

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        const existingTeam = await prisma.Team.findUnique({
          where: { id }
        });

        if (!existingTeam || existingTeam.ownerId !== user.id) {
          return res.status(404).json({ error: 'Team not found or does not belong to user' });
        }

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
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 
