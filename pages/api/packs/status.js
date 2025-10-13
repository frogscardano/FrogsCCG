import { prisma } from '../../../utils/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ message: 'Address is required' });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { address },
      select: { balance: true, updatedAt: true }
    });

    if (!user) {
      // New user, can claim immediately
      return res.status(200).json({
        address,
        balance: 0,
        canClaim: true,
        nextClaimAt: null,
        lastDailyClaimAt: null
      });
    }

    const now = new Date();
    let canClaim = true;
    let nextClaimAt = null;

    if (user.updatedAt) {
      const lastUpdateDate = new Date(user.updatedAt);
      const nextAllowed = new Date(lastUpdateDate.getTime() + 24 * 60 * 60 * 1000);
      canClaim = now >= nextAllowed;
      if (!canClaim) {
        nextClaimAt = nextAllowed.toISOString();
      }
    }

    const balance = typeof user.balance === 'string' ? parseInt(user.balance || '0', 10) : (user.balance ?? 0);

    return res.status(200).json({
      address,
      balance,
      canClaim,
      nextClaimAt,
      lastDailyClaimAt: user.updatedAt ? user.updatedAt.toISOString() : null
    });
  } catch (error) {
    console.error('Error in packs/status:', error);
    
    return res.status(500).json({ 
      message: 'Failed to get pack status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
