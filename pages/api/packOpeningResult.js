// api/packOpeningResult.js
// API route for retrieving pack opening results

import { prisma } from '../../utils/db.js';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Extract pack opening ID from query parameters
  const { packOpeningId } = req.query;

  // Validate required parameters
  if (!packOpeningId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameter: packOpeningId is required' 
    });
  }

  try {
    // Fetch the pack opening record with related data
    const packOpening = await prisma.packOpening.findUnique({
      where: { id: packOpeningId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            walletAddress: true
          }
        },
        pack: true
      }
    });

    if (!packOpening) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pack opening not found' 
      });
    }

    // Fetch NFTs associated with this pack opening
    const nfts = await prisma.NFT.findMany({
      where: { packOpeningId: packOpeningId },
      orderBy: {
        // Order by rarity (will need to map string rarities to numeric values in a real app)
        // For now, ordering by name as a simple example
        name: 'asc'
      }
    });

    // Return the pack opening details and NFTs
    return res.status(200).json({
      success: true,
      packOpening: {
        id: packOpening.id,
        userId: packOpening.userId,
        user: packOpening.user,
        packId: packOpening.packId,
        pack: packOpening.pack,
        walletAddress: packOpening.walletAddress,
        txHash: packOpening.txHash,
        openedAt: packOpening.openedAt
      },
      nfts: nfts
    });
  } catch (error) {
    console.error('Error retrieving pack opening results:', error);
    return res.status(500).json({
      success: false,
      message: `Error retrieving pack opening results: ${error.message || 'Unknown error'}`
    });
  } finally {
    // Clean up Prisma connection
    await prisma.$disconnect();
  }
} 
