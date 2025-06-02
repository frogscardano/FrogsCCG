import { PrismaClient } from '@prisma/client';
import { getFrogStats } from '../../../utils/frogData';

// Create a single PrismaClient instance and reuse it
const prisma = new PrismaClient();

// Moving the calculateGameStats function to the top level
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
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Valid wallet address is required' });
  }

  try {
    // First, find the user
    let user = await prisma.user.findUnique({
      where: { 
        address: address.toLowerCase() // normalize address
      }
    });

    // If user doesn't exist, create them
    if (!user) {
      user = await prisma.user.create({
        data: {
          address: address.toLowerCase(),
          updatedAt: new Date()
        }
      });
    }

    switch (req.method) {
      case 'GET':
        try {
          // Use raw query to avoid binary data format issues
          const userNfts = await prisma.$queryRaw`
            SELECT 
              id, 
              "tokenId",
              "contractAddress",
              name,
              rarity,
              "imageUrl",
              description,
              attack,
              health,
              speed,
              special,
              metadata,
              "createdAt",
              "updatedAt"
            FROM "NFT"
            WHERE "ownerId" = ${user.id}
            ORDER BY "createdAt" DESC
          `;
          
          const collection = userNfts.map(nft => ({
            ...nft,
            attributes: (() => {
              try {
                if (typeof nft.metadata === 'string') {
                  return JSON.parse(nft.metadata);
                }
                return nft.metadata || [
                  { trait_type: "Collection", value: "Unknown" },
                  { trait_type: "Number", value: nft.tokenId },
                  { trait_type: "Policy ID", value: nft.contractAddress }
                ];
              } catch (e) {
                console.warn(`Failed to parse metadata for NFT ${nft.id}`);
                return [
                  { trait_type: "Collection", value: "Unknown" },
                  { trait_type: "Number", value: nft.tokenId },
                  { trait_type: "Policy ID", value: nft.contractAddress }
                ];
              }
            })(),
            image: nft.imageUrl || ""
          }));
          
          return res.status(200).json(collection);
        } catch (error) {
          console.error('Error fetching collection:', error);
          return res.status(500).json({ error: 'Failed to fetch collection' });
        }

      case 'POST':
        try {
          const newNftsData = Array.isArray(req.body) ? req.body : [];
          
          if (newNftsData.length === 0) {
            return res.status(400).json({ error: 'No NFT data provided' });
          }

          const savedNfts = [];

          for (const nftData of newNftsData) {
            try {
              const tokenId = String(
                nftData.attributes?.find(attr => attr.trait_type === "Asset Name")?.value ||
                nftData.asset_name ||
                nftData.name ||
                `NFT-${Date.now()}`
              );

              const contractAddress = String(
                nftData.policyId ||
                nftData.attributes?.find(attr => attr.trait_type === "Policy ID")?.value ||
                'default'
              );

              const gameStats = calculateGameStats(nftData);

              // Prepare metadata
              const metadata = Array.isArray(nftData.attributes) 
                ? nftData.attributes.map(attr => ({
                    trait_type: String(attr.trait_type || ''),
                    value: String(attr.value || '')
                  }))
                : [];

              // Use transaction to ensure data consistency
              const nft = await prisma.$transaction(async (tx) => {
                const existing = await tx.nFT.findUnique({
                  where: {
                    tokenId_contractAddress: {
                      tokenId,
                      contractAddress
                    }
                  }
                });

                if (existing) {
                  return tx.nFT.update({
                    where: { id: existing.id },
                    data: {
                      name: String(nftData.name || 'Unnamed'),
                      rarity: String(nftData.rarity || 'Common'),
                      imageUrl: String(nftData.image || ''),
                      description: String(nftData.description || ''),
                      attack: gameStats.attack,
                      health: gameStats.health,
                      speed: gameStats.speed,
                      special: String(gameStats.special || ''),
                      metadata,
                      ownerId: user.id,
                      updatedAt: new Date()
                    }
                  });
                }

                return tx.nFT.create({
                  data: {
                    tokenId,
                    contractAddress,
                    name: String(nftData.name || 'Unnamed'),
                    rarity: String(nftData.rarity || 'Common'),
                    imageUrl: String(nftData.image || ''),
                    description: String(nftData.description || ''),
                    attack: gameStats.attack,
                    health: gameStats.health,
                    speed: gameStats.speed,
                    special: String(gameStats.special || ''),
                    metadata,
                    ownerId: user.id
                  }
                });
              });

              savedNfts.push(nft);
            } catch (error) {
              console.error('Error processing NFT:', error);
              // Continue with other NFTs
            }
          }

          return res.status(200).json(savedNfts);
        } catch (error) {
          console.error('Error saving NFTs:', error);
          return res.status(500).json({ error: 'Failed to save NFTs' });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}
