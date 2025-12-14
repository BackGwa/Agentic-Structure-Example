import { BOARD_HEIGHT, BOARD_WIDTH, COLORS, GHOST_ALPHA, HIDDEN_ROWS, SHAPES } from "./constants.js";

function resizeCanvasToDisplaySize(canvas, context) {
  const dpr = Math.max(1, window.devicePixelRatio ?? 1);
  const displayWidth = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const displayHeight = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = false;
}

function drawGrid(context, widthPx, heightPx, cellSize) {
  context.fillStyle = "#0a1022";
  context.fillRect(0, 0, widthPx, heightPx);

  context.strokeStyle = COLORS.grid;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x <= BOARD_WIDTH; x += 1) {
    context.moveTo(x * cellSize + 0.5, 0);
    context.lineTo(x * cellSize + 0.5, heightPx);
  }
  for (let y = 0; y <= BOARD_HEIGHT; y += 1) {
    context.moveTo(0, y * cellSize + 0.5);
    context.lineTo(widthPx, y * cellSize + 0.5);
  }
  context.stroke();
}

function drawCell(context, x, y, cellSize, color, alpha = 1) {
  const padding = Math.max(1, Math.round(cellSize * 0.06));
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x + padding, y + padding, cellSize - padding * 2, cellSize - padding * 2);
  context.globalAlpha = 1;
}

function eachPieceCell(type, rotation, callback) {
  const matrix = SHAPES[type][rotation];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (matrix[row][col]) callback(row, col);
    }
  }
}

function drawMiniPiece(context, { type, rotation = 0, sizePx, offsetX, offsetY, cellSize }) {
  const matrix = SHAPES[type][rotation];
  context.fillStyle = "rgba(0,0,0,0.25)";
  context.fillRect(offsetX, offsetY, sizePx, sizePx);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (!matrix[row][col]) continue;
      const x = offsetX + col * cellSize;
      const y = offsetY + row * cellSize;
      context.fillStyle = COLORS[type];
      context.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    }
  }
}

export class Renderer {
  constructor({ gameCanvas, holdCanvas, nextCanvas }) {
    this.gameCanvas = gameCanvas;
    this.holdCanvas = holdCanvas;
    this.nextCanvas = nextCanvas;

    this.gameCtx = gameCanvas.getContext("2d", { alpha: false });
    this.holdCtx = holdCanvas.getContext("2d", { alpha: false });
    this.nextCtx = nextCanvas.getContext("2d", { alpha: false });
  }

  render(snapshot) {
    resizeCanvasToDisplaySize(this.gameCanvas, this.gameCtx);
    resizeCanvasToDisplaySize(this.holdCanvas, this.holdCtx);
    resizeCanvasToDisplaySize(this.nextCanvas, this.nextCtx);
    this.renderBoard(snapshot);
    this.renderHold(snapshot);
    this.renderNext(snapshot);
  }

  renderBoard(snapshot) {
    const widthPx = this.gameCanvas.clientWidth;
    const heightPx = this.gameCanvas.clientHeight;
    const cellSize = Math.min(widthPx / BOARD_WIDTH, heightPx / BOARD_HEIGHT);
    drawGrid(this.gameCtx, widthPx, heightPx, cellSize);

    for (let row = HIDDEN_ROWS; row < snapshot.board.length; row += 1) {
      for (let col = 0; col < BOARD_WIDTH; col += 1) {
        const cell = snapshot.board[row][col];
        if (!cell) continue;
        drawCell(this.gameCtx, col * cellSize, (row - HIDDEN_ROWS) * cellSize, cellSize, COLORS[cell]);
      }
    }

    if (!snapshot.active) return;

    // Ghost
    const ghostY = snapshot.ghostY;
    eachPieceCell(snapshot.active.type, snapshot.active.rotation, (r, c) => {
      const x = (snapshot.active.x + c) * cellSize;
      const y = (ghostY + r - HIDDEN_ROWS) * cellSize;
      if (ghostY + r < HIDDEN_ROWS) return;
      drawCell(this.gameCtx, x, y, cellSize, COLORS.G, GHOST_ALPHA);
    });

    // Active piece
    eachPieceCell(snapshot.active.type, snapshot.active.rotation, (r, c) => {
      const boardY = snapshot.active.y + r;
      if (boardY < HIDDEN_ROWS) return;
      const x = (snapshot.active.x + c) * cellSize;
      const y = (boardY - HIDDEN_ROWS) * cellSize;
      drawCell(this.gameCtx, x, y, cellSize, COLORS[snapshot.active.type], 1);
    });
  }

  renderHold(snapshot) {
    const widthPx = this.holdCanvas.clientWidth;
    const heightPx = this.holdCanvas.clientHeight;
    this.holdCtx.fillStyle = "rgba(0,0,0,0.22)";
    this.holdCtx.fillRect(0, 0, widthPx, heightPx);
    if (!snapshot.holdType) return;
    const cell = Math.floor(Math.min(widthPx, heightPx) / 5);
    const sizePx = cell * 4;
    const offsetX = Math.floor((widthPx - sizePx) / 2);
    const offsetY = Math.floor((heightPx - sizePx) / 2);
    drawMiniPiece(this.holdCtx, {
      type: snapshot.holdType,
      sizePx,
      offsetX,
      offsetY,
      cellSize: cell,
    });
  }

  renderNext(snapshot) {
    const widthPx = this.nextCanvas.clientWidth;
    const heightPx = this.nextCanvas.clientHeight;
    this.nextCtx.fillStyle = "rgba(0,0,0,0.22)";
    this.nextCtx.fillRect(0, 0, widthPx, heightPx);
    const cell = Math.floor(widthPx / 5.2);
    const size = cell * 4;
    const startX = Math.floor((widthPx - size) / 2);
    for (let index = 0; index < Math.min(5, snapshot.queue.length); index += 1) {
      const y = Math.floor(10 + index * (size + 10));
      drawMiniPiece(this.nextCtx, {
        type: snapshot.queue[index],
        sizePx: size,
        offsetX: startX,
        offsetY: y,
        cellSize: cell,
      });
    }
  }
}
