(() => {
  "use strict";

  const COLS = 10;
  const ROWS = 20;

  const COLORS = {
    I: "#53d6ff",
    O: "#ffd166",
    T: "#c77dff",
    S: "#57e389",
    Z: "#ff6b6b",
    J: "#4d96ff",
    L: "#ff9f43",
    GHOST: "rgba(232, 236, 255, 0.18)",
    GRID: "rgba(232, 236, 255, 0.06)",
  };

  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  };

  const ui = {
    stage: document.getElementById("stage"),
    board: document.getElementById("board"),
    hold: document.getElementById("hold"),
    next: document.getElementById("next"),
    overlay: document.getElementById("overlay"),
    overlayTitle: document.getElementById("overlayTitle"),
    overlayHint: document.getElementById("overlayHint"),
    score: document.getElementById("score"),
    lines: document.getElementById("lines"),
    level: document.getElementById("level"),
    pauseBtn: document.getElementById("pauseBtn"),
    restartBtn: document.getElementById("restartBtn"),
    soundBtn: document.getElementById("soundBtn"),
    helpBtn: document.getElementById("helpBtn"),
    mobileControls: document.getElementById("mobileControls"),
  };

  const ctx = ui.board.getContext("2d", { alpha: false });

  let cell = 24;
  let boardW = 0;
  let boardH = 0;

  function setupCanvas(canvas, cssWidth, cssHeight) {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    const c = canvas.getContext("2d", { alpha: false });
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    return c;
  }

  function resize() {
    const maxBoardWidth = 420;
    const sideMin = 170;
    const padding = 28;
    const gap = 12;

    const available = Math.max(
      260,
      Math.min(maxBoardWidth, ui.stage.clientWidth - padding - sideMin - gap),
    );
    const cssBoardWidth =
      ui.stage.clientWidth < 700 ? Math.min(maxBoardWidth, ui.stage.clientWidth - padding) : available;
    const cssBoardHeight = Math.floor(cssBoardWidth * (ROWS / COLS));

    setupCanvas(ui.board, cssBoardWidth, cssBoardHeight);
    boardW = cssBoardWidth;
    boardH = cssBoardHeight;
    cell = Math.floor(cssBoardWidth / COLS);

    const cssSmall =
      ui.stage.clientWidth < 700 ? Math.floor((ui.stage.clientWidth - padding - gap) / 2) : sideMin;
    setupCanvas(ui.hold, cssSmall, Math.floor(cssSmall * 0.8));
    setupCanvas(ui.next, cssSmall, Math.floor(cssSmall * 1.6));

    draw();
  }

  window.addEventListener("resize", resize);

  const audio = {
    enabled: true,
    ctx: null,
    master: null,
  };

  function initAudio() {
    if (!audio.enabled) return;
    if (audio.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audio.ctx = new AudioContext();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.12;
    audio.master.connect(audio.ctx.destination);
  }

  function beep(freq, duration = 0.06, type = "square") {
    if (!audio.enabled) return;
    if (!audio.ctx) return;
    const t0 = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(1.0, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  function sfx(name) {
    switch (name) {
      case "move":
        return beep(220, 0.03, "square");
      case "rotate":
        return beep(330, 0.04, "triangle");
      case "hold":
        beep(294, 0.05, "triangle");
        return beep(220, 0.05, "triangle");
      case "lock":
        return beep(110, 0.04, "sawtooth");
      case "line1":
        return beep(523, 0.06, "triangle");
      case "line2":
        beep(523, 0.06, "triangle");
        return beep(659, 0.06, "triangle");
      case "line3":
        beep(523, 0.06, "triangle");
        beep(659, 0.06, "triangle");
        return beep(784, 0.07, "triangle");
      case "line4":
        beep(523, 0.07, "triangle");
        beep(659, 0.07, "triangle");
        beep(784, 0.07, "triangle");
        return beep(1046, 0.08, "triangle");
      case "gameover":
        beep(220, 0.12, "sawtooth");
        return beep(110, 0.18, "sawtooth");
      case "start":
        beep(659, 0.06, "triangle");
        return beep(784, 0.07, "triangle");
    }
  }

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function rotateMatrix(matrix, dir) {
    const N = matrix.length;
    const out = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (dir > 0) out[x][N - 1 - y] = matrix[y][x];
        else out[N - 1 - x][y] = matrix[y][x];
      }
    }
    return out;
  }

  function createEmptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function makeBag() {
    const pieces = ["I", "O", "T", "S", "Z", "J", "L"];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
  }

  function createPiece(type) {
    const base = SHAPES[type];
    const matrix = cloneMatrix(base);
    const N = Math.max(matrix.length, matrix[0].length);
    const out = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) out[y][x] = matrix[y][x];
    }
    return { type, matrix: out, x: 0, y: 0 };
  }

  const state = {
    grid: createEmptyGrid(),
    current: null,
    nextQueue: [],
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 0,
    dropInterval: 1000,
    paused: false,
    gameOver: false,
    lastTime: 0,
    dropCounter: 0,
  };

  function ensureNext(n = 7) {
    while (state.nextQueue.length < n) state.nextQueue.push(...makeBag());
  }

  function updateStats() {
    ui.score.textContent = state.score.toString();
    ui.lines.textContent = state.lines.toString();
    ui.level.textContent = state.level.toString();
  }

  function showOverlay(title, hint, visible = true) {
    ui.overlayTitle.textContent = title;
    ui.overlayHint.innerHTML = hint;
    ui.overlay.style.display = visible ? "grid" : "none";
    ui.overlay.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function setPaused(p) {
    if (state.gameOver) return;
    state.paused = p;
    ui.pauseBtn.textContent = state.paused ? "Resume" : "Pause";
    if (state.paused) {
      showOverlay("Paused", "재개: <span class='kbd'>P</span> 또는 버튼", true);
    } else {
      showOverlay("", "", false);
    }
  }

  function collide(grid, piece) {
    const m = piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const px = piece.x + x;
        const py = piece.y + y;
        if (px < 0 || px >= COLS) return true;
        if (py >= ROWS) return true;
        if (py >= 0 && grid[py][px]) return true;
      }
    }
    return false;
  }

  function merge(grid, piece) {
    const m = piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const gx = piece.x + x;
        const gy = piece.y + y;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) grid[gy][gx] = piece.type;
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; ) {
      if (state.grid[y].every((c) => c)) {
        state.grid.splice(y, 1);
        state.grid.unshift(Array(COLS).fill(null));
        cleared++;
      } else {
        y--;
      }
    }
    if (!cleared) return 0;

    state.lines += cleared;
    const linePoints = [0, 100, 300, 500, 800];
    state.score += linePoints[cleared] * (state.level + 1);

    const nextLevel = Math.floor(state.lines / 10);
    if (nextLevel !== state.level) {
      state.level = nextLevel;
      state.dropInterval = Math.max(90, 1000 - state.level * 85);
    }

    updateStats();
    sfx(cleared === 4 ? "line4" : cleared === 3 ? "line3" : cleared === 2 ? "line2" : "line1");
    return cleared;
  }

  function spawn() {
    ensureNext(14);
    const type = state.nextQueue.shift();
    const p = createPiece(type);
    p.y = -2;
    p.x = Math.floor(COLS / 2 - p.matrix.length / 2);
    state.current = p;
    state.canHold = true;
    if (collide(state.grid, p)) {
      state.gameOver = true;
      showOverlay("Game Over", "재시작: <span class='kbd'>R</span> 또는 Restart", true);
      sfx("gameover");
    }
  }

  function resetGame() {
    state.grid = createEmptyGrid();
    state.current = null;
    state.nextQueue = [];
    state.hold = null;
    state.canHold = true;
    state.score = 0;
    state.lines = 0;
    state.level = 0;
    state.dropInterval = 1000;
    state.paused = false;
    state.gameOver = false;
    state.dropCounter = 0;
    state.lastTime = performance.now();
    ensureNext(14);
    spawn();
    updateStats();
    ui.pauseBtn.textContent = "Pause";
    showOverlay("", "", false);
    sfx("start");
  }

  function tryMove(dx, dy) {
    if (!state.current || state.paused || state.gameOver) return false;
    state.current.x += dx;
    state.current.y += dy;
    if (collide(state.grid, state.current)) {
      state.current.x -= dx;
      state.current.y -= dy;
      return false;
    }
    if (dx !== 0) sfx("move");
    return true;
  }

  function rotate(dir) {
    if (!state.current || state.paused || state.gameOver) return;
    const p = state.current;
    const rotated = rotateMatrix(p.matrix, dir);
    const kicks = [0, -1, 1, -2, 2];
    const ox = p.x;
    const oy = p.y;
    p.matrix = rotated;
    for (const k of kicks) {
      p.x = ox + k;
      p.y = oy;
      if (!collide(state.grid, p)) {
        sfx("rotate");
        return;
      }
      p.y = oy - 1;
      if (!collide(state.grid, p)) {
        sfx("rotate");
        return;
      }
    }
    p.matrix = rotateMatrix(p.matrix, -dir);
    p.x = ox;
    p.y = oy;
  }

  function lock() {
    merge(state.grid, state.current);
    sfx("lock");
    clearLines();
    spawn();
  }

  function softDrop(oneStep = false, awardPoints = false) {
    if (!state.current || state.paused || state.gameOver) return;
    const moved = tryMove(0, 1);
    if (moved) {
      if (awardPoints) {
        state.score += 1;
        updateStats();
      }
      if (oneStep) return;
    } else {
      lock();
    }
  }

  function hardDrop() {
    if (!state.current || state.paused || state.gameOver) return;
    let dropped = 0;
    while (tryMove(0, 1)) dropped++;
    if (dropped) {
      state.score += dropped * 2;
      updateStats();
    }
    lock();
  }

  function hold() {
    if (!state.current || state.paused || state.gameOver) return;
    if (!state.canHold) return;
    const currentType = state.current.type;
    if (!state.hold) {
      state.hold = currentType;
      spawn();
    } else {
      const swapType = state.hold;
      state.hold = currentType;
      const p = createPiece(swapType);
      p.y = -2;
      p.x = Math.floor(COLS / 2 - p.matrix.length / 2);
      state.current = p;
      if (collide(state.grid, p)) {
        state.gameOver = true;
        showOverlay("Game Over", "재시작: <span class='kbd'>R</span> 또는 Restart", true);
        sfx("gameover");
      }
    }
    state.canHold = false;
    sfx("hold");
  }

  function getGhostY(piece) {
    const ghost = { ...piece, matrix: piece.matrix };
    while (!collide(state.grid, ghost)) ghost.y++;
    return ghost.y - 1;
  }

  function roundRect(ctx2d, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx2d.beginPath();
    ctx2d.moveTo(x + rr, y);
    ctx2d.arcTo(x + w, y, x + w, y + h, rr);
    ctx2d.arcTo(x + w, y + h, x, y + h, rr);
    ctx2d.arcTo(x, y + h, x, y, rr);
    ctx2d.arcTo(x, y, x + w, y, rr);
    ctx2d.closePath();
  }

  function drawCell(ctx2d, x, y, color, alpha = 1) {
    const px = x * cell;
    const py = y * cell;
    const pad = 1;
    const w = cell - pad * 2;
    const h = cell - pad * 2;
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    roundRect(ctx2d, px + pad, py + pad, w, h, Math.max(3, Math.floor(cell * 0.18)));
    ctx2d.fillStyle = color;
    ctx2d.fill();
    ctx2d.globalAlpha = alpha * 0.22;
    ctx2d.strokeStyle = "rgba(255,255,255,0.85)";
    ctx2d.lineWidth = 1;
    ctx2d.stroke();
    ctx2d.restore();
  }

  function drawGridLines() {
    ctx.save();
    ctx.clearRect(0, 0, boardW, boardH);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, boardW, boardH);
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, ROWS * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(COLS * cell, y * cell + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPiece(ctx2d, piece, colorOverride = null, alpha = 1, offsetX = 0, offsetY = 0) {
    const m = piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const gx = piece.x + x + offsetX;
        const gy = piece.y + y + offsetY;
        if (gy < 0) continue;
        drawCell(ctx2d, gx, gy, colorOverride || COLORS[piece.type], alpha);
      }
    }
  }

  function drawMini(ctx2d, type, canvasCssW, canvasCssH, cellSize) {
    ctx2d.clearRect(0, 0, canvasCssW, canvasCssH);
    ctx2d.fillStyle = "rgba(0,0,0,0.22)";
    ctx2d.fillRect(0, 0, canvasCssW, canvasCssH);
    if (!type) return;

    const base = createPiece(type);
    const used = [];
    for (let y = 0; y < base.matrix.length; y++) {
      for (let x = 0; x < base.matrix.length; x++) if (base.matrix[y][x]) used.push([x, y]);
    }
    const minX = Math.min(...used.map((p) => p[0]));
    const maxX = Math.max(...used.map((p) => p[0]));
    const minY = Math.min(...used.map((p) => p[1]));
    const maxY = Math.max(...used.map((p) => p[1]));
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    const ox = Math.floor(canvasCssW / cellSize / 2 - bw / 2) - minX;
    const oy = Math.floor(canvasCssH / cellSize / 2 - bh / 2) - minY;

    const saved = cell;
    cell = cellSize;
    base.x = ox;
    base.y = oy;
    drawPiece(ctx2d, base, COLORS[type], 1);
    cell = saved;
  }

  function drawHold() {
    const cssW = parseFloat(ui.hold.style.width);
    const cssH = parseFloat(ui.hold.style.height);
    const c = ui.hold.getContext("2d", { alpha: false });
    const cellSize = Math.max(10, Math.floor(Math.min(cssW / 6, cssH / 6)));
    drawMini(c, state.hold, cssW, cssH, cellSize);
  }

  function drawNext() {
    const cssW = parseFloat(ui.next.style.width);
    const cssH = parseFloat(ui.next.style.height);
    const c = ui.next.getContext("2d", { alpha: false });
    c.clearRect(0, 0, cssW, cssH);
    c.fillStyle = "rgba(0,0,0,0.22)";
    c.fillRect(0, 0, cssW, cssH);

    const preview = state.nextQueue.slice(0, 5);
    const cellSize = Math.max(10, Math.floor(Math.min(cssW / 6, cssH / 14)));
    const gap = Math.floor(cellSize * 0.6);
    let y = gap;

    for (const t of preview) {
      const tmp = createPiece(t);
      const used = [];
      for (let yy = 0; yy < tmp.matrix.length; yy++) {
        for (let xx = 0; xx < tmp.matrix.length; xx++) if (tmp.matrix[yy][xx]) used.push([xx, yy]);
      }
      const minX = Math.min(...used.map((p) => p[0]));
      const maxX = Math.max(...used.map((p) => p[0]));
      const minY = Math.min(...used.map((p) => p[1]));
      const maxY = Math.max(...used.map((p) => p[1]));
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const ox = Math.floor(cssW / cellSize / 2 - bw / 2) - minX;
      const oy = Math.floor(y / cellSize) - minY;

      const saved = cell;
      cell = cellSize;
      tmp.x = ox;
      tmp.y = oy;
      drawPiece(c, tmp, COLORS[t], 1);
      cell = saved;
      y += bh * cellSize + gap;
    }
  }

  function draw() {
    if (!boardW || !boardH) return;
    drawGridLines();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = state.grid[y][x];
        if (!t) continue;
        drawCell(ctx, x, y, COLORS[t], 1);
      }
    }

    if (state.current && !state.gameOver) {
      const gy = getGhostY(state.current);
      const ghost = { ...state.current, y: gy };
      drawPiece(ctx, ghost, COLORS.GHOST, 1);
      drawPiece(ctx, state.current, null, 1);
    }

    drawHold();
    drawNext();
  }

  function step(time) {
    const dt = time - state.lastTime;
    state.lastTime = time;

    if (!state.paused && !state.gameOver) {
      state.dropCounter += dt;
      if (state.dropCounter >= state.dropInterval) {
        state.dropCounter = 0;
        softDrop(true, false);
      }
    }

    draw();
    requestAnimationFrame(step);
  }

  function onAnyUserGesture() {
    initAudio();
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume().catch(() => {});
    if (!state.paused && !state.gameOver) showOverlay("", "", false);
  }

  window.addEventListener("pointerdown", onAnyUserGesture, { capture: true, once: true });
  window.addEventListener("keydown", onAnyUserGesture, { capture: true, once: true });

  function handleKey(e) {
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Spacebar"].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    const k = e.key;
    if (k === "p" || k === "P") return setPaused(!state.paused);
    if (k === "r" || k === "R") return resetGame();
    if (state.paused || state.gameOver) return;
    if (k === "ArrowLeft") return tryMove(-1, 0);
    if (k === "ArrowRight") return tryMove(1, 0);
    if (k === "ArrowDown") return softDrop(true, true);
    if (k === "ArrowUp") return rotate(1);
    if (k === "z" || k === "Z") return rotate(-1);
    if (k === "x" || k === "X") return rotate(1);
    if (k === "c" || k === "C") return hold();
    if (k === " " || k === "Spacebar") return hardDrop();
  }

  window.addEventListener("keydown", handleKey, { passive: false });

  ui.pauseBtn.addEventListener("click", () => setPaused(!state.paused));
  ui.restartBtn.addEventListener("click", () => resetGame());

  ui.soundBtn.addEventListener("click", () => {
    audio.enabled = !audio.enabled;
    ui.soundBtn.textContent = `Sound: ${audio.enabled ? "On" : "Off"}`;
    if (!audio.enabled) return;
    initAudio();
    sfx("start");
  });

  ui.helpBtn.addEventListener("click", () => {
    const visible = ui.overlay.style.display !== "none";
    if (visible && !state.paused && !state.gameOver) return showOverlay("", "", false);
    showOverlay(
      "Controls",
      "←/→ 이동 · ↓ 소프트드롭 · ↑/Z/X 회전 · Space 하드드롭 · C 홀드 · P 일시정지<br />모바일: 버튼 또는 보드 탭/스와이프",
      true,
    );
  });

  function makeRepeater(fn, delay = 140) {
    let t = null;
    return {
      start() {
        if (t) return;
        fn();
        t = setInterval(fn, delay);
      },
      stop() {
        if (!t) return;
        clearInterval(t);
        t = null;
      },
    };
  }

  const repeaters = {
    left: makeRepeater(() => tryMove(-1, 0), 110),
    right: makeRepeater(() => tryMove(1, 0), 110),
    down: makeRepeater(() => softDrop(true, true), 70),
  };

  function doAction(action) {
    if (action === "left") return tryMove(-1, 0);
    if (action === "right") return tryMove(1, 0);
    if (action === "down") return softDrop(true, true);
    if (action === "rotate") return rotate(1);
    if (action === "hardDrop") return hardDrop();
    if (action === "hold") return hold();
  }

  ui.mobileControls.addEventListener(
    "pointerdown",
    (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      e.preventDefault();
      const action = btn.dataset.action;
      if (repeaters[action]) {
        repeaters[action].start();
        const stop = () => repeaters[action].stop();
        btn.setPointerCapture(e.pointerId);
        btn.addEventListener("pointerup", stop, { once: true });
        btn.addEventListener("pointercancel", stop, { once: true });
        btn.addEventListener("pointerleave", stop, { once: true });
      } else {
        doAction(action);
      }
    },
    { passive: false },
  );

  let pointer = null;
  ui.board.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      ui.board.setPointerCapture(e.pointerId);
    },
    { passive: false },
  );
  ui.board.addEventListener(
    "pointerup",
    (e) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      e.preventDefault();
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      const dt = performance.now() - pointer.t;
      pointer = null;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 12 && absY < 12 && dt < 300) return rotate(1);

      if (absY > absX) {
        if (dy > 60) return hardDrop();
        if (dy > 20) return softDrop(true, true);
        return;
      }
      if (dx > 25) return tryMove(1, 0);
      if (dx < -25) return tryMove(-1, 0);
    },
    { passive: false },
  );

  // Boot
  resize();
  resetGame();
  showOverlay(
    "Ready",
    "키보드: ← → ↓ ↑, Space, C, P<br />모바일: 버튼 / 보드 탭(회전) · 아래로 스와이프(하드드롭)",
    true,
  );
  requestAnimationFrame((t) => {
    state.lastTime = t;
    requestAnimationFrame(step);
  });
})();
