# Wplace_Locator

选择语言 / Choose language  
- [中文（简体）](#a-中文部分)  
- [English](#b-english-section)

---

## A. 中文部分

### 目录（点击跳转）
- [概览](#概览)
- [适合谁用](#适合谁用)
- [主要功能](#主要功能)
- [快速开始](#快速开始)
  - [安装（开发 / 调试）](#安装开发--调试)
  - [快速使用步骤](#快速使用步骤)
- [常见问题（FAQ）](#常见问题faq)
- [隐私与安全](#隐私与安全)
- [反馈与支持](#反馈与支持)
- [附录：小提示](#附录小提示)

---

### 概览
Wplace_Locator 是一个轻量的悬浮扩展。它可以：
- 一键复制并分享页面上的像素坐标（四元坐标：TlX, TlY, PxX, PxY）；
- 把四元坐标转换成经纬并打开 wplace.live 定位；
- 在支持的页面上自动检测绘图插件并填入坐标输入框，省去手工输入。

---

### 适合谁用
- 想快速在 wplace.live 或类似地图上定位某个瓦片的用户；  
- 与朋友协作共享地图视角时需要精确坐标的场景；  
- 不想手动寻找并输入基准坐标的用户。

---

### 主要功能
- 悬浮面板：可拖拽、最小化为图标并记住位置。  
- 分享/复制：一键复制最近的四元坐标到剪贴板（带兼容回退）。  
- 跳转地图：将四元坐标转为高精度经纬并打开 wplace.live 指定位置。  
- 自动填表：智能检测页面表单并尝试把坐标填入（Blue / Skirk 等常见格式）。  
- 主题切换：在支持的页面上安全切换主题设置（兼顾页面安全策略）。

---

### 快速开始

#### 安装（开发 / 调试）
1. 打开 Chrome或Edge 扩展管理页（chrome://extensions/ 或 edge://extensions/），打开“开发者模式”。  
2. 点击“加载已解压的扩展”，选择本项目的 src 文件夹。  
3. 打开或刷新 Wplace 网站。

#### 快速使用步骤
1. 页面右下角或页面上出现悬浮图标，点击打开面板。  
2. 点击“分享”会把最近的四元坐标复制到剪贴板。  
3. 在面板输入框粘贴四元坐标，用逗号隔开（示例：`180,137,42,699`），点击“跳转”即可。  
4. 扩展会尝试自动把基准坐标填入绘画插件并清除
5. 点击最小化按钮把面板缩为图标，再点击图标可恢复。

---

### 隐私与安全
- 本扩展仅在本地读取/写入需要的坐标与主题设置，不会把坐标上传到外部服务器。  
- 如果关心隐私或想查看实现，请检查扩展源码或直接卸载扩展。

---

### 反馈与支持
欢迎在仓库提交 Issue 或 PR，描述你遇到的问题并附上控制台日志（若方便）。页面适配问题通常需要目标页面的简要说明或截图帮助定位问题。

---

### 附录：小提示
- 如果主题无法保持，请在 DevTools 的 Network / Elements 中确认扩展注入点是否加载成功（适用于调试）。  
- 若自动填表失败，试着刷新目标页或等待页面完成加载后再尝试 Jump。  
- 在开发或调试时可临时打开控制台查看扩展输出日志，帮助定位问题。

---

## B. English section

### Contents (click to jump)
- [Overview](#overview)
- [Who it's for](#who-its-for)
- [Features](#features)
- [Quick Start](#quick-start)
  - [Installation (Dev / Debug)](#installation-dev--debug)
  - [Quick usage steps](#quick-usage-steps-1)
- [FAQ](#faq)
- [Privacy & Security](#privacy--security)
- [Feedback & Support](#feedback--support)
- [Appendix: tips](#appendix-tips)

---

### Overview
Wplace_Locator is a light floating browser extension that helps you:
- Copy and share pixel coordinates (four-values: TlX, TlY, PxX, PxY);  
- Convert those four-values into latitude/longitude and open the location on wplace.live;  
- Auto-fill coordinate inputs on supported pages to save manual work.

---

### Who it's for
- Users who want to quickly locate tiles on wplace.live or similar map sites;  
- People who share map views with friends and need exact coordinates;  
- Anyone who wants to avoid manually finding and typing base coordinates.

---

### Features
- Floating panel: draggable, minimizable, remembers position.  
- Share & copy: one-click copy of latest four-coordinates (with fallback).  
- Jump: converts four-coordinates to precise lat/lng and opens wplace.live.  
- Auto-fill: detects and fills TlX/TlY/PxX/PxY inputs on compatible pages.  
- Theme switch: safely apply page theme where supported.

---

### Quick Start

#### Installation (Dev / Debug)
1. Open chrome://extensions/ or edge://extensions/ and enable Developer mode.  
2. Click "Load unpacked" and select the project src (or extension root).  
3. Open https://wplace.live/ to test the panel actions.

#### Quick usage steps
1. Click the floating icon to open the panel.  
2. Click "Share" to copy the latest four-coordinates.  
3. Paste a four-coordinate string (e.g. `180,137,42,699`) into the input and click "Jump" — the extension will open the map and jump to the point.
4. On the target page the extension will try to auto-fill pending coords into the painting plugin.  
5. Minimize to icon and click again to restore.

---

### Privacy & Security
- The extension reads/writes only required coordinates and theme locally. It does not upload any information.  
- Review the source or uninstall if you have concerns.

---

### Feedback & Support
Open an Issue or PR with page details and console logs to help reproduction and fixes.

---

### Appendix: tips
- If theme changes do not persist, check DevTools to confirm the injector script loaded early.  
- If auto-fill fails, refresh the target page or wait for it to finish loading before retrying.  
- For debugging, use the browser console to inspect extension logs.

---
