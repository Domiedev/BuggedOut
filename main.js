function resetGame() {
    player = {
        x: canvas.width  / 2 - PLAYER_WIDTH  / 2,
        y: canvas.height / 2 - PLAYER_HEIGHT / 2,
        width:  PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        speed:  PLAYER_BASE_SPEED,
        dx: 0, dy: 0,
        health: PLAYER_MAX_HEALTH,
        level: 1, xp: 0,
        xpForNextLevel: BASE_XP_FOR_NEXT_LEVEL,
        shootSpeedMultiplier: 1,
        damageMultiplier: 1,
        projectileCount: 1,
        currentShootInterval: BASE_SHOOT_INTERVAL,
        currentDamage: BASE_PROJECTILE_DAMAGE,
        animFrame: 0,
        animTimer: 0,
        isEvil: false
    };
    enemies      = [];
    projectiles  = [];
    drops        = [];
    towers       = [];
    keys         = {};
    currentWave  = 0;
    waveTimer    = 0;
    intermissionTimer  = 3;
    enemySpawnTimer    = 0;
    shootTimer         = 0;
    nearestEnemyForLaser = null;
    availableEnemyTypes  = ['goon'];
    introducedEnemies    = {};
    lastTimestamp        = 0;
    deltaTime            = 0;
    lootboxSpinningTimer = 0;
    lootboxReelPosition  = 0;
    lootboxSpinSpeed     = 1500;
    lootboxFinalItem     = null;
    pendingLevelUps      = 0;
    setupLootboxReel();
    setGameState('betweenWaves');
}

function checkNewEnemyIntroduction() {
    let newKey = null;
    if (currentWave == 3 && !introducedEnemies['tank'])     newKey = 'tank';
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

function update() {
    if (gameState == 'playing' || gameState == 'betweenWaves') {
        movePlayer();
        checkDropsCollection();
        moveProjectiles();
        updateTowers();
        nearestEnemyForLaser = findNearestEnemy();

        player.animTimer += deltaTime;
        if (player.animTimer >= 0.12) {
            player.animTimer = 0;
            player.animFrame = (player.animFrame + 1) % 4;
        }
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
            lootboxReelPosition  += lootboxSpinSpeed * deltaTime;
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

    if (imagesLoaded) {
        if (gameImages.bg1 && gameImages.bg1.naturalWidth > 0) ctx.drawImage(gameImages.bg1, 0, 0, canvas.width, canvas.height);
        if (gameImages.bg2 && gameImages.bg2.naturalWidth > 0) ctx.drawImage(gameImages.bg2, 0, 0, canvas.width, canvas.height);
        if (gameImages.bg3 && gameImages.bg3.naturalWidth > 0) ctx.drawImage(gameImages.bg3, 0, 0, canvas.width, canvas.height);
        if (gameImages.bg4 && gameImages.bg4.naturalWidth > 0) ctx.drawImage(gameImages.bg4, 0, 0, canvas.width, canvas.height);
    } else {
        drawRect(0, 0, canvas.width, canvas.height, '#333');
    }

    if (gameState == 'start') {
        drawStartScreen();
    } else if (gameState == 'gameOver') {
        drawGameOverScreen();
    } else if (gameState == 'lootboxSpinning') {
        drawPath(); drawDrops(); drawTowers();
        for (let i = 0; i < enemies.length;     i++) { if (enemies[i])     drawEnemy(enemies[i]);         }
        for (let i = 0; i < projectiles.length; i++) { if (projectiles[i]) drawProjectile(projectiles[i]); }
        if (player) drawPlayer();
        drawUI();
        drawLootboxSpinning();
    } else if (gameState) {
        drawPath(); drawDrops(); drawTowers();
        for (let i = 0; i < enemies.length;     i++) { if (enemies[i])     drawEnemy(enemies[i]);         }
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
