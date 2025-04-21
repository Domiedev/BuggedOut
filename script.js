// === Canvas Setup ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === HTML Elemente ===
const playButton = document.getElementById('playButton');
const retryButton = document.getElementById('retryButton');
const perkSelectionDiv = document.getElementById('perkSelection');
const perkButtons = document.querySelectorAll('.perkButton');
// Neu für Info-Popup (kann man auch auf Canvas zeichnen)
// Füge hinzu in index.html: <div id="infoPopup" style="display: none; border: 2px solid black; padding: 20px; background: lightblue; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10;"><p id="infoText"></p><button id="infoOkButton">OK</button></div>
const infoPopupDiv = document.getElementById('infoPopup');
const infoTextP = document.getElementById('infoText');
const infoOkButton = document.getElementById('infoOkButton');
// Neu für Lootbox (ähnlich wie Info Popup)
// Füge hinzu in index.html: <div id="lootboxPopup" style="display: none; border: 2px solid gold; padding: 20px; background: lightyellow; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10;"><p id="lootboxText"></p><button id="lootboxOpenButton">Open!</button><button id="lootboxOkButton" style="display: none;">OK</button></div>
const lootboxPopupDiv = document.getElementById('lootboxPopup');
const lootboxTextP = document.getElementById('lootboxText');
const lootboxOpenButton = document.getElementById('lootboxOpenButton');
const lootboxOkButton = document.getElementById('lootboxOkButton');


// === Spielzustände ===
let gameState = 'start'; // 'start', 'playing', 'betweenWaves', 'gameOver', 'selectingPerk', 'infoPopup', 'lootboxOpening', 'lootboxRevealing'
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
const LOOTBOX_REVEAL_DURATION = 1.5; // Sekunden

// --- Player Config ---
const PLAYER_BASE_SPEED = 200; // Pixel pro Sekunde
const BASE_SHOOT_INTERVAL = 0.75; // Sekunden
const BASE_PROJECTILE_DAMAGE = 25;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 32; // Leicht höher für Helm/Kopf

// --- Gegner Konfiguration ---
const ENEMY_TYPES = {
    goon: {
        name: "Goon",
        health: 50, speed: 50, color: '#A8A8A8', // Grau
        xp: 50, width: 30, height: 30,
        description: "Standard grunt enemy."
    },
    tank: {
        name: "Tank",
        health: 200, speed: 30, color: '#8B0000', // Dunkelrot
        xp: 150, width: 40, height: 40,
        description: "Slow, but very high health."
    },
    sprinter: {
        name: "Sprinter",
        health: 30, speed: 120, color: '#FFA500', // Orange
        xp: 75, width: 25, height: 25,
        description: "Very fast, but low health."
    }
    // Weitere Typen hier hinzufügen
};
let availableEnemyTypes = ['goon'];
let introducedEnemies = {}; // Trackt, welche Beschreibungen gezeigt wurden

// --- Tower Konfiguration ---
const TOWER_TYPES = {
    flamethrower: {
        name: "Flamethrower", color: '#FF4500', range: 100, // OrangRot
        cooldown: 0.1, damage: 5, // Schaden pro Sekunde während der Effekt aktiv ist
        burnDuration: 2.0, vulnerability: 1.25, // 25% mehr Schaden
        cost: 0 // Wird ja gedroppt
    },
    sniper: {
        name: "Sniper", color: '#006400', range: 400, // Dunkelgrün
        cooldown: 3.0, baseDamage: 100,
        chargeRate: 5, maxCharge: 100, // 5% pro Sekunde, max 100% Bonus
        target: 'strongest', // Zielt auf stärkste (nicht 'goon')
        cost: 0
    },
    trap: {
        name: "Spike Trap", color: '#696969', range: 15, // Dunkelgrau (klein)
        cooldown: 5.0, damage: 20,
        slowDuration: 3.0, slowFactor: 0.5, // Halbiert Geschwindigkeit
        activeDuration: 0.5, // Wie lange die Falle sichtbar/aktiv ist
        cost: 0
    }
};

// --- Spielvariablen ---
let player = {}; // Wird in resetGame initialisiert
let enemies = [];
let projectiles = [];
let towers = [];
let drops = []; // Für Diamanten etc.
let keys = {};
let currentWave = 0;
let waveTimer = 0;
let intermissionTimer = 0;
let enemySpawnTimer = 0;
let shootTimer = 0;
let nearestEnemyForLaser = null;
let enemyToIntroduce = null; // Für Info Popup
let lootboxRevealTimer = 0;

const enemyPath = [ { x: 0, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 400 }, { x: 100, y: 400 }, { x: 100, y: 550 }];

// === Hilfsfunktionen === (drawRect, drawText wie vorher)
function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function drawText(text, x, y, color = 'black', size = '20px', align = 'center', baseline = 'middle') { ctx.fillStyle = color; ctx.font = `${size} Arial`; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(text, x, y); }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function distanceSq(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return dx * dx + dy * dy; }

// === Zeichnen Funktionen ===

function drawPlayer() {
    // Laser
    if (nearestEnemyForLaser && (gameState === 'playing' || gameState === 'betweenWaves')) {
        ctx.strokeStyle = 'red'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
        ctx.lineTo(nearestEnemyForLaser.x + nearestEnemyForLaser.width / 2, nearestEnemyForLaser.y + nearestEnemyForLaser.height / 2);
        ctx.stroke();
    }
    // Pixel Soldat (Sehr einfach)
    const bodyX = player.x + 4;
    const bodyY = player.y + 8;
    const bodyW = player.width - 8;
    const bodyH = player.height - 12;
    // Körper (Grau)
    drawRect(bodyX, bodyY, bodyW, bodyH, '#808080');
    // Kopf/Helm (Dunkleres Grau)
    drawRect(player.x + 8, player.y, player.width - 16, 8, '#696969');
    // Beine (Andeutung)
    drawRect(bodyX, bodyY + bodyH, 6, 4, '#696969');
    drawRect(bodyX + bodyW - 6, bodyY + bodyH, 6, 4, '#696969');
    // Waffe (Andeutung Seite)
    drawRect(player.x + player.width - 4, player.y + 12, 4, 8, '#505050');
}


function drawEnemy(enemy) {
    // Körper
    drawRect(enemy.x, enemy.y, enemy.width, enemy.height, enemy.color);
    // Lebensbalken
    const healthBarWidth = enemy.width;
    const healthBarHeight = 5;
    const barX = enemy.x;
    const barY = enemy.y - healthBarHeight - 2;
    const healthPercentage = enemy.currentHealth / enemy.maxHealth;
    drawRect(barX, barY, healthBarWidth, healthBarHeight, '#555');
    drawRect(barX, barY, healthBarWidth * healthPercentage, healthBarHeight, 'lime');

    // Statuseffekte visuell darstellen
    if (enemy.statusEffects.burning && enemy.statusEffects.burning.duration > 0) {
        ctx.strokeStyle = 'orange'; ctx.lineWidth = 2;
        ctx.strokeRect(enemy.x - 1, enemy.y - 1, enemy.width + 2, enemy.height + 2);
    }
    if (enemy.statusEffects.slowed && enemy.statusEffects.slowed.duration > 0) {
        // Leichter blauer Schimmer?
        drawRect(enemy.x, enemy.y, enemy.width, enemy.height, 'rgba(0, 0, 255, 0.2)');
    }
     ctx.lineWidth = 1; // Reset
}

function drawProjectile(p) { drawRect(p.x, p.y, p.width, p.height, p.color); }
function drawPath() { /*...*/ } // Wie vorher
function drawXPBar() { /*...*/ } // Wie vorher

function drawDrops() {
    for (const drop of drops) {
        // Einfacher Diamant
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
    for (const tower of towers) {
        ctx.fillStyle = tower.color;
        ctx.fillRect(tower.x, tower.y, tower.width, tower.height);
        // Tower-spezifische Visuals
        if (tower.type === 'sniper') {
            drawText(`${Math.floor(tower.chargePercent)}%`, tower.x + tower.width / 2, tower.y - 10, 'cyan', '12px');
        } else if (tower.type === 'trap' && tower.isActive) {
             // Zeichne Falle auf dem Pfad
             drawRect(tower.pathX - tower.range, tower.pathY - tower.range, tower.range*2, tower.range*2, tower.color);
        }
         // Reichweite anzeigen (optional)
        /*
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(tower.x + tower.width/2, tower.y + tower.height/2, tower.range, 0, Math.PI*2);
        ctx.stroke();
        */
    }
}

function drawUI() { /* ... Wie vorher, zeigt Leben, Welle etc. ... */
    drawText(`Lives: ${player.health}`, 60, 30, 'red', '20px', 'left');
    drawText(`Wave: ${currentWave}`, canvas.width - 60, 30, 'blue', '20px', 'right');
    if (gameState === 'playing') {
        drawText(`Time left: ${Math.ceil(waveTimer)}s`, canvas.width / 2, 30);
    } else if (gameState === 'betweenWaves') {
        drawText(`Next wave in: ${Math.ceil(intermissionTimer)}s`, canvas.width / 2, canvas.height / 2 - 50, 'orange', '30px');
        drawText(`Prepare for Wave ${currentWave + 1}`, canvas.width / 2, canvas.height / 2);
    }
    drawXPBar();
}

// === Spiel-Logik ===

function updatePlayerMovement() {
    // Korrigierte Bewegung (Fix #6)
    let intendedX = 0;
    let intendedY = 0;
    if (keys['ArrowUp'] || keys['w']) intendedY = -1;
    if (keys['ArrowDown'] || keys['s']) intendedY = 1;
    if (keys['ArrowLeft'] || keys['a']) intendedX = -1;
    if (keys['ArrowRight'] || keys['d']) intendedX = 1;

    let moveX = intendedX;
    let moveY = intendedY;

    // Normalisieren wenn diagonal
    if (intendedX !== 0 && intendedY !== 0) {
        const factor = 1 / Math.sqrt(2);
        moveX *= factor;
        moveY *= factor;
    }

    player.dx = moveX * player.speed;
    player.dy = moveY * player.speed;
}

function movePlayer() {
    if (gameState !== 'playing') {
        player.dx = 0; // Stoppen wenn nicht im Spiel
        player.dy = 0;
        return;
    }
    updatePlayerMovement(); // Aktualisiert dx, dy basierend auf keys

    player.x += player.dx * deltaTime; // Multiplizieren mit deltaTime
    player.y += player.dy * deltaTime;

    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
}

function spawnEnemy() {
    // Wähle zufälligen Typ aus den verfügbaren
    const typeKey = getRandomElement(availableEnemyTypes);
    const typeConfig = ENEMY_TYPES[typeKey];

    // Skalierung basierend auf Welle
    const waveMultiplier = 1 + (currentWave - 1) * 0.15; // +15% Stats pro Welle (ca.)
    const health = typeConfig.health * waveMultiplier;
    const speed = typeConfig.speed * (1 + (currentWave - 1) * 0.05); // Speed skaliert langsamer
    const xp = Math.ceil(typeConfig.xp * (1 + (currentWave - 1) * 0.1));

    enemies.push({
        type: typeKey,
        x: enemyPath[0].x - typeConfig.width / 2,
        y: enemyPath[0].y - typeConfig.height / 2,
        width: typeConfig.width,
        height: typeConfig.height,
        speed: speed,
        baseSpeed: speed, // Für Slow-Effekt
        maxHealth: health,
        currentHealth: health,
        color: typeConfig.color,
        pathIndex: 0,
        value: xp,
        statusEffects: { // Wichtig für Türme/Perks
            burning: { duration: 0, damageInterval: 0.5, damageTimer: 0, damageAmount: 0 },
            slowed: { duration: 0, speedMultiplier: 1 }
        }
    });
}

function updateEnemyStatusEffects(enemy) {
    // Burning
    let burn = enemy.statusEffects.burning;
    if (burn.duration > 0) {
        burn.duration -= deltaTime;
        burn.damageTimer -= deltaTime;
        if (burn.damageTimer <= 0) {
            enemy.currentHealth -= burn.damageAmount;
            burn.damageTimer = burn.damageInterval; // Reset timer
            // Minimalen Schaden sicherstellen oder runden?
            if (enemy.currentHealth <= 0) return true; // Signalisiert Tod durch Effekt
        }
        if (burn.duration <= 0) burn.duration = 0; // Effekt vorbei
    }

    // Slowed
    let slow = enemy.statusEffects.slowed;
    if (slow.duration > 0) {
        slow.duration -= deltaTime;
        enemy.speed = enemy.baseSpeed * slow.speedMultiplier;
        if (slow.duration <= 0) {
            slow.duration = 0;
            enemy.speed = enemy.baseSpeed; // Geschwindigkeit wiederherstellen
        }
    } else {
         enemy.speed = enemy.baseSpeed; // Sicherstellen, dass Speed normal ist
    }
    return false; // Nicht durch Effekt gestorben
}


function moveEnemies() {
    if (gameState !== 'playing') return;

    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];

        // Status Effekte anwenden
        if (updateEnemyStatusEffects(enemy)) {
             handleEnemyDefeat(enemy, i); // Gestorben durch DoT
             continue;
        }


        let targetPoint = enemyPath[enemy.pathIndex];
        let targetX = targetPoint.x;
        let targetY = targetPoint.y;

        let dx = targetX - (enemy.x + enemy.width / 2);
        let dy = targetY - (enemy.y + enemy.height / 2);
        let distance = Math.sqrt(dx * dx + dy * dy);

        let moveAmount = enemy.speed * deltaTime;

        if (distance < moveAmount) {
            enemy.pathIndex++;
            if (enemy.pathIndex >= enemyPath.length) {
                enemies.splice(i, 1);
                player.health--;
                if (player.health <= 0) {
                    setGameState('gameOver');
                }
                continue;
            }
             enemy.x = targetX - enemy.width/2;
             enemy.y = targetY - enemy.height/2;
        } else {
            enemy.x += (dx / distance) * moveAmount;
            enemy.y += (dy / distance) * moveAmount;
        }
    }
}

function findNearestEnemy() { /* ... unverändert ... */ }
function findStrongestEnemy() {
    let strongest = null;
    let maxHealth = -1;
    for (const enemy of enemies) {
         if (enemy.type === 'goon') continue; // Ignoriert Goons für Sniper-Ziel
         if (enemy.currentHealth > maxHealth) {
             maxHealth = enemy.currentHealth;
             strongest = enemy;
         }
    }
    // Wenn keine "starken" da sind, nimm irgendeinen (außer Goon)? Oder null?
    if (!strongest && enemies.length > 0) {
       // Fallback? Optional, aktuell null
    }
    return strongest;
}


function shoot() { /* ... fast unverändert, nutzt jetzt player.currentShootInterval ... */ }

function handleEnemyDefeat(enemy, index) {
     gainXP(enemy.value);
     // Drop Chance
     if (Math.random() < ENEMY_DROP_CHANCE) {
         drops.push({
             x: enemy.x + enemy.width / 2 - 5, // Zentriert
             y: enemy.y + enemy.height / 2 - 5,
             width: 10, height: 10
         });
     }
     enemies.splice(index, 1);
}


function moveProjectiles() {
    if (gameState !== 'playing' && gameState !== 'betweenWaves') return;

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        // Projektilgeschwindigkeit jetzt Pixel pro Sekunde
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;

        // Entfernen wenn außerhalb
        if (p.x < -p.width || p.x > canvas.width || p.y < -p.height || p.y > canvas.height) {
            projectiles.splice(i, 1); continue;
        }

        // Kollision mit Gegnern
        for (let j = enemies.length - 1; j >= 0; j--) {
            let enemy = enemies[j];
            if (p.x < enemy.x + enemy.width && p.x + p.width > enemy.x &&
                p.y < enemy.y + enemy.height && p.y + p.height > enemy.y) {

                let actualDamage = p.damage;
                // Verwundbarkeit durch Burning prüfen
                if (enemy.statusEffects.burning && enemy.statusEffects.burning.duration > 0) {
                    actualDamage *= TOWER_TYPES.flamethrower.vulnerability;
                }

                enemy.currentHealth -= actualDamage;
                projectiles.splice(i, 1); // Projektil weg

                if (enemy.currentHealth <= 0) {
                    handleEnemyDefeat(enemy, j);
                }
                break; // Projektil trifft nur einen
            }
        }
    }
}

function updateTowers() {
    for (const tower of towers) {
        tower.cooldownTimer -= deltaTime;
        if (tower.cooldownTimer <= 0) {
            switch (tower.type) {
                case 'flamethrower': updateFlamethrower(tower); break;
                case 'sniper': updateSniper(tower); break;
                case 'trap': updateTrap(tower); break;
            }
        }
        // Update spezifische Timer etc.
        if (tower.type === 'trap') {
             if (tower.isActive) {
                 tower.activeTimer -= deltaTime;
                 if (tower.activeTimer <= 0) tower.isActive = false;
             }
        } else if (tower.type === 'sniper' && !findStrongestEnemy()) { // Aufladen, wenn kein Ziel
             tower.chargePercent = Math.min(tower.maxCharge, tower.chargePercent + tower.chargeRate * deltaTime);
        }
    }
}

function updateFlamethrower(tower) {
    tower.cooldownTimer = tower.cooldown; // Reset cooldown fast, quasi dauerhaft
    let towerCenterX = tower.x + tower.width/2;
    let towerCenterY = tower.y + tower.height/2;

    for (let enemy of enemies) {
        let enemyCenterX = enemy.x + enemy.width/2;
        let enemyCenterY = enemy.y + enemy.height/2;
        if (distanceSq(towerCenterX, towerCenterY, enemyCenterX, enemyCenterY) < tower.range * tower.range) {
            // Gegner in Reichweite, Burn Effekt anwenden/erneuern
            enemy.statusEffects.burning = {
                 duration: tower.burnDuration,
                 damageInterval: 0.5, // Schaden alle 0.5s
                 damageTimer: 0, // Sofort erster Tick? Oder 0.5?
                 damageAmount: enemy.maxHealth * 0.05 // 5% Max HP Schaden pro Intervall
            };
        }
    }
    // Visuellen Effekt hinzufügen (Partikel) -> Komplexer, ausgelassen
}

function updateSniper(tower) {
    let target = findStrongestEnemy();
    if (target) {
        tower.cooldownTimer = tower.cooldown; // Reset Cooldown
        let damage = tower.baseDamage * (1 + tower.chargePercent / 100);

        // Projektil erzeugen (oder direkter Treffer?) - Direkter Treffer einfacher
        console.log(`Sniper Schuss auf ${target.type}! Schaden: ${damage.toFixed(0)} (Bonus: ${tower.chargePercent.toFixed(0)}%)`);
        target.currentHealth -= damage;
        tower.chargePercent = 0; // Ladung verbraucht

        if (target.currentHealth <= 0) {
             // Finde Index und rufe handleEnemyDefeat auf
             let index = enemies.indexOf(target);
             if(index > -1) handleEnemyDefeat(target, index);
        }
         // Visuellen Effekt hinzufügen (Schusslinie) -> Komplexer, ausgelassen
    } else {
        // Kein starkes Ziel, Cooldown nicht zurücksetzen, weiter aufladen
    }
}

function updateTrap(tower) {
    tower.cooldownTimer = tower.cooldown; // Reset Cooldown
    tower.isActive = true;
    tower.activeTimer = tower.activeDuration;
    // Falle wird jetzt in drawTowers gezeichnet, wenn isActive

    // Kollision mit Gegnern, wenn aktiv
    for (let enemy of enemies) {
         // Einfache Kollision der Falle (am Pfad) mit Gegner Mittelpunkt
         let enemyCenterX = enemy.x + enemy.width/2;
         let enemyCenterY = enemy.y + enemy.height/2;
         if (tower.isActive &&
             Math.abs(enemyCenterX - tower.pathX) < tower.range + enemy.width/2 &&
             Math.abs(enemyCenterY - tower.pathY) < tower.range + enemy.height/2 )
         {
              enemy.currentHealth -= tower.damage;
              enemy.statusEffects.slowed = {
                   duration: tower.slowDuration,
                   speedMultiplier: tower.slowFactor
              };
              console.log(`Falle ausgelöst von ${enemy.type}! Schaden: ${tower.damage}, Slowed.`);
              if (enemy.currentHealth <= 0) {
                    let index = enemies.indexOf(enemy);
                    if(index > -1) handleEnemyDefeat(enemy, index);
              }
              // Falle trifft nur einmal pro Aktivierung? Oder jeden Gegner der drüber läuft?
              // Aktuell jeden Gegner, solange aktiv.
         }
    }
}


function checkDropsCollection() {
    if (gameState !== 'playing') return;
    let playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    for (let i = drops.length - 1; i >= 0; i--) {
        let drop = drops[i];
        let dropRect = { x: drop.x, y: drop.y, width: drop.width, height: drop.height };
        // Einfache Rechteck-Kollision
        if (playerRect.x < dropRect.x + dropRect.width &&
            playerRect.x + playerRect.width > dropRect.x &&
            playerRect.y < dropRect.y + dropRect.height &&
            playerRect.y + playerRect.height > dropRect.y) {

            drops.splice(i, 1); // Drop entfernen
            triggerLootbox();   // Lootbox starten
            break; // Nur einen Drop pro Frame? Sicherer.
        }
    }
}

function triggerLootbox() {
    console.log("Lootbox getriggert!");
    setGameState('lootboxOpening');
    lootboxTextP.textContent = "You found a Lootbox!";
    lootboxOpenButton.style.display = 'inline-block';
    lootboxOkButton.style.display = 'none';
}

function openLootbox() {
    lootboxOpenButton.style.display = 'none';
    lootboxTextP.textContent = "Opening...";
    // Simple animation placeholder
    setTimeout(() => revealLootboxReward(), 500); // Warte 0.5s
    // Hier könnte man lootboxRevealTimer verwenden für eine Canvas-Animation
}

function revealLootboxReward() {
    let rewardText = "";
    if (Math.random() < 0.6) { // 60% Chance auf Level
        let levelsGained = Math.floor(Math.random() * 3) + 1;
        rewardText = `You gained ${levelsGained} Level(s)!`;
        // Direkte XP-Gabe ist einfacher zu handhaben
        gainXP(levelsGained * player.xpForNextLevel); // Gibt genug XP für die Level
    } else { // 40% Chance auf Turm
        let availableTowerTypes = Object.keys(TOWER_TYPES);
        let chosenTowerType = getRandomElement(availableTowerTypes);
        let success = placeRandomTower(chosenTowerType);
        if (success) {
             rewardText = `You received a ${TOWER_TYPES[chosenTowerType].name}!`;
        } else {
             rewardText = "You found a tower, but there was no space! (+500 XP instead)";
             gainXP(500);
        }
    }
    lootboxTextP.textContent = rewardText;
    lootboxOkButton.style.display = 'inline-block';
    // Nicht automatisch gameState ändern, warten auf OK
}

function placeRandomTower(typeKey) {
    const typeConfig = TOWER_TYPES[typeKey];
    const towerWidth = 30;
    const towerHeight = 30;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
        attempts++;
        // Zufällige Position, aber nicht zu nah am Rand oder Pfad
        let randX = Math.random() * (canvas.width - towerWidth - 40) + 20; // 20px Rand
        let randY = Math.random() * (canvas.height - towerHeight - 40) + 20;

        // Prüfe Kollision mit Pfad (sehr grob)
        let onPath = false;
        for(let i = 0; i < enemyPath.length - 1; i++) {
             // Simplifizierte Prüfung: Ist Turm in der Nähe einer Pfadlinie?
             // (Eine präzisere Prüfung wäre komplexer)
            let midPathX = (enemyPath[i].x + enemyPath[i+1].x) / 2;
            let midPathY = (enemyPath[i].y + enemyPath[i+1].y) / 2;
             if (distanceSq(randX + towerWidth/2, randY + towerHeight/2, midPathX, midPathY) < 100*100) { // 100px Radius um Pfadmitte
                 onPath = true; break;
             }
        }
         if (onPath) continue; // Zu nah am Pfad, neuer Versuch

        // Prüfe Kollision mit anderen Türmen
        let collidesWithTower = false;
        for (const otherTower of towers) {
             if (randX < otherTower.x + otherTower.width && randX + towerWidth > otherTower.x &&
                 randY < otherTower.y + otherTower.height && randY + towerHeight > otherTower.y) {
                 collidesWithTower = true; break;
             }
        }
        if (collidesWithTower) continue; // Kollidiert, neuer Versuch

        // Gültige Position gefunden!
         let newTower = {
             type: typeKey,
             x: randX, y: randY,
             width: towerWidth, height: towerHeight,
             color: typeConfig.color, range: typeConfig.range,
             cooldown: typeConfig.cooldown, cooldownTimer: Math.random() * typeConfig.cooldown, // Start mit zuf. Cooldown
             // Typ-spezifische Werte
             ...(typeKey === 'sniper' && { baseDamage: typeConfig.baseDamage, chargeRate: typeConfig.chargeRate, maxCharge: typeConfig.maxCharge, chargePercent: 0 }),
             ...(typeKey === 'flamethrower' && { damage: typeConfig.damage, burnDuration: typeConfig.burnDuration, vulnerability: typeConfig.vulnerability }),
             ...(typeKey === 'trap' && { damage: typeConfig.damage, slowDuration: typeConfig.slowDuration, slowFactor: typeConfig.slowFactor, activeDuration: typeConfig.activeDuration, isActive: false, activeTimer: 0, pathX: randX + towerWidth/2, pathY: randY + towerHeight/2 }) // Falle wird dort platziert wo der Turm steht
        };
         // Für Falle: Position auf dem Pfad finden? Aktuell nicht.

        towers.push(newTower);
        console.log(`Turm platziert: ${typeConfig.name} at (${randX.toFixed(0)}, ${randY.toFixed(0)})`);
        return true; // Erfolgreich platziert
    }
    console.log("Kein Platz für Turm gefunden nach", maxAttempts, "Versuchen.");
    return false; // Kein Platz gefunden
}


function gainXP(amount) { /* ... wie vorher ... */ }
function levelUp() { /* ... wie vorher, setzt gameState='selectingPerk' ... */ }
function applyPerk(perkType) { /* ... wie vorher ... */ }

// --- Zustandsmanagement ---
function setGameState(newState) {
    if (gameState === newState) return; // Nichts tun wenn Zustand gleich bleibt

    console.log(`Game State: ${gameState} -> ${newState}`);
    gameState = newState;

    // UI Elemente anpassen
    playButton.style.display = (gameState === 'start') ? 'inline-block' : 'none';
    retryButton.style.display = (gameState === 'gameOver') ? 'inline-block' : 'none';
    perkSelectionDiv.style.display = (gameState === 'selectingPerk') ? 'block' : 'none';
    infoPopupDiv.style.display = (gameState === 'infoPopup') ? 'block' : 'none';
    lootboxPopupDiv.style.display = (gameState === 'lootboxOpening' || gameState === 'lootboxRevealing') ? 'block' : 'none';


    if (newState === 'playing' || newState === 'betweenWaves') {
        canvas.focus();
    }
}

function checkNewEnemyIntroduction() {
    let waveIntroducesNewEnemy = false;
    let newEnemyKey = null;

    if (currentWave === ENEMY_INTRO_WAVES[0] && !introducedEnemies['tank']) {
        newEnemyKey = 'tank';
    } else if (currentWave === ENEMY_INTRO_WAVES[1] && !introducedEnemies['sprinter']) {
         newEnemyKey = 'sprinter';
    } // Weitere else if für mehr Gegner

    if (newEnemyKey) {
        availableEnemyTypes.push(newEnemyKey); // Füge Typ zu möglichen Spawns hinzu
        enemyToIntroduce = ENEMY_TYPES[newEnemyKey];
        introducedEnemies[newEnemyKey] = true; // Markiere als eingeführt (Popup wird gezeigt)
        nextStateAfterPopup = 'playing'; // Nach dem Popup geht's weiter
        setGameState('infoPopup');
        infoTextP.textContent = `NEW ENEMY APPROACHING: ${enemyToIntroduce.name}! ${enemyToIntroduce.description}`;
        return true; // Popup wurde getriggert
    }
    return false; // Kein Popup
}


// --- Reset Funktion ---
function resetGame() {
    player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2,
        y: canvas.height / 2 - PLAYER_HEIGHT / 2,
        width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
        speed: PLAYER_BASE_SPEED, // Pixel pro Sekunde
        color: 'blue', dx: 0, dy: 0,
        health: PLAYER_MAX_HEALTH, level: 1, xp: 0,
        xpForNextLevel: BASE_XP_FOR_NEXT_LEVEL,
        shootSpeedMultiplier: 1, damageMultiplier: 1, projectileCount: 1,
        currentShootInterval: BASE_SHOOT_INTERVAL, // Sekunden
        currentDamage: BASE_PROJECTILE_DAMAGE
    };
    enemies = []; projectiles = []; drops = []; towers = [];
    keys = {};
    currentWave = 0; // Wird in betweenWaves auf 1 gesetzt
    waveTimer = 0; intermissionTimer = 3; // Kurze Startpause
    enemySpawnTimer = 0; shootTimer = 0;
    nearestEnemyForLaser = null;
    availableEnemyTypes = ['goon']; // Reset auf Goons
    introducedEnemies = {}; // Reset Popups

    // Wichtig: Nicht direkt 'playing', sondern 'betweenWaves', damit Welle 1 startet
    setGameState('betweenWaves');
}

// --- Update & Draw (Hauptschleife) ---

function update() {
    // Zustandsabhängige Logik
    if (gameState === 'playing') {
        movePlayer();
        moveEnemies(); // Beinhaltet Status-Effekte
        moveProjectiles();
        updateTowers();
        checkDropsCollection();

        // Gegner Spawning Timer (deltaTime basiert)
        enemySpawnTimer -= deltaTime;
        const currentSpawnInterval = Math.max(0.1, (BASE_ENEMY_SPAWN_INTERVAL / (1 + (currentWave - 1) * 0.2)) / availableEnemyTypes.length ); // Schneller + mehr Typen = schneller spawn
        if (enemySpawnTimer <= 0) {
            spawnEnemy();
            enemySpawnTimer = currentSpawnInterval * (0.8 + Math.random() * 0.4); // Leichte Zufälligkeit
        }

        // Schießen Timer (deltaTime basiert)
        shootTimer -= deltaTime;
        if (shootTimer <= 0) {
            shoot();
            shootTimer = player.currentShootInterval;
        }

        // Wellen Timer (deltaTime basiert)
        waveTimer -= deltaTime;
        if (waveTimer <= 0) {
            setGameState('betweenWaves');
            intermissionTimer = INTERMISSION_DURATION;
        }

    } else if (gameState === 'betweenWaves') {
        moveProjectiles(); // Projektile fliegen weiter
        updateTowers(); // Türme können weiter schießen/aufladen
        checkDropsCollection(); // Drops aufsammeln
        nearestEnemyForLaser = findNearestEnemy(); // Laser zielt weiter

        intermissionTimer -= deltaTime;
        if (intermissionTimer <= 0) {
            currentWave++;
            waveTimer = WAVE_DURATION;
            enemySpawnTimer = 0;
             // Prüfen ob neue Gegner eingeführt werden
            if (!checkNewEnemyIntroduction()) {
                 // Wenn kein Popup kam, direkt starten
                 setGameState('playing');
            }
        }
    } else if (gameState === 'lootboxRevealing') {
         lootboxRevealTimer -= deltaTime;
         if (lootboxRevealTimer <= 0) {
              // Eigentliche Belohnungsanzeige (passiert jetzt über Button Klick)
         }
    }
    // In anderen Zuständen ('start', 'gameOver', 'selectingPerk', 'infoPopup', 'lootboxOpening') wird die meiste Logik pausiert.
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'start') {
        drawStartScreen(); // Wie vorher
    } else if (gameState === 'gameOver') {
        drawGameOverScreen(); // Wie vorher
    } else { // Alle anderen Zustände zeichnen das Spielfeld + ggf. Overlays
        drawPath();
        drawDrops();
        drawTowers(); // Türme hinter Gegnern? Oder davor? Davor.
        for (const enemy of enemies) drawEnemy(enemy);
        for (const p of projectiles) drawProjectile(p);
        drawPlayer();
        drawUI(); // Muss nach allem anderen sein für Overlay

        // Popups werden über HTML gesteuert, hier könnte man Canvas-Versionen zeichnen
        // if (gameState === 'infoPopup') drawInfoPopupOnCanvas();
        // if (gameState === 'lootboxOpening' || gameState === 'lootboxRevealing') drawLootboxOnCanvas();
        // if (gameState === 'selectingPerk') drawPerkSelectionOnCanvas();
    }
}

// === Game Loop ===
function gameLoop(timestamp) {
    deltaTime = (timestamp - lastTimestamp) / 1000; // Zeit in Sekunden
    // Verhindere große Sprünge wenn Tab inaktiv war etc. (max 1/15s Schritt)
    deltaTime = Math.min(deltaTime, 1/15);
    lastTimestamp = timestamp;

    update();
    draw();

    requestAnimationFrame(gameLoop);
}

// === Event Listener Setup ===
// Tastatur (wie vorher)
window.addEventListener('keydown', (e) => { /* ... */ });
window.addEventListener('keyup', (e) => { /* ... */ });

// UI Buttons
playButton.addEventListener('click', () => resetGame()); // Startet jetzt via resetGame
retryButton.addEventListener('click', () => resetGame());
perkButtons.forEach(button => button.addEventListener('click', (e) => { /* ... wie vorher ... */ }));

// Neue Popup Buttons
infoOkButton.addEventListener('click', () => {
    setGameState(nextStateAfterPopup); // Zurück zum Spiel/Pause
});
lootboxOpenButton.addEventListener('click', () => {
    openLootbox();
});
lootboxOkButton.addEventListener('click', () => {
    setGameState('playing'); // Zurück zum Spiel
});


// --- Initialisierung ---
console.log("Spiel initialisiert. Warte auf Start.");
setGameState('start');
requestAnimationFrame(gameLoop); // Starte die Schleife
