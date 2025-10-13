import { prisma } from '../../../utils/db';

const DAILY_AMOUNT = 10; // Changed from 5 to 10
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
      // New user, create and give 10 packs immediately
      user = await prisma.user.create({ 
        data: { 
          address, 
          balance: String(DAILY_AMOUNT)
        } 
      });
      return res.status(200).json({
        success: true,
        balance: DAILY_AMOUNT,
        lastDailyClaimAt: new Date().toISOString()
      });
    }

    const now = new Date();
    // Use updatedAt field which is what exists in the schema
    const last = user.updatedAt ? new Date(user.updatedAt) : null;
    
    // If no last claim time, allow claim immediately
    if (!last) {
      const currentBalance = typeof user.balance === 'string' ? parseInt(user.balance || '0', 10) : (user.balance ?? 0);
      const newBalance = currentBalance + DAILY_AMOUNT;
      const updated = await prisma.user.update({
        where: { address },
        data: {
          balance: String(newBalance),
          updatedAt: now,
        },
        select: { balance: true, updatedAt: true }
      });

      return res.status(200).json({
        success: true,
        balance: typeof updated.balance === 'string' ? parseInt(updated.balance || '0', 10) : (updated.balance ?? 0),
        lastDailyClaimAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : null
      });
    }

    // Check if 24 hours have passed
    const nextAllowed = new Date(last.getTime() + DAY_MS);

    if (now < nextAllowed) {
      const currentBalance = typeof user.balance === 'string' ? parseInt(user.balance || '0', 10) : (user.balance ?? 0);
      return res.status(429).json({
        message: 'Daily claim not available yet',
        nextClaimAt: nextAllowed.toISOString(),
        balance: currentBalance,
        hoursRemaining: Math.ceil((nextAllowed - now) / (60 * 60 * 1000))
      });
    }

    // Allow claim
    const currentBalance = typeof user.balance === 'string' ? parseInt(user.balance || '0', 10) : (user.balance ?? 0);
    const newBalance = currentBalance + DAILY_AMOUNT;
    const updated = await prisma.user.update({
      where: { address },
      data: {
        balance: String(newBalance),
        updatedAt: now,
      },
      select: { balance: true, updatedAt: true }
    });

    return res.status(200).json({
      success: true,
      balance: typeof updated.balance === 'string' ? parseInt(updated.balance || '0', 10) : (updated.balance ?? 0),
      lastDailyClaimAt: updated.updatedAt ? new Date(updated.updatedAt).toISOString() : null
    });
  } catch (error) {
    console.error('Error in packs/claim:', error);
    return res.status(500).json({ message: 'Failed to claim daily packs', error: error.message });
  }
}
