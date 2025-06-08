import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = new PrismaClient());

// Database operation wrapper with retry logic
export async function withDatabase(operation) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await operation(prisma);
    } catch (error) {
      retries++;
      
      // Check if it's a connection error that might be retryable
      if (error.code === 'P2024' || error.message.includes('prepared statement') || error.message.includes('already exists')) {
        console.warn(`Database operation failed (attempt ${retries}/${maxRetries}):`, error.message);
        
        if (retries < maxRetries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          
          // Try to disconnect and reconnect
          try {
            await prisma.$disconnect();
          } catch (disconnectError) {
            console.warn('Error during disconnect:', disconnectError.message);
          }
          
          continue;
        }
      }
      
      // If it's not a retryable error or we've exceeded max retries, throw the error
      throw error;
    }
  }
}

// User related functions
export async function getWalletByAddress(address) {
  if (!address) throw new Error('Address is required');

  return prisma.User.findUnique({
    where: { address },
    include: {
      NFT: true
    }
  });
}

export async function createOrUpdateWallet(address, data = {}) {
  if (!address) throw new Error('Address is required');

  return prisma.User.upsert({
    where: { address },
    update: {
      ...data,
      updatedAt: new Date()
    },
    create: {
      address,
      ...data
    }
  });
}

// NFT related functions
export async function getCards(filter = {}) {
  return prisma.NFT.findMany({
    where: filter,
    include: {
      User: true
    }
  });
}

export async function getCardById(cardId) {
  if (!cardId) throw new Error('Card ID is required');

  return prisma.NFT.findUnique({
    where: { id: cardId },
    include: {
      User: true
    }
  });
}

// User NFT collection functions
export async function getUserCards(address) {
  if (!address) throw new Error('User address is required');

  try {
    console.log(`Fetching NFTs for user: ${address}`);

    const user = await prisma.User.findUnique({
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

export async function addCardToUserCollection(address, tokenId, contractAddress, metadata = null) {
  if (!address || !tokenId || !contractAddress) {
    throw new Error('Address, token ID, and contract address are required');
  }

  try {
    // First ensure user exists and get their ID
    const user = await prisma.User.upsert({
      where: { address },
      update: {},
      create: { address }
    });

    // Then handle the NFT
    return prisma.NFT.upsert({
      where: {
        tokenId_contractAddress: {
          tokenId,
          contractAddress
        }
      },
      update: {
        ownerId: User.id,
        updatedAt: new Date()
      },
      create: {
        tokenId,
        contractAddress,
        ownerId: User.id,
        metadata,
        name: metadata?.name,
        rarity: metadata?.rarity,
        imageUrl: metadata?.image,
        description: metadata?.description,
        attack: metadata?.attack,
        health: metadata?.health,
        speed: metadata?.speed,
        special: metadata?.special
      }
    });
  } catch (error) {
    console.error(`Error adding NFT to user collection:`, error);
    throw error;
  }
}

export async function ensureUserExists(address) {
  if (!address) throw new Error('Address is required');

  return prisma.User.upsert({
    where: { address },
    update: {},
    create: { address }
  });
}

export async function getUserByAddress(address) {
  return getWalletByAddress(address);
}
