import React from 'react'

/**
 * AstronautLoop v4 — Chibi Astronaut (Three.js)
 *
 * IDLE:    flota suave, ojos parpadeando, galaxia en visor
 * ACTIVE:  levita más alto, visor HUD con anillos de agentes,
 *          partículas aceleran, energía visible
 */
function AstronautLoop({ active, nodeStatus, briefLength = 0 }) {
  const mountRef = React.useRef(null);
  const ssRef    = React.useRef(null);
  const stRef    = React.useRef({
    energy: 0, targetEnergy: 0,
    lookX: 0,  lookY: 0,
    flash: 0,  shake: 0,
    blinkT: 0, waveT: 0,
    ringW: [0,0,0,0,0],
    errorR: 0,
  });

  React.useEffect(() => {
    if (!mountRef.current || typeof THREE === 'undefined') return;
    const mount = mountRef.current;
    const W = mount.clientWidth  || 380;
    const H = mount.clientHeight || 440;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 80);
    camera.position.set(0, 0.6, 9);
    camera.lookAt(0, 0.3, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 6, 5);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc4b5fd, 0.45);
    fill.position.set(-4, 2, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xa78bfa, 0.6);
    rim.position.set(0, 1, -5);
    scene.add(rim);

    const suitMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f5, metalness: 0.15, roughness: 0.35 });
    const ledMat  = new THREE.MeshBasicMaterial({ color: 0xc4b5fd });

    const root = new THREE.Group();
    scene.add(root);

    const bodyGeo = new THREE.SphereGeometry(1.0, 32, 32);
    bodyGeo.scale(1, 1.15, 0.85);
    const body = new THREE.Mesh(bodyGeo, suitMat);
    body.position.set(0, -0.1, 0);
    root.add(body);

    const badgeGeo = new THREE.BoxGeometry(0.52, 0.52, 0.08);
    badgeGeo.translate(0, 0, 0.04);
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0x1a0a30, roughness: 0.4, metalness: 0.3 });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0, -0.05, 0.84);
    root.add(badge);

    const iconGeo = new THREE.PlaneGeometry(0.28, 0.28);
    const iconMat = new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.9 });
    const icon = new THREE.Mesh(iconGeo, iconMat);
    icon.position.set(0, -0.05, 0.90);
    root.add(icon);

    const ledGeom = new THREE.BoxGeometry(0.06, 0.55, 0.06);
    [-0.6, 0.6].forEach(xOff => {
      const led = new THREE.Mesh(ledGeom, ledMat);
      led.position.set(xOff, -0.1, 0.82);
      root.add(led);
    });

    const hLed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.06), ledMat);
    hLed.position.set(0, 0.18, 0.81);
    root.add(hLed);

    const legGeo = new THREE.CapsuleGeometry(0.32, 0.55, 12, 16);
    [-0.42, 0.42].forEach((x) => {
      const leg = new THREE.Mesh(legGeo, suitMat);
      leg.position.set(x, -1.42, 0);
      root.add(leg);
      const boot = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 20, 14),
        new THREE.MeshStandardMaterial({ color: 0xd8d8e8, roughness: 0.5, metalness: 0.1 })
      );
      boot.scale.set(1, 0.7, 1.2);
      boot.position.set(x, -1.78, 0.06);
      root.add(boot);
    });

    const armGeo = new THREE.CapsuleGeometry(0.24, 0.6, 12, 16);

    const armL = new THREE.Mesh(armGeo, suitMat);
    armL.position.set(-1.22, -0.26, 0);
    armL.rotation.z = 0.22;
    root.add(armL);

    const gloveL = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8d8e8, roughness: 0.5 })
    );
    gloveL.position.set(-1.38, -0.76, 0.05);
    root.add(gloveL);

    const armRGroup = new THREE.Group();
    armRGroup.position.set(1.1, 0.15, 0);
    root.add(armRGroup);

    const armR = new THREE.Mesh(armGeo, suitMat);
    armR.rotation.z = -0.8;
    armRGroup.add(armR);

    const gloveR = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8d8e8, roughness: 0.5 })
    );
    gloveR.position.set(0.42, 0.55, 0.08);
    armRGroup.add(gloveR);

    [-0.1, 0, 0.1].forEach((xf, fi) => {
      const fg = new THREE.CapsuleGeometry(0.055, 0.18, 6, 8);
      const fm = new THREE.Mesh(fg, suitMat);
      fm.position.set(gloveR.position.x + xf, gloveR.position.y + 0.28, gloveR.position.z);
      fm.rotation.z = (fi - 1) * 0.18;
      armRGroup.add(fm);
    });

    [-1.02, 1.02].forEach(x => {
      const sc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.22, 20),
        new THREE.MeshStandardMaterial({ color: 0xe0e0ee, roughness: 0.4 })
      );
      sc.rotation.z = Math.PI / 2;
      sc.position.set(x, 0.28, 0);
      root.add(sc);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), ledMat);
      dot.position.set(x, 0.28, 0.2);
      root.add(dot);
    });

    const helmGroup = new THREE.Group();
    helmGroup.position.set(0, 1.15, 0);
    root.add(helmGroup);

    const helmGeo = new THREE.SphereGeometry(1.02, 48, 48);
    const helmMesh = new THREE.Mesh(helmGeo, suitMat);
    helmGroup.add(helmMesh);

    const rimRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.04, 0.04, 12, 80),
      ledMat
    );
    rimRing.position.set(0, 0, 0);
    helmGroup.add(rimRing);

    [-1.0, 1.0].forEach(x => {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.18, 16),
        new THREE.MeshStandardMaterial({ color: 0xd0d0e0, roughness: 0.4 })
      );
      knob.rotation.z = Math.PI / 2;
      knob.position.set(x * 0.92, -0.05, 0.25);
      helmGroup.add(knob);
    });

    const visorGroup = new THREE.Group();
    visorGroup.position.set(0, 0.06, 0);
    helmGroup.add(visorGroup);

    const visorGeo = new THREE.SphereGeometry(0.82, 48, 48,
      -Math.PI * 0.55, Math.PI * 1.1,
       Math.PI * 0.22, Math.PI * 0.58
    );

    const visorUniforms = {
      uTime:   { value: 0 },
      uEnergy: { value: 0 },
      uFlash:  { value: 0 },
      uErrorR: { value: 0 },
      uBlink:  { value: 0 },
      uRA: { value: 0 }, uRB: { value: 0 }, uRC: { value: 0 },
      uRD: { value: 0 }, uRE: { value: 0 },
    };

    const visorMat = new THREE.ShaderMaterial({
      uniforms: visorUniforms,
      transparent: true,
      side: THREE.FrontSide,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main(){
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying vec3 vNormal;
        uniform float uTime, uEnergy, uFlash, uErrorR, uBlink;
        uniform float uRA, uRB, uRC, uRD, uRE;

        float hash(vec2 p){ p=fract(p*vec2(127.1,311.7)); p+=dot(p,p+45.3); return fract(p.x*p.y); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p);
          float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
          vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
        }
        float pillEye(vec2 uv, vec2 center, vec2 size){
          vec2 d=(uv-center)/size;
          return 1.0-smoothstep(0.0,1.0,length(d));
        }
        void main(){
          vec2 uv=vUv;
          vec2 c=uv-vec2(0.5);
          float n1=noise(uv*5.0+uTime*0.05);
          float n2=noise(uv*12.0-uTime*0.03);
          float galaxy=n1*0.65+n2*0.35;
          vec3 spaceCol=mix(vec3(0.03,0.01,0.08), vec3(0.35,0.12,0.55), galaxy*0.8);
          float nebula=noise(uv*3.0+vec2(uTime*0.04,-uTime*0.02));
          spaceCol=mix(spaceCol, vec3(0.55,0.12,0.78), nebula*0.65*smoothstep(0.3,0.7,1.0-length(c)*1.6));
          float stars=step(0.982, hash(floor(uv*120.0)));
          stars*=(sin(uTime*4.0+hash(floor(uv*80.0))*12.0)*0.5+0.5);
          spaceCol+=vec3(stars*0.9,stars*0.85,stars);
          float rweights[5]; rweights[0]=uRA; rweights[1]=uRB; rweights[2]=uRC; rweights[3]=uRD; rweights[4]=uRE;
          vec3 rcolors[5];
          rcolors[0]=vec3(0.67,0.55,0.98); rcolors[1]=vec3(0.38,0.65,0.98);
          rcolors[2]=vec3(0.77,0.71,0.98); rcolors[3]=vec3(0.96,0.62,0.04); rcolors[4]=vec3(0.20,0.83,0.60);
          float radii[5]; radii[0]=0.38; radii[1]=0.30; radii[2]=0.22; radii[3]=0.15; radii[4]=0.08;
          vec3 hudCol=vec3(0.0);
          for(int i=0;i<5;i++){
            float d=abs(length(c)-radii[i]);
            float r=smoothstep(0.012,0.0,d)*(0.4+0.6*rweights[i]);
            r*=sin(length(c)*80.0-uTime*(2.5+float(i)*0.5))*0.5+0.5;
            hudCol+=rcolors[i]*r;
          }
          float ch=(step(abs(c.x),0.004)+step(abs(c.y),0.004))*smoothstep(0.2,0.0,length(c))*0.5;
          hudCol+=vec3(ch);
          vec3 visorCol=mix(spaceCol, hudCol*1.6, uEnergy);
          float eyeL=pillEye(uv, vec2(0.34,0.58), vec2(0.095,0.15));
          float eyeR=pillEye(uv, vec2(0.66,0.58), vec2(0.095,0.15));
          float eyes=(eyeL+eyeR);
          float blinkScale=1.0-uBlink*0.92;
          float eyeLb=pillEye(uv, vec2(0.34,0.58), vec2(0.095, 0.15*blinkScale));
          float eyeRb=pillEye(uv, vec2(0.66,0.58), vec2(0.095, 0.15*blinkScale));
          float eyesMasked=(eyeLb+eyeRb);
          visorCol=mix(visorCol, vec3(1.0), eyesMasked*0.9);
          visorCol+=vec3(0.6,0.5,0.95)*eyes*0.15;
          float fres=pow(1.0-dot(vNormal,vec3(0,0,1)),2.5);
          visorCol+=vec3(0.3,0.25,0.6)*fres*0.25;
          visorCol=mix(visorCol,vec3(1.0),uFlash);
          visorCol=mix(visorCol,vec3(0.9,0.15,0.2),uErrorR);
          float scan=step(0.995,fract(uv.y*60.0+uTime*0.4))*0.3*uEnergy;
          visorCol+=vec3(0.25,0.7,0.85)*scan;
          float alpha=smoothstep(0.52,0.44,length(c));
          gl_FragColor=vec4(visorCol, alpha*0.97);
        }
      `,
    });

    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorGroup.add(visorMesh);

    const vbRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.83, 0.035, 12, 80),
      new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0xa78bfa, emissiveIntensity: 0.6 })
    );
    vbRing.rotation.x = Math.PI / 2;
    vbRing.position.set(0, 0.08, 0.82);
    helmGroup.add(vbRing);

    const PCNT = 120;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PCNT * 3);
    const pSeeds = new Float32Array(PCNT);
    for (let i = 0; i < PCNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.0 + Math.random() * 2.2;
      const y = (Math.random() - 0.5) * 3.5;
      pPos[i*3]   = Math.cos(a) * r;
      pPos[i*3+1] = y;
      pPos[i*3+2] = Math.sin(a) * r;
      pSeeds[i] = Math.random();
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('seed',     new THREE.BufferAttribute(pSeeds, 1));

    const pMat = new THREE.ShaderMaterial({
      uniforms: { uTime: {value:0}, uEnergy: {value:0} },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader:`
        attribute float seed;
        uniform float uTime, uEnergy;
        varying float vSeed;
        void main(){
          vSeed=seed;
          vec3 p=position;
          float sp=mix(0.1,0.45,uEnergy);
          float a=uTime*sp*(0.5+seed*0.8);
          float cx=p.x*cos(a)-p.z*sin(a);
          float cz=p.x*sin(a)+p.z*cos(a);
          p.x=cx; p.z=cz;
          p.y+=sin(uTime*1.1+seed*6.28)*0.18;
          vec4 mv=modelViewMatrix*vec4(p,1.0);
          gl_PointSize=(3.5+seed*4.0)*mix(1.0,2.0,uEnergy)*(50.0/-mv.z);
          gl_Position=projectionMatrix*mv;
        }
      `,
      fragmentShader:`
        precision highp float;
        varying float vSeed;
        uniform float uTime, uEnergy;
        void main(){
          vec2 c=gl_PointCoord-0.5;
          float d=length(c);
          if(d>0.5) discard;
          float a=smoothstep(0.5,0.0,d)*(0.4+0.6*sin(uTime*2.0+vSeed*12.0)*0.5+0.5);
          vec3 col=mix(vec3(0.55,0.42,0.95), vec3(0.25,0.85,0.65), vSeed);
          col=mix(col, mix(vec3(0.2,0.9,0.6),vec3(0.78,0.56,0.98),vSeed), uEnergy*0.7);
          gl_FragColor=vec4(col, a*(0.5+0.5*uEnergy));
        }
      `,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    ssRef.current = {
      scene, camera, renderer, root, armRGroup, helmGroup, visorUniforms,
      pMat, vbRing, rimRing, ledMat, key, fill, rim,
    };

    let raf = 0;
    const clock = new THREE.Clock();
    const lerp = (a, b, k) => a + (b - a) * k;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const st = stRef.current;
      const ss = ssRef.current;
      if (!ss) return;

      st.energy  = lerp(st.energy,  st.targetEnergy, 0.04);
      st.lookX   = lerp(st.lookX,   st.targetLookX || 0, 0.06);
      st.lookY   = lerp(st.lookY,   st.targetLookY || 0, 0.06);
      st.flash   = Math.max(0, st.flash - 0.02);
      st.shake   = Math.max(0, st.shake - 0.04);
      st.waveT   += 0.012;

      const floatY = Math.sin(t * 0.75) * 0.12;
      const energyLift = st.energy * 0.22;
      ss.root.position.y = floatY + energyLift;

      ss.root.rotation.y = st.lookX * 0.35;
      ss.root.rotation.x = -st.lookY * 0.22 + Math.sin(t * 0.6) * 0.012;
      ss.root.rotation.z = st.shake * Math.sin(t * 38) * 0.1;

      ss.armRGroup.rotation.z = -0.4 + Math.sin(ss.waveT * 2.8) * (0.22 + st.energy * 0.3);
      ss.armRGroup.rotation.x = Math.sin(ss.waveT * 1.4) * 0.08;

      ss.helmGroup.rotation.y = Math.sin(t * 0.5 + 1.3) * 0.04 + st.lookX * 0.12;
      ss.helmGroup.rotation.x = Math.sin(t * 0.7) * 0.025;

      st.blinkT += 0.016;
      const blinkCycle = 3.8;
      const blinkPhase = st.blinkT % blinkCycle;
      const blink = blinkPhase < 0.18 ? Math.sin((blinkPhase / 0.18) * Math.PI) : 0;
      ss.visorUniforms.uBlink.value = blink;

      ss.visorUniforms.uTime.value   = t;
      ss.visorUniforms.uEnergy.value = st.energy;
      ss.visorUniforms.uFlash.value  = st.flash;
      ss.visorUniforms.uErrorR.value = st.errorR || 0;

      const order = ['uRA','uRB','uRC','uRD','uRE'];
      order.forEach((k,i) => {
        ss.visorUniforms[k].value = lerp(ss.visorUniforms[k].value, st.ringW[i] || 0, 0.06);
      });

      ss.pMat.uniforms.uTime.value   = t;
      ss.pMat.uniforms.uEnergy.value = st.energy;

      ss.ledMat.color.setHSL(0.76 - st.energy * 0.05, 0.85, 0.55 + Math.sin(t * 2.0) * 0.08);
      ss.rimRing.material.color.setHSL(0.76, 0.9, 0.5 + st.energy * 0.25 + Math.sin(t * (st.energy > 0.5 ? 5 : 1.5)) * 0.1);

      ss.renderer.render(ss.scene, ss.camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const ss2 = ssRef.current;
      if (!ss2) return;
      const w = mount.clientWidth || 380;
      const h = mount.clientHeight || 440;
      ss2.camera.aspect = w / h;
      ss2.camera.updateProjectionMatrix();
      ss2.renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  React.useEffect(() => {
    stRef.current.targetEnergy = active ? 1 : 0;
  }, [active]);

  React.useEffect(() => {
    const st = stRef.current;
    if (!nodeStatus) return;
    const agents = ['master_director','scriptwriter','cinematographer','production','critic'];
    const prev = [...st.ringW];
    agents.forEach((k,i) => {
      const s = nodeStatus[k] || 'idle';
      st.ringW[i] = s === 'done' ? 1.0 : s === 'running' ? 0.7 : 0.0;
      if (prev[i] < 1 && st.ringW[i] === 1) st.flash = Math.max(st.flash, 0.45);
    });
    if (prev[4] < 1 && st.ringW[4] >= 1) st.flash = 1.0;
    if (agents.some(k => nodeStatus[k] === 'error') && !agents.some(k => (nodeStatus[k]||'') === 'error' === (prev[agents.indexOf(k)] > 0.5))) {
      st.shake = 1.0;
      st.errorR = 0.7;
    } else {
      st.errorR = Math.max(0, (st.errorR||0) - 0.02);
    }
  }, [nodeStatus]);

  React.useEffect(() => {
    const onMove = (e) => {
      const st = stRef.current;
      if (!mountRef.current) return;
      const r = mountRef.current.getBoundingClientRect();
      st.targetLookX = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width/2) / (r.width/2)));
      st.targetLookY = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height/2) / (r.height/2)));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  React.useEffect(() => {
    const st = stRef.current;
    if (briefLength > 0 && !active) st.targetLookY = Math.min(0.45, briefLength * 0.005);
  }, [briefLength, active]);

  return (
    <div className={'astro-stage' + (active ? ' is-active' : '')}>
      <div className="astro-stars-field" />
      <div className="astro-corona" />
      <div ref={mountRef} className="astro-three-mount" />
    </div>
  );
}

export { AstronautLoop }
