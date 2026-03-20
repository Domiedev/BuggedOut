const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameImages = {};
let imagesLoaded = false;

const playButton = document.getElementById('playButton');
const retryButton = document.getElementById('retryButton');
const perkSelectionDiv = document.getElementById('perkSelection');
const perkButtons = document.querySelectorAll('.perkButton');
const infoPopupDiv = document.getElementById('infoPopup');
const infoTextP = document.getElementById('infoText');
const infoOkButton = document.getElementById('infoOkButton');
const lootboxPopupDiv = document.getElementById('lootboxPopup');
const lootboxTextP = document.getElementById('lootboxText');
const lootboxOpenButton = document.getElementById('lootboxOpenButton');
const lootboxOkButton = document.getElementById('lootboxOkButton');

let gameState;
let nextStateAfterPopup = 'playing';
let lastTimestamp = 0;
let deltaTime = 0;

let player = {};
let enemies = [];
let projectiles = [];
let towers = [];
let drops = [];
let keys = {};

let currentWave = 0;
let waveTimer = 0;
let intermissionTimer = 0;
let enemySpawnTimer = 0;
let shootTimer = 0;
let nearestEnemyForLaser = null;
let enemyToIntroduce = null;
let availableEnemyTypes = ['goon'];
let introducedEnemies = {};

let lootboxSpinningTimer = 0;
let lootboxReel = [];
let lootboxReelPosition = 0;
let lootboxSpinSpeed = 1500;
let lootboxTargetIndex = 0;
let lootboxFinalItem = null;
let pendingLevelUps = 0;

const PLAYER_MAX_HEALTH = 20;
const BASE_XP_FOR_NEXT_LEVEL = 500;
const WAVE_DURATION = 30;
const INTERMISSION_DURATION = 10;
const PLAYER_BASE_SPEED = 200;
const BASE_SHOOT_INTERVAL = 0.75;
const BASE_PROJECTILE_DAMAGE = 25;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 32;
const ENEMY_DROP_CHANCE = 0.02;
const LOOTBOX_SPIN_DURATION = 2.0;
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
    goon: { name: "Goon", health: 50, speed: 50, color: '#FF0000', xp: 50, width: 28, height: 24, description: "Standard slime bug enemy." },
    tank: { name: "Tank", health: 200, speed: 30, color: '#8B0000', xp: 150, width: 40, height: 40, description: "Slow, but very high health." },
    sprinter: { name: "Sprinter", health: 30, speed: 120, color: '#FFA500', xp: 75, width: 25, height: 25, description: "Very fast, but low health." }
};

const TOWER_TYPES = {
    flamethrower: { name: "Flamethrower", color: '#FF4500', range: 100, cooldown: 0.1, burnDuration: 2.0, burnDamagePerSecond: 5, vulnerability: 1.25, cost: 0 },
    sniper: { name: "Sniper", color: '#006400', range: 400, cooldown: 3.0, baseDamage: 100, chargeRate: 1.0, maxCharge: 100, target: 'strongest', cost: 0 },
    trap: { name: "Spike Trap", color: '#696969', range: 15, cooldown: 5.0, damage: 20, slowDuration: 3.0, slowFactor: 0.5, activeDuration: 0.5, cost: 0 }
};

const LOOTBOX_POSSIBLE_ITEMS = [
    { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } },
    { type: 'level', value: 2, display: { color: 'orange', text: "+2 LVL" } },
    { type: 'level', value: 3, display: { color: 'red', text: "+3 LVL" } },
    { type: 'tower', value: 'flamethrower', display: { color: '#FF4500', text: "Flamer" } },
    { type: 'tower', value: 'sniper', display: { color: '#006400', text: "Sniper" } },
    { type: 'tower', value: 'trap', display: { color: '#696969', text: "Trap" } },
    { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } },
    { type: 'tower', value: 'trap', display: { color: '#696969', text: "Trap" } },
    { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } }
];

function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawText(text, x, y, color, size, align, baseline) {
    color = color || 'black';
    size = size || '20px';
    align = align || 'center';
    baseline = baseline || 'middle';
    ctx.fillStyle = color;
    ctx.font = size + ' Arial';
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function distanceSq(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

function loadImages() {
    let imageSources = {
        playerUp: 'playerup.png',
        playerDown: 'playerdown.png',
        playerLeft: 'playerleft.png',
        playerRight: 'playerright.png',
        goon1: 'Goon1.png',
        background: 'background.png'
    };

    let totalImages = Object.keys(imageSources).length;
    let loadedCount = 0;
    let failed = false;

    for (let key in imageSources) {
        let img = new Image();
        img.onload = function() {
            gameImages[key] = img;
            loadedCount++;
            if (loadedCount >= totalImages && !failed) {
                imagesLoaded = true;
                setGameState('start');
                requestAnimationFrame(gameLoop);
            }
        };
        img.onerror = function() {
            failed = true;
            alert("Could not load image: " + imageSources[key]);
        };
        img.src = imageSources[key];
    }
}

function drawPlayer() {
    if (!imagesLoaded) return;

    let img;
    if (player.facingDirection == 'up') img = gameImages.playerUp;
    else if (player.facingDirection == 'left') img = gameImages.playerLeft;
    else if (player.facingDirection == 'right') img = gameImages.playerRight;
    else img = gameImages.playerDown;

    if (nearestEnemyForLaser) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
        ctx.lineTo(nearestEnemyForLaser.x + nearestEnemyForLaser.width / 2, nearestEnemyForLaser.y + nearestEnemyForLaser.height / 2);
        ctx.stroke();
    }

    if (img && img.naturalWidth > 0) {
        ctx.drawImage(img, player.x, player.y, player.width, player.height);
    } else {
        drawRect(player.x, player.y, player.width, player.height, 'blue');
    }
}

function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    if (enemy.type == 'goon' && imagesLoaded && gameImages.goon1 && gameImages.goon1.naturalWidth > 0) {
        ctx.drawImage(gameImages.goon1, 0, 0, enemy.width, enemy.height);
    } else {
        drawRect(0, 0, enemy.width, enemy.height, enemy.color);
    }

    ctx.restore();

    let barX = enemy.x;
    let barY = enemy.y - 7;
    let healthPct = Math.max(0, enemy.currentHealth / enemy.maxHealth);
    drawRect(barX, barY, enemy.width, 5, '#555');
    drawRect(barX, barY, enemy.width * healthPct, 5, 'lime');

    ctx.lineWidth = 2;
    if (enemy.statusEffects.burning.duration > 0) {
        ctx.strokeStyle = 'orange';
        ctx.strokeRect(enemy.x - 1, enemy.y - 1, enemy.width + 2, enemy.height + 2);
    }
    if (enemy.statusEffects.slowed.duration > 0) {
        ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
    ctx.lineWidth = 1;
}

function drawProjectile(p) {
    drawRect(p.x, p.y, p.width, p.height, p.color);
}

function drawPath() {
    ctx.strokeStyle = 'grey';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(enemyPath[0].x, enemyPath[0].y);
    for (let i = 1; i < enemyPath.length; i++) {
        ctx.lineTo(enemyPath[i].x, enemyPath[i].y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
}

function drawXPBar() {
    let barH = 20;
    let barW = canvas.width * 0.8;
    let barX = canvas.width * 0.1;
    let barY = canvas.height - barH - 10;
    let pct = player.xpForNextLevel > 0 ? Math.max(0, Math.min(1, player.xp / player.xpForNextLevel)) : 0;
    drawRect(barX, barY, barW, barH, '#555');
    drawRect(barX, barY, barW * pct, barH, 'yellow');
    drawText('Level: ' + player.level + ' | XP: ' + player.xp + ' / ' + player.xpForNextLevel, canvas.width / 2, barY + barH / 2, 'black', '14px');
}

function drawDrops() {
    for (let i = 0; i < drops.length; i++) {
        let drop = drops[i];
        ctx.fillStyle = 'aqua';
        ctx.beginPath();
        ctx.moveTo(drop.x + drop.width / 2, drop.y);
        ctx.lineTo(drop.x + drop.width, drop.y + drop.height / 2);
        ctx.lineTo(drop.x + drop.width / 2, drop.y + drop.height);
        ctx.lineTo(drop.x, drop.y + drop.height / 2);
        ctx.closePath();
        ctx.fill();
    }
}

function drawTowers() {
    for (let i = 0; i < towers.length; i++) {
        let tower = towers[i];
        let w = tower.width;
        let h = tower.height;
        ctx.save();
        ctx.translate(tower.x, tower.y);
        drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.3, '#555');

        if (tower.type == 'flamethrower') {
            drawRect(w * 0.2, h * 0.4, w * 0.6, h * 0.4, '#A0522D');
            drawRect(w * 0.4, h * 0.1, w * 0.2, h * 0.4, tower.color);
            drawRect(w * 0.35, 0, w * 0.3, h * 0.1, '#666');
        } else if (tower.type == 'sniper') {
            drawRect(w * 0.4, 0, w * 0.2, h * 0.8, tower.color);
            drawRect(w * 0.25, h * 0.5, w * 0.5, h * 0.25, '#444');
            drawRect(w * 0.3, h * 0.4, w * 0.4, h * 0.1, '#333');
            drawText(Math.floor(tower.chargePercent) + '%', w / 2, -10, 'cyan', '12px');
        } else if (tower.type == 'trap') {
            if (tower.isActive) {
                drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.2, '#888');
                ctx.fillStyle = '#A9A9A9';
                ctx.beginPath();
                ctx.moveTo(w * 0.2, h * 0.8);
                ctx.lineTo(w * 0.3, h * 0.3);
                ctx.lineTo(w * 0.4, h * 0.8);
                ctx.moveTo(w * 0.6, h * 0.8);
                ctx.lineTo(w * 0.7, h * 0.3);
                ctx.lineTo(w * 0.8, h * 0.8);
                ctx.fill();
            } else {
                drawRect(w * 0.2, h * 0.8, w * 0.6, h * 0.1, '#666');
            }
        } else {
            drawRect(0, 0, w, h, tower.color);
        }

        ctx.restore();
    }
}

function drawUI() {
    if (!player) return;
    drawText('Lives: ' + player.health, 60, 30, 'red', '20px', 'left');
    drawText('Wave: ' + currentWave, canvas.width - 60, 30, 'blue', '20px', 'right');
    if (gameState == 'playing') {
        drawText('Time left: ' + Math.ceil(waveTimer) + 's', canvas.width / 2, 30);
    } else if (gameState == 'betweenWaves') {
        drawText('Next wave in: ' + Math.ceil(intermissionTimer) + 's', canvas.width / 2, canvas.height / 2 - 50, 'orange', '30px');
        drawText('Prepare for Wave ' + (currentWave + 1), canvas.width / 2, canvas.height / 2);
    }
    drawXPBar();
}

function drawStartScreen() {
    ctx.font = "bold 70px Arial";
    ctx.fillStyle = '#3498db';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("BUGGED OUT", canvas.width / 2, canvas.height / 2 - 60);
    drawText("Click the 'Play' button below to begin!", canvas.width / 2, canvas.height / 2 + 40, 'white', '22px');
    drawText("Use Arrow Keys or WASD to Move", canvas.width / 2, canvas.height / 2 + 75, '#bdc3c7', '16px');
    drawText("Spacebar Skips Intermission", canvas.width / 2, canvas.height / 2 + 100, '#bdc3c7', '16px');
}

function drawGameOverScreen() {
    drawRect(0, 0, canvas.width, canvas.height, 'rgba(100, 0, 0, 0.8)');
    drawText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40, 'white', '60px');
    drawText('You reached Wave: ' + currentWave, canvas.width / 2, canvas.height / 2 + 20, 'white', '30px');
}

function drawLootboxSpinning() {
    let displayWidth = canvas.width * 0.8;
    let displayX = canvas.width * 0.1;
    let displayY = canvas.height / 2 - 50;
    let itemHeight = 100;

    ctx.save();
    ctx.beginPath();
    ctx.rect(displayX, displayY, displayWidth, itemHeight);
    ctx.clip();

    let firstVisible = Math.floor(lootboxReelPosition / LOOTBOX_ITEM_WIDTH);
    let startX = displayX - (lootboxReelPosition % LOOTBOX_ITEM_WIDTH);

    for (let i = 0; i < (displayWidth / LOOTBOX_ITEM_WIDTH) + 2; i++) {
        let idx = (firstVisible + i) % lootboxReel.length;
        if (idx < 0) idx += lootboxReel.length;
        let item = lootboxReel[idx];
        if (!item || !item.display) continue;
        drawRect(startX, displayY, LOOTBOX_ITEM_WIDTH - 10, itemHeight, item.display.color || '#ccc');
        drawText(item.display.text || '?', startX + (LOOTBOX_ITEM_WIDTH - 10) / 2, displayY + itemHeight / 2, 'white', '18px');
        startX += LOOTBOX_ITEM_WIDTH;
    }

    ctx.restore();

    let markerX = canvas.width / 2;
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(markerX - 10, displayY - 10);
    ctx.lineTo(markerX + 10, displayY - 10);
    ctx.lineTo(markerX, displayY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(markerX - 10, displayY + itemHeight + 10);
    ctx.lineTo(markerX + 10, displayY + itemHeight + 10);
    ctx.lineTo(markerX, displayY + itemHeight);
    ctx.closePath();
    ctx.fill();
}

function updatePlayerMovement() {
    let ix = 0;
    let iy = 0;
    if (keys['ArrowUp'] || keys['w']) iy = -1;
    if (keys['ArrowDown'] || keys['s']) iy = 1;
    if (keys['ArrowLeft'] || keys['a']) ix = -1;
    if (keys['ArrowRight'] || keys['d']) ix = 1;

    if (ix > 0) player.facingDirection = 'right';
    else if (ix < 0) player.facingDirection = 'left';
    else if (iy > 0) player.facingDirection = 'down';
    else if (iy < 0) player.facingDirection = 'up';

    let mx = ix;
    let my = iy;
    if (ix != 0 && iy != 0) {
        mx = ix / Math.sqrt(2);
        my = iy / Math.sqrt(2);
    }
    player.dx = mx * player.speed;
    player.dy = my * player.speed;
}

function movePlayer() {
    if (!player) return;
    updatePlayerMovement();
    player.x += player.dx * deltaTime;
    player.y += player.dy * deltaTime;
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y > canvas.height - player.height) player.y = canvas.height - player.height;
}

function spawnEnemy() {
    let typeKey = getRandomElement(availableEnemyTypes);
    let typeConfig = ENEMY_TYPES[typeKey];
    let mult = 1 + (currentWave - 1) * 0.15;
    let hp = typeConfig.health * mult;
    let spd = typeConfig.speed * (1 + (currentWave - 1) * 0.05);
    let xp = Math.ceil(typeConfig.xp * (1 + (currentWave - 1) * 0.1));

    enemies.push({
        type: typeKey,
        x: enemyPath[0].x - typeConfig.width / 2,
        y: enemyPath[0].y - typeConfig.height / 2,
        width: typeConfig.width,
        height: typeConfig.height,
        speed: spd,
        baseSpeed: spd,
        maxHealth: hp,
        currentHealth: hp,
        color: typeConfig.color,
        pathIndex: 0,
        value: xp,
        statusEffects: {
            burning: { duration: 0, damageInterval: 0.5, damageTimer: 0, damageAmount: 0 },
            slowed: { duration: 0, speedMultiplier: 1 }
        }
    });
}

function updateEnemyStatusEffects(enemy) {
    let died = false;
    let burn = enemy.statusEffects.burning;
    if (burn.duration > 0) {
        burn.duration -= deltaTime;
        burn.damageTimer -= deltaTime;
        if (burn.damageTimer <= 0) {
            enemy.currentHealth -= burn.damageAmount;
            burn.damageTimer = burn.damageInterval;
            if (enemy.currentHealth <= 0) died = true;
        }
        if (burn.duration < 0) burn.duration = 0;
    }

    let slow = enemy.statusEffects.slowed;
    if (slow.duration > 0) {
        slow.duration -= deltaTime;
        enemy.speed = enemy.baseSpeed * slow.speedMultiplier;
        if (slow.duration <= 0) {
            slow.duration = 0;
            enemy.speed = enemy.baseSpeed;
        }
    } else {
        enemy.speed = enemy.baseSpeed;
    }
    return died;
}

function moveEnemies() {
    if (gameState != 'playing') return;
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (!enemies[i]) continue;
        let enemy = enemies[i];

        if (updateEnemyStatusEffects(enemy)) {
            let idx = enemies.indexOf(enemy);
            if (idx > -1) handleEnemyDefeat(enemy, idx);
            continue;
        }

        if (!enemies.includes(enemy)) continue;

        let target = enemyPath[enemy.pathIndex];
        let dx = target.x - (enemy.x + enemy.width / 2);
        let dy = target.y - (enemy.y + enemy.height / 2);
        let dist = Math.sqrt(dx * dx + dy * dy);
        let moveAmt = enemy.speed * deltaTime;

        if (dist < moveAmt || dist == 0) {
            enemy.x = target.x - enemy.width / 2;
            enemy.y = target.y - enemy.height / 2;
            enemy.pathIndex++;
            if (enemy.pathIndex >= enemyPath.length) {
                player.health--;
                enemies.splice(i, 1);
                if (player.health <= 0) setGameState('gameOver');
            }
        } else {
            enemy.x += (dx / dist) * moveAmt;
            enemy.y += (dy / dist) * moveAmt;
        }
    }
}

function findNearestEnemy() {
    nearestEnemyForLaser = null;
    if (enemies.length == 0 || !player) return null;
    let nearest = null;
    let minDist = Infinity;
    let pcx = player.x + player.width / 2;
    let pcy = player.y + player.height / 2;
    for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        let d = distanceSq(pcx, pcy, e.x + e.width / 2, e.y + e.height / 2);
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    }
    nearestEnemyForLaser = nearest;
    return nearest;
}

function findStrongestEnemy() {
    let strongest = null;
    let maxHp = -1;
    for (let i = 0; i < enemies.length; i++) {
        if (enemies[i].maxHealth > maxHp) {
            maxHp = enemies[i].maxHealth;
            strongest = enemies[i];
        }
    }
    return strongest;
}

function shoot() {
    if (gameState != 'playing' || enemies.length == 0 || !player) return;
    let target = findNearestEnemy();
    if (!target) return;

    let pcx = player.x + player.width / 2;
    let pcy = player.y + player.height / 2;
    let tx = target.x + target.width / 2;
    let ty = target.y + target.height / 2;
    let baseAngle = Math.atan2(ty - pcy, tx - pcx);
    let spread = player.projectileCount > 1 ? Math.PI / 12 : 0;
    let speed = 400;

    for (let i = 0; i < player.projectileCount; i++) {
        let angle = baseAngle;
        if (player.projectileCount > 1) {
            angle += spread * (i - (player.projectileCount - 1) / 2);
        }
        projectiles.push({
            x: pcx - 2.5,
            y: pcy - 2.5,
            width: 5,
            height: 5,
            color: 'black',
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: player.currentDamage
        });
    }
    shootTimer = player.currentShootInterval;
}

function handleEnemyDefeat(enemy, index) {
    if (!enemies[index] || enemies[index] != enemy) {
        index = enemies.indexOf(enemy);
        if (index == -1) return;
    }
    gainXP(enemy.value);
    if (Math.random() < ENEMY_DROP_CHANCE) {
        drops.push({
            x: enemy.x + enemy.width / 2 - 5,
            y: enemy.y + enemy.height / 2 - 5,
            width: 10,
            height: 10
        });
    }
    if (nearestEnemyForLaser == enemy) nearestEnemyForLaser = null;
    enemies.splice(index, 1);
}

function moveProjectiles() {
    if (gameState != 'playing' && gameState != 'betweenWaves') return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;

        if (p.x < -p.width || p.x > canvas.width || p.y < -p.height || p.y > canvas.height) {
            projectiles.splice(i, 1);
            continue;
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (!enemies[j]) continue;
            let e = enemies[j];
            if (p.x < e.x + e.width && p.x + p.width > e.x && p.y < e.y + e.height && p.y + p.height > e.y) {
                let dmg = p.damage;
                if (e.statusEffects.burning.duration > 0) dmg *= TOWER_TYPES.flamethrower.vulnerability;
                e.currentHealth -= dmg;
                projectiles.splice(i, 1);
                if (e.currentHealth <= 0) handleEnemyDefeat(e, j);
                hit = true;
                break;
            }
        }
    }
}

function updateTowers() {
    for (let i = 0; i < towers.length; i++) {
        let tower = towers[i];
        tower.cooldownTimer = Math.max(0, tower.cooldownTimer - deltaTime);

        if (tower.cooldownTimer <= 0) {
            if (tower.type == 'flamethrower') updateFlamethrower(tower);
            else if (tower.type == 'sniper') updateSniper(tower);
            else if (tower.type == 'trap') updateTrap(tower);
        }

        if (tower.type == 'trap' && tower.isActive) {
            tower.activeTimer -= deltaTime;
            if (tower.activeTimer <= 0) tower.isActive = false;
        } else if (tower.type == 'sniper') {
            tower.chargePercent = Math.min(tower.maxCharge, tower.chargePercent + tower.chargeRate * deltaTime);
        }
    }
}

function updateFlamethrower(tower) {
    tower.cooldownTimer = tower.cooldown;
    let cx = tower.x + tower.width / 2;
    let cy = tower.y + tower.height / 2;
    for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        if (distanceSq(cx, cy, e.x + e.width / 2, e.y + e.height / 2) < tower.range * tower.range) {
            e.statusEffects.burning = {
                duration: TOWER_TYPES.flamethrower.burnDuration,
                damageInterval: 0.5,
                damageTimer: 0.5,
                damageAmount: TOWER_TYPES.flamethrower.burnDamagePerSecond * 0.5
            };
        }
    }
}

function updateSniper(tower) {
    let target = findStrongestEnemy();
    if (target) {
        tower.cooldownTimer = tower.cooldown;
        let dmg = TOWER_TYPES.sniper.baseDamage * (1 + tower.chargePercent / 100);
        if (target.statusEffects.burning.duration > 0) dmg *= TOWER_TYPES.flamethrower.vulnerability;
        target.currentHealth -= dmg;
        tower.chargePercent = 0;
        if (target.currentHealth <= 0) {
            let idx = enemies.indexOf(target);
            if (idx > -1) handleEnemyDefeat(target, idx);
        }
    }
}

function updateTrap(tower) {
    let triggered = false;
    let cx = tower.x + tower.width / 2;
    let cy = tower.y + tower.height / 2;
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        if (distanceSq(cx, cy, e.x + e.width / 2, e.y + e.height / 2) < tower.range * tower.range) {
            triggered = true;
            e.currentHealth -= TOWER_TYPES.trap.damage;
            e.statusEffects.slowed = { duration: TOWER_TYPES.trap.slowDuration, speedMultiplier: TOWER_TYPES.trap.slowFactor };
            if (e.currentHealth <= 0) handleEnemyDefeat(e, i);
        }
    }
    if (triggered) {
        tower.isActive = true;
        tower.activeTimer = tower.activeDuration;
        tower.cooldownTimer = tower.cooldown;
    }
}

function checkDropsCollection() {
    if (gameState != 'playing' && gameState != 'betweenWaves') return;
    if (!player) return;
    for (let i = drops.length - 1; i >= 0; i--) {
        let d = drops[i];
        if (player.x < d.x + d.width && player.x + player.width > d.x &&
            player.y < d.y + d.height && player.y + player.height > d.y) {
            drops.splice(i, 1);
            triggerLootbox();
            break;
        }
    }
}

function setupLootboxReel() {
    lootboxReel = [];
    for (let i = 0; i < 50; i++) {
        lootboxReel.push(getRandomElement(LOOTBOX_POSSIBLE_ITEMS));
    }

    let roll = Math.random();
    if (roll < 0.1) {
        lootboxFinalItem = { type: 'level', value: 3, display: { color: 'red', text: "+3 LVL" } };
    } else if (roll < 0.3) {
        lootboxFinalItem = { type: 'level', value: 2, display: { color: 'orange', text: "+2 LVL" } };
    } else if (roll < 0.6) {
        lootboxFinalItem = { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } };
    } else {
        let towerType = getRandomElement(Object.keys(TOWER_TYPES));
        lootboxFinalItem = { type: 'tower', value: towerType, display: { color: TOWER_TYPES[towerType].color, text: TOWER_TYPES[towerType].name.substring(0, 6) } };
    }

    lootboxTargetIndex = Math.max(10, lootboxReel.length - 10 - Math.floor(Math.random() * 5));
    lootboxReel[lootboxTargetIndex] = lootboxFinalItem;
}

function triggerLootbox() {
    setupLootboxReel();
    nextStateAfterPopup = gameState;
    setGameState('lootboxOpening');
    if (lootboxTextP) lootboxTextP.textContent = "You found a Lootbox!";
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'inline-block';
    if (lootboxOkButton) lootboxOkButton.style.display = 'none';
    if (lootboxPopupDiv) lootboxPopupDiv.style.display = 'block';
}

function openLootbox() {
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'none';
    if (lootboxTextP) lootboxTextP.textContent = "Spinning!";
    lootboxSpinningTimer = LOOTBOX_SPIN_DURATION;
    lootboxReelPosition = 0;
    lootboxSpinSpeed = 1500 + Math.random() * 500;
    setGameState('lootboxSpinning');
}

function revealLootboxReward() {
    pendingLevelUps = 0;
    let rewardText = "";

    if (!lootboxFinalItem) {
        rewardText = "Error opening lootbox!";
    } else if (lootboxFinalItem.type == 'level') {
        rewardText = "You won " + lootboxFinalItem.value + " Level(s)!";
        pendingLevelUps = lootboxFinalItem.value;
    } else if (lootboxFinalItem.type == 'tower') {
        let ok = placeRandomTower(lootboxFinalItem.value);
        if (ok) rewardText = "You received a " + TOWER_TYPES[lootboxFinalItem.value].name + "!";
        else { rewardText = "No space for a tower! (+500 XP instead)"; gainXP(500); }
    } else {
        rewardText = "Unknown reward!?";
    }

    if (lootboxTextP) lootboxTextP.textContent = rewardText;
    if (lootboxOkButton) lootboxOkButton.style.display = 'inline-block';
    setGameState('lootboxRevealing');
}

function placeRandomTower(typeKey) {
    let tw = 30;
    let th = 30;
    let attempts = 0;
    while (attempts < 50) {
        attempts++;
        let rx = Math.random() * (canvas.width - tw - 40) + 20;
        let ry = Math.random() * (canvas.height - th - 40) + 20;
        let cx = rx + tw / 2;
        let cy = ry + th / 2;

        let badPath = false;
        for (let i = 0; i < enemyPath.length - 1; i++) {
            if (distanceSq(cx, cy, enemyPath[i].x, enemyPath[i].y) < 40 * 40 ||
                distanceSq(cx, cy, enemyPath[i + 1].x, enemyPath[i + 1].y) < 40 * 40) {
                badPath = true;
                break;
            }
        }
        if (badPath) continue;

        let badTower = false;
        for (let i = 0; i < towers.length; i++) {
            let t = towers[i];
            if (rx < t.x + t.width + 5 && rx + tw > t.x - 5 && ry < t.y + t.height + 5 && ry + th > t.y - 5) {
                badTower = true;
                break;
            }
        }
        if (badTower) continue;

        let newTower = {
            type: typeKey,
            x: rx, y: ry,
            width: tw, height: th,
            color: TOWER_TYPES[typeKey].color,
            range: TOWER_TYPES[typeKey].range,
            cooldown: TOWER_TYPES[typeKey].cooldown,
            cooldownTimer: Math.random() * TOWER_TYPES[typeKey].cooldown
        };

        if (typeKey == 'sniper') {
            newTower.baseDamage = TOWER_TYPES.sniper.baseDamage;
            newTower.chargeRate = TOWER_TYPES.sniper.chargeRate;
            newTower.maxCharge = TOWER_TYPES.sniper.maxCharge;
            newTower.chargePercent = 0;
        } else if (typeKey == 'flamethrower') {
            newTower.burnDamagePerSecond = TOWER_TYPES.flamethrower.burnDamagePerSecond;
            newTower.burnDuration = TOWER_TYPES.flamethrower.burnDuration;
            newTower.vulnerability = TOWER_TYPES.flamethrower.vulnerability;
        } else if (typeKey == 'trap') {
            newTower.damage = TOWER_TYPES.trap.damage;
            newTower.slowDuration = TOWER_TYPES.trap.slowDuration;
            newTower.slowFactor = TOWER_TYPES.trap.slowFactor;
            newTower.activeDuration = TOWER_TYPES.trap.activeDuration;
            newTower.isActive = false;
            newTower.activeTimer = 0;
        }

        towers.push(newTower);
        return true;
    }
    return false;
}

function gainXP(amount) {
    if (gameState == 'gameOver' || !player) return;
    player.xp += Math.round(amount);
    while (player.xp >= player.xpForNextLevel) {
        if (gameState != 'selectingPerk') levelUp();
        else break;
    }
}

function levelUp() {
    if (gameState == 'gameOver' || !player) return;
    nextStateAfterPopup = gameState;
    pendingLevelUps = 1;
    setGameState('selectingPerk');
}

function applyPerk(perkType) {
    if (!player || gameState != 'selectingPerk') return;

    if (perkType == 'speed') {
        player.shootSpeedMultiplier *= 5;
        player.currentShootInterval = BASE_SHOOT_INTERVAL / player.shootSpeedMultiplier;
    } else if (perkType == 'damage') {
        player.damageMultiplier *= 5;
        player.currentDamage = BASE_PROJECTILE_DAMAGE * player.damageMultiplier;
    } else if (perkType == 'shotgun') {
        player.projectileCount = Math.min(126, player.projectileCount + 5);
    }

    player.level++;
    player.xp = 0;
    player.xpForNextLevel = Math.floor(BASE_XP_FOR_NEXT_LEVEL * Math.pow(1.5, player.level - 1));
    pendingLevelUps--;

    if (pendingLevelUps > 0) {
        setGameState('selectingPerk');
    } else {
        if (player.xp >= player.xpForNextLevel && gameState != 'gameOver') levelUp();
        else setGameState(nextStateAfterPopup);
    }
}

function setGameState(newState) {
    if (gameState == newState) return;
    gameState = newState;

    if (playButton) playButton.style.display = (gameState == 'start') ? 'inline-block' : 'none';
    if (retryButton) retryButton.style.display = (gameState == 'gameOver') ? 'inline-block' : 'none';
    if (perkSelectionDiv) perkSelectionDiv.style.display = (gameState == 'selectingPerk') ? 'block' : 'none';
    if (infoPopupDiv) infoPopupDiv.style.display = (gameState == 'infoPopup') ? 'block' : 'none';
    if (lootboxPopupDiv) {
        let show = (gameState == 'lootboxOpening' || gameState == 'lootboxSpinning' || gameState == 'lootboxRevealing');
        lootboxPopupDiv.style.display = show ? 'block' : 'none';
    }
}

function checkNewEnemyIntroduction() {
    let newKey = null;
    if (currentWave == 3 && !introducedEnemies['tank']) newKey = 'tank';
    else if (currentWave == 6 && !introducedEnemies['sprinter']) newKey = 'sprinter';

    if (newKey && ENEMY_TYPES[newKey]) {
        availableEnemyTypes.push(newKey);
        enemyToIntroduce = ENEMY_TYPES[newKey];
        introducedEnemies[newKey] = true;
        nextStateAfterPopup = 'playing';
        setGameState('infoPopup');
        if (infoTextP) infoTextP.textContent = 'NEW ENEMY: ' + enemyToIntroduce.name.toUpperCase() + '! ' + enemyToIntroduce.description;
        return true;
    }
    return false;
}

function resetGame() {
    player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2,
        y: canvas.height / 2 - PLAYER_HEIGHT / 2,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        speed: PLAYER_BASE_SPEED,
        dx: 0, dy: 0,
        health: PLAYER_MAX_HEALTH,
        level: 1, xp: 0,
        xpForNextLevel: BASE_XP_FOR_NEXT_LEVEL,
        shootSpeedMultiplier: 1,
        damageMultiplier: 1,
        projectileCount: 1,
        currentShootInterval: BASE_SHOOT_INTERVAL,
        currentDamage: BASE_PROJECTILE_DAMAGE,
        facingDirection: 'down'
    };
    enemies = [];
    projectiles = [];
    drops = [];
    towers = [];
    keys = {};
    currentWave = 0;
    waveTimer = 0;
    intermissionTimer = 3;
    enemySpawnTimer = 0;
    shootTimer = 0;
    nearestEnemyForLaser = null;
    availableEnemyTypes = ['goon'];
    introducedEnemies = {};
    lastTimestamp = 0;
    deltaTime = 0;
    lootboxSpinningTimer = 0;
    lootboxReelPosition = 0;
    lootboxSpinSpeed = 1500;
    lootboxFinalItem = null;
    pendingLevelUps = 0;
    setupLootboxReel();
    setGameState('betweenWaves');
}

function update() {
    if (gameState == 'playing' || gameState == 'betweenWaves') {
        movePlayer();
        checkDropsCollection();
        moveProjectiles();
        updateTowers();
        nearestEnemyForLaser = findNearestEnemy();
    }

    if (gameState == 'playing') {
        moveEnemies();
        enemySpawnTimer -= deltaTime;
        let spawnInterval = Math.max(0.2, 1.5 / (1 + (currentWave - 1) * 0.1));
        spawnInterval = spawnInterval / Math.max(1, availableEnemyTypes.length * 0.8);
        if (enemySpawnTimer <= 0) {
            spawnEnemy();
            enemySpawnTimer = spawnInterval * (0.8 + Math.random() * 0.4);
        }
        shootTimer -= deltaTime;
        if (shootTimer <= 0) shoot();
        waveTimer -= deltaTime;
        if (waveTimer <= 0) {
            setGameState('betweenWaves');
            intermissionTimer = INTERMISSION_DURATION;
        }
    } else if (gameState == 'betweenWaves') {
        intermissionTimer -= deltaTime;
        if (intermissionTimer <= 0) {
            currentWave++;
            waveTimer = WAVE_DURATION;
            enemySpawnTimer = 0;
            if (!checkNewEnemyIntroduction()) setGameState('playing');
        }
    } else if (gameState == 'lootboxSpinning') {
        if (lootboxSpinningTimer > 0) {
            lootboxSpinningTimer -= deltaTime;
            lootboxReelPosition += lootboxSpinSpeed * deltaTime;
            let slowdown = Math.pow(LOOTBOX_FRICTION, deltaTime);
            if (lootboxSpinningTimer < LOOTBOX_SPIN_DURATION * 0.6) slowdown *= Math.pow(0.65, deltaTime);
            lootboxSpinSpeed *= slowdown;
            lootboxSpinSpeed = Math.max(30, lootboxSpinSpeed);
            if (lootboxSpinningTimer <= 0 || lootboxSpinSpeed <= 50) {
                revealLootboxReward();
                lootboxSpinningTimer = 0;
            }
        } else {
            revealLootboxReward();
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (imagesLoaded && gameImages.background && gameImages.background.naturalWidth > 0) {
        ctx.drawImage(gameImages.background, 0, 0, canvas.width, canvas.height);
    } else {
        drawRect(0, 0, canvas.width, canvas.height, '#333');
    }

    if (gameState == 'start') {
        drawStartScreen();
    } else if (gameState == 'gameOver') {
        drawGameOverScreen();
    } else if (gameState == 'lootboxSpinning') {
        drawPath();
        drawDrops();
        drawTowers();
        for (let i = 0; i < enemies.length; i++) { if (enemies[i]) drawEnemy(enemies[i]); }
        for (let i = 0; i < projectiles.length; i++) { if (projectiles[i]) drawProjectile(projectiles[i]); }
        if (player) drawPlayer();
        drawUI();
        drawLootboxSpinning();
    } else if (gameState) {
        drawPath();
        drawDrops();
        drawTowers();
        for (let i = 0; i < enemies.length; i++) { if (enemies[i]) drawEnemy(enemies[i]); }
        for (let i = 0; i < projectiles.length; i++) { if (projectiles[i]) drawProjectile(projectiles[i]); }
        if (player) drawPlayer();
        drawUI();
    }
}

function gameLoop(timestamp) {
    if (!imagesLoaded || !gameState) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawText("Loading...", canvas.width / 2, canvas.height / 2, 'white', '30px');
        requestAnimationFrame(gameLoop);
        return;
    }

    if (!lastTimestamp) lastTimestamp = timestamp;
    deltaTime = (timestamp - lastTimestamp) / 1000;
    if (deltaTime > 1 / 15) deltaTime = 1 / 15;
    lastTimestamp = timestamp;

    try {
        update();
        draw();
    } catch (e) {
        console.error("Game error:", e);
    }

    requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', function(e) {
    if (gameState == 'playing' || gameState == 'betweenWaves') keys[e.key] = true;

    if (e.code == 'Space' && gameState == 'betweenWaves') {
        intermissionTimer = 0;
        e.preventDefault();
    }
    if (e.code == 'Space' && gameState == 'lootboxSpinning') {
        revealLootboxReward();
        lootboxSpinningTimer = 0;
        e.preventDefault();
    }
});

window.addEventListener('keyup', function(e) {
    keys[e.key] = false;
});

if (playButton) playButton.addEventListener('click', function() {
    if (gameState == 'start') resetGame();
});

if (retryButton) retryButton.addEventListener('click', function() {
    if (gameState == 'gameOver') resetGame();
});

perkButtons.forEach(function(button) {
    button.addEventListener('click', function(e) {
        if (gameState == 'selectingPerk') {
            let perkType = e.target.getAttribute('data-perk');
            if (perkType) applyPerk(perkType);
        }
    });
});

if (infoOkButton) infoOkButton.addEventListener('click', function() {
    if (gameState == 'infoPopup') setGameState(nextStateAfterPopup);
});

if (lootboxOpenButton) lootboxOpenButton.addEventListener('click', function() {
    if (gameState == 'lootboxOpening') openLootbox();
});

if (lootboxOkButton) lootboxOkButton.addEventListener('click', function() {
    if (gameState == 'lootboxRevealing') {
        if (pendingLevelUps > 0) setGameState('selectingPerk');
        else setGameState(nextStateAfterPopup);
        lootboxOkButton.style.display = 'none';
    }
});

loadImages();
