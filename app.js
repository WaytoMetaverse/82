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

// 顏色ID定義（RGB值）
// 注意：這些顏色值必須與ID圖中的顏色完全對應
const colorIDs = {
    // 青色（用戶稱為粉色）- 客餐廳 (RGB: 0, 255, 255)
    '客餐廳': { r: 0, g: 255, b: 255, tolerance: 20 },
    // 黃色 - 主臥室 (RGB: 255, 255, 0)
    '主臥室': { r: 255, g: 255, b: 0, tolerance: 20 },
    // 藍色 - 次臥室 (RGB: 0, 0, 255)
    '次臥室': { r: 0, g: 0, b: 255, tolerance: 20 },
    // 綠色 - 沙發替換 (RGB: 0, 255, 0)
    sofa: { r: 0, g: 255, b: 0, tolerance: 20 },
    // 紅色 - 茶几替換 (RGB: 255, 0, 0)
    table: { r: 255, g: 0, b: 0, tolerance: 20 }
};

let viewer = null;
let idImage = null;
let idCanvas = null;
let idCtx = null;
let clickHandlerAttached = false;
let lastCursorType = null; // 緩存上一次的游標類型
let hoverThrottleTimer = null; // 節流計時器
let lastHoverTime = 0; // 上次執行懸停檢測的時間
let hoverTooltip = null; // 懸停提示框元素

// 初始化
function init() {
    // 創建全景圖查看器
    viewer = pannellum.viewer('panorama', {
        "type": "equirectangular",
        "panorama": getCurrentImagePath(),
        "autoLoad": true,
        "autoRotate": 0,
        "compass": false,
        "showControls": true,
        "keyboardZoom": true,
        "mouseZoom": true,
        "hfov": 90,
        "minHfov": 50,
        "maxHfov": 120
    });
    
    // 等待查看器完全加載後設置事件
    viewer.on('load', () => {
        console.log('全景圖查看器初始化完成');
        
        // 初始化ID圖畫布
        initIDCanvas();
        
        // 設置點擊事件和滑鼠移動事件 - 直接在全景圖容器上監聽（只綁定一次）
        if (!clickHandlerAttached) {
            const panoramaContainer = document.querySelector('#panorama');
            if (panoramaContainer) {
                panoramaContainer.addEventListener('click', handlePanoramaClick);
                panoramaContainer.addEventListener('mousemove', handlePanoramaHover);
                panoramaContainer.addEventListener('mouseleave', hideTooltip);
                console.log('事件監聽器已綁定');
                clickHandlerAttached = true;
            } else {
                console.error('找不到全景圖容器');
            }
        }
        
        // 更新ID畫布以匹配當前場景
        setTimeout(() => {
            loadIDImage();
            updateIDCanvas();
        }, 300);
    });
    
    // 處理初始化錯誤
    viewer.on('error', (error) => {
        console.error('全景圖查看器初始化失敗:', error);
    });
    
    // 設置按鈕事件
    setupButtons();
    
    // 初始化懸停提示框
    initHoverTooltip();
    
    // 更新UI
    updateUI();
}

// 初始化ID圖畫布
function initIDCanvas() {
    idCanvas = document.getElementById('id-canvas');
    idCtx = idCanvas.getContext('2d');
    
    // 加載ID圖
    loadIDImage();
}

// 初始化懸停提示框
function initHoverTooltip() {
    hoverTooltip = document.getElementById('hover-tooltip');
    if (!hoverTooltip) {
        hoverTooltip = document.createElement('div');
        hoverTooltip.id = 'hover-tooltip';
        hoverTooltip.className = 'hover-tooltip';
        document.body.appendChild(hoverTooltip);
    }
}

// 加載ID圖
function loadIDImage() {
    const idImagePath = getCurrentIDImagePath();
    console.log('加載ID圖:', idImagePath); // 調試信息
    
    idImage = new Image();
    idImage.crossOrigin = 'anonymous';
    idImage.onload = function() {
        console.log('ID圖加載成功');
        updateIDCanvas();
    };
    idImage.onerror = function() {
        console.error('無法加載ID圖:', idImagePath);
        // 不顯示alert，因為ID圖失敗不影響主要功能
    };
    idImage.src = idImagePath;
}

// 更新ID畫布
function updateIDCanvas() {
    if (!idImage || !idImage.complete || !idCanvas || !idCtx) {
        return;
    }
    
    const viewerContainer = document.querySelector('#panorama');
    if (!viewerContainer) {
        return;
    }
    
    // 獲取pannellum實際渲染的canvas元素
    const pannellumCanvas = viewerContainer.querySelector('canvas');
    if (pannellumCanvas) {
        // 使用pannellum canvas的實際尺寸
        idCanvas.width = pannellumCanvas.width;
        idCanvas.height = pannellumCanvas.height;
    } else {
        // 如果找不到canvas，使用容器尺寸
        idCanvas.width = viewerContainer.offsetWidth || window.innerWidth;
        idCanvas.height = viewerContainer.offsetHeight || window.innerHeight;
    }
    
    // 繪製ID圖到畫布，填滿整個畫布
    idCtx.drawImage(idImage, 0, 0, idCanvas.width, idCanvas.height);
}

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

// 獲取點擊位置對應的顏色類型（用於點擊和懸停檢測）
function getColorTypeAtPosition(clientX, clientY) {
    // 確保ID圖已加載
    if (!idImage || !idImage.complete || !idCanvas || !idCtx) {
        return null;
    }
    
    // 獲取pannellum的canvas元素
    const panoramaContainer = document.querySelector('#panorama');
    const pannellumCanvas = panoramaContainer.querySelector('canvas');
    
    if (!pannellumCanvas) {
        return null;
    }
    
    // 獲取canvas的實際位置和尺寸
    const canvasRect = pannellumCanvas.getBoundingClientRect();
    const x = clientX - canvasRect.left;
    const y = clientY - canvasRect.top;
    
    // 將座標轉換為canvas內部座標（考慮canvas的實際渲染尺寸）
    const scaleX = pannellumCanvas.width / canvasRect.width;
    const scaleY = pannellumCanvas.height / canvasRect.height;
    const canvasX = Math.floor(x * scaleX);
    const canvasY = Math.floor(y * scaleY);
    
    // 確保座標在畫布範圍內
    if (canvasX < 0 || canvasX >= idCanvas.width || canvasY < 0 || canvasY >= idCanvas.height) {
        return null;
    }
    
    try {
        // 從隱藏的ID圖中讀取對應位置的顏色（ID圖用於區分可點選物件，用戶看不到）
        // ID圖的顏色與場景可點選物件完全對應
        const pixel = idCtx.getImageData(canvasX, canvasY, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];
        
        // 調試模式：在控制台顯示RGB值（開發時可用，正式版本可移除）
        // console.log(`位置 (${canvasX}, ${canvasY}): RGB(${r}, ${g}, ${b})`);
        
        // 檢測顏色類型
        return detectColorType(r, g, b);
    } catch (e) {
        console.error('讀取像素數據失敗:', e);
        return null;
    }
}

// 處理全景圖點擊
function handlePanoramaClick(event) {
    const clickedType = getColorTypeAtPosition(event.clientX, event.clientY);
    
    if (clickedType) {
        event.preventDefault();
        event.stopPropagation();
        handleColorClick(clickedType);
    }
}

// 獲取顏色類型對應的提示文字
function getTooltipText(colorType) {
    const tooltipMap = {
        '客餐廳': '🔵 點擊切換到客餐廳',
        '主臥室': '🟡 點擊切換到主臥室',
        '次臥室': '🔵 點擊切換到次臥室',
        'sofa': '🟢 點擊替換沙發',
        'table': '🔴 點擊替換茶几'
    };
    return tooltipMap[colorType] || '';
}

// 處理全景圖滑鼠懸停（改變滑鼠樣式提示可點選區域）
// 使用節流來優化性能，避免頻繁讀取像素數據
function handlePanoramaHover(event) {
    // 確保ID圖已加載
    if (!idImage || !idImage.complete || !idCanvas || !idCtx) {
        return;
    }
    
    const now = Date.now();
    
    // 節流：每100毫秒最多執行一次檢測
    if (now - lastHoverTime < 100) {
        return;
    }
    
    lastHoverTime = now;
    
    // 使用 requestAnimationFrame 來優化性能
    if (hoverThrottleTimer) {
        cancelAnimationFrame(hoverThrottleTimer);
    }
    
    hoverThrottleTimer = requestAnimationFrame(() => {
        const colorType = getColorTypeAtPosition(event.clientX, event.clientY);
        const panoramaContainer = document.querySelector('#panorama');
        
        if (!panoramaContainer) return;
        
        // 更新游標樣式和提示框
        if (colorType !== lastCursorType) {
            if (colorType) {
                panoramaContainer.style.cursor = 'pointer';
                showTooltip(event.clientX, event.clientY, colorType);
            } else {
                panoramaContainer.style.cursor = 'default';
                hideTooltip();
            }
            lastCursorType = colorType;
        } else if (colorType) {
            // 如果顏色類型沒變但仍在可點選區域，更新提示框位置
            updateTooltipPosition(event.clientX, event.clientY);
        }
        
        hoverThrottleTimer = null;
    });
}

// 顯示懸停提示框
function showTooltip(x, y, colorType) {
    if (!hoverTooltip) {
        initHoverTooltip();
    }
    
    const tooltipText = getTooltipText(colorType);
    hoverTooltip.textContent = tooltipText;
    
    // 設置樣式類別
    hoverTooltip.className = 'hover-tooltip';
    if (colorType === '客餐廳' || colorType === '主臥室' || colorType === '次臥室') {
        hoverTooltip.classList.add('scene');
    } else if (colorType === 'sofa') {
        hoverTooltip.classList.add('sofa');
    } else if (colorType === 'table') {
        hoverTooltip.classList.add('table');
    }
    
    // 更新位置
    updateTooltipPosition(x, y);
    
    // 顯示提示框
    hoverTooltip.classList.add('show');
}

// 更新提示框位置
function updateTooltipPosition(x, y) {
    if (!hoverTooltip) return;
    
    // 先設置基本位置（在滑鼠上方）
    hoverTooltip.style.left = x + 'px';
    hoverTooltip.style.top = y + 'px';
    hoverTooltip.style.transform = 'translate(-50%, -100%) translateY(-5px)';
    
    // 強制重排以獲取實際尺寸
    void hoverTooltip.offsetWidth;
    
    // 確保提示框不會超出視窗邊界
    const rect = hoverTooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const padding = 10;
    
    // 水平邊界檢查
    if (rect.right > windowWidth - padding) {
        hoverTooltip.style.left = (windowWidth - padding) + 'px';
        hoverTooltip.style.transform = 'translate(-100%, -100%) translateY(-5px)';
    } else if (rect.left < padding) {
        hoverTooltip.style.left = padding + 'px';
        hoverTooltip.style.transform = 'translate(0, -100%) translateY(-5px)';
    }
    
    // 垂直邊界檢查（如果提示框超出頂部，顯示在滑鼠下方）
    if (rect.top < padding) {
        hoverTooltip.style.top = (y + 30) + 'px';
        hoverTooltip.style.transform = hoverTooltip.style.transform.replace('translateY(-5px)', 'translateY(5px)');
    }
}

// 隱藏懸停提示框
function hideTooltip() {
    if (hoverTooltip) {
        hoverTooltip.classList.remove('show');
    }
}

// 檢測顏色類型
// ID圖的顏色與場景可點選物件完全對應，此函數確保精確匹配
function detectColorType(r, g, b) {
    // 優先檢測場景顏色（粉色、黃色、藍色）
    // 這些顏色在全景圖中用於標記場景切換區域
    
    // 粉色 - 客餐廳
    if (isColorMatch(r, g, b, colorIDs['客餐廳'])) {
        return '客餐廳';
    }
    
    // 黃色 - 主臥室
    if (isColorMatch(r, g, b, colorIDs['主臥室'])) {
        return '主臥室';
    }
    
    // 藍色 - 次臥室
    if (isColorMatch(r, g, b, colorIDs['次臥室'])) {
        return '次臥室';
    }
    
    // 檢測家具顏色（僅在客餐廳場景中有效）
    // 這些顏色在ID圖中標記可替換的家具物件
    
    // 綠色 - 沙發替換（僅在客餐廳有效）
    if (currentState.scene === '客餐廳' && isColorMatch(r, g, b, colorIDs.sofa)) {
        return 'sofa';
    }
    
    // 紅色 - 茶几替換（僅在客餐廳有效）
    if (currentState.scene === '客餐廳' && isColorMatch(r, g, b, colorIDs.table)) {
        return 'table';
    }
    
    // 如果沒有匹配到任何顏色，返回null（表示不可點選）
    return null;
}

// 檢查顏色是否匹配
// 使用歐幾里得距離來更準確地檢測顏色相似度
function isColorMatch(r, g, b, targetColor) {
    // 計算RGB空間中的歐幾里得距離
    const dr = r - targetColor.r;
    const dg = g - targetColor.g;
    const db = b - targetColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    
    // 使用容差值來判斷是否匹配（容差值對應RGB空間中的距離）
    // tolerance: 20 對應約 34.6 的RGB距離
    return distance <= (targetColor.tolerance * Math.sqrt(3));
}

// 處理顏色點擊
function handleColorClick(type) {
    // 如果是場景名稱，直接切換到該場景
    if (type === '客餐廳' || type === '主臥室' || type === '次臥室') {
        switchScene(type);
        return;
    }
    
    // 處理家具替換
    switch(type) {
        case 'sofa':
            cycleSofa();
            break;
        case 'table':
            cycleTable();
            break;
    }
}

// 顯示場景選擇器
function showSceneSelector() {
    const sceneNames = Object.keys(scenes);
    const currentIndex = sceneNames.indexOf(currentState.scene);
    const nextIndex = (currentIndex + 1) % sceneNames.length;
    switchScene(sceneNames[nextIndex]);
}

// 切換場景
function switchScene(sceneName) {
    currentState.scene = sceneName;
    
    // 如果切換到非客餐廳，重置家具狀態
    if (!scenes[sceneName].hasFurniture) {
        currentState.sofa = 'A';
        currentState.table = 'A';
    }
    
    // 重置懸停檢測緩存
    lastCursorType = null;
    lastHoverTime = 0;
    if (hoverThrottleTimer) {
        cancelAnimationFrame(hoverThrottleTimer);
        hoverThrottleTimer = null;
    }
    
    // 隱藏提示框
    hideTooltip();
    
    // 重新加載全景圖
    loadPanorama();
    updateUI();
}

// 循環切換沙發
function cycleSofa() {
    const sofas = scenes['客餐廳'].furniture.sofa;
    const currentIndex = sofas.indexOf(currentState.sofa);
    const nextIndex = (currentIndex + 1) % sofas.length;
    currentState.sofa = sofas[nextIndex];
    loadPanorama();
    updateUI();
}

// 循環切換茶几
function cycleTable() {
    const tables = scenes['客餐廳'].furniture.table;
    const currentIndex = tables.indexOf(currentState.table);
    const nextIndex = (currentIndex + 1) % tables.length;
    currentState.table = tables[nextIndex];
    loadPanorama();
    updateUI();
}

// 加載全景圖
function loadPanorama() {
    if (!viewer) {
        console.error('全景圖查看器未初始化');
        return;
    }
    
    const imagePath = getCurrentImagePath();
    console.log('加載全景圖:', imagePath); // 調試信息
    
    const currentHfov = viewer.getHfov() || 90;
    const currentPitch = viewer.getPitch() || 0;
    const currentYaw = viewer.getYaw() || 0;
    
    // 加載場景
    viewer.loadScene('equirectangular', {
        "panorama": imagePath,
        "hfov": currentHfov,
        "pitch": currentPitch,
        "yaw": currentYaw
    });
    
    // 等待場景加載完成後再加載ID圖
    viewer.once('load', () => {
        console.log('場景加載完成，開始加載ID圖');
        setTimeout(() => {
            loadIDImage();
            updateIDCanvas();
        }, 200);
    });
    
    // 處理加載錯誤
    viewer.once('error', (error) => {
        console.error('加載全景圖失敗:', error, imagePath);
        alert('無法加載全景圖: ' + imagePath + '\n請檢查圖片路徑是否正確');
    });
}

// 設置按鈕事件
function setupButtons() {
    // 場景按鈕
    document.querySelectorAll('.scene-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sceneName = btn.getAttribute('data-scene');
            switchScene(sceneName);
        });
    });
    
    // 沙發按鈕
    document.querySelectorAll('.sofa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sofa = btn.getAttribute('data-sofa');
            currentState.sofa = sofa;
            loadPanorama();
            updateUI();
        });
    });
    
    // 茶几按鈕
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const table = btn.getAttribute('data-table');
            currentState.table = table;
            loadPanorama();
            updateUI();
        });
    });
}

// 更新UI
function updateUI() {
    // 更新當前狀態顯示
    document.getElementById('current-scene').textContent = currentState.scene;
    document.getElementById('current-sofa').textContent = currentState.sofa;
    document.getElementById('current-table').textContent = currentState.table;
    
    // 顯示/隱藏家具控制
    const furnitureControls = document.getElementById('furniture-controls');
    if (scenes[currentState.scene].hasFurniture) {
        furnitureControls.style.display = 'block';
    } else {
        furnitureControls.style.display = 'none';
    }
    
    // 更新按鈕活動狀態
    document.querySelectorAll('.scene-btn').forEach(btn => {
        if (btn.getAttribute('data-scene') === currentState.scene) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.sofa-btn').forEach(btn => {
        if (btn.getAttribute('data-sofa') === currentState.sofa) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.table-btn').forEach(btn => {
        if (btn.getAttribute('data-table') === currentState.table) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// 當窗口大小改變時，重新調整ID畫布
window.addEventListener('resize', () => {
    setTimeout(() => {
        updateIDCanvas();
    }, 200);
});

// 頁面加載完成後初始化
window.addEventListener('load', () => {
    setTimeout(init, 100);
});

