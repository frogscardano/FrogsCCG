import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    errorFormat: 'pretty',
  }));

// Database operation wrapper with retry logic and better connection management
export async function withDatabase(operation) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await operation(prisma);
    } catch (error) {
      retries++;
      
      // Check if it's a connection error that might be retryable
      if (error.code === 'P2024' || 
          error.message.includes('prepared statement') || 
          error.message.includes('already exists') ||
          error.message.includes('there is no unique or exclusion constraint') ||
          error.message.includes('connection')) {
        console.warn(`Database operation failed (attempt ${retries}/${maxRetries}):`, error.message);
        
        if (retries < maxRetries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          
          // Try to disconnect and reconnect
          try {
            console.log(`🔄 Attempting to reconnect to database (attempt ${retries})...`);
            await prisma.$disconnect();
            
            // Force a new connection
            globalForPrisma.prisma = new PrismaClient({
              log: ['query', 'info', 'warn', 'error'],
              errorFormat: 'pretty',
            });
            globalForPrisma.prisma = globalForPrisma.prisma;
            
            console.log(`✅ Database reconnection successful`);
          } catch (disconnectError) {
            console.warn('⚠️ Error during disconnect/reconnect:', disconnectError.message);
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

  try {
    // First try to find existing user
    const existingUser = await prisma.User.findUnique({
      where: { address }
    });

    if (existingUser) {
      // Update existing user
      return await prisma.User.update({
        where: { address },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new user
      return await prisma.User.create({
        data: {
          address,
          ...data
        }
      });
    }
  } catch (error) {
    console.error('Error in createOrUpdateWallet:', error);
    throw error;
  }
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
    const user = await ensureUserExists(address);

    // Then handle the NFT
    // First try to find existing NFT
    const existingNFT = await prisma.NFT.findFirst({
      where: {
        tokenId,
        contractAddress
      }
    });

    if (existingNFT) {
      // Update existing NFT
      return await prisma.NFT.update({
        where: { id: existingNFT.id },
        data: {
          ownerId: user.id,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new NFT
      return await prisma.NFT.create({
        data: {
          tokenId,
          contractAddress,
          ownerId: user.id,
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
    }
  } catch (error) {
    console.error(`Error adding NFT to user collection:`, error);
    throw error;
  }
}

export async function ensureUserExists(address) {
  if (!address) throw new Error('Address is required');

  try {
    // First try to find existing user
    const existingUser = await prisma.User.findUnique({
      where: { address }
    });

    if (existingUser) {
      return existingUser;
    } else {
      // Create new user
      return await prisma.User.create({
        data: { address }
      });
    }
  } catch (error) {
    console.error('Error in ensureUserExists:', error);
    throw error;
  }
}

export async function getUserByAddress(address) {
  return getWalletByAddress(address);
}
