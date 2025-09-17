// ビューポートの高さを CSS 変数 --vh に設定
function updateVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// 初期設定とリサイズ時の更新
updateVh();
window.addEventListener('resize', updateVh);
window.addEventListener('orientationchange', () => {
    setTimeout(updateVh, 100);
});

// ゲーム要素の取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const currentStageDisplay = document.getElementById('currentStageDisplay');
const targetScoreDisplay = document.getElementById('targetScoreDisplay');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const jumpBtn = document.getElementById('jumpBtn');
const slideBtn = document.getElementById('slideBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const stageClearElement = document.getElementById('stageClear');
const stageClearScoreElement = document.getElementById('stageClearScore');
const nextStageBtn = document.getElementById('nextStageBtn');
const rotateDeviceMessage = document.getElementById('rotateDeviceMessage');

// ゲーム変数
let gameRunning = false;
let score = 0;
let gameSpeed = 3;
let keys = {};
let currentStage = 1;
let targetScore = 200;
let lastTime = 0;
let deltaTime = 0;

// ステージごとの設定
const stageGoals = {
    1: { target: 200, obstacleChance: 0.02, itemChance: 0.0 },
    2: { target: 400, obstacleChance: 0.025, itemChance: 0.015, newItem: ['cyberChip'] },
    3: { target: 600, obstacleChance: 0.03, itemChance: 0.02, newItem: ['malware'] },
    4: { target: 800, obstacleChance: 0.035, itemChance: 0.025, newItem: [] },
    5: { target: 1000, obstacleChance: 0.04, itemChance: 0.03, newItem: [] }
};

// プレイヤー（ロボット）
const player = {
    x: 100,
    y: 0,
    width: 40,
    height: 40,
    velocityY: 0,
    velocityX: 0,
    jumping: false,
    sliding: false,
    color: '#00ffff',
    maxSpeed: 5,
    acceleration: 0.5,
    friction: 0.8
};

// ゲーム配列
let obstacles = [];
let backgroundElements = [];
let particles = [];

// サウンド要素（エラーハンドリング付き）
let bgm, jumpSound, pickupSound, malwareSound;

try {
    bgm = new Audio('audio/run.mp3');
    bgm.loop = true;
    bgm.volume = 0.3;
    
    jumpSound = new Audio('audio/tobu.mp3');
    jumpSound.volume = 0.5;
    
    pickupSound = new Audio('audio/pickup.mp3');
    pickupSound.volume = 0.5;
    
    malwareSound = new Audio('audio/malware.mp3');
    malwareSound.volume = 0.5;
} catch (error) {
    console.log('Audio files not found, running without sound');
    bgm = { play: () => {}, pause: () => {}, currentTime: 0 };
    jumpSound = { play: () => {}, currentTime: 0 };
    pickupSound = { play: () => {}, currentTime: 0 };
    malwareSound = { play: () => {}, currentTime: 0 };
}

// キャンバスのサイズ設定
function resizeCanvas() {
    const canvasWrapper = canvas.parentElement;
    const rect = canvasWrapper.getBoundingClientRect();
    const maxWidth = Math.min(rect.width, 800);
    const maxHeight = rect.height;
    
    // アスペクト比を維持
    const aspectRatio = 2;
    let canvasWidth = maxWidth;
    let canvasHeight = maxWidth / aspectRatio;
    
    if (canvasHeight > maxHeight) {
        canvasHeight = maxHeight;
        canvasWidth = maxHeight * aspectRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    
    // プレイヤーの位置を再調整
    player.y = canvas.height - 80;
    
    // 背景要素を再生成
    if (gameRunning || obstacles.length === 0) {
        generateBackgroundElements();
    }
}

// ゲーム初期化
function initGame(startStage = 1) {
    if (window.innerWidth < window.innerHeight && window.innerWidth <= 768) {
        checkOrientation();
        return;
    }

    gameRunning = true;
    score = 0;
    currentStage = startStage;
    gameSpeed = 3 + (startStage - 1) * 0.5;
    targetScore = stageGoals[currentStage].target;

    // プレイヤーリセット
    player.x = 100;
    player.y = canvas.height - 80;
    player.velocityY = 0;
    player.velocityX = 0;
    player.jumping = false;
    player.sliding = false;
    
    resetStageElements();
    
    gameOverElement.classList.add('hidden');
    stageClearElement.classList.add('hidden');
    
    try {
        bgm.play().catch(e => console.log('BGM play failed:', e));
    } catch (e) {
        console.log('BGM not available');
    }

    updateScoreDisplay();
    lastTime = performance.now();
    gameLoop();
}

function resetStageElements() {
    obstacles = [];
    particles = [];
    backgroundElements = [];
    generateBackgroundElements();
}

function advanceStage() {
    if (currentStage < 5) {
        gameRunning = false;
        try {
            bgm.pause();
            bgm.currentTime = 0;
        } catch (e) {
            console.log('BGM control failed');
        }

        stageClearScoreElement.textContent = score;
        stageClearElement.classList.remove('hidden');
        
        currentStage++;
        targetScore = stageGoals[currentStage].target;
        gameSpeed += 0.5;
    } else {
        gameOver(true);
    }
}

// 次のステージボタンのイベント
nextStageBtn.addEventListener('click', () => {
    stageClearElement.classList.add('hidden');
    if (window.innerWidth >= window.innerHeight || window.innerWidth > 768) {
        gameRunning = true;
        score = 0;
        resetStageElements();
        updateScoreDisplay();
        try {
            bgm.play().catch(e => console.log('BGM play failed:', e));
        } catch (e) {}
        lastTime = performance.now();
        gameLoop();
    } else {
        checkOrientation();
    }
});

// 背景要素生成
function generateBackgroundElements() {
    backgroundElements = [];
    
    // ビル群
    for (let i = 0; i < 12; i++) {
        backgroundElements.push({
            type: 'building',
            x: i * 120,
            y: Math.random() * (canvas.height * 0.5) + (canvas.height * 0.1),
            width: 60 + Math.random() * 40,
            height: 100 + Math.random() * 80,
            color: `hsl(${200 + Math.random() * 60}, 50%, ${20 + Math.random() * 30}%)`
        });
    }
    
    // ネオンライト
    for (let i = 0; i < 15; i++) {
        backgroundElements.push({
            type: 'neon',
            x: Math.random() * canvas.width * 2,
            y: Math.random() * canvas.height,
            size: 2 + Math.random() * 4,
            color: ['#ff6b6b', '#00ffff', '#ffff00', '#ff00ff'][Math.floor(Math.random() * 4)],
            alpha: 0.5 + Math.random() * 0.5
        });
    }
}

// プレイヤー描画
function drawPlayer() {
    ctx.save();
    
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
    
    const bodyY = player.sliding ? player.y + 15 : player.y;
    const bodyHeight = player.sliding ? 25 : player.height;
    
    // メインボディ
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, bodyY, player.width, bodyHeight);
    
    // ロボットの目
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(player.x + 6, bodyY + 6, 6, 6);
    ctx.fillRect(player.x + player.width - 12, bodyY + 6, 6, 6);
    
    // 腕（スライド時は隠す）
    if (!player.sliding) {
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x - 6, bodyY + 12, 6, 12);
        ctx.fillRect(player.x + player.width, bodyY + 12, 6, 12);
    }
    
    // パーティクル効果
    if (Math.random() < 0.3) {
        particles.push({
            x: player.x + player.width / 2,
            y: bodyY + bodyHeight,
            velocityX: -2 - Math.random() * 3,
            velocityY: -1 - Math.random() * 2,
            life: 30,
            color: player.color,
            size: 2 + Math.random() * 3
        });
    }
    
    ctx.restore();
}

// 障害物・アイテム生成
function generateObstacle() {
    const obstacleTypes = ['box', 'laser', 'floating', 'wide'];
    const newItems = stageGoals[currentStage].newItem || [];
    const itemTypes = ['cyberChip', 'malware'].filter(type => newItems.includes(type));

    const typeRoll = Math.random();
    const obstacleChance = stageGoals[currentStage].obstacleChance;
    const itemChance = stageGoals[currentStage].itemChance;
    const groundY = canvas.height - 60;

    if (typeRoll < obstacleChance) {
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        let obstacle = {};
        
        switch(type) {
            case 'box':
                obstacle = { type: 'box', x: canvas.width, y: groundY, width: 40, height: 40, color: '#ff6b6b' };
                break;
            case 'laser':
                obstacle = { type: 'laser', x: canvas.width, y: canvas.height - 120, width: 60, height: 10, color: '#ff0000', glowIntensity: Math.random() * 20 + 10 };
                break;
            case 'floating':
                obstacle = { type: 'floating', x: canvas.width, y: canvas.height - 160, width: 80, height: 30, color: '#ff9900', glowIntensity: 15 };
                break;
            case 'wide':
                obstacle = { type: 'wide', x: canvas.width, y: canvas.height - 100, width: 120, height: 80, color: '#ff0066' };
                break;
        }
        obstacles.push(obstacle);
    } else if (typeRoll < obstacleChance + itemChance && itemTypes.length > 0) {
        const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        let item = {};
        
        if (itemType === 'cyberChip') {
            item = { type: 'cyberChip', x: canvas.width, y: canvas.height - 100 - Math.random() * 50, size: 20, color: '#00ccff', value: 50 };
        } else if (itemType === 'malware') {
            item = { type: 'malware', x: canvas.width, y: canvas.height - 100 - Math.random() * 50, size: 25, color: '#ff00ff', value: -100 };
        }
        obstacles.push(item);
    }
}

// 障害物・アイテム描画
function drawObstacles() {
    obstacles.forEach(obstacle => {
        ctx.save();
        
        switch(obstacle.type) {
            case 'box':
                ctx.shadowColor = obstacle.color;
                ctx.shadowBlur = 15;
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.fillRect(obstacle.x + 5, obstacle.y + 5, obstacle.width - 10, 5);
                break;
                
            case 'laser':
                ctx.shadowColor = obstacle.color;
                ctx.shadowBlur = obstacle.glowIntensity;
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                if (Math.random() < 0.5) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(obstacle.x + 2, obstacle.y + 2, obstacle.width - 4, obstacle.height - 4);
                }
                break;
                
            case 'floating':
                ctx.shadowColor = obstacle.color;
                ctx.shadowBlur = obstacle.glowIntensity;
                ctx.fillStyle = obstacle.color;
                const offset = Math.sin(Date.now() * 0.01) * 3;
                ctx.fillRect(obstacle.x, obstacle.y + offset, obstacle.width, obstacle.height);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(obstacle.x, obstacle.y + offset, obstacle.width, obstacle.height);
                break;
                
            case 'wide':
                ctx.shadowColor = obstacle.color;
                ctx.shadowBlur = 20;
                ctx.fillStyle = obstacle.color;
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                ctx.fillStyle = '#ffff00';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('⚠', obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2 + 5);
                break;
                
            case 'cyberChip':
                ctx.shadowColor = obstacle.color;
                ctx.shadowBlur = 15;
                ctx.fillStyle = obstacle.color;
                ctx.beginPath();
                ctx.arc(obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size / 2, obstacle.size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size / 2, obstacle.size / 4, 0, Math.PI * 2);
                ctx.fill();
                break;
                
            case 'malware':
                ctx.shadowColor = obstacle.color;
                ctx.shadowBlur = 15;
                ctx.fillStyle = obstacle.color;
                ctx.beginPath();
                ctx.moveTo(obstacle.x + obstacle.size / 2, obstacle.y);
                ctx.lineTo(obstacle.x + obstacle.size, obstacle.y + obstacle.size / 2);
                ctx.lineTo(obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size);
                ctx.lineTo(obstacle.x, obstacle.y + obstacle.size / 2);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('X', obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size / 2 + 4);
                break;
        }
        
        ctx.restore();
    });
}

// 背景描画
function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0f23');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    backgroundElements.forEach(element => {
        if (element.type === 'building') {
            ctx.fillStyle = element.color;
            ctx.fillRect(element.x, element.y, element.width, element.height);
            
            // ビルの窓
            ctx.fillStyle = '#ffff00';
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 6; j++) {
                    if (Math.random() < 0.3) {
                        ctx.fillRect(
                            element.x + 8 + i * 12,
                            element.y + 8 + j * 12,
                            6, 6
                        );
                    }
                }
            }
        } else if (element.type === 'neon') {
            ctx.save();
            ctx.globalAlpha = element.alpha;
            ctx.shadowColor = element.color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = element.color;
            ctx.fillRect(element.x, element.y, element.size, element.size);
            ctx.restore();
        }
    });
    
    // 地面
    ctx.fillStyle = '#333';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 20);
    ctx.lineTo(canvas.width, canvas.height - 20);
    ctx.stroke();
}

// パーティクル描画
function drawParticles() {
    particles.forEach((particle, index) => {
        ctx.save();
        ctx.globalAlpha = particle.life / 30;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 5;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        ctx.restore();
        
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.life--;
        
        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

// プレイヤー更新
function updatePlayer() {
    // 左右移動
    if (keys['ArrowLeft'] || keys['a']) {
        player.velocityX = Math.max(player.velocityX - player.acceleration, -player.maxSpeed);
    } else if (keys['ArrowRight'] || keys['d']) {
        player.velocityX = Math.min(player.velocityX + player.acceleration, player.maxSpeed);
    } else {
        player.velocityX *= player.friction;
        if (Math.abs(player.velocityX) < 0.1) {
            player.velocityX = 0;
        }
    }
    
    player.x += player.velocityX;
    
    // 画面端制限
    if (player.x < 0) {
        player.x = 0;
        player.velocityX = 0;
    }
    if (player.x > canvas.width - player.width) {
        player.x = canvas.width - player.width;
        player.velocityX = 0;
    }
    
    // 重力とジャンプ
    if (player.jumping) {
        player.velocityY += 0.5;
        player.y += player.velocityY;
        
        if (player.y >= canvas.height - 80) {
            player.y = canvas.height - 80;
            player.jumping = false;
            player.velocityY = 0;
        }
    }
}

// 障害物・アイテム更新
function updateObstacles() {
    obstacles.forEach((obstacle, index) => {
        obstacle.x -= gameSpeed;
        
        if (obstacle.x + (obstacle.width || obstacle.size) < 0) {
            obstacles.splice(index, 1);
            if (obstacle.type !== 'cyberChip' && obstacle.type !== 'malware') {
                score += 10;
            }
        }
    });
    
    if (obstacles.length < 5 && (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 150 - Math.random() * 100)) {
        generateObstacle();
    }
}

// 背景更新
function updateBackground() {
    backgroundElements.forEach(element => {
        if (element.type === 'building') {
            element.x -= gameSpeed * 0.3;
            if (element.x + element.width < 0) {
                element.x = canvas.width + Math.random() * 100;
            }
        } else if (element.type === 'neon') {
            element.x -= gameSpeed * 0.5;
            if (element.x < 0) {
                element.x = canvas.width + Math.random() * 100;
            }
        }
    });
}

// 衝突判定
function checkCollision() {
    const playerRect = {
        x: player.x,
        y: player.sliding ? player.y + 15 : player.y,
        width: player.width,
        height: player.sliding ? 25 : player.height
    };
    
    obstacles.forEach((obstacle, index) => {
        let obstacleRect = {};

        if (obstacle.type === 'box' || obstacle.type === 'laser' || obstacle.type === 'floating' || obstacle.type === 'wide') {
            obstacleRect = { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };
        } else if (obstacle.type === 'cyberChip' || obstacle.type === 'malware') {
            obstacleRect = { x: obstacle.x, y: obstacle.y, width: obstacle.size, height: obstacle.size };
        }

        if (playerRect.x < obstacleRect.x + obstacleRect.width &&
            playerRect.x + playerRect.width > obstacleRect.x &&
            playerRect.y < obstacleRect.y + obstacleRect.height &&
            playerRect.y + playerRect.height > obstacleRect.y) {
            
            if (obstacle.type === 'box' || obstacle.type === 'laser' || obstacle.type === 'floating' || obstacle.type === 'wide') {
                gameOver(false);
            } else if (obstacle.type === 'cyberChip') {
                score += obstacle.value;
                try {
                    pickupSound.currentTime = 0;
                    pickupSound.play().catch(e => {});
                } catch (e) {}
                obstacles.splice(index, 1);
            } else if (obstacle.type === 'malware') {
                score += obstacle.value;
                try {
                    malwareSound.currentTime = 0;
                    malwareSound.play().catch(e => {});
                } catch (e) {}
                if (score < 0) score = 0;
                obstacles.splice(index, 1);
            }
        }
    });
}

// 移動関数
function moveLeft() { keys['ArrowLeft'] = true; }
function moveRight() { keys['ArrowRight'] = true; }
function stopMove() { keys['ArrowLeft'] = false; keys['ArrowRight'] = false; }

// ジャンプ
function jump() {
    if (!player.jumping && !player.sliding) {
        player.jumping = true;
        player.velocityY = -12;
        try {
            jumpSound.currentTime = 0;
            jumpSound.play().catch(e => {});
        } catch (e) {}
    }
}

// スライド
function slide() {
    if (!player.jumping) {
        player.sliding = true;
        setTimeout(() => { player.sliding = false; }, 500);
    }
}

// スコア表示更新
function updateScoreDisplay() {
    scoreElement.textContent = score;
    currentStageDisplay.textContent = currentStage;
    targetScoreDisplay.textContent = targetScore;
}

// ゲームオーバー
function gameOver(gameCleared = false) {
    gameRunning = false;
    try {
        bgm.pause();
        bgm.currentTime = 0;
    } catch (e) {}

    if (gameCleared) {
        gameOverElement.querySelector('h2').textContent = 'ゲームクリア！おめでとう！';
        gameOverElement.querySelector('p').textContent = '全ステージをクリアしました！素晴らしい！';
        restartBtn.textContent = '最初からプレイ';
        restartBtn.onclick = () => initGame(1);
    } else {
        gameOverElement.querySelector('h2').textContent = 'ゲームオーバー';
        gameOverElement.querySelector('p').textContent = `最終スコア: ${score}`;
        restartBtn.textContent = 'もう一度プレイ';
        restartBtn.onclick = () => initGame(currentStage);
    }
    
    gameOverElement.classList.remove('hidden');
}

// ゲームループ
function gameLoop(currentTime = 0) {
    if (!gameRunning) {
        try { bgm.pause(); } catch (e) {}
        return;
    }
    
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();
    updateBackground();
    updatePlayer();
    updateObstacles();
    drawPlayer();
    drawObstacles();
    drawParticles();
    
    checkCollision();
    updateScoreDisplay();
    
    if (score >= targetScore && currentStage <= 5) {
        if (currentStage === 5) {
            gameOver(true);
        } else {
            advanceStage();
        }
        return;
    }
    
    requestAnimationFrame(gameLoop);
}

// 画面の向きチェック
function checkOrientation() {
    if (window.innerWidth < window.innerHeight && window.innerWidth <= 768) {
        rotateDeviceMessage.classList.remove('hidden');
        gameRunning = false;
        try { bgm.pause(); } catch (e) {}
    } else {
        rotateDeviceMessage.classList.add('hidden');
        if (!gameRunning && gameOverElement.classList.contains('hidden') && stageClearElement.classList.contains('hidden')) {
            initGame(currentStage);
        }
    }
}

// キーボードイベント
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    switch(e.key) {
        case ' ':
        case 'ArrowUp':
            e.preventDefault();
            jump();
            break;
        case 'ArrowDown':
            e.preventDefault();
            slide();
            break;
        case 'ArrowLeft':
        case 'a':
        case 'ArrowRight':
        case 'd':
            e.preventDefault();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// タッチイベント（スマホ対応）
function addTouchEvents(element, startAction, endAction) {
    // タッチイベント
    element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startAction();
    }, { passive: false });
    
    element.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (endAction) endAction();
    }, { passive: false });
    
    // マウスイベント（PC対応）
    element.addEventListener('mousedown', startAction);
    element.addEventListener('mouseup', () => { if (endAction) endAction(); });
    element.addEventListener('mouseleave', () => { if (endAction) endAction(); });
    
    // クリックイベント
    element.addEventListener('click', (e) => {
        e.preventDefault();
        startAction();
        if (endAction) setTimeout(endAction, 100);
    });
}

// ボタンイベント設定
addTouchEvents(jumpBtn, jump);
addTouchEvents(slideBtn, slide);
addTouchEvents(leftBtn, moveLeft, stopMove);
addTouchEvents(rightBtn, moveRight, stopMove);

// リサイズ・回転イベント
window.addEventListener('resize', () => {
    resizeCanvas();
    checkOrientation();
});

window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        resizeCanvas();
        checkOrientation();
    }, 100);
});

// スクロール防止
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// 初期化
window.addEventListener('load', () => {
    resizeCanvas();
    checkOrientation();
});

// ページ離脱時の処理
window.addEventListener('beforeunload', () => {
    try { bgm.pause(); } catch (e) {}
});
