import { prisma } from '../../../utils/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    // Ensure user exists
    let user = await prisma.user.findUnique({ where: { address } });
    if (!user) {
      user = await prisma.user.create({ data: { address } });
    }

    const balance = user.balance ?? 0;
    const last = user.lastDailyClaimAt ? new Date(user.lastDailyClaimAt) : null;
    const now = new Date();
    const nextClaimAt = last ? new Date(last.getTime() + 24 * 60 * 60 * 1000) : new Date(0);
    const canClaim = last === null || now >= nextClaimAt;

    return res.status(200).json({
      address,
      balance,
      canClaim,
      nextClaimAt: nextClaimAt.toISOString(),
      lastDailyClaimAt: last ? last.toISOString() : null
    });
  } catch (error) {
    console.error('Error in packs/status:', error);
    return res.status(500).json({ message: 'Failed to get pack status', error: error.message });
  }
}


