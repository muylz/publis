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
const scoreDisplayContainer = document.querySelector('.odds-container'); // Floating numbers target

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
let flipBuffer = null;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

async function loadFlipSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch('assets/flip.mp3'); // Ensure this matches your actual file extension
        const arrayBuffer = await response.arrayBuffer();
        flipBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error("Error loading flip sound:", error);
    }
}
loadFlipSound();

function playFlipSound() {
    if (!audioCtx) return;

    if (flipBuffer) {
        const source = audioCtx.createBufferSource();
        source.buffer = flipBuffer;
        source.playbackRate.value = 0.95 + Math.random() * 0.1;
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.8; 
        source.connect(gainNode).connect(audioCtx.destination);
        source.start(0);
    } else {
        // Fallback Synth
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
        const snapOsc = audioCtx.createOscillator();
        const snapGain = audioCtx.createGain();
        snapOsc.type = 'sine';
        snapOsc.frequency.setValueAtTime(2000, t);
        snapOsc.frequency.exponentialRampToValueAtTime(500, t + 0.02);
        snapGain.gain.setValueAtTime(0.05, t);
        snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
        snapOsc.connect(snapGain).connect(audioCtx.destination);
        snapOsc.start(t);
        snapOsc.stop(t + 0.03);
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
    
    // Append to the odds container so it flies up from there
    if (scoreDisplayContainer) {
        scoreDisplayContainer.appendChild(floater);
        setTimeout(() => { floater.remove(); }, 1500);
    }
}

function addScore(currentStreak) {
    const points = Math.pow(2, currentStreak);
    const oldScore = totalScore;
    const newScore = totalScore + points;
    
    showFloatingPoints(points);
    animateScoreValue(oldScore, newScore, 1000);
    
    totalScore = newScore;
    localStorage.setItem('goodluck_score', totalScore);
    
    // Removed manual score-bump triggering here
    // It is now handled via the shared .pop-anim in resolveFlip
}

function flipCoin() {
    if (isFlipping) return;
    initAudio();
    isFlipping = true;
    
    // Reset Animations
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
        
        addScore(streak);

        if (streak > best) {
            best = streak;
            bestElement.textContent = best;
            localStorage.setItem('goodluck_best', best);
        }
        
        streakElement.textContent = streak;
        
        // --- UNIFIED WIN ANIMATION ---
        streakElement.style.color = "var(--green)";
        scoreElement.style.color = "var(--green)";
        oddsElement.style.color = "var(--green)";
        
        // All 3 get the exact same pop animation class
        streakElement.classList.add('pop-anim');
        scoreElement.classList.add('pop-anim');
        oddsElement.classList.add('pop-anim');
        
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
        streak = 0;
        localStorage.setItem('goodluck_streak', streak);

        streakElement.textContent = 0;
        
        // Only Streak goes red
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