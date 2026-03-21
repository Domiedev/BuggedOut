function drawProjectile(p) {
    drawRect(p.x, p.y, p.width, p.height, p.color);
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

        for (let j = enemies.length - 1; j >= 0; j--) {
            if (!enemies[j]) continue;
            let e = enemies[j];
            if (p.x < e.x + e.width && p.x + p.width > e.x && p.y < e.y + e.height && p.y + p.height > e.y) {
                let dmg = p.damage;
                if (e.statusEffects.burning.duration > 0) dmg *= TOWER_TYPES.flamethrower.vulnerability;
                e.currentHealth -= dmg;
                projectiles.splice(i, 1);
                if (e.currentHealth <= 0) handleEnemyDefeat(e, j);
                break;
            }
        }
    }
}
