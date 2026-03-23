const PLAYER_MAX_HEALTH = 20;
const BASE_XP_FOR_NEXT_LEVEL = 300;
const WAVE_DURATION = 30;
const INTERMISSION_DURATION = 10;
const PLAYER_BASE_SPEED = 200;
const BASE_SHOOT_INTERVAL = 0.6;
const BASE_PROJECTILE_DAMAGE = 30;
const PLAYER_WIDTH = 64;
const PLAYER_HEIGHT = 64;
const PLAYER_SHOOT_RADIUS = 220;
const ENEMY_DROP_CHANCE = 0.02;
const LOOTBOX_SPIN_DURATION = 4.0;
const LOOTBOX_ITEM_WIDTH = 80;
const LOOTBOX_FRICTION = 0.85;

const enemyPath = [
    { x: 0, y: 100 },
    { x: 700, y: 100 },
    { x: 700, y: 400 },
    { x: 100, y: 400 },
    { x: 100, y: 550 }
];

const ENEMY_TYPES = {
    goon:     { name: "Goon",     health: 50,  speed: 50,  color: '#FF0000', xp: 50,  width: 28, height: 24, description: "Standard slime bug enemy." },
    tank:     { name: "Tank",     health: 200, speed: 30,  color: '#8B0000', xp: 150, width: 90, height: 64, description: "Slow, but very high health." },
    sprinter: { name: "Sprinter", health: 30,  speed: 120, color: '#FFA500', xp: 75,  width: 25, height: 25, description: "Very fast, but low health." }
};

const TOWER_TYPES = {
    flamethrower: { name: "Flamethrower", color: '#FF4500', range: 100, cooldown: 0.1, burnDuration: 2.0, burnDamagePerSecond: 5, vulnerability: 1.25, cost: 0 },
    sniper:       { name: "Sniper",       color: '#006400', range: 400, cooldown: 3.0, baseDamage: 100, chargeRate: 1.0, maxCharge: 100, cost: 0 },
    trap:         { name: "Spike Trap",   color: '#696969', range: 15,  cooldown: 5.0, damage: 20, slowDuration: 3.0, slowFactor: 0.5, activeDuration: 0.5, cost: 0 }
};

const LOOTBOX_POSSIBLE_ITEMS = [
    { type: 'level', value: 1, display: { color: 'yellow',  text: "+1 LVL" } },
    { type: 'level', value: 2, display: { color: 'orange',  text: "+2 LVL" } },
    { type: 'level', value: 3, display: { color: 'red',     text: "+3 LVL" } },
    { type: 'tower', value: 'flamethrower', display: { color: '#FF4500', text: "Flamer" } },
    { type: 'tower', value: 'sniper',       display: { color: '#006400', text: "Sniper" } },
    { type: 'tower', value: 'trap',         display: { color: '#696969', text: "Trap"   } },
    { type: 'level', value: 1, display: { color: 'yellow',  text: "+1 LVL" } },
    { type: 'tower', value: 'trap',         display: { color: '#696969', text: "Trap"   } },
    { type: 'level', value: 1, display: { color: 'yellow',  text: "+1 LVL" } }
];
