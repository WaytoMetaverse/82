# GitHub 上傳與預覽設定指南

## 步驟 1：在 GitHub 上創建新倉庫

1. 登入你的 GitHub 帳號
2. 點擊右上角的 **+** 號，選擇 **New repository**
3. 填寫倉庫資訊：
   - **Repository name**: `panorama-tour` (或你喜歡的名稱)
   - **Description**: 環景圖導覽網站
   - **Visibility**: 選擇 Public（GitHub Pages 免費版需要公開倉庫）
   - **不要**勾選 "Initialize this repository with a README"（我們已經有文件了）
4. 點擊 **Create repository**

## 步驟 2：將本地代碼推送到 GitHub

複製 GitHub 提供的命令（會類似下面這樣），在終端機中執行：

```bash
git remote add origin https://github.com/你的用戶名/panorama-tour.git
git branch -M main
git push -u origin main
```

**或者如果你已經創建了倉庫，GitHub 會顯示具體的命令，直接複製執行即可。**

### 如果遇到認證問題

如果推送時需要輸入帳號密碼，你可能需要使用 Personal Access Token：

1. 前往 GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. 點擊 "Generate new token"
3. 選擇權限：至少勾選 `repo` 權限
4. 生成後複製 token，在輸入密碼時使用這個 token

## 步驟 3：啟用 GitHub Pages

1. 進入你的 GitHub 倉庫頁面
2. 點擊上方的 **Settings** 標籤
3. 在左側選單中找到 **Pages**
4. 在 **Source** 部分：
   - 選擇 **Deploy from a branch**
   - Branch 選擇 **main** (或 master)
   - Folder 選擇 **/ (root)**
5. 點擊 **Save**

## 步驟 4：訪問你的網站

等待幾分鐘讓 GitHub 部署完成後，你的網站將可以在以下網址訪問：

```
https://你的用戶名.github.io/panorama-tour/
```

（將 `panorama-tour` 替換為你的實際倉庫名稱）

你可以在 Settings > Pages 頁面看到你的網站網址。

## 更新網站

之後如果需要更新網站，只需要：

```bash
git add .
git commit -m "更新說明"
git push
```

推送後，GitHub Pages 會自動重新部署（通常需要幾分鐘）。

## 注意事項

- GitHub Pages 免費版只支援靜態網站（HTML/CSS/JavaScript）
- 圖片檔案較大時，首次載入可能需要一些時間
- 確保所有圖片路徑都是相對路徑（已經設定好了）

## 疑難排解

### 如果網站無法顯示圖片
- 檢查圖片路徑是否正確
- 確認所有圖片檔案都已推送到 GitHub
- 檢查瀏覽器控制台是否有錯誤訊息

### 如果點擊功能不工作
- 確認 ID 圖檔案都已上傳
- 檢查瀏覽器控制台的錯誤訊息
- 確認 Pannellum 庫已正確載入

