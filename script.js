// Wähle das Canvas-Element aus dem HTML aus
const canvas = document.getElementById('gameCanvas');
// Hole den 2D-Zeichenkontext
const ctx = canvas.getContext('2d'); 

// --- Spielvariablen ---
let player = {
    x: canvas.width / 2 - 15, // Startposition X (Mitte)
    y: canvas.height / 2 - 15, // Startposition Y (Mitte)
    width: 30,
    height: 30,
    speed: 5,
    color: 'blue',
    dx: 0, // Bewegungsrichtung X
    dy: 0  // Bewegungsrichtung Y
};

let enemies = []; // Array für alle Gegner
let projectiles = []; // Array für alle Geschosse
let keys = {}; // Objekt zum Speichern gedrückter Tasten

// Beispiel für einen Pfad (Array von Koordinaten-Objekten)
const enemyPath = [
    { x: 0, y: 100 },
    { x: 700, y: 100 },
    { x: 700, y: 400 },
    { x: 100, y: 400 },
    { x: 100, y: 550 } // Ziel
];

let enemySpawnTimer = 0;
const enemySpawnInterval = 120; // Alle 120 Frames (ca. 2 Sek) einen neuen Gegner

let shootTimer = 0;
const shootInterval = 30; // Alle 30 Frames (ca. 0.5 Sek) schießen

// --- Hilfsfunktionen ---

// Zeichnet den Spieler
function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// Zeichnet einen Gegner
function drawEnemy(enemy) {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
}

// Zeichnet ein Geschoss
function drawProjectile(p) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.width, p.height);
}

// Zeichnet den Pfad (optional, zur Visualisierung)
function drawPath() {
    ctx.strokeStyle = 'grey';
    ctx.lineWidth = 20; // Breite des Pfades
    ctx.beginPath();
    ctx.moveTo(enemyPath[0].x, enemyPath[0].y);
    for (let i = 1; i < enemyPath.length; i++) {
        ctx.lineTo(enemyPath[i].x, enemyPath[i].y);
    }
    ctx.stroke();
    ctx.lineWidth = 1; // Zurücksetzen
}

// Bewegt den Spieler basierend auf dx, dy
function movePlayer() {
    player.x += player.dx;
    player.y += player.dy;

    // Kollisionserkennung mit Canvas-Rändern (optional)
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
}

// Funktion zum Erstellen neuer Gegner
function spawnEnemy() {
    enemies.push({
        x: enemyPath[0].x - 15, // Start am Anfang des Pfades (zentriert)
        y: enemyPath[0].y - 15,
        width: 30,
        height: 30,
        speed: 2,
        color: 'red',
        pathIndex: 0, // Aktueller Zielpunkt im Pfad-Array
        health: 100
    });
}

// Bewegt die Gegner entlang des Pfades
function moveEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        let targetPoint = enemyPath[enemy.pathIndex];

        // Richtung zum nächsten Punkt berechnen
        let dx = targetPoint.x - enemy.x - enemy.width/2; // Zielmitte - Gegnermitte
        let dy = targetPoint.y - enemy.y - enemy.height/2;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < enemy.speed) {
            // Punkt erreicht, zum nächsten wechseln
            enemy.pathIndex++;
            if (enemy.pathIndex >= enemyPath.length) {
                // Gegner hat das Ziel erreicht -> Entfernen (oder Spieler verliert Leben etc.)
                enemies.splice(i, 1); 
                console.log("Gegner am Ziel!");
                continue; // Zum nächsten Gegner springen
            }
            // Position genau auf den erreichten Punkt setzen, um Überschießen zu vermeiden
            // (optional, kann bei hohen Geschwindigkeiten helfen)
             enemy.x = targetPoint.x - enemy.width/2;
             enemy.y = targetPoint.y - enemy.height/2;

        } else {
            // Auf Zielpunkt zubewegen
            enemy.x += (dx / distance) * enemy.speed;
            enemy.y += (dy / distance) * enemy.speed;
        }
    }
}

// Funktion zum Schießen (automatisches Zielen)
function shoot() {
    if (enemies.length === 0) return; // Nicht schießen, wenn keine Gegner da sind

    // Finde den nächstgelegenen Gegner
    let nearestEnemy = null;
    let minDistanceSq = Infinity; // Quadrat der Distanz ist effizienter

    for (const enemy of enemies) {
        let dx = enemy.x + enemy.width / 2 - (player.x + player.width / 2);
        let dy = enemy.y + enemy.height / 2 - (player.y + player.height / 2);
        let distSq = dx * dx + dy * dy;

        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            nearestEnemy = enemy;
        }
    }

    if (nearestEnemy) {
         // Zielrichtung berechnen (vom Spielerzentrum zum Gegnerzentrum)
        let targetX = nearestEnemy.x + nearestEnemy.width / 2;
        let targetY = nearestEnemy.y + nearestEnemy.height / 2;
        let dx = targetX - (player.x + player.width / 2);
        let dy = targetY - (player.y + player.height / 2);
        let distance = Math.sqrt(dx*dx + dy*dy);

        // Normalisierter Richtungsvektor * Geschwindigkeit
        let projSpeed = 8;
        let velocityX = (dx / distance) * projSpeed;
        let velocityY = (dy / distance) * projSpeed;

        // Neues Projektil erstellen
        projectiles.push({
            x: player.x + player.width / 2 - 2.5, // Startet in der Mitte des Spielers
            y: player.y + player.height / 2 - 2.5,
            width: 5,
            height: 5,
            color: 'yellow',
            vx: velocityX,
            vy: velocityY,
            damage: 25 // Schaden pro Treffer
        });
    }
}

// Bewegt die Geschosse und prüft Kollisionen
function moveProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Projektil entfernen, wenn es aus dem Bild fliegt
        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
            projectiles.splice(i, 1);
            continue;
        }

        // Kollision mit Gegnern prüfen
        for (let j = enemies.length - 1; j >= 0; j--) {
            let enemy = enemies[j];
            // Einfache Rechteck-Kollision
            if (p.x < enemy.x + enemy.width &&
                p.x + p.width > enemy.x &&
                p.y < enemy.y + enemy.height &&
                p.y + p.height > enemy.y) {
                
                // Treffer!
                enemy.health -= p.damage;
                projectiles.splice(i, 1); // Projektil entfernen

                if (enemy.health <= 0) {
                    enemies.splice(j, 1); // Gegner entfernen
                    // Hier könnte man Punkte geben etc.
                    console.log("Gegner besiegt!");
                }
                break; // Projektil kann nur einen Gegner treffen
            }
        }
    }
}


// --- Event Listener für Tastatureingaben ---

// Taste gedrückt
window.addEventListener('keydown', (e) => {
    keys[e.key] = true; // Speichern, dass die Taste gedrückt ist
    updatePlayerMovement();
});

// Taste losgelassen
window.addEventListener('keyup', (e) => {
    keys[e.key] = false; // Speichern, dass die Taste nicht mehr gedrückt ist
    updatePlayerMovement();
});

// Aktualisiert die Bewegungsrichtung des Spielers basierend auf gedrückten Tasten
function updatePlayerMovement() {
    player.dx = 0;
    player.dy = 0;

    if (keys['ArrowUp'] || keys['w']) {
        player.dy = -player.speed;
    }
    if (keys['ArrowDown'] || keys['s']) {
        player.dy = player.speed;
    }
    if (keys['ArrowLeft'] || keys['a']) {
        player.dx = -player.speed;
    }
    if (keys['ArrowRight'] || keys['d']) {
        player.dx = player.speed;
    }
    // Diagonale Bewegung normalisieren (optional, sonst diagonal schneller)
    if (player.dx !== 0 && player.dy !== 0) {
        const factor = 1 / Math.sqrt(2);
        player.dx *= factor;
        player.dy *= factor;
    }
}


// --- Haupt-Spielschleife (Game Loop) ---
function gameLoop() {
    // 1. Löschen: Alte Zeichnung entfernen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Aktualisieren (Logik)
    movePlayer();
    moveEnemies();
    moveProjectiles();

    // Gegner spawnen
    enemySpawnTimer++;
    if (enemySpawnTimer >= enemySpawnInterval) {
        spawnEnemy();
        enemySpawnTimer = 0;
    }
    
    // Schießen Timer
    shootTimer++;
     if (shootTimer >= shootInterval) {
        shoot();
        shootTimer = 0;
    }


    // 3. Zeichnen
    drawPath(); // Zeichne den Pfad zuerst (Hintergrund)
    for (const enemy of enemies) {
        drawEnemy(enemy);
    }
     for (const p of projectiles) {
        drawProjectile(p);
    }
    drawPlayer();
   

    // Nächsten Frame anfordern
    requestAnimationFrame(gameLoop); 
}

// --- Spielstart ---
console.log("Spiel startet...");
gameLoop(); // Starte die Spielschleife