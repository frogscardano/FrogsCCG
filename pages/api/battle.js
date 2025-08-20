import { prisma, withDatabase } from '../../utils/db.js';

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

    // Battle simulation with RNG and strategy
    const simulateBattle = (teamA, teamB, teamAStats, teamBStats) => {
      const battleLog = [];
      let teamAHealth = teamAStats.totalHealth;
      let teamBHealth = teamBStats.totalHealth;
      let round = 1;
      const maxRounds = 20; // Prevent infinite battles

      battleLog.push('⚔️ Battle started!');
      battleLog.push(`Team A: ${teamAStats.totalPower} power | Team B: ${teamBStats.totalPower} power`);

      while (teamAHealth > 0 && teamBHealth > 0 && round <= maxRounds) {
        // Calculate damage based on attack power and some randomness
        const teamADamage = Math.floor((teamAStats.totalAttack * 0.8) + (Math.random() * teamAStats.totalAttack * 0.4));
        const teamBDamage = Math.floor((teamBStats.totalAttack * 0.8) + (Math.random() * teamBStats.totalAttack * 0.4));

        // Apply damage
        teamBHealth -= teamADamage;
        teamAHealth -= teamBDamage;

        battleLog.push(`Round ${round}: Team A deals ${teamADamage} damage, Team B deals ${teamBDamage} damage`);
        battleLog.push(`Team A Health: ${Math.max(0, teamAHealth)} | Team B Health: ${Math.max(0, teamBHealth)}`);

        round++;
      }

      // Determine winner
      let winner, loser, winnerStats, loserStats;
      if (teamAHealth > teamBHealth) {
        winner = 'A';
        loser = 'B';
        winnerStats = teamAStats;
        loserStats = teamBStats;
        battleLog.push('🏆 Team A wins the battle!');
      } else if (teamBHealth > teamAHealth) {
        winner = 'B';
        loser = 'A';
        winnerStats = teamBStats;
        loserStats = teamAStats;
        battleLog.push('🏆 Team B wins the battle!');
      } else {
        // Tie - determine by total power
        if (teamAStats.totalPower >= teamBStats.totalPower) {
          winner = 'A';
          loser = 'B';
          winnerStats = teamAStats;
          loserStats = teamBStats;
          battleLog.push('🏆 Team A wins by power advantage!');
        } else {
          winner = 'B';
          loser = 'A';
          winnerStats = teamBStats;
          loserStats = teamAStats;
          battleLog.push('🏆 Team B wins by power advantage!');
        }
      }

      // Calculate battle score and rewards
      const powerDifference = Math.abs(winnerStats.totalPower - loserStats.totalPower);
      const baseScore = 100;
      const powerBonus = Math.floor(powerDifference * 0.1);
      const roundBonus = Math.max(0, 50 - (round * 2)); // Faster wins get more points
      const totalScore = baseScore + powerBonus + roundBonus;

      battleLog.push(`📊 Battle Score: ${totalScore} (Base: ${baseScore}, Power Bonus: ${powerBonus}, Speed Bonus: ${roundBonus})`);

      return {
        winner,
        loser,
        winnerStats,
        loserStats,
        battleLog,
        totalScore,
        rounds: round - 1,
        finalHealth: {
          teamA: Math.max(0, teamAHealth),
          teamB: Math.max(0, teamBHealth)
        }
      };
    };

    // Run the battle simulation
    const battleResult = simulateBattle(teamA, teamB, teamAStats, teamBStats);

    // Update team records in database if team IDs are provided
    if (teamAId && teamBId) {
      try {
        await withDatabase(async (db) => {
          if (battleResult.winner === 'A') {
            // Update Team A (winner)
            await db.Team.update({
              where: { id: teamAId },
              data: { 
                battlesWon: { increment: 1 },
                updatedAt: new Date()
              }
            });

            // Update Team B (loser)
            await db.Team.update({
              where: { id: teamBId },
              data: { 
                battlesLost: { increment: 1 },
                updatedAt: new Date()
              }
            });
          } else {
            // Update Team B (winner)
            await db.Team.update({
              where: { id: teamBId },
              data: { 
                battlesWon: { increment: 1 },
                updatedAt: new Date()
              }
            });

            // Update Team A (loser)
            await db.Team.update({
              where: { id: teamAId },
              data: { 
                battlesLost: { increment: 1 },
                updatedAt: new Date()
              }
            });
          }
        });

        console.log(`✅ Updated battle records for teams ${teamAId} and ${teamBId}`);
      } catch (dbError) {
        console.error('❌ Failed to update battle records:', dbError);
        // Don't fail the battle if database update fails
      }
    }

    // Return battle results
    const response = {
      success: true,
      winner: battleResult.winner,
      battleLog: battleResult.battleLog,
      totalScore: battleResult.totalScore,
      rounds: battleResult.rounds,
      finalHealth: battleResult.finalHealth,
      teamStats: {
        teamA: teamAStats,
        teamB: teamBStats
      },
      timestamp: new Date().toISOString()
    };

    console.log(`🎯 Battle completed! Winner: Team ${battleResult.winner}, Score: ${battleResult.totalScore}`);
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Battle API error:', error);
    return res.status(500).json({ 
      error: 'Failed to conduct battle',
      message: error.message 
    });
  }
}
