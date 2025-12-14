import { BOARD_HEIGHT, BOARD_WIDTH, HIDDEN_ROWS, SHAPES, getKickOffsets } from "./constants.js";
import { BagRandomizer } from "./random.js";

function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT + HIDDEN_ROWS }, () => Array(BOARD_WIDTH).fill(null));
}

function eachCell(matrix, callback) {
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (matrix[row][col]) callback(row, col);
    }
  }
}

function scoreForLinesCleared(lines) {
  if (lines === 1) return 100;
  if (lines === 2) return 300;
  if (lines === 3) return 500;
  if (lines === 4) return 800;
  return 0;
}

function fallIntervalMs(level) {
  // Starts comfortable for mobile. Lower interval => faster.
  const clamped = Math.max(1, Math.min(20, level));
  return Math.max(70, 800 - (clamped - 1) * 45);
}

export class TetrisGame {
  constructor({ onEvent } = {}) {
    this.onEvent = onEvent ?? (() => {});
    this.randomizer = new BagRandomizer();
    this.reset();
  }

  reset() {
    this.board = createEmptyBoard();
    this.isGameOver = false;
    this.isPaused = false;
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = -1;

    this.holdType = null;
    this.canHold = true;

    this.queue = [];
    while (this.queue.length < 5) this.queue.push(this.randomizer.next());

    this.active = null;
    this.lockMs = 0;
    this.dropMs = 0;
    this.spawnNext();
  }

  getFallIntervalMs() {
    return fallIntervalMs(this.level);
  }

  getSnapshot() {
    return {
      board: this.board,
      active: this.active,
      ghostY: this.getGhostY(),
      holdType: this.holdType,
      queue: this.queue.slice(),
      isGameOver: this.isGameOver,
      isPaused: this.isPaused,
      score: this.score,
      level: this.level,
      lines: this.lines,
    };
  }

  setPaused(paused) {
    if (this.isGameOver) return;
    if (this.isPaused === paused) return false;
    this.isPaused = paused;
    this.onEvent({ type: paused ? "pause" : "resume" });
    return true;
  }

  togglePaused() {
    return this.setPaused(!this.isPaused);
  }

  spawnNext() {
    const type = this.queue.shift();
    this.queue.push(this.randomizer.next());
    this.active = {
      type,
      rotation: 0,
      x: Math.floor(BOARD_WIDTH / 2) - 2,
      y: 0,
    };
    this.canHold = true;
    this.lockMs = 0;
    this.dropMs = 0;

    if (this.collides(this.active.x, this.active.y, this.active.rotation)) {
      this.isGameOver = true;
      this.onEvent({ type: "gameOver" });
    } else {
      this.onEvent({ type: "spawn" });
    }
  }

  getActiveMatrix(rotation = this.active.rotation) {
    return SHAPES[this.active.type][rotation];
  }

  collides(x, y, rotation) {
    const matrix = SHAPES[this.active.type][rotation];
    let collision = false;
    eachCell(matrix, (row, col) => {
      const boardX = x + col;
      const boardY = y + row;
      if (boardX < 0 || boardX >= BOARD_WIDTH) {
        collision = true;
        return;
      }
      if (boardY >= BOARD_HEIGHT + HIDDEN_ROWS) {
        collision = true;
        return;
      }
      if (boardY >= 0 && this.board[boardY][boardX] != null) {
        collision = true;
      }
    });
    return collision;
  }

  tryMove(dx, dy) {
    if (!this.active || this.isPaused || this.isGameOver) return false;
    const targetX = this.active.x + dx;
    const targetY = this.active.y + dy;
    if (this.collides(targetX, targetY, this.active.rotation)) return false;
    this.active.x = targetX;
    this.active.y = targetY;
    this.lockMs = 0;
    if (dx !== 0) this.onEvent({ type: "move" });
    return true;
  }

  tryRotate(direction) {
    if (!this.active || this.isPaused || this.isGameOver) return false;
    const fromR = this.active.rotation;
    const toR = (fromR + (direction === "cw" ? 1 : 3)) % 4;
    const kicks = getKickOffsets(this.active.type, fromR, toR);
    for (const [kx, ky] of kicks) {
      const targetX = this.active.x + kx;
      const targetY = this.active.y - ky;
      if (!this.collides(targetX, targetY, toR)) {
        this.active.rotation = toR;
        this.active.x = targetX;
        this.active.y = targetY;
        this.lockMs = 0;
        this.onEvent({ type: "rotate" });
        return true;
      }
    }
    return false;
  }

  hold() {
    if (!this.active || this.isPaused || this.isGameOver) return false;
    if (!this.canHold) return false;
    const currentType = this.active.type;
    if (this.holdType == null) {
      this.holdType = currentType;
      this.spawnNext();
    } else {
      this.active = {
        type: this.holdType,
        rotation: 0,
        x: Math.floor(BOARD_WIDTH / 2) - 2,
        y: 0,
      };
      this.holdType = currentType;
      if (this.collides(this.active.x, this.active.y, this.active.rotation)) {
        this.isGameOver = true;
        this.onEvent({ type: "gameOver" });
      } else {
        this.onEvent({ type: "holdSwap" });
      }
    }
    this.canHold = false;
    this.lockMs = 0;
    this.dropMs = 0;
    this.onEvent({ type: "hold" });
    return true;
  }

  hardDrop() {
    if (!this.active || this.isPaused || this.isGameOver) return 0;
    const startY = this.active.y;
    this.active.y = this.getGhostY();
    const distance = Math.max(0, this.active.y - startY);
    if (distance > 0) {
      this.score += distance * 2;
      this.onEvent({ type: "hardDrop", distance });
    }
    this.lockPiece();
    return distance;
  }

  softDropStep() {
    if (!this.active || this.isPaused || this.isGameOver) return false;
    const moved = this.tryMove(0, 1);
    if (moved) {
      this.score += 1;
      this.onEvent({ type: "softDrop" });
      return true;
    }
    return false;
  }

  getGhostY() {
    if (!this.active) return 0;
    let testY = this.active.y;
    while (!this.collides(this.active.x, testY + 1, this.active.rotation)) {
      testY += 1;
    }
    return testY;
  }

  lockPiece() {
    if (!this.active) return;
    const { type, x, y, rotation } = this.active;
    const matrix = SHAPES[type][rotation];
    eachCell(matrix, (row, col) => {
      const boardX = x + col;
      const boardY = y + row;
      if (boardY >= 0 && boardY < BOARD_HEIGHT + HIDDEN_ROWS) {
        this.board[boardY][boardX] = type;
      }
    });
    this.onEvent({ type: "lock" });
    this.clearLinesAndScore();
    this.spawnNext();
  }

  clearLinesAndScore() {
    const top = HIDDEN_ROWS;
    let cleared = 0;
    for (let row = this.board.length - 1; row >= top; row -= 1) {
      if (this.board[row].every((cell) => cell != null)) {
        this.board.splice(row, 1);
        this.board.unshift(Array(BOARD_WIDTH).fill(null));
        cleared += 1;
        row += 1;
      }
    }

    if (cleared === 0) {
      this.combo = -1;
      return;
    }

    this.combo += 1;
    const base = scoreForLinesCleared(cleared);
    this.score += base * this.level;
    if (this.combo > 0) {
      this.score += 50 * this.combo * this.level;
    }

    this.lines += cleared;
    this.level = Math.floor(this.lines / 10) + 1;
    this.onEvent({ type: "clear", lines: cleared, combo: this.combo });
  }

  tick(deltaMs) {
    if (!this.active || this.isPaused || this.isGameOver) return;
    const interval = this.getFallIntervalMs();
    this.dropMs += deltaMs;

    while (this.dropMs >= interval) {
      this.dropMs -= interval;
      if (!this.tryMove(0, 1)) {
        break;
      }
    }

    const grounded = this.collides(this.active.x, this.active.y + 1, this.active.rotation);
    if (!grounded) {
      this.lockMs = 0;
      return;
    }

    this.lockMs += deltaMs;
    if (this.lockMs >= 500) {
      this.lockPiece();
    }
  }

  // Convenience input mapping
  action(name) {
    if (name === "left") return this.tryMove(-1, 0);
    if (name === "right") return this.tryMove(1, 0);
    if (name === "down") return this.softDropStep();
    if (name === "hardDrop") return this.hardDrop();
    if (name === "rotCW") return this.tryRotate("cw");
    if (name === "rotCCW") return this.tryRotate("ccw");
    if (name === "hold") return this.hold();
    if (name === "pause") return this.togglePaused();
    return false;
  }
}
