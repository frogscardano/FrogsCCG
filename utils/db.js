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
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
    // Critical configuration for serverless environments to prevent prepared statement issues
    __internal: {
      engine: {
        enableEngineDebugMode: false,
      },
    },
    // Connection pool configuration for better serverless performance
    transactionOptions: {
      maxWait: 10000, // 10 seconds
      timeout: 30000, // 30 seconds
    },
  });
}

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = createPrismaClient());

// Connection management for serverless environments
let connectionPromise = null;
let isConnected = false;

// Enhanced connection function with proper error handling
export async function ensureConnection() {
  if (isConnected && globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      // If we have an existing client, try to disconnect first
      if (globalForPrisma.prisma) {
        try {
          await globalForPrisma.prisma.$disconnect();
        } catch (disconnectError) {
          console.warn('Warning during disconnect:', disconnectError.message);
        }
      }

      // Create a fresh client
      globalForPrisma.prisma = createPrismaClient();
      
      // Test the connection
      await globalForPrisma.prisma.$connect();
      isConnected = true;
      
      console.log('✅ Database connection established');
      return globalForPrisma.prisma;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      isConnected = false;
      connectionPromise = null;
      throw error;
    }
  })();

  return connectionPromise;
}

// Test database connection
export async function testDatabaseConnection() {
  try {
    if (!DATABASE_URL) {
      return { 
        connected: false, 
        error: 'DATABASE_URL not set',
        message: 'Database connection string is not configured'
      };
    }

    const client = await ensureConnection();
    await client.$queryRaw`SELECT 1`;
    
    console.log('✅ Database connection test successful');
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

// Enhanced database operation wrapper with better error handling
export async function withDatabase(operation, retries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Ensure we have a fresh connection
      const client = await ensureConnection();
      
      // Execute the operation
      const result = await operation(client);
      
      // Reset connection promise on success
      if (attempt === 1) {
        connectionPromise = null;
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if this is a retryable error
      const isRetryableError = 
        error.code === 'P2024' || // Connection error
        error.message.includes('prepared statement') ||
        error.message.includes('already exists') ||
        error.message.includes('connection') ||
        error.message.includes('s0') ||
        error.message.includes('s1') ||
        error.message.includes('s2') ||
        error.message.includes('s3') ||
        error.message.includes('s4') ||
        error.message.includes('s5') ||
        error.message.includes('P1001') || // Can't reach database server
        error.message.includes('P1008') || // Operations timed out
        error.message.includes('P1017') || // Server has closed the connection
        error.message.includes('P2024'); // Transaction failed due to a write conflict

      if (isRetryableError && attempt < retries) {
        console.warn(`🔄 Database operation failed (attempt ${attempt}/${retries}):`, error.message);
        
        // Reset connection state
        isConnected = false;
        connectionPromise = null;
        
        // Wait with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        continue;
      }
      
      // If not retryable or max retries reached, throw the error
      throw error;
    }
  }
  
  throw lastError;
}

// Graceful shutdown function
export async function disconnectDatabase() {
  try {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect();
      globalForPrisma.prisma = null;
    }
    isConnected = false;
    connectionPromise = null;
    console.log('✅ Database disconnected gracefully');
  } catch (error) {
    console.error('❌ Error during database disconnect:', error);
  }
}

// Handle process termination gracefully
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await disconnectDatabase();
  });
  
  process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
  });
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
    const existingNFT = await prisma.nFT.findFirst({
      where: {
        tokenId,
        contractAddress
      }
    });

    if (existingNFT) {
      // Update existing NFT
      return await prisma.nFT.update({
        where: { id: existingNFT.id },
        data: {
          ownerId: user.id,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new NFT
      return await prisma.nFT.create({
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
    const existingUser = await prisma.user.findUnique({
      where: { address }
    });

    if (existingUser) {
      return existingUser;
    } else {
      // Create new user
      return await prisma.user.create({
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

// Team related functions
export async function getUserTeams(address) {
  if (!address) throw new Error('User address is required');

  try {
    console.log(`Fetching teams for user: ${address}`);

    const user = await prisma.User.findUnique({
      where: { address },
      include: {
        teams: true
      }
    });

    if (!user) {
      console.log(`No user found for address ${address}`);
      return [];
    }

    console.log(`Found ${user.teams.length} teams for user ${address}`);
    return user.teams;
  } catch (error) {
    console.error(`Error fetching teams for user ${address}:`, error);
    return [];
  }
}

export async function getTeamWithNFTs(teamId) {
  if (!teamId) throw new Error('Team ID is required');

  try {
    const team = await prisma.Team.findUnique({
      where: { id: teamId }
    });

    if (!team) {
      console.log(`No team found with ID ${teamId}`);
      return null;
    }

    // Fetch the NFTs for this team
    if (team.nftIds && team.nftIds.length > 0) {
      const nfts = await prisma.NFT.findMany({
        where: { 
          id: { in: team.nftIds }
        }
      });
      
      return {
        ...team,
        cards: nfts
      };
    } else {
      return {
        ...team,
        cards: []
      };
    }
  } catch (error) {
    console.error(`Error fetching team with NFTs ${teamId}:`, error);
    throw error;
  }
}

export async function saveTeam(address, teamData) {
  if (!address || !teamData) {
    throw new Error('Address and team data are required');
  }

  try {
    // First ensure user exists and get their ID
    const user = await ensureUserExists(address);

    // Validate team data
    if (!teamData.name || !teamData.nftIds || !Array.isArray(teamData.nftIds)) {
      throw new Error('Team must have a name and an array of NFT IDs');
    }

    if (teamData.nftIds.length === 0) {
      throw new Error('Team must have at least one NFT');
    }

    if (teamData.nftIds.length > 5) {
      throw new Error('Team cannot have more than 5 NFTs');
    }

    // Verify that all NFTs belong to the user
    const userNfts = await prisma.NFT.findMany({
      where: { 
        id: { in: teamData.nftIds },
        ownerId: user.id
      }
    });

    if (userNfts.length !== teamData.nftIds.length) {
      throw new Error('Some NFTs do not belong to the user');
    }

    // Check if team with same name already exists for this user
    const existingTeam = await prisma.Team.findFirst({
      where: {
        name: teamData.name,
        ownerId: user.id
      }
    });

    if (existingTeam) {
      // Update existing team
      return await prisma.Team.update({
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
      return await prisma.Team.create({
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
  } catch (error) {
    console.error(`Error saving team for user ${address}:`, error);
    throw error;
  }
}

export async function deleteTeam(address, teamId) {
  if (!address || !teamId) {
    throw new Error('Address and team ID are required');
  }

  try {
    // First ensure user exists and get their ID
    const user = await ensureUserExists(address);

    // Verify the team belongs to the user
    const team = await prisma.Team.findFirst({
      where: {
        id: teamId,
        ownerId: user.id
      }
    });

    if (!team) {
      throw new Error('Team not found or does not belong to user');
    }

    // Delete the team
    await prisma.Team.delete({
      where: { id: teamId }
    });

    return { message: 'Team deleted successfully' };
  } catch (error) {
    console.error(`Error deleting team ${teamId} for user ${address}:`, error);
    throw error;
  }
}
