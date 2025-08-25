import { prisma, withDatabase, globalForPrisma } from './db.js';
import { PrismaClient } from '@prisma/client';

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

    // Use withDatabase wrapper to handle connection issues
    const user = await withDatabase(async (db) => {
      try {
        // Find or create user based on wallet address
        let user = await db.User.findUnique({
          where: { address: walletAddress }
        });

        if (!user) {
          // Create new user if they don't exist
          user = await db.User.create({
            data: {
              address: walletAddress,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }

        return user;
      } catch (dbError) {
        console.error('Database error during authentication:', dbError);
        
        // If it's a prepared statement error, try to reconnect
        if (dbError.message.includes('prepared statement') || 
            dbError.message.includes('already exists')) {
          console.log('🔄 Prepared statement error detected, attempting to reconnect...');
          
          // Force disconnect and reconnect
          try {
            // Disconnect the current client
            if (globalForPrisma.prisma) {
              await globalForPrisma.prisma.$disconnect();
            }
            
            // Create a new Prisma client
            globalForPrisma.prisma = new PrismaClient({
              log: ['query', 'info', 'warn', 'error'],
              errorFormat: 'pretty',
            });
            
            // Try the operation again with the new connection
            let user = await globalForPrisma.prisma.user.findUnique({
              where: { address: walletAddress }
            });

            if (!user) {
              user = await globalForPrisma.prisma.user.create({
                data: {
                  address: walletAddress,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              });
            }
            
            return user;
          } catch (reconnectError) {
            console.error('Failed to reconnect:', reconnectError);
            throw new Error('Database connection failed after reconnection attempt');
          }
        }
        
        throw dbError;
      }
    });

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
  
  try {
    return await withDatabase(async (db) => {
      switch (resourceType) {
        case 'team':
          const team = await db.Team.findUnique({
            where: { id: resourceId }
          });
          return team && team.ownerId === user.id;
          
        case 'nft':
          const nft = await db.NFT.findUnique({
            where: { id: resourceId }
          });
          return nft && nft.ownerId === user.id;
          
        default:
          return false;
      }
    });
  } catch (error) {
    console.error('Error verifying ownership:', error);
    return false;
  }
}
