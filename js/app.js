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

    // Apply saved rotation
    coinElement.style.transition = 'none';
    coinElement.style.transform = `rotateX(${currentRotation}deg)`;
}
buildCoin();

// --- 2. Audio Engine ---
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playFlipSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;

    // 1. The "Thock" Body (Deep, woody/plastic impact)
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle'; // Triangle wave creates a hollow, woody sound
    // Pitch Sweep: Starts at 300Hz (Low Mid) and drops quickly to 60Hz (Bass)
    // This removes the "Laser" pew-pew effect which comes from high frequencies
    osc.frequency.setValueAtTime(300, t); 
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1); 
    
    // Lowpass Filter: This makes it "Milky" by cutting off the buzz
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t); // Start muffled
    filter.frequency.linearRampToValueAtTime(300, t + 0.1); // Get more muffled

    // Envelope: Fast attack, short sustain
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.8, t + 0.005); // Instant hit
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15); // Short tail

    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.15);

    // 2. The Texture (Filtered Noise for the "Click")
    // Instead of a sine wave "ping", we use noise to simulate physical friction
    const bufferSize = audioCtx.sampleRate * 0.1; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // White noise
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = audioCtx.createGain();
    const noiseFilter = audioCtx.createBiquadFilter();

    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 1200; // Cut the hiss, keep the "thud"

    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05); // Very short burst

    noise.connect(noiseFilter).connect(noiseGain).connect(audioCtx.destination);
    noise.start(t);
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
    
    // Hollow Drop
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

// --- SCORE LOGIC ---
function addScore(currentStreak) {
    const points = Math.pow(2, currentStreak);
    totalScore += points;
    
    scoreElement.textContent = totalScore.toLocaleString();
    
    // Trigger Pop Animation
    scoreElement.classList.remove('score-bump');
    void scoreElement.offsetWidth; // Force reflow
    scoreElement.classList.add('score-bump');
    
    // Remove the class after 200ms so it shrinks back down
    setTimeout(() => {
        scoreElement.classList.remove('score-bump');
    }, 200);
    
    localStorage.setItem('goodluck_score', totalScore);
}

function flipCoin() {
    if (isFlipping) return;
    initAudio();
    isFlipping = true;
    
    // Remove animations instantly when flip starts
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
    localStorage.setItem('goodluck_rotation', currentRotation); // Save rotation

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

        // Update Score Data
        addScore(streak);

        if (streak > best) {
            best = streak;
            bestElement.textContent = best;
            localStorage.setItem('goodluck_best', best);
        }
        
        // 1. Update Text
        streakElement.textContent = streak;
        scoreElement.textContent = totalScore.toLocaleString();

        // 2. Apply Green Color & Animation to BOTH
        streakElement.style.color = "var(--green)";
        scoreElement.style.color = "var(--green)";
        
        streakElement.classList.add('pop-anim');
        scoreElement.classList.add('pop-anim');
        
        playWinSound(streak);
        createParticles(cx, cy, 'var(--green)');

        // 3. Reset BOTH to white after animation
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
        
        // Only Streak goes red on loss
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