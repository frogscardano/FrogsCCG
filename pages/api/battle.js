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

    // Calculate team stats
    const calculateTeamStats = (team) => {
      let totalAttack = 0;
      let totalHealth = 0;
      let totalSpeed = 0;
      let totalPower = 0;

      team.forEach(card => {
        totalAttack += card.attack || 1;
        totalHealth += card.health || 1;
        totalSpeed += card.speed || 1;
        totalPower += (card.attack || 1) + (card.health || 1) + (card.speed || 1);
      });

      return { totalAttack, totalHealth, totalSpeed, totalPower };
    };

    const teamAStats = calculateTeamStats(teamA);
    const teamBStats = calculateTeamStats(teamB);

    console.log(`📊 Team A Stats: ATK:${teamAStats.totalAttack} HP:${teamAStats.totalHealth} SPD:${teamAStats.totalSpeed} Total:${teamAStats.totalPower}`);
    console.log(`📊 Team B Stats: ATK:${teamBStats.totalAttack} HP:${teamBStats.totalHealth} SPD:${teamBStats.totalSpeed} Total:${teamBStats.totalPower}`);

    // Battle simulation
    const simulateBattle = (teamA, teamB, teamAStats, teamBStats) => {
      const battleLog = [];
      let teamAHealth = teamAStats.totalHealth;
      let teamBHealth = teamBStats.totalHealth;
      let round = 1;
      const maxRounds = 20;

      battleLog.push('⚔️ Battle started!');
      battleLog.push(`Team A: ${teamAStats.totalPower} power | Team B: ${teamBStats.totalPower} power`);

      while (teamAHealth > 0 && teamBHealth > 0 && round <= maxRounds) {
        const teamADamage = Math.floor((teamAStats.totalAttack * 0.8) + (Math.random() * teamAStats.totalAttack * 0.4));
        const teamBDamage = Math.floor((teamBStats.totalAttack * 0.8) + (Math.random() * teamBStats.totalAttack * 0.4));

        teamBHealth -= teamADamage;
        teamAHealth -= teamBDamage;

        battleLog.push(`Round ${round}: Team A deals ${teamADamage} damage, Team B deals ${teamBDamage} damage`);
        battleLog.push(`Team A Health: ${Math.max(0, teamAHealth)} | Team B Health: ${Math.max(0, teamBHealth)}`);

        round++;
      }

      let winner;
      if (teamAHealth > teamBHealth) {
        winner = 'A';
        battleLog.push('🏆 Team A wins the battle!');
      } else if (teamBHealth > teamAHealth) {
        winner = 'B';
        battleLog.push('🏆 Team B wins the battle!');
      } else {
        winner = teamAStats.totalPower >= teamBStats.totalPower ? 'A' : 'B';
        battleLog.push(`🏆 Team ${winner} wins by power advantage!`);
      }

      return {
        winner,
        battleLog,
        rounds: round - 1,
        finalHealth: {
          teamA: Math.max(0, teamAHealth),
          teamB: Math.max(0, teamBHealth)
        }
      };
    };

    const battleResult = simulateBattle(teamA, teamB, teamAStats, teamBStats);

    // Update team records and ELO in database
    let eloChanges = null;
    if (teamAId && teamBId) {
      try {
        await withDatabase(async (db) => {
          // Get current team data including ELO
          const [teamAData, teamBData] = await Promise.all([
            db.Team.findUnique({ 
              where: { id: teamAId },
              select: { 
                eloRating: true, 
                battlesWon: true, 
                battlesLost: true,
                name: true 
              }
            }),
            db.Team.findUnique({ 
              where: { id: teamBId },
              select: { 
                eloRating: true, 
                battlesWon: true, 
                battlesLost: true,
                name: true 
              }
            })
          ]);

          // Calculate new ELO ratings
          eloChanges = calculateNewRatings(
            {
              eloRating: teamAData?.eloRating || 1000,
              battlesWon: teamAData?.battlesWon || 0,
              battlesLost: teamAData?.battlesLost || 0
            },
            {
              eloRating: teamBData?.eloRating || 1000,
              battlesWon: teamBData?.battlesWon || 0,
              battlesLost: teamBData?.battlesLost || 0
            },
            battleResult.winner
          );

          console.log(`📈 ELO Changes:`, eloChanges);

          // Update teams with new stats and ELO
          if (battleResult.winner === 'A') {
            await Promise.all([
              db.Team.update({
                where: { id: teamAId },
                data: { 
                  battlesWon: { increment: 1 },
                  eloRating: eloChanges.teamA.newRating,
                  updatedAt: new Date()
                }
              }),
              db.Team.update({
                where: { id: teamBId },
                data: { 
                  battlesLost: { increment: 1 },
                  eloRating: eloChanges.teamB.newRating,
                  updatedAt: new Date()
                }
              })
            ]);
          } else {
            await Promise.all([
              db.Team.update({
                where: { id: teamBId },
                data: { 
                  battlesWon: { increment: 1 },
                  eloRating: eloChanges.teamB.newRating,
                  updatedAt: new Date()
                }
              }),
              db.Team.update({
                where: { id: teamAId },
                data: { 
                  battlesLost: { increment: 1 },
                  eloRating: eloChanges.teamA.newRating,
                  updatedAt: new Date()
                }
              })
            ]);
          }

          console.log(`✅ Updated battle records and ELO for teams ${teamAId} and ${teamBId}`);
        });
      } catch (dbError) {
        console.error('❌ Failed to update battle records:', dbError);
      }
    }

    const response = {
      success: true,
      winner: battleResult.winner,
      battleLog: battleResult.battleLog,
      rounds: battleResult.rounds,
      finalHealth: battleResult.finalHealth,
      teamStats: {
        teamA: teamAStats,
        teamB: teamBStats
      },
      eloChanges: eloChanges,
      timestamp: new Date().toISOString()
    };

    console.log(`🎯 Battle completed! Winner: Team ${battleResult.winner}`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Battle API error:', error);
    return res.status(500).json({ 
      error: 'Failed to conduct battle',
      message: error.message 
    });
  }
}
