// ============================================
// CANVAS SETUP
// ============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

// ============================================
// GAME LOOP VARIABLES
// ============================================

let lastTime = 0;

// ============================================
// AUDIO SYSTEM (Web Audio API)
// ============================================

let audioContext = null;

function initAudio() {
    // Create audio context on first user interaction (required by browsers)
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playShootSound() {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.03, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playExplosionSound(size) {
    if (!audioContext) return;
    
    // Create noise buffer
    const bufferSize = audioContext.sampleRate * 0.3;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(size > 40 ? 400 : size > 20 ? 600 : 800, audioContext.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);
    
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    noise.start(audioContext.currentTime);
    noise.stop(audioContext.currentTime + 0.3);
}

function playShipDeathSound() {
    if (!audioContext) return;
    
    // Soft low rumble
    const oscillator = audioContext.createOscillator();
    const oscGain = audioContext.createGain();
    
    oscillator.connect(oscGain);
    oscGain.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.4);
    
    oscGain.gain.setValueAtTime(0.1, audioContext.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
}

function playGameOverSound() {
    if (!audioContext) return;
    
    // Soft descending tone (sad/game over feel)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 1.0);
    
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime + 0.5);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1.2);
}

// ============================================
// INPUT HANDLING
// ============================================

// Track which keys are currently pressed
const keys = {
    left: false,
    right: false,
    up: false,
    space: false
};

// Key codes for controls (WASD)
const KEY_LEFT = 'KeyA';
const KEY_RIGHT = 'KeyD';
const KEY_UP = 'KeyW';
const KEY_SPACE = 'Space';
const KEY_TOGGLE_AIM = 'KeyM';
const KEY_ESCAPE = 'Escape';

// Mouse tracking for aim
let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;
let controlMode = 'mouse';  // 'keyboard' or 'mouse'

document.addEventListener('keydown', (e) => {
    // Initialize audio on first user interaction
    initAudio();
    
    // Ignore input during loading
    if (gameState === STATE_LOADING) {
        e.preventDefault();
        return;
    }
    
    // Handle game state transitions
    if (e.code === KEY_SPACE) {
        if (gameState === STATE_TITLE) {
            startGame();
            e.preventDefault();
            return;
        } else if (gameState === STATE_GAMEOVER) {
            if (gameOverTimer <= 0) {
                startGame();
            }
            e.preventDefault();
            return;
        }
    }
    
    // Escape key returns to title screen
    if (e.code === KEY_ESCAPE) {
        if (gameState === STATE_PLAYING || gameState === STATE_GAMEOVER) {
            gameState = STATE_TITLE;
            e.preventDefault();
            return;
        }
    }
    
    // Normal key handling
    switch (e.code) {
        case KEY_LEFT:
            keys.left = true;
            break;
        case KEY_RIGHT:
            keys.right = true;
            break;
        case KEY_UP:
            keys.up = true;
            break;
        case KEY_SPACE:
            keys.space = true;
            break;
        case KEY_TOGGLE_AIM:
            controlMode = controlMode === 'keyboard' ? 'mouse' : 'keyboard';
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case KEY_LEFT:
            keys.left = false;
            break;
        case KEY_RIGHT:
            keys.right = false;
            break;
        case KEY_UP:
            keys.up = false;
            break;
        case KEY_SPACE:
            keys.space = false;
            break;
    }
});

// Mouse movement tracking
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    initAudio();
});

// ============================================
// SHIP CLASS
// ============================================

class Ship {
    constructor(x, y) {
        // Position
        this.x = x;
        this.y = y;
        
        // Velocity (pixels per second)
        this.vx = 0;
        this.vy = 0;
        
        // Rotation angle in radians (-PI/2 = pointing up)
        this.angle = -Math.PI / 2;
        
        // Ship properties
        this.size = 20;              // Ship radius in pixels
        this.rotationSpeed = 5;      // Radians per second
        this.thrustPower = 300;      // Pixels per second squared
        this.thrusting = false;      // Is thrust currently active?
        this.friction = 0.99;       // Velocity multiplier per frame at 60fps (drag)
    }

    update(dt) {
        // Handle rotation based on control mode
        if (controlMode === 'mouse') {
            // Point ship toward mouse cursor
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            this.angle = Math.atan2(dy, dx);
        } else {
            // Keyboard rotation (A/D keys)
            if (keys.left) {
                this.angle -= this.rotationSpeed * dt;
            }
            if (keys.right) {
                this.angle += this.rotationSpeed * dt;
            }
        }

        // Handle thrust (up arrow)
        this.thrusting = keys.up;
        if (this.thrusting) {
            // Apply thrust in the direction the ship is facing
            this.vx += Math.cos(this.angle) * this.thrustPower * dt;
            this.vy += Math.sin(this.angle) * this.thrustPower * dt;
        }

        // Apply friction (drag) to slow down over time
        // Frame-rate independent: friction is defined per frame at 60fps
        const frictionFactor = Math.pow(this.friction, dt * 60);
        this.vx *= frictionFactor;
        this.vy *= frictionFactor;

        // Apply velocity to position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Screen wrapping (teleport to opposite side)
        if (this.x < 0) {
            this.x = canvas.width;
        } else if (this.x > canvas.width) {
            this.x = 0;
        }

        if (this.y < 0) {
            this.y = canvas.height;
        } else if (this.y > canvas.height) {
            this.y = 0;
        }
    }

    draw() {
        // Blink when invincible (don't draw every other frame)
        if (invincible && Math.floor(invincibleTimer * 10) % 2 === 0) {
            return;
        }
        
        // Save current context state
        ctx.save();
        
        // Move origin to ship position and rotate
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw ship as a triangle pointing right (rotated by this.angle)
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.size, 0);                        // Nose
        ctx.lineTo(-this.size * 0.7, -this.size * 0.6);  // Left wing
        ctx.lineTo(-this.size * 0.4, 0);                 // Indent
        ctx.lineTo(-this.size * 0.7, this.size * 0.6);   // Right wing
        ctx.closePath();
        ctx.stroke();

        // Draw thruster flame when thrusting
        if (this.thrusting) {
            // Flicker effect: random flame length
            const flameLength = this.size * (0.6 + Math.random() * 0.4);
            
            ctx.strokeStyle = '#f80';  // Orange flame
            ctx.beginPath();
            ctx.moveTo(-this.size * 0.4, -this.size * 0.3);  // Left side
            ctx.lineTo(-this.size * 0.4 - flameLength, 0);   // Flame tip
            ctx.lineTo(-this.size * 0.4, this.size * 0.3);   // Right side
            ctx.stroke();
        }

        // Restore context state
        ctx.restore();
    }
}

// ============================================
// ASTEROID CLASS
// ============================================

class Asteroid {
    constructor(x, y, size) {
        // Position
        this.x = x;
        this.y = y;
        
        // Size (radius in pixels)
        // Large = 60, Medium = 30, Small = 15
        this.size = size;
        
        // Random velocity (speed and direction)
        const speed = 50 + Math.random() * 50;  // 50-100 pixels per second
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        // Rotation
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 2;  // -1 to 1 rad/s
        
        // Generate random irregular shape (vertices)
        this.vertices = this.generateVertices();
    }

    generateVertices() {
        // Create an irregular polygon shape
        const vertices = [];
        const numVertices = 8 + Math.floor(Math.random() * 5);  // 8-12 vertices
        
        for (let i = 0; i < numVertices; i++) {
            const angle = (i / numVertices) * Math.PI * 2;
            // Random radius variation (70% to 100% of size)
            const radius = this.size * (0.7 + Math.random() * 0.3);
            vertices.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }
        
        return vertices;
    }

    update(dt) {
        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Rotate
        this.angle += this.rotationSpeed * dt;
        
        // Screen wrapping
        if (this.x < -this.size) {
            this.x = canvas.width + this.size;
        } else if (this.x > canvas.width + this.size) {
            this.x = -this.size;
        }
        
        if (this.y < -this.size) {
            this.y = canvas.height + this.size;
        } else if (this.y > canvas.height + this.size) {
            this.y = -this.size;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Draw the irregular polygon
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    }
}

// ============================================
// BULLET CLASS
// ============================================

class Bullet {
    constructor(x, y, angle) {
        // Position
        this.x = x;
        this.y = y;
        
        // Velocity (fast, travels in straight line)
        const speed = 500;  // Pixels per second
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        // Size (small dot)
        this.size = 3;
        
        // Lifespan (seconds until bullet disappears)
        this.lifespan = 1.0;
        this.age = 0;
    }

    update(dt) {
        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Age the bullet
        this.age += dt;
        
        // Screen wrapping
        if (this.x < 0) {
            this.x = canvas.width;
        } else if (this.x > canvas.width) {
            this.x = 0;
        }
        
        if (this.y < 0) {
            this.y = canvas.height;
        } else if (this.y > canvas.height) {
            this.y = 0;
        }
    }

    isExpired() {
        return this.age >= this.lifespan;
    }

    draw() {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================
// PARTICLE CLASS
// ============================================

class Particle {
    constructor(x, y, color) {
        // Position
        this.x = x;
        this.y = y;
        
        // Random velocity (explosion outward)
        const speed = 50 + Math.random() * 150;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        // Size (random small dots)
        this.size = 1 + Math.random() * 2;
        
        // Color
        this.color = color;
        
        // Lifespan
        this.lifespan = 0.5 + Math.random() * 0.5;
        this.age = 0;
    }

    update(dt) {
        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Age the particle
        this.age += dt;
    }

    isExpired() {
        return this.age >= this.lifespan;
    }

    draw() {
        // Fade out as particle ages
        const alpha = 1 - (this.age / this.lifespan);
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Create ship at center of canvas
const ship = new Ship(canvas.width / 2, canvas.height / 2);

// Asteroids array
const asteroids = [];

// Bullets array
const bullets = [];

// Particles array
const particles = [];

// Shooting cooldown
let shootCooldown = 0;
const SHOOT_DELAY = 0.15;  // Seconds between shots

// Score system
let score = 0;
const SCORE_LARGE = 20;
const SCORE_MEDIUM = 50;
const SCORE_SMALL = 100;

// High score (persisted in localStorage)
let highScore = parseInt(localStorage.getItem('asteroidsHighScore')) || 0;

// Level system
let level = 1;
const INITIAL_ASTEROIDS = 4;

// Lives system
let lives = 3;
const MAX_LIVES = 3;
let invincible = false;
let invincibleTimer = 0;
const INVINCIBLE_DURATION = 3.0;  // Seconds of invincibility after respawn

// Game over delay
let gameOverTimer = 0;
const GAME_OVER_DELAY = 3.0;  // Seconds before restart is allowed

// Game states
const STATE_LOADING = 0;
const STATE_TITLE = 1;
const STATE_PLAYING = 2;
const STATE_GAMEOVER = 3;
let gameState = STATE_LOADING;

// Font loading
let fontLoaded = false;

function loadFont() {
    document.fonts.load('bold 36px Hyperspace').then(() => {
        fontLoaded = true;
        gameState = STATE_TITLE;
    });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function spawnAsteroids(count, size) {
    for (let i = 0; i < count; i++) {
        // Spawn at random edge of screen
        let x, y;
        const edge = Math.floor(Math.random() * 4);
        
        switch (edge) {
            case 0:  // Top
                x = Math.random() * canvas.width;
                y = -size;
                break;
            case 1:  // Right
                x = canvas.width + size;
                y = Math.random() * canvas.height;
                break;
            case 2:  // Bottom
                x = Math.random() * canvas.width;
                y = canvas.height + size;
                break;
            case 3:  // Left
                x = -size;
                y = Math.random() * canvas.height;
                break;
        }
        
        asteroids.push(new Asteroid(x, y, size));
    }
}

function shoot() {
    // Create bullet at ship's nose
    const bulletX = ship.x + Math.cos(ship.angle) * ship.size;
    const bulletY = ship.y + Math.sin(ship.angle) * ship.size;
    
    bullets.push(new Bullet(bulletX, bulletY, ship.angle));
    shootCooldown = SHOOT_DELAY;
    
    playShootSound();
}

function createExplosion(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function circleCollision(obj1, obj2) {
    // Calculate distance between two objects
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if distance is less than sum of radii
    return distance < obj1.size + obj2.size;
}

function checkCollisions() {
    // Check bullet-asteroid collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            if (circleCollision(bullets[i], asteroids[j])) {
                // Remove bullet
                bullets.splice(i, 1);
                
                // Store asteroid info before removing
                const asteroid = asteroids[j];
                
                // Add score based on asteroid size
                if (asteroid.size >= 50) {
                    score += SCORE_LARGE;
                } else if (asteroid.size >= 25) {
                    score += SCORE_MEDIUM;
                } else {
                    score += SCORE_SMALL;
                }
                
                // Remove asteroid
                asteroids.splice(j, 1);
                
                // Create explosion effect
                const particleCount = asteroid.size > 40 ? 15 : asteroid.size > 20 ? 10 : 5;
                createExplosion(asteroid.x, asteroid.y, particleCount, '#fff');
                
                // Play explosion sound
                playExplosionSound(asteroid.size);
                
                // Split asteroid if large enough
                if (asteroid.size > 20) {
                    const newSize = asteroid.size / 2;
                    // Spawn 2 smaller asteroids at the same position
                    asteroids.push(new Asteroid(asteroid.x, asteroid.y, newSize));
                    asteroids.push(new Asteroid(asteroid.x, asteroid.y, newSize));
                }
                
                // Break out of asteroid loop since bullet is gone
                break;
            }
        }
    }
    
    // Check ship-asteroid collisions (only if not invincible)
    if (!invincible) {
        for (const asteroid of asteroids) {
            if (circleCollision(ship, asteroid)) {
                // Create ship explosion
                createExplosion(ship.x, ship.y, 20, '#f80');
                
                // Play ship death sound
                playShipDeathSound();
                
                lives--;
                
                if (lives <= 0) {
                    gameOver();
                    return;
                }
                
                respawnShip();
                break;
            }
        }
    }
}

function drawScore() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Hyperspace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${score}`, 20, 40);
    ctx.fillText(`LEVEL: ${level}`, 20, 70);
    
    // Draw high score
    ctx.font = 'bold 16px Hyperspace, monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`HIGH: ${highScore}`, 20, 95);
}

function drawLives() {
    const startX = canvas.width - 30;
    const startY = 30;
    const spacing = 30;
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < lives; i++) {
        ctx.save();
        ctx.translate(startX - i * spacing, startY);
        ctx.rotate(-Math.PI / 2);
        
        // Draw mini ship
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-7, -6);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-7, 6);
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    }
}

function respawnShip() {
    ship.x = canvas.width / 2;
    ship.y = canvas.height / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    
    // Make ship invincible for a short time
    invincible = true;
    invincibleTimer = INVINCIBLE_DURATION;
}

function startGame() {
    // Reset game state
    gameState = STATE_PLAYING;
    score = 0;
    level = 1;
    lives = MAX_LIVES;
    invincible = false;
    invincibleTimer = 0;
    gameOverTimer = 0;
    
    // Clear arrays
    asteroids.length = 0;
    bullets.length = 0;
    particles.length = 0;
    
    // Reset ship
    ship.x = canvas.width / 2;
    ship.y = canvas.height / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    
    // Spawn initial asteroids
    spawnAsteroids(INITIAL_ASTEROIDS, 60);
}

function nextLevel() {
    level++;
    
    // More asteroids each level (capped at 12)
    const asteroidCount = Math.min(INITIAL_ASTEROIDS + level - 1, 12);
    spawnAsteroids(asteroidCount, 60);
}

function gameOver() {
    gameState = STATE_GAMEOVER;
    gameOverTimer = GAME_OVER_DELAY;
    playGameOverSound();
    
    // Check for new high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('asteroidsHighScore', highScore.toString());
    }
}

// ============================================
// GAME FUNCTIONS
// ============================================

function update(dt) {
    // Update game over timer
    if (gameOverTimer > 0) {
        gameOverTimer -= dt;
    }
    
    // Only update game logic when playing
    if (gameState !== STATE_PLAYING) {
        return;
    }
    
    // Update game objects
    // dt = delta time in seconds (time since last frame)
    ship.update(dt);
    
    // Update all asteroids
    for (const asteroid of asteroids) {
        asteroid.update(dt);
    }
    
    // Update invincibility timer
    if (invincible) {
        invincibleTimer -= dt;
        if (invincibleTimer <= 0) {
            invincible = false;
        }
    }
    
    // Update shooting cooldown
    if (shootCooldown > 0) {
        shootCooldown -= dt;
    }
    
    // Handle shooting (spacebar)
    if (keys.space && shootCooldown <= 0) {
        shoot();
    }
    
    // Update all bullets
    for (const bullet of bullets) {
        bullet.update(dt);
    }
    
    // Remove expired bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (bullets[i].isExpired()) {
            bullets.splice(i, 1);
        }
    }
    
    // Update all particles
    for (const particle of particles) {
        particle.update(dt);
    }
    
    // Remove expired particles
    for (let i = particles.length - 1; i >= 0; i--) {
        if (particles[i].isExpired()) {
            particles.splice(i, 1);
        }
    }
    
    // Check for collisions
    checkCollisions();
    
    // Check for level completion (all asteroids destroyed)
    if (asteroids.length === 0) {
        nextLevel();
    }
}

function render() {
    // Clear canvas with black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw based on game state
    if (gameState === STATE_LOADING) {
        drawLoadingScreen();
    } else if (gameState === STATE_TITLE) {
        drawTitleScreen();
    } else if (gameState === STATE_PLAYING) {
        drawGame();
    } else if (gameState === STATE_GAMEOVER) {
        drawGameOverScreen();
    }
}

function drawLoadingScreen() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Hyperspace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LOADING...', canvas.width / 2, canvas.height / 2);
}

function drawTitleScreen() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Hyperspace, monospace';
    ctx.textAlign = 'center';
    ctx.fontKerning = 'none';
    ctx.fillText('ASTEROIDS', canvas.width / 2, canvas.height / 2 - 50);
    
    // Show high score on title screen
    if (highScore > 0) {
        ctx.font = 'bold 16px Hyperspace, monospace';
        ctx.fillStyle = '#bbb';
        ctx.fontKerning = 'none';
        ctx.fillText(`HIGH SCORE: ${highScore}`, canvas.width / 2, canvas.height / 2 - 10);
    }
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Hyperspace, monospace';
    ctx.fontKerning = "none";
    ctx.fillText('PRESS SPACE TO START', canvas.width / 2, canvas.height / 2 + 30);
    
    ctx.font = 'bold 16px Hyperspace, monospace';
    ctx.fontKerning = "none";
    ctx.fillText('W TO THRUST, SPACE TO SHOOT', canvas.width / 2, canvas.height / 2 + 70);
    ctx.fillText('M TO TOGGLE AIM MODE', canvas.width / 2, canvas.height / 2 + 95);
    ctx.fillText('AIM WITH MOUSE OR A/D KEYS', canvas.width / 2, canvas.height / 2 + 120);

}

function drawGame() {
    // Draw game objects
    ship.draw();
    
    // Draw all asteroids
    for (const asteroid of asteroids) {
        asteroid.draw();
    }
    
    // Draw all bullets
    for (const bullet of bullets) {
        bullet.draw();
    }
    
    // Draw all particles
    for (const particle of particles) {
        particle.draw();
    }
    
    // Draw UI
    drawScore();
    drawLives();
    
    // Draw crosshair if in mouse mode
    if (controlMode === 'mouse') {
        drawCrosshair();
    }
}

function drawCrosshair() {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    
    // Draw small crosshair at mouse position
    const size = 10;
    
    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(mouseX - size, mouseY);
    ctx.lineTo(mouseX + size, mouseY);
    // Vertical line
    ctx.moveTo(mouseX, mouseY - size);
    ctx.lineTo(mouseX, mouseY + size);
    ctx.stroke();
    
    // Draw small circle
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 3, 0, Math.PI * 2);
    ctx.stroke();
}

function drawGameOverScreen() {
    // Draw the game in background
    drawGame();
    
    // Draw overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Hyperspace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.font = 'bold 20px Hyperspace, monospace';
    ctx.fillText(`SCORE: ${score}`, canvas.width / 2, canvas.height / 2);
    
    // Show high score (highlight if new record)
    if (score >= highScore && score > 0) {
        ctx.fillStyle = '#ff0';
        ctx.fillText('NEW HIGH SCORE!', canvas.width / 2, canvas.height / 2 + 35);
    } else {
        ctx.fillStyle = '#bbb';
        ctx.fillText(`HIGH SCORE: ${highScore}`, canvas.width / 2, canvas.height / 2 + 35);
    }
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Hyperspace, monospace';
    ctx.fillText('PRESS SPACE TO RESTART', canvas.width / 2, canvas.height / 2 + 75);
}

function gameLoop(currentTime) {
    // Schedule next frame
    requestAnimationFrame(gameLoop);

    // Calculate delta time in seconds
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Update and render (skip first frame where dt would be 0)
    if (dt > 0) {
        update(dt);
    }

    render();
}

// ============================================
// START GAME
// ============================================

// Load font before starting game
loadFont();

// Start game loop
requestAnimationFrame(gameLoop);
