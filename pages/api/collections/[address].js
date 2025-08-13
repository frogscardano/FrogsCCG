import { prisma, withDatabase } from '../../../utils/db';
import { getFrogStats } from '../../../utils/frogData';
import { v4 as uuid4 } from 'uuid';

// Add this helper function at the top after imports
const generateNFTId = (tokenId, contractAddress) => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `nft_${timestamp}_${randomStr}`;
};

// Add user ID generator
const generateUserId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `user_${timestamp}_${randomStr}`;
};

// CRITICAL FIX: Function to sanitize tokenId to prevent binary interpretation
const sanitizeTokenId = (tokenId) => {
  if (!tokenId) return null;
  
  // Convert to string and trim
  let sanitized = String(tokenId).trim();
  
  // If it's all hex characters, add prefix to prevent binary interpretation
  if (/^[0-9a-fA-F]+$/.test(sanitized) && sanitized.length > 10) {
    sanitized = `cardano_${sanitized}`;
  }
  
  return sanitized;
};

// Function to calculate game stats based on NFT data
function calculateGameStats(nftData) {
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
}

export default async function handler(req, res) {
  const { address } = req.query;
  
  console.log(`🔍 Collections API called with address: ${address}, method: ${req.method}`);
  
  if (!prisma) {
    console.error('❌ Prisma client is completely undefined');
    return res.status(500).json({ error: 'Database client not initialized' });
  }
  
  if (!prisma.User) {
    console.error('❌ Prisma.User is undefined');
    console.log('Available Prisma methods:', Object.keys(prisma));
    return res.status(500).json({ error: 'Database user model not available' });
  }

  if (!address) {
    console.log('❌ No address provided');
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    console.log(`🔄 Attempting to upsert user with address: ${address}`);
    
    const user = await withDatabase(async (db) => {
      return await db.User.upsert({
        where: { address: address },
        update: {
          updatedAt: new Date(),
        },
        create: {
          id: uuid4(),
          address: address,
        },
      });
    });
    
    console.log(`✅ User found/created: ${user.id} for address: ${user.address}`);

    switch (req.method) {
      case 'GET':
        try {
          console.log(`🔍 Fetching NFTs for user ID: ${user.id}`);
          
          const userNfts = await withDatabase(async (db) => {
            return await db.NFT.findMany({
              where: { ownerId: user.id },
              orderBy: { createdAt: 'desc' }
            });
          });
          
          console.log(`📊 Found ${userNfts.length} NFTs for user ${address}`);
          
          const collection = userNfts.map(nft => ({
            ...nft,
            attributes: Array.isArray(nft.metadata) ? nft.metadata : 
                       (nft.metadata && typeof nft.metadata === 'object') ? 
                       Object.entries(nft.metadata).map(([key, value]) => ({ trait_type: key, value })) :
                       [
                         { trait_type: "Collection", value: "Unknown" },
                         { trait_type: "Number", value: nft.tokenId },
                         { trait_type: "Policy ID", value: nft.contractAddress }
                       ],
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
          console.log(`📥 Received POST data for ${newNftsData?.length || 0} NFTs`);
          
          if (!Array.isArray(newNftsData) || newNftsData.length === 0) {
            console.log('❌ Invalid or empty NFT data');
            return res.status(400).json({ error: 'Invalid or empty NFT data' });
          }

          const savedNfts = [];

          for (const newNftData of newNftsData) {
            // CRITICAL FIX: Sanitize tokenId to prevent binary interpretation
            let rawTokenId = newNftData.attributes?.find(attr => attr.trait_type === "Asset Name")?.value || newNftData.asset_name || newNftData.name;
            const uniqueTokenId = sanitizeTokenId(rawTokenId);

            if (!uniqueTokenId) {
              console.warn('⚠️ Skipping NFT with no unique identifier (tokenId):', newNftData);
              continue;
            }
            
            // CRITICAL FIX: Sanitize contract address too
            let rawContractAddress = newNftData.policyId || (newNftData.attributes?.find(attr => attr.trait_type === "Policy ID")?.value);
            const contractAddress = sanitizeTokenId(rawContractAddress);
            
            if (!contractAddress) {
              console.warn('⚠️ Skipping NFT due to missing contract address / policy ID:', newNftData);
              continue;
            }

            if (!newNftData.name || !newNftData.rarity || !newNftData.image) {
              console.warn('⚠️ Skipping NFT with missing essential data (name, rarity, image):', newNftData);
              continue;
            }
            
            console.log(`🔄 Processing NFT. Token ID: ${uniqueTokenId}, Name: ${newNftData.name}`);
            
            const gameStats = calculateGameStats(newNftData);

            try {
              // CRITICAL FIX: Ensure all data types are correct for PostgreSQL
              const nftDataForUpsert = {
                tokenId: String(uniqueTokenId),
                contractAddress: String(contractAddress),
                name: String(newNftData.name || '').trim(),
                rarity: String(newNftData.rarity || 'Common').trim(),
                imageUrl: String(newNftData.image || '').trim(),
                description: String(newNftData.description || '').trim(),
                attack: parseInt(gameStats.attack) || 1,
                health: parseInt(gameStats.health) || 1,
                speed: parseInt(gameStats.speed) || 1,
                special: gameStats.special ? String(gameStats.special).trim() : null,
                metadata: newNftData.attributes || {},
                ownerId: String(user.id),
              };

              // Try to create first, if it fails due to duplicate, then update
              let nftRecord;
              try {
                nftRecord = await withDatabase(async (db) => {
                  return await db.nFT.create({
                    data: {
                      ...nftDataForUpsert,
                      id: generateNFTId(nftDataForUpsert.tokenId, nftDataForUpsert.contractAddress),
                    }
                  });
                });
              } catch (createError) {
                // If creation fails due to duplicate, try to find and update
                if (createError.code === 'P2002' || createError.message.includes('unique constraint')) {
                  const existingNft = await withDatabase(async (db) => {
                    return await db.nFT.findFirst({
                      where: { 
                        AND: [
                          { tokenId: nftDataForUpsert.tokenId },
                          { contractAddress: nftDataForUpsert.contractAddress }
                        ]
                      }
                    });
                  });
                  
                  if (existingNft) {
                    nftRecord = await withDatabase(async (db) => {
                      return await db.nFT.update({
                        where: { id: existingNft.id },
                        data: { 
                          name: nftDataForUpsert.name,
                          rarity: nftDataForUpsert.rarity,
                          imageUrl: nftDataForUpsert.imageUrl,
                          description: nftDataForUpsert.description,
                          attack: nftDataForUpsert.attack,
                          health: nftDataForUpsert.health,
                          speed: nftDataForUpsert.speed,
                          special: nftDataForUpsert.special,
                          metadata: nftDataForUpsert.metadata,
                          ownerId: nftDataForUpsert.ownerId,
                          updatedAt: new Date() 
                        }
                      });
                    });
                  } else {
                    throw createError; // Re-throw if we can't find the existing NFT
                  }
                } else {
                  throw createError; // Re-throw if it's not a duplicate error
                }
              }
              
              console.log(`✅ Successfully upserted NFT: ${nftRecord.name} (ATK:${nftRecord.attack} HP:${nftRecord.health} SPD:${nftRecord.speed})`);
              savedNfts.push(nftRecord);
            } catch (nftError) {
              console.error(`❌ Failed to save NFT ${uniqueTokenId}:`, nftError);
            }
          }
          
          console.log(`✅ POST complete. Successfully saved ${savedNfts.length} NFTs`);
          return res.status(200).json(savedNfts);
        } catch (error) {
          console.error('❌ Error adding NFTs to collection:', error);
          return res.status(500).json({ error: `Failed to add NFTs to collection: ${error.message}` });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (e) {
    console.error('❌ Error processing user or NFT data:', e);
    return res.status(500).json({ error: `Failed to process request: ${e.message}` });
  }
} 
