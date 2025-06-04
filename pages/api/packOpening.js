// api/packOpening.js
// API route for handling pack opening logic

import { PrismaClient } from '@prisma/client';
import { 
  initializeBlockfrostBackend, 
  validateTransaction, 
  recordPackOpening 
} from './cardanoTransactions';

// Pack opening handler
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get environment variables
  const blockfrostProjectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!blockfrostProjectId) {
    console.error('BLOCKFROST_PROJECT_ID not set in environment variables');
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  // Extract data from request
  const { 
    userId, 
    walletAddress, 
    txHash, 
    packId 
  } = req.body;

  // Validate required parameters
  if (!userId || !walletAddress || !txHash || !packId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameters: userId, walletAddress, txHash, and packId are required' 
    });
  }

  try {
    // Initialize Blockfrost backend service
    const isTestnet = process.env.NODE_ENV !== 'production';
    const backendService = initializeBlockfrostBackend(blockfrostProjectId, isTestnet);

    // Validate the transaction
    const validation = await validateTransaction(backendService, txHash);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid transaction: ${validation.reason}` 
      });
    }

    // Check if this transaction has already been used
    const existingOpening = await prisma.packOpening.findFirst({
      where: { txHash }
    });

    if (existingOpening) {
      return res.status(400).json({ 
        success: false, 
        message: 'This transaction has already been used to open a pack' 
      });
    }

    // Check if the pack exists
    const pack = await prisma.pack.findUnique({
      where: { id: packId }
    });

    if (!pack) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pack not found' 
      });
    }

    // Determine NFTs to include in the pack based on rarity weights
    // This is a simplified example - you would have more complex logic
    // to determine which NFTs to include based on rarity, availability, etc.
    const availableNFTs = await prisma.nFT.findMany({
      where: {
        packId: null, // Only NFTs not yet assigned to a pack
        // You might have additional filters here
      },
      take: pack.nftCount // Limit to the number of NFTs in the pack
    });

    if (availableNFTs.length < pack.nftCount) {
      return res.status(400).json({
        success: false,
        message: `Not enough available NFTs to open this pack. Need ${pack.nftCount}, found ${availableNFTs.length}`
      });
    }

    // Record the pack opening
    const recordResult = await recordPackOpening(
      prisma,
      userId,
      walletAddress,
      txHash,
      packId,
      availableNFTs
    );

    if (!recordResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to record pack opening: ${recordResult.error}`
      });
    }

    // Update NFTs to assign them to the user
    await prisma.nFT.updateMany({
      where: {
        id: {
          in: availableNFTs.map(nft => nft.id)
        }
      },
      data: {
        ownerId: userId,
        packOpeningId: recordResult.packOpening.id
      }
    });

    // Return the opened NFTs
    return res.status(200).json({
      success: true,
      message: 'Pack opened successfully',
      packOpening: recordResult.packOpening,
      nfts: availableNFTs
    });
  } catch (error) {
    console.error('Error opening pack:', error);
    return res.status(500).json({
      success: false,
      message: `Error opening pack: ${error.message || 'Unknown error'}`
    });
  } finally {
    // Clean up Prisma connection
    await prisma.$disconnect();
  }
} 
