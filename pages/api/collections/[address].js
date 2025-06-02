import { PrismaClient } from '@prisma/client';
import { getFrogStats } from '../../../utils/frogData';

// Single PrismaClient instance
const prisma = new PrismaClient();

function calculateGameStats(nftData) {
  // ... keep existing implementation
}

export default async function handler(req, res) {
  const { address } = req.query;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Valid wallet address is required' });
  }

  const normalizedAddress = address.toLowerCase();

  try {
    // First get or create the user
    const user = await prisma.user.upsert({
      where: {
        address: normalizedAddress
      },
      update: {},
      create: {
        id: `user_${Date.now()}`,
        address: normalizedAddress
      }
    });

    if (req.method === 'GET') {
      const nfts = await prisma.nFT.findMany({
        where: {
          ownerId: user.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const processedNfts = nfts.map(nft => ({
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
            return [
              { trait_type: "Collection", value: "Unknown" },
              { trait_type: "Number", value: nft.tokenId },
              { trait_type: "Policy ID", value: nft.contractAddress }
            ];
          }
        })(),
        image: nft.imageUrl || ""
      }));

      return res.status(200).json(processedNfts);
    }

    if (req.method === 'POST') {
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
          const metadata = Array.isArray(nftData.attributes) 
            ? nftData.attributes.map(attr => ({
                trait_type: String(attr.trait_type || ''),
                value: String(attr.value || '')
              }))
            : [];

          const nft = await prisma.nFT.upsert({
            where: {
              tokenId_contractAddress: {
                tokenId,
                contractAddress
              }
            },
            update: {
              name: String(nftData.name || 'Unnamed'),
              rarity: String(nftData.rarity || 'Common'),
              imageUrl: String(nftData.image || ''),
              description: String(nftData.description || ''),
              attack: gameStats.attack,
              health: gameStats.health,
              speed: gameStats.speed,
              special: String(gameStats.special || ''),
              metadata: metadata,
              ownerId: user.id
            },
            create: {
              id: `nft_${tokenId}_${contractAddress}_${Date.now()}`,
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
              metadata: metadata,
              ownerId: user.id
            }
          });

          savedNfts.push(nft);
        } catch (error) {
          console.error('Error processing NFT:', error);
          // Continue with other NFTs
        }
      }

      return res.status(200).json(savedNfts);
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}
