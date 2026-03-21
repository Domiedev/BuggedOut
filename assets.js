function loadImages() {
    let imageSources = {
        angel: 'angel.png',
        imp:   'Goon1.png',
        bg1:   '1.png',
        bg2:   '2.png',
        bg3:   '3.png',
        bg4:   '4.png'
    };

    let totalImages = Object.keys(imageSources).length;
    let loadedCount = 0;
    let failed = false;

    for (let key in imageSources) {
        let img = new Image();
        img.onload = function() {
            gameImages[key] = img;
            loadedCount++;
            if (loadedCount >= totalImages && !failed) {
                imagesLoaded = true;
                setGameState('start');
                requestAnimationFrame(gameLoop);
            }
        };
        img.onerror = function() {
            failed = true;
            alert("Could not load image: " + imageSources[key]);
        };
        img.src = imageSources[key];
    }
}
