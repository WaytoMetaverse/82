// 全景圖配置
const scenes = {
    '客餐廳': {
        basePath: '環景圖/客餐廳',
        hasFurniture: true
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

// 顏色ID定義
const colorIDs = {
    '客餐廳': { r: 255, g: 0, b: 255 },  // 粉紅色
    '主臥室': { r: 255, g: 255, b: 0 },  // 黃色
    '次臥室': { r: 0, g: 0, b: 255 },    // 藍色
    'sofa': { r: 0, g: 255, b: 0 },      // 綠色
    'table': { r: 255, g: 0, b: 0 }      // 紅色
};

let viewer = null;
let idViewer = null; // 第二個隱藏的查看器用於ID圖
let highlightCanvas = null;
let highlightCtx = null;

// 獲取圖片路徑
function getCurrentImagePath() {
    const scene = scenes[currentState.scene];
    if (scene.hasFurniture) {
        return `${scene.basePath}_${currentState.sofa}沙發_${currentState.table}茶几.jpg`;
    }
    return `${scene.basePath}.jpg`;
}

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
    
    // 初始化高亮畫布
    initHighlightCanvas();
    
    // 創建主全景圖查看器
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
    
    viewer.on('load', () => {
        console.log('✓ 全景圖加載成功');
        loadIDViewer();
        
        // 在主查看器加載後設置鼠標事件
        setTimeout(() => {
            setupMouseEvents();
            console.log('✓ 鼠標事件已設置');
        }, 500);
    });
    
    viewer.on('error', (err) => {
        console.error('全景圖加載失敗:', err);
    });
    
    // 設置按鈕和UI
    setupButtons();
    updateUI();
}

// 加載ID圖查看器（隱藏的，與主查看器同步）
function loadIDViewer() {
    const idPath = getCurrentIDImagePath();
    console.log('加載ID圖查看器:', idPath);
    
    // 創建隱藏的div用於ID查看器
    let idPanoramaDiv = document.getElementById('id-panorama');
    if (!idPanoramaDiv) {
        idPanoramaDiv = document.createElement('div');
        idPanoramaDiv.id = 'id-panorama';
        idPanoramaDiv.style.display = 'none';
        idPanoramaDiv.style.width = '1px';
        idPanoramaDiv.style.height = '1px';
        document.body.appendChild(idPanoramaDiv);
    }
    
    // 銷毀舊的ID查看器
    if (idViewer) {
        try {
            idViewer.destroy();
        } catch (e) {}
    }
    
    // 創建新的ID查看器，與主查看器保持同步
    setTimeout(() => {
        idViewer = pannellum.viewer('id-panorama', {
            "type": "equirectangular",
            "panorama": idPath,
            "autoLoad": true,
            "showControls": false
        });
        
        idViewer.on('load', () => {
            console.log('✓ ID圖查看器加載成功');
            syncIDViewer();
        });
    }, 200);
}

// 同步ID查看器的視角
function syncIDViewer() {
    if (!viewer || !idViewer) return;
    
    try {
        const pitch = viewer.getPitch();
        const yaw = viewer.getYaw();
        const hfov = viewer.getHfov();
        
        idViewer.setPitch(pitch);
        idViewer.setYaw(yaw);
        idViewer.setHfov(hfov);
    } catch (e) {
        console.log('同步視角失敗:', e);
    }
}

// 初始化高亮畫布
function initHighlightCanvas() {
    highlightCanvas = document.getElementById('highlight-canvas');
    if (!highlightCanvas) {
        highlightCanvas = document.createElement('canvas');
        highlightCanvas.className = 'highlight-canvas';
        document.body.appendChild(highlightCanvas);
    }
    highlightCtx = highlightCanvas.getContext('2d');
    highlightCanvas.width = window.innerWidth;
    highlightCanvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
        highlightCanvas.width = window.innerWidth;
        highlightCanvas.height = window.innerHeight;
    });
}

// 設置鼠標事件
function setupMouseEvents() {
    const panoramaDiv = document.getElementById('panorama');
    let hoverTimeout = null;
    let lastColorType = null;
    
    console.log('設置鼠標事件...');
    
    panoramaDiv.addEventListener('mousemove', (e) => {
        console.log('鼠標移動事件觸發');
        
        if (hoverTimeout) return;
        
        hoverTimeout = setTimeout(() => {
            console.log('開始檢測顏色...');
            
            // 先同步ID查看器
            syncIDViewer();
            
            setTimeout(() => {
                const colorType = getColorAtPosition(e.clientX, e.clientY);
                console.log('檢測結果:', colorType);
                
                if (colorType !== lastColorType) {
                    if (colorType) {
                        panoramaDiv.style.cursor = 'pointer';
                        console.log('✓ 準備繪製高亮:', colorType);
                        drawHighlight(colorType);
                    } else {
                        panoramaDiv.style.cursor = 'default';
                        clearHighlight();
                    }
                    lastColorType = colorType;
                }
                
                hoverTimeout = null;
            }, 50);
        }, 100);
    });
    
    panoramaDiv.addEventListener('mouseleave', () => {
        console.log('鼠標離開');
        clearHighlight();
        panoramaDiv.style.cursor = 'default';
        lastColorType = null;
    });
    
    panoramaDiv.addEventListener('click', (e) => {
        console.log('點擊事件觸發');
        syncIDViewer();
        setTimeout(() => {
            handleClick(e);
        }, 50);
    });
    
    // 監聽視角變化
    if (viewer) {
        viewer.on('mouseup', () => {
            console.log('視角變化，同步ID查看器');
            setTimeout(syncIDViewer, 50);
        });
    }
    
    console.log('✓ 鼠標事件設置完成');
}

// 處理懸停
function handleHover(event) {
    const colorType = getColorAtPosition(event.clientX, event.clientY);
    
    if (colorType) {
        document.getElementById('panorama').style.cursor = 'pointer';
        drawHighlight(colorType);
    } else {
        document.getElementById('panorama').style.cursor = 'default';
        clearHighlight();
    }
}

// 獲取鼠標位置的顏色（直接從ID查看器的渲染canvas讀取）
function getColorAtPosition(clientX, clientY) {
    console.log('getColorAtPosition 開始...');
    
    if (!idViewer) {
        console.log('❌ idViewer 不存在');
        return null;
    }
    
    const idPanoramaDiv = document.getElementById('id-panorama');
    if (!idPanoramaDiv) {
        console.log('❌ id-panorama div 不存在');
        return null;
    }
    
    const idCanvas = idPanoramaDiv.querySelector('canvas');
    if (!idCanvas) {
        console.log('❌ ID canvas 不存在');
        return null;
    }
    
    console.log('✓ ID canvas 存在，尺寸:', idCanvas.width, 'x', idCanvas.height);
    
    const panoramaDiv = document.getElementById('panorama');
    const mainCanvas = panoramaDiv.querySelector('canvas');
    if (!mainCanvas) {
        console.log('❌ 主 canvas 不存在');
        return null;
    }
    
    const rect = mainCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    console.log('鼠標位置:', x, y, '主canvas尺寸:', mainCanvas.width, 'x', mainCanvas.height);
    
    try {
        const ctx = idCanvas.getContext('2d');
        const scaleX = idCanvas.width / rect.width;
        const scaleY = idCanvas.height / rect.height;
        const px = Math.floor(x * scaleX);
        const py = Math.floor(y * scaleY);
        
        console.log('縮放比例:', scaleX.toFixed(2), scaleY.toFixed(2), '像素位置:', px, py);
        
        if (px >= 0 && px < idCanvas.width && py >= 0 && py < idCanvas.height) {
            const pixel = ctx.getImageData(px, py, 1, 1).data;
            const r = pixel[0], g = pixel[1], b = pixel[2];
            
            console.log(`讀取RGB: (${r}, ${g}, ${b})`);
            
            // 檢測顏色
            for (const [key, color] of Object.entries(colorIDs)) {
                if (key === 'sofa' || key === 'table') {
                    if (currentState.scene !== '客餐廳') continue;
                }
                
                const dr = Math.abs(r - color.r);
                const dg = Math.abs(g - color.g);
                const db = Math.abs(b - color.b);
                
                console.log(`檢查 ${key}: 目標(${color.r},${color.g},${color.b}) 差異(${dr},${dg},${db})`);
                
                if (dr <= 15 && dg <= 15 && db <= 15) {
                    console.log(`✓✓✓ 匹配到: ${key}`);
                    return key;
                }
            }
        } else {
            console.log('像素位置超出範圍');
        }
    } catch (e) {
        console.error('讀取失敗:', e);
    }
    
    console.log('沒有匹配的顏色');
    return null;
}

// 繪製高亮（使用ID查看器的canvas提取輪廓）
function drawHighlight(colorType) {
    console.log('drawHighlight 被調用，類型:', colorType);
    
    if (!highlightCtx) {
        console.log('highlightCtx 不存在');
        return;
    }
    
    if (!idViewer) {
        console.log('idViewer 不存在');
        return;
    }
    
    clearHighlight();
    
    const idPanoramaDiv = document.getElementById('id-panorama');
    if (!idPanoramaDiv) return;
    
    const idCanvas = idPanoramaDiv.querySelector('canvas');
    if (!idCanvas) return;
    
    const panoramaDiv = document.getElementById('panorama');
    const mainCanvas = panoramaDiv.querySelector('canvas');
    if (!mainCanvas) return;
    
    const rect = mainCanvas.getBoundingClientRect();
    
    try {
        // 同步視角
        syncIDViewer();
        
        setTimeout(() => {
            // 從ID canvas提取指定顏色的輪廓
            const ctx = idCanvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, idCanvas.width, idCanvas.height);
            const pixels = imageData.data;
            const width = idCanvas.width;
            const height = idCanvas.height;
            
            const targetColor = colorIDs[colorType];
            const edgePoints = [];
            
            // 掃描邊緣
            for (let y = 0; y < height; y += 2) {
                for (let x = 0; x < width; x += 2) {
                    const idx = (y * width + x) * 4;
                    const r = pixels[idx];
                    const g = pixels[idx + 1];
                    const b = pixels[idx + 2];
                    
                    if (Math.abs(r - targetColor.r) <= 10 && 
                        Math.abs(g - targetColor.g) <= 10 && 
                        Math.abs(b - targetColor.b) <= 10) {
                        
                        // 檢查邊緣
                        if (isEdgePixel(x, y, width, height, pixels, targetColor)) {
                            // 轉換到屏幕坐標
                            const screenX = (x / width) * rect.width + rect.left;
                            const screenY = (y / height) * rect.height + rect.top;
                            edgePoints.push({ x: screenX, y: screenY });
                        }
                    }
                }
            }
            
            if (edgePoints.length > 0) {
                // 繪製白色輪廓
                highlightCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
                highlightCtx.lineWidth = 4;
                highlightCtx.shadowBlur = 15;
                highlightCtx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                
                highlightCtx.beginPath();
                edgePoints.forEach((point, i) => {
                    if (i === 0) {
                        highlightCtx.moveTo(point.x, point.y);
                    } else {
                        highlightCtx.lineTo(point.x, point.y);
                    }
                });
                highlightCtx.closePath();
                highlightCtx.stroke();
                
                console.log(`✓ 繪製了 ${edgePoints.length} 個點的輪廓`);
            }
        }, 100);
    } catch (e) {
        console.error('繪製高亮失敗:', e);
    }
}

// 檢查是否為邊緣像素
function isEdgePixel(x, y, width, height, pixels, targetColor) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            return true;
        }
        
        const idx = (ny * width + nx) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        if (Math.abs(r - targetColor.r) > 10 || 
            Math.abs(g - targetColor.g) > 10 || 
            Math.abs(b - targetColor.b) > 10) {
            return true;
        }
    }
    
    return false;
}

// 處理點擊
function handleClick(event) {
    const colorType = getColorAtPosition(event.clientX, event.clientY);
    
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

// 清除高亮
function clearHighlight() {
    if (highlightCtx && highlightCanvas) {
        highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);
    }
}

// 切換場景
function switchScene(sceneName) {
    console.log('切換場景到:', sceneName);
    currentState.scene = sceneName;
    
    if (!scenes[sceneName].hasFurniture) {
        currentState.sofa = 'A';
        currentState.table = 'A';
    }
    
    clearHighlight();
    reloadPanorama();
    updateUI();
}

// 切換沙發
function cycleSofa() {
    const options = ['A', 'B', 'C'];
    const idx = options.indexOf(currentState.sofa);
    currentState.sofa = options[(idx + 1) % 3];
    console.log('切換沙發:', currentState.sofa);
    reloadPanorama();
    updateUI();
}

// 切換茶几
function cycleTable() {
    const options = ['A', 'B', 'C'];
    const idx = options.indexOf(currentState.table);
    currentState.table = options[(idx + 1) % 3];
    console.log('切換茶几:', currentState.table);
    reloadPanorama();
    updateUI();
}

// 重新加載全景圖
function reloadPanorama() {
    const newPath = getCurrentImagePath();
    console.log('重新加載:', newPath);
    
    if (viewer) {
        try {
            viewer.destroy();
        } catch (e) {}
    }
    
    if (idViewer) {
        try {
            idViewer.destroy();
        } catch (e) {}
    }
    
    clearHighlight();
    
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
            console.log('✓ 場景加載成功');
            loadIDViewer();
        });
        
        // 重新設置鼠標事件
        setTimeout(() => {
            setupMouseEvents();
        }, 300);
    }, 100);
}

// 設置按鈕
function setupButtons() {
    document.querySelectorAll('.scene-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchScene(btn.getAttribute('data-scene'));
        });
    });
    
    document.querySelectorAll('.sofa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentState.sofa = btn.getAttribute('data-sofa');
            reloadPanorama();
            updateUI();
        });
    });
    
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentState.table = btn.getAttribute('data-table');
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
    
    const furnitureControls = document.getElementById('furniture-controls');
    furnitureControls.style.display = scenes[currentState.scene].hasFurniture ? 'block' : 'none';
    
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

// 頁面加載
window.addEventListener('load', () => {
    setTimeout(init, 100);
});

