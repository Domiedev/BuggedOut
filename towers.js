function drawTowers() {
    for (let i = 0; i < towers.length; i++) {
        let tower = towers[i];
        let w = tower.width;
        let h = tower.height;
        ctx.save();
        ctx.translate(tower.x, tower.y);

        drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.3, '#555');

        if (tower.type == 'sniper') {
            drawRect(w * 0.4,  0,       w * 0.2, h * 0.8,  tower.color);
            drawRect(w * 0.25, h * 0.5, w * 0.5, h * 0.25, '#444');
            drawRect(w * 0.3,  h * 0.4, w * 0.4, h * 0.1,  '#333');
            drawText(Math.floor(tower.chargePercent) + '%', w / 2, -10, 'cyan', '12px');
        } else if (tower.type == 'trap') {
            if (tower.isActive) {
                drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.2, '#888');
                ctx.fillStyle = '#A9A9A9';
                ctx.beginPath();
                ctx.moveTo(w * 0.2, h * 0.8); ctx.lineTo(w * 0.3, h * 0.3); ctx.lineTo(w * 0.4, h * 0.8);
                ctx.moveTo(w * 0.6, h * 0.8); ctx.lineTo(w * 0.7, h * 0.3); ctx.lineTo(w * 0.8, h * 0.8);
                ctx.fill();
            } else {
                drawRect(w * 0.2, h * 0.8, w * 0.6, h * 0.1, '#666');
            }
        } else {
            drawRect(0, 0, w, h, tower.color);
        }

        ctx.restore();

        if (tower.type == 'sniper' && tower.chargePercent >= 80) {
            let target = findHighestHealthEnemy();
            if (target) {
                let opacity = ((tower.chargePercent - 80) / 20) * 0.8;
                let cx = tower.x + tower.width  / 2;
                let cy = tower.y + tower.height / 2;
                let tx = target.x + target.width  / 2;
                let ty = target.y + target.height / 2;
                ctx.strokeStyle = 'rgba(0, 191, 255, ' + opacity + ')';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
                ctx.lineWidth = 1;
            }
        }
    }
}

function updateTowers() {
    for (let i = 0; i < towers.length; i++) {
        let tower = towers[i];

        if (tower.type == 'sniper') {
            updateSniper(tower);
        } else {
            tower.cooldownTimer = Math.max(0, tower.cooldownTimer - deltaTime);
            if (tower.cooldownTimer <= 0) {
                if (tower.type == 'trap') updateTrap(tower);
            }
            if (tower.type == 'trap' && tower.isActive) {
                tower.activeTimer -= deltaTime;
                if (tower.activeTimer <= 0) tower.isActive = false;
            }
        }
    }
}

function updateSniper(tower) {
    if (tower.chargePercent < 100) {
        tower.chargePercent = Math.min(100, tower.chargePercent + tower.chargeRate * deltaTime);
    }

    if (tower.chargePercent >= 100) {
        let target = findHighestHealthEnemy();
        if (target) {
            let cx = tower.x + tower.width  / 2;
            let cy = tower.y + tower.height / 2;
            let tx = target.x + target.width  / 2;
            let ty = target.y + target.height / 2;
            let angle = Math.atan2(ty - cy, tx - cx);
            projectiles.push({
                x: cx - 4, y: cy - 4,
                width: 8, height: 8,
                color: '#00BFFF',
                vx: Math.cos(angle) * 2000,
                vy: Math.sin(angle) * 2000,
                damage: TOWER_TYPES.sniper.baseDamage,
                isSniperBolt: true
            });
            tower.chargePercent = 0;
        }
    }
}

function updateTrap(tower) {
    let triggered = false;
    let cx = tower.x + tower.width  / 2;
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

function snapToPath(x, y) {
    let bestX = x, bestY = y, bestDist = Infinity;
    for (let i = 0; i < enemyPath.length - 1; i++) {
        let ax = enemyPath[i].x,   ay = enemyPath[i].y;
        let bx = enemyPath[i+1].x, by = enemyPath[i+1].y;
        let dx = bx - ax, dy = by - ay;
        let lenSq = dx * dx + dy * dy;
        let t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lenSq));
        let px = ax + t * dx;
        let py = ay + t * dy;
        let dist = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
        if (dist < bestDist) {
            bestDist = dist;
            bestX = px;
            bestY = py;
        }
    }
    return { x: bestX, y: bestY };
}

function startTowerPlacement(typeKey) {
    placingTowerType = typeKey;
    placingTowerX = canvas.width  / 2 - 15;
    placingTowerY = canvas.height / 2 - 15;

    if (typeKey == 'trap') {
        let snapped = snapToPath(placingTowerX + 15, placingTowerY + 15);
        placingTowerX = snapped.x - 15;
        placingTowerY = snapped.y - 15;
    }

    setGameState('placingTower');
}

function confirmTowerPlacement() {
    if (!placingTowerType) return;

    let typeKey = placingTowerType;
    let tw = 30, th = 30;

    let newTower = {
        type: typeKey,
        x: placingTowerX, y: placingTowerY,
        width: tw, height: th,
        color: TOWER_TYPES[typeKey].color,
        range: TOWER_TYPES[typeKey].range,
        cooldown: TOWER_TYPES[typeKey].cooldown,
        cooldownTimer: 0
    };

    if (typeKey == 'sniper') {
        newTower.chargeRate    = TOWER_TYPES.sniper.chargeRate;
        newTower.maxCharge     = TOWER_TYPES.sniper.maxCharge;
        newTower.chargePercent = 0;
    } else if (typeKey == 'trap') {
        newTower.damage         = TOWER_TYPES.trap.damage;
        newTower.slowDuration   = TOWER_TYPES.trap.slowDuration;
        newTower.slowFactor     = TOWER_TYPES.trap.slowFactor;
        newTower.activeDuration = TOWER_TYPES.trap.activeDuration;
        newTower.isActive       = false;
        newTower.activeTimer    = 0;
    }

    towers.push(newTower);
    placingTowerType = null;
    setGameState(nextStateAfterPopup);
}
