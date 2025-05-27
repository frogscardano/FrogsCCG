// Frog stats database
const frogStats = {
  // All 5000 frogs with individual stats
  1: { attack: 35, health: 40, speed: 45 },
  2: { attack: 38, health: 42, speed: 40 },
  3: { attack: 42, health: 38, speed: 38 },
  4: { attack: 45, health: 35, speed: 35 },
  5: { attack: 50, health: 30, speed: 30 },
  6: { attack: 30, health: 42, speed: 38 },
  7: { attack: 56, health: 29, speed: 33 },
  8: { attack: 42, health: 40, speed: 45 },
  9: { attack: 36, health: 48, speed: 39 },
  10: { attack: 45, health: 45, speed: 35 },

  // Generating stats for all remaining frogs (11-5000) would make this file enormous,
  // so we'll use a deterministic function to generate them based on frog number
  // This ensures the same stats are always generated for the same frog

  // Default stats based on rarity (fallback)
  default: {
    "Legendary": { attack: 80, health: 80, speed: 80 },
    "Epic": { attack: 65, health: 65, speed: 65 },
    "Rare": { attack: 50, health: 50, speed: 50 },
    "Common": { attack: 30, health: 30, speed: 30 }
  }
};

// Team synergies based on frog numbers
const teamSynergies = [
  {
    name: "Arithmetic Genius",
    description: "Consecutive numbers 1-5 bonus",
    bonus: { attack: 25, health: 25, speed: 0 },
    checkSynergy: (numbers) => {
      const sortedNumbers = [...numbers].sort((a, b) => a - b);
      return sortedNumbers.length >= 5 && 
             sortedNumbers[0] === 1 && 
             sortedNumbers[1] === 2 && 
             sortedNumbers[2] === 3 && 
             sortedNumbers[3] === 4 && 
             sortedNumbers[4] === 5;
    }
  },
  {
    name: "Even Team",
    description: "All even numbered frogs",
    bonus: { attack: 0, health: 20, speed: 30 },
    checkSynergy: (numbers) => numbers.length >= 3 && numbers.every(n => n % 2 === 0)
  },
  {
    name: "Odd Squad",
    description: "All odd numbered frogs",
    bonus: { attack: 30, health: 0, speed: 20 },
    checkSynergy: (numbers) => numbers.length >= 3 && numbers.every(n => n % 2 === 1)
  },
  {
    name: "Prime Team",
    description: "All prime numbered frogs",
    bonus: { attack: 40, health: 15, speed: 15 },
    checkSynergy: (numbers) => {
      const isPrime = (num) => {
        if (num <= 1) return false;
        if (num <= 3) return true;
        if (num % 2 === 0 || num % 3 === 0) return false;
        let i = 5;
        while (i * i <= num) {
          if (num % i === 0 || num % (i + 2) === 0) return false;
          i += 6;
        }
        return true;
      };
      return numbers.length >= 3 && numbers.every(isPrime);
    }
  },
  {
    name: "Fibonacci Friends",
    description: "Contains at least 3 consecutive Fibonacci numbers",
    bonus: { attack: 20, health: 20, speed: 20 },
    checkSynergy: (numbers) => {
      const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
      const fibSet = new Set(fibonacci);
      const fibInTeam = numbers.filter(n => fibSet.has(n));
      
      // Check if we have at least 3 Fibonacci numbers in the team
      return fibInTeam.length >= 3;
    }
  },
  {
    name: "Century Club",
    description: "All frogs with numbers over 100",
    bonus: { attack: 10, health: 50, speed: 10 },
    checkSynergy: (numbers) => numbers.length >= 3 && numbers.every(n => n >= 100)
  }
];

// Pseudo-random but deterministic function to generate stats for a frog number
// This ensures the same frog always gets the same stats
function generateStatsForFrog(frogNumber) {
  // Use the frog number as a seed for pseudo-random generation
  let seed = frogNumber;
  
  // Simple pseudo-random number generator
  const nextRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  // Generate stats based on the frog number
  // Scale to max 64 as requested, but we'll allow some rare frogs to go higher
  let attack = Math.floor(nextRandom() * 64);
  let health = Math.floor(nextRandom() * 64);
  let speed = Math.floor(nextRandom() * 64);
  
  // Add some variation based on number patterns
  
  // Prime numbers get attack boost
  if (isPrime(frogNumber)) {
    attack = Math.min(100, attack + 15);
  }
  
  // Numbers divisible by 5 get health boost
  if (frogNumber % 5 === 0) {
    health = Math.min(100, health + 12);
  }
  
  // Fibonacci numbers get speed boost
  if (isFibonacci(frogNumber)) {
    speed = Math.min(100, speed + 18);
  }
  
  // Numbers under 100 get a small general boost
  if (frogNumber < 100) {
    attack = Math.min(100, attack + 5);
    health = Math.min(100, health + 5);
    speed = Math.min(100, speed + 5);
  }
  
  // First 10 frogs are special
  if (frogNumber <= 10) {
    attack = Math.min(100, attack + 10);
    health = Math.min(100, health + 10);
    speed = Math.min(100, speed + 10);
  }
  
  // Make sure no stat is too low
  attack = Math.max(15, attack);
  health = Math.max(15, health);
  speed = Math.max(15, speed);
  
  return { attack, health, speed };
}

// Helper function to check if a number is prime
function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  let i = 5;
  while (i * i <= num) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
    i += 6;
  }
  return true;
}

// Helper function to check if a number is in the Fibonacci sequence
function isFibonacci(num) {
  const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
  return fibonacci.includes(num);
}

// Function to get stats for a specific frog
function getFrogStats(frogNumber, rarity) {
  const frogNum = parseInt(frogNumber);
  
  // If explicit stats exist for this frog, use them
  if (frogStats[frogNum]) {
    return frogStats[frogNum];
  }
  
  // Generate stats based on frog number
  return generateStatsForFrog(frogNum);
}

// Function to generate HTML stat bars
function generateStatBars(stats) {
  const { attack, health, speed } = stats;
  
  // Calculate width percentages based on stats (max 100)
  const attackWidth = Math.min(100, attack);
  const healthWidth = Math.min(100, health);
  const speedWidth = Math.min(100, speed);
  
  return {
    attackBar: `<div class="stat-bar"><div class="stat-fill attack-fill" style="width: ${attackWidth}%"></div></div>`,
    healthBar: `<div class="stat-bar"><div class="stat-fill health-fill" style="width: ${healthWidth}%"></div></div>`,
    speedBar: `<div class="stat-bar"><div class="stat-fill speed-fill" style="width: ${speedWidth}%"></div></div>`
  };
}

// Function to get synergies for a team of frogs
function getTeamSynergies(frogNumbers) {
  if (!frogNumbers || frogNumbers.length === 0) return [];
  
  // Convert string numbers to integers if needed
  const numbers = frogNumbers.map(n => typeof n === 'string' ? parseInt(n) : n);
  
  // Check each synergy to see if it applies
  return teamSynergies.filter(synergy => synergy.checkSynergy(numbers));
}

// Export functions and data
module.exports = {
  getFrogStats,
  getTeamSynergies,
  generateStatBars,
  frogStats,
  teamSynergies
}; 