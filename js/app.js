// --- Configuration ---
const LAYERS = 24; 
const THICKNESS_SPREAD = 0.6; 


// --- Game State ---
let streak = parseInt(localStorage.getItem('goodluck_streak')) || 0;
let best = parseInt(localStorage.getItem('goodluck_best')) || 0;
let totalScore = parseInt(localStorage.getItem('goodluck_score')) || 0;
let isFlipping = false;
let currentRotation = parseInt(localStorage.getItem('goodluck_rotation')) || 0;

let isGambling = false; // New flag

// --- DOM ---
const coinElement = document.getElementById('coin');
const sceneElement = document.getElementById('scene');
const streakElement = document.getElementById('streak-counter');
const bestElement = document.getElementById('best-counter');
const scoreElement = document.getElementById('score-counter');
const oddsElement = document.getElementById('odds-counter');
const particlesContainer = document.getElementById('particles');
const headsTemplate = document.getElementById('heads-svg');
const tailsTemplate = document.getElementById('tails-svg-clean');
const scoreDisplayContainer = document.querySelector('.score-display'); 
const modal = document.getElementById('gamble-modal');
const btnYes = document.getElementById('btn-yes');
const btnNo = document.getElementById('btn-no');
const gambleAmountText = document.getElementById('gamble-amount');

// --- Initialize UI ---
streakElement.textContent = streak;
bestElement.textContent = best;
scoreElement.textContent = totalScore.toLocaleString();
updateOdds(streak);

// --- 1. Build the Solid 3D Stack ---
function buildCoin() {
    if (!coinElement) return;
    coinElement.innerHTML = '';
    const startZ = -(LAYERS * THICKNESS_SPREAD) / 2;

    for (let i = 0; i < LAYERS; i++) {
        const layer = document.createElement('div');
        const currentZ = startZ + (i * THICKNESS_SPREAD);
        
        if (i === 0) {
            layer.className = 'layer back';
            if(tailsTemplate) layer.appendChild(tailsTemplate.content.cloneNode(true));
            layer.style.transform = `translateZ(${currentZ}px) rotateX(180deg)`;
        } else if (i === LAYERS - 1) {
            layer.className = 'layer front';
            if(headsTemplate) layer.appendChild(headsTemplate.content.cloneNode(true));
            layer.style.transform = `translateZ(${currentZ}px)`;
        } else {
            layer.className = 'layer edge';
            layer.style.transform = `translateZ(${currentZ}px)`;
        }
        coinElement.appendChild(layer);
    }

    // Apply saved rotation
    coinElement.style.transition = 'none';
    coinElement.style.transform = `rotateX(${currentRotation}deg)`;
}
buildCoin();

// --- 2. Audio Engine ---
let audioCtx;
let flipBuffer = null;

function initAudio() {
    // Create context if it doesn't exist
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

async function loadFlipSound() {
    try {
        // Initialize context to decode data
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // --- CHANGE: Point to the .wav file ---
        const response = await fetch('assets/flip.wav');
        
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        flipBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        console.log("Flip sound loaded successfully");
    } catch (error) {
        console.warn("Error loading flip.wav, reverting to synthesizer:", error);
    }
}
// Load immediately
loadFlipSound();

function playFlipSound() {
    if (!audioCtx) return;

    if (flipBuffer) {
        // --- SAMPLE PLAYBACK ---
        const source = audioCtx.createBufferSource();
        source.buffer = flipBuffer;
        
        // Randomize pitch slightly (0.95x to 1.05x) so it doesn't sound robotic
        source.playbackRate.value = 0.95 + Math.random() * 0.1;
        
        // Create a Gain Node (Volume)
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.6; // Adjust this (0.0 to 1.0) if the WAV is too loud
        
        source.connect(gainNode).connect(audioCtx.destination);
        source.start(0);
    } else {
        // --- FALLBACK SYNTHESIZER (If wav fails to load) ---
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
        
        filter.type = 'lowpass';
        filter.frequency.value = 3000;
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        
        osc.connect(filter).connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
    }
}

function playWinSound(streakCount) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const baseFreqs = [261.63, 329.63, 392.00]; 
    const multiplier = 1 + (Math.min(streakCount, 12) * 0.05);

    baseFreqs.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * multiplier;
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.05, t + 0.1 + (i*0.05)); 
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 2.0);
    });
}

function playLoseSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(180, t);
    osc1.frequency.exponentialRampToValueAtTime(50, t + 0.6);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(170, t); 
    osc2.frequency.exponentialRampToValueAtTime(45, t + 0.6);

    gain1.gain.setValueAtTime(0.2, t);
    gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
    gain2.gain.setValueAtTime(0.2, t);
    gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

    osc1.connect(gain1).connect(audioCtx.destination);
    osc2.connect(gain2).connect(audioCtx.destination);
    
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.7);
    osc2.stop(t + 0.7);
}

function createParticles(x, y, color) {
    for(let i=0; i<15; i++) {
        const p = document.createElement('div');
        p.classList.add('particle');
        p.style.backgroundColor = color;
        p.style.boxShadow = `0 0 6px ${color}`;
        const size = Math.random() * 5 + 2;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.opacity = 1;
        const angle = Math.random() * Math.PI * 2;
        const vel = Math.random() * 100 + 30;
        const tx = Math.cos(angle) * vel;
        const ty = Math.sin(angle) * vel;
        p.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease';
        particlesContainer.appendChild(p);
        requestAnimationFrame(() => {
            p.style.transform = `translate(${tx}px, ${ty}px)`;
            p.style.opacity = 0;
        });
        setTimeout(() => p.remove(), 800);
    }
}

function updateOdds(currentStreak) {
    const denominator = Math.pow(2, currentStreak + 1);
    oddsElement.textContent = denominator.toLocaleString();
}

// --- SCORE ANIMATION LOGIC ---
function animateScoreValue(start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = Math.floor(progress * (end - start) + start);
        scoreElement.textContent = currentVal.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            scoreElement.textContent = end.toLocaleString();
        }
    };
    window.requestAnimationFrame(step);
}

function showFloatingPoints(points) {
    const floater = document.createElement('div');
    floater.classList.add('score-floater');
    floater.textContent = "+" + points.toLocaleString();
    
    const oddsContainer = document.querySelector('.odds-container');
    if (oddsContainer) {
        oddsContainer.appendChild(floater);
        setTimeout(() => { floater.remove(); }, 800);
    }
}

function addScore(currentStreak) {
    const points = Math.pow(2, currentStreak);
    const oldScore = totalScore;
    const newScore = totalScore + points;
    
    showFloatingPoints(points);
    // Rollover duration set to 600ms to match the Green flash timing
    animateScoreValue(oldScore, newScore, 600);
    
    totalScore = newScore;
    localStorage.setItem('goodluck_score', totalScore);
}

function flipCoin() {
    if (isFlipping) return;
    initAudio();
    isFlipping = true;
    
    streakElement.classList.remove('pop-anim');
    scoreElement.classList.remove('pop-anim');
    oddsElement.classList.remove('pop-anim');
    oddsElement.classList.remove('shake-anim');
    document.body.classList.remove('shake-anim');

    const isHeads = Math.random() > 0.5;
    playFlipSound();

    const spins = 5;
    const degrees = spins * 360;
    
    let target = currentRotation + degrees;
    
    const currentMod = currentRotation % 360;
    const isCurrentlyHeads = (Math.abs(currentMod) < 1 || Math.abs(currentMod - 360) < 1);

    if (isCurrentlyHeads) {
        if (!isHeads) target += 180; 
    } else {
        if (isHeads) target += 180; 
    }

    currentRotation = target;
    localStorage.setItem('goodluck_rotation', currentRotation);

    coinElement.style.transition = 'transform 2.5s cubic-bezier(0.15, 0, 0.10, 1)';
    coinElement.style.transform = `rotateX(${currentRotation}deg)`;

    setTimeout(() => {
        resolveFlip(isHeads);
    }, 2500);
}

function resolveFlip(isHeads) {
    const rect = sceneElement.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    if (isHeads) {
        streak++;
        localStorage.setItem('goodluck_streak', streak); 
        
        // --- CHANGED: SCORING LOGIC ---
        let pointsToAdd = 0;

        if (isGambling) {
            // Win the gamble: Double the TOTAL score
            // Logic: New Score = Old Score * 2. 
            // Since animateScoreValue handles transition, we calculate the target.
            const oldScore = totalScore;
            const newScore = oldScore * 2;
            
            showFloatingPoints(oldScore); // Show "+ [Amount]" (doubled amount)
            animateScoreValue(oldScore, newScore, 1000); // Slower animation for big win
            totalScore = newScore;
            
            // Reset Gamble Flag
            isGambling = false;
            scoreDisplayContainer.classList.remove('gambling');
        } else {
            // Standard Play
            addScore(streak);
        }
        // -----------------------------

        if (streak > best) {
            best = streak;
            bestElement.textContent = best;
            localStorage.setItem('goodluck_best', best);
        }
        
        streakElement.textContent = streak;
        
        // Visuals
        streakElement.classList.add('pop-anim');
        scoreElement.classList.add('pop-anim');
        oddsElement.classList.add('pop-anim');
        
        streakElement.style.color = "var(--green)";
        scoreElement.style.color = "var(--green)";
        oddsElement.style.color = "var(--green)";
        
        playWinSound(streak);
        createParticles(cx, cy, 'var(--green)');

        setTimeout(() => {
            streakElement.style.color = "#fff";
            scoreElement.style.color = "#fff";
            oddsElement.style.color = "#fff";
            
            streakElement.classList.remove('pop-anim');
            scoreElement.classList.remove('pop-anim');
            oddsElement.classList.remove('pop-anim');
        }, 600);

    } else {
        // LOSS
        streak = 0;
        localStorage.setItem('goodluck_streak', streak);
        streakElement.textContent = 0;
        
        // --- CHANGED: LOSS LOGIC ---
        if (isGambling) {
            // Lose the gamble: Reset score to 0
            const oldScore = totalScore;
            totalScore = 0;
            animateScoreValue(oldScore, 0, 1000); // Count down to 0
            
            // Reset Gamble Flag
            isGambling = false;
            scoreDisplayContainer.classList.remove('gambling');
        }
        localStorage.setItem('goodluck_score', totalScore);
        // ---------------------------

        streakElement.style.color = "var(--red)";
        oddsElement.style.color = "var(--red)";
        
        document.body.classList.add('shake-anim');
        oddsElement.classList.add('shake-anim');
        
        playLoseSound();
        createParticles(cx, cy, 'var(--red)');

        setTimeout(() => {
            streakElement.style.color = "#fff";
            oddsElement.style.color = "#fff";
            oddsElement.classList.remove('shake-anim');
        }, 600);
    }
    
    updateOdds(streak);
    isFlipping = false;
}
// Locate this section in your app.js (around the bottom)

// 1. Open Modal on Score Click
scoreDisplayContainer.addEventListener('click', (e) => {
    // Prevent opening if flipping, score is 0, or already gambling
    if (isFlipping || totalScore <= 0 || isGambling) return;
    
    // --- UPDATE TEXT CONTENT HERE ---
    // This puts the actual score into the pop-up text
    gambleAmountText.textContent = totalScore.toLocaleString();
    
    // Show Modal
    modal.classList.remove('hidden');
});

// 2. Handle NO
btnNo.addEventListener('click', () => {
    modal.classList.add('hidden');
    isGambling = false;
});

// 3. Handle YES
btnYes.addEventListener('click', () => {
    modal.classList.add('hidden');
    isGambling = true;
    
    // Visual cue: Turn the score Gold to show risk is active
    scoreDisplayContainer.classList.add('gambling');
});

// Interaction
sceneElement.addEventListener('mousedown', () => {
    if(!isFlipping) coinElement.style.transform = `rotateX(${currentRotation}deg) scale(0.95)`;
});
sceneElement.addEventListener('mouseup', () => {
    if(!isFlipping) {
        coinElement.style.transform = `rotateX(${currentRotation}deg)`;
        flipCoin();
    }
});
sceneElement.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if(!isFlipping) flipCoin();
});

window.addEventListener('keydown', (e) => {
    if(e.code === 'Space') {
        if(!isFlipping) coinElement.style.transform = `rotateX(${currentRotation}deg) scale(0.95)`;
    }
});
window.addEventListener('keyup', (e) => {
    if(e.code === 'Space') {
        if(!isFlipping) {
            coinElement.style.transform = `rotateX(${currentRotation}deg)`;
            flipCoin();
        }
    }
});