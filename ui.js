function setGameState(newState) {
    if (gameState == newState) return;
    gameState = newState;

    if (playButton)       playButton.style.display       = (gameState == 'start')         ? 'inline-block' : 'none';
    if (retryButton)      retryButton.style.display      = (gameState == 'gameOver')      ? 'inline-block' : 'none';
    if (perkSelectionDiv) perkSelectionDiv.style.display = (gameState == 'selectingPerk') ? 'block'        : 'none';
    if (infoPopupDiv)     infoPopupDiv.style.display     = (gameState == 'infoPopup')     ? 'block'        : 'none';
    if (lootboxPopupDiv) {
        let show = (gameState == 'lootboxOpening' || gameState == 'lootboxSpinning' || gameState == 'lootboxRevealing');
        lootboxPopupDiv.style.display = show ? 'block' : 'none';
    }
}

function drawPath() {
    ctx.strokeStyle = '#C8960C';
    ctx.lineWidth = 22;
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
    let cx = canvas.width / 2;
    let ty = canvas.height / 2 - 60;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.font         = "bold 74px Georgia, 'Times New Roman', serif";
    ctx.shadowColor  = '#B8860B';
    ctx.shadowBlur   = 18;

    let grad = ctx.createLinearGradient(cx - 220, ty - 40, cx + 220, ty + 40);
    grad.addColorStop(0,   '#7B4F00');
    grad.addColorStop(0.3, '#FFD700');
    grad.addColorStop(0.5, '#FFF8A0');
    grad.addColorStop(0.7, '#FFD700');
    grad.addColorStop(1,   '#7B4F00');
    ctx.fillStyle = grad;
    ctx.fillText("NEW CREATION", cx, ty);

    ctx.shadowBlur = 0;
    ctx.restore();

    drawText("Click the 'Play' button below to begin!", cx, canvas.height / 2 + 40, '#000000', '22px');
    drawText("Use Arrow Keys or WASD to Move",          cx, canvas.height / 2 + 75, '#000000', '16px');
    drawText("Spacebar Skips Intermission",             cx, canvas.height / 2 + 100, '#000000', '16px');
}

function drawGameOverScreen() {
    drawRect(0, 0, canvas.width, canvas.height, 'rgba(100, 0, 0, 0.8)');
    drawText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40, 'white', '60px');
    drawText('You reached Wave: ' + currentWave, canvas.width / 2, canvas.height / 2 + 20, 'white', '30px');
}

function drawLootboxSpinning() {
    let displayWidth = canvas.width * 0.8;
    let displayX     = canvas.width * 0.1;
    let displayY     = canvas.height / 2 - 50;
    let itemHeight   = 100;

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

function drawPlacementMode() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (placingTowerType == 'trap') {
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
        ctx.lineWidth = 24;
        ctx.beginPath();
        ctx.moveTo(enemyPath[0].x, enemyPath[0].y);
        for (let i = 1; i < enemyPath.length; i++) {
            ctx.lineTo(enemyPath[i].x, enemyPath[i].y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
    }

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.translate(placingTowerX, placingTowerY);
    let w = 30, h = 30;
    drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.3, '#555');

    if (placingTowerType == 'sniper') {
        drawRect(w * 0.4,  0,       w * 0.2, h * 0.8,  TOWER_TYPES.sniper.color);
        drawRect(w * 0.25, h * 0.5, w * 0.5, h * 0.25, '#444');
        drawRect(w * 0.3,  h * 0.4, w * 0.4, h * 0.1,  '#333');
    } else if (placingTowerType == 'trap') {
        drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.2, '#888');
        ctx.fillStyle = '#A9A9A9';
        ctx.beginPath();
        ctx.moveTo(w * 0.2, h * 0.8); ctx.lineTo(w * 0.3, h * 0.3); ctx.lineTo(w * 0.4, h * 0.8);
        ctx.moveTo(w * 0.6, h * 0.8); ctx.lineTo(w * 0.7, h * 0.3); ctx.lineTo(w * 0.8, h * 0.8);
        ctx.fill();
    }

    ctx.restore();

    drawText('Press ENTER to place', canvas.width / 2, 30, '#FFD700', '22px');
}
