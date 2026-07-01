# SYLVAN Wallpaper Lab

一个移动端优先的静态壁纸 / 桌搭 / 外设灵感落地页，使用原生 HTML、CSS 和 JavaScript，无需安装依赖。

## 本地预览

最简单的方式：直接双击 `index.html`。

推荐方式（避免某些浏览器的本地文件限制）：

```powershell
cd "E:\个人文件夹\自媒体图文\AI-海报\sylvan-wallpaper-lab"
python -m http.server 8080
```

然后访问 `http://localhost:8080`。没有 Python 时，也可以用 VS Code 的 Live Server 打开。

## 内容替换

- 壁纸图库：网页会读取上级 `AI-海报` 文件夹中的全部图片。新增或删除素材后，在项目目录运行下面的命令重新生成清单：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\generate-wallpaper-data.ps1"
& "C:\Users\W-SF\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" ".\tools\build-web-gallery.py"
```

- 横竖屏：生成器依据图片真实宽高自动区分；横屏使用电脑预览，竖屏使用手机预览。
- 首屏视频：替换 `assets/video/hero-background.mp4` 即可更新主页背景，建议使用横版 MP4，并保持静音自动播放所需的较小文件体积。
- 分类规则：一个素材文件夹只对应一个主分类，因此同一图片不会在多个关键词选项卡中重复出现。映射规则位于 `tools/generate-wallpaper-data.ps1` 的 `Get-Categories` 函数中。
- 展示数量：图库按文件修改时间从新到旧排序，默认展示最近 8 张；每次点击“展开更多壁纸”增加 50 张。
- GitHub Pages：提交前运行 `build-web-gallery.py`，它会生成项目内的压缩 WebP 图库，避免上传约 914MB 的站外原图。
- 下载链接：在 `index.html` 搜索“下载链接”，把 `href="#"` 换成真实文件或网盘链接，并删除该按钮的 `placeholder-link` 类名。
- 商品链接：搜索“购买链接”，按同样方式替换 `href` 并删除 `placeholder-link`。
- 抖音主页：搜索“抖音主页链接”，替换所有对应 `href` 并删除 `placeholder-link`。
- 商务信息：搜索 `your@email.com` 和“请替换为你的联系方式”。
- 新增分类：新增 `.filter-chip`，并给壁纸卡片的 `data-category` 加上相同分类名。

## 项目结构

```text
sylvan-wallpaper-lab/
├─ index.html
├─ README.md
├─ assets/
│  ├─ css/
│  │  └─ style.css
│  ├─ js/
│  │  ├─ main.js
│  │  └─ wallpapers-data.js  # 自动生成的 424 张素材清单
│  ├─ images/
│  │  ├─ hero-faiz.png
│  │  └─ wallpaper-*.png
│  └─ video/
│     └─ hero-background.mp4
└─ tools/
   └─ generate-wallpaper-data.ps1
```

首屏和桌搭示例图保存在 `assets/images/`；完整图库直接引用上级素材，不会复制或修改原图。

## 每日更新并同步 GitHub Pages

1. 把新图片放入上级 `AI-海报` 中对应的分类素材文件夹。
2. 在本项目目录运行一键更新脚本：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\tools\update-site.ps1"
```

3. 用 GitHub Desktop 打开项目，填写更新说明，例如“新增 8 张壁纸”，点击 **Commit to main**。
4. 点击 **Push origin**。如果仓库已启用 GitHub Pages，推送完成后网站会自动重新部署。

构建脚本使用稳定数字文件名（如 `wallpaper-0001.webp`）并复用未修改图片。编号映射保存在 `tools/wallpaper-file-map.json`，请一并提交且不要删除；日常新增素材会从现有最大编号继续递增。
