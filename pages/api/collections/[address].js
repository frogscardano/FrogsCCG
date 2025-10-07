import { withDatabase } from '../../../utils/db.js';
import { getFrogStats } from '../../../utils/frogData.js';
import { getTitanStats } from '../../../utils/titansData.js';
import { v4 as uuid4 } from 'uuid';

// Add this helper function at the top after imports
const generateNFTId = (tokenId, contractAddress) => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `nft_${timestamp}_${randomStr}`;
};

// CRITICAL FIX: Function to sanitize tokenId to prevent binary interpretation
const sanitizeTokenId = (tokenId, nftName = null) => {
  // If no tokenId provided, try to use the name as fallback
  if (!tokenId) {
    if (nftName) {
      console.log(`⚠️ No tokenId provided, using name as fallback: ${nftName}`);
      return nftName;
    }
    return null;
  }
  
  // Convert to string and trim
  let sanitized = String(tokenId).trim();
  
  // If it's a name like "Titans #852", keep it as is
  if (sanitized.includes('#') || sanitized.includes('Frogs') || sanitized.includes('Snekkies') || sanitized.includes('Titans')) {
    return sanitized;
  }
  
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
  
  // Get collection type to determine which stats function to use
  let collection = nftData.attributes?.find(attr => attr.trait_type === "Collection")?.value || 'Unknown';
  
  // If collection is still Unknown, try to detect from NFT name
  if (collection === 'Unknown' && nftData.name) {
    if (nftData.name.includes('Frogs')) collection = 'Frogs';
    else if (nftData.name.includes('Snekkies')) collection = 'Snekkies';
    else if (nftData.name.includes('Titans')) collection = 'Titans';
  }
  let stats;
  
  // Use appropriate stats function based on collection
  switch (collection.toLowerCase()) {
    case 'titans':
      stats = getTitanStats(nftNumber, rarity, nftData.attributes);
      break;
    case 'frogs':
    case 'snekkies':
    default:
      stats = getFrogStats(nftNumber, rarity);
      break;
  }
  
  // Add some collection-specific bonuses
  let bonus = { attack: 0, health: 0, speed: 0 };
  
  switch (collection.toLowerCase()) {
    case 'snekkies':
      bonus = { attack: 5, health: 0, speed: 10 }; // Snekkies are fast
      break;
    case 'titans':
      bonus = { attack: 5, health: 10, speed: -3 }; // Titans are strong but slow (reduced bonus since base stats are higher)
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
  
  // CRITICAL FIX: Validate and clean the wallet address
  let cleanAddress = address;
  if (address) {
    // Basic validation - just check format and length
    // Cardano addresses are complex and strict validation can cause false positives
    
    // Check if the address has the right format
    if (!address.startsWith('addr1') && !address.startsWith('stake1')) {
      console.error(`❌ Invalid wallet address format: ${address}`);
      return res.status(400).json({ 
        error: 'Invalid wallet address format',
        receivedAddress: address,
        message: 'Wallet address must start with addr1 or stake1'
      });
    }
    
    // Check for reasonable length (Cardano addresses are typically 100-120 chars)
    if (address.length < 100 || address.length > 120) {
      console.error(`❌ Wallet address length is suspicious: ${address.length} characters`);
      return res.status(400).json({ 
        error: 'Wallet address length is suspicious',
        receivedAddress: address,
        receivedLength: address.length,
        message: 'Expected 100-120 characters for Cardano addresses'
      });
    }
    
    cleanAddress = address;
    console.log(`🔍 Validated wallet address: ${cleanAddress} (length: ${cleanAddress.length})`);
  }
  
  if (!cleanAddress) {
    console.log('❌ No address provided');
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    // Use the enhanced withDatabase wrapper for all database operations
    return await withDatabase(async (prisma) => {
      console.log(`🔄 Attempting to upsert user with address: ${cleanAddress}`);
      
      // Use direct Prisma calls with the provided client
      const user = await (async () => {
        try {
          // First try to find existing user
          const existingUser = await prisma.user.findUnique({
            where: { address: cleanAddress }
          });

          if (existingUser) {
            console.log(`🔄 Updating existing user: ${existingUser.id}`);
            // Update existing user
            return await prisma.user.update({
              where: { address: cleanAddress },
              data: {
                updatedAt: new Date(),
              }
            });
          } else {
            console.log(`🆕 Creating new user for address: ${cleanAddress}`);
            // Create new user
            return await prisma.user.create({
              data: {
                id: uuid4(),
                address: cleanAddress,
              }
            });
          }
        } catch (userError) {
          console.error(`❌ User operation failed for address ${cleanAddress}:`, userError);
          throw userError;
        }
      })();
      
      console.log(`✅ User found/created: ${user.id} for address: ${user.address}`);

      switch (req.method) {
      case 'GET':
        try {
          console.log(`🔍 Fetching NFTs for user ID: ${user.id}`);
          
          // Use direct Prisma calls to avoid conflicts
          let userNfts = await prisma.nFT.findMany({
            where: { ownerId: user.id },
            orderBy: { createdAt: 'desc' }
          });
          
          console.log(`📊 Found ${userNfts.length} NFTs for user ID: ${user.id}`);
          
          if (userNfts.length === 0) {
            console.log(`ℹ️ User ${user.id} has no NFTs yet. This is normal for new users.`);
          }
          
          // Add game stats to each NFT and ensure proper attributes structure
          const nftsWithStats = userNfts.map(nft => {
            const stats = calculateGameStats(nft);
            
            // Extract collection name from NFT name or metadata
            let collectionName = 'Unknown';
            if (nft.name) {
              if (nft.name.includes('Frogs')) collectionName = 'Frogs';
              else if (nft.name.includes('Snekkies')) collectionName = 'Snekkies';
              else if (nft.name.includes('Titans')) collectionName = 'Titans';
            }
            
            // Ensure attributes array exists for frontend compatibility
            const attributes = Array.isArray(nft.metadata) ? nft.metadata : 
                             (nft.metadata && typeof nft.metadata === 'object') ? 
                             Object.entries(nft.metadata).map(([key, value]) => ({ trait_type: key, value })) :
                             [
                               { trait_type: "Collection", value: collectionName },
                               { trait_type: "Number", value: nft.tokenId },
                               { trait_type: "Policy ID", value: nft.contractAddress }
                             ];
            
            const result = {
              ...nft,
              attack: stats.attack,
              health: stats.health,
              speed: stats.speed,
              special: stats.special,
              attributes: attributes,
              // Ensure image field is properly named for frontend
              image: nft.imageUrl || nft.image
            };
            
            // Debug logging for image URLs
            console.log(`🖼️ NFT ${nft.name} image data:`, {
              imageUrl: nft.imageUrl,
              image: nft.image,
              finalImage: result.image
            });
            
            return result;
          });
          
          console.log(`✅ Returning collection with ${nftsWithStats.length} items`);
          
          return res.status(200).json({
            collection: nftsWithStats,
            userInfo: {
              id: user.id,
              address: user.address,
              nftCount: nftsWithStats.length
            }
          });
        } catch (error) {
          console.error('❌ Error fetching NFTs:', error);
          return res.status(500).json({ error: 'Failed to fetch NFTs' });
        }

      case 'POST':
        try {
          const nftData = req.body;
          console.log(`📥 Received POST data for ${nftData?.length || 0} NFTs`);
          
          if (!Array.isArray(nftData)) {
            nftData = [nftData];
          }
          
          if (nftData.length === 0) {
            return res.status(400).json({ error: 'No NFT data provided' });
          }

          const savedNfts = [];

          for (const nft of nftData) {
            try {
              console.log(`🔄 Processing NFT: ${nft.name || 'Unknown'}`);
              console.log(`🔍 NFT data received:`, JSON.stringify(nft, null, 2));
              
              // CRITICAL FIX: Sanitize the tokenId to prevent binary interpretation issues
              const sanitizedTokenId = sanitizeTokenId(nft.tokenId, nft.name);
              console.log(`🔍 TokenId sanitization:`, { 
                original: nft.tokenId, 
                sanitized: sanitizedTokenId,
                type: typeof nft.tokenId 
              });
              
              if (!sanitizedTokenId) {
                console.error(`❌ Invalid tokenId for NFT: ${nft.name}`, { 
                  tokenId: nft.tokenId, 
                  type: typeof nft.tokenId,
                  isNull: nft.tokenId === null,
                  isUndefined: nft.tokenId === undefined
                });
                continue;
              }
              
              // Extract contractAddress from attributes if not provided directly
              let contractAddress = nft.contractAddress;
              if (!contractAddress && nft.attributes) {
                const policyIdAttr = nft.attributes.find(attr => attr.trait_type === "Policy ID");
                if (policyIdAttr) {
                  contractAddress = policyIdAttr.value;
                  console.log(`🔍 Extracted contractAddress from attributes: ${contractAddress}`);
                }
              }
              
              if (!contractAddress) {
                console.error(`❌ Missing contractAddress for NFT: ${nft.name}`);
                continue;
              }
              
              // Check if NFT already exists
              const existingNFT = await prisma.nFT.findFirst({
                where: {
                  tokenId: sanitizedTokenId,
                  contractAddress: contractAddress
                }
              });

              if (existingNFT) {
                console.log(`🔄 Updating existing NFT: ${existingNFT.name}`);
                // Update existing NFT
                const updatedNFT = await prisma.nFT.update({
                  where: { id: existingNFT.id },
                  data: {
                    ownerId: user.id,
                    name: nft.name || existingNFT.name,
                    imageUrl: nft.image || nft.imageUrl || existingNFT.imageUrl,
                    description: nft.description || existingNFT.description,
                    rarity: nft.rarity || existingNFT.rarity,
                    attack: nft.attack || existingNFT.attack,
                    health: nft.health || existingNFT.health,
                    speed: nft.speed || existingNFT.speed,
                    special: nft.special || existingNFT.special,
                    metadata: nft.attributes || nft.metadata || existingNFT.metadata,
                    updatedAt: new Date()
                  }
                });
                savedNfts.push(updatedNFT);
              } else {
                console.log(`🆕 Creating new NFT: ${nft.name}`);
                // Create new NFT
                const newNFT = await prisma.nFT.create({
                  data: {
                    id: generateNFTId(sanitizedTokenId, contractAddress),
                    tokenId: sanitizedTokenId,
                    contractAddress: contractAddress,
                    ownerId: user.id,
                    name: nft.name,
                    imageUrl: nft.image || nft.imageUrl,
                    description: nft.description,
                    rarity: nft.rarity,
                    attack: nft.attack,
                    health: nft.health,
                    speed: nft.speed,
                    special: nft.special,
                    metadata: nft.attributes || nft.metadata
                  }
                });
                savedNfts.push(newNFT);
              }
              
              console.log(`✅ Successfully saved NFT: ${nft.name}`);
            } catch (nftError) {
              console.error(`❌ Failed to save NFT ${nft.name}:`, nftError);
              // Continue with next NFT instead of failing completely
              continue;
            }
          }
          
          console.log(`✅ POST complete. Successfully saved ${savedNfts.length} NFTs`);
          return res.status(200).json(savedNfts);
        } catch (error) {
          console.error('❌ Error adding NFTs:', error);
          return res.status(500).json({ error: `Failed to add NFTs: ${error.message}` });
        }

      case 'DELETE':
        try {
          const { cardId } = req.body;
          
          if (!cardId) {
            return res.status(400).json({ error: 'Card ID is required for deletion' });
          }

          console.log(`🗑️ Deleting NFT with ID: ${cardId} for user: ${user.id}`);

          // Find and delete the NFT
          const deletedNFT = await prisma.nFT.deleteMany({
            where: {
              id: cardId,
              ownerId: user.id
            }
          });

          if (deletedNFT.count === 0) {
            console.log(`⚠️ No NFT found with ID: ${cardId} for user: ${user.id}`);
            return res.status(404).json({ error: 'NFT not found or not owned by user' });
          }

          console.log(`✅ Successfully deleted NFT with ID: ${cardId}`);
          return res.status(200).json({ message: 'NFT deleted successfully', deletedCount: deletedNFT.count });
        } catch (error) {
          console.error('❌ Error deleting NFT:', error);
          return res.status(500).json({ error: `Failed to delete NFT: ${error.message}` });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
      }
    });
  } catch (e) {
    console.error('❌ Error processing user or NFT data:', e);
    return res.status(500).json({ error: `Failed to process request: ${e.message}` });
  }
}
