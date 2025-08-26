import { prisma, withDatabase } from '../../utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Health check requested');
    
    // Test basic Prisma client
    const prismaStatus = {
      hasPrisma: !!prisma,
      hasTeam: !!(prisma && prisma.team),
      hasUser: !!(prisma && prisma.user),
      hasNFT: !!(prisma && prisma.nFT),
      prismaKeys: prisma ? Object.keys(prisma).filter(key => !key.startsWith('$')) : []
    };
    
    console.log('🔍 Prisma client status:', prismaStatus);
    
    // Test withDatabase wrapper
    let wrapperStatus = 'unknown';
    try {
      const result = await withDatabase(async (db) => {
        return {
          hasTeam: !!db.Team,
          hasUser: !!db.User,
          hasNFT: !!db.NFT,
          dbKeys: Object.keys(db).filter(key => !key.startsWith('$'))
        };
      });
      wrapperStatus = 'working';
      console.log('✅ withDatabase wrapper test successful:', result);
    } catch (error) {
      wrapperStatus = 'failed';
      console.error('❌ withDatabase wrapper test failed:', error.message);
    }
    
    // Test basic database operations
    let dbStatus = 'unknown';
    let userCount = 0;
    let teamCount = 0;
    let nftCount = 0;
    
    try {
      userCount = await prisma.user.count();
      teamCount = await prisma.team.count();
      nftCount = await prisma.nFT.count();
      dbStatus = 'connected';
      console.log('✅ Database operations successful');
    } catch (error) {
      dbStatus = 'failed';
      console.error('❌ Database operations failed:', error.message);
    }
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbStatus,
        url: process.env.DATABASE_URL ? 'configured' : 'missing',
        userCount,
        teamCount,
        nftCount
      },
      prisma: prismaStatus,
      wrapper: wrapperStatus,
      uptime: process.uptime()
    };
    
    // Determine overall status
    if (dbStatus === 'failed' || wrapperStatus === 'failed') {
      healthStatus.status = 'degraded';
    }
    
    if (dbStatus === 'failed' && wrapperStatus === 'failed') {
      healthStatus.status = 'down';
      return res.status(503).json(healthStatus);
    }
    
    console.log('✅ Health check completed successfully');
    return res.status(200).json(healthStatus);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    const errorStatus = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    
    return res.status(500).json(errorStatus);
  }
}
