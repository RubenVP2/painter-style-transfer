/**
 * A tiny WebGL renderer for the live parallax preview: it samples a wallpaper
 * and its depthmap and offsets each pixel by depth, driven by the same camera
 * state the service uses (see parallax-camera.ts).
 *
 * This is a single-step depth displacement, not DepthFlow's ray-marched render,
 * so it is an *approximation* of the exported frame — faithful to the motion,
 * the depth separation and the invert-depth flag, calibrated so the default
 * presets read at a similar strength. It exists so the customisation loop is
 * instant and offline of ffmpeg; the video is still what /render produces.
 */

import type { ParallaxCamera } from "./parallax-camera";
import type { ImageSource } from "./render/primitives";

// Visual calibration: maps the presets' camera offsets to a screen-space
// displacement that reads like the DepthFlow output without clipping the frame.
const AMPLITUDE = 0.5;

const VERTEX_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  // A single triangle covering the clip space; flip Y so texture (0,0) is top-left.
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform sampler2D uDepth;
uniform vec2 uOffset;
uniform float uSteady;
uniform float uIsometric;
uniform float uHeight;
uniform float uZoom;
uniform bool uInvert;
uniform float uAmp;

void main() {
  // Zoom around the frame centre first.
  vec2 centred = (vUv - 0.5) / max(uZoom, 0.001);
  vec2 uv = centred + 0.5;

  float d = texture2D(uDepth, uv).r;
  if (uInvert) d = 1.0 - d;

  // Depth relative to the steady plane, which stays fixed (zero parallax there).
  float rel = d - uSteady;
  // Camera pan shifts planes by their relative depth.
  vec2 pan = uOffset * rel;
  // Perspective: pixels away from centre fan out with depth; isometric flattens it.
  vec2 persp = centred * rel * (1.0 - uIsometric);

  vec2 sampleUv = uv - (pan + persp) * uHeight * uAmp;
  gl_FragColor = vec4(texture2D(uImage, sampleUv).rgb, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL: création du shader impossible.");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`WebGL: compilation échouée — ${log ?? "raison inconnue"}`);
  }
  return shader;
}

function uploadTexture(gl: WebGLRenderingContext, texture: WebGLTexture, source: TexImageSource) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}

/**
 * Owns one canvas and its GL resources. The image and depthmap are set once per
 * wallpaper; `render(camera)` runs every frame with fresh camera state.
 *
 * Context loss is handled: the resources are rebuilt and the last image/depth
 * re-uploaded on restore, so a backgrounded tab or a GPU reset recovers on its
 * own instead of freezing.
 */
export class ParallaxRenderer {
  private gl: WebGLRenderingContext;
  private program!: WebGLProgram;
  private imageTex!: WebGLTexture;
  private depthTex!: WebGLTexture;
  private uniforms!: Record<string, WebGLUniformLocation | null>;
  private image: TexImageSource | null = null;
  private depth: TexImageSource | null = null;
  private lost = false;
  private readonly onLost: (event: Event) => void;
  private readonly onRestored: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { alpha: false, antialias: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL n'est pas disponible dans ce navigateur.");
    this.gl = gl;

    this.onLost = (event) => {
      event.preventDefault();
      this.lost = true;
    };
    this.onRestored = () => {
      this.lost = false;
      this.build();
      if (this.image) uploadTexture(this.gl, this.imageTex, this.image);
      if (this.depth) uploadTexture(this.gl, this.depthTex, this.depth);
    };
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);

    this.build();
  }

  private build() {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) throw new Error("WebGL: création du programme impossible.");
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`WebGL: édition de liens échouée — ${gl.getProgramInfoLog(program) ?? ""}`);
    }
    gl.useProgram(program);
    this.program = program;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One oversized triangle covers the viewport with no seams.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.imageTex = gl.createTexture()!;
    this.depthTex = gl.createTexture()!;
    this.uniforms = {
      uImage: gl.getUniformLocation(program, "uImage"),
      uDepth: gl.getUniformLocation(program, "uDepth"),
      uOffset: gl.getUniformLocation(program, "uOffset"),
      uSteady: gl.getUniformLocation(program, "uSteady"),
      uIsometric: gl.getUniformLocation(program, "uIsometric"),
      uHeight: gl.getUniformLocation(program, "uHeight"),
      uZoom: gl.getUniformLocation(program, "uZoom"),
      uInvert: gl.getUniformLocation(program, "uInvert"),
      uAmp: gl.getUniformLocation(program, "uAmp"),
    };
    gl.uniform1i(this.uniforms.uImage, 0);
    gl.uniform1i(this.uniforms.uDepth, 1);
  }

  setImage(source: ImageSource) {
    this.image = source as TexImageSource;
    if (!this.lost) uploadTexture(this.gl, this.imageTex, this.image);
  }

  setDepth(source: TexImageSource) {
    this.depth = source;
    if (!this.lost) uploadTexture(this.gl, this.depthTex, source);
  }

  /** Sizes the drawing buffer to the display box (device-pixel aware). */
  resize(cssWidth: number, cssHeight: number) {
    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  render(camera: ParallaxCamera, invert: boolean) {
    if (this.lost || !this.image || !this.depth) return;
    const gl = this.gl;
    const u = this.uniforms;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTex);

    gl.uniform2f(u.uOffset, camera.offsetX, camera.offsetY);
    gl.uniform1f(u.uSteady, camera.steady);
    gl.uniform1f(u.uIsometric, camera.isometric);
    gl.uniform1f(u.uHeight, camera.height);
    gl.uniform1f(u.uZoom, camera.zoom);
    gl.uniform1i(u.uInvert, invert ? 1 : 0);
    gl.uniform1f(u.uAmp, AMPLITUDE);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.imageTex);
    gl.deleteTexture(this.depthTex);
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }
}
