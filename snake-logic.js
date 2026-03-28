export const DIRECTIONS = Object.freeze({
  UP: "UP",
  DOWN: "DOWN",
  LEFT: "LEFT",
  RIGHT: "RIGHT",
});

const INITIAL_DIRECTION = DIRECTIONS.RIGHT;

const VECTORS = Object.freeze({
  [DIRECTIONS.UP]: { x: 0, y: -1 },
  [DIRECTIONS.DOWN]: { x: 0, y: 1 },
  [DIRECTIONS.LEFT]: { x: -1, y: 0 },
  [DIRECTIONS.RIGHT]: { x: 1, y: 0 },
});

const OPPOSITES = Object.freeze({
  [DIRECTIONS.UP]: DIRECTIONS.DOWN,
  [DIRECTIONS.DOWN]: DIRECTIONS.UP,
  [DIRECTIONS.LEFT]: DIRECTIONS.RIGHT,
  [DIRECTIONS.RIGHT]: DIRECTIONS.LEFT,
});

function pointsEqual(firstPoint, secondPoint) {
  return firstPoint.x === secondPoint.x && firstPoint.y === secondPoint.y;
}

function createInitialSnake(columns, rows) {
  const headX = Math.floor(columns / 2);
  const headY = Math.floor(rows / 2);

  return [
    { x: headX, y: headY },
    { x: headX - 1, y: headY },
    { x: headX - 2, y: headY },
  ];
}

export function listOpenCells(columns, rows, snake) {
  const occupiedCells = new Set(
    snake.map((segment) => `${segment.x},${segment.y}`),
  );
  const openCells = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const cellKey = `${x},${y}`;
      if (!occupiedCells.has(cellKey)) {
        openCells.push({ x, y });
      }
    }
  }

  return openCells;
}

export function placeFood({ columns, rows, snake, random = Math.random }) {
  const openCells = listOpenCells(columns, rows, snake);

  if (openCells.length === 0) {
    return null;
  }

  const index = Math.floor(random() * openCells.length);
  return openCells[index];
}

export function createInitialState({
  columns = 16,
  rows = 16,
  random = Math.random,
} = {}) {
  if (columns < 4 || rows < 4) {
    throw new Error("The board must be at least 4x4.");
  }

  const snake = createInitialSnake(columns, rows);

  return {
    columns,
    rows,
    snake,
    direction: INITIAL_DIRECTION,
    nextDirection: INITIAL_DIRECTION,
    food: placeFood({ columns, rows, snake, random }),
    score: 0,
    hasStarted: false,
    isPaused: false,
    isGameOver: false,
    hasWon: false,
  };
}

export function restartGame(options = {}) {
  return createInitialState(options);
}

export function setDirection(state, nextDirection) {
  if (!VECTORS[nextDirection] || state.isGameOver) {
    return state;
  }

  if (OPPOSITES[state.direction] === nextDirection) {
    return state;
  }

  if (state.nextDirection === nextDirection) {
    if (!state.hasStarted) {
      return {
        ...state,
        hasStarted: true,
      };
    }

    return state;
  }

  return {
    ...state,
    hasStarted: true,
    nextDirection,
  };
}

export function togglePause(state) {
  if (!state.hasStarted || state.isGameOver || state.hasWon) {
    return state;
  }

  return {
    ...state,
    isPaused: !state.isPaused,
  };
}

function isInsideBoard(point, columns, rows) {
  return (
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < columns &&
    point.y < rows
  );
}

export function stepGame(state, random = Math.random) {
  if (
    state.isGameOver ||
    state.isPaused ||
    state.hasWon ||
    !state.hasStarted
  ) {
    return state;
  }

  const movement = VECTORS[state.nextDirection];
  const nextHead = {
    x: state.snake[0].x + movement.x,
    y: state.snake[0].y + movement.y,
  };

  const willEat = state.food !== null && pointsEqual(nextHead, state.food);
  const collisionSegments = willEat ? state.snake : state.snake.slice(0, -1);

  const hitWall = !isInsideBoard(nextHead, state.columns, state.rows);
  const hitSelf = collisionSegments.some((segment) => pointsEqual(segment, nextHead));

  if (hitWall || hitSelf) {
    return {
      ...state,
      direction: state.nextDirection,
      isGameOver: true,
      isPaused: false,
    };
  }

  const nextSnake = willEat
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];

  const nextFood = willEat
    ? placeFood({
        columns: state.columns,
        rows: state.rows,
        snake: nextSnake,
        random,
      })
    : state.food;

  return {
    ...state,
    snake: nextSnake,
    direction: state.nextDirection,
    nextDirection: state.nextDirection,
    food: nextFood,
    score: willEat ? state.score + 1 : state.score,
    isGameOver: willEat && nextFood === null,
    hasWon: willEat && nextFood === null,
  };
}
