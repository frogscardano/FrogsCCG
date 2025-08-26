import { prisma, withDatabase } from '../../../utils/db.js';
import { v4 as uuid4 } from 'uuid';

// Helper function to generate team ID
const generateTeamId = (name, ownerId) => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `team_${timestamp}_${randomStr}`;
};

// Function to validate team data
function validateTeamData(teamData) {
  if (!teamData.name || !teamData.nftIds || !Array.isArray(teamData.nftIds)) {
    return {
      isValid: false,
      error: 'Team must have a name and an array of NFT IDs'
    };
  }

  if (teamData.name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Team name cannot be empty'
    };
  }

  if (teamData.nftIds.length === 0) {
    return {
      isValid: false,
      error: 'Team must have at least one NFT'
    };
  }

  if (teamData.nftIds.length > 5) {
    return {
      isValid: false,
      error: 'Team cannot have more than 5 NFTs'
    };
  }

  return { isValid: true };
}

export default async function handler(req, res) {
  const { address } = req.query;
  
  console.log(`🔍 Teams API called with address: ${address}, method: ${req.method}`);
  
  // Validate and clean the wallet address
  let cleanAddress = address;
  if (address) {
    // Basic validation - check format and length
    if (!address.startsWith('addr1') && !address.startsWith('stake1')) {
      console.error(`❌ Invalid wallet address format: ${address}`);
      return res.status(400).json({ 
        error: 'Invalid wallet address format',
        receivedAddress: address,
        message: 'Wallet address must start with addr1 or stake1'
      });
    }
    
    // Check for reasonable length (Cardano addresses are typically 100-120 chars)
    if (address.length < 100 || address.length > 120) {
      console.error(`❌ Wallet address length is suspicious: ${address.length} characters`);
      return res.status(400).json({ 
        error: 'Wallet address length is suspicious',
        receivedAddress: address,
        receivedLength: address.length,
        message: 'Expected 100-120 characters for Cardano addresses'
      });
    }
    
    cleanAddress = address;
    console.log(`🔍 Validated wallet address: ${cleanAddress} (length: ${cleanAddress.length})`);
  }
  
  if (!prisma) {
    console.error('❌ Prisma client is completely undefined');
    return res.status(500).json({ error: 'Database client not initialized' });
  }
  
  if (!prisma.User) {
    console.error('❌ Prisma.User is undefined');
    console.log('Available Prisma methods:', Object.keys(prisma));
    return res.status(500).json({ error: 'Database user model not available' });
  }

  if (!cleanAddress) {
    console.log('❌ No address provided');
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    console.log(`🔄 Attempting to upsert user with address: ${cleanAddress}`);
    
    const user = await withDatabase(async (db) => {
      try {
        // First try to find existing user
        const existingUser = await db.User.findUnique({
          where: { address: cleanAddress }
        });

        if (existingUser) {
          console.log(`🔄 Updating existing user: ${existingUser.id}`);
          // Update existing user
          return await db.User.update({
            where: { address: cleanAddress },
            data: {
              updatedAt: new Date(),
            }
          });
        } else {
          console.log(`🆕 Creating new user for address: ${cleanAddress}`);
          // Create new user
          return await db.User.create({
            data: {
              id: uuid4(),
              address: cleanAddress,
            }
          });
        }
      } catch (userError) {
        console.error(`❌ User operation failed for address ${cleanAddress}:`, userError);
        throw userError;
      }
    });
    
    console.log(`✅ User found/created: ${user.id} for address: ${user.address}`);

    switch (req.method) {
      case 'GET':
        try {
          console.log(`🔍 Fetching teams for user ID: ${user.id}`);
          
          // Use withDatabase wrapper for consistency
          const userTeams = await withDatabase(async (db) => {
            return await db.Team.findMany({
              where: { ownerId: user.id },
              orderBy: { updatedAt: 'desc' }
            });
          });
          
          console.log(`📊 Found ${userTeams.length} teams for user ID: ${user.id}`);
          
          if (userTeams.length === 0) {
            console.log(`ℹ️ User ${user.id} has no teams yet. This is normal for new users.`);
          }
          
          // For each team, fetch the associated NFTs
          const teamsWithNFTs = await Promise.all(
            userTeams.map(async (team) => {
              if (team.nftIds && team.nftIds.length > 0) {
                const nfts = await withDatabase(async (db) => {
                  return await db.NFT.findMany({
                    where: { 
                      id: { in: team.nftIds }
                    }
                  });
                });
                
                console.log(`✅ Team ${team.name} has ${nfts.length} NFTs`);
                
                return {
                  ...team,
                  cards: nfts
                };
              } else {
                console.log(`ℹ️ Team ${team.name} has no NFTs`);
                return {
                  ...team,
                  cards: []
                };
              }
            })
          );
          
          console.log(`✅ Returning teams with ${teamsWithNFTs.length} items`);
          
          // Add helpful metadata to the response
          const responseData = {
            teams: teamsWithNFTs,
            userInfo: {
              id: user.id,
              address: user.address,
              hasTeams: teamsWithNFTs.length > 0
            },
            message: teamsWithNFTs.length > 0 
              ? `Found ${teamsWithNFTs.length} teams` 
              : "You have no teams yet. Create your first team to get started!"
          };
          
          return res.status(200).json(responseData);
        } catch (error) {
          console.error('❌ Error fetching teams:', error);
          
          // Check if it's a database connection issue
          if (error.message.includes('prepared statement') || 
              error.message.includes('already exists') ||
              error.message.includes('Database wrapper is not properly configured')) {
            console.log('🔄 Database connection issue detected, returning empty teams list');
            return res.status(200).json({
              teams: [],
              userInfo: {
                id: user.id,
                address: user.address,
                hasTeams: false
              },
              message: "Database temporarily unavailable. Please try again in a moment."
            });
          }
          
          return res.status(500).json({ error: 'Failed to fetch teams' });
        }

      case 'POST':
        try {
          const newTeamsData = req.body;
          console.log(`📥 Received POST data for ${newTeamsData?.length || 0} teams`);
          console.log(`📥 POST data structure:`, JSON.stringify(newTeamsData, null, 2));
          
          if (!Array.isArray(newTeamsData)) {
            // Handle single team from direct API call
            newTeamsData = [newTeamsData];
            console.log(`📥 Converted single team to array`);
          }
          
          if (newTeamsData.length === 0) {
            console.log('❌ Invalid or empty team data');
            return res.status(400).json({ error: 'Invalid or empty team data' });
          }

          // Validate the data structure
          for (const teamData of newTeamsData) {
            const validation = validateTeamData(teamData);
            if (!validation.isValid) {
              console.error(`❌ Invalid team data structure:`, teamData);
              return res.status(400).json({ 
                error: 'Invalid team data structure', 
                details: validation.error,
                receivedData: teamData
              });
            }
          }

          const savedTeams = [];

          for (const newTeamData of newTeamsData) {
            try {
              console.log(`🔄 Processing team data:`, JSON.stringify(newTeamData, null, 2));
              
              // Validate that all NFTs belong to the user
              const userNfts = await withDatabase(async (db) => {
                return await db.NFT.findMany({
                  where: { 
                    id: { in: newTeamData.nftIds },
                    ownerId: user.id
                  }
                });
              });

              console.log(`🔍 Found user NFTs: ${userNfts.length} out of ${newTeamData.nftIds.length}`);

              if (userNfts.length !== newTeamData.nftIds.length) {
                console.error(`❌ Some NFTs do not belong to user:`, { 
                  requested: newTeamData.nftIds.length, 
                  found: userNfts.length,
                  userNftIds: userNfts.map(nft => nft.id),
                  requestedIds: newTeamData.nftIds
                });
                throw new Error('Some NFTs do not belong to the user');
              }

              // Create standardized team data for upserting
              const teamDataForUpsert = {
                name: String(newTeamData.name || '').trim(),
                nftIds: newTeamData.nftIds,
                ownerId: String(user.id),
                isActive: Boolean(newTeamData.isActive !== false), // Default to true
                battlesWon: parseInt(newTeamData.battlesWon) || 0,
                battlesLost: parseInt(newTeamData.battlesLost) || 0
              };

              // Validate that ownerId is not truncated
              console.log(`🔍 Team data validation:`, {
                userFullId: user.id,
                userFullIdLength: user.id.length,
                ownerIdToSave: teamDataForUpsert.ownerId,
                ownerIdLength: teamDataForUpsert.ownerId.length,
                isTruncated: teamDataForUpsert.ownerId !== user.id,
                name: teamDataForUpsert.name,
                nftCount: teamDataForUpsert.nftIds.length
              });

              if (teamDataForUpsert.ownerId !== user.id) {
                console.error(`❌ CRITICAL ERROR: ownerId is truncated! Expected: ${user.id}, Got: ${teamDataForUpsert.ownerId}`);
                throw new Error(`OwnerId truncation detected: ${teamDataForUpsert.ownerId} vs ${user.id}`);
              }

              // Direct Prisma usage without wrapper
              let teamRecord;
              try {
                // Check if team with same name already exists for this user
                const existingTeam = await withDatabase(async (db) => {
                  return await db.Team.findFirst({
                    where: {
                      name: teamDataForUpsert.name,
                      ownerId: teamDataForUpsert.ownerId
                    }
                  });
                });

                if (existingTeam) {
                  console.log(`🔄 Updating existing team: ${existingTeam.name} (ID: ${existingTeam.id})`);
                  // Update existing team
                  teamRecord = await withDatabase(async (db) => {
                    return await db.Team.update({
                      where: { id: existingTeam.id },
                      data: { 
                        nftIds: teamDataForUpsert.nftIds,
                        isActive: teamDataForUpsert.isActive,
                        battlesWon: teamDataForUpsert.battlesWon,
                        battlesLost: teamDataForUpsert.battlesLost,
                        updatedAt: new Date() 
                      }
                    });
                  });
                } else {
                  console.log(`🆕 Creating new team: ${teamDataForUpsert.name}`);
                  // Create new team
                  teamRecord = await withDatabase(async (db) => {
                    return await db.Team.create({
                      data: {
                        ...teamDataForUpsert,
                        id: generateTeamId(teamDataForUpsert.name, teamDataForUpsert.ownerId),
                      }
                    });
                  });
                }
              } catch (dbError) {
                console.error(`❌ Database operation failed for team ${teamDataForUpsert.name}:`, dbError);
                console.error(`❌ Database error details:`, {
                  message: dbError.message,
                  code: dbError.code,
                  meta: dbError.meta,
                  teamData: teamDataForUpsert
                });
                throw dbError;
              }
              
              // Verify the saved team has the correct ownerId
              console.log(`🔍 Saved team verification:`, {
                savedOwnerId: teamRecord.ownerId,
                expectedOwnerId: user.id,
                isCorrect: teamRecord.ownerId === user.id,
                savedOwnerIdLength: teamRecord.ownerId.length,
                expectedOwnerIdLength: user.id.length
              });
              
              if (teamRecord.ownerId !== user.id) {
                console.error(`❌ CRITICAL ERROR: Saved team has wrong ownerId! Expected: ${user.id}, Got: ${teamRecord.ownerId}`);
                // Try to fix it immediately
                try {
                  await withDatabase(async (db) => {
                    return await db.Team.update({
                      where: { id: teamRecord.id },
                      data: { 
                        ownerId: user.id,
                        updatedAt: new Date()
                      }
                    });
                  });
                  console.log(`✅ Fixed team ownerId after save from "${teamRecord.ownerId}" to "${user.id}"`);
                } catch (fixError) {
                  console.error(`❌ Failed to fix team ownerId:`, fixError);
                }
              }
              
              // Return team with NFTs in the expected format
              const teamWithNFTs = {
                ...teamRecord,
                cards: userNfts
              };
              
              console.log(`✅ Successfully upserted team: ${teamRecord.name} with ${userNfts.length} NFTs`);
              savedTeams.push(teamWithNFTs);
            } catch (teamError) {
              console.error(`❌ Failed to process team:`, teamError);
              console.error(`❌ Team data that failed:`, JSON.stringify(newTeamData, null, 2));
              // Continue with next team instead of failing completely
              continue;
            }
          }
          
          console.log(`✅ POST complete. Successfully saved ${savedTeams.length} teams`);
          return res.status(200).json(savedTeams);
        } catch (error) {
          console.error('❌ Error adding teams:', error);
          return res.status(500).json({ error: `Failed to add teams: ${error.message}` });
        }

      case 'PUT':
        try {
          const { id, name, nftIds } = req.body;
          
          if (!id || !name || !nftIds || !Array.isArray(nftIds)) {
            return res.status(400).json({ error: 'Invalid team data' });
          }

          // Direct Prisma usage without wrapper
          const updatedTeam = await withDatabase(async (db) => {
            return await db.Team.findFirst({
              where: {
                id: id,
                ownerId: user.id
              }
            });
          });

          if (!updatedTeam) {
            throw new Error('Team not found or does not belong to user');
          }

          // Verify that all NFTs belong to the user
          const userNfts = await withDatabase(async (db) => {
            return await db.NFT.findMany({
              where: { 
                id: { in: nftIds },
                ownerId: user.id
              }
            });
          });

          if (userNfts.length !== nftIds.length) {
            throw new Error('Some NFTs do not belong to the user');
          }

          // Update the team
          const updated = await withDatabase(async (db) => {
            return await db.Team.update({
              where: { id: id },
              data: {
                name: name,
                nftIds: nftIds,
                updatedAt: new Date()
              }
            });
          });

          // Return team with NFTs in the expected format
          const result = {
            ...updated,
            cards: userNfts
          };

          console.log(`✅ Team updated successfully: ${updated.name}`);
          return res.status(200).json(result);
        } catch (error) {
          console.error('❌ Error updating team:', error);
          if (error.message === 'Team not found or does not belong to user') {
            return res.status(403).json({ error: error.message });
          }
          if (error.message === 'Some NFTs do not belong to the user') {
            return res.status(400).json({ error: error.message });
          }
          return res.status(500).json({ error: 'Failed to update team', details: error.message });
        }

      case 'DELETE':
        try {
          const { id } = req.body;
          
          if (!id) {
            return res.status(400).json({ error: 'Team ID is required' });
          }

          // Direct Prisma usage without wrapper
          const team = await withDatabase(async (db) => {
            return await db.Team.findFirst({
              where: {
                id: id,
                ownerId: user.id
              }
            });
          });

          if (!team) {
            throw new Error('Team not found or does not belong to user');
          }

          // Delete the team
          await withDatabase(async (db) => {
            return await db.Team.delete({
              where: { id: id }
            });
          });

          console.log(`✅ Team deleted successfully: ${id}`);
          return res.status(200).json({ message: 'Team deleted successfully' });
        } catch (error) {
          console.error('❌ Error deleting team:', error);
          if (error.message === 'Team not found or does not belong to user') {
            return res.status(403).json({ error: error.message });
          }
          return res.status(500).json({ error: 'Failed to delete team', details: error.message });
        }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (e) {
    console.error('❌ Error processing user or team data:', e);
    
    // Check if it's a database connection issue
    if (e.message.includes('prepared statement') || 
        e.message.includes('already exists') ||
        e.message.includes('Database wrapper is not properly configured')) {
      console.log('🔄 Database connection issue detected, returning service unavailable');
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        message: 'Database connection issue detected. Please try again in a moment.',
        retryAfter: 5
      });
    }
    
    return res.status(500).json({ error: `Failed to process request: ${e.message}` });
  }
}
