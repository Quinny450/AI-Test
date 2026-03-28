# Snake

A small, dependency-free Snake game with a presentation inspired by the Google Snake experience.

## Run locally

1. From this folder, run `powershell -ExecutionPolicy Bypass -File .\Start-Server.ps1`.
2. Open `http://localhost:8080/`.

## What to verify manually

- The start overlay opens the round and the board uses the Google-style green checkerboard look.
- The snake starts moving when you press Play, an arrow key, `W`, `A`, `S`, `D`, or swipe.
- Eating food grows the snake and increments the score.
- Pressing `Space` or the pause button pauses and resumes the game.
- Hitting a wall or the snake body ends the game.
- Pressing `R` or clicking `Restart` resets the board and score.
