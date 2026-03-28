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
const SVG_NS = "http://www.w3.org/2000/svg";

const boardElement = document.querySelector("#board");
const sceneElement = document.querySelector("#scene");
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
let transition = null;

const snakeOutlineElement = document.createElementNS(SVG_NS, "path");
const snakeBodyElement = document.createElementNS(SVG_NS, "path");
const snakeHeadElement = document.createElementNS(SVG_NS, "circle");
const snakeEyeLeftElement = document.createElementNS(SVG_NS, "circle");
const snakeEyeRightElement = document.createElementNS(SVG_NS, "circle");
const foodBodyElement = document.createElementNS(SVG_NS, "circle");
const foodHighlightElement = document.createElementNS(SVG_NS, "circle");
const foodStemElement = document.createElementNS(SVG_NS, "ellipse");

snakeOutlineElement.setAttribute("class", "snake-outline");
snakeOutlineElement.setAttribute("stroke-width", "0.92");
snakeBodyElement.setAttribute("class", "snake-body");
snakeBodyElement.setAttribute("stroke-width", "0.76");
snakeHeadElement.setAttribute("class", "snake-head");
snakeHeadElement.setAttribute("r", "0.42");
snakeEyeLeftElement.setAttribute("class", "snake-eye");
snakeEyeLeftElement.setAttribute("r", "0.055");
snakeEyeRightElement.setAttribute("class", "snake-eye");
snakeEyeRightElement.setAttribute("r", "0.055");
foodBodyElement.setAttribute("class", "food-body");
foodBodyElement.setAttribute("r", "0.3");
foodHighlightElement.setAttribute("class", "food-highlight");
foodHighlightElement.setAttribute("r", "0.09");
foodStemElement.setAttribute("class", "food-stem");
foodStemElement.setAttribute("rx", "0.1");
foodStemElement.setAttribute("ry", "0.05");

sceneElement.append(
  foodStemElement,
  foodBodyElement,
  foodHighlightElement,
  snakeOutlineElement,
  snakeBodyElement,
  snakeHeadElement,
  snakeEyeLeftElement,
  snakeEyeRightElement,
);

function clonePoint(point) {
  return { x: point.x, y: point.y };
}

function cloneSnake(snake) {
  return snake.map((segment) => clonePoint(segment));
}

function pointsEqual(firstPoint, secondPoint) {
  if (firstPoint === null || secondPoint === null) {
    return firstPoint === secondPoint;
  }

  return firstPoint.x === secondPoint.x && firstPoint.y === secondPoint.y;
}

function interpolatePoint(fromPoint, toPoint, progress) {
  return {
    x: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
    y: fromPoint.y + (toPoint.y - fromPoint.y) * progress,
  };
}

function formatUnit(value) {
  return value.toFixed(3);
}

function getPointCenter(point) {
  return {
    x: point.x + 0.5,
    y: point.y + 0.5,
  };
}

function buildSnakePath(points) {
  if (points.length === 0) {
    return "";
  }

  const firstPoint = getPointCenter(points[0]);
  let path = `M ${formatUnit(firstPoint.x)} ${formatUnit(firstPoint.y)}`;

  for (let index = 1; index < points.length; index += 1) {
    const point = getPointCenter(points[index]);
    path += ` L ${formatUnit(point.x)} ${formatUnit(point.y)}`;
  }

  return path;
}

function getRenderedSnake(now) {
  if (transition === null) {
    return {
      direction: state.direction,
      points: state.snake,
    };
  }

  const progress = Math.min((now - transition.startedAt) / transition.duration, 1);
  const points = transition.toSnake.map((toPoint, index) => {
    const fallbackPoint = transition.fromSnake[transition.fromSnake.length - 1];
    const fromPoint = transition.fromSnake[index] ?? fallbackPoint;
    return interpolatePoint(fromPoint, toPoint, progress);
  });

  if (progress >= 1) {
    transition = null;
  }

  return {
    direction: transition?.toDirection ?? state.direction,
    points,
  };
}

function getRenderedFood(now) {
  if (transition === null) {
    return state.food;
  }

  const progress = Math.min((now - transition.startedAt) / transition.duration, 1);
  if (transition.fromFood && transition.toFood && !pointsEqual(transition.fromFood, transition.toFood)) {
    return progress < 0.4 ? transition.fromFood : transition.toFood;
  }

  return transition.toFood ?? transition.fromFood;
}

function setFoodVisibility(isVisible) {
  const visibility = isVisible ? "visible" : "hidden";
  foodBodyElement.setAttribute("visibility", visibility);
  foodHighlightElement.setAttribute("visibility", visibility);
  foodStemElement.setAttribute("visibility", visibility);
}

function setEyePositions(headCenter, direction) {
  const offsets = {
    UP: [
      { x: -0.12, y: -0.14 },
      { x: 0.12, y: -0.14 },
    ],
    DOWN: [
      { x: -0.12, y: 0.14 },
      { x: 0.12, y: 0.14 },
    ],
    LEFT: [
      { x: -0.14, y: -0.12 },
      { x: -0.14, y: 0.12 },
    ],
    RIGHT: [
      { x: 0.14, y: -0.12 },
      { x: 0.14, y: 0.12 },
    ],
  };

  const eyeOffsets = offsets[direction] ?? offsets.RIGHT;
  const leftEye = {
    x: headCenter.x + eyeOffsets[0].x,
    y: headCenter.y + eyeOffsets[0].y,
  };
  const rightEye = {
    x: headCenter.x + eyeOffsets[1].x,
    y: headCenter.y + eyeOffsets[1].y,
  };

  snakeEyeLeftElement.setAttribute("cx", formatUnit(leftEye.x));
  snakeEyeLeftElement.setAttribute("cy", formatUnit(leftEye.y));
  snakeEyeRightElement.setAttribute("cx", formatUnit(rightEye.x));
  snakeEyeRightElement.setAttribute("cy", formatUnit(rightEye.y));
}

function renderScene(now = performance.now()) {
  const renderedSnake = getRenderedSnake(now);
  const snakePath = buildSnakePath(renderedSnake.points);
  snakeOutlineElement.setAttribute("d", snakePath);
  snakeBodyElement.setAttribute("d", snakePath);

  const headCenter = getPointCenter(renderedSnake.points[0]);
  snakeHeadElement.setAttribute("cx", formatUnit(headCenter.x));
  snakeHeadElement.setAttribute("cy", formatUnit(headCenter.y));
  setEyePositions(headCenter, renderedSnake.direction);

  const renderedFood = getRenderedFood(now);
  if (renderedFood === null) {
    setFoodVisibility(false);
  } else {
    setFoodVisibility(true);
    const foodCenter = getPointCenter(renderedFood);
    foodBodyElement.setAttribute("cx", formatUnit(foodCenter.x));
    foodBodyElement.setAttribute("cy", formatUnit(foodCenter.y));
    foodHighlightElement.setAttribute("cx", formatUnit(foodCenter.x - 0.1));
    foodHighlightElement.setAttribute("cy", formatUnit(foodCenter.y - 0.1));
    foodStemElement.setAttribute("cx", formatUnit(foodCenter.x + 0.06));
    foodStemElement.setAttribute("cy", formatUnit(foodCenter.y - 0.23));
    foodStemElement.setAttribute(
      "transform",
      `rotate(-24 ${formatUnit(foodCenter.x + 0.06)} ${formatUnit(foodCenter.y - 0.23)})`,
    );
  }

  window.requestAnimationFrame(renderScene);
}

function buildBoard() {
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns = `repeat(${state.columns}, minmax(0, 1fr))`;
  boardElement.style.aspectRatio = `${state.columns} / ${state.rows}`;
  sceneElement.setAttribute("viewBox", `0 0 ${state.columns} ${state.rows}`);

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
}

function resetGame() {
  transition = null;
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
  const now = performance.now();
  const previousState = state;
  const nextState = stepGame(state);
  if (nextState !== previousState) {
    const renderedSnake = getRenderedSnake(now).points;
    const renderedFood = getRenderedFood(now);
    transition = {
      fromFood: renderedFood ? clonePoint(renderedFood) : null,
      fromSnake: cloneSnake(renderedSnake),
      startedAt: now,
      duration: TICK_MS,
      toDirection: nextState.direction,
      toFood: nextState.food ? clonePoint(nextState.food) : null,
      toSnake: cloneSnake(nextState.snake),
    };
  }
  state = nextState;
  render();
}

buildBoard();
render();
window.requestAnimationFrame(renderScene);

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
