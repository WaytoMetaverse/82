// 全景圖配置
const scenes = {
    '客餐廳': { basePath: '環景圖/客餐廳', hasFurniture: true },
    '主臥室': { basePath: '環景圖/主臥室', hasFurniture: false },
    '次臥室': { basePath: '環景圖/次臥室', hasFurniture: false }
};

// 當前狀態
let currentState = { scene: '客餐廳', sofa: 'A', table: 'A' };

// 顏色ID定義
const colorIDs = {
    '客餐廳': { r: 255, g: 0, b: 255 },  // 粉紅色
    '主臥室': { r: 255, g: 255, b: 0 },  // 黃色
    '次臥室': { r: 0, g: 0, b: 255 },    // 藍色
    'sofa': { r: 0, g: 255, b: 0 },      // 綠色
    'table': { r: 255, g: 0, b: 0 }      // 紅色
};

let viewer = null;
let idImage = null;
let idCanvas = null;
let idCtx = null;
let highlightCanvas = null;
let highlightCtx = null;

// 獲取圖片路徑
function getImagePath() {
    const s = scenes[currentState.scene];
    return s.hasFurniture ? 
        `${s.basePath}_${currentState.sofa}沙發_${currentState.table}茶几.jpg` : 
        `${s.basePath}.jpg`;
}

function getIDImagePath() {
    const s = scenes[currentState.scene];
    return s.hasFurniture ? 
        `${s.basePath}_${currentState.sofa}沙發_${currentState.table}茶几_ID.jpg` : 
        `${s.basePath}_ID.jpg`;
}

// 初始化
function init() {
    console.log('==== 初始化 ====');
    
    // 初始化canvas
    idCanvas = document.getElementById('id-canvas');
    idCtx = idCanvas.getContext('2d', { willReadFrequently: true });
    
    highlightCanvas = document.getElementById('highlight-canvas');
    if (!highlightCanvas) {
        highlightCanvas = document.createElement('canvas');
        highlightCanvas.className = 'highlight-canvas';
        document.body.appendChild(highlightCanvas);
    }
    highlightCtx = highlightCanvas.getContext('2d');
    highlightCanvas.width = window.innerWidth;
    highlightCanvas.height = window.innerHeight;
    
    // 創建全景圖查看器
    viewer = pannellum.viewer('panorama', {
        type: 'equirectangular',
        panorama: getImagePath(),
        autoLoad: true,
        showControls: true,
        hfov: 90,
        minHfov: 50,
        maxHfov: 120
    });
    
    viewer.on('load', () => {
        console.log('✓ 全景圖加載成功');
        loadIDImage();
        setupEvents();
    });
    
    setupButtons();
    updateUI();
}

// 加載ID圖
function loadIDImage() {
    const path = getIDImagePath();
    console.log('加載ID圖:', path);
    
    idImage = new Image();
    idImage.crossOrigin = 'anonymous';
    
    idImage.onload = () => {
        console.log('✓ ID圖加載成功，尺寸:', idImage.width, 'x', idImage.height);
        updateIDCanvas();
    };
    
    idImage.onerror = () => {
        console.error('❌ ID圖加載失敗:', path);
    };
    
    idImage.src = path;
}

// 更新ID canvas（根據當前視角渲染ID圖）
function updateIDCanvas() {
    if (!idImage || !idImage.complete) return;
    
    const panoramaDiv = document.getElementById('panorama');
    const mainCanvas = panoramaDiv.querySelector('canvas');
    if (!mainCanvas) return;
    
    // 設置ID canvas與主canvas相同尺寸
    idCanvas.width = mainCanvas.width;
    idCanvas.height = mainCanvas.height;
    
    // 獲取當前視角參數
    const pitch = viewer.getPitch() || 0;
    const yaw = viewer.getYaw() || 0;
    const hfov = viewer.getHfov() || 90;
    
    console.log('更新ID canvas，視角:', pitch.toFixed(1), yaw.toFixed(1), hfov.toFixed(1));
    
    // 渲染ID圖到canvas（使用與主查看器相同的投影）
    renderEquirectangularToCanvas(idImage, idCanvas, idCtx, pitch, yaw, hfov);
}

// 將等距柱狀投影全景圖渲染到canvas（修正版本）
function renderEquirectangularToCanvas(image, canvas, ctx, pitch, yaw, hfov) {
    const width = canvas.width;
    const height = canvas.height;
    
    console.log('渲染ID圖投影，canvas尺寸:', width, 'x', height);
    console.log('視角參數 - pitch:', pitch, 'yaw:', yaw, 'hfov:', hfov);
    
    // 清空canvas
    ctx.clearRect(0, 0, width, height);
    
    // 計算垂直視野
    const vfov = 2 * Math.atan(Math.tan(hfov * Math.PI / 360) * (height / width)) * 180 / Math.PI;
    console.log('計算出 vfov:', vfov);
    
    // 創建臨時canvas用於讀取源圖片
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(image, 0, 0);
    const srcData = tempCtx.getImageData(0, 0, image.width, image.height);
    
    // 創建輸出圖像數據
    const outputData = ctx.createImageData(width, height);
    
    let renderedPixels = 0;
    let coloredPixels = 0;
    
    // 渲染每個像素
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // 將屏幕座標轉換為相對於中心的偏移量（-0.5 到 0.5）
            const offsetX = (x / width) - 0.5;
            const offsetY = (y / height) - 0.5;
            
            // 計算這個像素對應的pitch和yaw
            const pixelPitch = pitch - offsetY * vfov;
            const pixelYaw = yaw + offsetX * hfov;
            
            // 將pitch/yaw轉換為全景圖像素座標
            let normalizedYaw = pixelYaw;
            while (normalizedYaw > 180) normalizedYaw -= 360;
            while (normalizedYaw < -180) normalizedYaw += 360;
            
            // 等距柱狀投影公式
            const srcX = Math.floor(((normalizedYaw + 180) / 360) * image.width);
            const srcY = Math.floor(((90 - pixelPitch) / 180) * image.height);
            
            // 邊界檢查
            if (srcX >= 0 && srcX < image.width && srcY >= 0 && srcY < image.height) {
                const srcIdx = (srcY * image.width + srcX) * 4;
                const dstIdx = (y * width + x) * 4;
                
                outputData.data[dstIdx] = srcData.data[srcIdx];
                outputData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
                outputData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
                outputData.data[dstIdx + 3] = 255;
                
                renderedPixels++;
                
                if (srcData.data[srcIdx] !== 0 || srcData.data[srcIdx + 1] !== 0 || srcData.data[srcIdx + 2] !== 0) {
                    coloredPixels++;
                }
            }
        }
    }
    
    ctx.putImageData(outputData, 0, 0);
    console.log(`✓ ID canvas 渲染完成 - 渲染像素: ${renderedPixels}, 有色像素: ${coloredPixels}`);
}

// 設置事件
function setupEvents() {
    const panoramaDiv = document.getElementById('panorama');
    let throttle = null;
    
    panoramaDiv.addEventListener('mousemove', (e) => {
        if (throttle) return;
        throttle = setTimeout(() => {
            handleHover(e);
            throttle = null;
        }, 100);
    });
    
    panoramaDiv.addEventListener('mouseleave', () => {
        clearHighlight();
        panoramaDiv.style.cursor = 'default';
    });
    
    panoramaDiv.addEventListener('click', handleClick);
    
    // 視角變化時更新ID canvas
    viewer.on('mouseup', () => {
        setTimeout(() => {
            updateIDCanvas();
            clearHighlight();
        }, 50);
    });
    
    console.log('✓ 事件設置完成');
}

// 處理懸停
function handleHover(e) {
    const colorType = getColorType(e.clientX, e.clientY);
    
    if (colorType) {
        document.getElementById('panorama').style.cursor = 'pointer';
        drawHighlight(colorType);
    } else {
        document.getElementById('panorama').style.cursor = 'default';
        clearHighlight();
    }
}

// 獲取顏色類型
function getColorType(clientX, clientY) {
    if (!idCanvas || !idCtx) return null;
    
    const panoramaDiv = document.getElementById('panorama');
    const mainCanvas = panoramaDiv.querySelector('canvas');
    if (!mainCanvas) return null;
    
    const rect = mainCanvas.getBoundingClientRect();
    const x = Math.floor(clientX - rect.left);
    const y = Math.floor(clientY - rect.top);
    
    if (x < 0 || x >= idCanvas.width || y < 0 || y >= idCanvas.height) {
        return null;
    }
    
    try {
        const pixel = idCtx.getImageData(x, y, 1, 1).data;
        const r = pixel[0], g = pixel[1], b = pixel[2];
        
        if (r === 0 && g === 0 && b === 0) return null;
        
        console.log(`RGB: (${r}, ${g}, ${b})`);
        
        // 檢測顏色
        for (const [key, color] of Object.entries(colorIDs)) {
            if ((key === 'sofa' || key === 'table') && currentState.scene !== '客餐廳') continue;
            
            if (Math.abs(r - color.r) <= 15 && 
                Math.abs(g - color.g) <= 15 && 
                Math.abs(b - color.b) <= 15) {
                console.log(`✓ 檢測到: ${key}`);
                return key;
            }
        }
    } catch (e) {
        console.error('讀取失敗:', e);
    }
    
    return null;
}

// 繪製白色外框
function drawHighlight(colorType) {
    if (!highlightCtx || !idCanvas || !idCtx) return;
    
    clearHighlight();
    
    const targetColor = colorIDs[colorType];
    if (!targetColor) return;
    
    console.log('開始繪製白色外框:', colorType);
    
    const panoramaDiv = document.getElementById('panorama');
    const mainCanvas = panoramaDiv.querySelector('canvas');
    if (!mainCanvas) return;
    
    const rect = mainCanvas.getBoundingClientRect();
    
    // 從ID canvas提取輪廓
    const imageData = idCtx.getImageData(0, 0, idCanvas.width, idCanvas.height);
    const pixels = imageData.data;
    const w = idCanvas.width;
    const h = idCanvas.height;
    
    const edgePoints = [];
    
    // 掃描邊緣 - 使用更大的步長，只提取輪廓
    const step = 5; // 每5個像素檢測一次，形成清晰的外框線
    
    for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
            const idx = (y * w + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            
            if (Math.abs(r - targetColor.r) <= 15 && 
                Math.abs(g - targetColor.g) <= 15 && 
                Math.abs(b - targetColor.b) <= 15) {
                
                // 檢查是否是邊緣（周圍有非目標顏色的像素）
                if (isEdge(x, y, w, h, pixels, targetColor)) {
                    edgePoints.push({ x: x + rect.left, y: y + rect.top, px: x, py: y });
                }
            }
        }
    }
    
    if (edgePoints.length > 10) {
        // 按位置排序，形成連續路徑
        edgePoints.sort((a, b) => {
            const angleA = Math.atan2(a.py - h/2, a.px - w/2);
            const angleB = Math.atan2(b.py - h/2, b.px - w/2);
            return angleA - angleB;
        });
        
        // 繪製白色輪廓線
        highlightCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
        highlightCtx.lineWidth = 3;
        highlightCtx.lineCap = 'round';
        highlightCtx.lineJoin = 'round';
        highlightCtx.shadowBlur = 12;
        highlightCtx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        highlightCtx.setLineDash([]); // 實線
        
        highlightCtx.beginPath();
        highlightCtx.moveTo(edgePoints[0].x, edgePoints[0].y);
        
        for (let i = 1; i < edgePoints.length; i++) {
            highlightCtx.lineTo(edgePoints[i].x, edgePoints[i].y);
        }
        
        highlightCtx.closePath();
        highlightCtx.stroke();
        
        console.log(`✓ 繪製了包含 ${edgePoints.length} 個點的白色外框線`);
    } else {
        console.log('邊緣點太少:', edgePoints.length);
    }
}

// 檢查是否是邊緣像素
function isEdge(x, y, w, h, pixels, targetColor) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) return true;
        
        const idx = (ny * w + nx) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        if (Math.abs(r - targetColor.r) > 15 || 
            Math.abs(g - targetColor.g) > 15 || 
            Math.abs(b - targetColor.b) > 15) {
            return true;
        }
    }
    
    return false;
}

// 清除高亮
function clearHighlight() {
    if (highlightCtx && highlightCanvas) {
        highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    }
}

// 處理點擊
function handleClick(e) {
    const colorType = getColorType(e.clientX, e.clientY);
    
    if (colorType) {
        console.log('點擊:', colorType);
        
        if (colorType === '客餐廳' || colorType === '主臥室' || colorType === '次臥室') {
            switchScene(colorType);
        } else if (colorType === 'sofa') {
            cycleSofa();
        } else if (colorType === 'table') {
            cycleTable();
        }
    }
}

// 切換場景
function switchScene(scene) {
    console.log('切換到:', scene);
    currentState.scene = scene;
    if (!scenes[scene].hasFurniture) {
        currentState.sofa = 'A';
        currentState.table = 'A';
    }
    clearHighlight();
    reload();
    updateUI();
}

// 切換沙發
function cycleSofa() {
    const opts = ['A', 'B', 'C'];
    const idx = opts.indexOf(currentState.sofa);
    currentState.sofa = opts[(idx + 1) % 3];
    console.log('切換沙發:', currentState.sofa);
    reload();
    updateUI();
}

// 切換茶几
function cycleTable() {
    const opts = ['A', 'B', 'C'];
    const idx = opts.indexOf(currentState.table);
    currentState.table = opts[(idx + 1) % 3];
    console.log('切換茶几:', currentState.table);
    reload();
    updateUI();
}

// 重新加載
function reload() {
    if (viewer) {
        try { viewer.destroy(); } catch (e) {}
    }
    
    clearHighlight();
    
    setTimeout(() => {
        viewer = pannellum.viewer('panorama', {
            type: 'equirectangular',
            panorama: getImagePath(),
            autoLoad: true,
            showControls: true,
            hfov: 90,
            minHfov: 50,
            maxHfov: 120
        });
        
        viewer.on('load', () => {
            console.log('✓ 場景加載成功');
            loadIDImage();
            setTimeout(setupEvents, 300);
        });
    }, 100);
}

// 設置按鈕
function setupButtons() {
    document.querySelectorAll('.scene-btn').forEach(btn => {
        btn.addEventListener('click', () => switchScene(btn.getAttribute('data-scene')));
    });
    
    document.querySelectorAll('.sofa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentState.sofa = btn.getAttribute('data-sofa');
            reload();
            updateUI();
        });
    });
    
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentState.table = btn.getAttribute('data-table');
            reload();
            updateUI();
        });
    });
}

// 更新UI
function updateUI() {
    document.getElementById('current-scene').textContent = currentState.scene;
    document.getElementById('current-sofa').textContent = currentState.sofa;
    document.getElementById('current-table').textContent = currentState.table;
    
    const fc = document.getElementById('furniture-controls');
    fc.style.display = scenes[currentState.scene].hasFurniture ? 'block' : 'none';
    
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

window.addEventListener('load', () => setTimeout(init, 100));

