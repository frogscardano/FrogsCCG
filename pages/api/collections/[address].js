import { PrismaClient } from '@prisma/client';
import { getFrogStats } from '../../../utils/frogData';

// Initialize PrismaClient
let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

// Game stats calculation function remains the same
function calculateGameStats(nftData) {
  // ... (keep existing implementation)
}

export default async function handler(req, res) {
  const { address } = req.query;
  
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Valid wallet address is required' });
  }

  const normalizedAddress = address.toLowerCase();

  try {
    // Use a transaction for all database operations
    const result = await prisma.$transaction(async (tx) => {
      // Find or create user using a raw query to avoid prepared statement issues
      const users = await tx.$queryRaw`
        INSERT INTO "User" (address, "createdAt", "updatedAt")
        VALUES (${normalizedAddress}, NOW(), NOW())
        ON CONFLICT (address) 
        DO UPDATE SET "updatedAt" = NOW()
        RETURNING *;
      `;
      
      const user = users[0];

      if (!user) {
        throw new Error('Failed to find or create user');
      }

      if (req.method === 'GET') {
        // Use parameterized query for NFTs to avoid type casting issues
        const nfts = await tx.$queryRaw`
          SELECT n.*
          FROM "NFT" n
          WHERE n."ownerId" = ${user.id}::text
          ORDER BY n."createdAt" DESC;
        `;

        return nfts.map(nft => ({
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
      }

      if (req.method === 'POST') {
        const newNftsData = Array.isArray(req.body) ? req.body : [];
        
        if (newNftsData.length === 0) {
          return [];
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
            const metadata = JSON.stringify(
              Array.isArray(nftData.attributes) 
                ? nftData.attributes.map(attr => ({
                    trait_type: String(attr.trait_type || ''),
                    value: String(attr.value || '')
                  }))
                : []
            );

            // Use raw query for NFT upsert
            const [nft] = await tx.$queryRaw`
              INSERT INTO "NFT" (
                "id",
                "tokenId",
                "contractAddress",
                "name",
                "rarity",
                "imageUrl",
                "description",
                "attack",
                "health",
                "speed",
                "special",
                "metadata",
                "ownerId",
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ${`${tokenId}_${contractAddress}`},
                ${tokenId},
                ${contractAddress},
                ${String(nftData.name || 'Unnamed')},
                ${String(nftData.rarity || 'Common')},
                ${String(nftData.image || '')},
                ${String(nftData.description || '')},
                ${gameStats.attack},
                ${gameStats.health},
                ${gameStats.speed},
                ${String(gameStats.special || '')},
                ${metadata}::jsonb,
                ${user.id},
                NOW(),
                NOW()
              )
              ON CONFLICT ("tokenId", "contractAddress")
              DO UPDATE SET
                "name" = EXCLUDED."name",
                "rarity" = EXCLUDED."rarity",
                "imageUrl" = EXCLUDED."imageUrl",
                "description" = EXCLUDED."description",
                "attack" = EXCLUDED."attack",
                "health" = EXCLUDED."health",
                "speed" = EXCLUDED."speed",
                "special" = EXCLUDED."special",
                "metadata" = EXCLUDED."metadata",
                "ownerId" = EXCLUDED."ownerId",
                "updatedAt" = NOW()
              RETURNING *;
            `;

            if (nft) {
              savedNfts.push(nft);
            }
          } catch (error) {
            console.error('Error processing NFT:', error);
            // Continue with other NFTs
          }
        }

        return savedNfts;
      }

      throw new Error(`Method ${req.method} Not Allowed`);
    });

    // Send response based on the transaction result
    return res.status(200).json(result);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}
