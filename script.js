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
const rotateDeviceMessage = document.getElementById('rotateDeviceMessage'); // 追加: 画面回転メッセージ要素

// ゲーム変数
let gameRunning = false;
let score = 0;
let gameSpeed = 3;
let keys = {};
let currentStage = 1;
let targetScore = 200;

// ステージごとの設定
const stageGoals = {
    1: { target: 200, obstacleChance: 0.02, itemChance: 0.0 }, // アイテムなし
    2: { target: 400, obstacleChance: 0.025, itemChance: 0.015, newItem: ['cyberChip'] }, // サイバーチップ登場
    3: { target: 600, obstacleChance: 0.03, itemChance: 0.02, newItem: ['malware'] }, // マルウェア登場
    4: { target: 800, obstacleChance: 0.035, itemChance: 0.025, newItem: [] }, // 全種類出現
    5: { target: 1000, obstacleChance: 0.04, itemChance: 0.03, newItem: [] } // 最高難易度
};

// プレイヤー（ロボット）
const player = {
    x: 100,
    y: canvas.height - 80, // 初期位置はcanvasの高さに依存
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

// 障害物配列
let obstacles = [];

// 背景要素配列
let backgroundElements = [];

// パーティクル配列
let particles = [];

// サウンド要素の作成
const bgm = new Audio('audio/run.mp3');
bgm.loop = true;
bgm.volume = 0.5;

const jumpSound = new Audio('audio/tobu.mp3');
jumpSound.volume = 0.7;

const pickupSound = new Audio('audio/pickup.mp3');
pickupSound.volume = 0.7;

const malwareSound = new Audio('audio/malware.mp3');
malwareSound.volume = 0.7;


// ゲーム初期化
function initGame(startStage = 1) { // startStageパラメータを追加
    // 画面の向きが適切かチェック
    // 縦向きスマホならゲームを開始せずメッセージを表示
    if (window.innerWidth < window.innerHeight && window.innerWidth <= 768) {
        checkOrientation(); 
        return;
    }

    gameRunning = true;
    score = 0;
    currentStage = startStage; // 指定されたステージから開始
    gameSpeed = 3 + (startStage - 1); // ステージに応じてゲームスピードを調整
    
    // 現在のステージの目標スコアを設定
    targetScore = stageGoals[currentStage].target; 

    // プレイヤーリセット
    player.x = 100;
    // player.yはresizeCanvasで適切に設定される
    player.velocityY = 0;
    player.velocityX = 0;
    player.jumping = false;
    player.sliding = false;
    
    resetStageElements();
    
    // ゲームオーバー画面、ステージクリア画面を隠す
    gameOverElement.classList.add('hidden');
    stageClearElement.classList.add('hidden');
    
    // BGM再生開始
    bgm.play();

    // スコアとステージ表示を更新
    updateScoreDisplay();

    // ゲームループ開始
    gameLoop();
}

// ステージ要素のリセット（障害物、背景要素、パーティクル）
function resetStageElements() {
    obstacles = [];
    particles = [];
    backgroundElements = [];
    generateBackgroundElements();
}

// ステージクリア時の処理
function advanceStage() {
    if (currentStage < 5) {
        gameRunning = false; // ゲーム停止フラグを設定
        bgm.pause();
        bgm.currentTime = 0;

        stageClearScoreElement.textContent = score;
        stageClearElement.classList.remove('hidden');
        
        currentStage++;
        targetScore = stageGoals[currentStage].target;
        gameSpeed += 1;
        
    } else {
        gameOver(true); // 全ステージクリア
    }
}

// 次のステージボタンのクリックイベント
nextStageBtn.addEventListener('click', () => {
    stageClearElement.classList.add('hidden');
    // 次のステージに進む際も、向きが正しければゲームを再開
    if (window.innerWidth >= window.innerHeight || window.innerWidth > 768) { // 横画面またはPCの場合
        gameRunning = true; // ゲーム再開
        score = 0; // スコアをリセット
        resetStageElements();
        updateScoreDisplay();
        bgm.play();
        gameLoop();
    } else {
        // 縦画面の場合は、メッセージを表示してゲームは開始しない
        checkOrientation();
    }
});


// 背景要素生成
function generateBackgroundElements() {
    // ビル群
    for (let i = 0; i < 10; i++) {
        backgroundElements.push({
            type: 'building',
            x: i * 150,
            y: Math.random() * (canvas.height * 0.5) + (canvas.height * 0.1), // Adjusted based on canvas height
            width: 80 + Math.random() * 40,
            height: 150 + Math.random() * 100,
            color: `hsl(${200 + Math.random() * 60}, 50%, ${20 + Math.random() * 30}%)`
        });
    }
    
    // ネオンライト
    for (let i = 0; i < 20; i++) {
        backgroundElements.push({
            type: 'neon',
            x: Math.random() * canvas.width * 2,
            y: Math.random() * canvas.height,
            size: 3 + Math.random() * 5,
            color: ['#ff6b6b', '#00ffff', '#ffff00', '#ff00ff'][Math.floor(Math.random() * 4)],
            alpha: 0.5 + Math.random() * 0.5
        });
    }
}

// プレイヤー描画
function drawPlayer() {
    ctx.save();
    
    // ロボットの光る効果
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 20;
    
    // メインボディ
    ctx.fillStyle = player.color;
    const bodyY = player.sliding ? player.y + 15 : player.y;
    const bodyHeight = player.sliding ? 25 : player.height;
    
    ctx.fillRect(player.x, bodyY, player.width, bodyHeight);
    
    // ロボットの目
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(player.x + 8, bodyY + 8, 8, 8);
    ctx.fillRect(player.x + 24, bodyY + 8, 8, 8);
    
    // ロボットの腕（スライド時は隠す）
    if (!player.sliding) {
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x - 8, bodyY + 15, 8, 15);
        ctx.fillRect(player.x + player.width, bodyY + 15, 8, 15);
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
    
    // 現在のステージで追加されるアイテムの種類を取得
    const newItems = stageGoals[currentStage].newItem || [];
    const itemTypes = ['cyberChip', 'malware'].filter(type => newItems.includes(type));

    // 障害物かアイテムかランダムに決定
    const typeRoll = Math.random();
    const obstacleChance = stageGoals[currentStage].obstacleChance;
    const itemChance = stageGoals[currentStage].itemChance;

    // Y position for ground-based obstacles
    const groundY = canvas.height - 60; // Base Y position for obstacles on the ground

    if (typeRoll < obstacleChance) {
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        let obstacle = {};
        if (type === 'box') {
            obstacle = { type: 'box', x: canvas.width, y: groundY, width: 40, height: 40, color: '#ff6b6b' };
        } else if (type === 'laser') {
            obstacle = { type: 'laser', x: canvas.width, y: canvas.height - 120, width: 60, height: 10, color: '#ff0000', glowIntensity: Math.random() * 20 + 10 };
        } else if (type === 'floating') {
            obstacle = { type: 'floating', x: canvas.width, y: canvas.height - 160, width: 80, height: 30, color: '#ff9900', glowIntensity: 15 };
        } else if (type === 'wide') {
            obstacle = { type: 'wide', x: canvas.width, y: canvas.height - 100, width: 120, height: 80, color: '#ff0066' };
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
        
        if (obstacle.type === 'box') {
            // メタルボックス
            ctx.shadowColor = obstacle.color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = obstacle.color;
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // メタルの質感
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(obstacle.x + 5, obstacle.y + 5, obstacle.width - 10, 5);
        } else if (obstacle.type === 'laser') {
            // レーザートラップ
            ctx.shadowColor = obstacle.color;
            ctx.shadowBlur = obstacle.glowIntensity;
            ctx.fillStyle = obstacle.color;
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // レーザーの点滅効果
            if (Math.random() < 0.5) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(obstacle.x + 2, obstacle.y + 2, obstacle.width - 4, obstacle.height - 4);
            }
        } else if (obstacle.type === 'floating') {
            // 浮遊障害物
            ctx.shadowColor = obstacle.color;
            ctx.shadowBlur = obstacle.glowIntensity;
            ctx.fillStyle = obstacle.color;
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // 浮遊エフェクト
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            const offset = Math.sin(Date.now() * 0.01) * 3;
            ctx.fillRect(obstacle.x, obstacle.y + offset, obstacle.width, obstacle.height);
        } else if (obstacle.type === 'wide') {
            // 幅広障害物
            ctx.shadowColor = obstacle.color;
            ctx.shadowBlur = 20;
            ctx.fillStyle = obstacle.color;
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // 危険マーク
            ctx.fillStyle = '#ffff00';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚠', obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2 + 7);
        } else if (obstacle.type === 'cyberChip') {
            // サイバーチップ (ボーナスアイテム)
            ctx.shadowColor = obstacle.color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = obstacle.color;
            ctx.beginPath();
            ctx.arc(obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size / 2, obstacle.size / 2, 0, Math.PI * 2);
            ctx.fill();
            
            // 光るエフェクト
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size / 2, obstacle.size / 4, 0, Math.PI * 2);
            ctx.fill();

        } else if (obstacle.type === 'malware') {
            // マルウェア (トラップアイテム)
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

            // 警告マーク
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('X', obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size / 2 + 6);
        }
        
        ctx.restore();
    });
}

// 背景描画
function drawBackground() {
    // グラデーション背景
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0a0f23');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 背景要素描画
    backgroundElements.forEach(element => {
        if (element.type === 'building') {
            ctx.fillStyle = element.color;
            ctx.fillRect(element.x, element.y, element.width, element.height);
            
            // ビルの窓
            ctx.fillStyle = '#ffff00';
            for (let i = 0; i < 5; i++) {
                for (let j = 0; j < 8; j++) {
                    if (Math.random() < 0.3) {
                        ctx.fillRect(
                            element.x + 10 + i * 12,
                            element.y + 10 + j * 15,
                            8, 8
                        );
                    }
                }
            }
        } else if (element.type === 'neon') {
            ctx.save();
            ctx.globalAlpha = element.alpha;
            ctx.shadowColor = element.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = element.color;
            ctx.fillRect(element.x, element.y, element.size, element.size);
            ctx.restore();
        }
    });
    
    // 地面
    ctx.fillStyle = '#333';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    
    // 地面のライン
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
        
        // パーティクル更新
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.life--;
        
        // 古いパーティクルを削除
        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });
}

// プレイヤー更新
function updatePlayer() {
    // 左右移動の処理
    if (keys['ArrowLeft'] || keys['a']) {
        player.velocityX = Math.max(player.velocityX - player.acceleration, -player.maxSpeed);
    } else if (keys['ArrowRight'] || keys['d']) {
        player.velocityX = Math.min(player.velocityX + player.acceleration, player.maxSpeed);
    } else {
        // 摩擦で減速
        player.velocityX *= player.friction;
        if (Math.abs(player.velocityX) < 0.1) {
            player.velocityX = 0;
        }
    }
    
    // 横移動の適用
    player.x += player.velocityX;
    
    // 画面端での制限
    if (player.x < 0) {
        player.x = 0;
        player.velocityX = 0;
    }
    if (player.x > canvas.width - player.width) {
        player.x = canvas.width - player.width;
        player.velocityX = 0;
    }
    
    // 重力
    if (player.jumping) {
        player.velocityY += 0.2; // 変更: 落下速度（重力加速度）を0.2に
        player.y += player.velocityY;
        
        // 地面に着地
        if (player.y >= canvas.height - 80) { // Ensure player lands on the "ground"
            player.y = canvas.height - 80;
            player.jumping = false;
            player.velocityY = 0;
        }
    }
}

// 障害物・アイテム更新
function updateObstacles() {
    // 障害物移動
    obstacles.forEach((obstacle, index) => {
        obstacle.x -= gameSpeed;
        
        // 画面外の障害物を削除
        if (obstacle.x + (obstacle.width || obstacle.size) < 0) {
            obstacles.splice(index, 1);
            // スコアは障害物を避けたときのみ加算
            if (obstacle.type !== 'cyberChip' && obstacle.type !== 'malware') {
                score += 10;
            }
        }
    });
    
    // 新しい障害物・アイテム生成
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
            obstacleRect = {
                x: obstacle.x,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
            };
        } else if (obstacle.type === 'cyberChip' || obstacle.type === 'malware') {
            obstacleRect = {
                x: obstacle.x,
                y: obstacle.y,
                width: obstacle.size,
                height: obstacle.size
            };
        }

        if (playerRect.x < obstacleRect.x + obstacleRect.width &&
            playerRect.x + playerRect.width > obstacleRect.x &&
            playerRect.y < obstacleRect.y + obstacleRect.height &&
            playerRect.y + playerRect.height > obstacleRect.y) {
            
            // 障害物との衝突
            if (obstacle.type === 'box' || obstacle.type === 'laser' || obstacle.type === 'floating' || obstacle.type === 'wide') {
                gameOver(false);
            } 
            // アイテムとの衝突
            else if (obstacle.type === 'cyberChip') {
                score += obstacle.value;
                pickupSound.currentTime = 0;
                pickupSound.play();
                obstacles.splice(index, 1);
            } else if (obstacle.type === 'malware') {
                score += obstacle.value;
                malwareSound.currentTime = 0;
                malwareSound.play();
                if (score < 0) score = 0;
                obstacles.splice(index, 1);
            }
        }
    });
}

// 移動関数
function moveLeft() {
    keys['ArrowLeft'] = true;
}

function moveRight() {
    keys['ArrowRight'] = true;
}

function stopMove() {
    keys['ArrowLeft'] = false;
    keys['ArrowRight'] = false;
}

// ジャンプ
function jump() {
    if (!player.jumping && !player.sliding) {
        player.jumping = true;
        player.velocityY = -9; // 変更: ジャンプスピードを0.6倍（-9）に
        jumpSound.currentTime = 0;
        jumpSound.play();
    }
}

// スライド
function slide() {
    if (!player.jumping) {
        player.sliding = true;
        setTimeout(() => {
            player.sliding = false;
        }, 500);
    }
}

// スコアとステージ表示を更新
function updateScoreDisplay() {
    scoreElement.textContent = score;
    currentStageDisplay.textContent = currentStage;
    targetScoreDisplay.textContent = targetScore;
}

// ゲームオーバー
function gameOver(gameCleared = false) {
    gameRunning = false; // ゲーム停止フラグを設定
    bgm.pause();
    bgm.currentTime = 0;

    if (gameCleared) {
        gameOverElement.querySelector('h2').textContent = 'ゲームクリア！おめでとう！';
        gameOverElement.querySelector('p').textContent = '全ステージをクリアしました！素晴らしい！';
        restartBtn.textContent = '最初からプレイ';
        // 全ステージクリア時はステージ1から開始
        restartBtn.onclick = () => initGame(1);
    } else {
        gameOverElement.querySelector('h2').textContent = 'ゲームオーバー';
        gameOverElement.querySelector('p').textContent = `最終スコア: ${score}`;
        restartBtn.textContent = 'もう一度プレイ';
        // ゲームオーバー時は現在のステージから開始
        restartBtn.onclick = () => initGame(currentStage);
    }
    
    gameOverElement.classList.remove('hidden');
}

// ゲームループ
function gameLoop() {
    if (!gameRunning) {
        // ゲームが停止状態であれば、BGMも停止し、次のフレームを要求しない
        bgm.pause();
        return;
    }
    
    // 画面クリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 描画・更新
    drawBackground();
    updateBackground();
    updatePlayer();
    updateObstacles();
    drawPlayer();
    drawObstacles();
    drawParticles();
    
    // 衝突判定
    checkCollision();
    
    // スコア表示を更新
    updateScoreDisplay();
    
    // ステージクリア判定
    if (score >= targetScore && currentStage <= 5) {
        if (currentStage === 5) {
            gameOver(true);
        } else {
            advanceStage();
        }
        return; // ステージクリア/ゲームクリア後は次のフレームを要求しない
    }
    
    // 次のフレーム
    requestAnimationFrame(gameLoop);
}

// 画面の向きをチェックする関数
function checkOrientation() {
    // 縦向きスマホ (幅 < 高さ かつ 幅が768px以下) の場合
    if (window.innerWidth < window.innerHeight && window.innerWidth <= 768) { 
        rotateDeviceMessage.classList.remove('hidden'); // メッセージを表示
        gameRunning = false; // ゲームを一時停止
        bgm.pause();
    } else {
        rotateDeviceMessage.classList.add('hidden'); // メッセージを隠す
        // ゲームが停止していて、かつゲームオーバー/ステージクリア画面が表示されていなければゲームを再開
        // これにより、ゲームオーバー/ステージクリア後に回転した場合に勝手にゲームが始まらないようにする
        if (!gameRunning && gameOverElement.classList.contains('hidden') && stageClearElement.classList.contains('hidden')) {
            initGame(currentStage); // 現在のステージからゲームを初期化して再開
        }
        // ゲームオーバー/ステージクリア画面が表示されている場合は、何もしない（画面を維持）
    }
}


// イベントリスナー
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        jump();
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        slide();
    }
    if (e.key === 'ArrowLeft' || e.key === 'a') {
        e.preventDefault();
    }
    if (e.key === 'ArrowRight' || e.key === 'd') {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// Button events for desktop (click)
jumpBtn.addEventListener('click', jump);
slideBtn.addEventListener('click', slide);

// restartBtnとnextStageBtnのイベントリスナーはgameOver関数内で設定するように変更
// restartBtn.addEventListener('click', initGame); // この行は削除
// nextStageBtn.addEventListener('click', () => { // このブロックは削除またはコメントアウト
//     stageClearElement.classList.add('hidden');
//     if (window.innerWidth >= window.innerHeight || window.innerWidth > 768) {
//         gameRunning = true; 
//         score = 0; 
//         resetStageElements();
//         updateScoreDisplay();
//         bgm.play();
//         gameLoop();
//     } else {
//         checkOrientation();
//     }
// });

// Touch events (for mobile) - added e.preventDefault() to prevent default touch behaviors
jumpBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior (e.g., scrolling)
    jump();
});
jumpBtn.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent default touch behavior
});


slideBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    slide();
});
slideBtn.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent default touch behavior
});


leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    moveLeft();
});
leftBtn.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    stopMove();
});

rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    moveRight();
});
rightBtn.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent default touch behavior
    stopMove();
});

// For desktop mouse controls (original behavior)
leftBtn.addEventListener('mousedown', moveLeft);
leftBtn.addEventListener('mouseup', stopMove);
leftBtn.addEventListener('mouseleave', stopMove);
rightBtn.addEventListener('mousedown', moveRight);
rightBtn.addEventListener('mouseup', stopMove);
rightBtn.addEventListener('mouseleave', stopMove);


// キャンバスリサイズ（レスポンシブ対応）
function resizeCanvas() {
    // Get the computed style of the canvas to determine its displayed size
    const computedStyle = getComputedStyle(canvas);
    const displayedWidth = parseFloat(computedStyle.width);
    const displayedHeight = parseFloat(computedStyle.height);

    // Set the canvas's internal drawing buffer size to its displayed size
    canvas.width = displayedWidth;
    canvas.height = displayedHeight;
    
    // プレイヤーの位置を再調整
    // Ensure player is always on the ground relative to the current canvas height
    player.y = canvas.height - 80; 
    
    // Regenerate background elements to match new canvas size if needed (optional, but good for visual consistency)
    // You might want to clear existing elements and re-generate them
    resetStageElements();
}

// 画面リサイズ時（回転時も含む）にチェック
window.addEventListener('resize', () => {
    resizeCanvas();
    checkOrientation(); // 画面サイズ変更時にも向きをチェック
    // When resizing, force redraw immediately
    if (gameRunning) {
        gameLoop(); 
    } else if (gameOverElement.classList.contains('hidden') && stageClearElement.classList.contains('hidden')) {
        // If game is not running but no overlay is shown, means it's paused or just loaded, redraw initial state
        drawBackground();
        drawPlayer();
    }
});

// 初期ロード時にもチェック
window.addEventListener('load', () => {
    resizeCanvas(); // Ensure canvas is sized correctly on load
    checkOrientation(); // Check orientation and start game or show message
    // 初回ロード時にinitGameを呼び出すが、checkOrientationがすでに呼んでいるためコメントアウト
    // initGame();
});

// Disable default touchmove scrolling on mobile devices
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// ゲームの開始
// ゲームオーバー/ステージクリア時のボタンクリックによってinitGameが呼び出されるようにするため、
// ここでの直接的な呼び出しは削除
// initGame();
