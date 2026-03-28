import {
  createInitialState,
  restartGame,
  setDirection,
  stepGame,
  togglePause,
} from "./snake-logic.js";

const BOARD_COLUMNS = 17;
const BOARD_ROWS = 15;
const TICK_MS = 140;

const boardElement = document.querySelector("#board");
const scoreElement = document.querySelector("#score");
const statusElement = document.querySelector("#status");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const overlayElement = document.querySelector("#overlay");
const overlayKickerElement = document.querySelector("#overlay-kicker");
const overlayTitleElement = document.querySelector("#overlay-title");
const overlayMessageElement = document.querySelector("#overlay-message");
const overlayButton = document.querySelector("#overlay-button");

let state = createInitialState({
  columns: BOARD_COLUMNS,
  rows: BOARD_ROWS,
});

const cells = [];
let touchStartPoint = null;

function getCellIndex(point) {
  return point.y * state.columns + point.x;
}

function getDirectionClass(direction) {
  return `dir-${direction.toLowerCase()}`;
}

function buildBoard() {
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns = `repeat(${state.columns}, minmax(0, 1fr))`;
  boardElement.style.aspectRatio = `${state.columns} / ${state.rows}`;

  const cellCount = state.columns * state.rows;
  for (let index = 0; index < cellCount; index += 1) {
    const cell = document.createElement("div");
    const x = index % state.columns;
    const y = Math.floor(index / state.columns);
    const shadeClass = (x + y) % 2 === 0 ? "cell-light" : "cell-dark";
    cell.className = `cell ${shadeClass}`;
    cell.setAttribute("role", "presentation");
    cells.push(cell);
    boardElement.append(cell);
  }
}

function getStatusMessage() {
  if (state.hasWon) {
    return "You filled the board. Press Restart to play again.";
  }

  if (state.isGameOver) {
    return "Game over. Tap Play Again or press R to restart.";
  }

  if (state.isPaused) {
    return "Paused. Press Space or tap Resume.";
  }

  if (!state.hasStarted) {
    return "Press Play, use arrow keys, or swipe to start.";
  }

  return "Arrow keys, WASD, or swipe to move.";
}

function getOverlayContent() {
  if (state.hasWon) {
    return {
      kicker: "Perfect Run",
      title: "You Win",
      message: "The board is full. Start another round?",
      actionLabel: "Play Again",
    };
  }

  if (state.isGameOver) {
    return {
      kicker: `Score ${state.score}`,
      title: "Game Over",
      message: "Take another run and beat your last score.",
      actionLabel: "Play Again",
    };
  }

  if (state.isPaused) {
    return {
      kicker: "Paused",
      title: "Resume Game",
      message: "Press Space or tap below to keep going.",
      actionLabel: "Resume",
    };
  }

  if (!state.hasStarted) {
    return {
      kicker: "Arcade Mode",
      title: "Play Snake",
      message: "Use the arrow keys, WASD, or swipe to start.",
      actionLabel: "Play",
    };
  }

  return null;
}

function renderBoard() {
  cells.forEach((cell, index) => {
    const x = index % state.columns;
    const y = Math.floor(index / state.columns);
    const shadeClass = (x + y) % 2 === 0 ? "cell-light" : "cell-dark";
    cell.className = `cell ${shadeClass}`;
  });

  if (state.food) {
    const foodCell = cells[getCellIndex(state.food)];
    if (foodCell) {
      foodCell.classList.add("food");
    }
  }

  state.snake.forEach((segment, index) => {
    const snakeCell = cells[getCellIndex(segment)];
    if (!snakeCell) {
      return;
    }

    snakeCell.classList.add("snake");
    if (index === 0) {
      snakeCell.classList.add("snake-head");
      snakeCell.classList.add(getDirectionClass(state.direction));
    }
  });
}

function render() {
  scoreElement.textContent = String(state.score);
  statusElement.textContent = getStatusMessage();
  pauseButton.disabled = !state.hasStarted || state.isGameOver || state.hasWon;
  pauseButton.textContent = state.isPaused ? ">" : "II";

  const overlayContent = getOverlayContent();
  if (overlayContent) {
    overlayElement.classList.add("is-visible");
    overlayKickerElement.textContent = overlayContent.kicker;
    overlayTitleElement.textContent = overlayContent.title;
    overlayMessageElement.textContent = overlayContent.message;
    overlayButton.textContent = overlayContent.actionLabel;
  } else {
    overlayElement.classList.remove("is-visible");
  }

  renderBoard();
}

function resetGame() {
  state = restartGame({
    columns: BOARD_COLUMNS,
    rows: BOARD_ROWS,
  });
  render();
}

function startRound() {
  state = setDirection(state, state.direction);
  render();
}

function handleOverlayAction() {
  if (state.isPaused) {
    state = togglePause(state);
    render();
    return;
  }

  if (state.isGameOver || state.hasWon) {
    resetGame();
  }

  startRound();
}

function updateDirection(nextDirection) {
  state = setDirection(state, nextDirection);
  render();
}

function handleKeydown(event) {
  const key = event.key.toLowerCase();
  const directionByKey = {
    arrowup: "UP",
    w: "UP",
    arrowdown: "DOWN",
    s: "DOWN",
    arrowleft: "LEFT",
    a: "LEFT",
    arrowright: "RIGHT",
    d: "RIGHT",
  };

  if (directionByKey[key]) {
    event.preventDefault();
    updateDirection(directionByKey[key]);
    return;
  }

  if (key === " ") {
    event.preventDefault();
    state = togglePause(state);
    render();
    return;
  }

  if (key === "r") {
    event.preventDefault();
    resetGame();
  }
}

function handleTouchStart(event) {
  const touch = event.changedTouches[0];
  touchStartPoint = {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function handleTouchEnd(event) {
  if (!touchStartPoint) {
    return;
  }

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartPoint.x;
  const deltaY = touch.clientY - touchStartPoint.y;
  touchStartPoint = null;

  if (Math.abs(deltaX) < 18 && Math.abs(deltaY) < 18) {
    if (!state.hasStarted || state.isGameOver || state.hasWon) {
      handleOverlayAction();
    }
    return;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    updateDirection(deltaX > 0 ? "RIGHT" : "LEFT");
    return;
  }

  updateDirection(deltaY > 0 ? "DOWN" : "UP");
}

function tick() {
  state = stepGame(state);
  render();
}

buildBoard();
render();

document.addEventListener("keydown", handleKeydown);

pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  resetGame();
});

overlayButton.addEventListener("click", handleOverlayAction);

boardElement.addEventListener("touchstart", handleTouchStart, { passive: true });
boardElement.addEventListener("touchend", handleTouchEnd, { passive: true });
overlayElement.addEventListener("touchstart", handleTouchStart, { passive: true });
overlayElement.addEventListener("touchend", handleTouchEnd, { passive: true });

window.setInterval(tick, TICK_MS);
