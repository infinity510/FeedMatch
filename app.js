// app.js

let players = [];
let currentRound = 0;
let startTime;
let timerInterval;
let lifelines = 0;
let totalLifelinesUsed = 0;

// Web Audio API Synthesizer (Guaranteed to work locally with no CORS/loading issues)
let audioCtx;
let droneOsc, droneGain;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, type, duration, vol) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playSuccess() {
    initAudio();
    playTone(440, 'sine', 0.1, 0.5);
    setTimeout(() => playTone(554, 'sine', 0.1, 0.5), 100);
    setTimeout(() => playTone(659, 'sine', 0.3, 0.5), 200);
}

function playFail() {
    initAudio();
    playTone(300, 'sawtooth', 0.2, 0.5);
    setTimeout(() => playTone(250, 'sawtooth', 0.4, 0.5), 150);
}

let ytPlayer;
function onYouTubeIframeAPIReady() {
    ytPlayer = new YT.Player('yt-player', {
        height: '1',
        width: '1',
        videoId: 'gH-N72n_mO8', // Subway Surfers Theme
        playerVars: {
            'autoplay': 0,
            'loop': 1,
            'playlist': 'gH-N72n_mO8',
            'controls': 0
        }
    });
}

function startBgMusic() {
    if (ytPlayer && ytPlayer.playVideo) {
        ytPlayer.setPlaybackRate(1.0);
        ytPlayer.setVolume(50);
        ytPlayer.playVideo();
    }
}

function updateBgMusicIntensity(diff) {
    if (ytPlayer && ytPlayer.setPlaybackRate) {
        // YT playback rates: 1, 1.25, 1.5, 1.75, 2.0
        const newRate = 1.0 + (diff / 120) * 1.0; 
        
        let rateToSet = 1.0;
        if (newRate >= 2.0) rateToSet = 2.0;
        else if (newRate >= 1.75) rateToSet = 1.75;
        else if (newRate >= 1.5) rateToSet = 1.5;
        else if (newRate >= 1.25) rateToSet = 1.25;
        
        ytPlayer.setPlaybackRate(rateToSet);
        
        // Increase volume
        const newVol = 50 + (diff / 120) * 50;
        ytPlayer.setVolume(Math.min(100, newVol));
    }
}

function stopBgMusic() {
    if (ytPlayer && ytPlayer.stopVideo) {
        ytPlayer.stopVideo();
    }
}

// Emojis for food
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

// Element References
const screens = {
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen'),
    end: document.getElementById('end-screen')
};

const setupForm = document.getElementById('setup-form');
const timerEl = document.getElementById('timer');
const gameInfo = document.getElementById('game-info');
const lifelinesContainer = document.getElementById('lifelines-container');
const lifelinesCount = document.getElementById('lifelines-count');

const roundTitle = document.getElementById('round-title');
const roundDesc = document.getElementById('round-desc');
const dropZonesContainer = document.getElementById('drop-zones');
const foodItemsContainer = document.getElementById('food-items');

const btnUndo = document.getElementById('btn-undo');
const btnRescue = document.getElementById('btn-rescue');
const btnSubmit = document.getElementById('btn-submit');
const btnImpossible = document.getElementById('btn-impossible');
const btnTheme = document.getElementById('btn-theme');

// Modal Elements
const modalOverlay = document.getElementById('modal-overlay');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalBtnPrimary = document.getElementById('modal-btn-primary');
const modalBtnSecondary = document.getElementById('modal-btn-secondary');

// Theme Toggle
btnTheme.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    if (document.documentElement.classList.contains('dark')) {
        btnTheme.textContent = '☀️';
    } else {
        btnTheme.textContent = '🌙';
    }
});

const ROUNDS = [
    {
        title: "Round 1: The Warmup",
        getItems: () => ["Pizza", "Burger", "Momo", "Samosa", "Vada Pav"],
        getPrefs: (p) => ({
            [p[0]]: ["Pizza"],
            [p[1]]: ["Burger"],
            [p[2]]: ["Momo"],
            [p[3]]: ["Samosa"],
            [p[4]]: ["Vada Pav"]
        }),
        desc: (p) => `<strong>${p[0]}</strong>: Pizza<br><strong>${p[1]}</strong>: Burger<br><strong>${p[2]}</strong>: Momo<br><strong>${p[3]}</strong>: Samosa<br><strong>${p[4]}</strong>: Vada Pav`,
        impossible: false
    },
    {
        title: "Round 2: Think Twice",
        getItems: () => ["Pizza", "Burger", "Momo", "Samosa", "Vada Pav"],
        getPrefs: (p) => ({
            [p[0]]: ["Pizza", "Momo"],
            [p[1]]: ["Momo", "Burger"],
            [p[2]]: ["Burger", "Samosa"],
            [p[3]]: ["Samosa", "Vada Pav"],
            [p[4]]: ["Vada Pav"]
        }),
        desc: (p) => `<strong>${p[0]}</strong> likes Pizza, Momo.<br><strong>${p[1]}</strong> likes Momo, Burger.<br><strong>${p[2]}</strong> likes Burger, Samosa.<br><strong>${p[3]}</strong> likes Samosa, Vada Pav.<br><strong>${p[4]}</strong> likes Vada Pav.<br><br><em>Hint: A greedy choice by ${p[0]} might ruin someone else's lunch!</em>`,
        impossible: false
    },
    {
        title: "Round 3A: Rescue Operation",
        getItems: () => ["Chaat", "Pav Bhaji", "Maggi", "Pizza", "Burger"],
        getPrefs: (p) => ({
            [p[0]]: ["Chaat", "Pav Bhaji"],
            [p[1]]: ["Pav Bhaji", "Maggi"],
            [p[2]]: ["Maggi", "Pizza"],
            [p[3]]: ["Pizza", "Burger"],
            [p[4]]: ["Burger"]
        }),
        desc: (p) => `<strong>${p[0]}</strong>: Chaat, Pav Bhaji.<br><strong>${p[1]}</strong>: Pav Bhaji, Maggi.<br><strong>${p[2]}</strong>: Maggi, Pizza.<br><strong>${p[3]}</strong>: Pizza, Burger.<br><strong>${p[4]}</strong>: Burger.<br><br><em>Stuck? Hit Rescue and let the math shift things for you!</em>`,
        impossible: false
    },
    {
        title: "Round 3B: Final Challenge",
        getItems: () => ["Chaat", "Maggi", "Pizza", "Burger"],
        getPrefs: (p) => ({
            [p[0]]: ["Chaat", "Maggi"],
            [p[1]]: ["Chaat", "Maggi"],
            [p[2]]: ["Chaat", "Maggi"],
            [p[3]]: ["Pizza", "Burger"],
            [p[4]]: ["Pizza", "Burger"]
        }),
        desc: (p) => `<strong>${p[0]}, ${p[1]}, & ${p[2]}</strong> only eat Chaat or Maggi.<br><strong>${p[3]} & ${p[4]}</strong> only eat Pizza or Burger.<br><br><em>Can you match all 5?</em>`,
        impossible: true
    }
];

let currentPrefs = {};
let draggedItem = null;

// Fisher-Yates Shuffle
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Initialization
setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();
    players = [
        document.getElementById('p1-name').value.trim() || 'Rohit',
        document.getElementById('p2-name').value.trim() || 'Shourya',
        document.getElementById('p3-name').value.trim() || 'Aman',
        document.getElementById('p4-name').value.trim() || 'Priya',
        document.getElementById('p5-name').value.trim() || 'Rahul'
    ];
    startGame();
});

function startGame() {
    screens.setup.classList.add('hidden');
    screens.game.classList.remove('hidden');
    gameInfo.classList.remove('hidden');
    
    currentRound = 0;
    
    // Global Lifelines limit
    lifelines = 3; 
    lifelinesCount.textContent = lifelines;
    totalLifelinesUsed = 0;
    lifelinesContainer.classList.remove('hidden');
    btnRescue.classList.remove('hidden');
    
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    
    startBgMusic();
    loadRound(currentRound);
}

function updateTimer() {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    
    updateBgMusicIntensity(diff);
}

function loadRound(index) {
    const round = ROUNDS[index];
    roundTitle.textContent = round.title;
    roundDesc.innerHTML = round.desc(players);
    
    currentPrefs = round.getPrefs(players);
    const items = shuffle([...round.getItems()]); // Randomize items display

    renderDropZones();
    renderFoodItems(items);
}

function renderDropZones() {
    dropZonesContainer.innerHTML = '';
    players.forEach((p, i) => {
        const zone = document.createElement('div');
        zone.className = 'drop-zone flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm min-h-[80px] gap-4 transition-colors';
        zone.dataset.person = p;
        
        // Avatar
        const avatar = document.createElement('img');
        avatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${p}&backgroundColor=c0aede`;
        avatar.className = 'w-12 h-12 rounded-full border-2 border-indigo-200 dark:border-indigo-600 bg-indigo-50 dark:bg-gray-700';
        zone.appendChild(avatar);

        const nameLabel = document.createElement('span');
        nameLabel.className = 'font-bold text-gray-800 dark:text-gray-200 pointer-events-none w-20 truncate';
        nameLabel.textContent = p;
        zone.appendChild(nameLabel);

        const dropArea = document.createElement('div');
        dropArea.className = 'flex-grow flex items-center justify-end item-container min-h-[40px]';
        zone.appendChild(dropArea);

        setupDropZoneEvents(zone);
        dropZonesContainer.appendChild(zone);
    });
}

function renderFoodItems(items) {
    foodItemsContainer.innerHTML = '';
    setupDropZoneEvents(foodItemsContainer, true);
    
    items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'draggable bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 border border-orange-200 dark:border-orange-800 rounded-xl p-3 shadow-sm text-gray-800 dark:text-orange-200 font-bold hover:shadow-md hover:-translate-y-0.5 transition flex items-center justify-center';
        el.draggable = true;
        el.dataset.item = item;
        el.textContent = FOOD[item] || item;
        
        el.addEventListener('dragstart', (e) => {
            draggedItem = el;
            setTimeout(() => el.classList.add('opacity-50'), 0);
        });
        el.addEventListener('dragend', (e) => {
            el.classList.remove('opacity-50');
            draggedItem = null;
        });

        foodItemsContainer.appendChild(el);
    });
}

function setupDropZoneEvents(zone, isPool = false) {
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if(!isPool) zone.classList.add('drag-over');
    });
    
    zone.addEventListener('dragleave', () => {
        if(!isPool) zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        if(!isPool) zone.classList.remove('drag-over');
        
        if (!draggedItem) return;
        
        if (isPool) {
            foodItemsContainer.appendChild(draggedItem);
        } else {
            const person = zone.dataset.person;
            const item = draggedItem.dataset.item;
            
            if (!currentPrefs[person].includes(item)) {
                playFail();
                showModal('🚫 Oops!', `${person} doesn't like ${item}! Check the preferences above.`, 'Got it', () => closeModal(), '💡');
                return;
            }
            
            const container = zone.querySelector('.item-container');
            if (container.children.length > 0) {
                const existing = container.children[0];
                foodItemsContainer.appendChild(existing);
            }
            
            container.appendChild(draggedItem);
        }
    });
}

btnUndo.addEventListener('click', () => {
    const allItems = document.querySelectorAll('.draggable');
    allItems.forEach(item => foodItemsContainer.appendChild(item));
});

btnRescue.addEventListener('click', () => {
    if (lifelines <= 0) {
        playFail();
        showModal('💔 No Lifelines', 'You have no lifelines left!', 'OK', () => closeModal(), '🛑');
        return;
    }

    const round = ROUNDS[currentRound];
    const matchLeft = {}; 
    const matchRight = {}; 
    
    // Check current state
    players.forEach(p => {
        const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
        const itemEl = zone.querySelector('.item-container').firstElementChild;
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
        showModal('🤔 Wait a minute...', 'Everyone already has an item!', 'OK', () => closeModal(), '💡');
        return;
    }

    let visited = {};
    function dfs(u) {
        for (let item of currentPrefs[u]) {
            // Ensure this item is actually part of the current round's available items
            if (!document.querySelector(`.draggable[data-item="${item}"]`)) continue;
            
            if (visited[item]) continue;
            visited[item] = true;
            
            if (!matchRight[item] || dfs(matchRight[item])) {
                matchRight[item] = u;
                return true;
            }
        }
        return false;
    }

    if (dfs(unassignedPerson)) {
        lifelines--;
        totalLifelinesUsed++;
        lifelinesCount.textContent = lifelines;
        
        // BUG FIX: Safely move ALL items back to the pool FIRST so they aren't destroyed!
        players.forEach(p => {
            const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
            const container = zone.querySelector('.item-container');
            while (container.firstChild) {
                foodItemsContainer.appendChild(container.firstChild);
            }
        });
        
        // Now assign them accurately based on the new graph matching
        Object.keys(matchRight).forEach(itemName => {
            const p = matchRight[itemName];
            const itemEl = document.querySelector(`.draggable[data-item="${itemName}"]`);
            if (itemEl && p) {
                const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
                zone.querySelector('.item-container').appendChild(itemEl);
            }
        });
        
        playSuccess();
        showPartyPopper();
        showModal('✨ Rescue Successful!', 'An augmenting path was found and assignments were magically shifted to make room!', 'Awesome!', () => closeModal(), '🎉');
    } else {
        playFail();
        showModal('🥀 Rescue Failed', 'No augmenting path exists. The math says no!', 'OK', () => closeModal(), '🛑');
    }
});

btnImpossible.addEventListener('click', () => {
    const round = ROUNDS[currentRound];
    
    if (round.impossible) {
        playSuccess();
        showPartyPopper();
        showModal('🤯 You got it!', "You correctly identified that it's mathematically impossible to feed everyone! This is Hall's Marriage Theorem in action.", "See Results", () => {
            closeModal();
            endGame();
        }, '🧮');
    } else {
        playFail();
        showModal('❌ Nope!', "This puzzle IS possible. You just have to find the right combination of street food!", "Try Again", () => closeModal(), '💪');
    }
});

btnSubmit.addEventListener('click', () => {
    const round = ROUNDS[currentRound];
    
    let matchedCount = 0;
    players.forEach(p => {
        const zone = document.querySelector(`.drop-zone[data-person="${p}"]`);
        if (zone.querySelector('.item-container').children.length > 0) {
            matchedCount++;
        }
    });

    if (matchedCount === players.length) {
        if (round.impossible) {
            showModal('Wait... what?', 'You somehow solved an impossible puzzle?!', 'Next Round', () => {
                closeModal();
                endGame();
            }, '🪄');
            return;
        }
        playSuccess();
        showPartyPopper();
        showModal('🎉 Perfect Match!', 'You successfully fed everyone!', 'Next Round', () => {
            closeModal();
            currentRound++;
            if (currentRound >= ROUNDS.length) {
                endGame();
            } else {
                loadRound(currentRound);
            }
        }, '🍕');
    } else {
        playFail();
        showModal('😟 Incomplete', 'Not everyone has food! Try checking your assignments.', 'Retry', () => closeModal(), '🛑');
    }
});

function endGame() {
    clearInterval(timerInterval);
    stopBgMusic();
    
    screens.game.classList.add('hidden');
    gameInfo.classList.add('hidden');
    screens.end.classList.remove('hidden');
    
    const diff = Math.floor((Date.now() - startTime) / 1000);
    // Base score 10000. Lose 20 points per second. Lose 1000 per lifeline.
    let finalScore = 10000 - (diff * 20) - (totalLifelinesUsed * 1000);
    finalScore = Math.max(0, finalScore); // Ensure it doesn't drop below 0
    
    document.getElementById('final-time').textContent = timerEl.textContent;
    document.getElementById('final-score').textContent = finalScore.toLocaleString();
}

document.getElementById('btn-play-again').addEventListener('click', () => {
    screens.end.classList.add('hidden');
    screens.setup.classList.remove('hidden');
});

// Modal Logic
function showModal(title, message, primaryText, primaryCallback, icon = 'ℹ️', secondaryText = null, secondaryCallback = null) {
    modalIcon.textContent = icon;
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    modalBtnPrimary.textContent = primaryText;
    modalBtnPrimary.onclick = primaryCallback;
    
    if (secondaryText && typeof secondaryText === 'string' && secondaryText.length > 2) {
        modalBtnSecondary.textContent = secondaryText;
        modalBtnSecondary.onclick = secondaryCallback;
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
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981']
    });
}
