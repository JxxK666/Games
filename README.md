# Neon Breach FPS · 霓虹熔炉突入

[![TypeScript](https://img.shields.io/badge/TypeScript-83.7%25-3178C6?logo=typescript)](.)
[![Three.js](https://img.shields.io/badge/Three.js-latest-000000?logo=three.js)](.)
[![Vite](https://img.shields.io/badge/Vite-latest-646CFF?logo=vite)](.)

赛博朋克风格的 3D 第一人称射击游戏，运行在浏览器中。潜入霓虹都市的各个角落，消灭敌人，层层推进。

> A cyberpunk-themed 3D first-person shooter built with Three.js, running directly in the browser.

---

## 演示 / Demo

```bash
npm run dev      # 启动开发服务器 → http://127.0.0.1:5173
npm run build    # 构建生产版本到 dist/
npm run preview  # 预览构建结果
```

添加 `?autostart` 参数可以跳过主菜单自动开始游戏。

## 操作 / Controls

| 按键 | 操作 |
|------|------|
| `W` `A` `S` `D` | 移动 |
| 鼠标 | 瞄准 |
| 鼠标左键 | 射击 |
| `R` | 换弹 |
| `Shift` | 冲刺 |
| `Space` | 跳跃 |

## 游戏机制 / Gameplay

- **战斗系统** — 30 发弹匣，90 发备弹；步枪伤害 34 点，射程 62 单位；换弹时间 1.35 秒
- **敌人 AI** — 巡逻 → 追击 → 攻击 三阶段行为；视野检测与射线遮挡判定；100 HP，攻击力 8 点
- **生命系统** — 100 HP 上限；受伤保护 0.22 秒间隔；关卡间恢复 30 HP；出生护盾 2.2 秒
- **关卡推进** — 5 种场景主题（地铁 / 机场 / 商场 / 医院 / 图书馆）；清空所有敌人进入下一关；19 种场景碰撞体
- **视觉反馈** — 伤害泛红、屏幕震动、命中标记、击杀计数

## 技术栈 / Tech Stack

| 技术 | 用途 |
|------|------|
| [Three.js](https://threejs.org/) | 3D 渲染引擎 |
| [TypeScript](https://www.typescriptlang.org/) | 类型安全 |
| [Vite](https://vite.dev/) | 开发与构建 |
| [Playwright](https://playwright.dev/) | 视觉回归测试 |

## 项目结构 / Project Structure

```
neon-breach-fps/
├── index.html               # HTML 入口 (含 HUD 布局)
├── package.json              # 依赖与脚本
├── tsconfig.json             # TypeScript 配置
├── vite.config.ts            # Vite 配置
├── scripts/
│   └── visual-check.mjs      # Playwright 视觉 QA
└── src/
    ├── main.ts               # 入口：初始化 & 游戏循环
    ├── styles.css             # 全局样式
    ├── game/
    │   ├── types.ts           # 类型定义
    │   ├── input.ts           # 输入处理 (鼠标/键盘)
    │   ├── level.ts           # 关卡数据 & 预加载
    │   └── simulation.ts      # 核心模拟：物理/射击/AI
    ├── render/
    │   ├── gameRenderer.ts    # Three.js 渲染器
    │   └── audio.ts           # 音频系统
    └── ui/
        └── hud.ts             # HUD 界面 (HP/弹药/击杀/准星)
```

## 开发 / Development

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行视觉检查
npm run qa:visual
```

## 许可 / License

此项目为个人作品，未声明开源许可。
