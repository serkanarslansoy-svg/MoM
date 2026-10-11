// Runs on the audio thread. Turns the microphone signal into 16 kHz mono
// 16-bit PCM (what speech recognition expects) and reports the input level.
class Pcm16kRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pos = 0; this.acc = 0; this.n = 0;
    this.out = new Int16Array(8000); // 0.5 s per message
    this.o = 0; this.sq = 0; this.sqn = 0;
    this.paused = false;
    this.port.onmessage = (e) => {
      if ("paused" in e.data) this.paused = e.data.paused;
      if (e.data.flush) {
        const rest = this.out.slice(0, this.o);
        this.o = 0;
        this.port.postMessage({ pcm: rest, flushed: true }, [rest.buffer]);
      }
    };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch || this.paused) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i];
      this.acc += s; this.n++; this.pos += 1;
      if (this.pos >= this.ratio) {
        this.pos -= this.ratio;
        // box average over the source samples is a cheap low-pass before decimating
        let v = this.acc / this.n; this.acc = 0; this.n = 0;
        if (v > 1) v = 1; else if (v < -1) v = -1;
        this.out[this.o++] = v < 0 ? v * 32768 : v * 32767;
        this.sq += v * v; this.sqn++;
        if (this.sqn === 1600) { // level every 0.1 s
          this.port.postMessage({ level: Math.sqrt(this.sq / this.sqn) });
          this.sq = 0; this.sqn = 0;
        }
        if (this.o === this.out.length) {
          const full = this.out;
          this.out = new Int16Array(8000); this.o = 0;
          this.port.postMessage({ pcm: full }, [full.buffer]);
        }
      }
    }
    return true;
  }
}
registerProcessor("pcm16k-recorder", Pcm16kRecorder);
