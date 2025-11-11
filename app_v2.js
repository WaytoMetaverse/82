// 全景圖配置
const scenes = {
    '客餐廳': {
        basePath: '環景圖/客餐廳',
        hasFurniture: true,
        furniture: {
            sofa: ['A', 'B', 'C'],
            table: ['A', 'B', 'C']
        }
    },
    '主臥室': {
        basePath: '環景圖/主臥室',
        hasFurniture: false
    },
    '次臥室': {
        basePath: '環景圖/次臥室',
        hasFurniture: false
    }
};

// 當前狀態
let currentState = {
    scene: '客餐廳',
    sofa: 'A',
    table: 'A'
};

// 顏色ID定義（RGB值） - 與ID圖完全對應
const colorIDs = {
    '客餐廳': { r: 0, g: 255, b: 255, tolerance: 20 }, // 青色
    '主臥室': { r: 255, g: 255, b: 0, tolerance: 20 }, // 黃色
    '次臥室': { r: 0, g: 0, b: 255, tolerance: 20 }, // 藍色
    sofa: { r: 0, g: 255, b: 0, tolerance: 20 }, // 綠色
    table: { r: 255, g: 0, b: 0, tolerance: 20 } // 紅色
};

let viewer = null;
let idImage = null;
let idCanvas = null;
let idCtx = null;
let highlightCanvas = null;
let highlightCtx = null;

// 獲取當前圖片路徑
function getCurrentImagePath() {
    const scene = scenes[currentState.scene];
    if (scene.hasFurniture) {
        return `${scene.basePath}_${currentState.sofa}沙發_${currentState.table}茶几.jpg`;
    }
    return `${scene.basePath}.jpg`;
}

// 獲取當前ID圖片路徑
function getCurrentIDImagePath() {
    const scene = scenes[currentState.scene];
    if (scene.hasFurniture) {
        return `${scene.basePath}_${currentState.sofa}沙發_${currentState.table}茶几_ID.jpg`;
    }
    return `${scene.basePath}_ID.jpg`;
}

// 初始化
function init() {
    console.log('==== 初始化 ====');
    
    // 初始化畫布
    initCanvas();
    
    // 創建全景圖查看器
    const initialPath = getCurrentImagePath();
    console.log('初始全景圖:', initialPath);
    
    viewer = pannellum.viewer('panorama', {
        "type": "equirectangular",
        "panorama": initialPath,
        "autoLoad": true,
        "showControls": true,
        "hfov": 90,
        "minHfov": 50,
        "maxHfov": 120
    });
    
    // 等待初始場景加載完成
    viewer.on('load', function() {
        console.log('全景圖加載成功');
        loadIDImage();
        
        // 在全景圖加載完成後才設置畫布事件
        setTimeout(() => {
            setupCanvasEvents();
            console.log('✓ 事件已綁定');
        }, 500);
    });
    
    viewer.on('error', function(err) {
        console.error('全景圖加載失敗:', err);
    });
    
    // 設置按鈕事件（這個可以先設置）
    setupButtons();
    
    // 更新UI
    updateUI();
}

// 初始化畫布
function initCanvas() {
    // ID檢測畫布
    idCanvas = document.getElementById('id-canvas');
    idCtx = idCanvas.getContext('2d', { willReadFrequently: true });
    
    // 高亮框線畫布
    highlightCanvas = document.getElementById('highlight-canvas');
    if (!highlightCanvas) {
        highlightCanvas = document.createElement('canvas');
        highlightCanvas.className = 'highlight-canvas';
        document.body.appendChild(highlightCanvas);
    }
    highlightCtx = highlightCanvas.getContext('2d');
    highlightCanvas.width = window.innerWidth;
    highlightCanvas.height = window.innerHeight;
    
    // 窗口大小變化時更新
    window.addEventListener('resize', () => {
        highlightCanvas.width = window.innerWidth;
        highlightCanvas.height = window.innerHeight;
        updateIDCanvas();
    });
}

// 設置畫布事件
function setupCanvasEvents() {
    const panoramaDiv = document.getElementById('panorama');
    
    // 移除舊的事件監聽器（如果有）
    const oldClick = panoramaDiv.onclick;
    panoramaDiv.onclick = null;
    
    // 添加新的事件監聽器
    panoramaDiv.addEventListener('click', handleClick, { once: false });
    panoramaDiv.addEventListener('mousemove', handleHoverThrottled, { once: false });
    panoramaDiv.addEventListener('mouseleave', () => {
        clearHighlight();
        document.getElementById('panorama').style.cursor = 'default';
    }, { once: false });
    
    console.log('事件監聽器設置完成');
}

// 節流版本的懸停處理
let hoverThrottleTimeout = null;
function handleHoverThrottled(event) {
    if (hoverThrottleTimeout) return;
    
    hoverThrottleTimeout = setTimeout(() => {
        handleHover(event);
        hoverThrottleTimeout = null;
    }, 50); // 50ms節流
}

// 節流函數
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

// 加載ID圖
function loadIDImage() {
    const path = getCurrentIDImagePath();
    console.log('加載ID圖:', path);
    
    idImage = new Image();
    idImage.crossOrigin = 'anonymous';
    
    idImage.onload = () => {
        console.log('ID圖加載成功');
        updateIDCanvas();
    };
    
    idImage.onerror = () => {
        console.error('ID圖加載失敗:', path);
    };
    
    idImage.src = path;
}

// 更新ID畫布
function updateIDCanvas() {
    if (!idImage || !idImage.complete || !idCanvas || !idCtx) {
        return;
    }
    
    const panoramaDiv = document.getElementById('panorama');
    const canvas = panoramaDiv.querySelector('canvas');
    
    if (canvas) {
        idCanvas.width = canvas.width;
        idCanvas.height = canvas.height;
        idCtx.drawImage(idImage, 0, 0, idCanvas.width, idCanvas.height);
        console.log('ID畫布已更新:', idCanvas.width, 'x', idCanvas.height);
    }
}

// 獲取點擊位置的顏色類型（正確處理全景圖坐標系統）
function getColorAtPosition(clientX, clientY) {
    if (!idCanvas || !idCtx || !idImage || !idImage.complete) {
        console.log('ID圖未就緒');
        return null;
    }
    
    if (!viewer) {
        console.log('查看器未就緒');
        return null;
    }
    
    const panoramaDiv = document.getElementById('panorama');
    const canvas = panoramaDiv.querySelector('canvas');
    if (!canvas) {
        console.log('找不到pannellum畫布');
        return null;
    }
    
    try {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        // 獲取當前的視角參數
        const currentPitch = viewer.getPitch();
        const currentYaw = viewer.getYaw();
        const currentHfov = viewer.getHfov();
        
        // 將屏幕座標轉換為相對於畫布中心的標準化座標
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsetX = x - centerX;
        const offsetY = y - centerY;
        
        // 計算視野的垂直和水平範圍
        const vfov = 2 * Math.atan(Math.tan(currentHfov * Math.PI / 360) * (rect.height / rect.width)) * 180 / Math.PI;
        
        // 根據偏移量計算pitch和yaw的變化
        const yawOffset = (offsetX / rect.width) * currentHfov;
        const pitchOffset = -(offsetY / rect.height) * vfov;
        
        // 計算最終的pitch和yaw
        const pitch = currentPitch + pitchOffset;
        const yaw = currentYaw + yawOffset;
        
        // 將pitch和yaw轉換為全景圖上的像素位置
        // 全景圖是等距柱狀投影（equirectangular）
        // X = (yaw / 360) * width + width/2
        // Y = (pitch / 180) * height + height/2
        const imgWidth = idImage.width;
        const imgHeight = idImage.height;
        
        // yaw範圍: -180到180，對應圖片的0到width
        // 確保yaw在-180到180之間
        let normalizedYaw = yaw;
        while (normalizedYaw > 180) normalizedYaw -= 360;
        while (normalizedYaw < -180) normalizedYaw += 360;
        
        const pixelX = Math.floor(((normalizedYaw + 180) / 360) * imgWidth);
        // pitch範圍: -90到90，對應圖片的0到height（反向）
        const pixelY = Math.floor(((90 - pitch) / 180) * imgHeight);
        
        console.log(`滑鼠位置 -> pitch: ${pitch.toFixed(2)}, yaw: ${normalizedYaw.toFixed(2)} -> 像素(${pixelX}, ${pixelY})`);
        
        // 驗證像素坐標是否有效
        if (!isFinite(pixelX) || !isFinite(pixelY) || pixelX < 0 || pixelX >= imgWidth || pixelY < 0 || pixelY >= imgHeight) {
            console.log('像素坐標無效');
            return null;
        }
        
        // 從ID圖讀取顏色（使用原始圖片尺寸）
        // 先確保idCanvas已經繪製了完整的ID圖
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        tempCtx.drawImage(idImage, 0, 0, imgWidth, imgHeight);
        
        const pixel = tempCtx.getImageData(pixelX, pixelY, 1, 1).data;
        const r = pixel[0], g = pixel[1], b = pixel[2];
        
        // 調試：顯示讀取到的RGB值
        if (r !== 0 || g !== 0 || b !== 0) {
            console.log(`讀取到RGB: (${r}, ${g}, ${b})`);
        }
        
        // 檢測顏色類型
        for (const [key, color] of Object.entries(colorIDs)) {
            if (key === 'sofa' || key === 'table') {
                if (currentState.scene !== '客餐廳') continue;
            }
            
            if (isColorMatch(r, g, b, color)) {
                console.log(`✓ 檢測到顏色: ${key}`);
                return key;
            }
        }
        
        return null;
    } catch (e) {
        console.error('讀取像素失敗:', e);
        return null;
    }
}

// 顏色匹配
function isColorMatch(r, g, b, targetColor) {
    const dr = r - targetColor.r;
    const dg = g - targetColor.g;
    const db = b - targetColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    return distance <= (targetColor.tolerance * Math.sqrt(3));
}

// 處理點擊
function handleClick(event) {
    const colorType = getColorAtPosition(event.clientX, event.clientY);
    
    if (colorType) {
        console.log('點擊:', colorType);
        
        // 場景切換
        if (colorType === '客餐廳' || colorType === '主臥室' || colorType === '次臥室') {
            switchScene(colorType);
        }
        // 家具替換
        else if (colorType === 'sofa') {
            cycleSofa();
        } else if (colorType === 'table') {
            cycleTable();
        }
    }
}

// 處理懸停
function handleHover(event) {
    const colorType = getColorAtPosition(event.clientX, event.clientY);
    
    if (colorType) {
        document.getElementById('panorama').style.cursor = 'pointer';
        console.log('✓ 顯示高亮:', colorType);
        // 先用簡單的圓圈測試
        drawSimpleHighlight(event.clientX, event.clientY, colorType);
    } else {
        document.getElementById('panorama').style.cursor = 'default';
        clearHighlight();
    }
}

// 繪製高亮框 - 掃描ID全景圖並高亮匹配區域的輪廓
function drawHighlight(x, y, colorType) {
    if (!highlightCtx || !idImage || !idImage.complete || !viewer) return;
    
    clearHighlight();
    
    const targetColor = colorIDs[colorType];
    if (!targetColor) return;
    
    const panoramaDiv = document.getElementById('panorama');
    const canvas = panoramaDiv.querySelector('canvas');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    
    // 創建臨時畫布來讀取ID圖
    const tempCanvas = document.createElement('canvas');
    const imgWidth = idImage.width;
    const imgHeight = idImage.height;
    tempCanvas.width = imgWidth;
    tempCanvas.height = imgHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.drawImage(idImage, 0, 0, imgWidth, imgHeight);
    
    const imageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
    const pixels = imageData.data;
    
    // 顏色映射
    const colorMap = {
        '客餐廳': 'rgba(0, 255, 255, 0.9)',
        '主臥室': 'rgba(255, 255, 0, 0.9)',
        '次臥室': 'rgba(0, 0, 255, 0.9)',
        'sofa': 'rgba(0, 255, 0, 0.9)',
        'table': 'rgba(255, 0, 0, 0.9)'
    };
    
    const highlightColor = colorMap[colorType] || 'rgba(255, 255, 255, 0.9)';
    
    highlightCtx.strokeStyle = highlightColor;
    highlightCtx.fillStyle = highlightColor;
    highlightCtx.lineWidth = 3;
    highlightCtx.shadowBlur = 10;
    highlightCtx.shadowColor = highlightColor;
    
    console.log('開始繪製高亮，顏色類型:', colorType);
    
    // 掃描ID圖，找出所有匹配顏色的邊緣像素
    const step = 3; // 每3個像素檢測一次，提升性能
    let edgeCount = 0;
    
    for (let py = 0; py < imgHeight; py += step) {
        for (let px = 0; px < imgWidth; px += step) {
            const idx = (py * imgWidth + px) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            
            if (isColorMatch(r, g, b, targetColor)) {
                // 檢查是否是邊緣像素
                const isEdge = checkIfEdgeInPanorama(px, py, imgWidth, imgHeight, pixels, targetColor);
                
                if (isEdge) {
                    // 將全景圖像素坐標轉換為pitch/yaw
                    const yaw = (px / imgWidth) * 360 - 180;
                    const pitch = 90 - (py / imgHeight) * 180;
                    
                    // 使用Pannellum的API將pitch/yaw轉換為屏幕座標
                    try {
                        const screenCoords = viewer.pitchYawToScreen(pitch, yaw);
                        if (screenCoords && screenCoords[0] !== null && screenCoords[1] !== null) {
                            const screenX = screenCoords[0] + rect.left;
                            const screenY = screenCoords[1] + rect.top;
                            
                            // 繪製邊緣點
                            highlightCtx.fillRect(screenX - 1.5, screenY - 1.5, 3, 3);
                            edgeCount++;
                        }
                    } catch (e) {
                        // 該點不在當前視野內，跳過
                    }
                }
            }
        }
    }
    
    console.log(`繪製了 ${edgeCount} 個邊緣點`);
}

// 檢查像素是否在邊緣（全景圖版本）
function checkIfEdgeInPanorama(x, y, width, height, pixels, targetColor) {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dx, dy] of directions) {
        let nx = x + dx;
        let ny = y + dy;
        
        // 處理水平環繞
        if (nx < 0) nx = width - 1;
        if (nx >= width) nx = 0;
        
        if (ny < 0 || ny >= height) {
            return true;
        }
        
        const idx = (ny * width + nx) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        if (!isColorMatch(r, g, b, targetColor)) {
            return true;
        }
    }
    
    return false;
}


// 繪製簡單高亮（測試用 - 在鼠標位置繪製圓圈）
function drawSimpleHighlight(x, y, colorType) {
    if (!highlightCtx) {
        console.log('highlightCtx 不存在');
        return;
    }
    
    clearHighlight();
    
    const colorMap = {
        '客餐廳': 'rgba(0, 255, 255, 0.9)', // 青色
        '主臥室': 'rgba(255, 255, 0, 0.9)', // 黃色
        '次臥室': 'rgba(0, 0, 255, 0.9)', // 藍色
        'sofa': 'rgba(0, 255, 0, 0.9)', // 綠色
        'table': 'rgba(255, 0, 0, 0.9)' // 紅色
    };
    
    const highlightColor = colorMap[colorType];
    console.log('繪製高亮圓圈，位置:', x, y, '顏色:', colorType);
    
    // 繪製一個大圓圈作為高亮指示
    highlightCtx.beginPath();
    highlightCtx.arc(x, y, 40, 0, Math.PI * 2);
    highlightCtx.strokeStyle = highlightColor;
    highlightCtx.lineWidth = 4;
    highlightCtx.setLineDash([10, 5]);
    highlightCtx.shadowBlur = 15;
    highlightCtx.shadowColor = highlightColor;
    highlightCtx.stroke();
    
    // 內圈
    highlightCtx.beginPath();
    highlightCtx.arc(x, y, 30, 0, Math.PI * 2);
    highlightCtx.strokeStyle = highlightColor;
    highlightCtx.lineWidth = 2;
    highlightCtx.setLineDash([5, 3]);
    highlightCtx.stroke();
    
    console.log('✓ 高亮繪製完成');
}

// 清除高亮
function clearHighlight() {
    if (highlightCtx && highlightCanvas) {
        highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    }
}

// 切換場景
function switchScene(sceneName) {
    console.log('==== 切換場景到:', sceneName, '====');
    currentState.scene = sceneName;
    
    if (!scenes[sceneName].hasFurniture) {
        currentState.sofa = 'A';
        currentState.table = 'A';
    }
    
    clearHighlight();
    reloadPanorama();
    updateUI();
}

// 循環切換沙發
function cycleSofa() {
    const sofas = ['A', 'B', 'C'];
    const currentIndex = sofas.indexOf(currentState.sofa);
    currentState.sofa = sofas[(currentIndex + 1) % 3];
    console.log('切換沙發到:', currentState.sofa);
    reloadPanorama();
    updateUI();
}

// 循環切換茶几
function cycleTable() {
    const tables = ['A', 'B', 'C'];
    const currentIndex = tables.indexOf(currentState.table);
    currentState.table = tables[(currentIndex + 1) % 3];
    console.log('切換茶几到:', currentState.table);
    reloadPanorama();
    updateUI();
}

// 重新加載全景圖
function reloadPanorama() {
    const newPath = getCurrentImagePath();
    console.log('==== 重新加載全景圖 ====');
    console.log('新路徑:', newPath);
    
    // 銷毀舊的查看器
    if (viewer) {
        try {
            viewer.destroy();
            console.log('舊查看器已銷毀');
        } catch (e) {
            console.log('銷毀查看器時出錯:', e);
        }
    }
    
    // 清除高亮
    clearHighlight();
    
    // 創建新的查看器
    setTimeout(() => {
        console.log('創建新查看器...');
        
        viewer = pannellum.viewer('panorama', {
            "type": "equirectangular",
            "panorama": newPath,
            "autoLoad": true,
            "showControls": true,
            "hfov": 90,
            "minHfov": 50,
            "maxHfov": 120
        });
        
        viewer.on('load', () => {
            console.log('✓ 新全景圖加載成功');
            
            // 加載對應的ID圖
            loadIDImage();
            
            // 重新綁定事件（很重要！）
            setTimeout(() => {
                setupCanvasEvents();
                console.log('✓ 事件重新綁定完成');
            }, 300);
        });
        
        viewer.on('error', (err) => {
            console.error('✗ 加載失敗:', err, newPath);
        });
    }, 100);
}

// 設置按鈕事件
function setupButtons() {
    // 場景按鈕
    document.querySelectorAll('.scene-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchScene(btn.getAttribute('data-scene'));
        });
    });
    
    // 沙發按鈕
    document.querySelectorAll('.sofa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentState.sofa = btn.getAttribute('data-sofa');
            console.log('按鈕切換沙發到:', currentState.sofa);
            reloadPanorama();
            updateUI();
        });
    });
    
    // 茶几按鈕
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentState.table = btn.getAttribute('data-table');
            console.log('按鈕切換茶几到:', currentState.table);
            reloadPanorama();
            updateUI();
        });
    });
}

// 更新UI
function updateUI() {
    document.getElementById('current-scene').textContent = currentState.scene;
    document.getElementById('current-sofa').textContent = currentState.sofa;
    document.getElementById('current-table').textContent = currentState.table;
    
    // 顯示/隱藏家具控制
    const furnitureControls = document.getElementById('furniture-controls');
    furnitureControls.style.display = scenes[currentState.scene].hasFurniture ? 'block' : 'none';
    
    // 更新按鈕活動狀態
    document.querySelectorAll('.scene-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-scene') === currentState.scene);
    });
    
    document.querySelectorAll('.sofa-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sofa') === currentState.sofa);
    });
    
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-table') === currentState.table);
    });
}

// 頁面加載完成後初始化
window.addEventListener('load', () => {
    setTimeout(init, 100);
});

