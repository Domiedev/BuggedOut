// === Canvas Setup ===
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// === NEU: Bild-Variablen ===
let gameImages = {}; // Objekt zum Speichern geladener Bilder
let imagesLoaded = false; // Flag, ob alle Bilder geladen sind
const imageSources = { // Pfade zu deinen Bildern (stelle sicher, dass sie stimmen!)
    playerUp: 'playerup.png',
    playerDown: 'playerdown.png',
    playerLeft: 'playerleft.png',
    playerRight: 'playerright.png',
    goon1: 'Goon1.png',
    background: 'background.png'
};
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
let gameState; // 'start', 'playing', 'betweenWaves', 'gameOver', 'selectingPerk', 'infoPopup', 'lootboxOpening', 'lootboxSpinning', 'lootboxRevealing'
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
const ENEMY_DROP_CHANCE = 0.02; // 10% Chance für Diamant / Lootbox

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
        health: 50, speed: 50, color: '#FF0000', // ROT
        xp: 50, width: 28, height: 24, // Angepasste Größe für Bug-Form
        description: "Standard slime bug enemy."
    },
    tank: { name: "Tank", health: 200, speed: 30, color: '#8B0000', xp: 150, width: 40, height: 40, description: "Slow, but very high health." },
    sprinter: { name: "Sprinter", health: 30, speed: 120, color: '#FFA500', xp: 75, width: 25, height: 25, description: "Very fast, but low health." }
};
let availableEnemyTypes = ['goon'];
let introducedEnemies = {};

// --- Tower Konfiguration ---
const TOWER_TYPES = {
    flamethrower: { name: "Flamethrower", color: '#FF4500', range: 100, cooldown: 0.1, burnDuration: 2.0, burnDamagePerSecond: 5, vulnerability: 1.25, cost: 0 },
    sniper: {
        name: "Sniper", color: '#006400', range: 400,
        cooldown: 3.0, baseDamage: 100,
        chargeRate: 1.0, // <<<<< REDUZIERT
        maxCharge: 100, target: 'strongest', cost: 0
    },
    trap: { name: "Spike Trap", color: '#696969', range: 15, cooldown: 5.0, damage: 20, slowDuration: 3.0, slowFactor: 0.5, activeDuration: 0.5, cost: 0 }
};

// --- Lootbox Konfiguration ---
const LOOTBOX_SPIN_DURATION = 4.0; // Sekunden für die gesamte Animation
const LOOTBOX_ITEM_WIDTH = 80; // Breite eines Items im Reel + Abstand
const LOOTBOX_FRICTION = 0.85; // Verlangsamt das Rad pro Sekunde
const LOOTBOX_POSSIBLE_ITEMS = [
    { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } },
    { type: 'level', value: 2, display: { color: 'orange', text: "+2 LVL" } },
    { type: 'level', value: 3, display: { color: 'red', text: "+3 LVL" } },
    { type: 'tower', value: 'flamethrower', display: { color: TOWER_TYPES.flamethrower.color, text: "Flamer" } },
    { type: 'tower', value: 'sniper', display: { color: TOWER_TYPES.sniper.color, text: "Sniper" } },
    { type: 'tower', value: 'trap', display: { color: TOWER_TYPES.trap.color, text: "Trap" } },
    // Öfter vorkommende Items hinzufügen für Wahrscheinlichkeit
    { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } },
    { type: 'tower', value: 'trap', display: { color: TOWER_TYPES.trap.color, text: "Trap" } },
    { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } },
];


// === Spielvariablen ===
let player = {}; let enemies = []; let projectiles = []; let towers = []; let drops = []; let keys = {};
let currentWave = 0; let waveTimer = 0; let intermissionTimer = 0; let enemySpawnTimer = 0; let shootTimer = 0;
let nearestEnemyForLaser = null; let enemyToIntroduce = null;
const enemyPath = [ { x: 0, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 400 }, { x: 100, y: 400 }, { x: 100, y: 550 }];

// === NEUE Lootbox Variablen ===
let lootboxSpinningTimer = 0;
let lootboxReel = [];
let lootboxReelPosition = 0;
let lootboxSpinSpeed = 1500;
let lootboxTargetIndex = 0;
let lootboxFinalItem = null;
let pendingLevelUps = 0;

// === Hilfsfunktionen ===
function drawRect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function drawText(text, x, y, color = 'black', size = '20px', align = 'center', baseline = 'middle') { ctx.fillStyle = color; ctx.font = `${size} Arial`; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(text, x, y); }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function distanceSq(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return dx * dx + dy * dy; }

// === NEU: Funktion zum Laden aller Bilder ===
function loadImages() {
    let promises = [];
    let numImages = Object.keys(imageSources).length;
    let loadedCount = 0;

    console.log("Loading images...");

    for (const key in imageSources) {
        const src = imageSources[key];
        let promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                gameImages[key] = img;
                loadedCount++;
                console.log(`Loaded: ${key} (${loadedCount}/${numImages})`);
                resolve(img);
            };
            img.onerror = (err) => {
                console.error(`Failed to load image: ${key} at ${src}`, err);
                // Optional: Setze ein Platzhalterbild oder lehne Promise ab
                // gameImages[key] = createPlaceholderImage(32, 32, 'red'); // Beispiel
                reject(`Failed to load ${key}`);
            };
            img.src = src; // Starte den Ladevorgang
        });
        promises.push(promise);
    }

    // Warten, bis alle Bilder geladen sind
    return Promise.all(promises)
        .then(() => {
            console.log("All images loaded successfully!");
            imagesLoaded = true; // Setze das Flag
            // Optional: Hier direkt resetGame() aufrufen, wenn Start sofort nach Laden erfolgen soll
            // resetGame();
            // requestAnimationFrame(gameLoop);
        })
        .catch(error => {
            console.error("Error loading one or more images:", error);
            // Handle den Fehler - vielleicht eine Fehlermeldung anzeigen?
            // Zum Beispiel:
            alert("Fehler beim Laden der Spielgrafiken. Bitte überprüfe die Dateipfade und lade die Seite neu.");
        });
}
// --- Optional: Platzhalterbild, falls ein Bild fehlt ---
/*
function createPlaceholderImage(width, height, color) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.fillStyle = color;
    tempCtx.fillRect(0, 0, width, height);
    tempCtx.fillStyle = 'white';
    tempCtx.font = '10px Arial';
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';
    tempCtx.fillText('?', width/2, height/2);
    const placeholderImg = new Image();
    placeholderImg.src = tempCanvas.toDataURL();
    return placeholderImg;
}
*/
// === Zeichnen Funktionen ===
function drawPlayer() {
    if (!imagesLoaded || !gameImages.playerDown) return; // Nicht zeichnen, wenn Bilder noch nicht bereit

    let playerImg;
    // Wähle das Bild basierend auf der Blickrichtung
    switch (player.facingDirection) {
        case 'up':
            playerImg = gameImages.playerUp;
            break;
        case 'left':
            playerImg = gameImages.playerLeft;
            break;
        case 'right':
            playerImg = gameImages.playerRight;
            break;
        case 'down':
        default: // Standardmäßig nach unten schauen
            playerImg = gameImages.playerDown;
            break;
    }

    // Laser zeichnen (wie vorher)
    if (nearestEnemyForLaser && (gameState === 'playing' || gameState === 'betweenWaves')) {
        ctx.strokeStyle = 'red'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2, player.y + player.height / 2);
        ctx.lineTo(nearestEnemyForLaser.x + nearestEnemyForLaser.width / 2, nearestEnemyForLaser.y + nearestEnemyForLaser.height / 2);
        ctx.stroke();
        ctx.lineWidth = 1; // Zurücksetzen
    }

    // Spielerbild zeichnen, wenn es existiert
    if (playerImg) {
         // Überprüfen, ob das Bild tatsächlich Dimensionen hat (erfolgreich geladen)
         if (playerImg.naturalWidth > 0 && playerImg.naturalHeight > 0) {
              ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
         } else {
             // Fallback, falls Bild zwar im Objekt, aber nicht korrekt geladen ist
             console.warn("Player image not ready for drawing:", player.facingDirection);
             drawRect(player.x, player.y, player.width, player.height, 'blue'); // Fallback-Rechteck
         }
    } else {
         // Fallback, falls das Bild für die Richtung nicht gefunden wurde
         console.warn("Player image missing for direction:", player.facingDirection);
         drawRect(player.x, player.y, player.width, player.height, 'blue'); // Fallback-Rechteck
    }

    // --- Alte drawRect Befehle entfernt ---
    // const bodyX = player.x + 4, bodyY = player.y + 8, bodyW = player.width - 8, bodyH = player.height - 12;
    // drawRect(bodyX, bodyY, bodyW, bodyH, '#808080'); // Körper
    // drawRect(player.x + 8, player.y, player.width - 16, 8, '#696969'); // Helm
    // drawRect(bodyX, bodyY + bodyH, 6, 4, '#696969'); // Fuß links
    // drawRect(bodyX + bodyW - 6, bodyY + bodyH, 6, 4, '#696969'); // Fuß rechts
    // drawRect(player.x + player.width - 4, player.y + 12, 4, 8, '#505050'); // Waffe (Andeutung)
}


// === drawEnemy (ANGEPASST für Goon) ===
// === drawEnemy (KORRIGIERT) ===
function drawEnemy(enemy) {
    const w = enemy.width;
    const h = enemy.height;

    ctx.save(); // Zustand speichern für Transformationen/Effekte
    // WICHTIG: Translation nur für das Zeichnen des Gegners selbst
    ctx.translate(enemy.x, enemy.y);

    // --- Zeichnen des Gegners selbst ---
    if (enemy.type === 'goon' && imagesLoaded && gameImages.goon1 && gameImages.goon1.naturalWidth > 0) {
        // Goon Bild zeichnen (relativ zu 0,0 wegen translate)
        ctx.drawImage(gameImages.goon1, 0, 0, w, h);
    } else {
        // Standard-Rechteck für andere Typen oder wenn Goon-Bild fehlt
        drawRect(0, 0, w, h, enemy.color); // Zeichnet relativ zu 0,0
        if (enemy.type === 'goon' && (!imagesLoaded || !gameImages.goon1 || gameImages.goon1.naturalWidth === 0)) {
             console.warn("Goon image not loaded, drawing fallback rect.");
        }
    }
    ctx.restore(); // Transformation NUR für den Gegner aufheben

    // --- Lebensbalken und Statuseffekte (ABSOLUTE Positionierung) ---
    // Wichtig: Diese werden jetzt über der korrekten Position (enemy.x, enemy.y) gezeichnet,
    // da ctx.restore() die Translation aufgehoben hat.

    // Lebensbalken
    const healthBarWidth = enemy.width;
    const healthBarHeight = 5;
    const barX = enemy.x;
    const barY = enemy.y - healthBarHeight - 2; // Position über dem Gegner
    const healthPercentage = Math.max(0, enemy.currentHealth / enemy.maxHealth);
    drawRect(barX, barY, healthBarWidth, healthBarHeight, '#555'); // Hintergrund des Balkens
    drawRect(barX, barY, healthBarWidth * healthPercentage, healthBarHeight, 'lime'); // Vordergrund

    // Statuseffekte (visuelle Indikatoren)
    ctx.lineWidth = 2; // Dickere Linie für Effekte
    if (enemy.statusEffects.burning?.duration > 0) {
        ctx.strokeStyle = 'orange';
        ctx.strokeRect(enemy.x - 1, enemy.y - 1, enemy.width + 2, enemy.height + 2); // Oranger Rahmen
    }
    if (enemy.statusEffects.slowed?.duration > 0) {
        // Blauer Overlay über dem Gegner
        ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
    ctx.lineWidth = 1; // Standard-Linienbreite wiederherstellen
}
// --- Stelle sicher, dass die zweite, fehlerhafte Kopie von drawEnemy gelöscht ist! ---


    ctx.restore(); // Wichtig! Zustand wiederherstellen, bevor Balken/Effekte gezeichnet werden

    // Lebensbalken (wird über der ursprünglichen Position gezeichnet)
    const healthBarWidth = enemy.width;
    const healthBarHeight = 5;
    const barX = enemy.x;
    const barY = enemy.y - healthBarHeight - 2;
    const healthPercentage = Math.max(0, enemy.currentHealth / enemy.maxHealth);
    drawRect(barX, barY, healthBarWidth, healthBarHeight, '#555');
    drawRect(barX, barY, healthBarWidth * healthPercentage, healthBarHeight, 'lime');

    // Statuseffekte (werden über der ursprünglichen Position gezeichnet)
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
    const xpPercentage = (player && player.xpForNextLevel > 0) ? Math.max(0, Math.min(1, player.xp / player.xpForNextLevel)) : 0;
    drawRect(barX, barY, barWidth, barHeight, '#555'); drawRect(barX, barY, barWidth * xpPercentage, barHeight, 'yellow');
    if (player) {
        drawText(`Level: ${player.level} | XP: ${player.xp} / ${player.xpForNextLevel}`, canvas.width / 2, barY + barHeight / 2, 'black', '14px');
    }
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

// === drawTowers (Überschrieben mit neuen Grafiken) ===
function drawTowers() {
    for (const tower of towers) {
        ctx.save(); // Zustand speichern (wichtig bei Transformationen/Farben)
        ctx.translate(tower.x, tower.y); // Zum Turm-Ursprung bewegen

        const w = tower.width; // 30
        const h = tower.height; // 30

        // Basis für alle Türme (optional, etwas kleiner)
        drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.3, '#555'); // Dunkelgraue Basis

        // Typ-spezifische Grafik
        if (tower.type === 'flamethrower') {
            // Tank
            drawRect(w * 0.2, h * 0.4, w * 0.6, h * 0.4, '#A0522D'); // Brauner Tank
            // Düse vorne
            drawRect(w * 0.4, h*0.1, w * 0.2, h * 0.4, tower.color); // Orange-Rote Düse
             // Kleiner Zylinder oben
             drawRect(w*0.35, 0, w*0.3, h*0.1, '#666');

        } else if (tower.type === 'sniper') {
            // Langer Lauf
            drawRect(w * 0.4, 0, w * 0.2, h * 0.8, tower.color); // Langer grüner Lauf
            // Gehäuse / Scope
            drawRect(w * 0.25, h * 0.5, w * 0.5, h * 0.25, '#444'); // Dunkles Gehäuse
            drawRect(w * 0.3, h * 0.4, w * 0.4, h * 0.1, '#333'); // Scope oben drauf

            // Aufladung anzeigen (außerhalb des Turms, darüber)
            // Das ctx.translate gilt noch, also relative Positionierung
             drawText(`${Math.floor(tower.chargePercent)}%`, w / 2, -10, 'cyan', '12px');

        } else if (tower.type === 'trap') {
            // Falle ist fast unsichtbar, bis sie aktiv ist
             if (tower.isActive) {
                 // Zeichne einfache Stacheln, wenn aktiv
                 ctx.fillStyle = tower.color; // Grau
                 drawRect(w*0.1, h*0.7, w*0.8, h*0.2, '#888'); // Flache Basisplatte
                 // Stacheln
                 ctx.fillStyle = '#A9A9A9' // Helleres Grau für Stacheln
                 ctx.beginPath();
                 ctx.moveTo(w*0.2, h*0.8); ctx.lineTo(w*0.3, h*0.3); ctx.lineTo(w*0.4, h*0.8);
                 ctx.moveTo(w*0.6, h*0.8); ctx.lineTo(w*0.7, h*0.3); ctx.lineTo(w*0.8, h*0.8);
                 ctx.fill();
             } else {
                 // Zeichne eine sehr dezente, flache Basis, wenn inaktiv
                  drawRect(w * 0.2, h * 0.8, w * 0.6, h * 0.1, '#666'); // Dunkler, flacher
             }
        } else {
             // Fallback: Einfaches Rechteck (falls neue Typen hinzukommen)
             drawRect(0, 0, w, h, tower.color);
        }

        ctx.restore(); // Zustand wiederherstellen (wichtig!)
    }
}


function drawUI() {
    if (!player) return; // Exit if player not initialized
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
    drawText("Spacebar Skips Intermission", canvas.width / 2, canvas.height / 2 + 100, '#bdc3c7', '16px');
}

function drawGameOverScreen() {
    drawRect(0, 0, canvas.width, canvas.height, 'rgba(100, 0, 0, 0.8)');
    drawText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40, 'white', '60px');
    drawText(`You reached Wave: ${currentWave}`, canvas.width / 2, canvas.height / 2 + 20, 'white', '30px');
}

// === NEUE ZEICHENFUNKTION: drawLootboxSpinning ===
function drawLootboxSpinning() {
    // Optional: Dunkler Hintergrund hinter dem HTML-Popup
    // drawRect(0, 0, canvas.width, canvas.height, 'rgba(0,0,0,0.7)');

    // Position der Anzeige auf dem Canvas
    const displayWidth = canvas.width * 0.8;
    const displayX = canvas.width * 0.1;
    const displayY = canvas.height / 2 - 50; // Vertikal zentriert
    const itemHeight = 100;

    // Clipping Bereich (nur sichtbarer Teil des Reels)
    ctx.save();
    ctx.beginPath();
    ctx.rect(displayX, displayY, displayWidth, itemHeight);
    ctx.clip();

    // Zeichne die sichtbaren Items des Reels
    let currentX = displayX - (lootboxReelPosition % LOOTBOX_ITEM_WIDTH); // Start-X basierend auf Reel-Position

    // Index des ersten sichtbaren Items berechnen
    let firstVisibleIndex = Math.floor(lootboxReelPosition / LOOTBOX_ITEM_WIDTH);

    if (lootboxReel && lootboxReel.length > 0) { // Ensure reel is populated
        for (let i = 0; i < (displayWidth / LOOTBOX_ITEM_WIDTH) + 2; i++) { // +2 für überlappende Items
            let reelIndex = (firstVisibleIndex + i) % lootboxReel.length;
            if (reelIndex < 0) reelIndex += lootboxReel.length; // Handle negative modulo result
            let item = lootboxReel[reelIndex];
            if (!item || !item.display) continue; // Sicherheitshalber

            // Zeichne Item als Rechteck mit Text
            drawRect(currentX, displayY, LOOTBOX_ITEM_WIDTH - 10, itemHeight, item.display.color || '#ccc'); // -10 für Abstand, fallback color
            drawText(item.display.text || '?', currentX + (LOOTBOX_ITEM_WIDTH - 10) / 2, displayY + itemHeight / 2, 'white', '18px', 'center', 'middle');

            currentX += LOOTBOX_ITEM_WIDTH;
        }
    } else {
        // Draw placeholder if reel is empty
        drawText("Loading Reel...", displayX + displayWidth / 2, displayY + itemHeight / 2, 'grey', '20px');
    }


    ctx.restore(); // Clipping aufheben

    // Zeichne den Auswahl-Marker in der Mitte
    const markerX = canvas.width / 2;
    ctx.fillStyle = 'red';
    // Oberer Pfeil
    ctx.beginPath();
    ctx.moveTo(markerX - 10, displayY - 10);
    ctx.lineTo(markerX + 10, displayY - 10);
    ctx.lineTo(markerX, displayY);
    ctx.closePath();
    ctx.fill();
    // Unterer Pfeil
    ctx.beginPath();
    ctx.moveTo(markerX - 10, displayY + itemHeight + 10);
    ctx.lineTo(markerX + 10, displayY + itemHeight + 10);
    ctx.lineTo(markerX, displayY + itemHeight);
    ctx.closePath();
    ctx.fill();
}


// === Spiel-Logik ===
function updatePlayerMovement() {
    let intendedX = 0; let intendedY = 0;
    if (keys['ArrowUp'] || keys['w']) intendedY = -1;
    if (keys['ArrowDown'] || keys['s']) intendedY = 1;
    if (keys['ArrowLeft'] || keys['a']) intendedX = -1;
    if (keys['ArrowRight'] || keys['d']) intendedX = 1;

    // --- NEU: Blickrichtung aktualisieren ---
    if (intendedX > 0) player.facingDirection = 'right';
    else if (intendedX < 0) player.facingDirection = 'left';
    else if (intendedY > 0) player.facingDirection = 'down';
    else if (intendedY < 0) player.facingDirection = 'up';
    // Wenn keine Taste gedrückt wird, bleibt die letzte Richtung erhalten.

    // Diagonalbewegung anpassen (wie vorher)
    let moveX = intendedX; let moveY = intendedY;
    if (intendedX !== 0 && intendedY !== 0) {
        const factor = 1 / Math.sqrt(2);
        moveX *= factor; moveY *= factor;
    }
    player.dx = moveX * player.speed;
    player.dy = moveY * player.speed;
}

function movePlayer() {
    // Bewegung ist jetzt in 'playing' und 'betweenWaves' erlaubt (siehe update Funktion)
    if (!player) return;
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
    if (burn && burn.duration > 0) {
        burn.duration -= deltaTime;
        burn.damageTimer -= deltaTime;
        if (burn.damageTimer <= 0) {
            enemy.currentHealth -= burn.damageAmount;
            burn.damageTimer = burn.damageInterval; // Reset timer
            if (enemy.currentHealth <= 0) diedFromEffect = true;
        }
        if (burn.duration <= 0) burn.duration = 0; // Clean up
    }

    // Slowed
    let slow = enemy.statusEffects.slowed;
    if (slow && slow.duration > 0) {
        slow.duration -= deltaTime;
        enemy.speed = enemy.baseSpeed * slow.speedMultiplier;
        if (slow.duration <= 0) {
            slow.duration = 0;
            enemy.speed = enemy.baseSpeed; // Reset speed
        }
    } else {
        enemy.speed = enemy.baseSpeed; // Ensure speed is base if no slow effect
    }
    return diedFromEffect;
}


function moveEnemies() {
    if (gameState !== 'playing') return;
    for (let i = enemies.length - 1; i >= 0; i--) {
        // Check if enemy still exists (could be removed by effect in the same frame)
        if (!enemies[i]) continue;
        let enemy = enemies[i];

        // Apply status effects and check if they killed the enemy
        if (updateEnemyStatusEffects(enemy)) {
             // Need to find index again as it might have shifted
             let currentIndex = enemies.indexOf(enemy);
             if (currentIndex > -1) {
                 handleEnemyDefeat(enemy, currentIndex);
             }
             continue; // Move to next enemy
        }

        // Ensure enemy wasn't removed by handleEnemyDefeat called from effects
        if (!enemies.includes(enemy)) continue;

        // Pathfinding
        let targetPoint = enemyPath[enemy.pathIndex];
        let targetX = targetPoint.x; let targetY = targetPoint.y;
        let dx = targetX - (enemy.x + enemy.width / 2);
        let dy = targetY - (enemy.y + enemy.height / 2);
        let distance = Math.sqrt(dx * dx + dy * dy);
        let moveAmount = enemy.speed * deltaTime;

        if (distance < moveAmount || distance === 0) {
            // Snap to target point before potentially moving to the next
            enemy.x = targetX - enemy.width / 2;
            enemy.y = targetY - enemy.height / 2;

            enemy.pathIndex++;
            if (enemy.pathIndex >= enemyPath.length) {
                // Reached the end
                player.health--;
                enemies.splice(i, 1); // Remove enemy
                if (player.health <= 0) {
                    setGameState('gameOver');
                }
                continue; // To next enemy in loop
            }
            // Move towards the *new* target point slightly this frame if needed? No, wait till next frame.
        } else {
            // Move towards current target point
            enemy.x += (dx / distance) * moveAmount;
            enemy.y += (dy / distance) * moveAmount;
        }
    }
}


function findNearestEnemy() {
    nearestEnemyForLaser = null;
    if (enemies.length === 0 || !player) return null;
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
    nearestEnemyForLaser = nearestEnemy; // Update laser target
    return nearestEnemy;
}

function findStrongestEnemy() {
    let strongest = null; let maxHealth = -1;
    for (const enemy of enemies) {
         // Sniper ignores Goons perhaps? Or just targets highest current HP? Let's stick to MaxHP excluding goons for now.
         // if (enemy.type === 'goon') continue; // Optional: ignore goons
         if (enemy.currentHealth > maxHealth) { // Target based on CURRENT health? Or MAX health? Let's use Max health.
             maxHealth = enemy.maxHealth; // Using maxHealth to define "strongest"
             strongest = enemy;
         }
    }
    return strongest;
}


function shoot() {
    if (gameState !== 'playing' || enemies.length === 0 || !player) return;
    const targetEnemy = findNearestEnemy(); // Player always targets nearest
    if (!targetEnemy) return;

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const targetX = targetEnemy.x + targetEnemy.width / 2;
    const targetY = targetEnemy.y + targetEnemy.height / 2;

    const baseAngle = Math.atan2(targetY - playerCenterY, targetX - playerCenterX);
    const spreadAngle = player.projectileCount > 1 ? Math.PI / 12 : 0; // ~15 degrees total spread for shotgun
    const projSpeed = 400;

    for (let i = 0; i < player.projectileCount; i++) {
        let currentAngle = baseAngle;
        if (player.projectileCount > 1) {
            // Calculate angle offset for this projectile
            currentAngle += spreadAngle * (i - (player.projectileCount - 1) / 2);
        }

        let dx = Math.cos(currentAngle);
        let dy = Math.sin(currentAngle);

        projectiles.push({
            x: playerCenterX - 2.5, // Center projectile visually
            y: playerCenterY - 2.5,
            width: 5, height: 5, color: 'black',
            vx: dx * projSpeed, vy: dy * projSpeed,
            damage: player.currentDamage
        });
    }

     shootTimer = player.currentShootInterval; // Reset timer AFTER shooting
}

function handleEnemyDefeat(enemy, index) {
     // Ensure enemy exists at this index before proceeding
     if (!enemies[index] || enemies[index] !== enemy) {
         console.warn("handleEnemyDefeat called with invalid index or enemy mismatch. Enemy might have been removed already.");
         // Attempt to find the enemy again if index is wrong
         index = enemies.indexOf(enemy);
         if (index === -1) return; // Really gone, do nothing
     }

     gainXP(enemy.value);

     if (Math.random() < ENEMY_DROP_CHANCE) {
         drops.push({
             x: enemy.x + enemy.width / 2 - 5, // Center drop
             y: enemy.y + enemy.height / 2 - 5,
             width: 10, height: 10
         });
     }

     // If this enemy was the laser target, clear it
     if (nearestEnemyForLaser === enemy) {
         nearestEnemyForLaser = null;
         // Optionally, immediately find the next nearest enemy
         // findNearestEnemy();
     }

     enemies.splice(index, 1);
}


function moveProjectiles() {
    // Projectiles can move even between waves if player shoots
    if (gameState !== 'playing' && gameState !== 'betweenWaves') return;

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;

        // Remove projectile if it goes off-screen
        if (p.x < -p.width || p.x > canvas.width || p.y < -p.height || p.y > canvas.height) {
            projectiles.splice(i, 1);
            continue;
        }

        // Check for collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
             // Check if enemy still exists before collision check
            if (!enemies[j]) continue;
            let enemy = enemies[j];

            // Simple AABB collision check
            if (p.x < enemy.x + enemy.width && p.x + p.width > enemy.x &&
                p.y < enemy.y + enemy.height && p.y + p.height > enemy.y) {

                // Apply damage modifiers (like vulnerability from burn)
                let actualDamage = p.damage;
                if (enemy.statusEffects.burning?.duration > 0) {
                    actualDamage *= TOWER_TYPES.flamethrower.vulnerability;
                }

                enemy.currentHealth -= actualDamage;
                 projectiles.splice(i, 1); // Splice projectile *before* handling defeat

                if (enemy.currentHealth <= 0) {
                     // Important: Pass the correct index 'j'
                    handleEnemyDefeat(enemy, j);
                 }
                // Important: break inner loop because projectile is gone
                break;
            }
        }
    }
}

function updateTowers() {
    for (let tower of towers) {
        tower.cooldownTimer = Math.max(0, tower.cooldownTimer - deltaTime);

        // Tower logic only if cooldown is ready
        if (tower.cooldownTimer <= 0) {
            switch (tower.type) {
                case 'flamethrower': updateFlamethrower(tower); break;
                case 'sniper': updateSniper(tower); break;
                case 'trap': updateTrap(tower); break; // Trap checks for activation/trigger here
            }
        }

        // Update specific tower states regardless of cooldown
        if (tower.type === 'trap') {
            if (tower.isActive) {
                 tower.activeTimer -= deltaTime;
                 if (tower.activeTimer <= 0) {
                     tower.isActive = false;
                     // Cooldown for trap starts *after* it deactivates? Or when triggered? Let's say after deactivation.
                     // tower.cooldownTimer = tower.cooldown; // No, cooldown set in updateTrap when triggered
                 }
            }
        } else if (tower.type === 'sniper') {
             // Charge sniper only if NOT firing (cooldownTimer > 0 implies just fired)
             let target = findStrongestEnemy(); // Need potential target info
             if (tower.cooldownTimer > 0 || !target) { // Charge if on cooldown OR no valid target
                 tower.chargePercent = Math.min(tower.maxCharge, tower.chargePercent + tower.chargeRate * deltaTime);
             }
             // If cooldown is 0 and target exists, it will fire in the switch-case above, resetting chargePercent
        }
    }
}

function updateFlamethrower(tower) {
    tower.cooldownTimer = tower.cooldown; // Reset cooldown immediately
    let towerCenterX = tower.x + tower.width/2; let towerCenterY = tower.y + tower.height/2;
    const typeConfig = TOWER_TYPES.flamethrower;
    let fired = false; // Did it affect any enemy?

    for (let enemy of enemies) {
        let enemyCenterX = enemy.x + enemy.width/2; let enemyCenterY = enemy.y + enemy.height/2;
        if (distanceSq(towerCenterX, towerCenterY, enemyCenterX, enemyCenterY) < tower.range * tower.range) {
            // Apply or refresh burning effect
            enemy.statusEffects.burning = {
                 duration: typeConfig.burnDuration, // Reset duration
                 damageInterval: 0.5,
                 damageTimer: 0.5, // Deal damage soon
                 damageAmount: typeConfig.burnDamagePerSecond * 0.5 // Damage per tick
            };
            fired = true;
        }
    }
    // Flamethrower resets cooldown even if it hits nothing, simulating continuous firing? Or only if it hits?
    // Let's keep it simple: cooldown resets regardless.
}

function updateSniper(tower) {
    let target = findStrongestEnemy();
    if (target) {
        // Fire!
        tower.cooldownTimer = tower.cooldown; // Set cooldown
        const typeConfig = TOWER_TYPES.sniper;
        let damage = typeConfig.baseDamage * (1 + tower.chargePercent / 100);
        console.log(`Sniper shot at ${target.type}! Damage: ${damage.toFixed(0)} (Charge: ${tower.chargePercent.toFixed(0)}%)`);

        // Apply vulnerability if target is burning
        if (target.statusEffects.burning?.duration > 0) {
            damage *= TOWER_TYPES.flamethrower.vulnerability; // Synergy!
             console.log(`... Target burning! Damage increased to ${damage.toFixed(0)}`);
        }

        target.currentHealth -= damage;
        tower.chargePercent = 0; // Reset charge after firing

        if (target.currentHealth <= 0) {
             let index = enemies.indexOf(target);
             if(index > -1) {
                 handleEnemyDefeat(target, index);
             } else {
                 console.warn("Target died but couldn't be found in enemies array for removal.");
             }
        }
    }
    // If no target, cooldown remains 0, allowing charging in the main updateTowers logic.
}

function updateTrap(tower) {
    // This function is called when cooldown is 0. It checks if enemies are in range to *trigger* the trap.
    let triggered = false;
    const typeConfig = TOWER_TYPES.trap;
    let towerCenterX = tower.x + tower.width/2;
    let towerCenterY = tower.y + tower.height/2;

    for (let i = enemies.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
        let enemy = enemies[i];
        // Use distance check for trigger range (more accurate than AABB for circle-like range)
        let enemyCenterX = enemy.x + enemy.width/2;
        let enemyCenterY = enemy.y + enemy.height/2;

        if (distanceSq(towerCenterX, towerCenterY, enemyCenterX, enemyCenterY) < tower.range * tower.range) {
              triggered = true; // Trap will activate
              // Apply effects immediately to this enemy
              enemy.currentHealth -= typeConfig.damage;
              enemy.statusEffects.slowed = { duration: typeConfig.slowDuration, speedMultiplier: typeConfig.slowFactor };
              console.log(`Trap triggered by ${enemy.type}! Damage: ${typeConfig.damage}, Slowed.`);

              if (enemy.currentHealth <= 0) {
                  handleEnemyDefeat(enemy, i);
              }
              // Should trap affect multiple enemies at once? Let's say yes. Don't break.
         }
    }

    if (triggered) {
        tower.isActive = true;
        tower.activeTimer = tower.activeDuration; // How long the visual effect stays
        tower.cooldownTimer = tower.cooldown; // Start cooldown now that it triggered
    }
    // If not triggered, cooldown remains 0, will check again next frame.
}


function checkDropsCollection() {
    // Drop collection only allowed during active play phases?
    if (gameState !== 'playing' && gameState !== 'betweenWaves') return;
    if (!player) return;

    let playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    for (let i = drops.length - 1; i >= 0; i--) {
        let drop = drops[i];
        let dropRect = { x: drop.x, y: drop.y, width: drop.width, height: drop.height };

        // AABB collision check for pickup
        if (playerRect.x < dropRect.x + dropRect.width && playerRect.x + playerRect.width > dropRect.x &&
            playerRect.y < dropRect.y + dropRect.height && playerRect.y + playerRect.height > dropRect.y) {

            drops.splice(i, 1);
            triggerLootbox(); // Assume every drop is a lootbox trigger for now
            break; // Only collect one drop per frame? Or allow multiple? Let's allow multiple, remove break.
        }
    }
}

// === Lootbox Logic ===

// Funktion zum Erstellen des Reels (aufgerufen in resetGame und triggerLootbox)
function setupLootboxReel() {
    lootboxReel = [];
    // Fülle das Reel mit vielen (z.B. 50) zufälligen Items für eine längere Optik
    for (let i = 0; i < 50; i++) {
        lootboxReel.push(getRandomElement(LOOTBOX_POSSIBLE_ITEMS));
    }

    // Bestimme zuerst das Ergebnis zufällig basierend auf Wahrscheinlichkeiten
    let randomRoll = Math.random();
    if (randomRoll < 0.1) { // 10% Chance auf 3 Level
         lootboxFinalItem = { type: 'level', value: 3, display: { color: 'red', text: "+3 LVL" } };
    } else if (randomRoll < 0.3) { // 20% Chance auf 2 Level (Total 30% für Level)
        lootboxFinalItem = { type: 'level', value: 2, display: { color: 'orange', text: "+2 LVL" } };
    } else if (randomRoll < 0.6) { // 30% Chance auf 1 Level (Total 60% für Level)
         lootboxFinalItem = { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } };
    } else { // 40% Chance auf einen Turm
        let towerType = getRandomElement(Object.keys(TOWER_TYPES));
        lootboxFinalItem = { type: 'tower', value: towerType, display: { color: TOWER_TYPES[towerType].color, text: TOWER_TYPES[towerType].name.substring(0,6) } }; // Gekürzter Name
    }

    // Platziere das Ergebnis an einer festen, späten Position im Reel, damit es sichtbar wird
    lootboxTargetIndex = Math.max(10, lootboxReel.length - 10 - Math.floor(Math.random() * 5)); // z.B. 10-15 Items vor Schluss, aber mind. Index 10
    lootboxReel[lootboxTargetIndex] = lootboxFinalItem;
    console.log(`Lootbox setup. Final item (${lootboxFinalItem.type}: ${lootboxFinalItem.value}) placed at index ${lootboxTargetIndex}`);
}

// === triggerLootbox (startet den Prozess) ===
function triggerLootbox() {
    console.log("Lootbox triggered!");
    setupLootboxReel(); // Reel und Ergebnis neu bestimmen!
    nextStateAfterPopup = gameState; // Merken wo wir waren (playing or betweenWaves)
    setGameState('lootboxOpening');
    if (lootboxTextP) lootboxTextP.textContent = "You found a Lootbox!";
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'inline-block';
    if (lootboxOkButton) lootboxOkButton.style.display = 'none';
    if (lootboxPopupDiv) lootboxPopupDiv.style.display = 'block';
}

// === openLootbox (startet die Spin-Animation) ===
function openLootbox() {
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'none';
    if (lootboxTextP) lootboxTextP.textContent = "Spinning!"; // Oder leer lassen
    lootboxSpinningTimer = LOOTBOX_SPIN_DURATION;
    lootboxReelPosition = 0; // Startposition des Reels
    lootboxSpinSpeed = 1500 + Math.random() * 500; // Startgeschwindigkeit + Varianz
    setGameState('lootboxSpinning');
}

// === revealLootboxReward (zeigt das Ergebnis nach dem Spin) ===
function revealLootboxReward() {
    pendingLevelUps = 0; // Reset anstehender Level-Ups
    let rewardText = "";

    if (!lootboxFinalItem) {
        console.error("Lootbox final item is null!");
        rewardText = "Error opening lootbox!";
        lootboxFinalItem = {type: 'error'}; // Prevent further errors
    } else if (lootboxFinalItem.type === 'level') {
        let levelsGained = lootboxFinalItem.value;
        rewardText = `You won ${levelsGained} Level(s)!`;
        pendingLevelUps = levelsGained; // Merken für Perk-Auswahl(en)
        // XP nicht mehr direkt geben, Level-Up passiert durch Perk-Auswahl
        console.log(`Won ${levelsGained} levels. Pending Level Ups: ${pendingLevelUps}`);
    } else if (lootboxFinalItem.type === 'tower'){
        let towerType = lootboxFinalItem.value;
        let success = placeRandomTower(towerType);
        if (success) { rewardText = `You received a ${TOWER_TYPES[towerType].name}!`; }
        else { rewardText = "No space for a tower! (+500 XP instead)"; gainXP(500); }
    } else {
        rewardText = "Unknown reward!?"; // Fallback
    }

    if (lootboxTextP) lootboxTextP.textContent = rewardText;
    if (lootboxOkButton) lootboxOkButton.style.display = 'inline-block'; // Zeige OK zum Bestätigen
    setGameState('lootboxRevealing'); // Zustand wechseln, damit OK Button aktiv ist
}

function placeRandomTower(typeKey) {
    const typeConfig = TOWER_TYPES[typeKey];
    const towerWidth = 30; const towerHeight = 30;
    let attempts = 0; const maxAttempts = 50; // Increased attempts

    while (attempts < maxAttempts) {
        attempts++;
        // Generate random position not too close to edges
        let randX = Math.random() * (canvas.width - towerWidth - 40) + 20; // 20px margin
        let randY = Math.random() * (canvas.height - towerHeight - 40) + 20; // 20px margin

        let towerRect = {x: randX, y: randY, width: towerWidth, height: towerHeight};
        let towerCenterX = randX + towerWidth / 2;
        let towerCenterY = randY + towerHeight / 2;

        // 1. Check distance to path segments
        let tooCloseToPath = false;
        const minPathDistanceSq = 40 * 40; // Increased minimum distance slightly
        for (let i = 0; i < enemyPath.length - 1; i++) {
            // Simple check against segment endpoints first (faster)
            if (distanceSq(towerCenterX, towerCenterY, enemyPath[i].x, enemyPath[i].y) < minPathDistanceSq ||
                distanceSq(towerCenterX, towerCenterY, enemyPath[i+1].x, enemyPath[i+1].y) < minPathDistanceSq) {
                tooCloseToPath = true;
                break;
            }
            // More complex: check distance to line segment itself (optional, adds complexity)
        }
        if (tooCloseToPath) continue; // Try next random position

        // 2. Check collision with other towers
        let collidesWithTower = false;
        const towerSpacing = 5; // Minimum space between towers
        for (const otherTower of towers) {
             let otherRect = {
                 x: otherTower.x - towerSpacing,
                 y: otherTower.y - towerSpacing,
                 width: otherTower.width + 2 * towerSpacing,
                 height: otherTower.height + 2 * towerSpacing
             };
             if (towerRect.x < otherRect.x + otherRect.width && towerRect.x + towerRect.width > otherRect.x &&
                 towerRect.y < otherRect.y + otherRect.height && towerRect.y + towerRect.height > otherRect.y) {
                 collidesWithTower = true;
                 break;
             }
        }
        if (collidesWithTower) continue; // Try next random position

        // 3. Check collision with player's current position (optional, less important)
        // let collidesWithPlayer = ...

        // Position is valid, create and place the tower
        let newTower = {
             type: typeKey, x: randX, y: randY, width: towerWidth, height: towerHeight,
             color: typeConfig.color, range: typeConfig.range, cooldown: typeConfig.cooldown,
             cooldownTimer: Math.random() * typeConfig.cooldown, // Random initial cooldown
             // Add type-specific properties using spread syntax
             ...(typeKey === 'sniper' && { baseDamage: typeConfig.baseDamage, chargeRate: typeConfig.chargeRate, maxCharge: typeConfig.maxCharge, chargePercent: 0 }),
             ...(typeKey === 'flamethrower' && { burnDamagePerSecond: typeConfig.burnDamagePerSecond, burnDuration: typeConfig.burnDuration, vulnerability: typeConfig.vulnerability }),
             ...(typeKey === 'trap' && { damage: typeConfig.damage, slowDuration: typeConfig.slowDuration, slowFactor: typeConfig.slowFactor, activeDuration: typeConfig.activeDuration, isActive: false, activeTimer: 0 })
        };
        towers.push(newTower);
        console.log(`Tower placed: ${typeConfig.name} at (${randX.toFixed(0)}, ${randY.toFixed(0)})`);
        return true; // Success
    }

    console.log("Could not find suitable position for tower after", maxAttempts, "attempts.");
    return false; // Failure
}

function gainXP(amount) {
    if (gameState === 'gameOver' || !player || typeof player.xp !== 'number') return;
    player.xp += Math.round(amount);
    console.log(`Gained ${Math.round(amount)} XP. Total: ${player.xp}/${player.xpForNextLevel}`);
    // Trigger level up check *after* potentially multiple XP gains in one frame
    while (player.xp >= player.xpForNextLevel) {
        // Check needed because levelUp now transitions state immediately
        if (gameState !== 'selectingPerk') {
             levelUp();
        } else {
            // Already in perk selection (likely from lootbox), XP carries over
            console.log("XP threshold reached, but already selecting perk. XP will carry over.");
            break; // Avoid infinite loop if multiple levels gained instantly
        }
    }
}

// === levelUp (nur noch für reguläre Level-Ups durch XP) ===
function levelUp() {
    // Diese Funktion wird NUR aufgerufen, wenn genügend XP gesammelt wurden.
    // Sie löst jetzt NUR NOCH die Perk-Auswahl aus.
    // Die eigentliche Level-Erhöhung (+1 Level) passiert in applyPerk.
    if (gameState === 'gameOver' || !player) return; // Safety check
    console.log(`XP threshold reached for Level Up! Triggering Perk Selection.`);
    nextStateAfterPopup = gameState; // Merken wo wir waren (playing or betweenWaves)
    pendingLevelUps = 1; // Setze 1 anstehendes Level-Up für normale Level-Ups
    setGameState('selectingPerk');
}

// === applyPerk (angepasst für mehrere Level-Ups, XP Reset & Perk Balance) ===
function applyPerk(perkType) {
    if (!player || gameState !== 'selectingPerk') return; // Safety check

    // 1. Apply the chosen perk effect
    switch (perkType) {
        case 'speed': // <<<< GEÄNDERT: 5% Speed Increase
            player.shootSpeedMultiplier *= 1.05; // Increase speed factor
            player.currentShootInterval = BASE_SHOOT_INTERVAL / player.shootSpeedMultiplier; // Recalculate interval
            break;
        case 'damage': // <<<< GEÄNDERT: 2% Damage Increase
             player.damageMultiplier *= 1.02; // Increase damage factor
             player.currentDamage = BASE_PROJECTILE_DAMAGE * player.damageMultiplier; // Recalculate damage
             break;
        case 'shotgun': // <<<< GEÄNDERT: +1 Projectile
            player.projectileCount = Math.min(16, player.projectileCount + 1); // Add 1 projectile, cap at 16
            break;
        // Füge hier bei Bedarf weitere Perks hinzu
    }
    console.log("Perk applied:", perkType, "New Stats:", player);

    // 2. Verarbeite das mit dieser Perk-Auswahl verbundene Level-Up
    player.level++;
    // const xpRequiredForThisLevel = player.xpForNextLevel; // ALT: Variable nicht mehr benötigt
    // player.xp -= xpRequiredForThisLevel; // ALT: Führte zu negativem XP
    player.xp = 0; // <<<< GEÄNDERT: Setze XP auf 0 für das neue Level
    player.xpForNextLevel = Math.floor(BASE_XP_FOR_NEXT_LEVEL * Math.pow(1.5, player.level - 1)); // Berechne Kosten für das *nächste* Level
    console.log(`Level ${player.level} reached via perk selection. XP reset to 0. Next level at ${player.xpForNextLevel} XP.`);

    // 3. Behandle anstehende Level-Ups (aus Lootbox oder mehreren Standard-Level-Ups)
    pendingLevelUps--; // Reduziere die Anzahl der anstehenden Auswahlen
    console.log(`Pending level ups remaining: ${pendingLevelUps}`);

    if (pendingLevelUps > 0) {
        // Weitere Auswahlen erforderlich, bleibe im Zustand 'selectingPerk'
        setGameState('selectingPerk'); // Optional: Aktualisiere UI, falls nötig
    } else {
        // Alle anstehenden Auswahlen erledigt, prüfe, ob der Spieler sofort genug XP für *noch* ein Level hat
        if (player.xp >= player.xpForNextLevel && gameState !== 'gameOver') {
             console.log("Sufficient XP for another level immediately after perk selection.");
             levelUp(); // Starte den nächsten Level-Up-Prozess
        } else {
             setGameState(nextStateAfterPopup); // Kehre zum normalen Spiel zurück
        }
    }
}


// --- Zustandsmanagement ---
function setGameState(newState) {
    const oldState = gameState;
    // Prevent redundant calls if state is already set
    if (oldState === newState) {
         // console.log(`State is already ${newState}, returning.`); // Can be noisy
         return;
    }

    console.log(`State changing: ${oldState} -> ${newState}`);
    gameState = newState; // Update the global state variable

    // --- UI Element Visibility ---
    if (playButton) playButton.style.display = (gameState === 'start') ? 'inline-block' : 'none';
    if (retryButton) retryButton.style.display = (gameState === 'gameOver') ? 'inline-block' : 'none';
    if (perkSelectionDiv) {
        perkSelectionDiv.style.display = (gameState === 'selectingPerk') ? 'block' : 'none';
    } else {
        console.error("!!! perkSelectionDiv NOT found during setGameState !!!");
    }
    if (infoPopupDiv) infoPopupDiv.style.display = (gameState === 'infoPopup') ? 'block' : 'none';
    if (lootboxPopupDiv) {
        lootboxPopupDiv.style.display = (gameState === 'lootboxOpening' || gameState === 'lootboxSpinning' || gameState === 'lootboxRevealing') ? 'block' : 'none';
    } else {
         console.error("!!! lootboxPopupDiv NOT found during setGameState !!!");
    }

    // --- Specific State Entry/Exit Logic ---
    if (newState === 'playing' || newState === 'betweenWaves') {
        if(canvas) canvas.focus(); // Allow keyboard input
    }
    if (newState === 'gameOver') {
        // Optional: Stop sounds, clear timers etc.
    }
    // Hide lootbox OK button when exiting revealing state (unless going back to opening/spinning)
    if (oldState === 'lootboxRevealing' && newState !== 'lootboxOpening' && newState !== 'lootboxSpinning') {
         if (lootboxOkButton) lootboxOkButton.style.display = 'none';
    }
    // Ensure Open button is hidden if we enter spinning/revealing state directly somehow
    if (newState === 'lootboxSpinning' || newState === 'lootboxRevealing') {
         if (lootboxOpenButton) lootboxOpenButton.style.display = 'none';
    }
}


function checkNewEnemyIntroduction() {
    let newEnemyKey = null;
    if (currentWave === ENEMY_INTRO_WAVES[0] && !introducedEnemies['tank']) { newEnemyKey = 'tank'; }
    else if (currentWave === ENEMY_INTRO_WAVES[1] && !introducedEnemies['sprinter']) { newEnemyKey = 'sprinter'; }

    if (newEnemyKey && ENEMY_TYPES[newEnemyKey]) { // Ensure type exists
        availableEnemyTypes.push(newEnemyKey);
        enemyToIntroduce = ENEMY_TYPES[newEnemyKey];
        introducedEnemies[newEnemyKey] = true; // Mark as introduced

        // Prepare and show info popup
        nextStateAfterPopup = 'playing'; // Always go to playing after intro
        setGameState('infoPopup');
        if(infoTextP) infoTextP.textContent = `NEW ENEMY APPROACHING: ${enemyToIntroduce.name.toUpperCase()}! ${enemyToIntroduce.description}`;
        // Visibility is handled by setGameState

        return true; // Indicate that an introduction is happening
    }
    return false; // No new enemy this wave
}


function resetGame() {
    // Wichtig: Player-Objekt hier initialisieren
    player = {
        x: canvas.width / 2 - PLAYER_WIDTH / 2, y: canvas.height / 2 - PLAYER_HEIGHT / 2,
        width: PLAYER_WIDTH, height: PLAYER_HEIGHT, speed: PLAYER_BASE_SPEED,
        // color: 'blue', // Nicht mehr benötigt, da wir Bilder verwenden
        dx: 0, dy: 0, health: PLAYER_MAX_HEALTH,
        level: 1, xp: 0, xpForNextLevel: BASE_XP_FOR_NEXT_LEVEL,
        shootSpeedMultiplier: 1, damageMultiplier: 1, projectileCount: 1,
        currentShootInterval: BASE_SHOOT_INTERVAL, currentDamage: BASE_PROJECTILE_DAMAGE,
        facingDirection: 'down' // <<<< NEU: Startblickrichtung
    };
    enemies = []; projectiles = []; drops = []; towers = [];
    keys = {}; currentWave = 0; waveTimer = 0; intermissionTimer = 3; // Short initial intermission
    enemySpawnTimer = 0; shootTimer = 0; nearestEnemyForLaser = null;
    availableEnemyTypes = ['goon']; introducedEnemies = {};
    lastTimestamp = 0; deltaTime = 0; // Zeit zurücksetzen

    // Reset Lootbox variables
    lootboxSpinningTimer = 0;
    lootboxReelPosition = 0;
    lootboxSpinSpeed = 1500;
    lootboxFinalItem = null;
    pendingLevelUps = 0;
    setupLootboxReel(); // Prepare the reel visuals (though content changes on trigger)


    setGameState('betweenWaves'); // Start with the short intermission
}

// --- Update & Draw (Hauptschleife) ---
function update() {
    // Allow player movement in playing and betweenWaves states
    if (gameState === 'playing' || gameState === 'betweenWaves') {
        movePlayer(); // Handles input reading
        checkDropsCollection(); // Allow collecting drops in both states
        moveProjectiles(); // Allow projectiles to continue moving
        updateTowers(); // Allow towers to update/charge/fire
        nearestEnemyForLaser = findNearestEnemy(); // Update laser target
    }

    // State-specific logic
    if (gameState === 'playing') {
        moveEnemies(); // Enemies only move during 'playing'

        // Enemy Spawning
        enemySpawnTimer -= deltaTime;
        // Adjust spawn rate based on wave and number of enemy types available
        const spawnIntervalDivisor = Math.max(1, availableEnemyTypes.length * 0.8);
        const currentBaseSpawnInterval = Math.max(0.2, 1.5 / (1 + (currentWave - 1) * 0.1)); // Faster spawns in later waves
        const currentSpawnInterval = currentBaseSpawnInterval / spawnIntervalDivisor; // More types = faster spawns overall
        if (enemySpawnTimer <= 0) {
            spawnEnemy();
            enemySpawnTimer = currentSpawnInterval * (0.8 + Math.random() * 0.4); // Add slight randomness
        }

        // Player Shooting
        shootTimer -= deltaTime;
        if (shootTimer <= 0) {
            shoot(); // Handles checking for target etc. inside
        }

        // Wave Timer
        waveTimer -= deltaTime;
        if (waveTimer <= 0) {
            setGameState('betweenWaves');
            intermissionTimer = INTERMISSION_DURATION; // Start normal intermission
            // Clear remaining enemies? Optional. For now, they stay.
            // enemies = [];
        }
    } else if (gameState === 'betweenWaves') {
        // Player movement, drops, projectiles, towers handled above
        intermissionTimer -= deltaTime;
        if (intermissionTimer <= 0) {
            currentWave++;
            waveTimer = WAVE_DURATION;
            enemySpawnTimer = 0; // Reset spawn timer for the new wave
            // Check for new enemy introduction *before* setting state to 'playing'
            if (!checkNewEnemyIntroduction()) {
                 setGameState('playing'); // Start the wave if no introduction popup
            }
            // If checkNewEnemyIntroduction returns true, state will be set to 'infoPopup' inside it
        }
    } else if (gameState === 'lootboxSpinning') {
        // Lootbox Animation Logic
        if (lootboxSpinningTimer > 0) {
            lootboxSpinningTimer -= deltaTime;

            // Move Reel Position
            lootboxReelPosition += lootboxSpinSpeed * deltaTime;

            // Reduce Spin Speed (Friction + stronger braking towards end)
            let speedReductionFactor = Math.pow(LOOTBOX_FRICTION, deltaTime); // Base friction
             if (lootboxSpinningTimer < LOOTBOX_SPIN_DURATION * 0.6) { // Stronger braking in last 60% of time
                 speedReductionFactor *= Math.pow(0.65, deltaTime); // Adjust this factor for desired braking strength
             }
            lootboxSpinSpeed *= speedReductionFactor;
            lootboxSpinSpeed = Math.max(30, lootboxSpinSpeed); // Minimum speed to prevent stalling too early

            // Calculate target position visually centered
            const targetPixelPosition = lootboxTargetIndex * LOOTBOX_ITEM_WIDTH + LOOTBOX_ITEM_WIDTH / 2 - (canvas.width * 0.8) / 2 ; // Approximate center alignment


            // Check if time is up OR if the reel is slow enough AND near the target
            if (lootboxSpinningTimer <= 0 || (lootboxSpinSpeed <= 50 && Math.abs(lootboxReelPosition - targetPixelPosition) < LOOTBOX_ITEM_WIDTH )) {
                 // Stop the spin precisely at the target item (Optional: Animate snapping)
                 // For simplicity, just jump to reveal state
                 console.log("Spin finished. Final item:", lootboxFinalItem);
                 revealLootboxReward(); // Transition to revealing the result
                 lootboxSpinningTimer = 0; // Ensure timer is 0
            }
        } else {
             // Fallback if timer reaches 0 unexpectedly
             console.log("Spin timer reached zero.");
             revealLootboxReward();
        }
    } else if (gameState === 'gameOver' || gameState === 'start' || gameState === 'selectingPerk' || gameState === 'infoPopup' || gameState === 'lootboxOpening' || gameState === 'lootboxRevealing') {
        // Game logic is paused in these states
        // Player movement might be specifically handled or disabled
        // For 'selectingPerk', 'infoPopup', 'lootbox...', UI interaction handles state changes
    }
}

// === draw (KORRIGIERT) ===
function draw() {
    // Hintergrund löschen (optional, aber sicher, falls BG-Bild Transparenz hat)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- NEU: Hintergrundbild zeichnen ---
    if (imagesLoaded && gameImages.background && gameImages.background.naturalWidth > 0) {
        ctx.drawImage(gameImages.background, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback-Hintergrundfarbe, falls Bild nicht geladen
        drawRect(0, 0, canvas.width, canvas.height, '#333'); // Dunkelgrau
        if (!imagesLoaded) {
            // Optional: Ladeanzeige über Fallback-Farbe
             drawText("Loading Assets...", canvas.width / 2, canvas.height / 2, 'white', '30px');
        }
    }

    // Draw based on game state (Rest der Funktion bleibt gleich)
    if (gameState === 'start') {
        // Wenn Startbildschirm einen eigenen Hintergrund braucht, hier anpassen
        drawStartScreen();
    } else if (gameState === 'gameOver') {
        // Hintergrund wird bereits gezeichnet, dann GameOver Overlay
        drawGameOverScreen();
    } else if (gameState === 'lootboxSpinning') {
        // Zeichne normale Elemente unter der Animation
        drawPath(); drawDrops(); drawTowers();
        // Filter hinzugefügt zur Sicherheit gegen null/undefined Elemente
        enemies.filter(e => e).forEach(enemy => drawEnemy(enemy));
        projectiles.filter(p => p).forEach(p => drawProjectile(p));
        if (player) drawPlayer();
        drawUI();
        // Zeichne die Reel-Animation
        drawLootboxSpinning();
    } else if (gameState && gameState !== 'start') { // Nur zeichnen, wenn Spiel läuft/pausiert etc.
        // Zeichne normale Spielelemente für andere aktive Zustände
        drawPath();
        drawDrops();
        drawTowers();
         // Filter hinzugefügt zur Sicherheit
        enemies.filter(e => e).forEach(enemy => drawEnemy(enemy));
        projectiles.filter(p => p).forEach(p => drawProjectile(p));
        if (player) drawPlayer(); // Check if player exists
        drawUI(); // Draw HUD elements
    }
    // Die HTML Popups legen sich automatisch darüber
} // <<<<<<< ACHTUNG: Diese schließende Klammer muss vorhanden sein!

// --- Stelle sicher, dass die zweite Kopie von draw() gelöscht ist! ---


    // Note: HTML Popups (Perk Selection, Info, Lootbox) will automatically draw over the canvas
}

// === Game Loop ===
function gameLoop(timestamp) {
     // Warte, bis Bilder geladen sind und ein Spielzustand gesetzt ist
    if (!imagesLoaded || !gameState) {
        // Zeichne vielleicht einen Ladebildschirm?
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawText("Loading Assets...", canvas.width / 2, canvas.height / 2, 'white', '30px');
        requestAnimationFrame(gameLoop); // Weiter warten
        return; // Update und Draw überspringen
    }

    // Normale Logik, wenn Bilder geladen sind
    if (!lastTimestamp) lastTimestamp = timestamp;
    deltaTime = (timestamp - lastTimestamp) / 1000;
    deltaTime = Math.min(deltaTime, 1 / 15);
    lastTimestamp = timestamp;

    try {
        update();
        draw();
    } catch (error) {
        console.error("Error in game loop:", error);
    }

    requestAnimationFrame(gameLoop);
}

// === Event Listener Setup ===
window.addEventListener('keydown', (e) => {
    // Bewegungseingabe erlauben, wenn in spielbaren Zuständen
    if (gameState === 'playing' || gameState === 'betweenWaves') {
         keys[e.key] = true;
    }

    // Intermission mit Leertaste überspringen
    if (e.code === 'Space' && gameState === 'betweenWaves') {
        console.log("Skipping intermission!");
        intermissionTimer = 0;
        e.preventDefault(); // Standardverhalten der Leertaste verhindern
    }

    // Lootbox-Animation mit Leertaste überspringen <<<< NEUER TEIL HINZUGEFÜGT
    if (e.code === 'Space' && gameState === 'lootboxSpinning') {
        console.log("Skipping lootbox spin!");
        // Prüfen, ob die Belohnung nicht bereits angezeigt wird, um Mehrfachaufrufe zu vermeiden
        if (gameState === 'lootboxSpinning') {
            revealLootboxReward();
            lootboxSpinningTimer = 0; // Sicherstellen, dass der Timer stoppt
        }
        e.preventDefault(); // Standardverhalten der Leertaste verhindern
    }

    // Standard-Browseraktionen für Spieltasten verhindern
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d"].includes(e.key)) {
        // Verhindere Standard nur, wenn das Spiel in einem Zustand ist, in dem diese Tasten eine Aktion haben
        // <<<< BEDINGUNG ERWEITERT, um Leertaste im lootboxSpinning Zustand einzuschließen
        if (gameState === 'playing' || gameState === 'betweenWaves' || (e.code === 'Space' && (gameState === 'betweenWaves' || gameState === 'lootboxSpinning'))) {
             e.preventDefault();
        }
    }
});

window.addEventListener('keyup', (e) => {
    // Always register keyup to prevent sticky keys
    keys[e.key] = false;
});

// UI Button Listeners (with null checks)
if (playButton) playButton.addEventListener('click', () => {
    if(gameState === 'start') resetGame();
});

if (retryButton) retryButton.addEventListener('click', () => {
    if(gameState === 'gameOver') resetGame();
});

// Perk Selection Buttons
perkButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        if (gameState === 'selectingPerk') {
            const perkType = e.target.getAttribute('data-perk');
            if (perkType) {
                applyPerk(perkType);
            } else {
                console.warn("Clicked perk button has no data-perk attribute:", e.target);
            }
        }
    });
});

// Info Popup OK Button
if (infoOkButton) infoOkButton.addEventListener('click', () => {
    if(gameState === 'infoPopup') {
        setGameState(nextStateAfterPopup); // Go back to where we were before the popup
    }
});

// Lootbox Popup Buttons
if (lootboxOpenButton) lootboxOpenButton.addEventListener('click', () => {
    if(gameState === 'lootboxOpening') {
        openLootbox(); // Start the spinning animation
    }
});

if (lootboxOkButton) lootboxOkButton.addEventListener('click', () => {
    if (gameState === 'lootboxRevealing') {
        if (pendingLevelUps > 0) {
            // If levels were won, start the first perk selection
            console.log(`Lootbox OK clicked, ${pendingLevelUps} level(s) pending. Starting perk selection.`);
            setGameState('selectingPerk');
        } else {
            // If no levels won (e.g., got a tower), return to the game
            console.log("Lootbox OK clicked, no levels pending. Returning to game.");
            setGameState(nextStateAfterPopup);
        }
         // Hide the OK button itself (handled also in setGameState exit logic)
         lootboxOkButton.style.display = 'none';
    }
});


// --- Initialisierung ---
console.log("Game script loaded. Initializing...");

// Lade zuerst die Bilder. Der Spielstart (setGameState, gameLoop) erfolgt im .then() von loadImages.
loadImages().then(() => {
     // Dieser Code wird ausgeführt, NACHDEM alle Bilder erfolgreich geladen wurden.
     console.log("Image loading complete. Setting initial game state.");
     // Setze den Startzustand hier, damit `resetGame` korrekt aufgerufen werden kann,
     // wenn der Play-Button gedrückt wird (oder direkt, wenn du nicht mit Startscreen startest).
     setGameState('start'); // Oder 'betweenWaves', wenn direkt gestartet werden soll
     requestAnimationFrame(gameLoop); // Starte die Game Loop *nachdem* Bilder geladen sind
     console.log("Game loop initiated.");
}).catch(error => {
     // Fehler wurde schon in loadImages geloggt, hier evtl. zusätzliche UI-Info
     console.error("Initialization failed due to image loading errors.");
     // Zeige dem User eine permanente Fehlermeldung auf dem Canvas an?
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     drawText("Error loading game graphics!", canvas.width / 2, canvas.height / 2, 'red', '24px');
});
