import { withDatabase, getHoskyPoopmeter } from '../../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const walletAddress = req.query.walletAddress;
    
    if (!walletAddress) {
      return res.status(400).json({ message: 'Wallet address is required' });
    }

    const poopScore = await withDatabase(async () => {
      return await getHoskyPoopmeter(walletAddress);
    });
    
    return res.status(200).json({ poopScore });
    
  } catch (error) {
    console.error('Error getting Hosky Poopmeter:', error);
    res.status(500).json({ message: 'Error getting Hosky Poopmeter', error: error.message });
  }
}
