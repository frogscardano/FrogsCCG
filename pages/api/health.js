import { prisma, withDatabase } from '../utils/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🏥 Health check starting...');
    
    // Test basic Prisma client connectivity
    const result = await withDatabase(async (db) => {
      // Simple query to test connection
      const userCount = await db.user.count();
      const nftCount = await db.nFT.count();
      
      return {
        userCount,
        nftCount,
        timestamp: new Date().toISOString(),
        databaseConnected: true
      };
    });
    
    console.log('✅ Health check passed:', result);
    
    return res.status(200).json({
      status: 'healthy',
      database: result,
      prismaVersion: require('@prisma/client/package.json').version,
      nodeEnv: process.env.NODE_ENV,
      hasDbUrl: !!process.env.DATABASE_URL
    });
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      errorCode: error.code,
      prismaVersion: require('@prisma/client/package.json').version,
      nodeEnv: process.env.NODE_ENV,
      hasDbUrl: !!process.env.DATABASE_URL
    });
  }
} 
