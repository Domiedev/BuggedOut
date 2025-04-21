// === Canvas Setup ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === HTML Elemente ===
const playButton = document.getElementById('playButton');
const retryButton = document.getElementById('retryButton');
const perkSelectionDiv = document.getElementById('perkSelection');
// === DEBUGGING ===
console.log("Initial check, perkSelectionDiv:", perkSelectionDiv); // Prüfen, ob das Element gefunden wird
const perkButtons = document.querySelectorAll('.perkButton');
const infoPopupDiv = document.getElementById('infoPopup');
const infoTextP = document.getElementById('infoText');
const infoOkButton = document.getElementById('infoOkButton');
const lootboxPopupDiv = document.getElementById('lootboxPopup');
const lootboxTextP = document.getElementById('lootboxText');
const lootboxOpenButton = document.getElementById('lootboxOpenButton');
const lootboxOkButton = document.getElementById('lootboxOkButton');

// === Spielzustände ===
let gameState; // Initial keinen Wert zuweisen
// oder: let gameState = null; // 'start', 'playing', 'betweenWaves', 'gameOver', 'selectingPerk', 'infoPopup', 'lootboxOpening', 'lootboxRevealing'
let nextStateAfterPopup = 'playing'; // Wohin nach Popup?

// === Zeit Management ===
let lastTimestamp = 0;
let deltaTime = 0; // Zeit seit letztem Frame in Sekunden

// === Spielkonstanten ===
const PLAYER_MAX_HEALTH = 20;
const BASE_XP_FOR_NEXT_LEVEL = 500;
const WAVE_DURATION = 30; // Sekunden
const INTERMISSION_DURATION = 10; // Sekunden
const ENEMY_INTRO_WAVES = [3, 6]; // Bei welchen Wellen neue Gegner kommen
const ENEMY_DROP_CHANCE = 0.1; // 10% Chance für Diamant
const LOOTBOX_REVEAL_DURATION = 1.5; // Sekunden (derzeit nicht für Animation genutzt)

// --- Player Config ---
const PLAYER_BASE_SPEED = 200; // Pixel pro Sekunde
const BASE_SHOOT_INTERVAL = 0.75; // Sekunden
const BASE_PROJECTILE_DAMAGE = 25;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 32; // Leicht höher für Helm/Kopf

// --- Gegner Konfiguration ---
const ENEMY_TYPES = {
    goon: { name: "Goon", health: 50, speed: 50, color: '#A8A8A8', xp: 50, width: 30, height: 30, description: "Standard grunt enemy." },
    tank: { name: "Tank", health: 200, speed: 30, color: '#8B0000', xp: 150, width: 40, height: 40, description: "Slow, but very high health." },
    sprinter: { name: "Sprinter", health: 30, speed: 120, color: '#FFA500', xp: 75, width: 25, height: 25, description: "Very fast, but low health." }
};
let availableEnemyTypes = ['goon'];
let introducedEnemies = {};

// --- Tower Konfiguration ---
const TOWER_TYPES = {
    flamethrower: { name: "Flamethrower", color: '#FF4500', range: 100, cooldown: 0.1, burnDuration: 2.0, burnDamagePerSecond: 5, vulnerability: 1.25, cost: 0 },
    sniper: { name: "Sniper", color: '#006400', range: 400, cooldown: 3.0, baseDamage: 100, chargeRate: 5, maxCharge: 100, target: 'strongest', cost: 0 },
    trap: { name: "Spike Trap", color: '#696969', range: 15, cooldown: 5.0, damage: 20, slowDuration: 3.0, slowFactor: 0.5, activeDuration: 0.5, cost: 0 }
};

// --- Spielvariablen ---
let player = {}; enemies = []; projectiles = []; towers = []; drops = []; keys = {};
let currentWave = 0; waveTimer = 0; intermissionTimer = 0; enemySpawnTimer = 0; shootTimer = 0;
let nearestEnemyForLaser = null; enemyToIntroduce = null; lootboxRevealTimer = 0;

const enemyPath = [ { x: 0, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 400 }, { x: 100, y: 400 }, { x: 100, y: 550 }];

// === Hilfsfunktionen ===
function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function drawText(text, x, y, color = 'black', size = '20px', align = 'center', baseline = 'middle') { ctx.fillStyle = color; ctx.font = `${size} Arial`; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(text, x, y); }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function distanceSq(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return dx * dx + dy * dy; }

// === Zeichnen Funktionen ===
function drawPlayer() {
    if (nearestEnemyForLaser && (gameState === 'playing' || gameState === 'betweenWaves')) {
        ctx.strokeStyle = 'red'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
        ctx.lineTo(nearestEnemyForLaser.x + nearestEnemyForLaser.width / 2, nearestEnemyForLaser.y + nearestEnemyForLaser.height / 2);
        ctx.stroke();
    }
    const bodyX = player.x + 4, bodyY = player.y + 8, bodyW = player.width - 8, bodyH = player.height - 12;
    drawRect(bodyX, bodyY, bodyW, bodyH, '#808080'); drawRect(player.x + 8, player.y, player.width - 16, 8, '#696969');
    drawRect(bodyX, bodyY + bodyH, 6, 4, '#696969'); drawRect(bodyX + bodyW - 6, bodyY + bodyH, 6, 4, '#696969');
    drawRect(player.x + player.width - 4, player.y + 12, 4, 8, '#505050');
}

function drawEnemy(enemy) {
    drawRect(enemy.x, enemy.y, enemy.width, enemy.height, enemy.color);
    const healthBarWidth = enemy.width, healthBarHeight = 5, barX = enemy.x, barY = enemy.y - healthBarHeight - 2;
    const healthPercentage = Math.max(0, enemy.currentHealth / enemy.maxHealth);
    drawRect(barX, barY, healthBarWidth, healthBarHeight, '#555'); drawRect(barX, barY, healthBarWidth * healthPercentage, healthBarHeight, 'lime');
    if (enemy.statusEffects.burning?.duration > 0) { ctx.strokeStyle = 'orange'; ctx.lineWidth = 2; ctx.strokeRect(enemy.x - 1, enemy.y - 1, enemy.width + 2, enemy.height + 2); }
    if (enemy.statusEffects.slowed?.duration > 0) { drawRect(enemy.x, enemy.y, enemy.width, enemy.height, 'rgba(0, 0, 255, 0.2)'); }
     ctx.lineWidth = 1;
}

function drawProjectile(p) { drawRect(p.x, p.y, p.width, p.height, p.color); }

function drawPath() {
    ctx.strokeStyle = 'grey'; ctx.lineWidth = 20; ctx.beginPath();
    if (enemyPath.length > 0) { ctx.moveTo(enemyPath[0].x, enemyPath[0].y); for (let i = 1; i < enemyPath.length; i++) { ctx.lineTo(enemyPath[i].x, enemyPath[i].y); } ctx.stroke(); }
    ctx.lineWidth = 1;
}

function drawXPBar() {
    const barHeight = 20, barWidth = canvas.width * 0.8, barX = canvas.width * 0.1, barY = canvas.height - barHeight - 10;
    const xpPercentage = Math.max(0, Math.min(1, player.xp / player.xpForNextLevel));
    drawRect(barX, barY, barWidth, barHeight, '#555'); drawRect(barX, barY, barWidth * xpPercentage, barHeight, 'yellow');
    drawText(`Level: ${player.level} | XP: ${player.xp} / ${player.xpForNextLevel}`, canvas.width / 2, barY + barHeight / 2, 'black', '14px');
}

function drawDrops() {
    for (const drop of drops) {
        ctx.fillStyle = 'aqua'; ctx.beginPath();
        ctx.moveTo(drop.x + drop.width / 2, drop.y);
        ctx.lineTo(drop.x + drop.width, drop.y + drop.height / 2);
        ctx.lineTo(drop.x + drop.width / 2, drop.y + drop.height);
        ctx.lineTo(drop.x, drop.y + drop.height / 2);
        ctx.closePath(); ctx.fill();
    }
}

function drawTowers() {
    for (const tower of towers) {
        ctx.fillStyle = tower.color; ctx.fillRect(tower.x, tower.y, tower.width, tower.height);
        if (tower.type === 'sniper') { drawText(`${Math.floor(tower.chargePercent)}%`, tower.x + tower.width / 2, tower.y - 10, 'cyan', '12px'); }
        else if (tower.type === 'trap' && tower.isActive) { drawRect(tower.x, tower.y, tower.width, tower.height, '#A9A9A9'); }
    }
}

function drawUI() {
     drawText(`Lives: ${player.health}`, 60, 30, 'red', '20px', 'left');
     drawText(`Wave: ${currentWave}`, canvas.width - 60, 30, 'blue', '20px', 'right');
    if (gameState === 'playing') { drawText(`Time left: ${Math.ceil(waveTimer)}s`, canvas.width / 2, 30); }
    else if (gameState === 'betweenWaves') { drawText(`Next wave in: ${Math.ceil(intermissionTimer)}s`, canvas.width / 2, canvas.height / 2 - 50, 'orange', '30px'); drawText(`Prepare for Wave ${currentWave + 1}`, canvas.width / 2, canvas.height / 2); }
    drawXPBar();
}

function drawStartScreen() {
    ctx.font = "bold 70px 'Arial Black', Gadget, sans-serif"; ctx.fillStyle = '#3498db'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText("BUGGED OUT", canvas.width / 2, canvas.height / 2 - 60);
    drawText("Click the 'Play' button below to begin!", canvas.width / 2, canvas.height / 2 + 40, 'white', '22px');
    drawText("Use Arrow Keys or WASD to Move", canvas.width / 2, canvas.height / 2 + 75, '#bdc3c7', '16px');
}

function drawGameOverScreen() {
    drawRect(0, 0, canvas.width, canvas.height, 'rgba(100, 0, 0, 0.8)');
    drawText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40, 'white', '60px');
    drawText(`You reached Wave: ${currentWave}`, canvas.width / 2, canvas.height / 2 + 20, 'white', '30px');
}

// === Spiel-Logik ===
function updatePlayerMovement() {
    let intendedX = 0; let intendedY = 0;
    if (keys['ArrowUp'] || keys['w']) intendedY = -1;
    if (keys['ArrowDown'] || keys['s']) intendedY = 1;
    if (keys['ArrowLeft'] || keys['a']) intendedX = -1;
    if (keys['ArrowRight'] || keys['d']) intendedX = 1;

    let moveX = intendedX; let moveY = intendedY;
    if (intendedX !== 0 && intendedY !== 0) {
        const factor = 1 / Math.sqrt(2);
        moveX *= factor; moveY *= factor;
    }
    player.dx = moveX * player.speed;
    player.dy = moveY * player.speed;
}

function movePlayer() {
    if (gameState !== 'playing') { player.dx = 0; player.dy = 0; return; }
    updatePlayerMovement();
    player.x += player.dx * deltaTime;
    player.y += player.dy * deltaTime;
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
}

function spawnEnemy() {
    const typeKey = getRandomElement(availableEnemyTypes);
    const typeConfig = ENEMY_TYPES[typeKey];
    const waveMultiplier = 1 + (currentWave - 1) * 0.15;
    const health = typeConfig.health * waveMultiplier;
    const speed = typeConfig.speed * (1 + (currentWave - 1) * 0.05);
    const xp = Math.ceil(typeConfig.xp * (1 + (currentWave - 1) * 0.1));

    enemies.push({
        type: typeKey,
        x: enemyPath[0].x - typeConfig.width / 2, y: enemyPath[0].y - typeConfig.height / 2,
        width: typeConfig.width, height: typeConfig.height,
        speed: speed, baseSpeed: speed,
        maxHealth: health, currentHealth: health,
        color: typeConfig.color, pathIndex: 0, value: xp,
        statusEffects: {
            burning: { duration: 0, damageInterval: 0.5, damageTimer: 0, damageAmount: 0 },
            slowed: { duration: 0, speedMultiplier: 1 }
        }
    });
}

function updateEnemyStatusEffects(enemy) {
    let diedFromEffect = false;
    // Burning
    let burn = enemy.statusEffects.burning;
    if (burn && burn.duration > 0) { // Check if burn exists
        burn.duration -= deltaTime;
        burn.damageTimer -= deltaTime;
        if (burn.damageTimer <= 0) {
            enemy.currentHealth -= burn.damageAmount;
            burn.damageTimer = burn.damageInterval;
            if (enemy.currentHealth <= 0) diedFromEffect = true;
        }
        if (burn.duration <= 0) burn.duration = 0;
    }
    // Slowed
    let slow = enemy.statusEffects.slowed;
    if (slow && slow.duration > 0) { // Check if slow exists
        slow.duration -= deltaTime;
        enemy.speed = enemy.baseSpeed * slow.speedMultiplier;
        if (slow.duration <= 0) {
            slow.duration = 0; enemy.speed = enemy.baseSpeed;
        }
    } else { enemy.speed = enemy.baseSpeed; } // Ensure speed reset if no slow effect
    return diedFromEffect;
}

function moveEnemies() {
    if (gameState !== 'playing') return;
    for (let i = enemies.length - 1; i >= 0; i--) {
        // Check if enemy still exists (could be removed by effect)
        if (!enemies[i]) continue;
        let enemy = enemies[i];

        if (updateEnemyStatusEffects(enemy)) {
             // Need to find index again as it might have shifted if multiple enemies died from effects in one frame
             let currentIndex = enemies.indexOf(enemy);
             if (currentIndex > -1) handleEnemyDefeat(enemy, currentIndex);
             continue; // Move to next enemy
        }

        // Ensure enemy wasn't removed by handleEnemyDefeat called from effects
        if (!enemies.includes(enemy)) continue;

        let targetPoint = enemyPath[enemy.pathIndex];
        let targetX = targetPoint.x; let targetY = targetPoint.y;
        let dx = targetX - (enemy.x + enemy.width / 2);
        let dy = targetY - (enemy.y + enemy.height / 2);
        let distance = Math.sqrt(dx * dx + dy * dy);
        let moveAmount = enemy.speed * deltaTime;

        if (distance < moveAmount || distance === 0) {
            enemy.pathIndex++;
            if (enemy.pathIndex >= enemyPath.length) {
                player.health--;
                enemies.splice(i, 1); // Remove enemy
                if (player.health <= 0) { setGameState('gameOver'); }
                continue; // To next enemy in loop
            }
             // Snap to point before moving to next
             enemy.x = targetX - enemy.width/2;
             enemy.y = targetY - enemy.height/2;
        } else {
            enemy.x += (dx / distance) * moveAmount;
            enemy.y += (dy / distance) * moveAmount;
        }
    }
}


function findNearestEnemy() {
    nearestEnemyForLaser = null;
    if (enemies.length === 0) return null;
    let nearestEnemy = null; let minDistanceSq = Infinity;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    for (const enemy of enemies) {
        let dx = (enemy.x + enemy.width / 2) - playerCenterX;
        let dy = (enemy.y + enemy.height / 2) - playerCenterY;
        let distSq = dx * dx + dy * dy;
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq; nearestEnemy = enemy;
        }
    }
    nearestEnemyForLaser = nearestEnemy;
    return nearestEnemy;
}

function findStrongestEnemy() {
    let strongest = null; let maxHealth = -1;
    for (const enemy of enemies) {
         if (enemy.type === 'goon') continue;
         if (enemy.maxHealth > maxHealth) {
             maxHealth = enemy.maxHealth; strongest = enemy;
         }
    }
    return strongest;
}

function shoot() {
    // Moved timer reset to the end of this function.
    if (gameState !== 'playing' || enemies.length === 0) return;
    const targetEnemy = findNearestEnemy();
    if (!targetEnemy) return;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const targetX = targetEnemy.x + targetEnemy.width / 2;
    const targetY = targetEnemy.y + targetEnemy.height / 2;
    const baseAngle = Math.atan2(targetY - playerCenterY, targetX - playerCenterX);
    const spreadAngle = player.projectileCount > 1 ? Math.PI / 12 : 0;
    const projSpeed = 400;

    for (let i = 0; i < player.projectileCount; i++) {
        let currentAngle = baseAngle;
        if (player.projectileCount > 1) {
            currentAngle += spreadAngle * (i - (player.projectileCount - 1) / 2);
        }
        let dx = Math.cos(currentAngle); let dy = Math.sin(currentAngle);
        projectiles.push({
            x: playerCenterX - 2.5, y: playerCenterY - 2.5,
            width: 5, height: 5, color: 'black',
            vx: dx * projSpeed, vy: dy * projSpeed,
            damage: player.currentDamage
        });
    }
     shootTimer = player.currentShootInterval; // Reset timer AFTER shooting this burst
}

function handleEnemyDefeat(enemy, index) {
     // Ensure enemy exists at this index before proceeding
     if (!enemies[index] || enemies[index] !== enemy) {
         console.warn("handleEnemyDefeat called with invalid index or enemy mismatch.");
         return;
     }

     gainXP(enemy.value);
     if (Math.random() < ENEMY_DROP_CHANCE) {
         drops.push({
             x: enemy.x + enemy.width / 2 - 5, y: enemy.y + enemy.height / 2 - 5,
             width: 10, height: 10
         });
     }
     if(nearestEnemyForLaser === enemy) { nearestEnemyForLaser = null; }
     enemies.splice(index, 1);
}


function moveProjectiles() {
    if (gameState !== 'playing' && gameState !== 'betweenWaves') return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx * deltaTime; p.y += p.vy * deltaTime;
        if (p.x < -p.width || p.x > canvas.width || p.y < -p.height || p.y > canvas.height) {
            projectiles.splice(i, 1); continue;
        }
        for (let j = enemies.length - 1; j >= 0; j--) {
             // Check if enemy still exists before collision check
            if (!enemies[j]) continue;
            let enemy = enemies[j];

            if (p.x < enemy.x + enemy.width && p.x + p.width > enemy.x &&
                p.y < enemy.y + enemy.height && p.y + p.height > enemy.y) {

                let actualDamage = p.damage;
                if (enemy.statusEffects.burning?.duration > 0) {
                    actualDamage *= TOWER_TYPES.flamethrower.vulnerability;
                }
                enemy.currentHealth -= actualDamage;
                 projectiles.splice(i, 1); // Splice projectile before handling defeat

                if (enemy.currentHealth <= 0) {
                    handleEnemyDefeat(enemy, j);
                 }
                // Important: break because projectile is gone now
                break;
            }
        }
    }
}


function updateTowers() {
    for (const tower of towers) {
        tower.cooldownTimer = Math.max(0, tower.cooldownTimer - deltaTime);
        if (tower.cooldownTimer <= 0) {
            switch (tower.type) {
                case 'flamethrower': updateFlamethrower(tower); break;
                case 'sniper': updateSniper(tower); break;
                case 'trap': updateTrap(tower); break;
            }
        }
        if (tower.type === 'trap' && tower.isActive) {
             tower.activeTimer -= deltaTime;
             if (tower.activeTimer <= 0) tower.isActive = false;
        } else if (tower.type === 'sniper') { // Sniper Aufladung nur wenn NICHT geschossen wird
             let strongest = findStrongestEnemy(); // Finde Ziel potentiell
             if(!strongest || tower.cooldownTimer > 0) { // Aufladen wenn kein Ziel oder Cooldown aktiv
                 tower.chargePercent = Math.min(tower.maxCharge, tower.chargePercent + tower.chargeRate * deltaTime);
             }
        }
    }
}

function updateFlamethrower(tower) {
    tower.cooldownTimer = tower.cooldown;
    let towerCenterX = tower.x + tower.width/2; let towerCenterY = tower.y + tower.height/2;
    const typeConfig = TOWER_TYPES.flamethrower;
    for (let enemy of enemies) {
        let enemyCenterX = enemy.x + enemy.width/2; let enemyCenterY = enemy.y + enemy.height/2;
        if (distanceSq(towerCenterX, towerCenterY, enemyCenterX, enemyCenterY) < tower.range * tower.range) {
            enemy.statusEffects.burning = {
                 duration: typeConfig.burnDuration, damageInterval: 0.5, damageTimer: 0.5,
                 damageAmount: typeConfig.burnDamagePerSecond * 0.5
            };
        }
    }
}

function updateSniper(tower) {
    let target = findStrongestEnemy();
    if (target) {
        tower.cooldownTimer = tower.cooldown;
        const typeConfig = TOWER_TYPES.sniper;
        let damage = typeConfig.baseDamage * (1 + tower.chargePercent / 100);
        console.log(`Sniper Schuss auf ${target.type}! Schaden: ${damage.toFixed(0)} (Bonus: ${tower.chargePercent.toFixed(0)}%)`);
        target.currentHealth -= damage;
        tower.chargePercent = 0;
        if (target.currentHealth <= 0) {
             let index = enemies.indexOf(target);
             if(index > -1) handleEnemyDefeat(target, index);
        }
    }
    // Wenn kein Ziel, passiert nichts (kein Cooldown Reset), Aufladen erfolgt in updateTowers
}

function updateTrap(tower) {
    tower.cooldownTimer = tower.cooldown;
    tower.isActive = true;
    tower.activeTimer = tower.activeDuration;
    const typeConfig = TOWER_TYPES.trap;
    for (let i = enemies.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
        let enemy = enemies[i];
         let enemyCenterX = enemy.x + enemy.width/2; let enemyCenterY = enemy.y + enemy.height/2;
         if (tower.isActive &&
             Math.abs(enemyCenterX - (tower.x + tower.width/2)) < tower.range + enemy.width/2 &&
             Math.abs(enemyCenterY - (tower.y + tower.height/2)) < tower.range + enemy.height/2 ) {
              enemy.currentHealth -= typeConfig.damage;
              enemy.statusEffects.slowed = { duration: typeConfig.slowDuration, speedMultiplier: typeConfig.slowFactor };
              console.log(`Falle ausgelöst von ${enemy.type}! Schaden: ${typeConfig.damage}, Slowed.`);
              if (enemy.currentHealth <= 0) { handleEnemyDefeat(enemy, i); }
         }
    }
}

function checkDropsCollection() {
    if (gameState !== 'playing') return;
    let playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    for (let i = drops.length - 1; i >= 0; i--) {
        let drop = drops[i];
        let dropRect = { x: drop.x, y: drop.y, width: drop.width, height: drop.height };
        if (playerRect.x < dropRect.x + dropRect.width && playerRect.x + playerRect.width > dropRect.x &&
            playerRect.y < dropRect.y + dropRect.height && playerRect.y + playerRect.height > dropRect.y) {
            drops.splice(i, 1); triggerLootbox(); break;
        }
    }
}

function triggerLootbox() {
    console.log("Lootbox getriggert!");
    nextStateAfterPopup = gameState; setGameState('lootboxOpening');
    lootboxTextP.textContent = "You found a Lootbox!";
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'inline-block';
    if (lootboxOkButton) lootboxOkButton.style.display = 'none';
    if (lootboxPopupDiv) lootboxPopupDiv.style.display = 'block';
}

function openLootbox() {
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'none';
    if (lootboxTextP) lootboxTextP.textContent = "Opening...";
    setTimeout(() => revealLootboxReward(), 500);
}

function revealLootboxReward() {
    let rewardText = "";
    if (Math.random() < 0.6) {
        let levelsGained = Math.floor(Math.random() * 3) + 1;
        rewardText = `You gained ${levelsGained} Level(s)!`;
        gainXP(levelsGained * player.xpForNextLevel);
    } else {
        let availableTowerTypes = Object.keys(TOWER_TYPES);
        let chosenTowerType = getRandomElement(availableTowerTypes);
        let success = placeRandomTower(chosenTowerType);
        if (success) { rewardText = `You received a ${TOWER_TYPES[chosenTowerType].name}!`; }
        else { rewardText = "No space for a tower! (+500 XP instead)"; gainXP(500); }
    }
    if (lootboxTextP) lootboxTextP.textContent = rewardText;
    if (lootboxOkButton) lootboxOkButton.style.display = 'inline-block';
    setGameState('lootboxRevealing');
}

function placeRandomTower(typeKey) {
    const typeConfig = TOWER_TYPES[typeKey];
    const towerWidth = 30; const towerHeight = 30;
    let attempts = 0; const maxAttempts = 30;
    while (attempts < maxAttempts) {
        attempts++;
        let randX = Math.random() * (canvas.width - towerWidth - 40) + 20;
        let randY = Math.random() * (canvas.height - towerHeight - 40) + 20;
        let towerRect = {x: randX, y: randY, width: towerWidth, height: towerHeight};
        let tooCloseToPath = false; const minPathDistanceSq = 50 * 50;
        for(let i = 0; i < enemyPath.length -1; i++){
             if (distanceSq(towerRect.x + towerWidth/2, towerRect.y + towerHeight/2, enemyPath[i].x, enemyPath[i].y) < minPathDistanceSq ||
                 distanceSq(towerRect.x + towerWidth/2, towerRect.y + towerHeight/2, enemyPath[i+1].x, enemyPath[i+1].y) < minPathDistanceSq ) {
                  tooCloseToPath = true; break;
             }
        }
        if (tooCloseToPath) continue;
        let collidesWithTower = false;
        for (const otherTower of towers) {
             let otherRect = {x: otherTower.x, y: otherTower.y, width: otherTower.width, height: otherTower.height};
             if (towerRect.x < otherRect.x + otherRect.width && towerRect.x + towerRect.width > otherRect.x &&
                 towerRect.y < otherRect.y + otherRect.height && towerRect.y + towerRect.height > otherRect.y) {
                 collidesWithTower = true; break;
             }
        }
        if (collidesWithTower) continue;
        let newTower = {
             type: typeKey, x: randX, y: randY, width: towerWidth, height: towerHeight,
             color: typeConfig.color, range: typeConfig.range, cooldown: typeConfig.cooldown,
             cooldownTimer: Math.random() * typeConfig.cooldown,
             ...(typeKey === 'sniper' && { baseDamage: typeConfig.baseDamage, chargeRate: typeConfig.chargeRate, maxCharge: typeConfig.maxCharge, chargePercent: 0 }),
             ...(typeKey === 'flamethrower' && { burnDamagePerSecond: typeConfig.burnDamagePerSecond, burnDuration: typeConfig.burnDuration, vulnerability: typeConfig.vulnerability }),
             ...(typeKey === 'trap' && { damage: typeConfig.damage, slowDuration: typeConfig.slowDuration, slowFactor: typeConfig.slowFactor, activeDuration: typeConfig.activeDuration, isActive: false, activeTimer: 0 })
        };
        towers.push(newTower); console.log(`Turm platziert: ${typeConfig.name} at (${randX.toFixed(0)}, ${randY.toFixed(0)})`); return true;
    }
    console.log("Kein Platz für Turm gefunden nach", maxAttempts, "Versuchen."); return false;
}

function gainXP(amount) {
    if (gameState === 'gameOver' || !player || typeof player.xp !== 'number') return; // Added safety checks
    player.xp += Math.round(amount);
    console.log(`Gained ${Math.round(amount)} XP. Total: ${player.xp}/${player.xpForNextLevel}`);
    while (player.xp >= player.xpForNextLevel) { levelUp(); }
}

function levelUp() {
    if (!player || typeof player.level !== 'number') return; // Safety check
    player.level++; player.xp -= player.xpForNextLevel;
    player.xpForNextLevel = Math.floor(BASE_XP_FOR_NEXT_LEVEL * Math.pow(1.5, player.level - 1));
    console.log(`LEVEL UP! Level ${player.level}. Next level at ${player.xpForNextLevel} XP.`);
    nextStateAfterPopup = gameState; setGameState('selectingPerk');
}

function applyPerk(perkType) {
    if (!player) return; // Safety check
    switch (perkType) {
        case 'speed': player.shootSpeedMultiplier *= 1.5; player.currentShootInterval = BASE_SHOOT_INTERVAL / player.shootSpeedMultiplier; break;
        case 'damage': player.damageMultiplier *= 1.2; player.currentDamage = BASE_PROJECTILE_DAMAGE * player.damageMultiplier; break;
        case 'shotgun': player.projectileCount *= 2; break;
    }
    console.log("Perk applied:", perkType, "New Stats:", player);
    setGameState(nextStateAfterPopup);
}

// --- Zustandsmanagement (MIT DEBUGGING LOGS) ---
function setGameState(newState) {
    // === DEBUGGING START ===
    const oldStateForLog = gameState;
    console.log(`--- setGameState CALLED with: ${newState} ---`);
    console.log(`Previous gameState was: ${oldStateForLog}`);
    // === DEBUGGING END ===

    // Prevent infinite loops or redundant calls if state is already set
    if (gameState === newState && typeof gameState !== 'undefined') { // Check for undefined initial state
         console.log(`State is already ${newState}, returning.`);
         return;
    }

    // === DEBUGGING START ===
    // Log only if state is actually changing
    if (gameState !== newState) {
        console.log(`State is changing: ${gameState} -> ${newState}`);
    }
    // === DEBUGGING END ===

    gameState = newState; // Update the global state variable

    // UI Elemente anpassen
    if (playButton) playButton.style.display = (gameState === 'start') ? 'inline-block' : 'none';
    if (retryButton) retryButton.style.display = (gameState === 'gameOver') ? 'inline-block' : 'none';

    // === DEBUGGING START ===
    console.log(`Checking condition for perkSelection: gameState === 'selectingPerk' is ${gameState === 'selectingPerk'}`);
    // === DEBUGGING END ===
    if (perkSelectionDiv) {
        perkSelectionDiv.style.display = (gameState === 'selectingPerk') ? 'block' : 'none';
         // === DEBUGGING START ===
         console.log(`perkSelectionDiv.style.display now set to: ${perkSelectionDiv.style.display}`);
         // === DEBUGGING END ===
    } else {
        // === DEBUGGING START ===
        console.error("!!! perkSelectionDiv NOT found !!!");
        // === DEBUGGING END ===
    }

    if (infoPopupDiv) infoPopupDiv.style.display = (gameState === 'infoPopup') ? 'block' : 'none';
    if (lootboxPopupDiv) lootboxPopupDiv.style.display = (gameState === 'lootboxOpening' || gameState === 'lootboxRevealing') ? 'block' : 'none';

    if (newState === 'playing' || newState === 'betweenWaves') { if(canvas) canvas.focus(); }

    if (newState === 'gameOver') { /* Optional: Stop sounds etc. */ }
    if (oldStateForLog === 'lootboxRevealing' && newState !== 'lootboxOpening') {
         if (lootboxOkButton) lootboxOkButton.style.display = 'none';
    }
}

function checkNewEnemyIntroduction() {
    let newEnemyKey = null;
    if (currentWave === ENEMY_INTRO_WAVES[0] && !introducedEnemies['tank']) { newEnemyKey = 'tank'; }
    else if (currentWave === ENEMY_INTRO_WAVES[1] && !introducedEnemies['sprinter']) { newEnemyKey = 'sprinter'; }

    if (newEnemyKey) {
        availableEnemyTypes.push(newEnemyKey);
        enemyToIntroduce = ENEMY_TYPES[newEnemyKey];
        introducedEnemies[newEnemyKey] = true;
        nextStateAfterPopup = 'playing';
        setGameState('infoPopup'); // This call might trigger console logs again
        if(infoTextP) infoTextP.textContent = `NEW ENEMY APPROACHING: ${enemyToIntroduce.name.toUpperCase()}! ${enemyToIntroduce.description}`;
        if(infoPopupDiv) infoPopupDiv.style.display = 'block';
        return true;
    }
    return false;
}

function resetGame() {
    player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2, y: canvas.height / 2 - PLAYER_HEIGHT / 2,
        width: PLAYER_WIDTH, height: PLAYER_HEIGHT, speed: PLAYER_BASE_SPEED,
        color: 'blue', dx: 0, dy: 0, health: PLAYER_MAX_HEALTH,
        level: 1, xp: 0, xpForNextLevel: BASE_XP_FOR_NEXT_LEVEL,
        shootSpeedMultiplier: 1, damageMultiplier: 1, projectileCount: 1,
        currentShootInterval: BASE_SHOOT_INTERVAL, currentDamage: BASE_PROJECTILE_DAMAGE
    };
    enemies = []; projectiles = []; drops = []; towers = [];
    keys = {}; currentWave = 0; waveTimer = 0; intermissionTimer = 3;
    enemySpawnTimer = 0; shootTimer = 0; nearestEnemyForLaser = null;
    availableEnemyTypes = ['goon']; introducedEnemies = {};
    lastTimestamp = 0; deltaTime = 0;

    setGameState('betweenWaves'); // This call will trigger console logs
}

// --- Update & Draw (Hauptschleife) ---
function update() {
    if (gameState === 'playing') {
        movePlayer(); moveEnemies(); moveProjectiles(); updateTowers(); checkDropsCollection();
        enemySpawnTimer -= deltaTime;
        const spawnIntervalDivisor = Math.max(1, availableEnemyTypes.length * 0.8);
        const currentBaseSpawnInterval = Math.max(0.2, 1.5 / (1 + (currentWave - 1) * 0.1));
        const currentSpawnInterval = currentBaseSpawnInterval / spawnIntervalDivisor;
        if (enemySpawnTimer <= 0) { spawnEnemy(); enemySpawnTimer = currentSpawnInterval * (0.8 + Math.random() * 0.4); }
        shootTimer -= deltaTime;
        if (shootTimer <= 0) { shoot(); }
        waveTimer -= deltaTime;
        if (waveTimer <= 0) { setGameState('betweenWaves'); intermissionTimer = INTERMISSION_DURATION; }
    } else if (gameState === 'betweenWaves') {
        moveProjectiles(); updateTowers(); checkDropsCollection();
        nearestEnemyForLaser = findNearestEnemy();
        intermissionTimer -= deltaTime;
        if (intermissionTimer <= 0) {
            currentWave++; waveTimer = WAVE_DURATION; enemySpawnTimer = 0;
            if (!checkNewEnemyIntroduction()) { setGameState('playing'); } // These calls trigger logs
        }
    } else if (gameState === 'lootboxRevealing' || gameState === 'infoPopup' || gameState === 'selectingPerk' || gameState === 'lootboxOpening') {
        // Game logic paused
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'start') { drawStartScreen(); }
    else if (gameState === 'gameOver') { drawGameOverScreen(); }
    else { drawPath(); drawDrops(); drawTowers();
           // Filter out null/undefined enemies just in case
           enemies.filter(e => e).forEach(enemy => drawEnemy(enemy));
           projectiles.filter(p => p).forEach(p => drawProjectile(p));
           if (player) drawPlayer(); // Check if player exists
           drawUI();
    }
}

// === Game Loop ===
function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    deltaTime = (timestamp - lastTimestamp) / 1000;
    deltaTime = Math.min(deltaTime, 1 / 15); // Limit delta time
    lastTimestamp = timestamp;
    try { // Add try-catch for better error reporting during loop
        update();
        draw();
    } catch (error) {
        console.error("Error in game loop:", error);
        // Optionally stop the loop if errors are critical
        // return;
    }
    requestAnimationFrame(gameLoop);
}

// === Event Listener Setup ===
window.addEventListener('keydown', (e) => {
    // Allow key registration even when paused for potential future use? Currently no.
    if (gameState === 'playing' || gameState === 'betweenWaves') { keys[e.key] = true; }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) { e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; }); // Register keyup always

// UI Buttons (with null checks)
if (playButton) playButton.addEventListener('click', () => { if(gameState === 'start') resetGame(); });
if (retryButton) retryButton.addEventListener('click', () => { if(gameState === 'gameOver') resetGame(); });
perkButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        if (gameState === 'selectingPerk') {
            const perkType = e.target.getAttribute('data-perk');
            if (perkType) applyPerk(perkType);
        }
    });
});
if (infoOkButton) infoOkButton.addEventListener('click', () => { if(gameState === 'infoPopup') setGameState(nextStateAfterPopup); });
if (lootboxOpenButton) lootboxOpenButton.addEventListener('click', () => { if(gameState === 'lootboxOpening') openLootbox(); });
if (lootboxOkButton) lootboxOkButton.addEventListener('click', () => { if(gameState === 'lootboxRevealing') setGameState(nextStateAfterPopup); });

// --- Initialisierung ---
console.log("Spiel initialisiert. Warte auf Start.");
// Initial game state setting MUST happen after all functions are defined.
setGameState('start'); // Starte im Startbildschirm
requestAnimationFrame(gameLoop); // Starte die Schleife
