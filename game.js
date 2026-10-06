// ===================================================================
//  ROAD FURY — Cartoon Hypercasual Car Shooter
// ===================================================================

// --- Configuration -------------------------------------------------
const CFG = {
    W: 480,
    H: 800,
    ROAD_W: 260,
    LANES: 3,
    LANE_W: 80,
    ROAD_SPEED: 4,
    MAX_ROAD_SPEED: 9,
    PLAYER_SPEED: 5,
    BULLET_SPEED: 10,
    ENEMY_BASE_SPEED: 2,
    MAX_HEALTH: 5,
    START_AMMO: 30,
    SHOOT_COOLDOWN: 180,
    SHIELD_DURATION: 5000,
    WEAPON_DURATION: 8000,
    SPAWN_INTERVAL_MIN: 800,
    SPAWN_INTERVAL_MAX: 2200,
    PICKUP_INTERVAL_MIN: 3000,
    PICKUP_INTERVAL_MAX: 7000,
    TREE_INTERVAL: 120,
};

// --- State ---------------------------------------------------------
let canvas, ctx;
var game;
const keys = {};
const touch = { left: false, right: false, fire: false };

// --- Utility -------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const randPick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// --- Audio (Web Audio API) -----------------------------------------
class AudioManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }
    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    _tone(freq, dur, type = 'square', vol = 0.12) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + dur);
    }
    shoot() {
        this._tone(880, 0.06, 'square', 0.08);
        this._tone(660, 0.04, 'square', 0.05);
    }
    hit() {
        this._tone(220, 0.12, 'sawtooth', 0.1);
        this._tone(160, 0.15, 'square', 0.06);
    }
    explode() {
        if (!this.enabled || !this.ctx) return;
        const bufSize = this.ctx.sampleRate * 0.3;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
        const src = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        src.buffer = buf;
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
    }
    pickup() {
        this._tone(523, 0.06, 'sine', 0.1);
        setTimeout(() => this._tone(659, 0.06, 'sine', 0.1), 50);
        setTimeout(() => this._tone(784, 0.08, 'sine', 0.1), 100);
    }
    shield() {
        this._tone(392, 0.1, 'sine', 0.08);
        setTimeout(() => this._tone(523, 0.1, 'sine', 0.08), 80);
        setTimeout(() => this._tone(784, 0.15, 'sine', 0.08), 160);
    }
    damage() {
        this._tone(150, 0.2, 'sawtooth', 0.12);
    }
    gameOver() {
        this._tone(440, 0.2, 'sine', 0.1);
        setTimeout(() => this._tone(370, 0.2, 'sine', 0.1), 200);
        setTimeout(() => this._tone(330, 0.3, 'sine', 0.1), 400);
        setTimeout(() => this._tone(262, 0.5, 'sine', 0.1), 600);
    }
}
const audio = new AudioManager();

// --- Colors --------------------------------------------------------
const COLORS = {
    grass1: '#6BBF59',
    grass2: '#5DAF4C',
    road: '#6C7A89',
    roadEdge: '#5A6478',
    roadLine: '#FFFFFF',
    player: '#4A90D9',
    playerDark: '#3572AD',
    playerLight: '#6BAAE8',
    enemies: [
        { body: '#E85D75', dark: '#C04458' },
        { body: '#F5A623', dark: '#D08A15' },
        { body: '#9B6CB8', dark: '#7D50A0' },
        { body: '#55B87A', dark: '#3E9D60' },
        { body: '#E8895C', dark: '#C56E3F' },
    ],
    bullet: '#FFD93D',
    bulletGlow: 'rgba(255, 217, 61, 0.3)',
    muzzle: '#FFF5CC',
    windshield: '#B8D9F2',
    windshieldDark: '#8BBAD9',
    wheel: '#3A3A3A',
    headlight: '#FFF3CD',
    taillight: '#E85D75',
    pickupAmmo: '#FF8C42',
    pickupWeapon: '#E85D75',
    pickupShield: '#5BC0DE',
    tree: '#4A8F3A',
    treeTrunk: '#8B6B47',
    treeShadow: 'rgba(0,0,0,0.12)',
    bush: '#5DAF4C',
    outline: '#2C3A4B',
};

// --- Particle System -----------------------------------------------
class Particle {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.vx = opts.vx || rand(-3, 3);
        this.vy = opts.vy || rand(-4, 1);
        this.size = opts.size || rand(3, 8);
        this.color = opts.color || '#FFD93D';
        this.life = opts.life || rand(20, 40);
        this.maxLife = this.life;
        this.gravity = opts.gravity || 0.08;
        this.shape = opts.shape || 'circle'; // 'circle', 'star', 'square'
        this.rotation = rand(0, Math.PI * 2);
        this.rotSpeed = rand(-0.2, 0.2);
        this.friction = opts.friction || 0.98;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.rotation += this.rotSpeed;
        this.life--;
        return this.life > 0;
    }
    draw(ctx) {
        const alpha = clamp(this.life / this.maxLife, 0, 1);
        const s = this.size * (0.5 + 0.5 * alpha);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        if (this.shape === 'star') {
            drawStar(ctx, 0, 0, 5, s, s * 0.45);
        } else if (this.shape === 'square') {
            ctx.fillRect(-s / 2, -s / 2, s, s);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        ctx.lineTo(cx + Math.cos(rot) * r, cy + Math.sin(rot) * r);
        rot += step;
    }
    ctx.closePath();
    ctx.fill();
}

// --- Floating Text -------------------------------------------------
class FloatingText {
    constructor(x, y, text, color = '#FFFFFF', size = 20) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.size = size;
        this.life = 50;
        this.maxLife = 50;
        this.vy = -2;
        this.scale = 0;
    }
    update() {
        this.y += this.vy;
        this.vy *= 0.96;
        this.life--;
        // Bounce in
        const t = 1 - this.life / this.maxLife;
        if (t < 0.15) {
            this.scale = t / 0.15;
            this.scale = 1 + 0.3 * Math.sin(this.scale * Math.PI);
        } else {
            this.scale = 1;
        }
        return this.life > 0;
    }
    draw(ctx) {
        const alpha = clamp(this.life / (this.maxLife * 0.3), 0, 1);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.globalAlpha = alpha;
        ctx.font = `${this.size}px Outfit, sans-serif`;
        ctx.fontWeight = '800';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Outline
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, 0, 0);
        // Fill
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, 0, 0);
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

// --- Explosion Effect ----------------------------------------------
function spawnExplosion(game, x, y, big = false) {
    const count = big ? 30 : 18;
    const colors = ['#FF6B35', '#FFD93D', '#FF4757', '#FFA502', '#FFFFFF'];
    for (let i = 0; i < count; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(1, big ? 6 : 4);
        game.particles.push(new Particle(x, y, {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: rand(3, big ? 10 : 7),
            color: randPick(colors),
            life: rand(15, 40),
            shape: randPick(['circle', 'star', 'square']),
            gravity: 0.05,
            friction: 0.96,
        }));
    }
    // Smoke
    for (let i = 0; i < (big ? 10 : 5); i++) {
        game.particles.push(new Particle(x + rand(-10, 10), y + rand(-10, 10), {
            vx: rand(-1, 1),
            vy: rand(-2, 0),
            size: rand(8, 16),
            color: `rgba(100,100,100,0.4)`,
            life: rand(30, 55),
            shape: 'circle',
            gravity: -0.03,
            friction: 0.97,
        }));
    }
}

// --- Sparkle Effect ------------------------------------------------
function spawnSparkle(game, x, y, color = '#FFD93D') {
    for (let i = 0; i < 8; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(1, 3);
        game.particles.push(new Particle(x, y, {
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: rand(2, 5),
            color: color,
            life: rand(15, 30),
            shape: 'star',
            gravity: 0.02,
            friction: 0.95,
        }));
    }
}

// --- Draw Road & Environment ---------------------------------------
class Road {
    constructor() {
        this.offset = 0;
        this.treeOffset = 0;
        this.trees = [];
        this.generateTrees();
    }
    generateTrees() {
        this.trees = [];
        const roadLeft = (CFG.W - CFG.ROAD_W) / 2;
        const roadRight = roadLeft + CFG.ROAD_W;
        for (let y = -60; y < CFG.H + 60; y += rand(50, 100)) {
            // Left side trees
            if (Math.random() > 0.3) {
                this.trees.push({
                    x: rand(10, roadLeft - 25),
                    y: y,
                    size: rand(14, 24),
                    type: Math.random() > 0.4 ? 'tree' : 'bush',
                });
            }
            // Right side trees
            if (Math.random() > 0.3) {
                this.trees.push({
                    x: rand(roadRight + 25, CFG.W - 10),
                    y: y,
                    size: rand(14, 24),
                    type: Math.random() > 0.4 ? 'tree' : 'bush',
                });
            }
        }
    }
    update(speed) {
        this.offset = (this.offset + speed) % 40;
        this.treeOffset = (this.treeOffset + speed) % (CFG.H + 120);
    }
    draw(ctx) {
        const roadLeft = (CFG.W - CFG.ROAD_W) / 2;
        const roadRight = roadLeft + CFG.ROAD_W;

        // Grass background
        ctx.fillStyle = COLORS.grass1;
        ctx.fillRect(0, 0, CFG.W, CFG.H);

        // Grass stripes for texture
        ctx.fillStyle = COLORS.grass2;
        for (let y = -40 + (this.offset * 2) % 40; y < CFG.H; y += 40) {
            ctx.fillRect(0, y, CFG.W, 20);
        }

        // Draw trees (behind road)
        this.trees.forEach(t => {
            const ty = ((t.y + this.treeOffset) % (CFG.H + 120)) - 60;
            this._drawTree(ctx, t.x, ty, t.size, t.type);
        });

        // Road shadow
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(roadLeft - 6, 0, CFG.ROAD_W + 12, CFG.H);

        // Road surface
        ctx.fillStyle = COLORS.road;
        ctx.fillRect(roadLeft, 0, CFG.ROAD_W, CFG.H);

        // Road edge lines
        ctx.fillStyle = COLORS.roadLine;
        ctx.fillRect(roadLeft, 0, 4, CFG.H);
        ctx.fillRect(roadRight - 4, 0, 4, CFG.H);

        // Dashed center lines
        ctx.fillStyle = COLORS.roadLine;
        const laneWidth = CFG.ROAD_W / CFG.LANES;
        for (let lane = 1; lane < CFG.LANES; lane++) {
            const lx = roadLeft + lane * laneWidth - 2;
            for (let y = -40 + this.offset; y < CFG.H; y += 40) {
                ctx.fillRect(lx, y, 4, 20);
            }
        }

        // Speed lines at road edges
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        for (let y = -40 + (this.offset * 3) % 60; y < CFG.H; y += 60) {
            ctx.beginPath();
            ctx.moveTo(roadLeft + 10, y);
            ctx.lineTo(roadLeft + 10, y + 20);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(roadRight - 10, y);
            ctx.lineTo(roadRight - 10, y + 20);
            ctx.stroke();
        }
    }
    _drawTree(ctx, x, y, size, type) {
        ctx.save();
        ctx.translate(x, y);
        if (type === 'tree') {
            // Shadow
            ctx.fillStyle = COLORS.treeShadow;
            ctx.beginPath();
            ctx.ellipse(3, size * 0.6 + 3, size * 0.7, size * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            // Trunk
            ctx.fillStyle = COLORS.treeTrunk;
            ctx.fillRect(-3, 0, 6, size * 0.5);
            // Canopy
            ctx.fillStyle = COLORS.tree;
            ctx.strokeStyle = '#3A7A2D';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, -size * 0.2, size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Highlight on canopy
            ctx.fillStyle = '#6BBF59';
            ctx.beginPath();
            ctx.arc(-size * 0.15, -size * 0.35, size * 0.25, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Bush
            ctx.fillStyle = COLORS.treeShadow;
            ctx.beginPath();
            ctx.ellipse(2, 2, size * 0.6, size * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = COLORS.bush;
            ctx.strokeStyle = '#4A9F3C';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#74C466';
            ctx.beginPath();
            ctx.arc(-size * 0.12, -size * 0.12, size * 0.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// --- Draw Car (Cartoon Style) --------------------------------------
function drawCar(ctx, x, y, w, h, color, darkColor, facingUp = true, damage = 0) {
    ctx.save();
    ctx.translate(x, y);

    const cw = w;
    const ch = h;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cw / 2 + 3, ch + 2, cw * 0.45, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    ctx.fillStyle = COLORS.wheel;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.5;
    const wheelW = 7, wheelH = 14;
    // Left wheels
    roundRect(ctx, -3, 6, wheelW, wheelH, 2); ctx.fill(); ctx.stroke();
    roundRect(ctx, -3, ch - 6 - wheelH, wheelW, wheelH, 2); ctx.fill(); ctx.stroke();
    // Right wheels
    roundRect(ctx, cw - wheelW + 3, 6, wheelW, wheelH, 2); ctx.fill(); ctx.stroke();
    roundRect(ctx, cw - wheelW + 3, ch - 6 - wheelH, wheelW, wheelH, 2); ctx.fill(); ctx.stroke();

    // Body
    ctx.fillStyle = color;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 0, 0, cw, ch, 10);
    ctx.fill();
    ctx.stroke();

    // Body shading (darker bottom half)
    ctx.fillStyle = darkColor;
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, 0, 0, cw, ch, 10);
    ctx.clip();
    ctx.fillRect(0, ch * 0.55, cw, ch * 0.45);
    ctx.restore();

    // Body highlight (top shine)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, 0, 0, cw, ch, 10);
    ctx.clip();
    ctx.fillRect(cw * 0.15, 4, cw * 0.35, ch * 0.4);
    ctx.restore();

    if (facingUp) {
        // Windshield (front = top)
        ctx.fillStyle = COLORS.windshield;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1.5;
        roundRect(ctx, cw * 0.18, ch * 0.12, cw * 0.64, ch * 0.22, 5);
        ctx.fill();
        ctx.stroke();
        // Windshield shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(cw * 0.22, ch * 0.14, cw * 0.2, ch * 0.08);

        // Rear window
        ctx.fillStyle = COLORS.windshieldDark;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1.5;
        roundRect(ctx, cw * 0.22, ch * 0.62, cw * 0.56, ch * 0.14, 4);
        ctx.fill();
        ctx.stroke();

        // Headlights
        ctx.fillStyle = COLORS.headlight;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cw * 0.25, 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cw * 0.75, 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Taillights
        ctx.fillStyle = COLORS.taillight;
        ctx.beginPath(); ctx.arc(cw * 0.25, ch - 5, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cw * 0.75, ch - 5, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
        // Enemy facing down — flip windows
        ctx.fillStyle = COLORS.windshield;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1.5;
        roundRect(ctx, cw * 0.18, ch * 0.62, cw * 0.64, ch * 0.22, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(cw * 0.22, ch * 0.64, cw * 0.2, ch * 0.08);

        ctx.fillStyle = COLORS.windshieldDark;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1.5;
        roundRect(ctx, cw * 0.22, ch * 0.18, cw * 0.56, ch * 0.14, 4);
        ctx.fill();
        ctx.stroke();

        // Headlights (bottom)
        ctx.fillStyle = COLORS.headlight;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cw * 0.25, ch - 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cw * 0.75, ch - 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Taillights (top)
        ctx.fillStyle = COLORS.taillight;
        ctx.beginPath(); ctx.arc(cw * 0.25, 5, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(cw * 0.75, 5, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }

    // Damage cracks
    if (damage > 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < damage; i++) {
            ctx.beginPath();
            ctx.moveTo(rand(5, cw - 5), rand(5, ch - 5));
            ctx.lineTo(rand(5, cw - 5), rand(5, ch - 5));
            ctx.stroke();
        }
    }

    ctx.restore();
}

// --- Player --------------------------------------------------------
class Player {
    constructor() {
        this.w = 44;
        this.h = 68;
        this.x = CFG.W / 2 - this.w / 2;
        this.y = CFG.H - 140;
        this.targetX = this.x;
        this.health = CFG.MAX_HEALTH;
        this.ammo = CFG.START_AMMO;
        this.weaponLevel = 1;
        this.weaponTimer = 0;
        this.shieldActive = false;
        this.shieldTimer = 0;
        this.shieldPulse = 0;
        this.shootCooldown = 0;
        this.invulnTimer = 0;
        this.tilt = 0;
        this.bobPhase = 0;
    }
    update(dt) {
        const roadLeft = (CFG.W - CFG.ROAD_W) / 2 + 8;
        const roadRight = (CFG.W + CFG.ROAD_W) / 2 - 8 - this.w;

        // Movement
        let moveDir = 0;
        if (keys['ArrowLeft'] || keys['KeyA'] || touch.left) moveDir = -1;
        if (keys['ArrowRight'] || keys['KeyD'] || touch.right) moveDir = 1;

        this.targetX += moveDir * CFG.PLAYER_SPEED;
        this.targetX = clamp(this.targetX, roadLeft, roadRight);
        this.x = lerp(this.x, this.targetX, 0.18);

        // Tilt
        this.tilt = lerp(this.tilt, moveDir * 0.08, 0.12);

        // Bob
        this.bobPhase += 0.05;

        // Cooldowns
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        // Shield timer
        if (this.shieldActive) {
            this.shieldTimer -= dt;
            this.shieldPulse += 0.1;
            if (this.shieldTimer <= 0) {
                this.shieldActive = false;
                this.shieldTimer = 0;
            }
        }

        // Weapon timer
        if (this.weaponLevel > 1) {
            this.weaponTimer -= dt;
            if (this.weaponTimer <= 0) {
                this.weaponLevel = 1;
                this.weaponTimer = 0;
            }
        }
    }
    draw(ctx) {
        ctx.save();
        const bob = Math.sin(this.bobPhase) * 1.5;
        ctx.translate(this.x + this.w / 2, this.y + this.h / 2 + bob);
        ctx.rotate(this.tilt);
        ctx.translate(-this.w / 2, -this.h / 2);

        // Invuln blink
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer / 80) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        drawCar(ctx, 0, 0, this.w, this.h, COLORS.player, COLORS.playerDark, true);

        // Racing stripe
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = ctx.globalAlpha * 0.5;
        ctx.fillRect(this.w / 2 - 2, 4, 4, this.h - 8);
        ctx.globalAlpha = 1;

        ctx.restore();

        // Shield bubble
        if (this.shieldActive) {
            ctx.save();
            const pulse = 1 + Math.sin(this.shieldPulse) * 0.06;
            const cx = this.x + this.w / 2;
            const cy = this.y + this.h / 2 + bob;
            const shieldR = Math.max(this.w, this.h) * 0.55 * pulse;

            ctx.strokeStyle = COLORS.pickupShield;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5 + Math.sin(this.shieldPulse * 1.5) * 0.2;
            ctx.beginPath();
            ctx.arc(cx, cy, shieldR, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = 'rgba(91, 192, 222, 0.08)';
            ctx.globalAlpha = 0.3;
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }
    shoot(game) {
        if (this.shootCooldown > 0 || this.ammo <= 0) return;

        const cx = this.x + this.w / 2;
        const topY = this.y;

        audio.shoot();

        if (this.weaponLevel === 1) {
            game.bullets.push(new Bullet(cx, topY));
            this.ammo--;
        } else if (this.weaponLevel === 2) {
            game.bullets.push(new Bullet(cx - 10, topY));
            game.bullets.push(new Bullet(cx + 10, topY));
            this.ammo -= 2;
        } else {
            game.bullets.push(new Bullet(cx, topY));
            game.bullets.push(new Bullet(cx - 14, topY + 6, -0.8));
            game.bullets.push(new Bullet(cx + 14, topY + 6, 0.8));
            this.ammo -= 3;
        }

        this.ammo = Math.max(0, this.ammo);
        this.shootCooldown = CFG.SHOOT_COOLDOWN;

        // Muzzle flash particles
        for (let i = 0; i < 4; i++) {
            game.particles.push(new Particle(cx, topY, {
                vx: rand(-1, 1),
                vy: rand(-3, -1),
                size: rand(2, 4),
                color: COLORS.muzzle,
                life: rand(5, 12),
                shape: 'circle',
                gravity: 0,
            }));
        }
    }
    takeDamage(game) {
        if (this.invulnTimer > 0 || this.shieldActive) {
            if (this.shieldActive) {
                spawnSparkle(game, this.x + this.w / 2, this.y + this.h / 2, COLORS.pickupShield);
            }
            return;
        }
        this.health--;
        this.invulnTimer = 1200;
        audio.damage();
        game.screenShake = 8;
        game.screenFlash = 6;

        if (this.health <= 0) {
            game.gameOver();
        }
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get hitbox() {
        return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 };
    }
}

// --- Bullet --------------------------------------------------------
class Bullet {
    constructor(x, y, spreadX = 0) {
        this.x = x;
        this.y = y;
        this.w = 6;
        this.h = 14;
        this.vy = -CFG.BULLET_SPEED;
        this.vx = spreadX;
        this.trail = [];
    }
    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 4) this.trail.shift();
        this.x += this.vx;
        this.y += this.vy;
        return this.y > -20;
    }
    draw(ctx) {
        // Trail
        ctx.fillStyle = COLORS.bulletGlow;
        this.trail.forEach((p, i) => {
            const alpha = (i + 1) / this.trail.length * 0.3;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Bullet glow
        ctx.fillStyle = COLORS.bulletGlow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Bullet body
        ctx.fillStyle = COLORS.bullet;
        ctx.strokeStyle = '#E8A800';
        ctx.lineWidth = 1.5;
        roundRect(ctx, this.x - this.w / 2, this.y - this.h / 2, this.w, this.h, 3);
        ctx.fill();
        ctx.stroke();

        // Shine
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(this.x - 1, this.y - this.h / 2 + 2, 2, 4);
        ctx.globalAlpha = 1;
    }
    get hitbox() {
        return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    }
}

// --- Enemy ---------------------------------------------------------
class Enemy {
    constructor(x, lane, type = 0) {
        this.type = type;
        this.w = type === 2 ? 52 : 42;
        this.h = type === 2 ? 76 : 64;
        this.x = x - this.w / 2;
        this.y = -this.h - 20;
        this.lane = lane;
        this.speed = CFG.ENEMY_BASE_SPEED + (type === 1 ? 1.5 : 0);
        this.maxHp = type === 2 ? 3 : 1;
        this.hp = this.maxHp;
        this.colorSet = COLORS.enemies[type % COLORS.enemies.length];
        this.wobble = rand(0, Math.PI * 2);
        this.wobbleAmp = rand(0.3, 0.8);
        this.flashTimer = 0;
    }
    update(roadSpeed) {
        this.y += this.speed + roadSpeed;
        this.wobble += 0.03;
        if (this.flashTimer > 0) this.flashTimer--;
        return this.y < CFG.H + 40;
    }
    draw(ctx) {
        ctx.save();
        const wobbleX = Math.sin(this.wobble) * this.wobbleAmp;
        ctx.translate(wobbleX, 0);

        if (this.flashTimer > 0 && this.flashTimer % 4 < 2) {
            ctx.globalAlpha = 0.6;
        }

        drawCar(ctx, this.x, this.y, this.w, this.h,
            this.colorSet.body, this.colorSet.dark, false,
            this.maxHp - this.hp);

        // HP bar for tough enemies
        if (this.maxHp > 1) {
            const barW = this.w - 8;
            const barH = 5;
            const barX = this.x + 4;
            const barY = this.y - 10;
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            roundRect(ctx, barX, barY, barW, barH, 2);
            ctx.fill();
            ctx.fillStyle = this.hp > 1 ? '#5CB85C' : '#E85D75';
            roundRect(ctx, barX, barY, barW * (this.hp / this.maxHp), barH, 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
    takeDamage(game) {
        this.hp--;
        this.flashTimer = 12;
        audio.hit();
        if (this.hp <= 0) {
            return true; // destroyed
        }
        return false;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get hitbox() {
        return { x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 };
    }
}

// --- Pickup --------------------------------------------------------
class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'ammo', 'weapon', 'shield'
        this.size = 22;
        this.collected = false;
        this.phase = rand(0, Math.PI * 2);
        this.collectAnim = 0;
    }
    update(roadSpeed) {
        this.y += roadSpeed + 1;
        this.phase += 0.06;
        if (this.collected) {
            this.collectAnim += 0.15;
            return this.collectAnim < 1;
        }
        return this.y < CFG.H + 40;
    }
    draw(ctx) {
        ctx.save();
        const bob = Math.sin(this.phase) * 4;
        const pulse = 1 + Math.sin(this.phase * 2) * 0.06;

        if (this.collected) {
            const t = this.collectAnim;
            ctx.globalAlpha = 1 - t;
            ctx.translate(this.x, this.y - t * 40 + bob);
            ctx.scale(1 + t * 0.5, 1 + t * 0.5);
        } else {
            ctx.translate(this.x, this.y + bob);
            ctx.scale(pulse, pulse);
        }

        // Glow
        const glowColor = this.type === 'ammo' ? 'rgba(255,140,66,0.2)'
            : this.type === 'weapon' ? 'rgba(232,93,117,0.2)'
            : 'rgba(91,192,222,0.2)';
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.size + 6, 0, Math.PI * 2);
        ctx.fill();

        // Background circle
        const bgColor = this.type === 'ammo' ? COLORS.pickupAmmo
            : this.type === 'weapon' ? COLORS.pickupWeapon
            : COLORS.pickupShield;
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(-3, -4, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.font = 'bold 18px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (this.type === 'ammo') {
            // Bullet icon
            ctx.fillStyle = '#FFFFFF';
            roundRect(ctx, -3, -10, 6, 14, 2);
            ctx.fill();
            ctx.fillStyle = '#FFE0B5';
            roundRect(ctx, -4, 2, 8, 8, 2);
            ctx.fill();
        } else if (this.type === 'weapon') {
            // Lightning bolt
            ctx.fillText('⚡', 0, 1);
        } else {
            // Shield icon
            ctx.fillText('🛡️', 0, 1);
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
    get hitbox() {
        return { x: this.x - this.size, y: this.y - this.size, w: this.size * 2, h: this.size * 2 };
    }
}

// --- AABB Collision ------------------------------------------------
function aabbCheck(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
}

// --- Main Game Class -----------------------------------------------
class Game {
    constructor() {
        this.state = 'menu'; // 'menu', 'playing', 'gameover'
        this.road = new Road();
        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.pickups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('roadfury_best') || '0');
        this.kills = 0;
        this.pickupsCollected = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.difficulty = 1;
        this.spawnTimer = 0;
        this.pickupTimer = 0;
        this.roadSpeed = CFG.ROAD_SPEED;
        this.screenShake = 0;
        this.screenFlash = 0;
        this.hitlag = 0;
        this.time = 0;
        this.lastTime = 0;
        this._raf = null;

        // DOM refs
        this.menuScreen = document.getElementById('menu-screen');
        this.gameoverScreen = document.getElementById('gameover-screen');
        this.hud = document.getElementById('hud');
        this.mobileControls = document.getElementById('mobile-controls');

        this.hudScore = document.getElementById('hud-score-value');
        this.hudAmmo = document.getElementById('hud-ammo');
        this.hudWeapon = document.getElementById('hud-weapon');
        this.hudHealthFill = document.getElementById('hud-health-fill');
        this.hudShieldFill = document.getElementById('hud-shield-fill');
        this.hudCombo = document.getElementById('hud-combo');
        this.hudComboValue = document.getElementById('hud-combo-value');

        this.finalScore = document.getElementById('final-score');
        this.bestScoreEl = document.getElementById('best-score');
        this.statKills = document.getElementById('stat-kills');
        this.statPickups = document.getElementById('stat-pickups');
        this.statCombo = document.getElementById('stat-combo');

        // Update best score display
        this.bestScoreEl.textContent = this.bestScore;
    }

    start() {
        audio.init();
        audio.resume();

        this.state = 'playing';
        this.player = new Player();
        this.enemies = [];
        this.bullets = [];
        this.pickups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.score = 0;
        this.kills = 0;
        this.pickupsCollected = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboTimer = 0;
        this.difficulty = 1;
        this.spawnTimer = 2000;
        this.pickupTimer = 3000;
        this.roadSpeed = CFG.ROAD_SPEED;
        this.screenShake = 0;
        this.screenFlash = 0;
        this.hitlag = 0;
        this.time = 0;

        this.menuScreen.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.hud.classList.remove('hidden');

        // Show mobile controls on touch devices
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            this.mobileControls.classList.remove('hidden');
        }

        if (!this._raf) {
            this.lastTime = performance.now();
            this._loop();
        }
    }

    gameOver() {
        this.state = 'gameover';
        audio.gameOver();

        // Big explosion
        spawnExplosion(this, this.player.cx, this.player.cy, true);
        this.screenShake = 15;

        // Update best
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('roadfury_best', this.bestScore.toString());
        }

        // Show gameover after a short delay
        setTimeout(() => {
            this.hud.classList.add('hidden');
            this.mobileControls.classList.add('hidden');
            this.gameoverScreen.classList.remove('hidden');
            this.finalScore.textContent = this.score;
            this.bestScoreEl.textContent = this.bestScore;
            this.statKills.textContent = this.kills;
            this.statPickups.textContent = this.pickupsCollected;
            this.statCombo.textContent = this.maxCombo;
        }, 1200);
    }

    _loop() {
        this._raf = requestAnimationFrame(() => this._loop());
        const now = performance.now();
        const dt = Math.min(now - this.lastTime, 33.33); // Cap at 30fps min
        this.lastTime = now;

        if (this.state === 'playing') {
            if (this.hitlag > 0) {
                this.hitlag -= dt;
                this._render();
                return;
            }
            this._update(dt);
        }
        this._render();
    }

    _update(dt) {
        this.time += dt;

        // Difficulty ramp
        this.difficulty = 1 + this.time / 60000; // Increases every minute
        this.roadSpeed = Math.min(CFG.MAX_ROAD_SPEED, CFG.ROAD_SPEED + this.difficulty * 0.4);

        // Road scroll
        this.road.update(this.roadSpeed);

        // Player
        this.player.update(dt);

        // Auto-detect shooting intent
        if (keys['Space'] || keys[' '] || touch.fire) {
            this.player.shoot(this);
        }

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }

        // Spawn enemies
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this._spawnEnemy();
            const interval = rand(
                CFG.SPAWN_INTERVAL_MIN / this.difficulty,
                CFG.SPAWN_INTERVAL_MAX / this.difficulty
            );
            this.spawnTimer = Math.max(400, interval);
        }

        // Spawn pickups
        this.pickupTimer -= dt;
        if (this.pickupTimer <= 0) {
            this._spawnPickup();
            this.pickupTimer = rand(CFG.PICKUP_INTERVAL_MIN, CFG.PICKUP_INTERVAL_MAX);
        }

        // Update bullets
        this.bullets = this.bullets.filter(b => b.update());

        // Update enemies
        this.enemies = this.enemies.filter(e => e.update(this.roadSpeed));

        // Update pickups
        this.pickups = this.pickups.filter(p => p.update(this.roadSpeed));

        // Update particles
        this.particles = this.particles.filter(p => p.update());

        // Update floating texts
        this.floatingTexts = this.floatingTexts.filter(t => t.update());

        // Screen shake decay
        if (this.screenShake > 0) this.screenShake *= 0.88;
        if (this.screenShake < 0.3) this.screenShake = 0;

        // Screen flash decay
        if (this.screenFlash > 0) this.screenFlash -= 0.3;

        // === Collisions ===

        // Bullets vs Enemies
        for (let bi = this.bullets.length - 1; bi >= 0; bi--) {
            const bullet = this.bullets[bi];
            for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
                const enemy = this.enemies[ei];
                if (aabbCheck(bullet.hitbox, enemy.hitbox)) {
                    // Remove bullet
                    this.bullets.splice(bi, 1);

                    // Damage enemy
                    const destroyed = enemy.takeDamage(this);
                    if (destroyed) {
                        // Explosion
                        spawnExplosion(this, enemy.cx, enemy.cy, enemy.type === 2);
                        audio.explode();
                        this.screenShake = enemy.type === 2 ? 10 : 5;
                        this.hitlag = 40; // Freeze frame

                        // Score
                        this.combo++;
                        this.comboTimer = 2000;
                        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
                        const points = (enemy.type === 2 ? 50 : (enemy.type === 1 ? 30 : 20)) * Math.max(1, this.combo);
                        this.score += points;
                        this.kills++;

                        this.floatingTexts.push(new FloatingText(
                            enemy.cx, enemy.cy,
                            `+${points}`,
                            this.combo > 1 ? '#FFD93D' : '#FFFFFF',
                            this.combo > 1 ? 24 : 18
                        ));

                        if (this.combo > 1) {
                            this.floatingTexts.push(new FloatingText(
                                enemy.cx, enemy.cy + 24,
                                `x${this.combo} COMBO!`,
                                '#FF6B35',
                                16
                            ));
                        }

                        this.enemies.splice(ei, 1);
                    } else {
                        // Hit spark
                        spawnSparkle(this, bullet.x, bullet.y, '#FFD93D');
                    }
                    break;
                }
            }
        }

        // Player vs Enemies (collision)
        for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
            const enemy = this.enemies[ei];
            if (aabbCheck(this.player.hitbox, enemy.hitbox)) {
                this.player.takeDamage(this);
                spawnExplosion(this, enemy.cx, enemy.cy, false);
                audio.explode();
                this.enemies.splice(ei, 1);
                this.combo = 0;
            }
        }

        // Player vs Pickups
        for (let pi = this.pickups.length - 1; pi >= 0; pi--) {
            const pickup = this.pickups[pi];
            if (pickup.collected) continue;
            if (aabbCheck(this.player.hitbox, pickup.hitbox)) {
                pickup.collected = true;
                this.pickupsCollected++;
                audio.pickup();
                spawnSparkle(this, pickup.x, pickup.y,
                    pickup.type === 'ammo' ? COLORS.pickupAmmo
                    : pickup.type === 'weapon' ? COLORS.pickupWeapon
                    : COLORS.pickupShield
                );

                if (pickup.type === 'ammo') {
                    this.player.ammo += 15;
                    this.floatingTexts.push(new FloatingText(pickup.x, pickup.y, '+15 🔥', COLORS.pickupAmmo, 18));
                } else if (pickup.type === 'weapon') {
                    this.player.weaponLevel = Math.min(3, this.player.weaponLevel + 1);
                    this.player.weaponTimer = CFG.WEAPON_DURATION;
                    this.floatingTexts.push(new FloatingText(pickup.x, pickup.y, `LV.${this.player.weaponLevel} ⚡`, COLORS.pickupWeapon, 20));
                } else if (pickup.type === 'shield') {
                    this.player.shieldActive = true;
                    this.player.shieldTimer = CFG.SHIELD_DURATION;
                    audio.shield();
                    this.floatingTexts.push(new FloatingText(pickup.x, pickup.y, 'BOUCLIER! 🛡️', COLORS.pickupShield, 20));
                }
            }
        }

        // === Update HUD ===
        this._updateHUD();
    }

    _spawnEnemy() {
        const roadLeft = (CFG.W - CFG.ROAD_W) / 2;
        const laneW = CFG.ROAD_W / CFG.LANES;
        const lane = randInt(0, CFG.LANES - 1);
        const laneCenter = roadLeft + lane * laneW + laneW / 2;

        // Choose type based on difficulty
        let type = 0;
        if (this.difficulty > 1.5 && Math.random() < 0.25) type = 1; // fast
        if (this.difficulty > 2.5 && Math.random() < 0.15) type = 2; // tough

        const enemy = new Enemy(laneCenter, lane, type);
        enemy.speed += rand(0, this.difficulty * 0.5);
        this.enemies.push(enemy);
    }

    _spawnPickup() {
        const roadLeft = (CFG.W - CFG.ROAD_W) / 2;
        const laneW = CFG.ROAD_W / CFG.LANES;
        const lane = randInt(0, CFG.LANES - 1);
        const laneCenter = roadLeft + lane * laneW + laneW / 2;

        const r = Math.random();
        let type;
        if (r < 0.5) type = 'ammo';
        else if (r < 0.8) type = 'weapon';
        else type = 'shield';

        this.pickups.push(new Pickup(laneCenter, -30, type));
    }

    _updateHUD() {
        this.hudScore.textContent = this.score;
        this.hudAmmo.textContent = this.player.ammo;
        this.hudWeapon.textContent = `Lv.${this.player.weaponLevel}`;
        this.hudHealthFill.style.width = `${(this.player.health / CFG.MAX_HEALTH) * 100}%`;

        if (this.player.shieldActive) {
            this.hudShieldFill.style.width = `${(this.player.shieldTimer / CFG.SHIELD_DURATION) * 100}%`;
        } else {
            this.hudShieldFill.style.width = '0%';
        }

        // Combo display
        if (this.combo > 1) {
            this.hudCombo.classList.remove('hidden');
            this.hudComboValue.textContent = `x${this.combo}`;
        } else {
            this.hudCombo.classList.add('hidden');
        }
    }

    _render() {
        ctx.save();

        // Screen shake
        if (this.screenShake > 0) {
            const sx = rand(-this.screenShake, this.screenShake);
            const sy = rand(-this.screenShake, this.screenShake);
            ctx.translate(sx, sy);
        }

        // Draw road & environment
        this.road.draw(ctx);

        // Draw pickups
        this.pickups.forEach(p => p.draw(ctx));

        // Draw enemies
        this.enemies.forEach(e => e.draw(ctx));

        // Draw bullets
        this.bullets.forEach(b => b.draw(ctx));

        // Draw player
        if (this.state === 'playing' && this.player) {
            this.player.draw(ctx);
        }

        // Draw particles
        this.particles.forEach(p => p.draw(ctx));

        // Draw floating texts
        this.floatingTexts.forEach(t => t.draw(ctx));

        // Screen flash (damage)
        if (this.screenFlash > 0) {
            ctx.fillStyle = `rgba(232, 93, 117, ${this.screenFlash * 0.04})`;
            ctx.fillRect(-20, -20, CFG.W + 40, CFG.H + 40);
        }

        ctx.restore();
    }
}

// --- Input Handling ------------------------------------------------
function setupInput() {
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'Space') e.preventDefault();
        audio.resume();
    });
    window.addEventListener('keyup', e => {
        keys[e.code] = false;
    });

    // Mobile controls
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnFire = document.getElementById('btn-fire');

    const addTouchEvents = (btn, prop) => {
        btn.addEventListener('touchstart', e => { e.preventDefault(); touch[prop] = true; audio.resume(); });
        btn.addEventListener('touchend', e => { e.preventDefault(); touch[prop] = false; });
        btn.addEventListener('touchcancel', e => { touch[prop] = false; });
        // Also mouse events for testing
        btn.addEventListener('mousedown', e => { touch[prop] = true; audio.resume(); });
        btn.addEventListener('mouseup', e => { touch[prop] = false; });
        btn.addEventListener('mouseleave', e => { touch[prop] = false; });
    };

    addTouchEvents(btnLeft, 'left');
    addTouchEvents(btnRight, 'right');
    addTouchEvents(btnFire, 'fire');
}

// --- Canvas Setup --------------------------------------------------
function setupCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    function resize() {
        const wrapper = document.getElementById('game-wrapper');
        const ww = wrapper.clientWidth;
        const wh = wrapper.clientHeight;

        // Set canvas internal resolution
        canvas.width = CFG.W;
        canvas.height = CFG.H;

        // Scale canvas to fill wrapper while maintaining aspect ratio
        const scale = Math.min(ww / CFG.W, wh / CFG.H);
        canvas.style.width = `${Math.floor(CFG.W * scale)}px`;
        canvas.style.height = `${Math.floor(CFG.H * scale)}px`;
    }

    resize();
    window.addEventListener('resize', resize);
}

// --- Initialization ------------------------------------------------
function init() {
    setupCanvas();
    setupInput();
    game = new Game();
    window.game = game;

    // Initial render (menu background)
    game.road.update(0);
    game._render();

    // Animate menu background
    function menuLoop() {
        if (game.state === 'menu' || game.state === 'gameover') {
            game.road.update(2);
            game._render();
        }
        requestAnimationFrame(menuLoop);
    }
    menuLoop();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
