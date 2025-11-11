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
    });
    
    viewer.on('error', function(err) {
        console.error('全景圖加載失敗:', err);
    });
    
    // 設置按鈕事件
    setupButtons();
    
    // 設置畫布點擊和懸停事件
    setupCanvasEvents();
    
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
    
    panoramaDiv.addEventListener('click', handleClick);
    panoramaDiv.addEventListener('mousemove', throttle(handleHover, 100));
    panoramaDiv.addEventListener('mouseleave', () => {
        clearHighlight();
    });
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

// 獲取點擊位置的顏色類型
function getColorAtPosition(clientX, clientY) {
    if (!idCanvas || !idCtx || !idImage || !idImage.complete) {
        return null;
    }
    
    const panoramaDiv = document.getElementById('panorama');
    const canvas = panoramaDiv.querySelector('canvas');
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = Math.floor(x * scaleX);
    const canvasY = Math.floor(y * scaleY);
    
    if (canvasX < 0 || canvasX >= idCanvas.width || canvasY < 0 || canvasY >= idCanvas.height) {
        return null;
    }
    
    try {
        const pixel = idCtx.getImageData(canvasX, canvasY, 1, 1).data;
        const r = pixel[0], g = pixel[1], b = pixel[2];
        
        // 檢測顏色類型
        for (const [key, color] of Object.entries(colorIDs)) {
            if (key === 'sofa' || key === 'table') {
                if (currentState.scene !== '客餐廳') continue;
            }
            
            if (isColorMatch(r, g, b, color)) {
                console.log(`檢測到顏色: ${key}, RGB(${r}, ${g}, ${b})`);
                return key;
            }
        }
        
        return null;
    } catch (e) {
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
        drawHighlight(event.clientX, event.clientY, colorType);
    } else {
        document.getElementById('panorama').style.cursor = 'default';
        clearHighlight();
    }
}

// 繪製高亮框
function drawHighlight(x, y, colorType) {
    if (!highlightCtx) return;
    
    clearHighlight();
    
    const colorMap = {
        '客餐廳': 'rgba(0, 255, 255, 0.8)',
        '主臥室': 'rgba(255, 255, 0, 0.8)',
        '次臥室': 'rgba(0, 0, 255, 0.8)',
        'sofa': 'rgba(0, 255, 0, 0.8)',
        'table': 'rgba(255, 0, 0, 0.8)'
    };
    
    const color = colorMap[colorType] || 'rgba(255, 255, 255, 0.8)';
    const size = 60; // 高亮框大小
    
    highlightCtx.strokeStyle = color;
    highlightCtx.lineWidth = 3;
    highlightCtx.setLineDash([10, 5]);
    highlightCtx.shadowBlur = 15;
    highlightCtx.shadowColor = color;
    
    highlightCtx.strokeRect(x - size/2, y - size/2, size, size);
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

// 重新加載全景圖（簡化版本）
function reloadPanorama() {
    const newPath = getCurrentImagePath();
    console.log('重新加載全景圖:', newPath);
    
    // 直接銷毀舊的查看器並創建新的
    if (viewer) {
        try {
            viewer.destroy();
            console.log('舊查看器已銷毀');
        } catch (e) {
            console.log('銷毀查看器時出錯:', e);
        }
    }
    
    // 創建新的查看器
    setTimeout(() => {
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
            console.log('新全景圖加載成功');
            loadIDImage();
        });
        
        viewer.on('error', (err) => {
            console.error('加載失敗:', err, newPath);
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

