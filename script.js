// ゲーム要素の取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const currentStageDisplay = document.getElementById('currentStageDisplay');
const targetScoreDisplay = document.getElementById('targetScoreDisplay');

// オーバーレイ要素
const startScreenElement = document.getElementById('startScreen');
const gameOverElement = document.getElementById('gameOver');
const stageClearElement = document.getElementById('stageClear');
const finalScoreElement = document.getElementById('finalScore');
const stageClearScoreElement = document.getElementById('stageClearScore');
const rotateDeviceMessage = document.getElementById('rotateDeviceMessage');

// ボタン要素
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const nextStageBtn = document.getElementById('nextStageBtn');
const jumpBtn = document.getElementById('jumpBtn');
const slideBtn = document.getElementById('slideBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');

// ゲーム変数
let gameRunning = false;
let score = 0;
let gameSpeed = 3;
let keys = {};
let currentStage = 1;
let targetScore = 200;
let frameCount = 0; // スピード調整やアニメーション用

// ステージ設定
const stageGoals = {
    1: { target: 200, obstacleChance: 0.015, itemChance: 0.0, newItem: [] },
    2: { target: 500, obstacleChance: 0.02, itemChance: 0.01, newItem: ['cyberChip'] },
    3: { target: 1000, obstacleChance: 0.025, itemChance: 0.015, newItem: ['malware'] },
    4: { target: 1500, obstacleChance: 0.03, itemChance: 0.02, newItem: [] },
    5: { target: 2000, obstacleChance: 0.035, itemChance: 0.025, newItem: [] }
};

// プレイヤー（ロボット）設定：ダブルジャンプ対応
const player = {
    x: 100,
    y: 0, // resizeCanvasで設定
    width: 40,
    height: 40,
    velocityY: 0,
    velocityX: 0,
    jumping: false,
    jumpCount: 0, // 現在のジャンプ回数
    maxJumps: 2,  // 最大ジャンプ回数（ダブルジャンプ）
    sliding: false,
    color: '#00ffff',
    maxSpeed: 6,
    acceleration: 0.8,
    friction: 0.85
};

// オブジェクト配列
let obstacles = [];
let backgroundElements = []; // ビルなど（奥）
let midgroundElements = [];  // ネオンなど（中）
let particles = [];

// サウンド設定（エラー回避のためtry-catchで囲むか、存在確認推奨）
const bgm = new Audio('audio/run.mp3');
bgm.loop = true;
bgm.volume = 0.4;
const jumpSound = new Audio('audio/tobu.mp3');
const pickupSound = new Audio('audio/pickup.mp3');
const malwareSound = new Audio('audio/malware.mp3');

function playSound(sound) {
    if(sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {}); // エラー無視（自動再生ポリシー対策）
    }
}

// --- ゲーム制御関数 ---

// 初期化（ロード時）
function init() {
    resizeCanvas();
    generateBackgroundElements(); // 背景だけ生成しておく
    drawBackground(); // 背景だけ描画
    
    // スタート画面を表示
    startScreenElement.classList.remove('hidden');
    gameOverElement.classList.add('hidden');
    stageClearElement.classList.add('hidden');
    
    checkOrientation();
}

// ゲーム開始
function startGame(startStage = 1) {
    if (isPortraitMobile()) {
        checkOrientation();
        return;
    }

    gameRunning = true;
    score = 0;
    currentStage = startStage;
    gameSpeed = 4 + (startStage * 0.5); // ステージごとにスピードアップ
    targetScore = stageGoals[currentStage].target;

    // プレイヤーリセット
    player.x = 100;
    player.y = canvas.height - 80;
    player.velocityY = 0;
    player.velocityX = 0;
    player.jumpCount = 0;
    player.sliding = false;

    resetStageElements();

    // UI更新
    startScreenElement.classList.add('hidden');
    gameOverElement.classList.add('hidden');
    stageClearElement.classList.add('hidden');
    updateScoreDisplay();

    playSound(bgm);
    gameLoop();
}

// ステージ要素リセット
function resetStageElements() {
    obstacles = [];
    particles = [];
    backgroundElements = [];
    midgroundElements = [];
    generateBackgroundElements();
}

// ステージクリア
function advanceStage() {
    gameRunning = false;
    bgm.pause();

    if (currentStage < 5) {
        stageClearScoreElement.textContent = score;
        stageClearElement.classList.remove('hidden');
        currentStage++;
        targetScore = stageGoals[currentStage].target;
    } else {
        gameOver(true);
    }
}

// 背景生成（パララックス用レイヤー分け）
function generateBackgroundElements() {
    // 奥のビル（ゆっくり動く）
    for (let i = 0; i < 15; i++) {
        backgroundElements.push({
            x: i * 100,
            y: canvas.height - (100 + Math.random() * 200),
            width: 60 + Math.random() * 60,
            height: 200 + Math.random() * 200,
            color: `hsl(${200 + Math.random() * 40}, 40%, ${10 + Math.random() * 15}%)`
        });
    }
    // 手前の装飾（普通に動く）
    for (let i = 0; i < 10; i++) {
        midgroundElements.push({
            x: Math.random() * canvas.width * 2,
            y: Math.random() * (canvas.height - 100),
            size: Math.random() * 4 + 2,
            color: ['#00ffff', '#ff00ff', '#ffff00'][Math.floor(Math.random() * 3)],
            speed: Math.random() * 0.5 + 0.5
        });
    }
}

// --- 描画・更新関数 ---

function drawPlayer() {
    ctx.save();
    
    // 残像エフェクト（スピード感）
    if (gameRunning) {
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x - 10, player.sliding ? player.y + 15 : player.y, player.width, player.sliding ? 25 : player.height);
        ctx.globalAlpha = 1.0;
    }

    ctx.shadowColor = player.color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = player.color;
    
    const bodyY = player.sliding ? player.y + 15 : player.y;
    const bodyHeight = player.sliding ? 25 : player.height;
    
    ctx.fillRect(player.x, bodyY, player.width, bodyHeight);
    
    // 目（進行方向を見る）
    ctx.fillStyle = '#ffff00';
    const eyeOffset = 8;
    ctx.fillRect(player.x + 24, bodyY + 8, 8, 6);
    
    // ジャンプ中のエフェクト
    if (player.jumpCount > 0 && !player.sliding) {
        ctx.fillStyle = '#ff9900';
        ctx.fillRect(player.x + 10, bodyY + bodyHeight, 20, 5); // ジェット噴射
    }

    ctx.restore();
}

function drawBackground() {
    // 暗めのサイバーパンクグラデーション
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#050510');
    gradient.addColorStop(1, '#1a1a30');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 奥のビル（パララックス効果：遅い）
    backgroundElements.forEach(bg => {
        ctx.fillStyle = bg.color;
        ctx.fillRect(bg.x, bg.y, bg.width, bg.height);
        // 窓
        ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        if (Math.floor(bg.x) % 3 === 0) { // 簡易的なランダム窓
             ctx.fillRect(bg.x + 10, bg.y + 20, 10, 10);
        }
    });

    // 中景（ネオン粒子など）
    midgroundElements.forEach(mg => {
        ctx.shadowColor = mg.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = mg.color;
        ctx.beginPath();
        ctx.arc(mg.x, mg.y, mg.size, 0, Math.PI*2);
        ctx.fill();
    });

    // 地面（グリッド線）
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 20);
    ctx.lineTo(canvas.width, canvas.height - 20);
    ctx.stroke();
}

function updateBackground() {
    // ビル：遅く移動 (パララックス)
    backgroundElements.forEach(bg => {
        bg.x -= gameSpeed * 0.2; 
        if (bg.x + bg.width < 0) {
            bg.x = canvas.width + Math.random() * 100;
            bg.height = 150 + Math.random() * 200;
            bg.y = canvas.height - bg.height;
        }
    });

    // ネオン：少し早く移動
    midgroundElements.forEach(mg => {
        mg.x -= gameSpeed * 0.5;
        if (mg.x < 0) mg.x = canvas.width + Math.random() * 200;
    });
}

function updatePlayer() {
    // 左右移動
    if (keys['ArrowLeft'] || keys['a']) {
        player.velocityX = Math.max(player.velocityX - player.acceleration, -player.maxSpeed);
    } else if (keys['ArrowRight'] || keys['d']) {
        player.velocityX = Math.min(player.velocityX + player.acceleration, player.maxSpeed);
    } else {
        player.velocityX *= player.friction;
    }
    
    player.x += player.velocityX;
    
    // 壁衝突
    if (player.x < 0) { player.x = 0; player.velocityX = 0; }
    if (player.x > canvas.width - player.width) { player.x = canvas.width - player.width; player.velocityX = 0; }
    
    // 重力とジャンプ
    player.velocityY += 0.6; // 重力を少し強くしてキビキビさせる
    player.y += player.velocityY;
    
    // 地面着地
    const groundLevel = canvas.height - 80;
    if (player.y >= groundLevel) {
        player.y = groundLevel;
        player.jumping = false;
        player.jumpCount = 0; // ジャンプ回数リセット
        player.velocityY = 0;
    }
}

function jump() {
    // ダブルジャンプロジック
    if (player.jumpCount < player.maxJumps && !player.sliding) {
        player.jumping = true;
        player.velocityY = -12; // ジャンプ力を調整
        player.jumpCount++;
        
        // 2段ジャンプ時はパーティクルを出すなどの演出も可能
        createParticles(player.x + 20, player.y + 40, '#ffffff', 5);
        
        playSound(jumpSound);
    }
}

function slide() {
    if (!player.jumping) {
        player.sliding = true;
        // スライディング中は少し加速
        if(player.velocityX > 0) player.velocityX += 2;
        
        setTimeout(() => { player.sliding = false; }, 600);
    }
}

// 障害物生成
function generateObstacle() {
    // ステージごとの生成ロジック
    const currentGoal = stageGoals[currentStage];
    const newItem = currentGoal.newItem || [];
    
    if (Math.random() < currentGoal.obstacleChance) {
        const types = ['box', 'laser', 'floating'];
        const type = types[Math.floor(Math.random() * types.length)];
        let obs = { type: type, x: canvas.width, color: '#ff3333' };

        if (type === 'box') {
            obs.y = canvas.height - 60; obs.width = 40; obs.height = 40;
        } else if (type === 'laser') {
            obs.y = canvas.height - 110; obs.width = 20; obs.height = 80; obs.color = '#ff0000'; // 縦長レーザーに変更
        } else if (type === 'floating') {
            obs.y = canvas.height - 150; obs.width = 60; obs.height = 20; obs.color = '#ff9900';
        }
        obstacles.push(obs);

    } else if (Math.random() < currentGoal.itemChance && newItem.length > 0) {
        // アイテム生成ロジック... (既存と同様だが簡略化)
        const itemType = newItem.includes('malware') && Math.random() < 0.4 ? 'malware' : 'cyberChip';
        let item = { 
            type: itemType, 
            x: canvas.width, 
            y: canvas.height - 100 - Math.random() * 60,
            size: 25
        };
        if(itemType === 'cyberChip') { item.color = '#00ccff'; item.value = 100; }
        else { item.color = '#ff00ff'; item.value = -200; }
        obstacles.push(item);
    }
}

function updateObstacles() {
    obstacles.forEach((obs, index) => {
        obs.x -= gameSpeed;
        if (obs.x + 100 < 0) {
            obstacles.splice(index, 1);
            if(obs.type !== 'cyberChip' && obs.type !== 'malware') score += 10;
        }
    });

    // 間隔を空けて生成
    if (obstacles.length === 0 || canvas.width - obstacles[obstacles.length - 1].x > 250) {
        generateObstacle();
    }
}

function drawObstacles() {
    obstacles.forEach(obs => {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = obs.color;
        ctx.fillStyle = obs.color;

        if (obs.type === 'cyberChip') {
            ctx.beginPath(); ctx.arc(obs.x + 12, obs.y + 12, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillText('+', obs.x+8, obs.y+16);
        } else if (obs.type === 'malware') {
            ctx.fillText('☠️', obs.x, obs.y + 20); // 簡易アイコン
        } else {
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            // テクスチャ風
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(obs.x+5, obs.y+5, obs.width-10, obs.height-10);
        }
        ctx.restore();
    });
}

// パーティクルシステム（エフェクト用）
function createParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 30, color: color
        });
    }
}

function updateAndDrawParticles() {
    for(let i = particles.length -1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        if(p.life <= 0) particles.splice(i, 1);
    }
    ctx.globalAlpha = 1.0;
}

// 衝突判定
function checkCollision() {
    const pRect = {
        x: player.x + 5, // 判定を少し甘くする
        y: player.sliding ? player.y + 15 : player.y,
        w: player.width - 10,
        h: player.sliding ? 25 : player.height
    };

    obstacles.forEach((obs, index) => {
        // 簡易矩形判定
        let obsRect = { x: obs.x, y: obs.y, w: obs.width || obs.size, h: obs.height || obs.size };
        
        if (pRect.x < obsRect.x + obsRect.w && pRect.x + pRect.w > obsRect.x &&
            pRect.y < obsRect.y + obsRect.h && pRect.y + pRect.h > obsRect.y) {
            
            if (obs.type === 'cyberChip') {
                score += obs.value;
                playSound(pickupSound);
                obstacles.splice(index, 1);
            } else if (obs.type === 'malware') {
                score += obs.value;
                playSound(malwareSound);
                obstacles.splice(index, 1);
                damageEffect(); // ダメージ演出
            } else {
                // 障害物衝突 -> ゲームオーバー
                damageEffect();
                gameOver(false);
            }
        }
    });
}

// ダメージ演出（Canvasの親要素を揺らす）
function damageEffect() {
    const wrapper = document.getElementById('gameCanvas');
    wrapper.classList.remove('damage-flash');
    void wrapper.offsetWidth; // リフロー強制
    wrapper.classList.add('damage-flash');
}

// ゲームループ
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateBackground();
    drawBackground();

    updatePlayer();
    drawPlayer();

    updateObstacles();
    drawObstacles();

    updateAndDrawParticles();
    checkCollision();
    updateScoreDisplay();

    if (score >= targetScore) {
        if (currentStage >= 5) gameOver(true);
        else advanceStage();
        return;
    }

    requestAnimationFrame(gameLoop);
}

function updateScoreDisplay() {
    scoreElement.textContent = Math.floor(score);
    currentStageDisplay.textContent = currentStage;
    targetScoreDisplay.textContent = targetScore;
}

function gameOver(cleared) {
    gameRunning = false;
    bgm.pause();
    
    if (cleared) {
        gameOverElement.querySelector('h2').textContent = "MISSION COMPLETE";
        gameOverElement.querySelector('p').textContent = "ALL STAGES CLEARED!";
        restartBtn.textContent = "NEW GAME";
        restartBtn.onclick = () => startGame(1);
    } else {
        gameOverElement.querySelector('h2').textContent = "SYSTEM FAILURE";
        gameOverElement.querySelector('p').textContent = `FINAL SCORE: ${score}`;
        restartBtn.textContent = "RETRY";
        restartBtn.onclick = () => startGame(currentStage);
    }
    finalScoreElement.textContent = score;
    gameOverElement.classList.remove('hidden');
}

// --- ユーティリティ ---

function isPortraitMobile() {
    return window.innerWidth < window.innerHeight && window.innerWidth <= 768;
}

function checkOrientation() {
    if (isPortraitMobile()) {
        rotateDeviceMessage.classList.remove('hidden');
        gameRunning = false;
        bgm.pause();
    } else {
        rotateDeviceMessage.classList.add('hidden');
        // メニューが表示されていなければ再開可能
        if (!gameRunning && startScreenElement.classList.contains('hidden') && 
            gameOverElement.classList.contains('hidden') && stageClearElement.classList.contains('hidden')) {
            gameRunning = true;
            bgm.play().catch(()=>{});
            gameLoop();
        }
    }
}

function resizeCanvas() {
    const container = document.querySelector('.game-container');
    if(container) {
        const style = getComputedStyle(canvas);
        canvas.width = parseInt(style.width);
        canvas.height = parseInt(style.height);
        player.y = canvas.height - 80;
    }
}

// --- イベントリスナー ---

startBtn.addEventListener('click', () => startGame(1));
nextStageBtn.addEventListener('click', () => {
    stageClearElement.classList.add('hidden');
    startGame(currentStage);
});

// キーボード操作
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (gameRunning) {
        if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); jump(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); slide(); }
    }
});
document.addEventListener('keyup', (e) => keys[e.key] = false);

// タッチ・マウス操作
const addTouch = (elem, action) => {
    if(!elem) return;
    elem.addEventListener('touchstart', (e) => { e.preventDefault(); action(); });
    elem.addEventListener('mousedown', (e) => { e.preventDefault(); action(); });
};
addTouch(jumpBtn, jump);
addTouch(slideBtn, slide);

// 左右移動ボタン（長押し対応はupdatePlayerでkeysを見る形式で対応済み）
const bindMove = (btn, key) => {
    const start = (e) => { e.preventDefault(); keys[key] = true; };
    const end = (e) => { e.preventDefault(); keys[key] = false; };
    btn.addEventListener('touchstart', start); btn.addEventListener('touchend', end);
    btn.addEventListener('mousedown', start); btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
};
bindMove(leftBtn, 'ArrowLeft');
bindMove(rightBtn, 'ArrowRight');

window.addEventListener('resize', () => {
    resizeCanvas();
    checkOrientation();
});

// 初期化実行
window.addEventListener('load', init);