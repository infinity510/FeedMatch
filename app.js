// app.js - FeedMatch Cyber Arcade Edition

// Game State
let players = ['Rohit', 'Shourya', 'Aman', 'Priya', 'Rahul'];
let currentRound = 0;
let gameMode = 'campaign'; // 'campaign' or 'rush'
let startTime = 0;
let roundStartTime = 0;
let timerInterval = null;
let rushCountdown = 60;

let score = 0;
let highScore = parseInt(localStorage.getItem('feedmatch_highscore') || '0', 10);
let comboMultiplier = 1.0;
let maxComboReached = 1.0;
let lastMatchTimestamp = 0;

let lifelines = 3;
let totalLifelinesUsed = 0;

let sfxEnabled = localStorage.getItem('feedmatch_sfx') !== 'false';
let musicEnabled = localStorage.getItem('feedmatch_music') !== 'false';

let currentPrefs = {};
let draggedItem = null;
let augmentingPathHistory = null;

// ==========================================
// Web Audio API Synthesizer (Arcade Sound FX)
// ==========================================
let audioCtx = null;
let bgMusic = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type, duration, vol = 0.3) {
    if (!sfxEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.warn('Audio error:', e);
    }
}

// Crisp UI Blip
function playBlip() {
    playTone(700, 'sine', 0.05, 0.2);
}

// Item Grab Sound
function playGrabSound() {
    if (!sfxEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(540, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {}
}

// Item Snap / Lock-in Sound
function playDropSound() {
    if (!sfxEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(240, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
}

// Ascending Combo Chime
function playComboSound(multiplier) {
    if (!sfxEnabled) return;
    initAudio();
    const baseFreq = 440 * (1 + (multiplier - 1) * 0.3);
    playTone(baseFreq, 'triangle', 0.08, 0.3);
    setTimeout(() => playTone(baseFreq * 1.25, 'triangle', 0.08, 0.3), 60);
    setTimeout(() => playTone(baseFreq * 1.5, 'sine', 0.15, 0.35), 120);
}

// Buzzer with Screen Shake
function playFail() {
    triggerScreenShake();
    if (!sfxEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(160, audioCtx.currentTime);
        osc2.frequency.setValueAtTime(145, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.35);
        osc2.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
}

// Sci-Fi Rescue Laser Sweep
function playRescueLaser() {
    if (!sfxEnabled) return;
    initAudio();
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
}

// Success Chords & Fanfare
function playSuccess() {
    if (!sfxEnabled) return;
    initAudio();
    playTone(523.25, 'sine', 0.1, 0.4); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.1, 0.4), 80); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.15, 0.4), 160); // G5
    setTimeout(() => playTone(1046.50, 'sine', 0.3, 0.45), 240); // C6
}

// Bottleneck Discovery
function playBottleneckDiscovery() {
    if (!sfxEnabled) return;
    initAudio();
    playTone(392.00, 'sine', 0.12, 0.4); // G4
    setTimeout(() => playTone(587.33, 'sine', 0.12, 0.4), 100); // D5
    setTimeout(() => playTone(783.99, 'sine', 0.12, 0.4), 200); // G5
    setTimeout(() => playTone(987.77, 'sine', 0.35, 0.45), 300); // B5
}

// Background Music
function startBgMusic() {
    if (!bgMusic) {
        bgMusic = new Audio('assets/subway.mp3');
        bgMusic.loop = true;
    }
    bgMusic.playbackRate = 1.0;
    bgMusic.volume = 0.4;
    
    if (musicEnabled) {
        bgMusic.play().catch(e => console.log('Autoplay blocked:', e));
    }
}

function stopBgMusic() {
    if (bgMusic) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }
}

// Screen Shake Utility
function triggerScreenShake() {
    const main = document.querySelector('main');
    if (main) {
        main.classList.remove('shake-screen');
        void main.offsetWidth; // trigger reflow
        main.classList.add('shake-screen');
        setTimeout(() => main.classList.remove('shake-screen'), 450);
    }
}

// ==========================================
// Culinary Dictionary & Emoji Assets
// ==========================================
const FOOD = {
    "Pizza": "🍕 Pizza",
    "Burger": "🍔 Burger",
    "Pasta": "🍝 Pasta",
    "Maggi": "🍜 Maggi",
    "Momo": "🥟 Momo",
    "Samosa": "🥠 Samosa",
    "Vada Pav": "🥪 Vada Pav",
    "Chaat": "🥗 Chaat",
    "Pav Bhaji": "🍛 Pav Bhaji"
};

// ==========================================
// 7 Stage Campaign Architecture
// ==========================================
const ROUNDS = [
    {
        title: "Stage 1: Sector Alpha (The Warmup)",
        getItems: () => ["Pizza", "Burger", "Momo", "Samosa", "Vada Pav"],
        getPrefs: (p) => ({
            [p[0]]: ["Pizza"],
            [p[1]]: ["Burger"],
            [p[2]]: ["Momo"],
            [p[3]]: ["Samosa"],
            [p[4]]: ["Vada Pav"]
        }),
        desc: (p) => `<strong>DIRECT BIJECTIVE MATCHING:</strong><br>${p[0]} ➔ Pizza | ${p[1]} ➔ Burger | ${p[2]} ➔ Momo | ${p[3]} ➔ Samosa | ${p[4]} ➔ Vada Pav.<br><span class="text-cyan-400 font-mono text-xs">Tactical Hint: Each agent has degree deg(v) = 1. Drag matching dishes to receptacles!</span>`,
        impossible: false
    },
    {
        title: "Stage 2: The Greedy Trap (Think Twice)",
        getItems: () => ["Pizza", "Burger", "Momo", "Samosa", "Vada Pav"],
        getPrefs: (p) => ({
            [p[0]]: ["Pizza", "Momo"],
            [p[1]]: ["Momo", "Burger"],
            [p[2]]: ["Burger", "Samosa"],
            [p[3]]: ["Samosa", "Vada Pav"],
            [p[4]]: ["Vada Pav"]
        }),
        desc: (p) => `<strong>DEGREE HEURISTIC CHALLENGE:</strong><br><strong>${p[0]}</strong>: Pizza, Momo<br><strong>${p[1]}</strong>: Momo, Burger<br><strong>${p[2]}</strong>: Burger, Samosa<br><strong>${p[3]}</strong>: Samosa, Vada Pav<br><strong>${p[4]}</strong>: Vada Pav (Picky eater!)<br><span class="text-amber-400 font-mono text-xs">⚠️ Greedy Trap: If an agent consumes another's sole option, deadlock ensues! Feed deg(v)=1 first.</span>`,
        impossible: false
    },
    {
        title: "Stage 3A: Rescue Protocol (Augmenting Path)",
        getItems: () => ["Chaat", "Pav Bhaji", "Maggi", "Pizza", "Burger"],
        getPrefs: (p) => ({
            [p[0]]: ["Chaat", "Pav Bhaji"],
            [p[1]]: ["Pav Bhaji", "Maggi"],
            [p[2]]: ["Maggi", "Pizza"],
            [p[3]]: ["Pizza", "Burger"],
            [p[4]]: ["Burger"]
        }),
        desc: (p) => `<strong>BERGE'S ALTERNATING CHAIN:</strong><br><strong>${p[0]}</strong>: Chaat, Pav Bhaji<br><strong>${p[1]}</strong>: Pav Bhaji, Maggi<br><strong>${p[2]}</strong>: Maggi, Pizza<br><strong>${p[3]}</strong>: Pizza, Burger<br><strong>${p[4]}</strong>: Burger<br><span class="text-fuchsia-400 font-mono text-xs">⚡ Stuck? Hit RESCUE to let Berge's Augmenting Path shift assignments automatically!</span>`,
        impossible: false
    },
    {
        title: "Stage 3B: Hall's Paradox (Bottleneck Alpha)",
        getItems: () => ["Chaat", "Maggi", "Pizza", "Burger"],
        getPrefs: (p) => ({
            [p[0]]: ["Chaat", "Maggi"],
            [p[1]]: ["Chaat", "Maggi"],
            [p[2]]: ["Chaat", "Maggi"],
            [p[3]]: ["Pizza", "Burger"],
            [p[4]]: ["Pizza", "Burger"]
        }),
        desc: (p) => `<strong>HALL'S MARRIAGE THEOREM CERTIFICATE:</strong><br><strong>${p[0]}, ${p[1]}, & ${p[2]}</strong>: Only eat Chaat or Maggi.<br><strong>${p[3]} & ${p[4]}</strong>: Only eat Pizza or Burger.<br><span class="text-rose-400 font-mono text-xs">🛑 Analyze subset sizes! Can 3 agents share only 2 dishes? If impossible, declare it!</span>`,
        impossible: true
    },
    {
        title: "Stage 4: 5-Cycle Overdrive (No Degree-1 Safety Net!)",
        getItems: () => ["Pizza", "Burger", "Pasta", "Momo", "Chaat"],
        getPrefs: (p) => ({
            [p[0]]: ["Pizza", "Burger"],
            [p[1]]: ["Burger", "Pasta"],
            [p[2]]: ["Pasta", "Momo"],
            [p[3]]: ["Momo", "Chaat"],
            [p[4]]: ["Chaat", "Pizza"]
        }),
        desc: (p) => `<strong>SYMMETRIC CYCLE C5:</strong><br><strong>${p[0]}</strong>: Pizza, Burger<br><strong>${p[1]}</strong>: Burger, Pasta<br><strong>${p[2]}</strong>: Pasta, Momo<br><strong>${p[3]}</strong>: Momo, Chaat<br><strong>${p[4]}</strong>: Chaat, Pizza<br><span class="text-cyan-400 font-mono text-xs">Every agent has degree 2! No degree-1 dead giveaway. An incorrect greedy pick creates a parity trap.</span>`,
        impossible: false
    },
    {
        title: "Stage 5: The Phantom Bottleneck (Disguised Hall's Failure)",
        getItems: () => ["Pizza", "Burger", "Momo", "Samosa", "Pav Bhaji"],
        getPrefs: (p) => ({
            [p[0]]: ["Pizza", "Burger"],
            [p[1]]: ["Burger", "Momo"],
            [p[2]]: ["Pizza", "Momo"],
            [p[3]]: ["Samosa"],
            [p[4]]: ["Samosa"]
        }),
        desc: (p) => `<strong>DISGUISED DEFICIT (5 DISHES ON TABLE):</strong><br><strong>${p[0]}, ${p[1]}, ${p[2]}</strong> share Pizza, Burger, Momo.<br><strong>${p[3]} & ${p[4]}</strong> both will ONLY eat Samosa.<br><span class="text-rose-400 font-mono text-xs">⚠️ Looks like 5 items for 5 people! But examine subset S = {${p[3]}, ${p[4]}}. Is |N(S)| &ge; |S|?</span>`,
        impossible: true
    },
    {
        title: "Stage 6: Cyber Feast (Grandmaster Showdown)",
        getItems: () => ["Pizza", "Burger", "Pasta", "Momo", "Pav Bhaji"],
        getPrefs: (p) => ({
            [p[0]]: ["Pizza", "Pasta", "Pav Bhaji"],
            [p[1]]: ["Pizza", "Burger"],
            [p[2]]: ["Burger", "Pasta"],
            [p[3]]: ["Pasta", "Momo"],
            [p[4]]: ["Momo", "Pav Bhaji"]
        }),
        desc: (p) => `<strong>COMPLEX BRANCHING NEXUS:</strong><br><strong>${p[0]}</strong>: Pizza, Pasta, Pav Bhaji<br><strong>${p[1]}</strong>: Pizza, Burger<br><strong>${p[2]}</strong>: Burger, Pasta<br><strong>${p[3]}</strong>: Pasta, Momo<br><strong>${p[4]}</strong>: Momo, Pav Bhaji<br><span class="text-emerald-400 font-mono text-xs">High-density preference graph with intersecting augmenting branches. Master the allocation!</span>`,
        impossible: false
    }
];

// ==========================================
// DOM Element References
// ==========================================
const screens = {
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen')
};

const setupForm = document.getElementById('setup-form');
const timerEl = document.getElementById('timer');
const gameInfo = document.getElementById('game-info');
const stageBadge = document.getElementById('stage-badge');
const scoreCounter = document.getElementById('score-counter');
const comboMultiplierEl = document.getElementById('combo-multiplier');
const comboFlame = document.getElementById('combo-flame');
const coresDisplay = document.getElementById('cores-display');
const headerHighScore = document.getElementById('header-highscore');

const roundTitle = document.getElementById('round-title');
const roundDesc = document.getElementById('round-desc');
const dropZonesContainer = document.getElementById('drop-zones');
const foodItemsContainer = document.getElementById('food-items');
const supplyCountEl = document.getElementById('supply-count');

const btnUndo = document.getElementById('btn-undo');
const btnRescue = document.getElementById('btn-rescue');
const btnSubmit = document.getElementById('btn-submit');
const btnImpossible = document.getElementById('btn-impossible');
const btnRadar = document.getElementById('btn-radar');
const btnCloseRadar = document.getElementById('btn-close-radar');
const radarOverlay = document.getElementById('radar-overlay');
const radarCanvas = document.getElementById('radar-canvas');

const btnTheme = document.getElementById('btn-theme');
const btnSfx = document.getElementById('btn-sfx');
const btnMusic = document.getElementById('btn-music');
const sfxIcon = document.getElementById('sfx-icon');
const musicIcon = document.getElementById('music-icon');
const themeIcon = document.getElementById('theme-icon');

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalBtnPrimary = document.getElementById('modal-btn-primary');
const modalBtnSecondary = document.getElementById('modal-btn-secondary');

// End Screen Stats
const finalTimeEl = document.getElementById('final-time');
const finalScoreEl = document.getElementById('final-score');
const finalComboEl = document.getElementById('final-combo');
const finalCoresEl = document.getElementById('final-cores');
const finalRankEl = document.getElementById('final-rank');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnShare = document.getElementById('btn-share');

// Initialize High Score in Header
headerHighScore.textContent = highScore.toLocaleString();

// ==========================================
// Audio & Theme Control Listeners
// ==========================================
btnSfx.addEventListener('click', () => {
    sfxEnabled = !sfxEnabled;
    localStorage.setItem('feedmatch_sfx', sfxEnabled);
    sfxIcon.textContent = sfxEnabled ? '🔊' : '🔇';
    playBlip();
});

btnMusic.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    localStorage.setItem('feedmatch_music', musicEnabled);
    musicIcon.textContent = musicEnabled ? '🎵' : '🔇';
    if (musicEnabled) {
        startBgMusic();
    } else {
        stopBgMusic();
    }
});

btnTheme.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    themeIcon.textContent = isDark ? '🌙' : '☀️';
    playBlip();
});

// Sync Icons on Load
sfxIcon.textContent = sfxEnabled ? '🔊' : '🔇';
musicIcon.textContent = musicEnabled ? '🎵' : '🔇';

// Mode Cards selection styling
document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => {
            c.classList.remove('border-cyan-500/50', 'bg-cyan-950/30');
            c.classList.add('border-gray-700', 'bg-gray-800/40');
            const txt = c.querySelector('.font-bold');
            if (txt) { txt.classList.remove('text-cyan-300'); txt.classList.add('text-gray-300'); }
        });
        card.classList.remove('border-gray-700', 'bg-gray-800/40');
        card.classList.add('border-cyan-500/50', 'bg-cyan-950/30');
        const txt = card.querySelector('.font-bold');
        if (txt) { txt.classList.remove('text-gray-300'); txt.classList.add('text-cyan-300'); }
    });
});

// ==========================================
// Setup & Game Launch
// ==========================================
setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();
    playBlip();

    players = [
        document.getElementById('p1-name').value.trim() || 'Rohit',
        document.getElementById('p2-name').value.trim() || 'Shourya',
        document.getElementById('p3-name').value.trim() || 'Aman',
        document.getElementById('p4-name').value.trim() || 'Priya',
        document.getElementById('p5-name').value.trim() || 'Rahul'
    ];

    const selectedMode = document.querySelector('input[name="game-mode"]:checked');
    gameMode = selectedMode ? selectedMode.value : 'campaign';

    startGame();
});

function startGame() {
    screens.setup.classList.add('hidden');
    screens.game.classList.remove('hidden');
    gameInfo.classList.remove('hidden');

    currentRound = 0;
    score = 0;
    comboMultiplier = 1.0;
    maxComboReached = 1.0;
    lastMatchTimestamp = 0;
    augmentingPathHistory = null;

    scoreCounter.textContent = '0';
    updateComboDisplay();

    lifelines = (gameMode === 'rush') ? 1 : 3;
    totalLifelinesUsed = 0;
    updateCoresDisplay();

    startTime = Date.now();
    roundStartTime = Date.now();
    rushCountdown = 60;

    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);

    startBgMusic();
    loadRound(currentRound);
}

function updateCoresDisplay() {
    let hearts = '';
    for (let i = 0; i < lifelines; i++) {
        hearts += '💖';
    }
    for (let i = lifelines; i < (gameMode === 'rush' ? 1 : 3); i++) {
        hearts += '🖤';
    }
    coresDisplay.textContent = hearts || '💀';
}

function updateTimer() {
    if (gameMode === 'rush') {
        rushCountdown--;
        const m = String(Math.floor(Math.max(0, rushCountdown) / 60)).padStart(2, '0');
        const s = String(Math.max(0, rushCountdown) % 60).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
        
        if (rushCountdown <= 10) {
            timerEl.classList.add('animate-pulse', 'text-rose-500');
            playTone(880, 'square', 0.05, 0.1);
        } else {
            timerEl.classList.remove('animate-pulse', 'text-rose-500');
        }

        if (rushCountdown <= 0) {
            playFail();
            showModal('⏰ TIME EXPIRED!', 'The street food rush overwhelmed the kitchen!', 'Retry', () => {
                closeModal();
                startGame();
            }, '💥');
        }
    } else {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const m = String(Math.floor(diff / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }
}

// Fisher-Yates Shuffle
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// ==========================================
// Round Loading & Drop Zones Rendering
// ==========================================
function loadRound(index) {
    roundStartTime = Date.now();
    if (gameMode === 'rush') {
        rushCountdown = 60;
    }

    const round = ROUNDS[index];
    stageBadge.textContent = `${index + 1}/${ROUNDS.length}`;
    roundTitle.textContent = round.title;
    roundDesc.innerHTML = round.desc(players);

    currentPrefs = round.getPrefs(players);
    augmentingPathHistory = null;

    const items = shuffle([...round.getItems()]);
    renderDropZones();
    renderFoodItems(items);
    renderGraphRadar();
}

function renderDropZones() {
    dropZonesContainer.innerHTML = '';
    players.forEach((p, idx) => {
        const zone = document.createElement('div');
        zone.className = 'drop-zone flex items-center justify-between bg-gray-800/80 border border-gray-700/80 hover:border-cyan-500/40 rounded-2xl p-3 shadow-md min-h-[75px] gap-3 transition-all';
        zone.dataset.person = p;
        zone.dataset.index = idx;

        // Left info container: Avatar + Name + Preference chips
        const leftBox = document.createElement('div');
        leftBox.className = 'flex items-center gap-3 min-w-0';

        // Avatar with status ring
        const avatarWrapper = document.createElement('div');
        avatarWrapper.className = 'relative shrink-0';
        const avatar = document.createElement('img');
        avatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p}&backgroundColor=1e293b`;
        avatar.className = 'w-11 h-11 rounded-full border-2 border-cyan-500/50 bg-gray-900 object-cover';
        avatarWrapper.appendChild(avatar);

        // Status pip
        const statusPip = document.createElement('span');
        statusPip.className = 'status-pip absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-gray-900';
        statusPip.title = 'Hungry';
        avatarWrapper.appendChild(statusPip);

        leftBox.appendChild(avatarWrapper);

        // Name and Preferred food badges
        const info = document.createElement('div');
        info.className = 'flex flex-col min-w-0';

        const nameLabel = document.createElement('span');
        nameLabel.className = 'font-bold font-orbitron text-sm text-cyan-200 truncate tracking-wide';
        nameLabel.textContent = p;
        info.appendChild(nameLabel);

        // Preferred dishes chips
        const chipsContainer = document.createElement('div');
        chipsContainer.className = 'flex flex-wrap gap-1 mt-1';
        const prefs = currentPrefs[p] || [];
        prefs.forEach(item => {
            const chip = document.createElement('span');
            chip.className = 'text-[10px] font-mono px-1.5 py-0.5 bg-gray-900/90 text-cyan-300 border border-cyan-500/30 rounded-md';
            chip.textContent = FOOD[item] ? FOOD[item].split(' ')[0] + ' ' + item : item;
            chipsContainer.appendChild(chip);
        });
        info.appendChild(chipsContainer);
        leftBox.appendChild(info);

        zone.appendChild(leftBox);

        // Drop Area Slot
        const dropArea = document.createElement('div');
        dropArea.className = 'item-container flex-grow flex items-center justify-end min-h-[46px] min-w-[130px] border border-dashed border-gray-700/60 rounded-xl p-1 bg-gray-900/40 transition-colors';
        dropArea.dataset.empty = 'true';
        zone.appendChild(dropArea);

        setupDropZoneEvents(zone);
        dropZonesContainer.appendChild(zone);
    });
}

function renderFoodItems(items) {
    foodItemsContainer.innerHTML = '';
    setupDropZoneEvents(foodItemsContainer, true);

    updateSupplyCount(items.length);

    items.forEach(item => {
        const el = createFoodElement(item);
        foodItemsContainer.appendChild(el);
    });
}

function createFoodElement(item) {
    const el = document.createElement('div');
    el.className = 'draggable cyber-btn bg-gradient-to-r from-amber-950/60 to-orange-950/60 border border-amber-500/40 hover:border-amber-400 rounded-xl px-3.5 py-2.5 shadow-md text-amber-200 font-bold font-rajdhani text-sm flex items-center justify-between gap-2 transition-all';
    el.draggable = true;
    el.dataset.item = item;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'flex items-center gap-1.5 pointer-events-none';
    labelSpan.textContent = FOOD[item] || item;
    el.appendChild(labelSpan);

    const gripSpan = document.createElement('span');
    gripSpan.className = 'text-xs text-amber-500/60 pointer-events-none font-mono';
    gripSpan.textContent = '::';
    el.appendChild(gripSpan);

    el.addEventListener('dragstart', (e) => {
        draggedItem = el;
        playGrabSound();
        setTimeout(() => el.classList.add('opacity-40'), 0);
        highlightCompatibleDropZones(item);
    });

    el.addEventListener('dragend', (e) => {
        el.classList.remove('opacity-40');
        draggedItem = null;
        clearDropZoneHighlights();
    });

    return el;
}

function updateSupplyCount(count) {
    if (supplyCountEl) {
        supplyCountEl.textContent = `${count} DISHES`;
    }
}

// Visual highlights during drag
function highlightCompatibleDropZones(item) {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        const person = zone.dataset.person;
        if (currentPrefs[person] && currentPrefs[person].includes(item)) {
            zone.classList.add('compatible-target');
        } else {
            zone.classList.add('incompatible-target');
        }
    });
}

function clearDropZoneHighlights() {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.classList.remove('compatible-target', 'incompatible-target', 'drag-over');
    });
}

// ==========================================
// Drag & Drop Listeners
// ==========================================
function setupDropZoneEvents(zone, isPool = false) {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!isPool) zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
        if (!isPool) zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!isPool) zone.classList.remove('drag-over');
        if (!draggedItem) return;

        if (isPool) {
            foodItemsContainer.appendChild(draggedItem);
            playDropSound();
            refreshZoneStatuses();
            updateSupplyCount(foodItemsContainer.children.length);
            renderGraphRadar();
        } else {
            const person = zone.dataset.person;
            const item = draggedItem.dataset.item;

            // Check Preference Compatibility
            if (!currentPrefs[person].includes(item)) {
                playFail();
                comboMultiplier = 1.0;
                updateComboDisplay();
                showModal(
                    '🚫 INCOMPATIBLE DISH!',
                    `${person} rejects ${item}!<br><span class="text-xs text-gray-400">Review ${person}'s preference tags: [${currentPrefs[person].join(', ')}]</span>`,
                    'Acknowledged',
                    () => closeModal(),
                    '🛑'
                );
                return;
            }

            const container = zone.querySelector('.item-container');
            // If already holding an item, return previous back to pool
            if (container.children.length > 0) {
                const existing = container.children[0];
                foodItemsContainer.appendChild(existing);
            }

            container.appendChild(draggedItem);
            playDropSound();

            // Calculate Combos and Floating Score
            handleMatchScoring(zone);
            refreshZoneStatuses();
            updateSupplyCount(foodItemsContainer.children.length);
            renderGraphRadar();
        }
    });
}

function handleMatchScoring(zone) {
    const now = Date.now();
    if (now - lastMatchTimestamp <= 4500) {
        comboMultiplier = Math.min(3.0, +(comboMultiplier + 0.5).toFixed(1));
    } else {
        comboMultiplier = 1.0;
    }
    lastMatchTimestamp = now;

    if (comboMultiplier > maxComboReached) {
        maxComboReached = comboMultiplier;
    }

    const modeMultiplier = (gameMode === 'rush') ? 2 : 1;
    const points = Math.round(200 * comboMultiplier * modeMultiplier);
    score += points;
    scoreCounter.textContent = score.toLocaleString();

    playComboSound(comboMultiplier);
    updateComboDisplay();

    // Floating Score Animation
    showFloatingScore(zone, `+${points}`, comboMultiplier > 1.0 ? `COMBO x${comboMultiplier}!` : null);
}

function updateComboDisplay() {
    comboMultiplierEl.textContent = `${comboMultiplier.toFixed(1)}x`;
    if (comboMultiplier > 1.0) {
        comboFlame.classList.add('flame-active');
        comboMultiplierEl.classList.remove('text-pink-400');
        comboMultiplierEl.classList.add('text-amber-400', 'font-black');
    } else {
        comboFlame.classList.remove('flame-active');
        comboMultiplierEl.classList.remove('text-amber-400');
        comboMultiplierEl.classList.add('text-pink-400');
    }
}

function showFloatingScore(targetEl, text, comboText) {
    const rect = targetEl.getBoundingClientRect();
    const floater = document.createElement('div');
    floater.className = 'floating-score';
    floater.style.left = `${rect.right - 80}px`;
    floater.style.top = `${rect.top}px`;
    floater.innerHTML = comboText ? `<span>${text}</span><br><span class="text-xs text-pink-400">${comboText}</span>` : text;
    document.body.appendChild(floater);

    setTimeout(() => {
        if (floater.parentNode) floater.parentNode.removeChild(floater);
    }, 800);
}

function refreshZoneStatuses() {
    players.forEach(p => {
        const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
        if (!zone) return;
        const container = zone.querySelector('.item-container');
        const pip = zone.querySelector('.status-pip');
        if (container && container.children.length > 0) {
            pip.className = 'status-pip absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-gray-900 shadow-[0_0_8px_#00ff88]';
            pip.title = 'Satisfied';
            zone.classList.add('border-emerald-500/40');
        } else {
            pip.className = 'status-pip absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-gray-900';
            pip.title = 'Hungry';
            zone.classList.remove('border-emerald-500/40');
        }
    });
}

// Reset Button Listener
btnUndo.addEventListener('click', () => {
    playBlip();
    const allItems = document.querySelectorAll('.draggable');
    allItems.forEach(item => foodItemsContainer.appendChild(item));
    refreshZoneStatuses();
    updateSupplyCount(allItems.length);
    comboMultiplier = 1.0;
    updateComboDisplay();
    renderGraphRadar();
});

// ==========================================
// Berge's Augmenting Path Rescue Operation
// ==========================================
btnRescue.addEventListener('click', () => {
    if (lifelines <= 0) {
        playFail();
        showModal('💔 ZERO CORES REMAINING', 'You have exhausted your Augment Cores for this run!', 'OK', () => closeModal(), '🛑');
        return;
    }

    const round = ROUNDS[currentRound];
    const matchLeft = {};
    const matchRight = {};

    players.forEach(p => {
        const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
        const itemEl = zone ? zone.querySelector('.item-container').firstElementChild : null;
        if (itemEl) {
            const itemName = itemEl.dataset.item;
            matchLeft[p] = itemName;
            matchRight[itemName] = p;
        } else {
            matchLeft[p] = null;
        }
    });

    const unassignedPerson = players.find(p => !matchLeft[p]);
    if (!unassignedPerson) {
        playFail();
        showModal('💡 SQUAD ALREADY SATISFIED', 'Every agent currently has a dish assigned!', 'OK', () => closeModal(), 'ℹ️');
        return;
    }

    // Augmented Path Tracing
    let visited = {};
    let augmentingChain = [];

    function findAugmentingPath(u, currentPath) {
        for (let item of currentPrefs[u] || []) {
            if (!document.querySelector(`.draggable[data-item="${item}"]`)) continue;
            if (visited[item]) continue;
            visited[item] = true;

            const nextEdge = { person: u, item: item };
            const extendedPath = [...currentPath, nextEdge];

            if (!matchRight[item]) {
                augmentingChain = extendedPath;
                matchRight[item] = u;
                return true;
            } else {
                const predecessor = matchRight[item];
                if (findAugmentingPath(predecessor, extendedPath)) {
                    matchRight[item] = u;
                    return true;
                }
            }
        }
        return false;
    }

    if (findAugmentingPath(unassignedPerson, [])) {
        lifelines--;
        totalLifelinesUsed++;
        updateCoresDisplay();
        playRescueLaser();

        // Safely return all items to pool first to prevent DOM issues
        players.forEach(p => {
            const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
            if (zone) {
                const container = zone.querySelector('.item-container');
                while (container.firstChild) {
                    foodItemsContainer.appendChild(container.firstChild);
                }
            }
        });

        // Reassign accurately based on augmented matching
        Object.keys(matchRight).forEach(itemName => {
            const p = matchRight[itemName];
            const itemEl = document.querySelector(`.draggable[data-item="${itemName}"]`);
            if (itemEl && p) {
                const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
                if (zone) zone.querySelector('.item-container').appendChild(itemEl);
            }
        });

        refreshZoneStatuses();
        updateSupplyCount(foodItemsContainer.children.length);
        augmentingPathHistory = augmentingChain;
        renderGraphRadar();

        showPartyPopper();
        showModal(
            '⚡ AUGMENTING PATH EXECUTED!',
            `<strong>Berge's Lemma in Action:</strong><br>Found alternating chain starting at hungry agent <strong>${unassignedPerson}</strong>.<br>Edges inverted successfully, increasing total cardinality by +1!`,
            'Awesome!',
            () => closeModal(),
            '✨'
        );
    } else {
        playFail();
        showModal(
            '🛑 RESCUE BLOCKED',
            'No augmenting path exists from the unassigned agent. Check for an insolubility bottleneck!',
            'OK',
            () => closeModal(),
            '🥀'
        );
    }
});

// ==========================================
// Hall's Marriage Theorem Impossibility Check
// ==========================================
btnImpossible.addEventListener('click', () => {
    const round = ROUNDS[currentRound];

    if (round.impossible) {
        playBottleneckDiscovery();
        showPartyPopper();

        // Calculate and reveal the minimal Hall's Violator Subset S
        const violator = findHallViolator(players, currentPrefs);
        let mathExplanation = "<strong>Hall's Marriage Theorem Verified:</strong><br>";
        if (violator) {
            mathExplanation += `Violating Subset <em>S</em> = {${violator.subset.join(', ')}}<br>` +
                              `Size |S| = ${violator.subset.length}<br>` +
                              `Neighborhood <em>N(S)</em> = {${violator.neighborhood.join(', ')}}<br>` +
                              `Size |N(S)| = ${violator.neighborhood.length}<br>` +
                              `<span class="text-rose-400 font-bold">|N(S)| = ${violator.neighborhood.length} &lt; |S| = ${violator.subset.length}</span> (Deficit detected!)`;
        } else {
            mathExplanation += "Total food options are strictly smaller than the subgroup of hungry agents!";
        }

        const bonus = 2500;
        score += bonus;
        scoreCounter.textContent = score.toLocaleString();

        showModal(
            '🧮 BOTTLENECK CERTIFIED!',
            `${mathExplanation}<br><br><span class="text-emerald-400 font-bold font-orbitron">+${bonus} TACTICAL PTS</span>`,
            'Proceed to Next Round',
            () => {
                closeModal();
                advanceRound();
            },
            '🏆'
        );
    } else {
        playFail();
        score = Math.max(0, score - 300);
        scoreCounter.textContent = score.toLocaleString();
        comboMultiplier = 1.0;
        updateComboDisplay();

        showModal(
            '❌ ERRONEOUS CLAIM!',
            `This puzzle <strong>IS SOLVABLE</strong>! A complete saturating matching exists.<br><span class="text-rose-400 font-mono text-xs">Penalty: -300 PTS. Try re-evaluating minimum degree vertices!</span>`,
            'Try Again',
            () => closeModal(),
            '⚠️'
        );
    }
});

// Helper: Algorithmically find subset S where |N(S)| < |S|
function findHallViolator(agents, prefs) {
    const n = agents.length;
    for (let mask = 1; mask < (1 << n); mask++) {
        const subset = [];
        const neighborhoodSet = new Set();
        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) {
                subset.push(agents[i]);
                (prefs[agents[i]] || []).forEach(item => neighborhoodSet.add(item));
            }
        }
        if (neighborhoodSet.size < subset.length) {
            return {
                subset: subset,
                neighborhood: Array.from(neighborhoodSet)
            };
        }
    }
    return null;
}

// ==========================================
// Submission & Match Validation
// ==========================================
btnSubmit.addEventListener('click', () => {
    const round = ROUNDS[currentRound];
    let matchedCount = 0;

    players.forEach(p => {
        const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
        if (zone && zone.querySelector('.item-container').children.length > 0) {
            matchedCount++;
        }
    });

    if (matchedCount === players.length) {
        if (round.impossible) {
            showModal('Anomaly Detected', 'You submitted all plates on an impossible stage?!', 'Next', () => {
                closeModal();
                advanceRound();
            }, '🪄');
            return;
        }

        playSuccess();
        showPartyPopper();

        // Speed bonus
        const timeSpent = Math.floor((Date.now() - roundStartTime) / 1000);
        const speedBonus = Math.max(0, 1500 - timeSpent * 20);
        score += speedBonus;
        scoreCounter.textContent = score.toLocaleString();

        showModal(
            '🎉 STAGE CLEARED!',
            `Perfect bipartite matching achieved!<br><span class="text-emerald-400 font-orbitron font-bold text-sm">+${speedBonus} SPEED BONUS</span>`,
            'Next Stage ➔',
            () => {
                closeModal();
                advanceRound();
            },
            '🍕'
        );
    } else {
        playFail();
        comboMultiplier = 1.0;
        updateComboDisplay();
        showModal(
            '⚠️ INCOMPLETE ASSIGNMENT',
            `Only ${matchedCount}/${players.length} agents are fed! Every agent must have an individual dish.`,
            'Resume',
            () => closeModal(),
            '🛑'
        );
    }
});

function advanceRound() {
    currentRound++;
    if (currentRound >= ROUNDS.length) {
        endGame();
    } else {
        loadRound(currentRound);
    }
}

// ==========================================
// Tactical Graph Radar (Canvas 2D Renderer)
// ==========================================
btnRadar.addEventListener('click', () => {
    playBlip();
    radarOverlay.classList.remove('hidden');
    renderGraphRadar();
});

btnCloseRadar.addEventListener('click', () => {
    playBlip();
    radarOverlay.classList.add('hidden');
});

radarOverlay.addEventListener('click', (e) => {
    if (e.target === radarOverlay) {
        playBlip();
        radarOverlay.classList.add('hidden');
    }
});

function renderGraphRadar() {
    if (!radarCanvas) return;
    const ctx = radarCanvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas resolution for DPI
    const rect = radarCanvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 360;
    radarCanvas.width = width * window.devicePixelRatio;
    radarCanvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    const round = ROUNDS[currentRound];
    if (!round) return;

    const roundItems = round.getItems();
    const leftX = width * 0.22;
    const rightX = width * 0.78;

    // Current matching map
    const currentMatches = {};
    players.forEach(p => {
        const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
        const itemEl = zone ? zone.querySelector('.item-container').firstElementChild : null;
        if (itemEl) {
            currentMatches[p] = itemEl.dataset.item;
        }
    });

    // Compute Y positions
    const playerCoords = {};
    const itemCoords = {};

    players.forEach((p, i) => {
        const y = height * 0.15 + (i / Math.max(1, players.length - 1)) * (height * 0.7);
        playerCoords[p] = { x: leftX, y: y };
    });

    roundItems.forEach((item, j) => {
        const y = height * 0.15 + (j / Math.max(1, roundItems.length - 1)) * (height * 0.7);
        itemCoords[item] = { x: rightX, y: y };
    });

    // Draw Preference Edges (E)
    players.forEach(p => {
        const pCoord = playerCoords[p];
        const prefs = currentPrefs[p] || [];
        prefs.forEach(item => {
            const iCoord = itemCoords[item];
            if (!iCoord) return;

            const isMatched = (currentMatches[p] === item);

            ctx.beginPath();
            ctx.moveTo(pCoord.x, pCoord.y);
            ctx.lineTo(iCoord.x, iCoord.y);

            if (isMatched) {
                // Matched Edge (M)
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 3.5;
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 10;
            } else {
                // Preference Edge
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
                ctx.lineWidth = 1.2;
                ctx.shadowBlur = 0;
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
    });

    // Draw Augmenting Path Highlights (if present)
    if (augmentingPathHistory && augmentingPathHistory.length > 0) {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff007f';
        ctx.shadowBlur = 12;

        augmentingPathHistory.forEach(edge => {
            const pCoord = playerCoords[edge.person];
            const iCoord = itemCoords[edge.item];
            if (pCoord && iCoord) {
                ctx.beginPath();
                ctx.moveTo(pCoord.x, pCoord.y);
                ctx.lineTo(iCoord.x, iCoord.y);
                ctx.stroke();
            }
        });
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    // Draw Left Nodes (Players)
    players.forEach(p => {
        const coord = playerCoords[p];
        const isMatched = !!currentMatches[p];

        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = isMatched ? '#064e3b' : '#1e1b4b';
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isMatched ? '#00ff88' : '#00f0ff';
        ctx.shadowColor = isMatched ? '#00ff88' : '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Label
        ctx.font = 'bold 12px Orbitron, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'right';
        ctx.fillText(p, coord.x - 24, coord.y + 4);
    });

    // Draw Right Nodes (Dishes)
    roundItems.forEach(item => {
        const coord = itemCoords[item];
        const isAssigned = Object.values(currentMatches).includes(item);

        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = isAssigned ? '#064e3b' : '#312e81';
        ctx.fill();

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = isAssigned ? '#00ff88' : '#f59e0b';
        ctx.shadowColor = isAssigned ? '#00ff88' : '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Label
        ctx.font = 'bold 12px Rajdhani, sans-serif';
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'left';
        ctx.fillText(item, coord.x + 24, coord.y + 4);
    });
}

// ==========================================
// Game Over & Results Dashboard
// ==========================================
function endGame() {
    clearInterval(timerInterval);
    stopBgMusic();
    playSuccess();

    screens.game.classList.add('hidden');
    gameInfo.classList.add('hidden');
    screens.end.classList.remove('hidden');

    const totalSeconds = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    const timeFormatted = `${m}:${s}`;

    // Compute Final Score with Lifeline & Speed Bonuses
    const coreBonus = lifelines * 1000;
    score += coreBonus;

    // Check High Score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('feedmatch_highscore', highScore);
        headerHighScore.textContent = highScore.toLocaleString();
    }

    // Rank Tier Calculation
    let rank = 'C-TIER';
    if (score >= 12000 && totalLifelinesUsed === 0) {
        rank = 'S-TIER (GRANDMASTER)';
    } else if (score >= 9000) {
        rank = 'A-TIER (ALGORITHMIST)';
    } else if (score >= 6000) {
        rank = 'B-TIER (TACTICIAN)';
    }

    finalTimeEl.textContent = timeFormatted;
    finalScoreEl.textContent = score.toLocaleString();
    finalComboEl.textContent = `${maxComboReached.toFixed(1)}x`;
    finalCoresEl.textContent = `${lifelines}/${(gameMode === 'rush' ? 1 : 3)}`;
    finalRankEl.textContent = rank;

    showPartyPopper();
}

btnPlayAgain.addEventListener('click', () => {
    playBlip();
    screens.end.classList.add('hidden');
    screens.setup.classList.remove('hidden');
});

// Share / Copy Scorecard
btnShare.addEventListener('click', () => {
    playBlip();
    const rank = finalRankEl.textContent;
    const time = finalTimeEl.textContent;
    const finalScore = finalScoreEl.textContent;

    const shareText = `⚡ FEEDMATCH // CYBER ARCADE ⚡\n` +
                      `🏆 Rank: ${rank}\n` +
                      `⭐ Score: ${finalScore} PTS\n` +
                      `⏱️ Time: ${time}\n` +
                      `🔥 Max Combo: ${maxComboReached.toFixed(1)}x\n` +
                      `💖 Augment Cores: ${lifelines}/${(gameMode === 'rush' ? 1 : 3)}\n` +
                      `Can you beat my Discrete Math matching record?`;

    navigator.clipboard.writeText(shareText).then(() => {
        btnShare.innerHTML = '<span>✅</span> COPIED TO CLIPBOARD!';
        setTimeout(() => {
            btnShare.innerHTML = '<span>📋</span> COPY SCORECARD';
        }, 2500);
    }).catch(err => {
        console.error('Clipboard copy failed:', err);
    });
});

// ==========================================
// Keyboard Controls
// ==========================================
window.addEventListener('keydown', (e) => {
    // Only capture when game screen is active and modal is hidden
    if (screens.game.classList.contains('hidden') || !modalOverlay.classList.contains('hidden')) return;

    if (e.code === 'Space') {
        e.preventDefault();
        btnSubmit.click();
    } else if (e.code === 'KeyI') {
        e.preventDefault();
        btnImpossible.click();
    } else if (e.code === 'KeyU') {
        e.preventDefault();
        btnRescue.click();
    } else if (e.code === 'KeyR') {
        e.preventDefault();
        btnUndo.click();
    } else if (e.code === 'KeyG') {
        e.preventDefault();
        if (radarOverlay.classList.contains('hidden')) {
            btnRadar.click();
        } else {
            btnCloseRadar.click();
        }
    } else if (e.code === 'KeyM') {
        e.preventDefault();
        btnMusic.click();
    }
});

// ==========================================
// Modal Window Logic
// ==========================================
function showModal(title, message, primaryText, primaryCallback, icon = 'ℹ️', secondaryText = null, secondaryCallback = null) {
    modalIcon.textContent = icon;
    modalTitle.textContent = title;
    modalMessage.innerHTML = message;

    modalBtnPrimary.textContent = primaryText;
    modalBtnPrimary.onclick = () => {
        playBlip();
        if (primaryCallback) primaryCallback();
    };

    if (secondaryText && typeof secondaryText === 'string') {
        modalBtnSecondary.textContent = secondaryText;
        modalBtnSecondary.onclick = () => {
            playBlip();
            if (secondaryCallback) secondaryCallback();
        };
        modalBtnSecondary.classList.remove('hidden');
    } else {
        modalBtnSecondary.classList.add('hidden');
    }

    modalOverlay.classList.remove('hidden');
    modalOverlay.classList.add('opacity-100');
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    modalOverlay.classList.remove('opacity-100');
}

function showPartyPopper() {
    confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#00f0ff', '#ff007f', '#00ff88', '#ffb800', '#b026ff']
    });
}
