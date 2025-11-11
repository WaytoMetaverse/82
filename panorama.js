// ===== 配置 =====
const SCENES = {
    '客餐廳': '環景圖/客餐廳',
    '主臥室': '環景圖/主臥室',
    '次臥室': '環景圖/次臥室'
};

const COLORS = {
    '客餐廳': [255, 0, 255],   // 粉紅色
    '主臥室': [255, 255, 0],   // 黃色
    '次臥室': [0, 0, 255],     // 藍色
    'sofa': [0, 255, 0],       // 綠色
    'table': [255, 0, 0]       // 紅色
};

// ===== 狀態 =====
let state = { scene: '客餐廳', sofa: 'A', table: 'A' };
let viewer = null;
let idImg = null;
let idCanvas = null;
let idCtx = null;
let hlCanvas = null;
let hlCtx = null;

// ===== 路徑生成 =====
function getPath(isID = false) {
    const base = SCENES[state.scene];
    const suffix = isID ? '_ID.jpg' : '.jpg';
    
    if (state.scene === '客餐廳') {
        return `${base}_${state.sofa}沙發_${state.table}茶几${suffix}`;
    }
    return base + suffix;
}

// ===== 初始化 =====
function init() {
    console.log('===== 初始化 =====');
    
    // 初始化畫布
    idCanvas = document.getElementById('id-canvas');
    idCtx = idCanvas.getContext('2d', { willReadFrequently: true });
    
    hlCanvas = document.createElement('canvas');
    hlCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999';
    document.body.appendChild(hlCanvas);
    hlCanvas.width = window.innerWidth;
    hlCanvas.height = window.innerHeight;
    hlCtx = hlCanvas.getContext('2d');
    
    // 創建viewer
    createViewer();
    
    // 設置按鈕
    document.querySelectorAll('.scene-btn').forEach(btn => {
        btn.onclick = () => changeScene(btn.dataset.scene);
    });
    document.querySelectorAll('.sofa-btn').forEach(btn => {
        btn.onclick = () => { state.sofa = btn.dataset.sofa; reload(); };
    });
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.onclick = () => { state.table = btn.dataset.table; reload(); };
    });
    
    updateUI();
}

// ===== 創建查看器 =====
function createViewer() {
    const path = getPath();
    console.log('加載:', path);
    
    viewer = pannellum.viewer('panorama', {
        type: 'equirectangular',
        panorama: path,
        autoLoad: true,
        showControls: true,
        hfov: 90,
        minHfov: 50,
        maxHfov: 120
    });
    
    viewer.on('load', () => {
        console.log('✓ 全景圖加載完成');
        loadID();
        
        // 設置鼠標事件（延遲確保canvas已渲染）
        setTimeout(() => {
            const div = document.getElementById('panorama');
            div.onmousemove = handleMove;
            div.onmouseleave = () => { clearHL(); div.style.cursor = 'default'; };
            div.onclick = handleClick;
            
            // 視角變化時更新ID圖
            viewer.on('mouseup', () => setTimeout(updateID, 100));
            
            console.log('✓ 事件已綁定');
        }, 500);
    });
}

// ===== 加載ID圖 =====
function loadID() {
    const path = getPath(true);
    console.log('加載ID:', path);
    
    idImg = new Image();
    idImg.crossOrigin = 'anonymous';
    idImg.onload = () => {
        console.log('✓ ID圖加載完成:', idImg.width, 'x', idImg.height);
        updateID();
    };
    idImg.onerror = () => console.error('❌ ID圖加載失敗');
    idImg.src = path;
}

// ===== 更新ID Canvas（簡化版 - 直接使用pannellum的渲染canvas）=====
function updateID() {
    if (!idImg || !idImg.complete) return;
    
    const div = document.getElementById('panorama');
    const pCanvas = div.querySelector('canvas');
    if (!pCanvas) return;
    
    // 讓ID canvas與pannellum canvas完全相同
    idCanvas.width = pCanvas.width;
    idCanvas.height = pCanvas.height;
    
    // 獲取視角
    const pitch = viewer.getPitch();
    const yaw = viewer.getYaw();
    const hfov = viewer.getHfov();
    
    console.log(`更新ID - 視角: pitch=${pitch.toFixed(1)}, yaw=${yaw.toFixed(1)}, hfov=${hfov.toFixed(1)}`);
    console.log(`Canvas尺寸: ${idCanvas.width} x ${idCanvas.height}`);
    
    // 手動渲染投影
    renderProjection(idImg, idCanvas, idCtx, pitch, yaw, hfov);
}

// ===== 渲染等距柱狀投影 =====
function renderProjection(srcImg, dstCanvas, dstCtx, pitch, yaw, hfov) {
    const w = dstCanvas.width;
    const h = dstCanvas.height;
    const vfov = 2 * Math.atan(Math.tan(hfov * Math.PI / 360) * (h / w)) * 180 / Math.PI;
    
    // 讀取源圖
    const tmp = document.createElement('canvas');
    tmp.width = srcImg.width;
    tmp.height = srcImg.height;
    const tmpCtx = tmp.getContext('2d');
    tmpCtx.drawImage(srcImg, 0, 0);
    const srcData = tmpCtx.getImageData(0, 0, srcImg.width, srcImg.height);
    
    // 輸出數據
    const outData = dstCtx.createImageData(w, h);
    
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // 屏幕座標 → pitch/yaw
            const px = pitch + (0.5 - y / h) * vfov;
            const py = yaw + (x / w - 0.5) * hfov;
            
            // pitch/yaw → 全景圖像素
            let ny = py;
            while (ny > 180) ny -= 360;
            while (ny < -180) ny += 360;
            
            const sx = Math.floor(((ny + 180) / 360) * srcImg.width) % srcImg.width;
            const sy = Math.floor(((90 - px) / 180) * srcImg.height);
            
            if (sy >= 0 && sy < srcImg.height) {
                const si = (sy * srcImg.width + sx) * 4;
                const di = (y * w + x) * 4;
                
                outData.data[di] = srcData.data[si];
                outData.data[di + 1] = srcData.data[si + 1];
                outData.data[di + 2] = srcData.data[si + 2];
                outData.data[di + 3] = 255;
            }
        }
    }
    
    dstCtx.putImageData(outData, 0, 0);
    console.log('✓ ID投影渲染完成');
}

// ===== 處理鼠標移動 =====
let moveTimer = null;
function handleMove(e) {
    if (moveTimer) return;
    moveTimer = setTimeout(() => {
        const type = getColor(e.clientX, e.clientY);
        if (type) {
            e.target.style.cursor = 'pointer';
            drawHL(type);
        } else {
            e.target.style.cursor = 'default';
            clearHL();
        }
        moveTimer = null;
    }, 80);
}

// ===== 獲取顏色類型 =====
function getColor(cx, cy) {
    if (!idCanvas || !idCtx) return null;
    
    const div = document.getElementById('panorama');
    const canvas = div.querySelector('canvas');
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(cx - rect.left);
    const y = Math.floor(cy - rect.top);
    
    if (x < 0 || x >= idCanvas.width || y < 0 || y >= idCanvas.height) return null;
    
    try {
        const p = idCtx.getImageData(x, y, 1, 1).data;
        const [r, g, b] = [p[0], p[1], p[2]];
        
        if (r === 0 && g === 0 && b === 0) return null;
        
        console.log(`讀取(${x},${y}): RGB(${r},${g},${b})`);
        
        for (const [key, [tr, tg, tb]] of Object.entries(COLORS)) {
            if ((key === 'sofa' || key === 'table') && state.scene !== '客餐廳') continue;
            
            if (Math.abs(r - tr) <= 20 && Math.abs(g - tg) <= 20 && Math.abs(b - tb) <= 20) {
                console.log(`✓ 匹配: ${key}`);
                return key;
            }
        }
    } catch (e) {}
    
    return null;
}

// ===== 繪製白色外框 =====
function drawHL(type) {
    if (!hlCtx || !idCanvas) return;
    
    clearHL();
    
    const [tr, tg, tb] = COLORS[type];
    const div = document.getElementById('panorama');
    const rect = div.querySelector('canvas').getBoundingClientRect();
    
    const data = idCtx.getImageData(0, 0, idCanvas.width, idCanvas.height);
    const px = data.data;
    const w = idCanvas.width;
    const h = idCanvas.height;
    
    // 找邊緣點
    const edges = [];
    for (let y = 0; y < h; y += 3) {
        for (let x = 0; x < w; x += 3) {
            const i = (y * w + x) * 4;
            if (Math.abs(px[i] - tr) <= 20 && 
                Math.abs(px[i+1] - tg) <= 20 && 
                Math.abs(px[i+2] - tb) <= 20) {
                
                if (isEdgePx(x, y, w, h, px, [tr, tg, tb])) {
                    edges.push({ x, y });
                }
            }
        }
    }
    
    if (edges.length < 10) {
        console.log('邊緣點太少:', edges.length);
        return;
    }
    
    // 按角度排序
    edges.sort((a, b) => {
        const aa = Math.atan2(a.y - h/2, a.x - w/2);
        const ab = Math.atan2(b.y - h/2, b.x - w/2);
        return aa - ab;
    });
    
    // 繪製
    hlCtx.strokeStyle = '#FFFFFF';
    hlCtx.lineWidth = 4;
    hlCtx.shadowBlur = 15;
    hlCtx.shadowColor = '#FFFFFF';
    
    hlCtx.beginPath();
    edges.forEach((p, i) => {
        const sx = p.x + rect.left;
        const sy = p.y + rect.top;
        if (i === 0) hlCtx.moveTo(sx, sy);
        else hlCtx.lineTo(sx, sy);
    });
    hlCtx.closePath();
    hlCtx.stroke();
    
    console.log(`✓ 繪製外框 ${edges.length} 點`);
}

function isEdgePx(x, y, w, h, px, [tr, tg, tb]) {
    for (const [dx, dy] of [[-1,0], [1,0], [0,-1], [0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) return true;
        
        const i = (ny * w + nx) * 4;
        if (Math.abs(px[i] - tr) > 20 || 
            Math.abs(px[i+1] - tg) > 20 || 
            Math.abs(px[i+2] - tb) > 20) {
            return true;
        }
    }
    return false;
}

function clearHL() {
    if (hlCtx && hlCanvas) {
        hlCtx.clearRect(0, 0, hlCanvas.width, hlCanvas.height);
    }
}

// ===== 點擊處理 =====
function handleClick(e) {
    const type = getColor(e.clientX, e.clientY);
    if (!type) return;
    
    console.log('點擊:', type);
    
    if (type === '客餐廳' || type === '主臥室' || type === '次臥室') {
        changeScene(type);
    } else if (type === 'sofa') {
        state.sofa = ['A','B','C'][((['A','B','C'].indexOf(state.sofa)) + 1) % 3];
        reload();
    } else if (type === 'table') {
        state.table = ['A','B','C'][((['A','B','C'].indexOf(state.table)) + 1) % 3];
        reload();
    }
}

function changeScene(s) {
    console.log('切換場景:', s);
    state.scene = s;
    if (s !== '客餐廳') {
        state.sofa = 'A';
        state.table = 'A';
    }
    reload();
}

function reload() {
    if (viewer) viewer.destroy();
    clearHL();
    
    setTimeout(() => {
        createViewer();
        updateUI();
    }, 100);
}

function updateUI() {
    document.getElementById('current-scene').textContent = state.scene;
    document.getElementById('current-sofa').textContent = state.sofa;
    document.getElementById('current-table').textContent = state.table;
    
    document.getElementById('furniture-controls').style.display = 
        state.scene === '客餐廳' ? 'block' : 'none';
    
    document.querySelectorAll('.scene-btn').forEach(b => 
        b.classList.toggle('active', b.dataset.scene === state.scene));
    document.querySelectorAll('.sofa-btn').forEach(b => 
        b.classList.toggle('active', b.dataset.sofa === state.sofa));
    document.querySelectorAll('.table-btn').forEach(b => 
        b.classList.toggle('active', b.dataset.table === state.table));
}

window.onload = () => setTimeout(init, 100);

