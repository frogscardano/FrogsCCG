import { prisma } from '../../../utils/db';
import { getFrogStats } from '../../../utils/frogData';
import { v4 as uuid4 } from 'uuid';

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
  console.log(`🔍 Prisma client status:`, prisma ? 'OK' : 'UNDEFINED');

  if (!address) {
    console.log('❌ No address provided');
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    // Use uppercase User - CRITICAL FIX
    const user = await prisma.user.upsert({
      where: { address: address },
      update: {
        updatedAt: new Date(),
      },
      create: {
        id: uuid4(),
        address: address,
      },
    });
    
    console.log(`✅ User found/created: ${user.id} for address: ${user.address}`);

    switch (req.method) {
      case 'GET':
        try {
          console.log(`🔍 Fetching NFTs for user ID: ${user.id}`);
          // Use uppercase NFT - CRITICAL FIX
          const userNfts = await prisma.nFT.findMany({
            where: { ownerId: user.id },
            orderBy: { createdAt: 'desc' }
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
          console.log(`📥 Received POST data for ${newNftsData?.length || 0} NFTs`);
          
          if (!Array.isArray(newNftsData) || newNftsData.length === 0) {
            console.log('❌ Invalid or empty NFT data');
            return res.status(400).json({ error: 'Invalid or empty NFT data' });
          }

          const savedNfts = [];

          for (const newNftData of newNftsData) {
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

            try {
              const nftDataForUpsert = {
                id: uuid4(), // :eyes:
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

              // Use uppercase NFT and correct field names - CRITICAL FIX
              const nftRecord = await prisma.nFT.upsert({
                where: { 
                  tokenId_contractAddress: {
                    tokenId: uniqueTokenId,
                    contractAddress: contractAddress 
                  } 
                },
                update: { 
                  ...nftDataForUpsert, 
                  updatedAt: new Date() 
                },
                create: nftDataForUpsert,
              });
              
              console.log(`✅ Successfully upserted NFT: ${nftRecord.name} (ATK:${nftRecord.attack} HP:${nftRecord.health} SPD:${nftRecord.speed})`);
              savedNfts.push(nftRecord);
            } catch (nftError) {
              console.error(`❌ Failed to save NFT ${uniqueTokenId}:`, nftError);
              // Continue with other NFTs
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
