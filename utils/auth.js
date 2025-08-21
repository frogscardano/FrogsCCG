import { prisma } from './db.js';

/**
 * Middleware to authenticate API requests using wallet address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next function
 */
export async function authenticateUser(req, res, next) {
  try {
    // Get wallet address from headers or query params
    const walletAddress = req.headers['x-wallet-address'] || req.query.walletAddress;
    
    if (!walletAddress) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Wallet address is required' 
      });
    }

    // Find or create user based on wallet address
    let user = await prisma.User.findUnique({
      where: { address: walletAddress }
    });

    if (!user) {
      // Create new user if they don't exist
      user = await prisma.User.create({
        data: {
          address: walletAddress,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // Attach user to request object
    req.user = user;
    req.walletAddress = walletAddress;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed', 
      message: error.message 
    });
  }
}

/**
 * Get user from request (must be called after authenticateUser middleware)
 * @param {Object} req - Express request object
 * @returns {Object} User object
 */
export function getUserFromRequest(req) {
  if (!req.user) {
    throw new Error('User not authenticated. Call authenticateUser middleware first.');
  }
  return req.user;
}

/**
 * Verify user owns a specific resource
 * @param {Object} req - Express request object
 * @param {string} resourceId - ID of the resource to check ownership
 * @param {string} resourceType - Type of resource ('team', 'nft', etc.)
 * @returns {boolean} True if user owns the resource
 */
export async function verifyOwnership(req, resourceId, resourceType) {
  const user = getUserFromRequest(req);
  
  switch (resourceType) {
    case 'team':
      const team = await prisma.Team.findUnique({
        where: { id: resourceId }
      });
      return team && team.ownerId === user.id;
      
    case 'nft':
      const nft = await prisma.NFT.findUnique({
        where: { id: resourceId }
      });
      return nft && nft.ownerId === user.id;
      
    default:
      return false;
  }
}
