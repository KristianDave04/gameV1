class HorrorAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterVolume = null;
        this.musicFilter = null;
        this.isDronePlaying = false;
    }

    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.masterVolume.connect(this.ctx.destination);
    }

    startAtmosphereDrone() {
        if (this.isDronePlaying || !this.ctx) return;
        this.isDronePlaying = true;

        // Base Rumble Loop Engine
        this.musicFilter = this.ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.setValueAtTime(150, this.ctx.currentTime);
        this.musicFilter.connect(this.masterVolume);

        this.createOscillatorNode(48, 'sawtooth', 0.25, this.musicFilter);
        this.createOscillatorNode(49.5, 'sine', 0.4, this.musicFilter);
        
        // Modulating thematic dissonant frequencies
        this.runMelodySequence();
    }

    createOscillatorNode(freq, type, volume, outputNode) {
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        osc.connect(gain).connect(outputNode);
        osc.start();
    }

    runMelodySequence() {
        if (!this.isDronePlaying) return;
        
        const notes = [60, 63, 66, 61]; // Dark intervals
        let randomNote = notes[Math.floor(Math.random() * notes.length)];
        
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(randomNote, this.ctx.currentTime);
        
        // Dissonant frequency pitch sliding
        osc.frequency.linearRampToValueAtTime(randomNote - 12, this.ctx.currentTime + 3.5);
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 1.5);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 4.0);
        
        osc.connect(gain).connect(this.masterVolume);
        osc.start();
        osc.stop(this.ctx.currentTime + 4.0);

        setTimeout(() => this.runMelodySequence(), 5000 + Math.random() * 4000);
    }

    playFootstep(isRunning) {
        if (!this.ctx) return;
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        let baseFreq = isRunning ? 65 : 45;
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.12);
        
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        
        osc.connect(gain).connect(this.masterVolume);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.13);
    }

    playPaperRustle() {
        if (!this.ctx) return;
        // White-noise generator approximation using a short triangle matrix burst
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1800, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.25);
        
        osc.connect(gain).connect(this.masterVolume);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.25);
    }

    playTapeEject() {
        if (!this.ctx) return;
        let osc = this.ctx.createOscillator();
        let gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        
        osc.connect(gain).connect(this.masterVolume);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playJumpscareStab() {
        if (!this.ctx) return;
        // Massive layered frequency cluster drop
        for (let i = 0; i < 4; i++) {
            let osc = this.ctx.createOscillator();
            let gain = this.ctx.createGain();
            osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
            osc.frequency.setValueAtTime(70 + (i * 33), this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(30, this.ctx.currentTime + 0.8);
            
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
            
            osc.connect(gain).connect(this.masterVolume);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.8);
        }
    }
}

const HorrorAudio = new HorrorAudioEngine();