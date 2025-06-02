import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
