/**
 * Neon Tetris
 * Classic Tetris Engine, Canvas Renderer, Web Audio Synth, and Mobile Touch Events
 */

class SoundSynth {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  playMove() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.setValueAtTime(150, this.ctx.currentTime + 0.03);
      
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch (e) {}
  }

  playClear() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      // Play a rising harmonic soundscape
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.04);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 0.2 + index * 0.04);
        
        gain.gain.setValueAtTime(0.06, now + index * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + index * 0.04);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(now + index * 0.04);
        osc.stop(now + 0.35);
      });
    } catch (e) {}
  }

  playGameOver() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.6);
      
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.65);
    } catch (e) {}
  }
}

const synth = new SoundSynth();

// Shape matrix definitions with corresponding glow colors
const TETROMINOES = {
  I: {
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    color: '#00f2fe' // Cyan
  },
  O: {
    matrix: [
      [2, 2],
      [2, 2]
    ],
    color: '#ffd700' // Gold/Yellow
  },
  T: {
    matrix: [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0]
    ],
    color: '#bd00ff' // Purple
  },
  S: {
    matrix: [
      [0, 4, 4],
      [4, 4, 0],
      [0, 0, 0]
    ],
    color: '#39ff14' // Green
  },
  Z: {
    matrix: [
      [5, 5, 0],
      [0, 5, 5],
      [0, 0, 0]
    ],
    color: '#ff007f' // Pink/Red
  },
  J: {
    matrix: [
      [6, 0, 0],
      [6, 6, 6],
      [0, 0, 0]
    ],
    color: '#0055ff' // Blue
  },
  L: {
    matrix: [
      [0, 0, 7],
      [7, 7, 7],
      [0, 0, 0]
    ],
    color: '#ff5e00' // Orange
  }
};

class Game {
  constructor() {
    this.canvas = document.getElementById('tetris-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.previewCanvas = document.getElementById('preview-canvas');
    this.previewCtx = this.previewCanvas.getContext('2d');
    
    // Board Grid details (Standard 10 Columns x 20 Rows)
    this.cols = 10;
    this.rows = 20;
    this.board = [];
    
    // Core Game Values
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('neon_tetris_highscore')) || 0;
    this.level = 1;
    this.lines = 0;
    this.state = 'playing'; // 'playing', 'gameover'
    
    // Gravity settings
    this.dropCounter = 0;
    this.dropInterval = 850; // ms per step (speeds up as level increases)
    this.lastTime = 0;
    
    // Active / Next pieces
    this.currentPiece = null;
    this.nextPiece = null;
    
    // DOM Elements Binding
    this.scoreEl = document.getElementById('score-val');
    this.levelEl = document.getElementById('level-val');
    this.highScoreEl = document.getElementById('highscore-val');
    this.linesEl = document.getElementById('lines-val');
    this.gameOverOverlay = document.getElementById('game-over-overlay');
    this.restartBtn = document.getElementById('restart-btn');
    this.finalScoreEl = document.getElementById('final-score');
    this.finalHighScoreEl = document.getElementById('final-highscore');
    
    // Setup inputs and resizing
    this.setupResponsiveness();
    this.setupGamepad();
    
    // Initialize matrices and kick off immediately
    this.resetBoard();
    this.spawnPiece();
    this.updateUI();
    
    // Run Main Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  setupResponsiveness() {
    const resize = () => {
      this.pixelRatio = window.devicePixelRatio || 1;
      
      // Resize Main Board Canvas
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * this.pixelRatio;
      this.canvas.height = rect.height * this.pixelRatio;
      this.ctx.scale(this.pixelRatio, this.pixelRatio);
      
      this.boardWidth = rect.width;
      this.boardHeight = rect.height;
      this.cellSize = this.boardWidth / this.cols;
      
      // Resize Preview Canvas
      const pRect = this.previewCanvas.getBoundingClientRect();
      this.previewCanvas.width = pRect.width * this.pixelRatio;
      this.previewCanvas.height = pRect.height * this.pixelRatio;
      this.previewCtx.scale(this.pixelRatio, this.pixelRatio);
      this.previewCellSize = pRect.width / 4;
    };
    
    window.addEventListener('resize', resize);
    resize();
  }

  setupGamepad() {
    // Zero latency touch event handling for gamepads
    const addControl = (elementId, callback) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      
      const trigger = (e) => {
        e.preventDefault();
        synth.init(); // Warm up synth
        if (this.state === 'playing') {
          callback();
        }
      };
      
      el.addEventListener('touchstart', trigger, { passive: false });
      el.addEventListener('mousedown', trigger);
    };

    // Bind Gamepad touch buttons
    addControl('btn-left', () => this.moveLeft());
    addControl('btn-right', () => this.moveRight());
    addControl('btn-rotate', () => this.rotatePiece());
    addControl('btn-drop', () => this.hardDrop());

    // Bind Keyboard standard controls
    window.addEventListener('keydown', (e) => {
      if (this.state !== 'playing') return;
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.moveLeft();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.moveRight();
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.rotatePiece();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.softDrop();
          break;
        case ' ':
          this.hardDrop();
          e.preventDefault(); // Stop window scroll down
          break;
      }
    });

    // Reset overlay retry button
    this.restartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.resetGame();
    });
  }

  resetBoard() {
    this.board = [];
    for (let r = 0; r < this.rows; r++) {
      this.board[r] = new Array(this.cols).fill(0);
    }
  }

  // --- MATRICES & TETROMINO MECHANICS ---
  getRandomPiece() {
    const keys = Object.keys(TETROMINOES);
    const key = keys[Math.floor(Math.random() * keys.length)];
    const data = TETROMINOES[key];
    
    // Return deeply cloned piece configuration
    return {
      matrix: JSON.parse(JSON.stringify(data.matrix)),
      color: data.color,
      x: 0,
      y: 0
    };
  }

  spawnPiece() {
    if (!this.nextPiece) {
      this.nextPiece = this.getRandomPiece();
    }
    
    this.currentPiece = this.nextPiece;
    this.nextPiece = this.getRandomPiece();
    
    // Center spawn point
    this.currentPiece.x = Math.floor((this.cols - this.currentPiece.matrix[0].length) / 2);
    // Start slightly off-screen (row 0 or 1)
    this.currentPiece.y = 0;
    
    // Check if spawn immediately collides (Grid Lock / Game Over)
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.matrix)) {
      this.triggerGameOver();
    }
  }

  rotateMatrix(matrix) {
    const n = matrix.length;
    let rotated = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        rotated[c][r] = matrix[r][c];
      }
    }
    for (let r = 0; r < n; r++) {
      rotated[r].reverse();
    }
    return rotated;
  }

  checkCollision(px, py, matrix) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardX = px + c;
          const boardY = py + r;
          
          // Collision with walls
          if (boardX < 0 || boardX >= this.cols || boardY >= this.rows) {
            return true;
          }
          
          // Collision with other blocks on board (ignore checks above grid height)
          if (boardY >= 0 && this.board[boardY][boardX] !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Lock current piece to board grid cells
  lockPiece() {
    const matrix = this.currentPiece.matrix;
    const px = this.currentPiece.x;
    const py = this.currentPiece.y;
    
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const boardY = py + r;
          const boardX = px + c;
          
          if (boardY >= 0) {
            this.board[boardY][boardX] = this.currentPiece.color;
          }
        }
      }
    }
    
    // Perform full-row clear sweeps
    this.clearLines();
    this.spawnPiece();
  }

  clearLines() {
    let linesClearedThisTurn = 0;
    
    for (let r = this.rows - 1; r >= 0; r--) {
      // Check if row is completely full (no zeroes)
      const isFull = this.board[r].every(cell => cell !== 0);
      
      if (isFull) {
        // Splice row and insert new empty row at top
        this.board.splice(r, 1);
        this.board.unshift(new Array(this.cols).fill(0));
        
        linesClearedThisTurn++;
        r++; // Re-evaluate index since row shifted down
      }
    }
    
    if (linesClearedThisTurn > 0) {
      this.lines += linesClearedThisTurn;
      
      // Standard Tetris line scoring formula
      const scoreCombos = [0, 100, 300, 500, 800];
      const points = (scoreCombos[linesClearedThisTurn] || 800) * this.level;
      this.score += points;
      
      // Update levels
      this.level = Math.floor(this.lines / 10) + 1;
      
      // Scale gravity intervals (level up = faster drop rates)
      this.dropInterval = Math.max(100, 850 - (this.level - 1) * 80);
      
      synth.playClear();
      this.updateUI();
    }
  }

  // --- ACTIONS ---
  moveLeft() {
    this.currentPiece.x--;
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.matrix)) {
      this.currentPiece.x++;
    } else {
      synth.playMove();
    }
  }

  moveRight() {
    this.currentPiece.x++;
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.matrix)) {
      this.currentPiece.x--;
    } else {
      synth.playMove();
    }
  }

  rotatePiece() {
    const originalMatrix = this.currentPiece.matrix;
    const rotated = this.rotateMatrix(originalMatrix);
    
    // Wall Kick testing: Shift pieces left or right slightly if rotation collides near walls
    const originalX = this.currentPiece.x;
    let success = false;
    
    const offsets = [0, -1, 1, -2, 2];
    for (let i = 0; i < offsets.length; i++) {
      this.currentPiece.x = originalX + offsets[i];
      if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, rotated)) {
        this.currentPiece.matrix = rotated;
        success = true;
        break;
      }
    }
    
    if (!success) {
      this.currentPiece.x = originalX; // Revert
    } else {
      synth.playMove();
    }
  }

  softDrop() {
    this.currentPiece.y++;
    if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.matrix)) {
      this.currentPiece.y--;
      this.lockPiece();
    }
  }

  hardDrop() {
    // Lower block down continuously until collision
    while (!this.checkCollision(this.currentPiece.x, this.currentPiece.y + 1, this.currentPiece.matrix)) {
      this.currentPiece.y++;
    }
    this.lockPiece();
    synth.playMove();
  }

  // --- CORE GAME STATE TRANSITIONS ---
  updateUI() {
    this.scoreEl.textContent = String(this.score).padStart(4, '0');
    this.levelEl.textContent = this.level;
    this.linesEl.textContent = this.lines;
    this.highScoreEl.textContent = String(this.highScore).padStart(4, '0');
  }

  triggerGameOver() {
    this.state = 'gameover';
    synth.playGameOver();
    
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('neon_tetris_highscore', this.highScore);
    }
    
    this.finalScoreEl.textContent = String(this.score).padStart(4, '0');
    this.finalHighScoreEl.textContent = String(this.highScore).padStart(4, '0');
    
    this.gameOverOverlay.classList.add('active');
  }

  resetGame() {
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 850;
    this.state = 'playing';
    
    this.resetBoard();
    this.spawnPiece();
    this.updateUI();
    
    this.gameOverOverlay.classList.remove('active');
  }

  // --- RENDERING ROUTINES ---
  draw() {
    // Clear Board
    this.ctx.clearRect(0, 0, this.boardWidth, this.boardHeight);
    
    // Draw cells already locked on board grid
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cellColor = this.board[r][c];
        if (cellColor !== 0) {
          this.drawCell(this.ctx, c, r, cellColor, this.cellSize);
        } else {
          // Draw subtle background grid cells
          this.ctx.strokeStyle = 'rgba(189, 0, 255, 0.04)';
          this.ctx.lineWidth = 0.5;
          this.ctx.strokeRect(c * this.cellSize, r * this.cellSize, this.cellSize, this.cellSize);
        }
      }
    }
    
    // Draw active dropping piece
    if (this.currentPiece && this.state !== 'gameover') {
      const matrix = this.currentPiece.matrix;
      const px = this.currentPiece.x;
      const py = this.currentPiece.y;
      
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            this.drawCell(this.ctx, px + c, py + r, this.currentPiece.color, this.cellSize);
          }
        }
      }
    }
    
    // Draw next preview panel piece
    this.drawPreview();
  }

  drawCell(context, gridX, gridY, color, size) {
    context.save();
    
    // Add glowing neon properties
    context.shadowBlur = 10;
    context.shadowColor = color;
    context.fillStyle = color;
    
    // Draw rounded rect block
    const pad = 1.5;
    const rx = gridX * size + pad;
    const ry = gridY * size + pad;
    const rSize = size - pad * 2;
    const rad = 4; // block corner roundings
    
    context.beginPath();
    context.moveTo(rx + rad, ry);
    context.lineTo(rx + rSize - rad, ry);
    context.quadraticCurveTo(rx + rSize, ry, rx + rSize, ry + rad);
    context.lineTo(rx + rSize, ry + rSize - rad);
    context.quadraticCurveTo(rx + rSize, ry + rSize, rx + rSize - rad, ry + rSize);
    context.lineTo(rx + rad, ry + rSize);
    context.quadraticCurveTo(rx, ry + rSize, rx, ry + rSize - rad);
    context.lineTo(rx, ry + rad);
    context.quadraticCurveTo(rx, ry, rx + rad, ry);
    context.closePath();
    context.fill();
    
    // High-tech internal core highlights
    context.fillStyle = 'rgba(255, 255, 255, 0.35)';
    context.fillRect(rx + size * 0.15, ry + size * 0.15, size * 0.2, size * 0.2);
    
    context.restore();
  }

  drawPreview() {
    this.previewCtx.clearRect(0, 0, 80, 80);
    
    if (!this.nextPiece) return;
    
    const matrix = this.nextPiece.matrix;
    const color = this.nextPiece.color;
    
    // Calculate layout alignment offsets to center the next piece preview
    const size = this.previewCellSize;
    const n = matrix.length;
    
    // Determine boundings
    let minC = n, maxC = 0, minR = n, maxR = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c] !== 0) {
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
        }
      }
    }
    
    const w = (maxC - minC + 1) * size;
    const h = (maxR - minR + 1) * size;
    
    // Start X/Y to center relative to 65px wrapper
    const startX = (65 - w) / 2 - minC * size;
    const startY = (65 - h) / 2 - minR * size;
    
    this.previewCtx.save();
    this.previewCtx.shadowBlur = 8;
    this.previewCtx.shadowColor = color;
    this.previewCtx.fillStyle = color;
    
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c] !== 0) {
          const pad = 1;
          const rx = startX + c * size + pad;
          const ry = startY + r * size + pad;
          const rSize = size - pad * 2;
          
          this.previewCtx.fillRect(rx, ry, rSize, rSize);
          
          // Internal core highlight
          this.previewCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          this.previewCtx.fillRect(rx + size * 0.15, ry + size * 0.15, size * 0.2, size * 0.2);
          this.previewCtx.fillStyle = color; // reset
        }
      }
    }
    this.previewCtx.restore();
  }

  // --- ENGINE GAME LOOP ---
  loop(time) {
    if (!this.lastTime) this.lastTime = time;
    const delta = time - this.lastTime;
    this.lastTime = time;
    
    if (this.state === 'playing') {
      this.dropCounter += delta;
      if (this.dropCounter >= this.dropInterval) {
        this.dropCounter = 0;
        this.softDrop();
      }
    }
    
    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }
}

// Auto launch immediately
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
