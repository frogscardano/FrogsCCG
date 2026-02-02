import { prisma, withDatabase } from '../../utils/db.js';
import { calculateNewRatings } from '../../utils/elo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { teamA, teamB, teamAId, teamBId } = req.body;

    if (!teamA || !teamB || !Array.isArray(teamA) || !Array.isArray(teamB)) {
      return res.status(400).json({ error: 'Invalid team data' });
    }

    console.log(`⚔️ Battle starting between Team A (${teamA.length} cards) and Team B (${teamB.length} cards)`);
    console.log(`Team IDs: ${teamAId} vs ${teamBId}`);

    // Card-by-card battle simulation with individual attacks
    const simulateBattle = (teamA, teamB) => {
      const battleLog = [];
      
      // Initialize cards with health
      const teamACards = teamA.map(card => ({
        ...card,
        currentHealth: card.health || 10,
        maxHealth: card.health || 10,
        isAlive: true
      }));
      
      const teamBCards = teamB.map(card => ({
        ...card,
        currentHealth: card.health || 10,
        maxHealth: card.health || 10,
        isAlive: true
      }));

      battleLog.push({
        type: 'start',
        message: '⚔️ Battle started!',
        teamA: teamACards.map(c => ({ name: c.name, health: c.currentHealth })),
        teamB: teamBCards.map(c => ({ name: c.name, health: c.currentHealth }))
      });

      let round = 1;
      const maxRounds = 50;

      while (round <= maxRounds) {
        const aliveTeamA = teamACards.filter(c => c.isAlive);
        const aliveTeamB = teamBCards.filter(c => c.isAlive);

        if (aliveTeamA.length === 0 || aliveTeamB.length === 0) {
          break;
        }

        battleLog.push({
          type: 'round_start',
          round,
          message: `--- Round ${round} ---`,
          aliveTeamA: aliveTeamA.length,
          aliveTeamB: aliveTeamB.length
        });

        // Sort by speed for turn order (higher speed goes first)
        const allCards = [
          ...aliveTeamA.map(c => ({ ...c, team: 'A' })),
          ...aliveTeamB.map(c => ({ ...c, team: 'B' }))
        ].sort((a, b) => (b.speed || 1) - (a.speed || 1));

        // Each card attacks
        for (const attacker of allCards) {
          if (!attacker.isAlive) continue;

          const enemyTeam = attacker.team === 'A' ? teamBCards : teamACards;
          const aliveEnemies = enemyTeam.filter(c => c.isAlive);

          if (aliveEnemies.length === 0) break;

          // Pick random alive enemy
          const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
          
          // Calculate damage with variance (80-120% of attack)
          const baseDamage = attacker.attack || 1;
          const variance = 0.8 + (Math.random() * 0.4);
          const damage = Math.round(baseDamage * variance);
          
          target.currentHealth -= damage;
          
          const targetDied = target.currentHealth <= 0;
          if (targetDied) {
            target.isAlive = false;
            target.currentHealth = 0;
          }

          battleLog.push({
            type: 'attack',
            round,
            attacker: {
              name: attacker.name,
              team: attacker.team,
              image: attacker.image || attacker.imageUrl
            },
            target: {
              name: target.name,
              team: target.team === 'A' ? 'B' : 'A',
              image: target.image || target.imageUrl
            },
            damage,
            targetHealth: Math.max(0, target.currentHealth),
            targetMaxHealth: target.maxHealth,
            died: targetDied,
            message: `${attacker.name} attacks ${target.name} for ${damage} damage!${targetDied ? ' 💀 DEFEATED!' : ''}`
          });

          // Check if battle is over
          const stillAliveA = teamACards.filter(c => c.isAlive).length;
          const stillAliveB = teamBCards.filter(c => c.isAlive).length;
          
          if (stillAliveA === 0 || stillAliveB === 0) {
            break;
          }
        }

        round++;
      }

      // Determine winner
      const finalAliveA = teamACards.filter(c => c.isAlive).length;
      const finalAliveB = teamBCards.filter(c => c.isAlive).length;
      
      let winner;
      if (finalAliveA > finalAliveB) {
        winner = 'A';
      } else if (finalAliveB > finalAliveA) {
        winner = 'B';
      } else {
        // Tie - go by remaining total health
        const totalHealthA = teamACards.reduce((sum, c) => sum + c.currentHealth, 0);
        const totalHealthB = teamBCards.reduce((sum, c) => sum + c.currentHealth, 0);
        winner = totalHealthA >= totalHealthB ? 'A' : 'B';
      }

      battleLog.push({
        type: 'end',
        winner,
        message: `🏆 Team ${winner} wins the battle!`,
        finalAliveA,
        finalAliveB,
        teamACards: teamACards.map(c => ({ 
          name: c.name, 
          health: c.currentHealth, 
          alive: c.isAlive 
        })),
        teamBCards: teamBCards.map(c => ({ 
          name: c.name, 
          health: c.currentHealth, 
          alive: c.isAlive 
        }))
      });

      return {
        winner,
        battleLog,
        rounds: round - 1,
        finalState: {
          teamA: teamACards,
          teamB: teamBCards
        }
      };
    };

    const battleResult = simulateBattle(teamA, teamB);

    // Update team records and ELO in database
    let eloChanges = null;
    if (teamAId && teamBId) {
      try {
        await withDatabase(async (db) => {
          console.log(`🔍 Fetching team data for ELO calculation...`);
          console.log(`Team A ID: ${teamAId}, Team B ID: ${teamBId}`);
          
          // Try both Team and team (Prisma model names can vary)
          const teamModel = db.Team || db.team;
          
          if (!teamModel) {
            throw new Error('Team model not found in Prisma client');
          }
          
          // Get current team data including ELO
          const [teamAData, teamBData] = await Promise.all([
            teamModel.findUnique({ 
              where: { id: teamAId },
              select: { 
                eloRating: true, 
                battlesWon: true, 
                battlesLost: true,
                name: true 
              }
            }),
            teamModel.findUnique({ 
              where: { id: teamBId },
              select: { 
                eloRating: true, 
                battlesWon: true, 
                battlesLost: true,
                name: true 
              }
            })
          ]);

          console.log(`📊 Team A Data:`, teamAData);
          console.log(`📊 Team B Data:`, teamBData);

          if (!teamAData || !teamBData) {
            console.error('❌ One or both teams not found in database');
            console.error(`Team A found: ${!!teamAData}, Team B found: ${!!teamBData}`);
            throw new Error('Teams not found');
          }

          // Calculate new ELO ratings
          eloChanges = calculateNewRatings(
            {
              eloRating: teamAData.eloRating || 1000,
              battlesWon: teamAData.battlesWon || 0,
              battlesLost: teamAData.battlesLost || 0
            },
            {
              eloRating: teamBData.eloRating || 1000,
              battlesWon: teamBData.battlesWon || 0,
              battlesLost: teamBData.battlesLost || 0
            },
            battleResult.winner
          );

          console.log(`📈 ELO Changes calculated:`, eloChanges);

          // Update teams with new stats and ELO
          console.log(`Updating teams in database...`);
          if (battleResult.winner === 'A') {
            console.log(`Team A won - updating records...`);
            await Promise.all([
              teamModel.update({
                where: { id: teamAId },
                data: { 
                  battlesWon: { increment: 1 },
                  eloRating: eloChanges.teamA.newRating,
                  updatedAt: new Date()
                }
              }),
              teamModel.update({
                where: { id: teamBId },
                data: { 
                  battlesLost: { increment: 1 },
                  eloRating: eloChanges.teamB.newRating,
                  updatedAt: new Date()
                }
              })
            ]);
          } else {
            console.log(`Team B won - updating records...`);
            await Promise.all([
              teamModel.update({
                where: { id: teamBId },
                data: { 
                  battlesWon: { increment: 1 },
                  eloRating: eloChanges.teamB.newRating,
                  updatedAt: new Date()
                }
              }),
              teamModel.update({
                where: { id: teamAId },
                data: { 
                  battlesLost: { increment: 1 },
                  eloRating: eloChanges.teamA.newRating,
                  updatedAt: new Date()
                }
              })
            ]);
          }

          console.log(`✅ Successfully updated battle records and ELO ratings`);
          console.log(`   Team A: ${teamAData.eloRating || 1000} → ${eloChanges.teamA.newRating}`);
          console.log(`   Team B: ${teamBData.eloRating || 1000} → ${eloChanges.teamB.newRating}`);
        });
      } catch (dbError) {
        console.error('❌ Failed to update battle records:', dbError);
        console.error('Error details:', dbError.message);
        // Don't fail the entire request, just log the error
      }
    } else {
      console.warn('⚠️ Missing team IDs, skipping database update');
    }

    const response = {
      success: true,
      winner: battleResult.winner,
      battleLog: battleResult.battleLog,
      rounds: battleResult.rounds,
      finalState: battleResult.finalState,
      eloChanges: eloChanges,
      timestamp: new Date().toISOString()
    };

    console.log(`🎯 Battle completed! Winner: Team ${battleResult.winner}`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Battle API error:', error);
    return res.status(500).json({ 
      error: 'Failed to conduct battle',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
