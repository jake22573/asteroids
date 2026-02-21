# AGENTS.md

This document provides guidance for AI coding agents working in this repository.

## Project Overview

This is a classic Asteroids arcade game clone built with vanilla JavaScript, HTML5 Canvas, and CSS. No build tools, frameworks, or package managers are used.

## Build/Lint/Test Commands

This project has no build system. To run the game:

```bash
# Open in browser (any of these methods)
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows

# Or serve with a simple HTTP server
python3 -m http.server 8000
# Then open http://localhost:8000
```

### Testing

No automated test framework is configured. To test changes:

1. Open the game in a browser
2. Play through a few levels manually
3. Test all controls: WASD/arrow keys for movement, mouse for aiming, space to shoot
4. Verify collision detection, scoring, and game over/restart flow

### Linting/Type Checking

No linter or type checker is configured. If adding one, consider:
- ESLint with standard config
- No TypeScript - this is plain JavaScript

## Code Style Guidelines

### Imports/Exports

This project uses a single JavaScript file (`game.js`) loaded via `<script>` tag. No ES modules, CommonJS, or bundlers are used. All code shares the global scope.

### Formatting

- **Indentation**: 4 spaces (no tabs)
- **Line length**: No strict limit, but keep lines readable (~100 chars max)
- **Semicolons**: Always use semicolons at end of statements
- **Quotes**: Single quotes for strings, double quotes only when string contains single quotes
- **Trailing commas**: Not used

### Variable Declarations

- Use `const` for values that never change
- Use `let` for values that will be reassigned
- Never use `var`
- Declare variables at the top of their scope when possible

```javascript
// Good
const canvas = document.getElementById('gameCanvas');
let lastTime = 0;

// Bad
var x = 5;
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `Ship`, `Asteroid`, `Bullet` |
| Functions | camelCase | `playShootSound()`, `checkCollisions()` |
| Variables | camelCase | `ship`, `asteroids`, `shootCooldown` |
| Constants | UPPER_SNAKE_CASE | `KEY_LEFT`, `SHOOT_DELAY`, `STATE_PLAYING` |
| Private properties | No prefix (just use normally) | `this.x`, `this.vx` |

### Code Organization

The codebase uses section header comments to organize code:

```javascript
// ============================================
// SECTION NAME
// ============================================
```

Maintain this pattern when adding new major sections. Current sections:
- CANVAS SETUP
- GAME LOOP VARIABLES
- AUDIO SYSTEM
- INPUT HANDLING
- SHIP CLASS
- ASTEROID CLASS
- BULLET CLASS
- PARTICLE CLASS
- HELPER FUNCTIONS
- GAME FUNCTIONS
- START GAME

### Classes

- Define classes with ES6 `class` syntax
- Constructor should be first method
- Group related properties with comments
- Use `this.` for all instance properties

```javascript
class Entity {
    constructor(x, y) {
        // Position
        this.x = x;
        this.y = y;
        
        // Velocity (pixels per second)
        this.vx = 0;
        this.vy = 0;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw() {
        // Drawing code
    }
}
```

### Functions

- Use arrow functions for callbacks and event handlers
- Use function declarations for top-level functions
- Keep functions focused on a single responsibility
- Use early returns to reduce nesting

```javascript
// Good - function declaration
function spawnAsteroids(count, size) {
    for (let i = 0; i < count; i++) {
        asteroids.push(new Asteroid(x, y, size));
    }
}

// Good - arrow function for callbacks
document.addEventListener('keydown', (e) => {
    keys.left = true;
});
```

### Comments

- Use section headers (shown above) for major code blocks
- Add inline comments to explain non-obvious logic
- Document units in comments (e.g., "pixels per second", "radians")
- Keep comments concise and up-to-date

```javascript
// Frame-rate independent: friction is defined per frame at 60fps
const frictionFactor = Math.pow(this.friction, dt * 60);
```

### Error Handling

- This game uses minimal error handling
- Use guard clauses for early exits:

```javascript
function playShootSound() {
    if (!audioContext) return;
    // ... sound code
}
```

- Validate user input when needed
- No try/catch blocks currently used - add only for operations that can genuinely fail

### Canvas/Game Patterns

- Use `ctx.save()` and `ctx.restore()` when transforming
- Clear canvas at start of render: `ctx.fillRect(0, 0, canvas.width, canvas.height)`
- Use delta time (`dt`) for frame-rate independent updates
- Screen wrapping: check bounds and teleport to opposite side

### Colors

- Use hex colors for consistency: `#fff`, `#000`, `#f80`, `#bbb`
- Use `rgba()` only when alpha is needed

### Fonts

The game uses the Hyperspace font family:
- **Hyperspace.otf** (Regular) - base font
- **Hyperspace Bold.otf** (Bold) - all text rendered in bold weight

Fonts are defined in `styles.css` with `@font-face` declarations.

Canvas font format: `'bold 20px Hyperspace, monospace'` (always include monospace fallback)

Font loading:
```javascript
document.fonts.load('bold 36px Hyperspace').then(() => {
    fontLoaded = true;
    gameState = STATE_TITLE;
});
```

### Game Constants

Define game constants at module level with UPPER_SNAKE_CASE:

```javascript
const SHOOT_DELAY = 0.15;  // Seconds between shots
const SCORE_LARGE = 20;
const INITIAL_ASTEROIDS = 4;
```

## Architecture Notes

- Single-file architecture (`game.js`) - all game code in one file
- No state management library - uses simple global state
- Game states: `STATE_LOADING`, `STATE_TITLE`, `STATE_PLAYING`, `STATE_GAMEOVER`
- Entity system: Ship, Asteroid, Bullet, Particle classes
- Collision detection: simple circle-based collision
- Audio: Web Audio API for sound effects (no audio files)
- Persistence: localStorage for high score only
- Fonts: Located in `fonts/` directory, loaded via CSS @font-face

## Making Changes

1. For new game entities: Create a class with `constructor`, `update(dt)`, and `draw()` methods
2. For new features: Add constants first, then implementation, then integrate into game loop
3. For UI changes: Modify `drawScore()`, `drawLives()`, or create new draw functions
4. For audio: Add new sound function in AUDIO SYSTEM section, call from game logic
5. Always test by playing the game in browser after changes
