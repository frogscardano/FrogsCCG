import { prisma } from '../../utils/db';

// Avoid multiple instances of Prisma Client in development
const globalForPrisma = global;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// User related functions (replacing wallet functions)
export async function getWalletByAddress(address) {
  if (!address) throw new Error('Address is required');

  return prisma.user.findUnique({
    where: { address },
    include: {
      NFT: true
    }
  });
}

export async function createOrUpdateWallet(address, data = {}) {
  if (!address) throw new Error('Address is required');

  // First check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { address }
  });

  if (existingUser) {
    // Update existing user
    return prisma.user.update({
      where: { address },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new user
    return prisma.user.create({
      data: {
        address,
        ...data
      }
    });
  }
}

// NFT related functions (replacing card functions)
export async function getCards(filter = {}) {
  return prisma.nFT.findMany({
    where: filter
  });
}

export async function getCardById(cardId) {
  if (!cardId) throw new Error('Card ID is required');

  return prisma.nFT.findUnique({
    where: { id: cardId }
  });
}

// User NFT collection functions (replacing user card functions)
export async function getUserCards(address) {
  if (!address) throw new Error('User address is required');

  try {
    console.log(`Fetching NFTs for user: ${address}`);

    // Get user and their NFTs
    const user = await prisma.user.findUnique({
      where: { address },
      include: {
        NFT: true
      }
    });

    if (!user) {
      console.log(`No user found for address ${address}`);
      return [];
    }

    console.log(`Found ${user.NFT.length} NFTs for user ${address}`);
    return user.NFT;
  } catch (error) {
    console.error(`Error fetching NFTs for user ${address}:`, error);
    return [];
  }
}

export async function getWalletCards(address) {
  // Alias for getUserCards to maintain backward compatibility
  return getUserCards(address);
}

export async function addCardToUserCollection(userId, tokenId, contractAddress, metadata = null, txHash = null) {
  if (!userId || !tokenId || !contractAddress) {
    throw new Error('User ID, token ID, and contract address are required');
  }

  try {
    // Check if NFT already exists
    const existingNFT = await prisma.nFT.findUnique({
      where: {
        tokenId_contractAddress: {
          tokenId,
          contractAddress
        }
      }
    });

    if (existingNFT) {
      // Update existing NFT owner if different
      if (existingNFT.ownerId !== userId) {
        return prisma.nFT.update({
          where: { id: existingNFT.id },
          data: {
            ownerId: userId,
            updatedAt: new Date()
          }
        });
      }
      return existingNFT;
    } else {
      // Create new NFT
      return prisma.nFT.create({
        data: {
          tokenId,
          contractAddress,
          ownerId: userId,
          metadata,
          // Generate a unique ID
          id: `${contractAddress}_${tokenId}_${Date.now()}`
        }
      });
    }
  } catch (error) {
    console.error(`Error adding NFT to user collection:`, error);
    throw error;
  }
}

// Utility function to create user if not exists
export async function ensureUserExists(address) {
  if (!address) throw new Error('Address is required');

  let user = await prisma.user.findUnique({
    where: { address }
  });

  if (!user) {
    user = await prisma.user.create({
      data: { address }
    });
  }

  return user;
}

// Function to get user by address (alias for getWalletByAddress)
export async function getUserByAddress(address) {
  return getWalletByAddress(address);
} 
