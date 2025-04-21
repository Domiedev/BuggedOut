// Wähle das Canvas-Element aus dem HTML aus
const canvas = document.getElementById('gameCanvas');
// Hole den 2D-Zeichenkontext
const ctx = canvas.getContext('2d');

// --- HTML Elemente für Buttons (optional, einfacher als Canvas-Buttons) ---
// Füge diese Buttons in deine index.html hinzu, z.B. unter dem Canvas:
/*
<div id="ui-layer" style="position: relative; text-align: center; margin-top: 10px;">
    <button id="playButton" style="display: none; padding: 15px 30px; font-size: 20px; cursor: pointer;">Play</button>
    <button id="retryButton" style="display: none; padding: 15px 30px; font-size: 20px; cursor: pointer;">Retry</button>
    <div id="perkSelection" style="display: none; border: 1px solid black; padding: 10px; background: rgba(200, 200, 200, 0.8); margin-top: 10px;">
        <h3>Level Up! Choose a Perk:</h3>
        <button class="perkButton" data-perk="speed">Shoot Speed +50%</button>
        <button class="perkButton" data-perk="damage">Damage +20%</button>
        <button class="perkButton" data-perk="shotgun">Shotgun (Projectile Count x2)</button>
    </div>
</div>
*/
const playButton = document.getElementById('playButton');
const retryButton = document.getElementById('retryButton');
const perkSelectionDiv = document.getElementById('perkSelection');
const perkButtons = document.querySelectorAll('.perkButton'); // Alle Perk-Buttons

// --- Spielzustände ---
let gameState = 'start'; // Mögliche Zustände: 'start', 'playing', 'betweenWaves', 'gameOver', 'selectingPerk'

// --- Spielkonstanten ---
const PLAYER_MAX_HEALTH = 20; // Wie viele Gegner dürfen durchkommen
const BASE_ENEMY_HEALTH = 50; // Basis-Gesundheit (braucht 2 Treffer bei 25 Schaden)
const BASE_ENEMY_SPEED = 1.5;
const BASE_ENEMY_SPAWN_INTERVAL = 120; // Frames
const BASE_SHOOT_INTERVAL = 45; // Frames (langsamer Start)
const BASE_PROJECTILE_DAMAGE = 25;
const XP_PER_KILL = 50;
const BASE_XP_FOR_NEXT_LEVEL = 500;
const WAVE_DURATION = 30 * 60; // 30 Sekunden in Frames
const INTERMISSION_DURATION = 10 * 60; // 10 Sekunden in Frames

// --- Spielvariablen ---
let player = {
    x: canvas.width / 2 - 15,
    y: canvas.height / 2 - 15,
    width: 30,
    height: 30,
    speed: 4, // Etwas langsamer als vorher
    color: 'blue',
    dx: 0,
    dy: 0,
    health: PLAYER_MAX_HEALTH,
    level: 1,
    xp: 0,
    xpForNextLevel: BASE_XP_FOR_NEXT_LEVEL,
    // Perks
    shootSpeedMultiplier: 1,
    damageMultiplier: 1,
    projectileCount: 1,
    // Calculated values
    currentShootInterval: BASE_SHOOT_INTERVAL,
    currentDamage: BASE_PROJECTILE_DAMAGE
};

let enemies = [];
let projectiles = [];
let keys = {};
let currentWave = 0; // Startet bei 0, erste Welle ist 1
let waveTimer = 0; // Zählt runter während der Welle
let intermissionTimer = 0; // Zählt runter zwischen Wellen
let enemySpawnTimer = 0;
let shootTimer = 0;
let nearestEnemyForLaser = null; // Für den Laser-Effekt

const enemyPath = [
    { x: 0, y: 100 },   { x: 700, y: 100 },
    { x: 700, y: 400 }, { x: 100, y: 400 },
    { x: 100, y: 550 }
];


// --- Hilfsfunktionen ---

function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawText(text, x, y, color = 'black', size = '20px', align = 'center', baseline = 'middle') {
    ctx.fillStyle = color;
    ctx.font = `${size} Arial`; // Einfache Schriftart, später anpassbar
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
}

// --- Zeichnen Funktionen ---

function drawPlayer() {
    // Laser zuerst zeichnen (falls Ziel vorhanden)
    if (nearestEnemyForLaser && gameState === 'playing') {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
        ctx.lineTo(nearestEnemyForLaser.x + nearestEnemyForLaser.width / 2, nearestEnemyForLaser.y + nearestEnemyForLaser.height / 2);
        ctx.stroke();
    }
    // Spieler zeichnen
    drawRect(player.x, player.y, player.width, player.height, player.color);
}

function drawEnemy(enemy) {
    // Gegnerkörper
    drawRect(enemy.x, enemy.y, enemy.width, enemy.height, enemy.color);
    // Lebensbalken
    const healthBarWidth = enemy.width;
    const healthBarHeight = 5;
    const barX = enemy.x;
    const barY = enemy.y - healthBarHeight - 2; // Leicht über dem Gegner
    const healthPercentage = enemy.currentHealth / enemy.maxHealth;

    // Hintergrund (grau)
    drawRect(barX, barY, healthBarWidth, healthBarHeight, '#555');
    // Vordergrund (grün)
    drawRect(barX, barY, healthBarWidth * healthPercentage, healthBarHeight, 'lime');
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
    const barHeight = 20;
    const barWidth = canvas.width * 0.8; // 80% der Canvas-Breite
    const barX = canvas.width * 0.1;
    const barY = canvas.height - barHeight - 10; // Am unteren Rand
    const xpPercentage = player.xp / player.xpForNextLevel;

    // Hintergrund
    drawRect(barX, barY, barWidth, barHeight, '#555');
    // Vordergrund (XP)
    drawRect(barX, barY, barWidth * xpPercentage, barHeight, 'yellow');
    // Text
    drawText(`Level: ${player.level} | XP: ${player.xp} / ${player.xpForNextLevel}`, canvas.width / 2, barY + barHeight / 2, 'black', '14px');
}

function drawUI() {
     // Spieler Lebenspunkte (verbleibende Gegner)
     drawText(`Lives: ${player.health}`, 60, 30, 'red', '20px', 'left');
     // Aktuelle Welle/Level
     drawText(`Wave: ${currentWave}`, canvas.width - 60, 30, 'blue', '20px', 'right');

    // Wellen Timer / Intermission Timer
    if (gameState === 'playing') {
        drawText(`Time left: ${Math.ceil(waveTimer / 60)}s`, canvas.width / 2, 30);
    } else if (gameState === 'betweenWaves') {
        drawText(`Next wave in: ${Math.ceil(intermissionTimer / 60)}s`, canvas.width / 2, canvas.height / 2 - 50, 'orange', '30px');
        drawText(`Prepare for Wave ${currentWave}`, canvas.width / 2, canvas.height / 2);
    }

    drawXPBar();
}


// --- Spiel-Logik Funktionen ---

function movePlayer() {
    if (gameState !== 'playing') return; // Nur im Spiel bewegen

    player.x += player.dx;
    player.y += player.dy;

    // Kollision mit Rändern
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.height, player.y));
}

function spawnEnemy() {
    // Schwierigkeit basierend auf Welle anpassen
    const health = BASE_ENEMY_HEALTH * (1 + (currentWave - 1) * 0.15); // +15% HP pro Welle nach Welle 1
    const speed = BASE_ENEMY_SPEED * (1 + (currentWave - 1) * 0.05);  // +5% Speed pro Welle nach Welle 1
    const color = `hsl(${Math.random() * 60 + 200}, 100%, 50%)`; // Bläulich/Violett Töne

    enemies.push({
        x: enemyPath[0].x - 15,
        y: enemyPath[0].y - 15,
        width: 30,
        height: 30,
        speed: speed,
        maxHealth: health,
        currentHealth: health,
        color: color, // Oder dynamisch basierend auf HP/Typ
        pathIndex: 0,
        value: XP_PER_KILL // XP-Wert
    });
}

function moveEnemies() {
    if (gameState !== 'playing') return;

    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        // Zielpunkt ist die Mitte des Pfad-Segments
        let targetPoint = enemyPath[enemy.pathIndex];
        let targetX = targetPoint.x;
        let targetY = targetPoint.y;

        let dx = targetX - (enemy.x + enemy.width / 2);
        let dy = targetY - (enemy.y + enemy.height / 2);
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < enemy.speed) {
            enemy.pathIndex++;
            if (enemy.pathIndex >= enemyPath.length) {
                // Gegner am Ziel
                enemies.splice(i, 1);
                player.health--; // Spieler verliert ein Leben
                if (player.health <= 0) {
                    setGameState('gameOver');
                }
                continue;
            }
            // Überschießen vermeiden (optional, aber gut)
            enemy.x = targetX - enemy.width/2;
            enemy.y = targetY - enemy.height/2;
        } else {
            // Bewegen
            enemy.x += (dx / distance) * enemy.speed;
            enemy.y += (dy / distance) * enemy.speed;
        }
    }
}

function findNearestEnemy() {
    nearestEnemyForLaser = null; // Reset für Laser
    if (enemies.length === 0) return null;

    let nearestEnemy = null;
    let minDistanceSq = Infinity;
    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;

    for (const enemy of enemies) {
        let dx = (enemy.x + enemy.width / 2) - playerCenterX;
        let dy = (enemy.y + enemy.height / 2) - playerCenterY;
        let distSq = dx * dx + dy * dy;

        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearestEnemy = enemy;
        }
    }
    nearestEnemyForLaser = nearestEnemy; // Ziel für Laser setzen
    return nearestEnemy;
}


function shoot() {
    if (gameState !== 'playing' || enemies.length === 0) return;

    const targetEnemy = findNearestEnemy(); // Finde das Ziel (auch für Laser)
    if (!targetEnemy) return;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const targetX = targetEnemy.x + targetEnemy.width / 2;
    const targetY = targetEnemy.y + targetEnemy.height / 2;

    const baseAngle = Math.atan2(targetY - playerCenterY, targetX - playerCenterX);
    const spreadAngle = Math.PI / 12; // Winkel für Shotgun (z.B. 15 Grad)

    for (let i = 0; i < player.projectileCount; i++) {
        let currentAngle = baseAngle;
        // Winkelanpassung für Shotgun (außer bei der ersten Kugel)
        if (player.projectileCount > 1) {
             // Verteilt Kugeln gleichmäßig um den Basiswinkel
            currentAngle += spreadAngle * (i - (player.projectileCount - 1) / 2);
        }

        let dx = Math.cos(currentAngle);
        let dy = Math.sin(currentAngle);
        let projSpeed = 8;

        projectiles.push({
            x: playerCenterX - 2.5, // Start aus der Mitte
            y: playerCenterY - 2.5,
            width: 5,
            height: 5,
            color: 'black',
            vx: dx * projSpeed,
            vy: dy * projSpeed,
            damage: player.currentDamage // Schaden mit Multiplikator
        });
    }
}

function moveProjectiles() {
    if (gameState !== 'playing' && gameState !== 'betweenWaves') return; // Auch in Pause treffen lassen? Aktuell nicht.

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Entfernen wenn außerhalb
        if (p.x < -p.width || p.x > canvas.width || p.y < -p.height || p.y > canvas.height) {
            projectiles.splice(i, 1);
            continue;
        }

        // Kollision mit Gegnern
        for (let j = enemies.length - 1; j >= 0; j--) {
            let enemy = enemies[j];
            if (p.x < enemy.x + enemy.width &&
                p.x + p.width > enemy.x &&
                p.y < enemy.y + enemy.height &&
                p.y + p.height > enemy.y) {

                // Treffer
                enemy.currentHealth -= p.damage;
                projectiles.splice(i, 1); // Projektil weg

                if (enemy.currentHealth <= 0) {
                    gainXP(enemy.value); // XP für Kill
                    enemies.splice(j, 1); // Gegner weg
                }
                // Wichtig: break, da Projektil nur einen treffen soll
                break;
            }
        }
    }
}

function gainXP(amount) {
    player.xp += amount;
    console.log(`Gained ${amount} XP. Total: ${player.xp}/${player.xpForNextLevel}`);
    if (player.xp >= player.xpForNextLevel) {
        levelUp();
    }
}

function levelUp() {
    player.level++;
    player.xp -= player.xpForNextLevel; // Behalte überschüssige XP
    player.xpForNextLevel = Math.floor(player.xpForNextLevel * 1.5); // Exponentiell
    console.log(`LEVEL UP! Level ${player.level}. Next level at ${player.xpForNextLevel} XP.`);
    setGameState('selectingPerk'); // Gehe zum Perk-Auswahl Zustand
}

function applyPerk(perkType) {
    switch (perkType) {
        case 'speed':
            player.shootSpeedMultiplier *= 1.5; // Multiplikativ stacken
            player.currentShootInterval = BASE_SHOOT_INTERVAL / player.shootSpeedMultiplier;
            console.log("Perk gewählt: Speed. Neuer Interval:", player.currentShootInterval);
            break;
        case 'damage':
            player.damageMultiplier *= 1.2; // Multiplikativ stacken
            player.currentDamage = BASE_PROJECTILE_DAMAGE * player.damageMultiplier;
            console.log("Perk gewählt: Damage. Neuer Schaden:", player.currentDamage);
            break;
        case 'shotgun':
            player.projectileCount *= 2; // Multiplikativ stacken
             console.log("Perk gewählt: Shotgun. Projektilanzahl:", player.projectileCount);
            break;
    }
    // Zurück zum Spiel
    setGameState('playing');
}

// --- Update Funktion (Logik pro Frame) ---
function update() {
    // Zustandsabhängige Logik
    if (gameState === 'playing') {
        movePlayer();
        moveEnemies();
        moveProjectiles();

        // Gegner Spawning
        enemySpawnTimer++;
        // Passe Spawnrate an Welle an (wird schneller)
        const currentSpawnInterval = Math.max(30, BASE_ENEMY_SPAWN_INTERVAL / (1 + (currentWave-1)*0.1)); // Schneller, Minimum 30 Frames
        if (enemySpawnTimer >= currentSpawnInterval) {
            spawnEnemy();
            enemySpawnTimer = 0;
        }

        // Schießen Timer
        shootTimer++;
        if (shootTimer >= player.currentShootInterval) {
            shoot();
            shootTimer = 0;
        }

        // Wellen Timer
        waveTimer--;
        if (waveTimer <= 0) {
            setGameState('betweenWaves');
            intermissionTimer = INTERMISSION_DURATION;
            // Optional: Restliche Gegner entfernen? enemies = []; projectiles = [];
        }

    } else if (gameState === 'betweenWaves') {
         // Hier könnte man noch restliche Projektile/Gegner bewegen lassen
        moveProjectiles(); // Lässt Projektile weiterfliegen

        intermissionTimer--;
        if (intermissionTimer <= 0) {
            currentWave++;
            waveTimer = WAVE_DURATION;
            enemySpawnTimer = 0; // Reset spawn timer für neue Welle
            setGameState('playing');
        }
    } else if (gameState === 'start' || gameState === 'gameOver' || gameState === 'selectingPerk') {
        // In diesen Zuständen passiert keine Spiellogik (Bewegung, Schießen etc.)
        // Eventuell noch nearest Enemy für Laser im Startscreen finden? Eher nicht.
        nearestEnemyForLaser = null;
    }
     // Finde immer den nächsten Gegner für den Laser (außer in Menüs)
     if (gameState === 'playing' || gameState === 'betweenWaves') {
        findNearestEnemy();
     }
}

// --- Zeichnen Funktion (Alles pro Frame) ---
function draw() {
    // Hintergrund löschen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Zustandsabhängiges Zeichnen
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'gameOver') {
        drawGameOverScreen();
    } else if (gameState === 'playing' || gameState === 'betweenWaves' || gameState === 'selectingPerk') {
        // Zeichne Spielelemente in diesen Zuständen
        drawPath();
        for (const enemy of enemies) {
            drawEnemy(enemy);
        }
         for (const p of projectiles) {
            drawProjectile(p);
        }
        drawPlayer(); // Laser wird hier mitgezeichnet
        drawUI(); // Zeichnet Leben, Welle, XP etc.

        // Perk Auswahl UI über dem Spiel zeichnen (wenn aktiv)
        // Die Buttons werden per HTML gesteuert, hier nur ein Hinweis falls man es auf Canvas zeichnen würde
        // if (gameState === 'selectingPerk') { drawPerkSelectionScreen(); }

    }
}

function drawStartScreen() {
    drawRect(0, 0, canvas.width, canvas.height, '#333'); // Dunkler Hintergrund
    // "Blockige" Schrift - einfacher Ansatz: Große, serifenlose Schrift
    ctx.font = "bold 80px 'Arial Black', Gadget, sans-serif"; // Arial Black oder ähnliches
    ctx.fillStyle = 'lime';
    ctx.textAlign = 'center';
    ctx.fillText("BUGGED OUT", canvas.width / 2, canvas.height / 2 - 50);

    // Play Button wird über HTML gesteuert
}

function drawGameOverScreen() {
    drawRect(0, 0, canvas.width, canvas.height, 'rgba(100, 0, 0, 0.8)'); // Dunkelroter Overlay
    drawText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40, 'white', '60px');
    drawText(`You reached Wave: ${currentWave}`, canvas.width / 2, canvas.height / 2 + 20, 'white', '30px');
    // Retry Button wird über HTML gesteuert
}


// --- Spielzustands-Management ---
function setGameState(newState) {
    gameState = newState;
    console.log("New Game State:", gameState);

    // UI Elemente (HTML Buttons) anpassen
    playButton.style.display = (gameState === 'start') ? 'inline-block' : 'none';
    retryButton.style.display = (gameState === 'gameOver') ? 'inline-block' : 'none';
    perkSelectionDiv.style.display = (gameState === 'selectingPerk') ? 'block' : 'none';

    // Canvas bekommt Fokus wenn spielbar, damit Tastendrücke ankommen
    if (gameState === 'playing' || gameState === 'betweenWaves') {
        canvas.focus(); // Wichtig, falls Buttons vorher Fokus hatten
    }
}

// --- Spiel Reset Funktion ---
function resetGame() {
    player.health = PLAYER_MAX_HEALTH;
    player.level = 1;
    player.xp = 0;
    player.xpForNextLevel = BASE_XP_FOR_NEXT_LEVEL;
    player.shootSpeedMultiplier = 1;
    player.damageMultiplier = 1;
    player.projectileCount = 1;
    player.currentShootInterval = BASE_SHOOT_INTERVAL;
    player.currentDamage = BASE_PROJECTILE_DAMAGE;
    player.x = canvas.width / 2 - 15;
    player.y = canvas.height / 2 - 15;
    player.dx = 0;
    player.dy = 0;


    enemies = [];
    projectiles = [];
    keys = {};
    currentWave = 1; // Start bei Welle 1
    waveTimer = WAVE_DURATION;
    intermissionTimer = 0;
    enemySpawnTimer = 0;
    shootTimer = 0;
    nearestEnemyForLaser = null;

    setGameState('playing'); // Direkt ins Spiel starten
}


// --- Event Listener ---
window.addEventListener('keydown', (e) => {
    // Nur Tasten registrieren wenn das Spiel läuft oder pausiert
    if (gameState === 'playing' || gameState === 'betweenWaves') {
         keys[e.key] = true;
         updatePlayerMovement();
    }
     // Verhindern, dass Pfeiltasten die Seite scrollen
     if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    if (gameState === 'playing' || gameState === 'betweenWaves') {
        keys[e.key] = false;
        updatePlayerMovement();
    }
});

// Player Movement Update (unverändert fast)
function updatePlayerMovement() {
    player.dx = 0;
    player.dy = 0;
    const currentSpeed = player.speed; // Geschwindigkeit könnte auch ein Perk sein

    if (keys['ArrowUp'] || keys['w']) player.dy = -currentSpeed;
    if (keys['ArrowDown'] || keys['s']) player.dy = currentSpeed;
    if (keys['ArrowLeft'] || keys['a']) player.dx = -currentSpeed;
    if (keys['ArrowRight'] || keys['d']) player.dx = currentSpeed;

    // Diagonale normalisieren
    if (player.dx !== 0 && player.dy !== 0) {
        const factor = 1 / Math.sqrt(2);
        player.dx *= factor * currentSpeed;
        player.dy *= factor * currentSpeed;
    } else if (player.dx !== 0){
         player.dx = Math.sign(player.dx) * currentSpeed;
    } else if (player.dy !== 0) {
        player.dy = Math.sign(player.dy) * currentSpeed;
    }
}


// Event Listener für HTML Buttons
playButton.addEventListener('click', () => {
    currentWave = 0; // Reset wave counter before starting fresh
    setGameState('betweenWaves'); // Gehe zur ersten "Pause" vor Welle 1
    intermissionTimer = 3 * 60; // Kurze Start-Pause
});

retryButton.addEventListener('click', () => {
    resetGame();
});

perkButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        const perkType = e.target.getAttribute('data-perk');
        if (gameState === 'selectingPerk' && perkType) {
             applyPerk(perkType);
        }
    });
});


// --- Haupt-Spielschleife (Game Loop) ---
function gameLoop() {
    // 1. Update Logik (abhängig vom Zustand)
    update();

    // 2. Zeichnen (abhängig vom Zustand)
    draw();

    // Nächsten Frame anfordern
    requestAnimationFrame(gameLoop);
}

// --- Initialisierung ---
console.log("Spiel initialisiert. Warte auf Start.");
setGameState('start'); // Starte im Startbildschirm
gameLoop(); // Starte die Spielschleife
