// Web Audio Context initialization (deferred until interaction for browser autoplay policy)
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioContextClass();
    }
    return audioCtx!;
}

export function playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1): void {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
}

export interface SoundEngine {
    click: () => void;
    success: () => void;
    error: () => void;
    delete: () => void;
}

export const sounds: SoundEngine = {
    click: () => playTone(600, 'sine', 0.1, 0.05),
    success: () => { 
        playTone(500, 'sine', 0.1); 
        setTimeout(() => playTone(800, 'sine', 0.15), 100); 
    },
    error: () => playTone(200, 'sawtooth', 0.2, 0.1),
    delete: () => playTone(300, 'square', 0.1, 0.05)
};
