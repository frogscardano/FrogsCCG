import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export { globalForPrisma };

// Check if DATABASE_URL is available
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL environment variable is not set. Database operations will fail.');
}

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
  }));

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

    await prisma.$connect();
    console.log('✅ Database connection successful');
    return { connected: true, message: 'Database connection successful' };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return { 
      connected: false, 
      error: error.message,
      message: 'Failed to connect to database'
    };
  }
}

// Simplified database operation wrapper
export async function withDatabase(operation) {
  try {
    return await operation(prisma);
  } catch (error) {
    console.error('Database operation failed:', error);
    throw error;
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
