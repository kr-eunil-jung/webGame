/**
 * GameAudio — Web Audio API 기반 배경음/효과음 유틸리티
 *
 * 외부 파일 없이 Web Audio API로 사운드를 생성합니다.
 * - 배경음: 오실레이터로 루프 재생하는 BGM
 * - 효과음: 짧은 사운드 버퍼를 재생하는 SFX
 *
 * 사용법:
 *   const audio = new GameAudio();
 *   audio.playBGM('sirtet');
 *   audio.playBGM('snake');
 *   audio.playBGM('fruitbox');
 *   audio.playSFX('move');
 *   audio.playSFX('eat');
 *   audio.destroy();
 */
(function () {
  'use strict';

  class GameAudio {
    constructor() {
      this.ctx = null;
      this.bgmGain = null;
      this.sfxGain = null;
      this.bgmNodes = [];
      this.bgmPlaying = false;
      this.enabled = true;
    }

    /** AudioContext를 초기화합니다 (사용자 제스처 필요). */
    init() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.15;
      this.bgmGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.3;
      this.sfxGain.connect(this.ctx.destination);
    }

    // ========================
    //     효과음 (SFX)
    // ========================

    playSFX(name) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      switch (name) {
        case 'move':
          this._playMove(now);
          break;
        case 'rotate':
          this._playRotate(now);
          break;
        case 'drop':
          this._playDrop(now);
          break;
        case 'clear':
          this._playClear(now);
          break;
        case 'gameover':
          this._playGameOver(now);
          break;
        case 'start':
          this._playStart(now);
          break;
        case 'eat':
          this._playEat(now);
          break;
        case 'select':
          this._playSelect(now);
          break;
        case 'invalid':
          this._playInvalid(now);
          break;
      }
    }

    /** 블록 이동 — 짧은 low blip */
    _playMove(t) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.05);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.08);
    }

    /** 블록 회전 — 중음역 slide */
    _playRotate(t) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.06);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.1);
    }

    /** 하드 드롭 — 하강하는 톤 + 임팩트 */
    _playDrop(t) {
      // Slide down
      const slide = this.ctx.createOscillator();
      const sg = this.ctx.createGain();
      slide.type = 'square';
      slide.frequency.setValueAtTime(440, t);
      slide.frequency.exponentialRampToValueAtTime(80, t + 0.15);
      sg.gain.setValueAtTime(0.3, t);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      slide.connect(sg).connect(this.sfxGain);
      slide.start(t);
      slide.stop(t + 0.15);

      // Impact thud
      const thud = this.ctx.createOscillator();
      const tg = this.ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(100, t + 0.12);
      thud.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      tg.gain.setValueAtTime(0.35, t + 0.12);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      thud.connect(tg).connect(this.sfxGain);
      thud.start(t + 0.12);
      thud.stop(t + 0.25);
    }

    /** 라인 클리어 — 상승하는 아코드 */
    _playClear(t) {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.08);
        g.gain.setValueAtTime(0, t);
        g.gain.setValueAtTime(0.2, t + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2);
        osc.connect(g).connect(this.sfxGain);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.2);
      });
    }

    /** 게임 오버 — 하강하는 슬로우 멜로디 */
    _playGameOver(t) {
      const notes = [392, 349.23, 329.63, 261.63]; // G4, F4, E4, C4
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.3);
        g.gain.setValueAtTime(0, t);
        g.gain.setValueAtTime(0.25, t + i * 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.3 + 0.35);
        osc.connect(g).connect(this.sfxGain);
        osc.start(t + i * 0.3);
        osc.stop(t + i * 0.3 + 0.35);
      });
    }

    /** 게임 시작 — 짧은 상승 */
    _playStart(t) {
      const notes = [261.63, 329.63, 392, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t + i * 0.1);
        g.gain.setValueAtTime(0, t);
        g.gain.setValueAtTime(0.2, t + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.15);
        osc.connect(g).connect(this.sfxGain);
        osc.start(t + i * 0.1);
        osc.stop(t + i * 0.1 + 0.15);
      });
    }

    /** 먹이 먹음 — 밝고 짧은 팝 사운드 */
    _playEat(t) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    }

    /** 선택 — 부드러운 클릭 */
    _playSelect(t) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.04);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.08);
    }

    /** 무효 — 낮고 짧은 buzz */
    _playInvalid(t) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(g).connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
    }

    // ========================
    //     배경음 (BGM)
    // ========================

    /**
     * BGM을 재생합니다.
     * @param {'sirtet'|'snake'|'fruitbox'} preset - 프리셋 이름
     */
    playBGM(preset) {
      if (!this.enabled || !this.ctx || this.bgmPlaying) return;
      this.stopBGM();
      this.bgmPlaying = true;

      switch (preset) {
        case 'sirtet':
          this._playSirtetBGM();
          break;
        case 'snake':
          this._playSnakeBGM();
          break;
        case 'fruitbox':
          this._playFruitBoxBGM();
          break;
      }
    }

    stopBGM() {
      this.bgmNodes.forEach((node) => {
        try { node.stop(); } catch (_) {}
        node.disconnect();
      });
      this.bgmNodes = [];
      this.bgmPlaying = false;
    }

    /**
     * Sirtet BGM — Koro-Sensei's Tetris Theme (Everlydeen) style
     * simple loop melody. 8-bit style.
     */
    _playSirtetBGM() {
      const now = this.ctx.currentTime;

      // Melody (Everlydeen-inspired melody loop)
      // Notes: [frequency, duration in beats]
      const melody = [
        // Phrase 1
        [659.25, 0.5], [659.25, 0.5], [587.33, 1.0], [659.25, 1.0], [783.99, 1.0],
        [698.46, 1.0], [587.33, 0.5], [659.25, 0.5], [698.46, 1.0], [783.99, 1.0],
        [659.25, 0.5], [698.46, 0.5], [783.99, 1.0], [880.00, 1.0], [783.99, 0.5],
        [659.25, 0.5], [587.33, 1.0], [523.25, 1.0], [587.33, 1.0], [659.25, 1.0],
        // Phrase 2
        [659.25, 0.5], [659.25, 0.5], [587.33, 1.0], [659.25, 1.0], [783.99, 1.0],
        [698.46, 1.0], [587.33, 0.5], [659.25, 0.5], [698.46, 1.0], [783.99, 1.0],
        [659.25, 0.5], [698.46, 0.5], [783.99, 1.0], [880.00, 1.0], [783.99, 0.5],
        [659.25, 0.5], [587.33, 1.0], [523.25, 1.0], [587.33, 1.0], [659.25, 1.0],
      ];

      const bpm = 132;
      const beatDur = 60 / bpm;
      const loopDuration = melody.reduce((sum, [, d]) => sum + d, 0) * beatDur;

      // Create a buffer source that loops
      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sampleRate * loopDuration, sampleRate);
      const data = buffer.getChannelData(0);

      // Synthesize melody into buffer
      let timeOffset = 0;
      for (const [freq, beats] of melody) {
        const dur = beats * beatDur;
        const startSample = Math.floor(timeOffset * sampleRate);
        const endSample = Math.floor((timeOffset + dur) * sampleRate);

        for (let i = startSample; i < endSample && i < data.length; i++) {
          const t = i / sampleRate;
          const phase = (t - timeOffset) / dur;
          // Square wave with envelope
          const square = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
          const envelope = phase < 0.05 ? phase / 0.05 : (phase > 0.9 ? (1 - phase) / 0.1 : 1);
          data[i] = square * 0.15 * envelope;
        }
        timeOffset += dur;
      }

      // Bass line (simple root notes)
      const bassNotes = [130.81, 130.81, 146.83, 146.83, 174.61, 174.61, 164.81, 164.81,
                          130.81, 130.81, 146.83, 146.83, 174.61, 174.61, 196.00, 196.00,
                          130.81, 130.81, 146.83, 146.83, 174.61, 174.61, 164.81, 164.81,
                          130.81, 130.81, 146.83, 146.83, 174.61, 174.61, 196.00, 196.00];
      let bassTime = 0;
      for (let i = 0; i < bassNotes.length; i++) {
        const freq = bassNotes[i];
        const dur = beatDur;
        const startSample = Math.floor(bassTime * sampleRate);
        const endSample = Math.floor((bassTime + dur) * sampleRate);

        for (let i2 = startSample; i2 < endSample && i2 < data.length; i2++) {
          const t = i2 / sampleRate;
          const square = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
          data[i2] += square * 0.06;
        }
        bassTime += dur;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.bgmGain);
      source.start(now);
      this.bgmNodes.push(source);
    }

    /**
     * Snake BGM — 경쾌한 8비트 루프 멜로디
     */
    _playSnakeBGM() {
      const now = this.ctx.currentTime;

      const melody = [
        [523.25, 0.5], [659.25, 0.5], [783.99, 0.5], [659.25, 0.5],
        [523.25, 0.5], [587.33, 0.5], [659.25, 1.0],
        [783.99, 0.5], [880.00, 0.5], [783.99, 0.5], [659.25, 0.5],
        [523.25, 0.5], [587.33, 0.5], [659.25, 1.0],
        [659.25, 0.5], [783.99, 0.5], [880.00, 0.5], [783.99, 0.5],
        [659.25, 0.5], [523.25, 0.5], [587.33, 0.5], [659.25, 1.0],
      ];

      const bpm = 120;
      const beatDur = 60 / bpm;
      const loopDuration = melody.reduce((sum, [, d]) => sum + d, 0) * beatDur;

      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sampleRate * loopDuration, sampleRate);
      const data = buffer.getChannelData(0);

      let timeOffset = 0;
      for (const [freq, beats] of melody) {
        const dur = beats * beatDur;
        const startSample = Math.floor(timeOffset * sampleRate);
        const endSample = Math.floor((timeOffset + dur) * sampleRate);

        for (let i = startSample; i < endSample && i < data.length; i++) {
          const t = i / sampleRate;
          const phase = (t - timeOffset) / dur;
          const square = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
          const envelope = phase < 0.05 ? phase / 0.05 : (phase > 0.9 ? (1 - phase) / 0.1 : 1);
          data[i] = square * 0.12 * envelope;
        }
        timeOffset += dur;
      }

      const bassNotes = [130.81, 130.81, 146.83, 146.83, 130.81, 130.81, 146.83, 146.83,
                          130.81, 130.81, 146.83, 146.83, 130.81, 130.81, 146.83, 146.83];
      let bassTime = 0;
      for (let i = 0; i < bassNotes.length; i++) {
        const freq = bassNotes[i];
        const dur = beatDur;
        const startSample = Math.floor(bassTime * sampleRate);
        const endSample = Math.floor((bassTime + dur) * sampleRate);

        for (let i2 = startSample; i2 < endSample && i2 < data.length; i2++) {
          const t = i2 / sampleRate;
          const square = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
          data[i2] += square * 0.05;
        }
        bassTime += dur;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.bgmGain);
      source.start(now);
      this.bgmNodes.push(source);
    }

    /**
     * FruitBox BGM — 경쾌한 팝 스타일 8비트 루프
     */
    _playFruitBoxBGM() {
      const now = this.ctx.currentTime;

      const melody = [
        [659.25, 0.5], [783.99, 0.5], [880.00, 1.0], [783.99, 0.5], [659.25, 0.5],
        [587.33, 0.5], [659.25, 0.5], [523.25, 1.0],
        [783.99, 0.5], [880.00, 0.5], [1046.50, 1.0], [880.00, 0.5], [783.99, 0.5],
        [659.25, 0.5], [587.33, 0.5], [523.25, 1.0],
      ];

      const bpm = 110;
      const beatDur = 60 / bpm;
      const loopDuration = melody.reduce((sum, [, d]) => sum + d, 0) * beatDur;

      const sampleRate = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sampleRate * loopDuration, sampleRate);
      const data = buffer.getChannelData(0);

      let timeOffset = 0;
      for (const [freq, beats] of melody) {
        const dur = beats * beatDur;
        const startSample = Math.floor(timeOffset * sampleRate);
        const endSample = Math.floor((timeOffset + dur) * sampleRate);

        for (let i = startSample; i < endSample && i < data.length; i++) {
          const t = i / sampleRate;
          const phase = (t - timeOffset) / dur;
          const triangle = Math.sin(2 * Math.PI * freq * t);
          const envelope = phase < 0.05 ? phase / 0.05 : (phase > 0.9 ? (1 - phase) / 0.1 : 1);
          data[i] = triangle * 0.12 * envelope;
        }
        timeOffset += dur;
      }

      const bassNotes = [164.81, 164.81, 196.00, 196.00, 174.61, 174.61, 164.81, 164.81,
                          196.00, 196.00, 220.00, 220.00, 196.00, 196.00, 174.61, 174.61];
      let bassTime = 0;
      for (let i = 0; i < bassNotes.length; i++) {
        const freq = bassNotes[i];
        const dur = beatDur;
        const startSample = Math.floor(bassTime * sampleRate);
        const endSample = Math.floor((bassTime + dur) * sampleRate);

        for (let i2 = startSample; i2 < endSample && i2 < data.length; i2++) {
          const t = i2 / sampleRate;
          const square = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
          data[i2] += square * 0.04;
        }
        bassTime += dur;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.bgmGain);
      source.start(now);
      this.bgmNodes.push(source);
    }

    // ========================
    //     설정
    // ========================

    setVolume(bgmVol, sfxVol) {
      if (this.bgmGain) this.bgmGain.gain.value = bgmVol ?? this.bgmGain.gain.value;
      if (this.sfxGain) this.sfxGain.gain.value = sfxVol ?? this.sfxGain.gain.value;
    }

    toggle() {
      this.enabled = !this.enabled;
      if (!this.enabled) {
        this.stopBGM();
      }
      return this.enabled;
    }

    /** 모든 리소스를 정리합니다. */
    destroy() {
      this.stopBGM();
      if (this.ctx) {
        this.ctx.close();
        this.ctx = null;
      }
    }
  }

  // 전역에 노출
  window.GameAudio = GameAudio;
})();
