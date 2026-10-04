/**
 * Plays Nami's stacked-alpha MP4 clips (colour on top, alpha below) onto a
 * transparent canvas with a tiny WebGL shader. Works in every browser that has
 * H.264 + WebGL; anywhere else `ok` is false and NamiImage keeps the stills.
 *
 * One video element per clip, created on demand and kept, so replays are free.
 * A sequence is a list of clips played back to back, optionally ending in a
 * loop. The canvas keeps the last frame it drew until the next clip has a frame,
 * so hand-overs never flash empty.
 */

export type ClipRef = { src: string; fps: number };

const VERT = `attribute vec2 p; varying vec2 uv;
void main(){ uv = vec2((p.x+1.0)*0.5, (1.0-p.y)*0.5); gl_Position = vec4(p,0.0,1.0); }`;
const FRAG = `precision mediump float; varying vec2 uv; uniform sampler2D t;
void main(){
  vec3 c = texture2D(t, vec2(uv.x, uv.y*0.5)).rgb;
  float a = texture2D(t, vec2(uv.x, 0.5 + uv.y*0.5)).r;
  a = clamp((a - 0.02) / 0.96, 0.0, 1.0);
  gl_FragColor = vec4(c*a, a);
}`;

export class ClipPlayer {
  ok = false;
  private gl: WebGLRenderingContext | null = null;
  private videos = new Map<string, HTMLVideoElement>();
  private queue: { ref: ClipRef; loop: boolean }[] = [];
  private cur: HTMLVideoElement | null = null;
  private curLoop = false;
  private drewCur = false;
  /** true while something is on the canvas that should cover the still */
  showing = false;
  onDone: (() => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    try {
      const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
      if (!gl) return;
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
        return s;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.clearColor(0, 0, 0, 0);
      this.gl = gl;
      this.ok = true;
    } catch {
      this.ok = false;
    }
  }

  private video(src: string) {
    let v = this.videos.get(src);
    if (!v) {
      v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.crossOrigin = 'anonymous';
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.src = src;
      this.videos.set(src, v);
    }
    return v;
  }

  /** start fetching a clip; resolves once it can play through */
  preload(src: string): Promise<void> {
    const v = this.video(src);
    if (v.readyState >= 4) return Promise.resolve();
    return new Promise((res, rej) => {
      const done = () => {
        v.removeEventListener('canplaythrough', done);
        v.removeEventListener('error', fail);
        res();
      };
      const fail = () => {
        v.removeEventListener('canplaythrough', done);
        v.removeEventListener('error', fail);
        rej(new Error('clip failed: ' + src));
      };
      v.addEventListener('canplaythrough', done);
      v.addEventListener('error', fail);
      v.load();
    });
  }

  /** play clips back to back; the last one loops if `loop` */
  play(seq: ClipRef[], loop: ClipRef | null) {
    this.queue = seq.map((ref) => ({ ref, loop: false }));
    if (loop) this.queue.push({ ref: loop, loop: true });
    this.next();
  }

  /** stop everything; the caller shows the still again */
  stop() {
    this.queue = [];
    if (this.cur) this.cur.pause();
    this.cur = null;
    this.showing = false;
  }

  private next() {
    if (this.cur) this.cur.pause();
    const n = this.queue.shift();
    if (!n) {
      this.cur = null;
      this.showing = false;
      this.onDone?.();
      return;
    }
    const v = this.video(n.ref.src);
    v.loop = n.loop;
    v.currentTime = 0;
    v.onended = n.loop ? null : () => this.next();
    this.cur = v;
    this.curLoop = n.loop;
    this.drewCur = false;
    v.play().catch(() => this.next());
  }

  /** call every animation frame */
  draw() {
    const gl = this.gl;
    const v = this.cur;
    if (!gl || !v) return;
    // wait for the new clip's first frame; until then the canvas keeps the old one
    if (v.readyState < 2 || (!this.drewCur && v.currentTime === 0 && v.paused)) return;
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
    } catch {
      return;
    }
    if (this.canvas.width !== v.videoWidth || this.canvas.height !== v.videoHeight / 2) {
      this.canvas.width = v.videoWidth;
      this.canvas.height = v.videoHeight / 2;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.drewCur = true;
    this.showing = true;
  }

  /** a sequence was started but nothing of it has been drawn yet */
  get pending() {
    return !!this.cur && !this.drewCur;
  }

  get looping() {
    return this.curLoop && !!this.cur;
  }

  dispose() {
    this.stop();
    for (const v of this.videos.values()) {
      v.removeAttribute('src');
      v.load();
    }
    this.videos.clear();
    // don't lose the GL context: React may remount onto this same canvas (StrictMode)
    this.gl?.clear(this.gl.COLOR_BUFFER_BIT);
  }
}
