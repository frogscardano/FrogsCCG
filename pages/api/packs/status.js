import { withDatabase, getUserBalance } from '../../../utils/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({ message: 'Address is required' });
  }

  try {
    const result = await withDatabase(async () => {
      return await getUserBalance(address);
    });

    const now = new Date();
    let canClaim = true;
    let nextClaimAt = now;

    if (result.lastDailyClaimAt) {
      const lastClaimDate = new Date(result.lastDailyClaimAt);
      nextClaimAt = new Date(lastClaimDate.getTime() + 24 * 60 * 60 * 1000);
      canClaim = now >= nextClaimAt;
    }

    return res.status(200).json({
      address,
      balance: result.balance,
      canClaim,
      nextClaimAt: nextClaimAt.toISOString(),
      lastDailyClaimAt: result.lastDailyClaimAt ? new Date(result.lastDailyClaimAt).toISOString() : null
    });
  } catch (error) {
    console.error('Error in packs/status:', error);
    
    const isConnectionError = 
      error.code === 'P1001' ||
      error.code === 'P1008' ||
      error.code === 'P1017' ||
      error.message?.includes('connect') || 
      error.message?.includes('timeout');
    
    return res.status(isConnectionError ? 503 : 500).json({ 
      message: isConnectionError ? 'Database temporarily unavailable' : 'Failed to get pack status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
