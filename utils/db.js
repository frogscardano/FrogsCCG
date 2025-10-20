import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export { globalForPrisma };

// Check if DATABASE_URL is available
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL environment variable is not set. Database operations will fail.');
}

// Enhanced Prisma client configuration for serverless environments
function createPrismaClient() {
  // CRITICAL FIX: Add pgbouncer=true and statement_cache_size=0 to prevent prepared statement errors
  const connectionUrl = DATABASE_URL?.includes('?') 
    ? `${DATABASE_URL}&pgbouncer=true&statement_cache_size=0`
    : `${DATABASE_URL}?pgbouncer=true&statement_cache_size=0`;

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    errorFormat: 'minimal',
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Fast, lightweight connection check
export async function ensureConnection() {
  // In serverless, Prisma auto-connects on first query
  // We don't need complex connection management
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Test database connection - only use for health checks
export async function testDatabaseConnection() {
  try {
    if (!DATABASE_URL) {
      return { 
        connected: false, 
        error: 'DATABASE_URL not set',
        message: 'Database connection string is not configured'
      };
    }

    const client = globalForPrisma.prisma || createPrismaClient();
    await client.$queryRaw`SELECT 1`;
    
    return { connected: true, message: 'Database connection successful' };
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return { 
      connected: false, 
      error: error.message,
      message: 'Failed to connect to database'
    };
  }
}

// CRITICAL: Simplified withDatabase wrapper with smart retry logic
export async function withDatabase(operation, maxRetries = 2) {
  let client = globalForPrisma.prisma;
  
  // If we don't have a client or hit a prepared statement error, create fresh one
  if (!client) {
    client = createPrismaClient();
    globalForPrisma.prisma = client;
  }
  
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation(client);
      return result;
    } catch (error) {
      lastError = error;
      
      // Check for prepared statement errors
      const isPreparedStatementError = 
        error.message?.includes('prepared statement') ||
        error.message?.includes('already exists') ||
        error.code === '42P05';
      
      // Only retry on specific connection errors
      const isConnectionError = 
        error.code === 'P1001' || // Can't reach database
        error.code === 'P1008' || // Timeout
        error.code === 'P1017' || // Server closed connection
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('connection');

      // Don't retry on business logic errors
      const isBusinessError = 
        error.code === 'P2002' || // Unique constraint
        error.code === 'P2025' || // Record not found
        error.message?.includes('balance');

      if (isBusinessError) {
        throw error;
      }

      // If prepared statement error, recreate client and retry
      if (isPreparedStatementError) {
        console.warn(`🔄 Prepared statement error, recreating client (attempt ${attempt + 1}/${maxRetries})`);
        try {
          await client.$disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        client = createPrismaClient();
        globalForPrisma.prisma = client;
        
        // Short delay before retry
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      if (isConnectionError && attempt < maxRetries - 1) {
        console.warn(`🔄 Retry attempt ${attempt + 1}/${maxRetries - 1} after connection error`);
        
        // Short exponential backoff: 100ms, 200ms
        const delay = 100 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

// Graceful shutdown - simplified
export async function disconnectDatabase() {
  try {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect();
    }
  } catch (error) {
    // Ignore disconnect errors in serverless
    console.warn('Warning during disconnect:', error.message);
  }
}

// Handle process termination gracefully
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    await disconnectDatabase();
  };
  
  process.on('beforeExit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// ============================================================================
// USER OPERATIONS - Optimized for speed
// ============================================================================

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

  return prisma.user.upsert({
    where: { address },
    update: {
      ...data,
      updatedAt: new Date()
    },
    create: {
      address,
      balance: '0',
      ...data
    }
  });
}

// CRITICAL: Fast user existence check with minimal data
export async function ensureUserExists(address) {
  if (!address) throw new Error('Address is required');

  return prisma.user.upsert({
    where: { address },
    update: {},
    create: { 
      address,
      balance: '0'
    },
    select: {
      id: true,
      address: true
    }
  });
}

export async function getUserByAddress(address) {
  return getWalletByAddress(address);
}

// ============================================================================
// PACK BALANCE OPERATIONS - Optimized for reliability
// ============================================================================

// Fast balance check without auto-creation - FIXED to use actual schema fields
export async function getUserBalance(address) {
  if (!address) throw new Error('Address is required');

  const user = await prisma.user.findUnique({
    where: { address },
    select: { 
      balance: true,
      updatedAt: true
    }
  });

  if (!user) {
    return {
      balance: 0,
      lastUpdated: null,
      exists: false
    };
  }

  const balance = typeof user.balance === 'string' 
    ? parseInt(user.balance, 10) || 0 
    : user.balance ?? 0;

  return {
    balance,
    lastUpdated: user.updatedAt,
    exists: true
  };
}

// Atomic pack consumption with proper transaction handling
export async function consumePack(address) {
  if (!address) throw new Error('Address is required');

  return prisma.$transaction(async (tx) => {
    // Lock the user row for update
    const user = await tx.user.findUnique({
      where: { address }
    });

    if (!user) {
      // Create user with 0 balance if doesn't exist
      await tx.user.create({
        data: { address, balance: '0' }
      });
      return { success: false, balance: 0, message: 'User created with 0 packs' };
    }

    const currentBalance = typeof user.balance === 'string' 
      ? parseInt(user.balance, 10) || 0 
      : user.balance ?? 0;

    if (currentBalance <= 0) {
      return { success: false, balance: 0, message: 'No packs available' };
    }

    // Decrement atomically
    const updatedUser = await tx.user.update({
      where: { address },
      data: { balance: String(currentBalance - 1) }
    });

    const newBalance = typeof updatedUser.balance === 'string'
      ? parseInt(updatedUser.balance, 10) || 0
      : updatedUser.balance ?? 0;

    return { 
      success: true, 
      balance: newBalance,
      message: 'Pack consumed successfully' 
    };
  }, {
    maxWait: 3000,
    timeout: 5000,
    isolationLevel: 'Serializable'
  });
}

// ============================================================================
// NFT OPERATIONS
// ============================================================================

export async function getCards(filter = {}) {
  return prisma.nFT.findMany({
    where: filter,
    include: {
      owner: true
    }
  });
}

export async function getCardById(cardId) {
  if (!cardId) throw new Error('Card ID is required');

  return prisma.nFT.findUnique({
    where: { id: cardId },
    include: {
      owner: true
    }
  });
}

export async function getUserCards(address) {
  if (!address) throw new Error('User address is required');

  const user = await prisma.user.findUnique({
    where: { address },
    select: {
      NFT: true
    }
  });

  return user?.NFT || [];
}

export async function addCardToUserCollection(address, tokenId, contractAddress, metadata = null) {
  if (!address || !tokenId || !contractAddress) {
    throw new Error('Address, token ID, and contract address are required');
  }

  // Ensure user exists first
  const user = await ensureUserExists(address);

  // Use upsert to handle duplicates gracefully
  return prisma.nFT.upsert({
    where: {
      tokenId_contractAddress: {
        tokenId,
        contractAddress
      }
    },
    update: {
      ownerId: user.id,
      updatedAt: new Date()
    },
    create: {
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

// ============================================================================
// TEAM OPERATIONS
// ============================================================================

export async function getUserTeams(address) {
  if (!address) throw new Error('User address is required');

  const user = await prisma.user.findUnique({
    where: { address },
    select: {
      teams: true
    }
  });

  return user?.teams || [];
}

export async function getTeamWithNFTs(teamId) {
  if (!teamId) throw new Error('Team ID is required');

  const team = await prisma.team.findUnique({
    where: { id: teamId }
  });

  if (!team) {
    return null;
  }

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
  }

  return {
    ...team,
    cards: []
  };
}

export async function saveTeam(address, teamData) {
  if (!address || !teamData) {
    throw new Error('Address and team data are required');
  }

  const user = await ensureUserExists(address);

  if (!teamData.name || !teamData.nftIds || !Array.isArray(teamData.nftIds)) {
    throw new Error('Team must have a name and an array of NFT IDs');
  }

  if (teamData.nftIds.length === 0 || teamData.nftIds.length > 5) {
    throw new Error('Team must have 1-5 NFTs');
  }

  // Verify NFT ownership in a single query
  const userNfts = await prisma.nFT.count({
    where: { 
      id: { in: teamData.nftIds },
      ownerId: user.id
    }
  });

  if (userNfts !== teamData.nftIds.length) {
    throw new Error('Some NFTs do not belong to the user');
  }

  // Check if team exists first
  const existingTeam = await prisma.team.findFirst({
    where: {
      name: teamData.name,
      ownerId: user.id
    }
  });

  if (existingTeam) {
    // Update existing team
    return await prisma.team.update({
      where: { id: existingTeam.id },
      data: {
        nftIds: teamData.nftIds,
        isActive: teamData.isActive !== false,
        battlesWon: teamData.battlesWon || 0,
        battlesLost: teamData.battlesLost || 0,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new team
    return await prisma.team.create({
      data: {
        name: teamData.name,
        ownerId: user.id,
        nftIds: teamData.nftIds,
        isActive: teamData.isActive !== false,
        battlesWon: teamData.battlesWon || 0,
        battlesLost: teamData.battlesLost || 0
      }
    });
  }
}

export async function deleteTeam(address, teamId) {
  if (!address || !teamId) {
    throw new Error('Address and team ID are required');
  }

  const user = await ensureUserExists(address);

  // Delete only if team belongs to user (Prisma will throw if not found)
  await prisma.team.deleteMany({
    where: {
      id: teamId,
      ownerId: user.id
    }
  });

  return { message: 'Team deleted successfully' };
}

// ============================================================================
// HOSKY POOPMETER OPERATIONS
// ============================================================================

/**
 * Get user's Hosky Poopmeter score
 */
export async function getHoskyPoopmeter(address) {
  if (!address) throw new Error('Address is required');

  const user = await prisma.user.findUnique({
    where: { address },
    select: { hoskyPoopmeter: true }
  });

  return user?.hoskyPoopmeter || 0;
}

/**
 * Increment user's Hosky Poopmeter score
 */
export async function incrementHoskyPoopmeter(address) {
  if (!address) throw new Error('Address is required');

  // Ensure user exists and increment atomically
  const user = await prisma.user.upsert({
    where: { address },
    update: {
      hoskyPoopmeter: { increment: 1 }
    },
    create: {
      address,
      balance: '0',
      hoskyPoopmeter: 1
    },
    select: {
      hoskyPoopmeter: true
    }
  });

  return user.hoskyPoopmeter;
}
