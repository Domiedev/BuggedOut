function checkDropsCollection() {
    if (gameState != 'playing' && gameState != 'betweenWaves') return;
    if (!player) return;
    for (let i = drops.length - 1; i >= 0; i--) {
        let d = drops[i];
        if (player.x < d.x + d.width  && player.x + player.width  > d.x &&
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
        lootboxFinalItem = { type: 'level', value: 3, display: { color: 'red',    text: "+3 LVL" } };
    } else if (roll < 0.3) {
        lootboxFinalItem = { type: 'level', value: 2, display: { color: 'orange', text: "+2 LVL" } };
    } else if (roll < 0.6) {
        lootboxFinalItem = { type: 'level', value: 1, display: { color: 'yellow', text: "+1 LVL" } };
    } else {
        let towerType = getRandomElement(Object.keys(TOWER_TYPES));
        lootboxFinalItem = {
            type: 'tower', value: towerType,
            display: { color: TOWER_TYPES[towerType].color, text: TOWER_TYPES[towerType].name.substring(0, 6) }
        };
    }

    lootboxTargetIndex = Math.max(10, lootboxReel.length - 10 - Math.floor(Math.random() * 5));
    lootboxReel[lootboxTargetIndex] = lootboxFinalItem;
}

function triggerLootbox() {
    setupLootboxReel();
    nextStateAfterPopup = gameState;
    setGameState('lootboxOpening');
    if (lootboxTextP)     lootboxTextP.textContent = "You found a Lootbox!";
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'inline-block';
    if (lootboxOkButton)   lootboxOkButton.style.display = 'none';
    if (lootboxPopupDiv)   lootboxPopupDiv.style.display = 'block';
}

function openLootbox() {
    if (lootboxOpenButton) lootboxOpenButton.style.display = 'none';
    if (lootboxTextP)      lootboxTextP.textContent = "Spinning!";
    lootboxSpinningTimer = LOOTBOX_SPIN_DURATION;
    lootboxReelPosition  = 0;
    lootboxSpinSpeed     = 1500 + Math.random() * 500;
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
        let typeKey = lootboxFinalItem.value;
        rewardText = "You received a " + TOWER_TYPES[typeKey].name + "! Place it!";
        pendingTowerPlacement = typeKey;
    } else {
        rewardText = "Unknown reward!?";
    }

    if (lootboxTextP)    lootboxTextP.textContent = rewardText;
    if (lootboxOkButton) lootboxOkButton.style.display = 'inline-block';
    setGameState('lootboxRevealing');
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
        player.shootSpeedMultiplier *= 1.2;
        player.currentShootInterval = BASE_SHOOT_INTERVAL / player.shootSpeedMultiplier;
    } else if (perkType == 'damage') {
        player.damageMultiplier *= 1.25;
        player.currentDamage = BASE_PROJECTILE_DAMAGE * player.damageMultiplier;
    } else if (perkType == 'shotgun') {
        player.projectileCount = Math.min(16, player.projectileCount + 1);
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
