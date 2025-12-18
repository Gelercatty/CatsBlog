// source/js/tri-three.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";

function mountTri(container) {
  if (container.__triCleanup) container.__triCleanup();

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.01,
    100
  );
  camera.position.set(0, 0, 2.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // --- 三角形轮廓：LineLoop（只画线，不填充） ---
  const base = new Float32Array([
    -0.8, -0.45, 0,
     0.8, -0.45, 0,
     0.0,  0.85, 0,
  ]);
  const positions = new Float32Array(base);

  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute("position", posAttr);

  const material = new THREE.LineBasicMaterial({ color: 0x000000 });
  const tri = new THREE.LineLoop(geometry, material);
  scene.add(tri);

  // --- 亮/暗判断：优先看主题标记，不行就用背景色亮度兜底 ---
  function isDarkMode() {
    const de = document.documentElement;

    // 常见暗黑标记（redefine/其他主题可能会用这些）
    const cls = de.className || "";
    const dt = de.getAttribute("data-theme") || de.getAttribute("theme") || "";
    if (/\bdark\b/i.test(cls) || /\bdark\b/i.test(dt)) return true;

    // 兜底：用 body 背景色亮度判断
    const bg = getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
    // 相对亮度（阈值你也可以改，比如 140）
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum < 140;
  }

  function applyThemeLook() {
    const dark = isDarkMode();

    // 线条：暗黑=白；亮色=黑
    material.color.setHex(dark ? 0xffffff : 0x000000);

    // 发光：用 canvas 的 drop-shadow 做“微弱光晕”
    // 白光/黑光（本质是阴影颜色），数值可微调
    renderer.domElement.style.filter = dark
      ? "drop-shadow(0 0 10px rgba(255,255,255,0.35)) drop-shadow(0 0 22px rgba(255,255,255,0.18))"
      : "drop-shadow(0 0 10px rgba(0,0,0,0.25)) drop-shadow(0 0 22px rgba(0,0,0,0.12))";
  }
let lastDark = isDarkMode();
let lastThemeCheck = 0;
  applyThemeLook();

  // 监听主题切换（class / data-theme 变化就重新应用）
  const mo = new MutationObserver(() => applyThemeLook());
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "theme", "style"],
  });
  mo.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "theme", "style"],
  });

  let rafId = 0;

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate(t) {
    const time = t * 0.001;

    if (time - lastThemeCheck > 0.2) {
        lastThemeCheck = time;
        const nowDark = isDarkMode();
        if (nowDark !== lastDark) {
        lastDark = nowDark;
        applyThemeLook();
        }
    }

    for (let i = 0; i < 3; i++) {
      const k = i * 3;
      positions[k]     = base[k]     + 0.20 * Math.sin(time * 1.7 + i * 2.0);
      positions[k + 1] = base[k + 1] + 0.20 * Math.cos(time * 1.3 + i * 2.6);
      positions[k + 2] = base[k + 2] + 0.25 * Math.sin(time * 1.1 + i * 3.1);
    }
    posAttr.needsUpdate = true;

    tri.rotation.z = time * 0.35;
    tri.rotation.x = Math.sin(time * 0.4) * 0.25;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }

  const onResize = () => resize();
  window.addEventListener("resize", onResize);

  resize();
  rafId = requestAnimationFrame(animate);

  container.__triCleanup = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    mo.disconnect();

    geometry.dispose();
    material.dispose();
    renderer.dispose();

    if (renderer.domElement && renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
    container.__triCleanup = null;
  };
}

function boot() {
  const el = document.getElementById("tri-demo");
  if (!el) return;
  mountTri(el);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

document.addEventListener("pjax:complete", boot);
document.addEventListener("swup:contentReplaced", boot);
document.addEventListener("swup:pageView", boot);
