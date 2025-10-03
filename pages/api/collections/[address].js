import { addCardToUserCollection, prisma } from '../../../utils/db';
import { resolveIpfsUrl } from '../../../utils/ipfs';

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatNftRecord(nft) {
  const metadata = typeof nft.metadata === 'string' ? safeJsonParse(nft.metadata) : nft.metadata || {};
  const imageCandidate = nft.imageUrl || metadata?.image || metadata?.image_url || metadata?.thumbnail;
  const normalizedImage = resolveIpfsUrl(imageCandidate) || imageCandidate || null;

  return {
    id: nft.id,
    tokenId: nft.tokenId,
    contractAddress: nft.contractAddress,
    name: nft.name || metadata?.name || 'Unknown',
    description: nft.description || metadata?.description || '',
    image: normalizedImage,
    imageUrl: normalizedImage, // keep both for compatibility
    rarity: nft.rarity || metadata?.rarity || 'Common',
    attack: nft.attack ?? metadata?.attack ?? 1,
    health: nft.health ?? metadata?.health ?? 1,
    speed: nft.speed ?? metadata?.speed ?? 1,
    special: nft.special ?? metadata?.special ?? null,
    attributes: Array.isArray(metadata?.attributes) ? metadata.attributes : [],
    metadata: metadata || null,
  };
}

async function getNftsForAddress(address) {
  const user = await prisma.user.findUnique({ where: { address }, include: { NFT: true } });
  return user?.NFT || [];
}

export default async function handler(req, res) {
  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid address' });
  }

  try {
    if (req.method === 'GET') {
      const nfts = await getNftsForAddress(address);
      const collection = (nfts || []).map(formatNftRecord);
      return res.status(200).json({ success: true, message: `Loaded ${collection.length} NFTs`, collection });
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid JSON body' });
      }

      const cards = Array.isArray(body) ? body : [body];

      for (const card of cards) {
        const tokenId = card.tokenId || card.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const contractAddress = card.contractAddress || 'demo-collection';
        const metadata = card.metadata || {
          name: card.name,
          description: card.description,
          image: card.image || card.imageUrl,
          rarity: card.rarity,
          attack: card.attack,
          health: card.health,
          speed: card.speed,
          attributes: card.attributes || []
        };
        await addCardToUserCollection(address, tokenId, contractAddress, metadata);
      }

      const updated = await getNftsForAddress(address);
      const collection = (updated || []).map(formatNftRecord);
      return res.status(200).json({ success: true, message: 'Collection updated', collection });
    }

    if (req.method === 'DELETE') {
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid JSON body' });
      }

      const { cardId } = body || {};
      if (!cardId) {
        return res.status(400).json({ success: false, message: 'cardId is required' });
      }

      const user = await prisma.user.findUnique({ where: { address } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const nft = await prisma.nFT.findUnique({ where: { id: cardId } });
      if (!nft) {
        return res.status(404).json({ success: false, message: 'NFT not found' });
      }
      if (nft.ownerId !== user.id) {
        return res.status(403).json({ success: false, message: 'NFT does not belong to this user' });
      }

      await prisma.nFT.delete({ where: { id: cardId } });

      const updated = await getNftsForAddress(address);
      const collection = (updated || []).map(formatNftRecord);
      return res.status(200).json({ success: true, message: 'Card deleted', collection });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  } catch (error) {
    console.error('collections/[address] handler error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
}
