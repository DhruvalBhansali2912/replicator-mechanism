/**
 * Chrome Web Store Asset Generator
 * Generates all mandatory & recommended graphic assets at exact CWS pixel dimensions:
 * - small-promo-440x280.png (440 x 280)
 * - marquee-promo-1400x560.png (1400 x 560)
 * - screenshot-1-picker-1280x800.png (1280 x 800)
 * - screenshot-2-popup-1280x800.png (1280 x 800)
 * - screenshot-3-synthesis-1280x800.png (1280 x 800)
 * - screenshot-4-preview-1280x800.png (1280 x 800)
 * - screenshot-5-code-export-1280x800.png (1280 x 800)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_DIR = path.join(__dirname, '..', 'extension', 'store-assets');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const iconB64 = fs.readFileSync(path.join(__dirname, '..', 'extension', 'icons', 'icon128.png')).toString('base64');
const iconDataUri = `data:image/png;base64,${iconB64}`;

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: #090d16;
    color: #f8fafc;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .gradient-text {
    background: linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .gradient-btn {
    background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
  }
  .card-glow {
    background: rgba(30, 41, 59, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
  }
`;

const templates = [
  // 1. Small Promotional Tile: 440 x 280
  {
    name: 'small-promo-440x280.png',
    width: 440,
    height: 280,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${baseStyles}
          .container {
            width: 440px;
            height: 280px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 24px;
            position: relative;
            background: radial-gradient(circle at 50% 10%, #1e293b 0%, #090d16 80%);
          }
          .glow-orb {
            position: absolute;
            width: 220px;
            height: 220px;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(37, 99, 235, 0) 70%);
            top: 10px;
            filter: blur(25px);
            pointer-events: none;
          }
          .icon-img {
            width: 72px;
            height: 72px;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.3);
            margin-bottom: 12px;
            z-index: 1;
          }
          .title {
            font-size: 21px;
            font-weight: 800;
            letter-spacing: -0.5px;
            margin-bottom: 4px;
            z-index: 1;
          }
          .subtitle {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 16px;
            z-index: 1;
          }
          .tags {
            display: flex;
            gap: 8px;
            z-index: 1;
          }
          .tag {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #94a3b8;
          }
          .tag.accent {
            background: rgba(16, 185, 129, 0.15);
            border-color: rgba(16, 185, 129, 0.4);
            color: #34d399;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="glow-orb"></div>
          <img class="icon-img" src="${iconDataUri}" />
          <div class="title">InventKid Page Replicator</div>
          <div class="subtitle gradient-text">1-Click Website & Component Cloner</div>
          <div class="tags">
            <span class="tag">Clean HTML & CSS</span>
            <span class="tag">Vanilla JS</span>
            <span class="tag accent">10 Free Credits</span>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // 2. Marquee Promotional Banner: 1400 x 560
  {
    name: 'marquee-promo-1400x560.png',
    width: 1400,
    height: 560,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${baseStyles}
          .container {
            width: 1400px;
            height: 560px;
            display: flex;
            position: relative;
            padding: 60px 80px;
            align-items: center;
            justify-content: space-between;
            background: radial-gradient(circle at 20% 30%, #1e293b 0%, #090d16 75%);
            overflow: hidden;
          }
          .bg-glow-1 {
            position: absolute;
            top: -100px;
            left: 100px;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, transparent 70%);
            filter: blur(50px);
          }
          .bg-glow-2 {
            position: absolute;
            bottom: -150px;
            right: 200px;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(79, 70, 229, 0.22) 0%, transparent 70%);
            filter: blur(60px);
          }
          .left-col {
            max-width: 650px;
            z-index: 2;
          }
          .brand-row {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 24px;
          }
          .brand-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
          }
          .brand-name {
            font-size: 20px;
            font-weight: 700;
            color: #cbd5e1;
            letter-spacing: -0.3px;
          }
          .headline {
            font-size: 46px;
            font-weight: 850;
            line-height: 1.15;
            letter-spacing: -1px;
            margin-bottom: 18px;
          }
          .description {
            font-size: 18px;
            line-height: 1.5;
            color: #94a3b8;
            margin-bottom: 28px;
          }
          .feature-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }
          .badge {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #e2e8f0;
          }
          .badge.highlight {
            background: rgba(16, 185, 129, 0.15);
            border-color: rgba(16, 185, 129, 0.4);
            color: #34d399;
          }
          .right-col {
            position: relative;
            z-index: 2;
            width: 520px;
            height: 380px;
            perspective: 1000px;
          }
          .mockup-window {
            width: 100%;
            height: 100%;
            border-radius: 14px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transform: rotateY(-8deg) rotateX(4deg);
            transition: transform 0.3s ease;
          }
          .window-header {
            background: #1e293b;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .dot { width: 10px; height: 10px; border-radius: 50%; }
          .dot-red { background: #ef4444; }
          .dot-yellow { background: #f59e0b; }
          .dot-green { background: #10b981; }
          .url-bar {
            flex: 1;
            margin-left: 10px;
            background: #0f172a;
            border-radius: 6px;
            padding: 4px 12px;
            font-size: 11px;
            color: #64748b;
            font-family: monospace;
          }
          .window-body {
            flex: 1;
            background: #0f172a;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .mock-banner {
            border: 2px dashed #38bdf8;
            background: rgba(56, 189, 248, 0.08);
            border-radius: 10px;
            padding: 18px;
            position: relative;
          }
          .mock-badge {
            position: absolute;
            top: -10px;
            left: 16px;
            background: #0284c7;
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
          }
          .mock-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #fff; }
          .mock-desc { font-size: 12px; color: #94a3b8; }
          .export-card {
            background: #1e293b;
            border-radius: 8px;
            padding: 14px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .export-info { font-size: 12px; color: #cbd5e1; }
          .export-btn {
            font-size: 12px;
            padding: 6px 14px;
            border-radius: 6px;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="bg-glow-1"></div>
          <div class="bg-glow-2"></div>
          
          <div class="left-col">
            <div class="brand-row">
              <img class="brand-icon" src="${iconDataUri}" />
              <div class="brand-name">InventKid Page Replicator</div>
            </div>
            <div class="headline">
              Replicate Any Web Section Into <span class="gradient-text">Clean, Standalone Code</span>
            </div>
            <div class="description">
              Extract pixel-perfect HTML, scoped CSS, and vanilla JS animations in 1 click. Zero framework bloat, 100% offline-ready assets.
            </div>
            <div class="feature-badges">
              <div class="badge">🎯 Visual Element Picker</div>
              <div class="badge">📦 100% Offline Asset Bundler</div>
              <div class="badge">⚡ Zero Unused CSS</div>
              <div class="badge highlight">🎁 10 Free Credits Included</div>
            </div>
          </div>

          <div class="right-col">
            <div class="mockup-window card-glow">
              <div class="window-header">
                <div class="dot dot-red"></div>
                <div class="dot dot-yellow"></div>
                <div class="dot dot-green"></div>
                <div class="url-bar">https://apple.com/iphone-16-pro</div>
              </div>
              <div class="window-body">
                <div class="mock-banner">
                  <div class="mock-badge">TARGET SECTION SELECTED</div>
                  <div class="mock-title">Pro Camera System Showcase</div>
                  <div class="mock-desc">48MP Fusion Camera &bull; 5x Telephoto &bull; Interactive Switcher</div>
                </div>
                <div class="export-card">
                  <div class="export-info">
                    <strong style="color: #38bdf8;">✓ Synthesized Ready</strong><br>
                    <span>index.html &bull; style.css &bull; script.js (32 KB)</span>
                  </div>
                  <button class="export-btn gradient-btn">Download ZIP</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // 3. Screenshot 1: 1280 x 800 - Visual Section Picker
  {
    name: 'screenshot-1-picker-1280x800.png',
    width: 1280,
    height: 800,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${baseStyles}
          .wrapper {
            width: 1280px;
            height: 800px;
            display: flex;
            flex-direction: column;
            background: #0f172a;
          }
          .top-banner {
            background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 16px 36px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .banner-title {
            font-size: 20px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .banner-tag {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background: #0284c7;
            padding: 4px 10px;
            border-radius: 999px;
            color: #fff;
          }
          .banner-subtitle {
            font-size: 14px;
            color: #94a3b8;
          }
          .browser-frame {
            flex: 1;
            margin: 20px 36px 36px;
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.12);
            display: flex;
            flex-direction: column;
            background: #ffffff;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7);
          }
          .browser-nav {
            background: #f1f5f9;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            border-bottom: 1px solid #e2e8f0;
          }
          .nav-dots { display: flex; gap: 6px; }
          .dot { width: 10px; height: 10px; border-radius: 50%; }
          .dot-red { background: #ef4444; }
          .dot-yellow { background: #f59e0b; }
          .dot-green { background: #10b981; }
          .nav-url {
            flex: 1;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 4px 14px;
            font-size: 12px;
            color: #475569;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .browser-body {
            flex: 1;
            position: relative;
            background: #0f172a;
            color: #f8fafc;
            padding: 40px 60px;
            overflow: hidden;
          }
          .sample-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 40px;
            opacity: 0.5;
          }
          .sample-hero {
            position: relative;
            border: 3px solid #38bdf8;
            border-radius: 16px;
            background: rgba(56, 189, 248, 0.05);
            padding: 40px;
            box-shadow: 0 0 40px rgba(56, 189, 248, 0.25);
          }
          .picker-badge {
            position: absolute;
            top: -14px;
            left: 30px;
            background: #0284c7;
            color: #fff;
            padding: 4px 14px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.5);
          }
          .hero-eyebrow { color: #38bdf8; font-size: 14px; font-weight: 700; margin-bottom: 12px; }
          .hero-title { font-size: 40px; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
          .hero-desc { font-size: 16px; color: #94a3b8; max-width: 600px; margin-bottom: 24px; }
          .hero-buttons { display: flex; gap: 12px; }
          .hero-btn { padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; }
          .cursor-pointer {
            position: absolute;
            bottom: 30px;
            right: 120px;
            display: flex;
            align-items: center;
            gap: 8px;
            background: #1e293b;
            border: 1px solid #38bdf8;
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            color: #38bdf8;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="top-banner">
            <div class="banner-title">
              <span class="banner-tag">Feature 1</span>
              <span>Visual Section Picker</span>
            </div>
            <div class="banner-subtitle">
              Hover over any element, hero slider, navbar, or pricing table to inspect and isolate with 1 click
            </div>
          </div>
          <div class="browser-frame">
            <div class="browser-nav">
              <div class="nav-dots">
                <div class="dot dot-red"></div>
                <div class="dot dot-yellow"></div>
                <div class="dot dot-green"></div>
              </div>
              <div class="nav-url">🔒 https://linear.app/features</div>
            </div>
            <div class="browser-body">
              <div class="sample-nav">
                <strong>LINEAR</strong>
                <span>Features &bull; Method &bull; Customers &bull; Changelog &bull; Pricing</span>
                <span style="border: 1px solid #475569; padding: 4px 12px; border-radius: 6px;">Sign in</span>
              </div>
              <div class="sample-hero">
                <div class="picker-badge">
                  <span>🎯</span>
                  <span>section.hero-interactive (Click to Replicate)</span>
                </div>
                <div class="hero-eyebrow">NEXT-GEN ISSUE TRACKING</div>
                <div class="hero-title">Issue tracking you'll enjoy using.</div>
                <div class="hero-desc">Linear helps streamline software projects, sprints, tasks, and bug tracking. Built for high-performance product teams.</div>
                <div class="hero-buttons">
                  <div class="hero-btn gradient-btn">Get Started</div>
                  <div class="hero-btn" style="background: rgba(255,255,255,0.1); color: #fff;">Documentation</div>
                </div>
                <div class="cursor-pointer">
                  <span>👆</span>
                  <span>CLICK TO LOCK SELECTION</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // 4. Screenshot 2: 1280 x 800 - Extension Popup & Configuration
  {
    name: 'screenshot-2-popup-1280x800.png',
    width: 1280,
    height: 800,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${baseStyles}
          .wrapper {
            width: 1280px;
            height: 800px;
            display: flex;
            flex-direction: column;
            background: #0f172a;
          }
          .top-banner {
            background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 16px 36px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .banner-title {
            font-size: 20px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .banner-tag {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background: #2563eb;
            padding: 4px 10px;
            border-radius: 999px;
            color: #fff;
          }
          .banner-subtitle { font-size: 14px; color: #94a3b8; }
          .main-stage {
            flex: 1;
            display: flex;
            padding: 30px 60px;
            gap: 40px;
            align-items: center;
            justify-content: center;
          }
          .popup-card {
            width: 380px;
            background: #1e293b;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 25px 60px rgba(0,0,0,0.7);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .popup-header {
            padding: 16px;
            background: #0f172a;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .brand-wrap { display: flex; align-items: center; gap: 10px; }
          .brand-wrap img { width: 28px; height: 28px; border-radius: 6px; }
          .brand-title { font-size: 14px; font-weight: 700; }
          .token-pill {
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.4);
            color: #34d399;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
          }
          .popup-body {
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .section-select-box {
            background: #0f172a;
            border: 1px solid #38bdf8;
            border-radius: 8px;
            padding: 10px 14px;
          }
          .box-label { font-size: 11px; text-transform: uppercase; color: #38bdf8; font-weight: 700; margin-bottom: 4px; }
          .box-val { font-size: 13px; font-family: monospace; color: #f8fafc; font-weight: 600; }
          .options-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .option-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            color: #cbd5e1;
          }
          .toggle-switch {
            width: 36px;
            height: 20px;
            background: #2563eb;
            border-radius: 999px;
            position: relative;
          }
          .toggle-switch::after {
            content: '';
            position: absolute;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #fff;
            top: 2px;
            right: 2px;
          }
          .action-btn {
            padding: 12px;
            border-radius: 8px;
            border: none;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            margin-top: 6px;
          }
          .side-highlights {
            max-width: 450px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .highlight-card {
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 18px 22px;
          }
          .hl-title { font-size: 16px; font-weight: 700; color: #38bdf8; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
          .hl-desc { font-size: 14px; color: #94a3b8; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="top-banner">
            <div class="banner-title">
              <span class="banner-tag">Feature 2</span>
              <span>1-Click Configuration & Replicate</span>
            </div>
            <div class="banner-subtitle">
              Seamless popup controls with automatic token balance sync and flexible synthesis options
            </div>
          </div>
          <div class="main-stage">
            <div class="popup-card">
              <div class="popup-header">
                <div class="brand-wrap">
                  <img src="${iconDataUri}" />
                  <div class="brand-title">Page Replicator</div>
                </div>
                <div class="token-pill">⚡ 10 Credits</div>
              </div>
              <div class="popup-body">
                <div class="section-select-box">
                  <div class="box-label">Target Section</div>
                  <div class="box-val">section.pricing-matrix</div>
                </div>
                <div class="options-group">
                  <div class="option-row">
                    <span>100% Offline Asset Bundling</span>
                    <div class="toggle-switch"></div>
                  </div>
                  <div class="option-row">
                    <span>Purge Unused CSS Rules</span>
                    <div class="toggle-switch"></div>
                  </div>
                  <div class="option-row">
                    <span>Synthesize Vanilla JS Animations</span>
                    <div class="toggle-switch"></div>
                  </div>
                  <div class="option-row">
                    <span>Mobile Emulation (390px Viewport)</span>
                    <div class="toggle-switch" style="background: #475569;"><div style="position:absolute; width:16px; height:16px; border-radius:50%; background:#fff; top:2px; left:2px;"></div></div>
                  </div>
                </div>
                <button class="action-btn gradient-btn">⚡ Replicate Section (-1 Token)</button>
              </div>
            </div>

            <div class="side-highlights">
              <div class="highlight-card">
                <div class="hl-title">🎁 10 Free Starter Credits</div>
                <div class="hl-desc">Get started instantly with 10 free trial credits auto-provisioned upon install. No credit card or complicated sign-up required.</div>
              </div>
              <div class="highlight-card">
                <div class="hl-title">⚡ Intelligent Code Scoping</div>
                <div class="hl-desc">Only the exact computed styles for your selected section are retained. Global stylesheets are pruned from megabytes down to clean kilobytes.</div>
              </div>
              <div class="highlight-card">
                <div class="hl-title">📦 Complete Asset Localization</div>
                <div class="hl-desc">All images, SVGs, custom web fonts, and video loops are fetched and saved locally for 100% offline runtime fidelity.</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // 5. Screenshot 3: 1280 x 800 - Deep Synthesis Engine Progress
  {
    name: 'screenshot-3-synthesis-1280x800.png',
    width: 1280,
    height: 800,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${baseStyles}
          .wrapper {
            width: 1280px;
            height: 800px;
            display: flex;
            flex-direction: column;
            background: #0f172a;
          }
          .top-banner {
            background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 16px 36px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .banner-title {
            font-size: 20px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .banner-tag {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background: #4f46e5;
            padding: 4px 10px;
            border-radius: 999px;
            color: #fff;
          }
          .banner-subtitle { font-size: 14px; color: #94a3b8; }
          .main-stage {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }
          .engine-box {
            width: 720px;
            background: #1e293b;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            padding: 32px 36px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.7);
          }
          .engine-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }
          .engine-title { font-size: 18px; font-weight: 800; color: #fff; }
          .engine-status {
            font-size: 12px;
            font-weight: 700;
            color: #34d399;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.4);
            padding: 4px 12px;
            border-radius: 999px;
          }
          .progress-bar-wrap {
            height: 8px;
            background: #0f172a;
            border-radius: 999px;
            overflow: hidden;
            margin-bottom: 28px;
          }
          .progress-fill {
            height: 100%;
            width: 100%;
            background: linear-gradient(90deg, #38bdf8 0%, #3b82f6 50%, #10b981 100%);
          }
          .steps-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .step-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #0f172a;
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 10px;
            padding: 12px 18px;
          }
          .step-left { display: flex; align-items: center; gap: 12px; }
          .step-icon { font-size: 16px; }
          .step-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
          .step-detail { font-size: 12px; color: #94a3b8; }
          .step-check { color: #34d399; font-weight: 800; font-size: 14px; }
          .metrics-row {
            display: flex;
            gap: 16px;
            margin-top: 24px;
          }
          .metric-box {
            flex: 1;
            background: rgba(255, 255, 255, 0.04);
            border-radius: 8px;
            padding: 12px 16px;
            text-align: center;
          }
          .metric-val { font-size: 20px; font-weight: 800; color: #38bdf8; }
          .metric-lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="top-banner">
            <div class="banner-title">
              <span class="banner-tag">Feature 3</span>
              <span>Deep Synthesis Engine Pipeline</span>
            </div>
            <div class="banner-subtitle">
              Automated DOM extraction, dynamic script synthesis, and multi-tier CSS de-duplication
            </div>
          </div>
          <div class="main-stage">
            <div class="engine-box">
              <div class="engine-header">
                <div class="engine-title">⚡ Extraction Pipeline Execution</div>
                <div class="engine-status">✓ 100% COMPLETED (1.4s)</div>
              </div>
              <div class="progress-bar-wrap">
                <div class="progress-fill"></div>
              </div>
              <div class="steps-list">
                <div class="step-item">
                  <div class="step-left">
                    <span class="step-icon">🌐</span>
                    <div>
                      <div class="step-name">DOM Tree Extraction & Element Isolation</div>
                      <div class="step-detail">Extracted 42 isolated DOM nodes with full computed attributes</div>
                    </div>
                  </div>
                  <div class="step-check">✓ 100%</div>
                </div>
                <div class="step-item">
                  <div class="step-left">
                    <span class="step-icon">🎨</span>
                    <div>
                      <div class="step-name">PostCSS AST Parsing & Unused Rule Purge</div>
                      <div class="step-detail">Purged 1,842 unused classes &bull; Compressed from 420 KB to 18 KB</div>
                    </div>
                  </div>
                  <div class="step-check">✓ 100%</div>
                </div>
                <div class="step-item">
                  <div class="step-left">
                    <span class="step-icon">⚡</span>
                    <div>
                      <div class="step-name">Vanilla ES6 Interactive Behavior Synthesis</div>
                      <div class="step-detail">Synthesized tab switching, dropdown toggles, and carousel transitions</div>
                    </div>
                  </div>
                  <div class="step-check">✓ 100%</div>
                </div>
                <div class="step-item">
                  <div class="step-left">
                    <span class="step-icon">📦</span>
                    <div>
                      <div class="step-name">Media & Font Localization Engine</div>
                      <div class="step-detail">14 WebP/SVG images + 2 Google Fonts bundled into /assets</div>
                    </div>
                  </div>
                  <div class="step-check">✓ 100%</div>
                </div>
              </div>
              <div class="metrics-row">
                <div class="metric-box">
                  <div class="metric-val">1.4s</div>
                  <div class="metric-lbl">Synthesis Time</div>
                </div>
                <div class="metric-box">
                  <div class="metric-val">95.7%</div>
                  <div class="metric-lbl">CSS Size Reduction</div>
                </div>
                <div class="metric-box">
                  <div class="metric-val">0</div>
                  <div class="metric-lbl">External Dependencies</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // 6. Screenshot 4: 1280 x 800 - Instant Offline Preview
  {
    name: 'screenshot-4-preview-1280x800.png',
    width: 1280,
    height: 800,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${baseStyles}
          .wrapper {
            width: 1280px;
            height: 800px;
            display: flex;
            flex-direction: column;
            background: #0f172a;
          }
          .top-banner {
            background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 16px 36px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .banner-title {
            font-size: 20px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .banner-tag {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background: #059669;
            padding: 4px 10px;
            border-radius: 999px;
            color: #fff;
          }
          .banner-subtitle { font-size: 14px; color: #94a3b8; }
          .main-stage {
            flex: 1;
            display: flex;
            padding: 24px 36px 36px;
            gap: 24px;
          }
          .comparison-col {
            flex: 1;
            background: #1e293b;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          }
          .col-header {
            padding: 12px 18px;
            background: #0f172a;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .col-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 6px;
            text-transform: uppercase;
          }
          .col-badge.live { background: #334155; color: #94a3b8; }
          .col-badge.replica { background: #0284c7; color: #fff; }
          .col-body {
            flex: 1;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }
          .card-sample {
            background: #0f172a;
            border-radius: 10px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          .tabs-row {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
          }
          .tab-btn {
            font-size: 12px;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.06);
            color: #94a3b8;
          }
          .tab-btn.active {
            background: #2563eb;
            color: #fff;
          }
          .card-content-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #fff; }
          .card-content-desc { font-size: 13px; color: #94a3b8; line-height: 1.5; }
          .status-bar {
            padding: 10px 18px;
            background: rgba(0,0,0,0.2);
            border-top: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="top-banner">
            <div class="banner-title">
              <span class="banner-tag">Feature 4</span>
              <span>100% Fidelity Offline Preview</span>
            </div>
            <div class="banner-subtitle">
              Verify click animations, tab switching, and responsive layouts running 100% locally with zero internet
            </div>
          </div>
          <div class="main-stage">
            <div class="comparison-col">
              <div class="col-header">
                <strong>Original Live Website</strong>
                <span class="col-badge live">https://stripe.com</span>
              </div>
              <div class="col-body">
                <div class="card-sample">
                  <div class="tabs-row">
                    <div class="tab-btn active">Payments</div>
                    <div class="tab-btn">Billing</div>
                    <div class="tab-btn">Invoicing</div>
                  </div>
                  <div class="card-content-title">A complete payments platform</div>
                  <div class="card-content-desc">Accept payments and move money globally with Stripe's powerful APIs and software solutions designed to capture more revenue.</div>
                </div>
              </div>
              <div class="status-bar">
                <span>Requires Online Connection</span>
                <span>Framework: React + Next.js (1.8 MB)</span>
              </div>
            </div>

            <div class="comparison-col" style="border-color: #38bdf8;">
              <div class="col-header" style="background: rgba(2, 132, 199, 0.15);">
                <strong style="color: #38bdf8;">Replicated Standalone Component</strong>
                <span class="col-badge replica">✓ 100% Offline Fidelity</span>
              </div>
              <div class="col-body">
                <div class="card-sample" style="border-color: #38bdf8;">
                  <div class="tabs-row">
                    <div class="tab-btn active">Payments</div>
                    <div class="tab-btn">Billing</div>
                    <div class="tab-btn">Invoicing</div>
                  </div>
                  <div class="card-content-title">A complete payments platform</div>
                  <div class="card-content-desc">Accept payments and move money globally with Stripe's powerful APIs and software solutions designed to capture more revenue.</div>
                </div>
              </div>
              <div class="status-bar" style="background: rgba(2, 132, 199, 0.1);">
                <span style="color: #34d399; font-weight: 700;">✓ Runs Offline (Local File / ZIP)</span>
                <span style="color: #38bdf8; font-weight: 700;">Vanilla ES6 &bull; Zero Bloat (28 KB)</span>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // 7. Screenshot 5: 1280 x 800 - Clean Code Export
  {
    name: 'screenshot-5-code-export-1280x800.png',
    width: 1280,
    height: 800,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          ${baseStyles}
          .wrapper {
            width: 1280px;
            height: 800px;
            display: flex;
            flex-direction: column;
            background: #0f172a;
          }
          .top-banner {
            background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding: 16px 36px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .banner-title {
            font-size: 20px;
            font-weight: 800;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .banner-tag {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background: #7c3aed;
            padding: 4px 10px;
            border-radius: 999px;
            color: #fff;
          }
          .banner-subtitle { font-size: 14px; color: #94a3b8; }
          .main-stage {
            flex: 1;
            margin: 20px 36px 36px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: #181824;
            display: flex;
            overflow: hidden;
            box-shadow: 0 25px 60px rgba(0,0,0,0.7);
          }
          .sidebar-tree {
            width: 260px;
            background: #11111b;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            padding: 18px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-family: monospace;
            font-size: 13px;
          }
          .tree-header {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .tree-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            border-radius: 6px;
            color: #94a3b8;
          }
          .tree-item.active {
            background: rgba(37, 99, 235, 0.2);
            color: #38bdf8;
            font-weight: 600;
          }
          .editor-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #0f111a;
          }
          .editor-tabs {
            background: #141622;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
          }
          .ed-tab {
            padding: 10px 20px;
            font-size: 12px;
            font-family: monospace;
            color: #64748b;
            border-right: 1px solid rgba(255, 255, 255, 0.06);
          }
          .ed-tab.active {
            background: #0f111a;
            color: #38bdf8;
            border-bottom: 2px solid #38bdf8;
          }
          .code-content {
            flex: 1;
            padding: 24px;
            font-family: Consolas, Monaco, "Courier New", monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #cbd5e1;
            overflow: hidden;
          }
          .code-kw { color: #f43f5e; }
          .code-tag { color: #38bdf8; }
          .code-attr { color: #f59e0b; }
          .code-str { color: #10b981; }
          .code-comment { color: #64748b; font-style: italic; }
          .download-floating-card {
            position: absolute;
            bottom: 60px;
            right: 60px;
            background: #1e293b;
            border: 1px solid #38bdf8;
            border-radius: 12px;
            padding: 18px 24px;
            display: flex;
            align-items: center;
            gap: 20px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.7);
          }
          .dl-icon { font-size: 32px; }
          .dl-text-title { font-size: 15px; font-weight: 700; color: #fff; }
          .dl-text-sub { font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="top-banner">
            <div class="banner-title">
              <span class="banner-tag">Feature 5</span>
              <span>Clean Code Export & Project Bundle</span>
            </div>
            <div class="banner-subtitle">
              Instant ZIP download with semantic HTML, scoped CSS, and pure vanilla JS ready to paste into React, Vue, or Webflow
            </div>
          </div>
          <div class="main-stage" style="position: relative;">
            <div class="sidebar-tree">
              <div class="tree-header">EXPLORER &bull; REPLICATED_BUNDLE</div>
              <div class="tree-item active">📄 index.html</div>
              <div class="tree-item">🎨 style.css</div>
              <div class="tree-item">⚡ script.js</div>
              <div class="tree-item">📁 assets/</div>
              <div class="tree-item" style="padding-left: 24px;">🖼️ hero-bg.webp</div>
              <div class="tree-item" style="padding-left: 24px;">✨ icon-feature.svg</div>
              <div class="tree-item" style="padding-left: 24px;">🔤 inter-latin.woff2</div>
            </div>
            <div class="editor-area">
              <div class="editor-tabs">
                <div class="ed-tab active">index.html</div>
                <div class="ed-tab">style.css</div>
                <div class="ed-tab">script.js</div>
              </div>
              <div class="code-content">
                <span class="code-comment">&lt;!-- Replicated with InventKid Page Replicator --&gt;</span><br>
                <span class="code-comment">&lt;!-- 100% Self-Contained &bull; Scoped CSS &bull; Vanilla JavaScript --&gt;</span><br><br>
                <span class="code-tag">&lt;section</span> <span class="code-attr">id=</span><span class="code-str">"replicated-hero"</span> <span class="code-attr">class=</span><span class="code-str">"c-hero-container"</span><span class="code-tag">&gt;</span><br>
                &nbsp;&nbsp;<span class="code-tag">&lt;div</span> <span class="code-attr">class=</span><span class="code-str">"c-hero-badge"</span><span class="code-tag">&gt;</span>Next Generation<span class="code-tag">&lt;/div&gt;</span><br>
                &nbsp;&nbsp;<span class="code-tag">&lt;h1</span> <span class="code-attr">class=</span><span class="code-str">"c-hero-heading"</span><span class="code-tag">&gt;</span>High Velocity Design Systems<span class="code-tag">&lt;/h1&gt;</span><br>
                &nbsp;&nbsp;<span class="code-tag">&lt;p</span> <span class="code-attr">class=</span><span class="code-str">"c-hero-paragraph"</span><span class="code-tag">&gt;</span>Engineered for performance with zero runtime overhead.<span class="code-tag">&lt;/p&gt;</span><br>
                &nbsp;&nbsp;<span class="code-tag">&lt;div</span> <span class="code-attr">class=</span><span class="code-str">"c-hero-action-group"</span><span class="code-tag">&gt;</span><br>
                &nbsp;&nbsp;&nbsp;&nbsp;<span class="code-tag">&lt;button</span> <span class="code-attr">class=</span><span class="code-str">"btn-primary"</span> <span class="code-attr">data-action=</span><span class="code-str">"launch"</span><span class="code-tag">&gt;</span>Explore System<span class="code-tag">&lt;/button&gt;</span><br>
                &nbsp;&nbsp;<span class="code-tag">&lt;/div&gt;</span><br>
                <span class="code-tag">&lt;/section&gt;</span>
              </div>
            </div>

            <div class="download-floating-card">
              <div class="dl-icon">📦</div>
              <div>
                <div class="dl-text-title">replicated-component.zip</div>
                <div class="dl-text-sub">Downloaded automatically &bull; Ready to use</div>
              </div>
              <button class="gradient-btn" style="padding: 8px 18px; border-radius: 8px; border: none; font-size: 13px;">Open ZIP</button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }
];

async function generateAll() {
  console.log('🚀 Launching Chromium to generate Chrome Web Store graphics...');
  const browser = await chromium.launch();

  for (const item of templates) {
    console.log(`📸 Generating: ${item.name} (${item.width}x${item.height})...`);
    const page = await browser.newPage({
      viewport: { width: item.width, height: item.height },
      deviceScaleFactor: 1
    });

    await page.setContent(item.html, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    const outPath = path.join(OUTPUT_DIR, item.name);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`   ✓ Saved: ${outPath}`);
    await page.close();
  }

  await browser.close();
  console.log('\n🎉 ALL CHROME WEB STORE GRAPHICS GENERATED SUCCESSFULLY!');
  console.log(`📁 Files available in: ${OUTPUT_DIR}`);
}

generateAll().catch(err => {
  console.error('Fatal error generating assets:', err);
  process.exit(1);
});
