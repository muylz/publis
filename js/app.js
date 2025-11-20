// --- Configuration ---
const LAYERS = 24; 
const THICKNESS_SPREAD = 0.6; 

// --- Game State ---
let streak = parseInt(localStorage.getItem('goodluck_streak')) || 0;
let best = parseInt(localStorage.getItem('goodluck_best')) || 0;
let totalScore = parseInt(localStorage.getItem('goodluck_score')) || 0;
let isFlipping = false;
let currentRotation = parseInt(localStorage.getItem('goodluck_rotation')) || 0;

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

    coinElement.style.transition = 'none';
    coinElement.style.transform = `rotateX(${currentRotation}deg)`;
}
buildCoin();

// --- 2. Audio Engine ---
let audioCtx;
let flipBuffer = null; // This will hold your custom sound

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// --- NEW: Load your custom sound file ---
async function loadFlipSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // FETCH THE FILE (Make sure the name matches your file!)
        const response = await fetch('assets/flip.wav');
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode it into audio data
        flipBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        console.log("Custom flip sound loaded!");
    } catch (error) {
        console.error("Error loading flip sound:", error);
    }
}
// Load it immediately
loadFlipSound();

function playFlipSound() {
    if (!audioCtx) return;

    if (flipBuffer) {
        // Play your custom file
        const source = audioCtx.createBufferSource();
        source.buffer = flipBuffer;
        
        // Randomize pitch slightly for realism (0.95x to 1.05x speed)
        source.playbackRate.value = 0.95 + Math.random() * 0.1;
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.8; // Volume adjustment
        
        source.connect(gainNode).connect(audioCtx.destination);
        source.start(0);
    } else {
        // Fallback if file hasn't loaded yet (Basic Click)
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
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

function addScore(currentStreak) {
    const points = Math.pow(2, currentStreak);
    totalScore += points;
    
    scoreElement.textContent = totalScore.toLocaleString();
    
    scoreElement.classList.remove('score-bump');
    void scoreElement.offsetWidth; 
    scoreElement.classList.add('score-bump');
    
    setTimeout(() => {
        scoreElement.classList.remove('score-bump');
    }, 200);
    
    localStorage.setItem('goodluck_score', totalScore);
}

function flipCoin() {
    if (isFlipping) return;
    initAudio();
    isFlipping = true;
    
    streakElement.classList.remove('pop-anim');
    scoreElement.classList.remove('pop-anim');
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

        addScore(streak);

        if (streak > best) {
            best = streak;
            bestElement.textContent = best;
            localStorage.setItem('goodluck_best', best);
        }
        
        streakElement.textContent = streak;
        streakElement.style.color = "var(--green)";
        streakElement.classList.add('pop-anim');
        scoreElement.classList.add('pop-anim');
        
        playWinSound(streak);
        createParticles(cx, cy, 'var(--green)');

        setTimeout(() => {
            streakElement.style.color = "#fff";
            scoreElement.style.color = "#fff";
            streakElement.classList.remove('pop-anim');
            scoreElement.classList.remove('pop-anim');
        }, 600);

    } else {
        streak = 0;
        localStorage.setItem('goodluck_streak', streak);

        streakElement.textContent = 0;
        streakElement.style.color = "var(--red)";
        
        document.body.classList.add('shake-anim');
        playLoseSound();
        createParticles(cx, cy, 'var(--red)');

        setTimeout(() => streakElement.style.color = "#fff", 600);
    }
    
    updateOdds(streak);
    isFlipping = false;
}

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