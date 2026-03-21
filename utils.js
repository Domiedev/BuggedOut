function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawText(text, x, y, color, size, align, baseline) {
    color    = color    || 'black';
    size     = size     || '20px';
    align    = align    || 'center';
    baseline = baseline || 'middle';
    ctx.fillStyle    = color;
    ctx.font         = size + ' Arial';
    ctx.textAlign    = align;
    ctx.textBaseline = baseline;
    ctx.fillText(text, x, y);
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function distanceSq(x1, y1, x2, y2) {
    return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}
