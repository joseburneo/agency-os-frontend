"use client";

import { useEffect, useRef } from "react";

// The website's hero constellation, living behind the rail.
//
// Ported from ConstellationCanvas in luxvance-website/src/Home.jsx: drifting
// nodes, hairlines between near neighbours, energy pulses travelling along the
// edges, and yellow bloom under the cursor. Same numbers where they set the
// character (150px link radius, the pulse speeds, the exact rgba values), and
// different where a sidebar is not a hero:
//
//   DENSITY, not a fixed count. The hero spreads 80 nodes across a whole screen.
//   A 264px rail with 80 nodes is static, and the edge pass is O(n²): the hero
//   pays 3,160 distance checks a frame for a few seconds, while this runs for as
//   long as the CRM is open. Scaling to area keeps it near 25 nodes and ~300
//   checks, which is nothing.
//
//   IT STOPS. On a hidden tab, and for anyone who asked the OS for less motion,
//   in which case it paints one still frame so the texture survives and the
//   movement does not. An animation nobody can turn off is a background process
//   with a design justification.
export function RailConstellation() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let w = 0;
    let h = 0;

    type Node = { x: number; y: number; vx: number; vy: number; r: number; pulse: number };
    let nodes: Node[] = [];
    const pulses: { a: number; b: number; t: number; speed: number }[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const build = () => {
      const rect = host.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, w * dpr);
      canvas.height = Math.max(1, h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // One node per ~9,000px². A tall narrow rail lands around 25.
      const count = Math.max(10, Math.min(46, Math.round((w * h) / 9000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: 1 + Math.random() * 1.5,
        pulse: Math.random() * Math.PI * 2,
      }));
    };

    const spawnPulse = () => {
      if (pulses.length > 3 || nodes.length < 2) return;
      const a = Math.floor(Math.random() * nodes.length);
      let b = a;
      let best = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        if (i === a) continue;
        const dx = nodes[a].x - nodes[i].x;
        const dy = nodes[a].y - nodes[i].y;
        const d = dx * dx + dy * dy;
        if (d < best && d < 180 * 180) { best = d; b = i; }
      }
      if (b !== a) pulses.push({ a, b, t: 0, speed: 0.012 + Math.random() * 0.015 });
    };

    const MAX_DIST = 150;
    let lastSpawn = 0;

    const draw = (now: number, animate: boolean) => {
      ctx.clearRect(0, 0, w, h);
      const { x: mx, y: my, active } = mouse;

      if (animate) {
        if (now - lastSpawn > 900) { spawnPulse(); lastSpawn = now; }
        for (const n of nodes) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
          // The hero attracts nodes to the cursor. Here that was the whole
          // problem: a screen-wide field disperses the pull, a 264px rail does
          // not, so all 25 nodes converged into one bright knot that sat on top
          // of the nav. The cursor still lights the field up, it just no longer
          // moves it, so nothing can ever pile onto the text.
          n.vx *= 0.985; n.vy *= 0.985;
          if (Math.abs(n.vx) < 0.05) n.vx += (Math.random() - 0.5) * 0.02;
          if (Math.abs(n.vy) < 0.05) n.vy += (Math.random() - 0.5) * 0.02;
          n.pulse += 0.02;
        }
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= MAX_DIST) continue;
          const t = 1 - d / MAX_DIST;
          let boost = 0;
          if (active) {
            const mdx = (a.x + b.x) / 2 - mx;
            const mdy = (a.y + b.y) / 2 - my;
            const md = Math.sqrt(mdx * mdx + mdy * mdy);
            if (md < 200) boost = (1 - md / 200) * 0.16;
          }
          ctx.strokeStyle = boost > 0
            ? `rgba(255,214,10,${(t * 0.4 + boost * 0.6).toFixed(3)})`
            : `rgba(255,255,255,${(t * 0.1).toFixed(3)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        if (animate) p.t += p.speed;
        if (p.t >= 1) { pulses.splice(i, 1); continue; }
        const a = nodes[p.a], b = nodes[p.b];
        if (!a || !b) { pulses.splice(i, 1); continue; }
        const px = a.x + (b.x - a.x) * p.t;
        const py = a.y + (b.y - a.y) * p.t;
        const fade = Math.sin(p.t * Math.PI);
        ctx.fillStyle = `rgba(255,214,10,${(fade * 0.45).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,214,10,${(fade * 0.08).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
      }

      for (const n of nodes) {
        const breathe = 1 + Math.sin(n.pulse) * 0.3;
        const dx = active ? mx - n.x : 0;
        const dy = active ? my - n.y : 0;
        const md = Math.sqrt(dx * dx + dy * dy);
        const near = active && md < 160;
        ctx.fillStyle = near
          ? `rgba(255,214,10,${(0.25 + (1 - md / 160) * 0.35).toFixed(3)})`
          : "rgba(245,245,240,0.45)";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * breathe, 0, Math.PI * 2); ctx.fill();
        if (near) {
          ctx.fillStyle = `rgba(255,214,10,${((1 - md / 160) * 0.07).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(n.x, n.y, 10, 0, Math.PI * 2); ctx.fill();
        }
      }
    };

    const loop = (now: number) => {
      draw(now, true);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced || document.hidden) return;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => { build(); if (reduced) draw(0, false); };

    build();
    if (reduced) draw(0, false); else start();

    host.addEventListener("mousemove", onMove);
    host.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);

    return () => {
      stop();
      host.removeEventListener("mousemove", onMove);
      host.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className="rail-bg" aria-hidden />;
}
