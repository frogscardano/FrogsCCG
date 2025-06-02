import { PrismaClient } from '@prisma/client';
import { getFrogStats } from '../../../utils/frogData';

// Create a single PrismaClient instance and reuse it
const prisma = new PrismaClient({
  // Add logging to help debug
  log: ['query', 'error', 'warn']
});

export default async function handler(req, res) {
  const { address } = req.query;
  
  console.log(`🔍 Collections API called with address: ${address}, method: ${req.method}`);

  if (!address) {
    console.log('❌ No address provided');
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    // First, find the user without upsert to avoid prepared statement issues
    let user = await prisma.user.findUnique({
      where: { address }
    });

    // If user doesn't exist, create them
    if (!user) {
      user = await prisma.user.create({
        data: {
          address,
          updatedAt: new Date()
        }
      });
    }
    
    console.log(`✅ User found/created: ${user.id} for address: ${user.address}`);

    switch (req.method) {
      case 'GET':
        try {
          console.log(`🔍 Fetching NFTs for user ID: ${user.id}`);
          const userNfts = await prisma.nFT.findMany({
            where: { 
              ownerId: user.id 
            },
            select: {
              id: true,
              tokenId: true,
              contractAddress: true,
              name: true,
              rarity: true,
              imageUrl: true,
              description: true,
              attack: true,
              health: true,
              speed: true,
              special: true,
              metadata: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: { 
              createdAt: 'desc' 
            }
          });
          
          console.log(`📊 Found ${userNfts.length} NFTs for user ${address}`);
          
          // Process NFTs to ensure proper structure for frontend
          const collection = userNfts.map(nft => ({
            ...nft,
            // Handle metadata more carefully
            attributes: (() => {
              try {
                if (Array.isArray(nft.metadata)) {
                  return nft.metadata;
                } else if (nft.metadata && typeof nft.metadata === 'object') {
                  return Object.entries(nft.metadata).map(([key, value]) => ({ 
                    trait_type: key, 
                    value: String(value) // Ensure value is string
                  }));
                }
              } catch (e) {
                console.warn(`Failed to process metadata for NFT ${nft.id}:`, e);
              }
              return [
                { trait_type: "Collection", value: "Unknown" },
                { trait_type: "Number", value: nft.tokenId },
                { trait_type: "Policy ID", value: nft.contractAddress }
              ];
            })(),
            // Ensure image field is properly named
            image: nft.imageUrl || nft.image || ""
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
            const uniqueTokenId = newNftData.attributes?.find(attr => 
              attr.trait_type === "Asset Name")?.value || 
              newNftData.asset_name || 
              newNftData.name || 
              String(Date.now()); // Fallback value

            if (!uniqueTokenId) {
              console.warn('⚠️ Skipping NFT with no unique identifier (tokenId):', newNftData);
              continue;
            }
            
            const contractAddress = newNftData.policyId || 
              newNftData.attributes?.find(attr => attr.trait_type === "Policy ID")?.value || 
              'default';

            console.log(`🔄 Processing NFT. Token ID: ${uniqueTokenId}, Name: ${newNftData.name || 'Unnamed'}`);
            
            // Calculate game stats for this NFT
            const gameStats = calculateGameStats(newNftData);

            try {
              // First try to find existing NFT
              let nftRecord = await prisma.nFT.findUnique({
                where: {
                  tokenId_contractAddress: {
                    tokenId: uniqueTokenId,
                    contractAddress
                  }
                }
              });

              const nftData = {
                tokenId: uniqueTokenId,
                contractAddress,
                name: newNftData.name || 'Unnamed',
                rarity: newNftData.rarity || 'Common',
                imageUrl: newNftData.image || '',
                description: newNftData.description || '',
                attack: gameStats.attack || 0,
                health: gameStats.health || 0,
                speed: gameStats.speed || 0,
                special: gameStats.special || '',
                metadata: Array.isArray(newNftData.attributes) ? 
                  newNftData.attributes.map(attr => ({
                    trait_type: String(attr.trait_type),
                    value: String(attr.value)
                  })) : {},
                ownerId: user.id
              };

              if (nftRecord) {
                // Update existing NFT
                nftRecord = await prisma.nFT.update({
                  where: {
                    id: nftRecord.id
                  },
                  data: {
                    ...nftData,
                    updatedAt: new Date()
                  }
                });
              } else {
                // Create new NFT
                nftRecord = await prisma.nFT.create({
                  data: nftData
                });
              }
              
              console.log(`✅ Successfully saved NFT: ${nftRecord.name}`);
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
  } finally {
    // Clean up database connection
    await prisma.$disconnect();
  }
}
