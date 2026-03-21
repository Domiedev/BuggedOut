function drawTowers() {
    for (let i = 0; i < towers.length; i++) {
        let tower = towers[i];
        let w = tower.width;
        let h = tower.height;
        ctx.save();
        ctx.translate(tower.x, tower.y);
        drawRect(w * 0.1, h * 0.7, w * 0.8, h * 0.3, '#555');

        if (tower.type == 'flamethrower') {
            drawRect(w * 0.2,  h * 0.4, w * 0.6, h * 0.4, '#A0522D');
            drawRect(w * 0.4,  h * 0.1, w * 0.2, h * 0.4, tower.color);
            drawRect(w * 0.35, 0,        w * 0.3, h * 0.1, '#666');
        } else if (tower.type == 'sniper') {
            drawRect(w * 0.4,  0,        w * 0.2, h * 0.8,  tower.color);
            drawRect(w * 0.25, h * 0.5,  w * 0.5, h * 0.25, '#444');
            drawRect(w * 0.3,  h * 0.4,  w * 0.4, h * 0.1,  '#333');
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
    }
}

function updateTowers() {
    for (let i = 0; i < towers.length; i++) {
        let tower = towers[i];
        tower.cooldownTimer = Math.max(0, tower.cooldownTimer - deltaTime);

        if (tower.cooldownTimer <= 0) {
            if (tower.type == 'flamethrower') updateFlamethrower(tower);
            else if (tower.type == 'sniper')  updateSniper(tower);
            else if (tower.type == 'trap')    updateTrap(tower);
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
    let cx = tower.x + tower.width  / 2;
    let cy = tower.y + tower.height / 2;
    for (let i = 0; i < enemies.length; i++) {
        let e = enemies[i];
        if (distanceSq(cx, cy, e.x + e.width / 2, e.y + e.height / 2) < tower.range * tower.range) {
            e.statusEffects.burning = {
                duration: TOWER_TYPES.flamethrower.burnDuration,
                damageInterval: 0.5, damageTimer: 0.5,
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

function placeRandomTower(typeKey) {
    let tw = 30;
    let th = 30;
    let attempts = 0;
    while (attempts < 50) {
        attempts++;
        let rx = Math.random() * (canvas.width  - tw - 40) + 20;
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
            newTower.baseDamage  = TOWER_TYPES.sniper.baseDamage;
            newTower.chargeRate  = TOWER_TYPES.sniper.chargeRate;
            newTower.maxCharge   = TOWER_TYPES.sniper.maxCharge;
            newTower.chargePercent = 0;
        } else if (typeKey == 'flamethrower') {
            newTower.burnDamagePerSecond = TOWER_TYPES.flamethrower.burnDamagePerSecond;
            newTower.burnDuration        = TOWER_TYPES.flamethrower.burnDuration;
            newTower.vulnerability       = TOWER_TYPES.flamethrower.vulnerability;
        } else if (typeKey == 'trap') {
            newTower.damage        = TOWER_TYPES.trap.damage;
            newTower.slowDuration  = TOWER_TYPES.trap.slowDuration;
            newTower.slowFactor    = TOWER_TYPES.trap.slowFactor;
            newTower.activeDuration = TOWER_TYPES.trap.activeDuration;
            newTower.isActive      = false;
            newTower.activeTimer   = 0;
        }

        towers.push(newTower);
        return true;
    }
    return false;
}
