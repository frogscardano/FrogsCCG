import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export { globalForPrisma };

export const prisma =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    errorFormat: 'pretty',
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Simplified connection configuration to avoid prepared statement conflicts
    // Remove complex pooling that might cause issues
    __internal: {
      engine: {
        enableEngineDebugMode: false,
      },
    },
  }));

// Database operation wrapper with retry logic and better connection management
export async function withDatabase(operation) {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      // Get the current Prisma client (it might have been updated during reconnection)
      const currentPrisma = globalForPrisma.prisma || prisma;
      
      // Create a wrapper object that maps the expected model names to the actual Prisma client
      const dbWrapper = {
        Team: currentPrisma.Team,
        User: currentPrisma.User,
        NFT: currentPrisma.NFT,
        // Add any other models that might be needed
        $connect: currentPrisma.$connect,
        $disconnect: currentPrisma.$disconnect,
        $transaction: currentPrisma.$transaction,
        $queryRaw: currentPrisma.$queryRaw,
        $executeRaw: currentPrisma.$executeRaw
      };
      
      // Debug logging to verify wrapper properties
      console.log('🔍 Database wrapper created with properties:', {
        hasTeam: !!dbWrapper.Team,
        hasUser: !!dbWrapper.User,
        hasNFT: !!dbWrapper.NFT,
        teamType: typeof dbWrapper.Team,
        userType: typeof dbWrapper.User,
        nftType: typeof dbWrapper.NFT
      });
      
      return await operation(dbWrapper);
    } catch (error) {
      retries++;
      
      // Check if it's a connection error that might be retryable
      if (error.code === 'P2024' || 
          error.message.includes('prepared statement') || 
          error.message.includes('already exists') ||
          error.message.includes('there is no unique or exclusion constraint') ||
          error.message.includes('connection') ||
          error.message.includes('s0') ||
          error.message.includes('s1') ||
          error.message.includes('s2')) {
        console.warn(`Database operation failed (attempt ${retries}/${maxRetries}):`, error.message);
        
        if (retries < maxRetries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
          
          // Try to disconnect and reconnect
          try {
            console.log(`🔄 Attempting to reconnect to database (attempt ${retries})...`);
            
            // Disconnect the current client
            if (globalForPrisma.prisma) {
              await globalForPrisma.prisma.$disconnect();
            }
            
            // Force a new connection with fresh configuration
            globalForPrisma.prisma = new PrismaClient({
              log: ['query', 'info', 'warn', 'error'],
              errorFormat: 'pretty',
              datasources: {
                db: {
                  url: process.env.DATABASE_URL,
                },
              },
              // Simplified configuration to avoid prepared statement conflicts
              __internal: {
                engine: {
                  enableEngineDebugMode: false,
                },
              },
            });
            
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
