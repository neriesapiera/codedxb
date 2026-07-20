import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";

/* ============================================================
   CODE DXB — Cross Runway Stage · 3D Visualization
   60m (W) x 22m (D) footprint · central stage + 4 runways
   Drag to orbit · scroll / pinch to zoom · preset camera views
   ============================================================ */

const VIEWS = {
  hero:    { theta: Math.PI * 0.5, phi: 1.18, r: 62 },
  top:     { theta: Math.PI * 0.5, phi: 0.12, r: 78 },
  speaker: { theta: Math.PI * 0.5, phi: 1.42, r: 26 },
  corner:  { theta: Math.PI * 0.28, phi: 1.05, r: 58 },
};

export default function CrossRunwayStage3D() {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [autoRotate, setAutoRotate] = useState(true);
  const [activeView, setActiveView] = useState("hero");
  const autoRef = useRef(true);
  autoRef.current = autoRotate;

  useEffect(() => {
    const mount = mountRef.current;
    const W = mount.clientWidth;
    const H = mount.clientHeight;

    /* ---------- renderer / scene / camera ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);
    scene.fog = new THREE.FogExp2(0x04060c, 0.0075);

    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 500);

    // orbit state (custom controls — spherical coords around a target)
    const orbit = {
      theta: VIEWS.hero.theta,
      phi: VIEWS.hero.phi,
      r: VIEWS.hero.r,
      target: new THREE.Vector3(0, 1, 0),
      goal: null,
    };
    stateRef.current.orbit = orbit;

    function applyCamera() {
      const { theta, phi, r, target } = orbit;
      camera.position.set(
        target.x + r * Math.sin(phi) * Math.cos(theta),
        target.y + r * Math.cos(phi),
        target.z + r * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
    }

    /* ---------- materials ---------- */
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c12, roughness: 0.35, metalness: 0.55,
    });
    const glossMat = new THREE.MeshStandardMaterial({
      color: 0x090b10, roughness: 0.15, metalness: 0.75,
    });
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });
    const ledBlue = new THREE.MeshBasicMaterial({ color: 0x2f7dff });

    /* ---------- venue floor ---------- */
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(120, 64),
      new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.9, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    /* ---------- stage geometry ----------
       central Ø11 (h 1.2) · runways w4.5 (h 0.9)
       side runways to x≈±24 · end platforms Ø5.5
       front/back arms shorter, platforms Ø5              */
    const stage = new THREE.Group();
    scene.add(stage);

    const CENTER_R = 5.5, CENTER_H = 1.2;
    const RUN_H = 0.9, RUN_W = 4.5;
    const SIDE_LEN = 18.5, SIDE_START = 5.2;
    const END_R = 2.75;
    const FB_LEN = 4.2, FB_START = 5.2;
    const FB_END_R = 2.5;

    // central stage
    const central = new THREE.Mesh(
      new THREE.CylinderGeometry(CENTER_R, CENTER_R, CENTER_H, 64),
      glossMat
    );
    central.position.y = CENTER_H / 2;
    central.castShadow = central.receiveShadow = true;
    stage.add(central);

    // CODE DXB logo on central deck (canvas texture)
    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = logoCanvas.height = 512;
    const lg = logoCanvas.getContext("2d");
    lg.clearRect(0, 0, 512, 512);
    lg.fillStyle = "rgba(255,255,255,0.92)";
    lg.textAlign = "center";
    lg.font = "800 92px Arial, sans-serif";
    lg.fillText("CODE", 256, 240);
    lg.fillText("DXB", 256, 340);
    lg.strokeStyle = "rgba(150,200,255,0.5)";
    lg.lineWidth = 4;
    lg.beginPath();
    lg.arc(256, 256, 200, 0, Math.PI * 2);
    lg.stroke();
    const logoTex = new THREE.CanvasTexture(logoCanvas);
    const logo = new THREE.Mesh(
      new THREE.CircleGeometry(CENTER_R * 0.82, 48),
      new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, opacity: 0.9 })
    );
    logo.rotation.x = -Math.PI / 2;
    logo.position.y = CENTER_H + 0.01;
    stage.add(logo);

    // LED ring around central stage rim
    const centerRing = new THREE.Mesh(
      new THREE.TorusGeometry(CENTER_R, 0.09, 8, 96),
      ledMat
    );
    centerRing.rotation.x = Math.PI / 2;
    centerRing.position.y = CENTER_H;
    stage.add(centerRing);

    // helper: runway box + edge LED strips
    function addRunway(len, width, cx, cz, alongX) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? len : width, RUN_H, alongX ? width : len),
        deckMat
      );
      box.position.y = RUN_H / 2;
      box.castShadow = box.receiveShadow = true;
      g.add(box);
      // LED strips on both long edges
      const strip = new THREE.BoxGeometry(alongX ? len : 0.14, 0.06, alongX ? 0.14 : len);
      [-1, 1].forEach((s) => {
        const m = new THREE.Mesh(strip, ledMat);
        if (alongX) m.position.set(0, RUN_H + 0.02, (s * width) / 2);
        else m.position.set((s * width) / 2, RUN_H + 0.02, 0);
        g.add(m);
      });
      g.position.set(cx, 0, cz);
      stage.add(g);
    }

    // helper: end platform with LED ring
    function addEndPlatform(r, cx, cz) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, RUN_H, 48), glossMat);
      p.position.set(cx, RUN_H / 2, cz);
      p.castShadow = p.receiveShadow = true;
      stage.add(p);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 8, 64), ledMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cx, RUN_H, cz);
      stage.add(ring);
      const glow = new THREE.PointLight(0x66aaff, 0.6, 14);
      glow.position.set(cx, 2.5, cz);
      scene.add(glow);
    }

    // side runways + platforms (x axis → 60m width)
    addRunway(SIDE_LEN, RUN_W, +(SIDE_START + SIDE_LEN / 2), 0, true);
    addRunway(SIDE_LEN, RUN_W, -(SIDE_START + SIDE_LEN / 2), 0, true);
    addEndPlatform(END_R, +(SIDE_START + SIDE_LEN + END_R * 0.8), 0);
    addEndPlatform(END_R, -(SIDE_START + SIDE_LEN + END_R * 0.8), 0);

    // front/back runways + platforms (z axis → 22m depth)
    addRunway(FB_LEN, RUN_W, 0, +(FB_START + FB_LEN / 2), false);
    addRunway(FB_LEN, RUN_W, 0, -(FB_START + FB_LEN / 2), false);
    addEndPlatform(FB_END_R, 0, +(FB_START + FB_LEN + FB_END_R * 0.8));
    addEndPlatform(FB_END_R, 0, -(FB_START + FB_LEN + FB_END_R * 0.8));

    /* ---------- speaker figure ---------- */
    const speaker = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.1, 12), bodyMat);
    torso.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), bodyMat);
    head.position.y = 1.56;
    speaker.add(torso, head);
    speaker.position.set(0, CENTER_H, 1.2);
    speaker.traverse((o) => (o.castShadow = true));
    stage.add(speaker);

    /* ---------- LED screen backdrop ---------- */
    const scrCanvas = document.createElement("canvas");
    scrCanvas.width = 1024; scrCanvas.height = 288;
    const sg = scrCanvas.getContext("2d");
    const grad = sg.createLinearGradient(0, 0, 1024, 288);
    grad.addColorStop(0, "#04122e");
    grad.addColorStop(0.5, "#0a2f6e");
    grad.addColorStop(1, "#04122e");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 1024, 288);
    // electric streaks
    sg.strokeStyle = "rgba(90,160,255,0.35)";
    sg.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      sg.beginPath();
      let x = Math.random() * 1024, y = Math.random() * 288;
      sg.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (Math.random() - 0.5) * 130;
        y += (Math.random() - 0.5) * 90;
        sg.lineTo(x, y);
      }
      sg.stroke();
    }
    sg.fillStyle = "#eef6ff";
    sg.textAlign = "center";
    sg.font = "700 58px Arial, sans-serif";
    sg.fillText("AI.  PEOPLE.  POSSIBILITIES.", 512, 165);
    const scrTex = new THREE.CanvasTexture(scrCanvas);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 8.5),
      new THREE.MeshBasicMaterial({ map: scrTex })
    );
    screen.position.set(0, 11.5, -30);
    scene.add(screen);
    const scrFrame = new THREE.Mesh(
      new THREE.BoxGeometry(30.8, 9.3, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.6 })
    );
    scrFrame.position.set(0, 11.5, -30.25);
    scene.add(scrFrame);

    // vertical light bars flanking the screen
    [-20, -17, 17, 20].forEach((x) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 12, 0.25), ledBlue);
      bar.position.set(x, 9, -29.5);
      scene.add(bar);
    });

    /* ---------- audience (instanced, 4 quadrant wedges) ---------- */
    const seatGeo = new THREE.BoxGeometry(0.55, 0.75, 0.5);
    const wedges = [
      { a0: 14, a1: 76, tint: new THREE.Color(0x7f9fd6) },   // front-right
      { a0: 104, a1: 166, tint: new THREE.Color(0xb49fd8) }, // front-left
      { a0: 194, a1: 256, tint: new THREE.Color(0x9fc8a8) }, // back-left
      { a0: 284, a1: 346, tint: new THREE.Color(0xd6b98f) }, // back-right
    ];
    wedges.forEach(({ a0, a1, tint }) => {
      const positions = [];
      for (let r = 13.5; r <= 33; r += 1.5) {
        const arc = ((a1 - a0) * Math.PI) / 180 * r;
        const n = Math.floor(arc / 1.1);
        for (let i = 0; i <= n; i++) {
          const ang = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
          positions.push([
            r * Math.cos(ang),
            0.38 + (r - 13.5) * 0.16,
            r * Math.sin(ang),
          ]);
        }
      }
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
      const inst = new THREE.InstancedMesh(seatGeo, mat, positions.length);
      const dummy = new THREE.Object3D();
      const c = new THREE.Color();
      positions.forEach((p, i) => {
        dummy.position.set(p[0], p[1], p[2]);
        dummy.lookAt(0, p[1], 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        c.copy(tint).multiplyScalar(0.18 + Math.random() * 0.14);
        inst.setColorAt(i, c);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      scene.add(inst);
    });

    /* ---------- lighting ---------- */
    scene.add(new THREE.AmbientLight(0x22304a, 0.7));
    const key = new THREE.SpotLight(0xdfe9ff, 1.6, 90, Math.PI / 7, 0.45, 1);
    key.position.set(0, 34, 6);
    key.target = central;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x3355ff, 0.5);
    rim.position.set(-25, 18, -20);
    scene.add(rim);
    const warm = new THREE.PointLight(0x4477ff, 0.8, 60);
    warm.position.set(0, 14, 0);
    scene.add(warm);

    // volumetric-style beams from above
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x3d7dff, transparent: true, opacity: 0.06, depthWrite: false,
    });
    const beams = [];
    [[-16, 0], [16, 0], [0, 8.5], [0, -8.5], [-8, -14], [8, -14]].forEach(([x, z]) => {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 26, 24, 1, true), beamMat);
      beam.position.set(x, 26 - 13, z);
      scene.add(beam);
      beams.push(beam);
    });

    /* ---------- interaction (custom orbit) ---------- */
    let dragging = false, lx = 0, ly = 0, pinchDist = 0;
    const el = renderer.domElement;
    el.style.touchAction = "none";
    el.style.cursor = "grab";

    const down = (x, y) => { dragging = true; lx = x; ly = y; orbit.goal = null; el.style.cursor = "grabbing"; };
    const move = (x, y) => {
      if (!dragging) return;
      orbit.theta -= (x - lx) * 0.005;
      orbit.phi = Math.max(0.1, Math.min(1.5, orbit.phi - (y - ly) * 0.004));
      lx = x; ly = y;
    };
    const up = () => { dragging = false; el.style.cursor = "grab"; };

    el.addEventListener("mousedown", (e) => down(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => move(e.clientX, e.clientY));
    window.addEventListener("mouseup", up);
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      orbit.r = Math.max(12, Math.min(110, orbit.r + e.deltaY * 0.05));
      orbit.goal = null;
    }, { passive: false });
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) {
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    el.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
      else if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        orbit.r = Math.max(12, Math.min(110, orbit.r + (pinchDist - d) * 0.15));
        pinchDist = d;
        orbit.goal = null;
      }
    }, { passive: false });
    el.addEventListener("touchend", up);

    /* ---------- animate ---------- */
    let raf;
    const clock = new THREE.Clock();
    function animate() {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (autoRef.current && !dragging && !orbit.goal) orbit.theta += 0.0018;
      // ease toward preset view if one is queued
      if (orbit.goal) {
        const g = orbit.goal;
        orbit.theta += (g.theta - orbit.theta) * 0.06;
        orbit.phi += (g.phi - orbit.phi) * 0.06;
        orbit.r += (g.r - orbit.r) * 0.06;
        if (
          Math.abs(g.theta - orbit.theta) < 0.005 &&
          Math.abs(g.phi - orbit.phi) < 0.005 &&
          Math.abs(g.r - orbit.r) < 0.2
        ) orbit.goal = null;
      }
      // subtle LED breathing + beam sway
      ledMat.color.setHSL(0.56, 0.5, 0.82 + Math.sin(t * 2) * 0.08);
      beams.forEach((b, i) => {
        b.rotation.z = Math.sin(t * 0.4 + i) * 0.05;
        b.material.opacity = 0.05 + Math.sin(t * 1.3 + i * 1.7) * 0.02;
      });
      applyCamera();
      renderer.render(scene, camera);
    }
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mouseup", up);
      renderer.dispose();
      mount.removeChild(el);
    };
  }, []);

  const goView = (name) => {
    setActiveView(name);
    const o = stateRef.current.orbit;
    if (o) o.goal = { ...VIEWS[name] };
  };

  const btn = (active) => ({
    padding: "7px 14px",
    borderRadius: 20,
    border: active ? "1px solid #5b9dff" : "1px solid rgba(120,150,200,0.35)",
    background: active ? "rgba(50,110,255,0.25)" : "rgba(10,16,30,0.7)",
    color: active ? "#cfe3ff" : "#8fa5c8",
    fontSize: 12,
    letterSpacing: "0.06em",
    cursor: "pointer",
    backdropFilter: "blur(6px)",
    fontFamily: "Arial, sans-serif",
  });

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#04060c", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* header */}
      <div style={{ position: "absolute", top: 18, left: 20, color: "#e8f0ff", fontFamily: "Arial, sans-serif", pointerEvents: "none" }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.05em" }}>CROSS RUNWAY STAGE</div>
        <div style={{ fontSize: 12, color: "#5b9dff", fontWeight: 700, letterSpacing: "0.12em", marginTop: 2 }}>
          CODE DXB · 3D CONCEPT
        </div>
        <div style={{ fontSize: 11, color: "#7288ab", marginTop: 6 }}>
          Footprint 60m (W) × 22m (D) · Central stage Ø10–12m · Runways 4–5m wide
        </div>
      </div>

      {/* view controls */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button style={btn(activeView === "hero")} onClick={() => goView("hero")}>HERO</button>
        <button style={btn(activeView === "top")} onClick={() => goView("top")}>TOP VIEW</button>
        <button style={btn(activeView === "speaker")} onClick={() => goView("speaker")}>SPEAKER</button>
        <button style={btn(activeView === "corner")} onClick={() => goView("corner")}>CORNER</button>
        <button style={btn(autoRotate)} onClick={() => setAutoRotate((v) => !v)}>
          {autoRotate ? "⏸ ROTATE" : "▶ ROTATE"}
        </button>
      </div>

      {/* hint */}
      <div style={{ position: "absolute", bottom: 64, left: "50%", transform: "translateX(-50%)", color: "#4f6488", fontSize: 11, fontFamily: "Arial, sans-serif", pointerEvents: "none" }}>
        drag to orbit · scroll / pinch to zoom
      </div>
    </div>
  );
}
