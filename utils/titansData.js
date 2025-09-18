// Titans stats database
const titanStats = {
  // All 6500 titans with individual stats
  1: { attack: 45, health: 50, speed: 35 },
  2: { attack: 48, health: 52, speed: 30 },
  3: { attack: 52, health: 48, speed: 28 },
  4: { attack: 55, health: 45, speed: 25 },
  5: { attack: 60, health: 40, speed: 20 },
  6: { attack: 40, health: 52, speed: 28 },
  7: { attack: 66, health: 39, speed: 23 },
  8: { attack: 52, health: 50, speed: 35 },
  9: { attack: 46, health: 58, speed: 29 },
  10: { attack: 55, health: 55, speed: 25 },

  // Generating stats for all remaining titans (11-6500) would make this file enormous,
  // so we'll use a deterministic function to generate them based on titan number
  // This ensures the same stats are always generated for the same titan

  // Default stats based on rarity (fallback)
  default: {
    "Legendary": { attack: 90, health: 90, speed: 60 },
    "Epic": { attack: 75, health: 75, speed: 50 },
    "Rare": { attack: 60, health: 60, speed: 40 },
    "Common": { attack: 40, health: 40, speed: 25 }
  }
};

// Team synergies based on titan numbers
const teamSynergies = [
  {
    name: "Titanic Force",
    description: "Contains at least 3 titans with numbers over 1000",
    bonus: { attack: 25, health: 30, speed: 5 },
    checkSynergy: (numbers) => {
      // At least 3 team members over 1000 (not all required)
      const high = numbers.filter(n => n >= 1000).length;
      return high >= 3;
    }
  },
  {
    name: "Prime Titans",
    description: "Contains at least 3 prime number titans",
    bonus: { attack: 30, health: 20, speed: 10 },
    checkSynergy: (numbers) => {
      const isPrime = (num) => {
        if (num <= 1) return false;
        if (num <= 3) return true;
        if (num % 2 === 0 || num % 3 === 0) return false;
        for (let i = 5; i * i <= num; i += 6) {
          if (num % i === 0 || num % (i + 2) === 0) return false;
        }
        return true;
      };

      // At least 3 primes in the team
      const primeCount = numbers.filter(isPrime).length;
      return primeCount >= 3;
    }
  },
  {
    name: "Fibonacci Titans",
    description: "Contains at least 3 consecutive Fibonacci numbers",
    bonus: { attack: 20, health: 25, speed: 15 },
    checkSynergy: (numbers) => {
      const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
      const fibSet = new Set(fibonacci);
      const fibInTeam = numbers.filter(n => fibSet.has(n));
      
      // Check if we have at least 3 Fibonacci numbers in the team
      return fibInTeam.length >= 3;
    }
  },  
  {
    name: "Ancient Titans",
    description: "Contains titans with numbers under 50",
    bonus: { attack: 25, health: 35, speed: 10 },
    checkSynergy: (numbers) => {
      const ancientTitans = numbers.filter(n => n < 50);
      return ancientTitans.length >= 2;
    }
  }
];

// Pseudo-random but deterministic function to generate stats for a titan number
// This ensures the same titan always gets the same stats
function generateStatsForTitan(titanNumber) {
  // Use the titan number as a seed for pseudo-random generation
  let seed = titanNumber;
  
  // Simple pseudo-random number generator
  const nextRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  // Generate stats based on the titan number
  // Titans are generally stronger but slower than frogs
  let attack = Math.floor(nextRandom() * 70) + 20; // 20-90 range
  let health = Math.floor(nextRandom() * 70) + 20; // 20-90 range
  let speed = Math.floor(nextRandom() * 40) + 10;  // 10-50 range (slower than frogs)
  
  // Add some variation based on number patterns
  
  // Prime numbers get attack boost
  if (isPrime(titanNumber)) {
    attack = Math.min(100, attack + 20);
  }
  
  // Numbers divisible by 5 get health boost
  if (titanNumber % 5 === 0) {
    health = Math.min(100, health + 15);
  }
  
  // Fibonacci numbers get speed boost
  if (isFibonacci(titanNumber)) {
    speed = Math.min(60, speed + 15);
  }
  
  // Numbers under 100 get a small general boost
  if (titanNumber < 100) {
    attack = Math.min(100, attack + 8);
    health = Math.min(100, health + 8);
    speed = Math.min(60, speed + 5);
  }
  
  // First 10 titans are special
  if (titanNumber <= 10) {
    attack = Math.min(100, attack + 15);
    health = Math.min(100, health + 15);
    speed = Math.min(60, speed + 10);
  }
  
  // Numbers over 4000 get massive health boost (true titans)
  if (titanNumber >= 4000) {
    health = Math.min(100, health + 25);
    attack = Math.min(100, attack + 10);
  }
  
  // Make sure no stat is too low
  attack = Math.max(20, attack);
  health = Math.max(20, health);
  speed = Math.max(10, speed);
  
  return { attack, health, speed };
}

// Helper function to check if a number is prime
function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

// Helper function to check if a number is Fibonacci
function isFibonacci(num) {
  const fibonacci = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
  return fibonacci.includes(num);
}

// Class-based stat ranges
const classStats = {
  "Peasants": { attack: [15, 45], health: [25, 50], speed: [35, 80] },
  "Townsfolk": { attack: [25, 55], health: [30, 65], speed: [20, 50] },
  "Warrior": { attack: [50, 80], health: [45, 75], speed: [25, 70] },
  "Mystics": { attack: [60, 85], health: [30, 60], speed: [30, 75] },
  "Royals": { attack: [50, 99], health: [70, 99], speed: [40, 70] },
  "Titans": { attack: [100, 100], health: [100, 100], speed: [100, 100] } // 1/1s
};

// Special combinations based on classes
const classSynergies = [
  {
    name: "Balanced Council",
    description: "Having 1 of each class in a squad",
    bonus: { attack: 10, health: 10, speed: 10 },
    checkSynergy: (classes) => {
      const uniqueClasses = [...new Set(classes)];
      return uniqueClasses.length >= 5 && // At least 5 different classes
             uniqueClasses.includes("Peasants") &&
             uniqueClasses.includes("Townsfolk") &&
             uniqueClasses.includes("Warrior") &&
             uniqueClasses.includes("Mystics") &&
             uniqueClasses.includes("Royals");
    }
  },
  {
    name: "Warrior's Might",
    description: "Having at least 3 warriors in the squad",
    bonus: { attack: 15, health: 0, speed: 0 },
    checkSynergy: (classes) => {
      const warriorCount = classes.filter(c => c === "Warrior").length;
      return warriorCount >= 3;
    }
  },
  {
    name: "Mystic Blessing",
    description: "Having at least 3 mystics in the squad",
    bonus: { attack: 0, health: 15, speed: 0 },
    checkSynergy: (classes) => {
      const mysticCount = classes.filter(c => c === "Mystics").length;
      return mysticCount >= 3;
    }
  },
  {
    name: "Royal Ascendancy",
    description: "Having full squad of Royals",
    bonus: { attack: 20, health: 20, speed: 20 },
    checkSynergy: (classes) => {
      return classes.length >= 5 && classes.every(c => c === "Royals");
    }
  }
];

// Function to get class from titan attributes
function getTitanClass(titanAttributes) {
  if (!titanAttributes || !Array.isArray(titanAttributes)) {
    return "Peasants"; // Default class
  }
  
  const classAttr = titanAttributes.find(attr => attr.trait_type === "Class");
  return classAttr ? classAttr.value : "Peasants";
}

// Function to generate stats based on class
function generateClassBasedStats(titanNumber, titanClass, rarity) {
  const classStatRanges = classStats[titanClass] || classStats["Peasants"];
  
  // Use titan number as seed for deterministic generation
  let seed = titanNumber;
  const nextRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  
  // Generate stats within class ranges
  const attackRange = classStatRanges.attack[1] - classStatRanges.attack[0];
  const healthRange = classStatRanges.health[1] - classStatRanges.health[0];
  const speedRange = classStatRanges.speed[1] - classStatRanges.speed[0];
  
  let attack = Math.floor(classStatRanges.attack[0] + (nextRandom() * attackRange));
  let health = Math.floor(classStatRanges.health[0] + (nextRandom() * healthRange));
  let speed = Math.floor(classStatRanges.speed[0] + (nextRandom() * speedRange));
  
  // Apply rarity bonuses
  switch (rarity) {
    case "Legendary":
      attack = Math.min(100, attack + 15);
      health = Math.min(100, health + 15);
      speed = Math.min(100, speed + 15);
      break;
    case "Epic":
      attack = Math.min(100, attack + 10);
      health = Math.min(100, health + 10);
      speed = Math.min(100, speed + 10);
      break;
    case "Rare":
      attack = Math.min(100, attack + 5);
      health = Math.min(100, health + 5);
      speed = Math.min(100, speed + 5);
      break;
  }
  
  // Special case for Asset Head Pepe (assuming it's titan #4546)
  if (titanNumber === 4546) {
    attack = 69;
    health = 69;
    speed = 69;
  }
  
  return { attack, health, speed };
}

// Function to get stats for a specific titan
function getTitanStats(titanNumber, rarity, attributes = null) {
  const titanNum = parseInt(titanNumber);
  
  // If explicit stats exist for this titan, use them
  if (titanStats[titanNum]) {
    return titanStats[titanNum];
  }
  
  // Get class from attributes if available
  const titanClass = attributes ? getTitanClass(attributes) : "Peasants";
  
  // Generate stats based on class
  return generateClassBasedStats(titanNum, titanClass, rarity);
}

// Function to generate HTML stat bars
function generateStatBars(stats) {
  const { attack, health, speed } = stats;
  const maxStat = 100; // Titans can have higher stats than frogs
  
  return `
    <div class="stat-bar">
      <span class="stat-label">Attack:</span>
      <div class="stat-fill" style="width: ${(attack / maxStat) * 100}%"></div>
      <span class="stat-value">${attack}</span>
    </div>
    <div class="stat-bar">
      <span class="stat-label">Health:</span>
      <div class="stat-fill" style="width: ${(health / maxStat) * 100}%"></div>
      <span class="stat-value">${health}</span>
    </div>
    <div class="stat-bar">
      <span class="stat-label">Speed:</span>
      <div class="stat-fill" style="width: ${(speed / maxStat) * 100}%"></div>
      <span class="stat-value">${speed}</span>
    </div>
  `;
}

// Function to check team synergies for titans (both number-based and class-based)
function checkTitanSynergies(teamNumbers, teamCards = null) {
  const activeSynergies = [];
  
  // Check number-based synergies
  for (const synergy of teamSynergies) {
    if (synergy.checkSynergy(teamNumbers)) {
      activeSynergies.push(synergy);
    }
  }
  
  // Check class-based synergies if team cards are provided
  if (teamCards && teamCards.length > 0) {
    const teamClasses = teamCards.map(card => {
      const classAttr = card.attributes?.find(attr => attr.trait_type === "Class");
      return classAttr ? classAttr.value : "Peasants";
    });
    
    for (const synergy of classSynergies) {
      if (synergy.checkSynergy(teamClasses)) {
        activeSynergies.push(synergy);
      }
    }
  }
  
  return activeSynergies;
}

// Function to calculate total team bonus from synergies
function calculateTitanTeamBonus(teamNumbers, teamCards = null) {
  const synergies = checkTitanSynergies(teamNumbers, teamCards);
  let totalBonus = { attack: 0, health: 0, speed: 0 };
  
  for (const synergy of synergies) {
    totalBonus.attack += synergy.bonus.attack;
    totalBonus.health += synergy.bonus.health;
    totalBonus.speed += synergy.bonus.speed;
  }
  
  return totalBonus;
}

export {
  titanStats,
  teamSynergies,
  classStats,
  classSynergies,
  getTitanStats,
  generateStatsForTitan,
  generateClassBasedStats,
  getTitanClass,
  generateStatBars,
  checkTitanSynergies,
  calculateTitanTeamBonus
};
