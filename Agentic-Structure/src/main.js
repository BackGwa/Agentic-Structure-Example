import { TetrisGame } from "./game.js";
import { Renderer } from "./render.js";
import { InputController } from "./input.js";
import { Sfx } from "./audio.js";

function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

function setPressed(button, pressed) {
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

const gameCanvas = $("#gameCanvas");
const holdCanvas = $("#holdCanvas");
const nextCanvas = $("#nextCanvas");
const overlay = $("#overlay");

const scoreEl = $("#score");
const levelEl = $("#level");
const linesEl = $("#lines");

const pauseBtn = $("#pauseBtn");
const restartBtn = $("#restartBtn");
const muteBtn = $("#muteBtn");

const sfx = new Sfx();
let muted = false;

function updateStats(snapshot) {
  scoreEl.textContent = formatNumber(snapshot.score);
  levelEl.textContent = String(snapshot.level);
  linesEl.textContent = String(snapshot.lines);
}

function showOverlay(message) {
  overlay.textContent = message;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
  overlay.textContent = "";
}

const game = new TetrisGame({
  onEvent: (event) => {
    if (event.type === "pause" || event.type === "resume") sfx.play(event.type);
    else if (event.type === "move") sfx.play("move");
    else if (event.type === "rotate") sfx.play("rotate");
    else if (event.type === "softDrop") sfx.play("softDrop");
    else if (event.type === "hardDrop") sfx.play("hardDrop");
    else if (event.type === "hold") sfx.play("hold");
    else if (event.type === "lock") sfx.play("lock");
    else if (event.type === "clear") sfx.play("clear", event);
    else if (event.type === "gameOver") sfx.play("gameOver");
  },
});

const renderer = new Renderer({ gameCanvas, holdCanvas, nextCanvas });

function syncUI() {
  const snapshot = game.getSnapshot();
  updateStats(snapshot);

  if (snapshot.isGameOver) {
    showOverlay("게임 오버\nR 또는 재시작");
  } else if (snapshot.isPaused) {
    showOverlay("일시정지\nP 또는 ⏸");
  } else {
    hideOverlay();
  }

  setPressed(pauseBtn, snapshot.isPaused);
  setPressed(muteBtn, muted);
  renderer.render(snapshot);
}

function restart() {
  game.reset();
  syncUI();
}

function toggleMute() {
  muted = !muted;
  sfx.setMuted(muted);
  setPressed(muteBtn, muted);
}

pauseBtn.addEventListener("click", async () => {
  await sfx.unlock();
  game.togglePaused();
  syncUI();
});

restartBtn.addEventListener("click", async () => {
  await sfx.unlock();
  restart();
});

muteBtn.addEventListener("click", async () => {
  await sfx.unlock();
  toggleMute();
});

const input = new InputController({
  onFirstGesture: async () => {
    await sfx.unlock();
  },
  onAction: (action) => {
    if (action === "restart") {
      restart();
      return;
    }
    if (action === "mute") {
      toggleMute();
      return;
    }

    game.action(action);

    // Render immediately for responsiveness.
    syncUI();
  },
});

input.attach();
input.attachTouchButtons(document.querySelector(".controls"));

let lastTs = performance.now();

function frame(ts) {
  const deltaMs = Math.min(50, ts - lastTs);
  lastTs = ts;
  game.tick(deltaMs);
  syncUI();
  requestAnimationFrame(frame);
}

syncUI();
requestAnimationFrame(frame);
