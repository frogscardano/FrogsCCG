import { prisma, withDatabase } from '../../../utils/db.js';
import { getFrogStats } from '../../../utils/frogData.js';
import { v4 as uuid4 } from 'uuid';

// Add this helper function at the top after imports
const generateNFTId = (tokenId, contractAddress) => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `nft_${timestamp}_${randomStr}`;
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
          
          // CRITICAL FIX: First try to find NFTs by user ID
          let userNfts = await withDatabase(async (db) => {
            return await db.NFT.findMany({
              where: { ownerId: user.id },
              orderBy: { createdAt: 'desc' }
            });
          });
          
          // CRITICAL FIX: If no NFTs found by user ID, check if there are NFTs with the wrong ownerId
          // This handles the case where NFTs were saved with a different user ID format
          if (userNfts.length === 0) {
            console.log(`🔍 No NFTs found for user ID ${user.id}, checking for orphaned NFTs...`);
            
            // Look for NFTs that might belong to this user but have wrong ownerId
            const orphanedNfts = await withDatabase(async (db) => {
              return await db.NFT.findMany({
                where: {
                  OR: [
                    { ownerId: { contains: address.slice(-8) } }, // Check if ownerId contains part of wallet address
                    { ownerId: { startsWith: 'frogs-' } }, // Check for old format IDs
                    { ownerId: { startsWith: 'user_' } }   // Check for other old format IDs
                  ]
                },
                orderBy: { createdAt: 'desc' }
              });
            });
            
            if (orphanedNfts.length > 0) {
              console.log(`🔍 Found ${orphanedNfts.length} potentially orphaned NFTs, attempting to fix...`);
              
              // Update the ownerId for these NFTs to the current user
              for (const orphanedNft of orphanedNfts) {
                try {
                  await withDatabase(async (db) => {
                    await db.NFT.update({
                      where: { id: orphanedNft.id },
                      data: { 
                        ownerId: user.id,
                        updatedAt: new Date()
                      }
                    });
                  });
                  console.log(`✅ Fixed orphaned NFT ${orphanedNft.name} (ID: ${orphanedNft.id})`);
                } catch (updateError) {
                  console.error(`❌ Failed to fix orphaned NFT ${orphanedNft.id}:`, updateError);
                }
              }
              
              // Fetch the updated NFTs
              userNfts = await withDatabase(async (db) => {
                return await db.NFT.findMany({
                  where: { ownerId: user.id },
                  orderBy: { createdAt: 'desc' }
                });
              });
              
              console.log(`✅ After fixing orphaned NFTs, found ${userNfts.length} NFTs for user ID: ${user.id}`);
            }
          }
          
          // CRITICAL FIX: Log with user ID, not wallet address
          console.log(`📊 Found ${userNfts.length} NFTs for user ID: ${user.id}`);
          
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
          console.log(`📥 POST data structure:`, JSON.stringify(newNftsData, null, 2));
          
          if (!Array.isArray(newNftsData)) {
            // Handle single NFT from openPack
            newNftsData = [newNftsData];
          }
          
          if (newNftsData.length === 0) {
            console.log('❌ Invalid or empty NFT data');
            return res.status(400).json({ error: 'Invalid or empty NFT data' });
          }

          const savedNfts = [];

          for (const newNftData of newNftsData) {
            console.log(`🔄 Processing NFT data:`, JSON.stringify(newNftData, null, 2));
            
            // CRITICAL FIX: Handle both data structures (from openPack and direct API calls)
            let nftName, nftRarity, nftImage, nftDescription, nftAttributes, nftTokenId, nftContractAddress;
            
            if (newNftData.metadata) {
              // Data from openPack.js
              nftName = newNftData.metadata.name;
              nftRarity = newNftData.metadata.rarity;
              nftImage = newNftData.metadata.image;
              nftDescription = newNftData.metadata.description || '';
              nftAttributes = newNftData.metadata.attributes || [];
              nftTokenId = newNftData.metadata.number || newNftData.tokenId;
              nftContractAddress = newNftData.contractAddress;
            } else {
              // Direct API call data
              nftName = newNftData.name;
              nftRarity = newNftData.rarity;
              nftImage = newNftData.image;
              nftDescription = newNftData.description || '';
              nftAttributes = newNftData.attributes || [];
              nftTokenId = newNftData.attributes?.find(attr => attr.trait_type === "Asset Name")?.value || newNftData.asset_name || newNftData.name;
              nftContractAddress = newNftData.policyId || (newNftData.attributes?.find(attr => attr.trait_type === "Policy ID")?.value);
            }

            // CRITICAL FIX: Sanitize tokenId to prevent binary interpretation
            const uniqueTokenId = sanitizeTokenId(nftTokenId);

            if (!uniqueTokenId) {
              console.warn('⚠️ Skipping NFT with no unique identifier (tokenId):', newNftData);
              continue;
            }
            
            // CRITICAL FIX: Sanitize contract address too
            const contractAddress = sanitizeTokenId(nftContractAddress);
            
            if (!contractAddress) {
              console.warn('⚠️ Skipping NFT due to missing contract address / policy ID:', newNftData);
              continue;
            }

            if (!nftName || !nftRarity || !nftImage) {
              console.warn('⚠️ Skipping NFT with missing essential data (name, rarity, image):', newNftData);
              continue;
            }
            
            console.log(`🔄 Processing NFT. Token ID: ${uniqueTokenId}, Name: ${nftName}`);
            
            // Create a standardized NFT data object for stats calculation
            const standardizedNftData = {
              name: nftName,
              rarity: nftRarity,
              attributes: nftAttributes
            };
            
            const gameStats = calculateGameStats(standardizedNftData);

            try {
              // CRITICAL FIX: Ensure all data types are correct for PostgreSQL
              const nftDataForUpsert = {
                tokenId: String(uniqueTokenId),
                contractAddress: String(contractAddress),
                name: String(nftName || '').trim(),
                rarity: String(nftRarity || 'Common').trim(),
                imageUrl: String(nftImage || '').trim(),
                description: String(nftDescription || '').trim(),
                attack: parseInt(gameStats.attack) || 1,
                health: parseInt(gameStats.health) || 1,
                speed: parseInt(gameStats.speed) || 1,
                special: gameStats.special ? String(gameStats.special).trim() : null,
                metadata: nftAttributes || {},
                ownerId: String(user.id),
              };

              const nftRecord = await withDatabase(async (db) => {
                return await db.NFT.upsert({
                  where: { 
                    tokenId_contractAddress: {
                      tokenId: nftDataForUpsert.tokenId,
                      contractAddress: nftDataForUpsert.contractAddress 
                    } 
                  },
                  update: { 
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
                  },
                  create: {
                    ...nftDataForUpsert,
                    id: generateNFTId(nftDataForUpsert.tokenId, nftDataForUpsert.contractAddress),
                  },
                });
              });
              
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
