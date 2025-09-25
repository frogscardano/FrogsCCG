import { prisma } from '../../../utils/db';

const DAILY_AMOUNT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { address } = req.body || {};
    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    let user = await prisma.user.findUnique({ where: { address } });
    if (!user) {
      user = await prisma.user.create({ data: { address } });
    }

    const now = new Date();
    // Backward-compatible: use lastUpdated as the daily-claim timestamp
    const last = user.lastDailyClaimAt ? new Date(user.lastDailyClaimAt) : (user.lastUpdated ? new Date(user.lastUpdated) : null);
    const nextAllowed = last ? new Date(last.getTime() + DAY_MS) : new Date(0);

    if (last && now < nextAllowed) {
      return res.status(429).json({
        message: 'Daily claim not available yet',
        nextClaimAt: nextAllowed.toISOString(),
        balance: user.balance ?? 0
      });
    }

    const currentBalance = typeof user.balance === 'string' ? parseInt(user.balance || '0', 10) : (user.balance ?? 0);
    const newBalance = currentBalance + DAILY_AMOUNT;
    const updated = await prisma.user.update({
      where: { address },
      data: {
        balance: String(newBalance),
        lastUpdated: now,
      },
      select: { balance: true, lastUpdated: true }
    });

    return res.status(200).json({
      success: true,
      balance: typeof updated.balance === 'string' ? parseInt(updated.balance || '0', 10) : (updated.balance ?? 0),
      lastDailyClaimAt: updated.lastUpdated ? new Date(updated.lastUpdated).toISOString() : null
    });
  } catch (error) {
    console.error('Error in packs/claim:', error);
    return res.status(500).json({ message: 'Failed to claim daily packs', error: error.message });
  }
}


