import { PrismaClient } from '@prisma/client';

let getFrogStats;
try {
  const frogData = require('../../../utils/frogData');
  getFrogStats = frogData.getFrogStats;
} catch (importError) {
  console.error('Failed to import getFrogStats:', importError);
  // Fallback function if import fails
  getFrogStats = (frogNumber, rarity) => {
    const baseStats = {
      'Legendary': { attack: 80, health: 80, speed: 80 },
      'Epic': { attack: 65, health: 65, speed: 65 },
      'Rare': { attack: 50, health: 50, speed: 50 },
      'Common': { attack: 30, health: 30, speed: 30 }
    };
    return baseStats[rarity] || baseStats['Common'];
  };
}

let prisma;

// Initialize Prisma with better error handling
try {
  prisma = new PrismaClient({
    log: [
      { emit: 'stdout', level: 'query' },
      { emit: 'stdout', level: 'info' },
      { emit: 'stdout', level: 'warn' },
      { emit: 'stdout', level: 'error' },
    ],
  });
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  prisma = null;
}

// Function to check if database is available
async function isDatabaseAvailable() {
  if (!prisma) {
    console.log('Prisma client not initialized');
    return false;
  }
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Function to calculate game stats based on NFT data
function calculateGameStats(nftData) {
  try {
    const rarity = nftData.rarity || 'Common';
    
    // Extract number from NFT name or use a default
    let nftNumber = 1;
    
    // Try to extract number from name (e.g., "Frogs #123", "Snekkies #4267")
    const nameMatch = nftData.name?.match(/#(\d+)/);
    if (nameMatch) {
      nftNumber = parseInt(nameMatch[1]);
    } else {
      // Try to extract from attributes
      const numberAttr = nftData.attributes?.find(attr => 
        attr.trait_type === "Number" || attr.trait_type === "Asset Name"
      );
      if (numberAttr && numberAttr.value) {
        const numMatch = numberAttr.value.toString().match(/\d+/);
        if (numMatch) {
          nftNumber = parseInt(numMatch[0]);
        }
      }
    }
    
    console.log(`🎮 Calculating stats for NFT #${nftNumber} with rarity ${rarity}`);
    
    // Use getFrogStats for now - can be extended for other collections
    const stats = getFrogStats(nftNumber, rarity);
    
    // Add some collection-specific bonuses
    const collection = nftData.attributes?.find(attr => attr.trait_type === "Collection")?.value || 'Unknown';
    let bonus = { attack: 0, health: 0, speed: 0 };
    
    switch (collection.toLowerCase()) {
      case 'snekkies':
        bonus = { attack: 5, health: 0, speed: 10 }; // Snekkies are fast
        break;
      case 'titans':
        bonus = { attack: 10, health: 15, speed: -5 }; // Titans are strong but slow
        break;
      case 'frogs':
      default:
        bonus = { attack: 0, health: 5, speed: 5 }; // Frogs are balanced
        break;
    }
    
    return {
      attack: Math.max(1, stats.attack + bonus.attack),
      health: Math.max(1, stats.health + bonus.health),
      speed: Math.max(1, stats.speed + bonus.speed),
      special: stats.special
    };
  } catch (error) {
    console.error('Error calculating game stats:', error);
    // Return default stats if calculation fails
    return {
      attack: 10,
      health: 10,
      speed: 10,
      special: 'None'
    };
  }
}

export default async function handler(req, res) {
  console.log(`🔍 Collections API called with method: ${req.method}`);
  console.log(`🔍 Request URL: ${req.url}`);
  console.log(`🔍 Query params:`, req.query);

  try {
    const { address } = req.query;
    
    if (!address) {
      console.log('❌ No address provided');
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    console.log(`🔍 Processing request for address: ${address}`);

    // Check if database is available
    const dbAvailable = await isDatabaseAvailable();
    console.log(`📊 Database available: ${dbAvailable}`);
    
    if (!dbAvailable) {
      console.log('⚠️ Database not available, returning empty collection');
      if (req.method === 'GET') {
        return res.status(200).json([]);
      } else if (req.method === 'POST') {
        return res.status(503).json({ error: 'Database temporarily unavailable. Please try again later.' });
      }
    }

    let user;
    try {
      user = await prisma.user.upsert({
        where: { address: address },
        update: {
          updatedAt: new Date(),
        },
        create: {
          address: address,
        },
      });
      
      console.log(`✅ User found/created: ${user.id} for address: ${user.address}`);
    } catch (userError) {
      console.error('❌ Error with user operations:', userError);
      return res.status(500).json({ error: 'Database user operation failed' });
    }

    switch (req.method) {
      case 'GET':
        try {
          console.log(`🔍 Fetching NFTs for user ID: ${user.id}`);
          const userNfts = await prisma.nFT.findMany({
            where: { ownerId: user.id },
          });
          
          console.log(`📊 Found ${userNfts.length} NFTs for user ${address}`);
          
          // Process NFTs to ensure proper structure for frontend
          const collection = userNfts.map(nft => ({
            ...nft,
            // Ensure metadata is an array of attributes for frontend compatibility
            attributes: Array.isArray(nft.metadata) ? nft.metadata : 
                       (nft.metadata && typeof nft.metadata === 'object') ? 
                       Object.entries(nft.metadata).map(([key, value]) => ({ trait_type: key, value })) :
                       [
                         { trait_type: "Collection", value: "Unknown" },
                         { trait_type: "Number", value: nft.tokenId },
                         { trait_type: "Policy ID", value: nft.contractAddress }
                       ],
            // Ensure image field is properly named
            image: nft.imageUrl || nft.image
          }));
          
          console.log(`✅ Returning collection with ${collection.length} items`);
          return res.status(200).json(collection);
        } catch (error) {
          console.error('❌ Error fetching collection:', error);
          return res.status(500).json({ error: 'Failed to fetch collection' });
        }

      case 'POST':
        try {
          const newNftsData = req.body;
          console.log(`📥 Received POST data with ${Array.isArray(newNftsData) ? newNftsData.length : 0} items`);
          
          if (!Array.isArray(newNftsData) || newNftsData.length === 0) {
            console.log('❌ Invalid or empty NFT data');
            return res.status(400).json({ error: 'Invalid or empty NFT data' });
          }

          for (const newNftData of newNftsData) {
            try {
              const uniqueTokenId = newNftData.attributes?.find(attr => attr.trait_type === "Asset Name")?.value || newNftData.asset_name || newNftData.name;

              if (!uniqueTokenId) {
                console.warn('⚠️ Skipping NFT with no unique identifier (tokenId):', newNftData);
                continue;
              }
              
              const contractAddress = newNftData.policyId || (newNftData.attributes?.find(attr => attr.trait_type === "Policy ID")?.value);
              if (!contractAddress) {
                console.warn('⚠️ Skipping NFT due to missing contract address / policy ID:', newNftData);
                continue;
              }

              if (!newNftData.name || !newNftData.rarity || !newNftData.image) {
                console.warn('⚠️ Skipping NFT with missing essential data (name, rarity, image):', newNftData);
                continue;
              }
              
              console.log(`🔄 Processing NFT. Token ID: ${uniqueTokenId}, Name: ${newNftData.name}`);
              
              // Calculate game stats for this NFT
              const gameStats = calculateGameStats(newNftData);

              await prisma.$transaction(async (tx) => {
                const nftDataForUpsert = {
                  tokenId: uniqueTokenId,
                  contractAddress: contractAddress,
                  name: newNftData.name,
                  rarity: newNftData.rarity,
                  imageUrl: newNftData.image,
                  description: newNftData.description || '',
                  attack: gameStats.attack,
                  health: gameStats.health,
                  speed: gameStats.speed,
                  special: gameStats.special,
                  metadata: newNftData.attributes || {},
                  ownerId: user.id,
                };

                const nftRecord = await tx.nFT.upsert({
                  where: { 
                    tokenId_contractAddress: {
                      tokenId: uniqueTokenId,
                      contractAddress: contractAddress 
                    } 
                  },
                  update: { ...nftDataForUpsert, updatedAt: new Date() },
                  create: nftDataForUpsert,
                });
                
                if (!nftRecord || !nftRecord.id) {
                  console.error('❌ Failed to upsert NFT within transaction, nftRecord is invalid:', nftRecord);
                  throw new Error(`Failed to obtain valid NFT record for tokenId: ${uniqueTokenId}`);
                }
                console.log(`✅ Successfully upserted NFT: ${nftRecord.name} (ATK:${nftRecord.attack} HP:${nftRecord.health} SPD:${nftRecord.speed})`);
              });
            } catch (nftError) {
              console.error('❌ Error processing individual NFT:', nftError);
              // Continue with next NFT instead of failing entire request
              continue;
            }
          }
          
          const updatedUserNfts = await prisma.nFT.findMany({
            where: { ownerId: user.id },
          });
          const finalCollection = updatedUserNfts.map(nft => ({
            ...nft,
          }));

          console.log(`✅ POST complete. Returning ${finalCollection.length} NFTs`);
          return res.status(200).json(finalCollection);
        } catch (error) {
          console.error('❌ Error adding NFTs to collection:', error);
          return res.status(500).json({ error: `Failed to add NFTs to collection: ${error.message}` });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (e) {
    console.error('❌ Critical error in collections API:', e);
    console.error('❌ Error stack:', e.stack);
    return res.status(500).json({ error: `Internal server error: ${e.message}` });
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (disconnectError) {
        console.error('❌ Error disconnecting Prisma:', disconnectError);
      }
    }
  }
} 