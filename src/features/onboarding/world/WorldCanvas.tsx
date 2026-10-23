"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import { WORLD, camera, currentView } from "./camera";

/**
 * Draws the window of the artwork the camera is looking at.
 *
 * The art is pixel art that has to fill screens several times its own size,
 * and scaling it the usual ways either blurs it or makes its pixels crawl as
 * the camera moves. This shader keeps every art pixel a hard-edged block and
 * softens only the one device pixel where two blocks meet, so the picture
 * stays crisp and steady at any size and any scroll position.
 *
 * The artwork itself is never altered: the supplied PNG is drawn as it is,
 * with no filter, tint, ripple or vignette on top. The only thing that ever
 * changes its brightness is the fade from black on arrival and to black on entry.
 */

const VERTEX = /* glsl */ `
  attribute vec2 aCorner;
  varying vec2 vUv;
  void main() {
    vUv = aCorner * 0.5 + 0.5;
    gl_Position = vec4(aCorner, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D uArt;
  uniform vec2 uArtSize;
  uniform vec4 uView;     // left, top, width, height in art pixels
  uniform vec2 uCanvas;   // size in device pixels
  uniform float uDim;     // 0 except while fading in on arrival and out on entry
  varying vec2 vUv;

  void main() {
    // The art pixel under this fragment. Screen y runs up, art rows run down.
    vec2 p = uView.xy + vec2(vUv.x, 1.0 - vUv.y) * uView.zw;

    // Hard-edged art pixels, antialiased across exactly one device pixel.
    vec2 perPixel = min(uView.zw / uCanvas, vec2(1.0));
    vec2 seam = floor(p + 0.5);
    p = seam + clamp((p - seam) / perPixel, -0.5, 0.5);

    // The artwork's own colour, with nothing laid over it.
    gl_FragColor = vec4(texture2D(uArt, p / uArtSize).rgb * (1.0 - uDim), 1.0);
  }
`;

type Props = {
  /** Called once the artwork is decoded and the first frame is on screen. */
  onReady: () => void;
};

export function WorldCanvas({ onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const image = new Image();
    image.decoding = "async";
    image.src = WORLD.src;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      // Development only: keeps the last frame readable so it can be inspected pixel for pixel.
      preserveDrawingBuffer: process.env.NODE_ENV !== "production",
    });
    const flat = gl ? null : canvas.getContext("2d");

    let uniforms: Record<string, WebGLUniformLocation | null> = {};
    let loaded = false;
    let cancelled = false;
    // What was last drawn, so an unchanged frame costs nothing.
    let drawn = "";

    const compile = (context: WebGLRenderingContext, type: number, source: string) => {
      const shader = context.createShader(type)!;
      context.shaderSource(shader, source);
      context.compileShader(shader);
      return shader;
    };

    const setup = () => {
      if (!gl) return;
      const program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const corner = gl.getAttribLocation(program, "aCorner");
      gl.enableVertexAttribArray(corner);
      gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

      uniforms = {};
      for (const name of ["uArt", "uArtSize", "uView", "uCanvas", "uDim"]) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }
      gl.uniform1i(uniforms.uArt, 0);
      gl.uniform2f(uniforms.uArtSize, WORLD.width, WORLD.height);

      // The file's own values go to the screen: no colour conversion, no premultiplying.
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (loaded) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      drawn = "";
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl?.viewport(0, 0, width, height);
        drawn = "";
      }
    };

    const draw = () => {
      if (!loaded) return;
      const view = currentView(canvas.clientWidth, canvas.clientHeight);
      const state = `${view.left.toFixed(3)},${view.top.toFixed(3)},${view.width.toFixed(3)},${camera.dim.toFixed(3)}`;
      if (state === drawn) return;
      drawn = state;

      if (gl) {
        gl.uniform4f(uniforms.uView, view.left, view.top, view.width, view.height);
        gl.uniform2f(uniforms.uCanvas, canvas.width, canvas.height);
        gl.uniform1f(uniforms.uDim, camera.dim);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (flat) {
        // No WebGL: plain nearest-neighbour drawing, still the artwork as supplied.
        flat.imageSmoothingEnabled = false;
        flat.drawImage(image, view.left, view.top, view.width, view.height, 0, 0, canvas.width, canvas.height);
        flat.fillStyle = `rgba(0, 0, 0, ${camera.dim})`;
        flat.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    const onLost = (event: Event) => event.preventDefault();
    const onRestored = () => setup();
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    setup();
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    gsap.ticker.add(draw);

    image
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        loaded = true;
        if (gl) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        draw();
        readyRef.current();
      });

    return () => {
      cancelled = true;
      gsap.ticker.remove(draw);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, []);

  return <canvas ref={canvasRef} className="onb-world" aria-hidden="true" />;
}
