import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-computer',
  templateUrl: './computer.component.html',
  styleUrls: ['./computer.component.scss']
})
export class ComputerComponent implements OnInit, AfterViewInit {
  @ViewChild('threeCanvas', { static: true }) threeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('hoverButton') hoverButton!: ElementRef<HTMLDivElement>;

  // Componenti principali Three.js
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private model!: THREE.Group;
  private raycaster!: THREE.Raycaster;
  private mouse!: THREE.Vector2;

  // Cache per oggetti animati (ottimizzazione performance)
  private cachedLampObjects: Array<{ mesh: THREE.Mesh, spotLight: THREE.SpotLight, glowMesh?: THREE.Mesh, helper?: any }> = [];

  // Throttling per raycasting
  private lastMouseMoveTime = 0;
  private mouseMoveThrottleMs = 16; // ~60fps
  private pendingMouseMove: MouseEvent | null = null;

  // Flag di stato
  private isAnimationActive = false;
  private isZoomedIn = false;
  public zoomEnabled = false;
  public isDarkMode = false;
  public isTastoMiceModalVisible = false;
  public isResearchModalVisible = false;
  public isRobotDogModalVisible = false;

  // Stato della camera per la funzionalità di zoom
  private originalCameraPosition = new THREE.Vector3();
  private originalControlsTarget = new THREE.Vector3();

  // Riferimenti a specifici oggetti mesh
  private screenGrandeMesh: THREE.Mesh | null = null;
  private tastoMiceMeshes: THREE.Mesh[] = [];
  private interactiveObjects: THREE.Object3D[] = [];

  // Riferimenti all'illuminazione
  private ambientLight!: THREE.AmbientLight;
  private mainLight!: THREE.DirectionalLight;
  private fillLight!: THREE.PointLight;
  private screenLights: THREE.PointLight[] = [];

  // Stato dell'interazione
  private intersectedObject: THREE.Object3D | null = null;
  private originalEnvMap: THREE.Texture | null = null;
  private isButtonVisible = false;

  constructor() {
    gsap.registerPlugin(ScrollTrigger);
  }

  ngOnInit() {
    this.initScene();
    this.loadModel();
    this.animate();
  }

  ngAfterViewInit() {
    // Ritarda la configurazione dell'animazione scroll per assicurare che il DOM sia pronto
    setTimeout(() => {
      this.setupScrollAnimation();
      this.threeCanvas.nativeElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    }, 1000);
  }

  @HostListener('click', ['$event'])
  onCanvasClick(event: MouseEvent) {
    const canvas = this.threeCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const isMouseOverCanvas =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (isMouseOverCanvas && this.model) {
      this.handleClick(event);
    }
  }

  /**
   * Inizializza la scena Three.js, la camera, il renderer e le luci.
   */
  private initScene(): void {
    const canvas = this.threeCanvas.nativeElement;
    canvas.style.pointerEvents = 'none'; // Disabilita gli eventi puntatore inizialmente

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x113250); // Colore di sfondo iniziale

    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 1.5, 4.3);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });

    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    // Pixel ratio ottimizzato per bilanciare qualità e performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    (this.renderer as any).physicallyCorrectLights = true;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Configurazione OrbitControls con damping per movimento fluido
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = this.zoomEnabled;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;

    // Damping per movimento fluido e naturale
    this.controls.enableDamping = false;
    this.controls.dampingFactor = 0.05; // Smorzamento ottimale
    this.controls.rotateSpeed = 0.6; // Velocità bilanciata
    this.controls.panSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;

    // Limiti per evitare movimenti estremi
    this.controls.minDistance = 2;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI * 0.9;

    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.originalCameraPosition.copy(this.camera.position);
    this.originalControlsTarget.copy(this.controls.target);

    this.setupAdvancedLighting();
    console.log('Illuminazione avanzata configurata.');

    // Carica mappa ambiente HDR
    this.loadHDREnvironment();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Configura l'illuminazione della scena incluse luci ambientali, emisferiche e direzionali.
   */
  private setupAdvancedLighting(): void {
    // Luce Ambientale
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(this.ambientLight);

    // Luce Emisferica
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.18);
    hemi.position.set(0, 10, 0);
    this.scene.add(hemi);

    // Luce di Riempimento (PointLight)
    const fill = new THREE.PointLight(0xffffff, 0.6, 30);
    fill.position.set(0, 3.5, 2);
    fill.castShadow = true;
    if (fill.shadow) {
      fill.shadow.mapSize.width = 512;
      fill.shadow.mapSize.height = 512;
      fill.shadow.radius = 4;
      fill.shadow.bias = -0.0005;
    }
    this.scene.add(fill);
    this.fillLight = fill;

    // RectAreaLight (Luce area morbida)
    try {
      const rect = new (THREE as any).RectAreaLight(0xffffff, 3, 2, 2.2);
      rect.position.set(0, 4.5, 3);
      rect.lookAt(0, 0, 0);
      this.scene.add(rect);
    } catch (e) {
      // RectAreaLight potrebbe non essere disponibile in tutti gli ambienti
    }

    // Luce Direzionale Principale (Simile al sole)
    try {
      const dir = new THREE.DirectionalLight(0xffffff, 0.5);
      dir.position.set(5, 10, 7);
      dir.target.position.set(0, 0, 0);
      dir.castShadow = true;
      const d = 10;
      if (dir.shadow && (dir.shadow as any).camera) {
        const cam: any = dir.shadow.camera;
        cam.left = -d;
        cam.right = d;
        cam.top = d;
        cam.bottom = -d;
        cam.near = 0.5;
        cam.far = 50;
      }
      if (dir.shadow) {
        dir.shadow.mapSize.width = 1024;
        dir.shadow.mapSize.height = 1024;
        dir.shadow.bias = -0.0006;
      }
      this.scene.add(dir);
      this.scene.add(dir.target);
      this.mainLight = dir;
    } catch (e) {
      // Ignora se DirectionalLight fallisce
    }

    // Nebbia e colore di pulizia
    this.scene.fog = new THREE.Fog(0x0b0b0b, 8, 40);
    this.renderer.setClearColor(0x0b0b0b);

    // Configurazione codifica colore
    const _threeAny = THREE as any;
    const _rendererSRGB = _threeAny['sRGBEncoding'] ?? _threeAny['SRGBEncoding'] ?? _threeAny['sRGBColorSpace'] ?? _threeAny['SRGBColorSpace'] ?? _threeAny['LinearSRGBColorSpace'];
    if (_rendererSRGB !== undefined) {
      (this.renderer as any).outputEncoding = _rendererSRGB;
    }
  }

  /**
   * Carica la mappa ambiente HDR.
   */
  private loadHDREnvironment(): void {
    try {
      const hdrLoader = new HDRLoader();
      hdrLoader.load(
        'assets/wooden_lounge_4k.hdr',
        (texture: any) => {
          try {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = texture;
            this.originalEnvMap = texture;

            if (this.model) {
              this.model.traverse((child: any) => {
                if (child.isMesh && child.material) {
                  if ('envMap' in child.material) {
                    child.material.envMap = texture;
                    if ('envMapIntensity' in child.material) {
                      child.material.envMapIntensity = 0.5;
                    }
                    child.material.needsUpdate = true;
                  }
                }
              });
            }
            console.log('Ambiente HDR caricato e applicato.');
          } catch (e) {
            console.warn("Errore applicazione HDR:", e);
          }
        },
        undefined,
        (err: any) => {
          console.warn('Errore caricamento ambiente HDR:', err);
        }
      );
    } catch (e) {
      console.warn('HDRLoader non disponibile o errore:', e);
    }
  }

  /**
   * Aggiunge uno spotlight alla mesh della lampadina.
   */
  private addLightToLampadina(): void {
    if (!this.model) return;

    this.model.traverse((child: any) => {
      if (child.isMesh && child.material?.name === 'lampadina') {
        if (child.userData && child.userData._lampSpotLight) return;

        const anchor = new THREE.Object3D();
        child.add(anchor);
        anchor.position.set(0, 0, 0.5);

        const spotLight = new THREE.SpotLight(0xFFF4E6, 0, 17, Math.PI / 3.5, 0.7, 0.9);
        const anchorPos = new THREE.Vector3();
        anchor.getWorldPosition(anchorPos);
        spotLight.position.copy(anchorPos);
        spotLight.castShadow = true;

        if (spotLight.shadow) {
          spotLight.shadow.bias = -0.0001;
          spotLight.shadow.normalBias = 0.1;
          spotLight.shadow.mapSize.width = 1024;
          spotLight.shadow.mapSize.height = 1024;
        }

        spotLight.target.position.set(anchorPos.x - 50, anchorPos.y - 20, anchorPos.z);
        this.scene.add(spotLight);
        this.scene.add(spotLight.target);

        const helper = new THREE.SpotLightHelper(spotLight);

        // Effetto bagliore
        child.material.emissive = new THREE.Color(0xFFE100);
        child.material.emissiveIntensity = 0;
        child.material.needsUpdate = true;

        const glowMaterial = new THREE.MeshBasicMaterial({
          color: 0xFFE100,
          transparent: true,
          opacity: 0.5
        });
        const glowGeometry = new THREE.SphereGeometry(0.2, 32, 32);
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.copy(anchorPos);

        child.userData._lampSpotLight = spotLight;
        child.userData._lampGlowMesh = glowMesh;
        child.userData._lampHelper = helper;

        // Aggiungi alla cache per ottimizzazione rendering
        this.cachedLampObjects.push({
          mesh: child,
          spotLight: spotLight,
          glowMesh: glowMesh,
          helper: helper
        });

        glowMaterial.opacity = 0.0;
      }
    });
  }

  /**
   * Carica il modello GLTF.
   */
  private loadModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      'assets/pc3d_2.glb',
      (gltf: any) => {
        this.model = gltf.scene;
        this.model.position.set(0.2, -1.5, -3);
        this.model.scale.set(0.8, 0.8, 0.8);
        this.scene.add(this.model);

        this.configureModelShadows();
        try { this.applyPBRMaterialsToModel(); } catch (e) { console.warn('Errore applyPBRMaterialsToModel:', e); }
        try { this.addLightToLampadina(); } catch (e) { console.warn('Errore addLightToLampadina:', e); }

        this.tastoMiceMeshes = [];
        this.interactiveObjects = []; // Reset interactive objects
        this.model.traverse((child: any) => {
          if (child.isMesh && child.material?.name === 'tastoMice') {
            this.tastoMiceMeshes.push(child as THREE.Mesh);
            child.userData.isTastoMice = true;
            this.interactiveObjects.push(child);
          }
        });

        const video = this.createVideoElement();
        this.startVideo(video);

        const applyVideoMaterial = () => {
          const screenMaterial = this.createScreenMaterial(video);
          this.replaceScreenMaterials(screenMaterial);
        };

        if (video.readyState >= 2) {
          applyVideoMaterial();
        } else {
          video.addEventListener('loadeddata', applyVideoMaterial, { once: true });
        }

        setTimeout(() => {
          this.threeCanvas.nativeElement.style.pointerEvents = 'auto';
        }, 500);

        console.log('Modello pronto per animazione');
        this.animateAssembly();
        this.animateSmoke();
        this.animateMouse();
        this.addMaterialToTazza();
      },
      undefined,
      (error: any) => {
        console.error('Errore caricamento modello:', error);
      }
    );
  }

  /**
   * Configura la proiezione e ricezione delle ombre per le mesh del modello.
   */
  private configureModelShadows(): void {
    this.model.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;

        const matName = child.material?.name || '';

        if (matName.toLowerCase().includes('tavolo')) {
          child.receiveShadow = true;
          child.castShadow = false;
          if (child.material) {
            child.material.shadowSide = THREE.BackSide;
            child.material.needsUpdate = true;
          }
          return;
        }

        if (matName.includes('tappetino') || matName.includes('tappeto')) {
          child.material.roughness = 0.9;
          child.material.metalness = 0.0;
        }

        const transparentNames = ['fumo', 'schermo', 'glass', 'screen', 'video'];
        const isTransparentName = transparentNames.some(n => matName.toLowerCase().includes(n));
        const isMaterialTransparent = child.material && (child.material.transparent === true || (child.material.opacity && child.material.opacity < 0.99));

        if (!isTransparentName && !isMaterialTransparent) {
          child.castShadow = true;
        }
      }
    });
  }

  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.src = 'assets/video.mp4';
    video.loop = true;
    video.muted = true;
    video.setAttribute('playsinline', '');
    return video;
  }

  /**
   * Applica materiali PBR al modello basandosi sui nomi dei materiali.
   */
  private applyPBRMaterialsToModel(): void {
    if (!this.model) return;

    const materialRules: { test: RegExp | string[]; props: Partial<THREE.MeshPhysicalMaterialParameters> }[] = [
      { test: /metal|chrome|acciaio/, props: { metalness: 0.95, roughness: 0.18, clearcoat: 0.1, reflectivity: 0.9 } },
      { test: /glass|vetro/, props: { metalness: 0, roughness: 0.02, transmission: 0.9, opacity: 0.98, transparent: true, clearcoat: 0.2 } },
      { test: /screen|schermo|monitor/, props: { metalness: 0, roughness: 0.15, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1 } },
      { test: /plastic|plastica|mouse|keyboard/, props: { metalness: 0.03, roughness: 0.45, clearcoat: 0.05 } },
      {
        test: /tazza/,
        props: {
          metalness: 0, roughness: 0, transmission: 1, thickness: 5, ior: 2, opacity: 1, transparent: true, side: THREE.FrontSide, clearcoat: 1.0, clearcoatRoughness: 0, attenuationColor: new THREE.Color(0xffffff), attenuationDistance: 10, depthWrite: false, envMapIntensity: 2.0
        }
      },
      { test: /ceramica|caffe/, props: { metalness: 0, roughness: 0.12, clearcoat: 0.7, clearcoatRoughness: 0.06 } },
      { test: /wood|tavolo|legno/, props: { metalness: 0, roughness: 0.6, reflectivity: 0.3 } },
      { test: ['cuffie', 'cuffie3'], props: { metalness: 0.35, roughness: 0.38, clearcoat: 0.1, reflectivity: 0.2 } },
      { test: ['cuffie2'], props: { metalness: 0, roughness: 0.9, clearcoat: 0, reflectivity: 0, emissiveIntensity: 0 } },
      { test: /blu/, props: { metalness: 0.65, roughness: 0.48, clearcoat: 0.9, reflectivity: 0.2 } },
      { test: /mouse/, props: { metalness: 0.03, roughness: 0.95, clearcoat: 0 } },
      { test: /portaPenne/, props: { metalness: 0.83, roughness: 0.65, } },
      { test: /tappetino|tappeto/, props: { metalness: 0, roughness: 0.9, clearcoat: 0 } },
    ];

    this.model.traverse((child: any) => {
      if (!child.isMesh || !child.material) return;

      const origName = child.material.name || '';
      const name = origName.toLowerCase();
      const baseMap = child.material.map || null;

      const phys = new THREE.MeshPhysicalMaterial({
        map: baseMap,
        metalness: 0.0,
        roughness: 0.6,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        reflectivity: 0.5,
        transmission: 0,
        transparent: child.material.transparent || false,
        opacity: child.material.opacity !== undefined ? child.material.opacity : 1,
        side: child.material.side || THREE.FrontSide,
        dithering: true
      });

      const oldMat = child.material as any;
      if (oldMat) {
        phys.color = oldMat.color?.clone?.() ?? phys.color;
        phys.emissive = oldMat.emissive?.clone?.() ?? phys.emissive;
        phys.emissiveIntensity = oldMat.emissiveIntensity ?? phys.emissiveIntensity;
        phys.map = oldMat.map ?? phys.map;
        phys.normalMap = oldMat.normalMap ?? phys.normalMap;
        phys.roughnessMap = oldMat.roughnessMap ?? phys.roughnessMap;
        phys.metalnessMap = oldMat.metalnessMap ?? phys.metalnessMap;
        phys.aoMap = oldMat.aoMap ?? phys.aoMap;
        phys.alphaTest = oldMat.alphaTest ?? phys.alphaTest;
        phys.vertexColors = oldMat.vertexColors ?? phys.vertexColors;
      }

      phys.name = origName;

      for (const rule of materialRules) {
        const match = Array.isArray(rule.test) ? rule.test.includes(name) : rule.test.test(name);
        if (match) {
          Object.assign(phys, rule.props);
          break;
        }
      }

      if (child.material.map) {
        phys.map = child.material.map;
        const _threeAny = THREE as any;
        const _sRGBConst = _threeAny['SRGBColorSpace'] ?? _threeAny['sRGBEncoding'];
        if (phys.map && 'encoding' in phys.map && _sRGBConst !== undefined) {
          (phys.map as any).encoding = _sRGBConst;
        }
      }

      try { child.material.dispose?.(); } catch { }

      const sceneEnv = (this.scene as any).environment;
      if (sceneEnv) {
        (phys as any).envMap = sceneEnv;
        (phys as any).envMapIntensity = 0.5;
      }

      child.material = phys;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }

  /**
   * Anima l'assemblaggio del modello computer.
   */
  private animateAssembly(): void {
    if (!this.model) return;

    if (this.controls) this.controls.enabled = false;

    const tl = gsap.timeline({
      onStart: () => { this.isAnimationActive = true; },
      onComplete: () => {
        if (this.controls) this.controls.enabled = true;
        this.isAnimationActive = false;
      }
    });

    const transparentMaterials = ['fumo', 'tazza', 'caffe'];
    const tableMeshes: THREE.Object3D[] = [];
    const otherMeshes: THREE.Object3D[] = [];
    let tazzaMesh: any = null;
    let caffeMesh: any = null;

    this.model.traverse((child: any) => {
      if (child.isMesh) {
        child.userData.originalPos = child.position.clone();
        child.userData.originalScale = child.scale.clone();
        child.userData.originalRot = child.rotation.clone();

        const matName = (child.material?.name || '').toLowerCase();

        if (matName.includes('tazza')) tazzaMesh = child;
        if (matName === 'caffe') caffeMesh = child;

        if (matName === 'tavolo') {
          tableMeshes.push(child);
          child.position.y -= 5;
          child.scale.set(0, 0, 0);
        } else {
          otherMeshes.push(child);
          child.scale.set(0, 0, 0);

          if (child.material && transparentMaterials.includes(child.material.name)) {
            child.material.transparent = true;
            child.material.opacity = 0;
            child.userData.hasTransparency = true;
          }
        }
      }
    });

    // 1. Animazione Tavolo
    tableMeshes.forEach((mesh: any) => {
      tl.to(mesh.position, { y: mesh.userData.originalPos.y, duration: 1.2, ease: 'back.out(1.2)' }, 0);
      tl.to(mesh.scale, { x: mesh.userData.originalScale.x, y: mesh.userData.originalScale.y, z: mesh.userData.originalScale.z, duration: 1.2, ease: 'back.out(1.2)' }, 0);
      mesh.rotation.x -= 0.5;
      tl.to(mesh.rotation, { x: mesh.userData.originalRot.x, duration: 1.2, ease: 'back.out(1.5)' }, 0);
    });

    // 2. Pop-in Altri Oggetti
    const popStartTime = 1.2;
    otherMeshes.forEach((mesh: any) => {
      if (mesh === caffeMesh) return;

      const delay = popStartTime;
      tl.to(mesh.scale, { x: mesh.userData.originalScale.x, y: mesh.userData.originalScale.y, z: mesh.userData.originalScale.z, duration: 0.5, ease: 'back.out(1.7)' }, delay);

      if (mesh.userData.hasTransparency) {
        tl.to(mesh.material, { opacity: 1, duration: 0.3, ease: 'sine.out' }, delay);
      }

      if (mesh === tazzaMesh) {
        tl.to(mesh.rotation, { z: mesh.userData.originalRot.z + 0.1, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, delay + 0.3);
      }
    });

    // 3. Animazione Caffè
    if (caffeMesh && tazzaMesh) {
      const caffeDelay = popStartTime;
      tl.to(caffeMesh.scale, { x: caffeMesh.userData.originalScale.x, y: caffeMesh.userData.originalScale.y, z: caffeMesh.userData.originalScale.z, duration: 0.4, ease: 'back.out(1.5)' }, caffeDelay);
      tl.to(caffeMesh.material, { opacity: 1, duration: 0.3 }, caffeDelay);
    }

    // 4. Aggiustamento Finale
    const allObjects = [...tableMeshes, ...otherMeshes];
    tl.to(allObjects.map(m => m.position), { y: '+=0.05', duration: 0.2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, '+=0.1');

    if (tazzaMesh && caffeMesh) {
      const finalTazzaDelay = popStartTime + 0.4;
      tl.to(tazzaMesh.rotation, { z: tazzaMesh.userData.originalRot.z + 0.08, duration: 0.15, ease: 'sine.out' }, finalTazzaDelay);
      tl.to(tazzaMesh.rotation, { z: tazzaMesh.userData.originalRot.z, duration: 0.3, ease: 'power1.out' }, finalTazzaDelay + 0.15);
    }
  }

  private createScreenMaterial(video: HTMLVideoElement): THREE.MeshStandardMaterial {
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;

    const _threeAny = THREE as any;
    const _sRGBConst = _threeAny['SRGBColorSpace'] ?? _threeAny['sRGBEncoding'] ?? _threeAny['SRGBEncoding'] ?? _threeAny['LinearSRGBColorSpace'];
    if (_sRGBConst !== undefined) {
      if ('colorSpace' in videoTexture) {
        (videoTexture as any).colorSpace = _sRGBConst;
      } else if ('encoding' in videoTexture) {
        (videoTexture as any).encoding = _sRGBConst;
      }
    }

    const zoomFactor = 1.3;
    videoTexture.repeat.set(1, 1 / zoomFactor);
    videoTexture.offset.set(0, (1 - 1 / zoomFactor) / 2);

    const mat = new THREE.MeshStandardMaterial({
      map: videoTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: videoTexture,
      emissiveIntensity: 2.0,
      roughness: 0.5,
      metalness: 0.0
    });
    try { (mat as any).dithering = true; } catch (e) { }
    return mat;
  }

  private animateSmoke(): void {
    this.model.traverse((child: any) => {
      if (child.material?.name === 'fumo') {
        child.material.transparent = true;
        child.material.opacity = 0.5;
        child.material.depthWrite = false;

        gsap.to(child.position, { y: '+=1.5', duration: 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to(child.rotation, { z: '+=1.3', duration: 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      }
    });
  }

  private animateMouse(): void {
    this.model.traverse((child: any) => {
      if (child.isMesh && (child.material?.name?.toLowerCase().includes('mouse') || child.name?.toLowerCase().includes('mouse'))) {
        gsap.to(child.position, { x: '+=6.25', duration: 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      }
    });
  }

  private replaceScreenMaterials(videoMaterial: THREE.MeshStandardMaterial): void {
    this.model.traverse((child: any) => {
      if (child.isMesh) {
        if (child.material?.name === 'schermoPiccolo') {
          child.userData.isScreen = true;
          child.userData.materialName = 'schermoPiccolo';
          child.material = videoMaterial;
          this.interactiveObjects.push(child);
        }

        if (child.material?.name === 'schermoGrande') {
          child.userData.isScreen = true;
          child.userData.materialName = 'schermoGrande';
          this.screenGrandeMesh = child;
          this.interactiveObjects.push(child);

          try {
            const textureLoader = new THREE.TextureLoader();
            const photoTex = textureLoader.load('assets/texture.jpg');
            const _threeAny = THREE as any;
            const _sRGBConst2 = _threeAny['SRGBColorSpace'] ?? _threeAny['sRGBEncoding'] ?? _threeAny['SRGBEncoding'] ?? _threeAny['LinearSRGBColorSpace'];
            if (_sRGBConst2 !== undefined) {
              if ('colorSpace' in photoTex) {
                (photoTex as any).colorSpace = _sRGBConst2;
              } else if ('encoding' in photoTex) {
                (photoTex as any).encoding = _sRGBConst2;
              }
            }
            photoTex.flipY = false;
            photoTex.wrapS = photoTex.wrapT = THREE.RepeatWrapping;
            photoTex.repeat.set(-1, 1);
            photoTex.offset.set(1, 0);
            photoTex.rotation = Math.PI;

            const photoMat = new THREE.MeshBasicMaterial({ map: photoTex });
            child.material = photoMat;
          } catch (e) {
            console.warn('Errore applicazione texture a schermoGrande', e);
          }
        }
      }
    });
  }

  /**
   * Alterna tra modalità scura e chiara.
   */
  public toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;

    const lampSpots = new Set<THREE.Light>();
    if (this.model) {
      this.model.traverse((child: any) => {
        if (child.isMesh && child.material?.name === 'lampadina') {
          try {
            const spot: THREE.SpotLight = child.userData?._lampSpotLight;
            if (spot) lampSpots.add(spot);
          } catch (e) { /* ignore */ }
        }
      });
    }

    if (this.isDarkMode) {
      // Modalità Scura
      this.scene.background = new THREE.Color(0x020408);

      this.scene.traverse((obj: any) => {
        if (obj && obj.isLight && !lampSpots.has(obj)) {
          gsap.killTweensOf(obj);
          try { gsap.to(obj, { intensity: 0, duration: 0.6 }); } catch (e) { try { (obj as any).intensity = 0; } catch (e2) { } }
        }
      });

      if (this.model) {
        this.model.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if ('envMap' in child.material) {
              if (!child.userData.originalEnvMap) {
                child.userData.originalEnvMap = child.material.envMap;
                child.userData.originalEnvMapIntensity = child.material.envMapIntensity;
              }
              child.material.envMapIntensity = 0.1;
              child.material.needsUpdate = true;
            }
          }

          if (child.isMesh && child.material?.name === 'lampadina') {
            try {
              const spot: THREE.SpotLight = child.userData?._lampSpotLight;
              const glowMesh: THREE.Mesh = child.userData?._lampGlowMesh;
              if (spot) gsap.to(spot, { intensity: 40, duration: 0.9, ease: 'power2.out' });
              if (child.material) child.material.emissiveIntensity = 2.5;
              if (glowMesh && glowMesh.material) gsap.to(glowMesh.material, { opacity: 0.9, duration: 0.9, ease: 'power2.out' });
            } catch (e) { /* ignore */ }
          }

          if (child.isMesh && (child.material?.name === 'schermoPiccolo' || child.material?.name === 'schermoGrande' || child.userData?.isScreen)) {
            if (child.material) child.material.emissiveIntensity = 5.0;
          }
        });
        try { if (this.renderer) this.renderer.toneMappingExposure = 0.5; } catch (e) { }
      }
    } else {
      // Modalità Chiara
      if (this.originalEnvMap) this.scene.environment = this.originalEnvMap;
      this.scene.background = new THREE.Color(0x113250);

      this.scene.traverse((obj: any) => {
        if (obj && obj.isLight) {
          try {
            if (obj === this.ambientLight) gsap.to(obj, { intensity: 0.25, duration: 0.6 });
            else if (obj === this.mainLight) gsap.to(obj, { intensity: 1.0, duration: 0.6 });
            else if (obj === this.fillLight) gsap.to(obj, { intensity: 0.6, duration: 0.6 });
            else if (this.screenLights && this.screenLights.includes(obj)) gsap.to(obj, { intensity: 0.03, duration: 0.6 });
            else {
              const isTastoLight = obj.parent && obj.parent.userData && obj.parent.userData.isTastoMice;
              if (isTastoLight) {
                gsap.to(obj, {
                  intensity: 0.8, duration: 0.9, ease: 'power2.out', onComplete: () => {
                    gsap.to(obj, { intensity: 1.5, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
                  }
                });
              } else {
                gsap.to(obj, { intensity: 0.5, duration: 0.6 });
              }
            }
          } catch (e) {
            try { (obj as any).intensity = 0.5; } catch (e2) { }
          }
        }
      });

      if (this.model) {
        this.model.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (child.userData.originalEnvMap) {
              child.material.envMapIntensity = child.userData.originalEnvMapIntensity !== undefined ? child.userData.originalEnvMapIntensity : 0.5;
              child.material.needsUpdate = true;
            }
          }

          if (child.isMesh && child.material?.name === 'lampadina') {
            try {
              const spot: THREE.SpotLight = child.userData?._lampSpotLight;
              const glowMesh: THREE.Mesh = child.userData?._lampGlowMesh;
              if (spot) gsap.to(spot, { intensity: 0, duration: 0.6 });
              if (child.material) gsap.to(child.material, { emissiveIntensity: 0, duration: 0.6 });
              if (glowMesh && glowMesh.material) gsap.to(glowMesh.material, { opacity: 0, duration: 0.6 });
            } catch (e) { /* ignore */ }
          }

          if (child.isMesh && (child.material?.name === 'schermoPiccolo' || child.material?.name === 'schermoGrande' || child.userData?.isScreen)) {
            if (child.material) child.material.emissiveIntensity = 2.0;
          }

          if (child.isMesh && child.material?.name === 'tastoMice') {
            if (child.material) {
              child.material.emissiveIntensity = 0.5;
              setTimeout(() => {
                if (child.material) child.material.emissiveIntensity = 1.2;
              }, 900);
            }
          }
        });
      }
      try { if (this.renderer) this.renderer.toneMappingExposure = 0.8; } catch (e) { }
    }
  }

  private addMaterialToTazza(): void {
    this.model.traverse((child: any) => {
      if (child.material?.name === 'tazza') {
        child.material.transparent = true;
        child.material.opacity = 0.8;
        child.material.depthWrite = false;
      }
    });
  }

  private startVideo(video: HTMLVideoElement): void {
    video.play().catch(console.warn);
  }

  private handleClick(event: MouseEvent): void {
    const hit = this.raycastHit(event);

    if (hit) {
      if (hit.type === 'screen') {
        const matName = hit.object.userData?.materialName || hit.object.material?.name;

        if (matName === 'schermoGrande') {
          console.log('Cliccato schermoGrande - Apertura Modale Ricerca');
          this.openResearchModal();
          return;
        }

        if (matName === 'schermoPiccolo' || hit.object.material?.name === 'schermoPiccolo') {
          console.log('Cliccato schermoPiccolo - Toggle Zoom');
          if (this.isZoomedIn) {
            this.zoomOut();
          } else {
            this.zoomToScreen(hit.object);
          }
          return;
        }
      }

      if (hit.type === 'tasto') {
        console.log('Cliccato tastoMice - Apertura Modale Robot Dog');
        this.openRobotDogModal();
        return;
      }
    }
  }

  private zoomToScreen(target: THREE.Object3D): void {
    if (this.isZoomedIn) return;

    this.isZoomedIn = true;
    if (this.controls) this.controls.enabled = false;

    this.originalCameraPosition.copy(this.camera.position);
    if (this.controls) this.originalControlsTarget.copy(this.controls.target);

    const targetPos = new THREE.Vector3();
    target.getWorldPosition(targetPos);

    const cameraTargetPos = targetPos.clone().add(new THREE.Vector3(-0.35, 0, 2));

    gsap.to(this.camera.position, {
      x: cameraTargetPos.x,
      y: cameraTargetPos.y,
      z: cameraTargetPos.z,
      duration: 1.5,
      ease: 'power2.inOut'
    });

    if (this.controls) {
      gsap.to(this.controls.target, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.controls?.update();
        }
      });
    }
  }

  private zoomOut(): void {
    if (!this.isZoomedIn) return;

    gsap.to(this.camera.position, {
      x: this.originalCameraPosition.x,
      y: this.originalCameraPosition.y,
      z: this.originalCameraPosition.z,
      duration: 1.2,
      ease: 'power2.inOut'
    });

    if (this.controls) {
      gsap.to(this.controls.target, {
        x: this.originalControlsTarget.x,
        y: this.originalControlsTarget.y,
        z: this.originalControlsTarget.z,
        duration: 1.2,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.controls?.update();
        },
        onComplete: () => {
          this.isZoomedIn = false;
          if (this.controls) this.controls.enabled = true;
        }
      });
    }
  }

  public openTastoMiceModal(text?: string): void {
    this.isTastoMiceModalVisible = true;
    try { document.body.style.overflow = 'hidden'; } catch (e) { }
    this.hideButton();
  }

  public closeTastoMiceModal(): void {
    this.isTastoMiceModalVisible = false;
    try { document.body.style.overflow = ''; } catch (e) { }
  }

  public openResearchModal(): void {
    this.isResearchModalVisible = true;
    try { document.body.style.overflow = 'hidden'; } catch (e) { }
    this.hideButton();
  }

  public closeResearchModal(): void {
    this.isResearchModalVisible = false;
    try { document.body.style.overflow = ''; } catch (e) { }
  }

  public openRobotDogModal(): void {
    this.isRobotDogModalVisible = true;
    try { document.body.style.overflow = 'hidden'; } catch (e) { }
    this.hideButton();
  }

  public closeRobotDogModal(): void {
    this.isRobotDogModalVisible = false;
    try { document.body.style.overflow = ''; } catch (e) { }
  }

  private setupScrollAnimation(): void {
    if (!this.model) {
      setTimeout(() => this.setupScrollAnimation(), 500);
      return;
    }

    console.log('Configurazione animazione scroll...');

    ScrollTrigger.getAll().forEach(trigger => trigger.kill());

    const animationSection = document.querySelector('.animation-section') as HTMLElement;
    if (animationSection) {
      animationSection.style.position = 'absolute';
      animationSection.style.width = '50%';
      animationSection.style.height = '100%';
      animationSection.style.right = '0';
      animationSection.style.top = '0';
    }

    this.camera.position.set(0, 1.5, 4.3);
    this.model.position.set(0.2, -1.5, -3);
    this.model.scale.set(0.8, 0.8, 0.8);

    this.originalCameraPosition.copy(this.camera.position);
    if (this.controls) this.originalControlsTarget.copy(this.controls.target);

    if (this.controls) {
      this.controls.enabled = true;
      this.controls.enableZoom = this.zoomEnabled;
      this.controls.enableRotate = true;
      this.controls.enablePan = true;
      this.controls.update();
    }
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());

    // Aggiorna i controlli (necessario per il damping)
    if (this.controls) {
      this.controls.update();
    }

    // Aggiorna posizioni spotlight usando la cache (ottimizzato - no scene traversal)
    // Aggiorna posizioni spotlight usando la cache (ottimizzato)
    // Esegui l'aggiornamento solo se l'animazione è attiva o se siamo nei primi secondi (assembly)
    // O se il renderer info mostra che ci sono aggiornamenti di matrice (opzionale, qui semplifichiamo)
    if (this.isAnimationActive || performance.now() < 5000) {
      for (const lampObj of this.cachedLampObjects) {
        try {
          const anchorPos = new THREE.Vector3();
          lampObj.mesh.getWorldPosition(anchorPos);
          lampObj.spotLight.position.copy(anchorPos);
          if (lampObj.glowMesh) lampObj.glowMesh.position.copy(anchorPos);
          if (lampObj.helper && typeof lampObj.helper.update === 'function') {
            lampObj.helper.update();
          }
        } catch (e) { }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const canvas = this.threeCanvas.nativeElement;
    if (!canvas) return;

    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  public forceScroll(): void {
    if (this.isAnimationActive) {
      window.scrollBy(0, window.innerHeight * 0.8);
    }
  }

  public toggleZoom() {
    this.zoomEnabled = !this.zoomEnabled;
    if (this.controls) this.controls.enableZoom = this.zoomEnabled;
  }

  onMouseMove(event: MouseEvent) {
    // Throttling per ottimizzare performance del raycasting
    const now = performance.now();
    if (now - this.lastMouseMoveTime < this.mouseMoveThrottleMs) {
      this.pendingMouseMove = event;
      return;
    }

    this.lastMouseMoveTime = now;
    this.pendingMouseMove = null;

    const hit = this.raycastHit(event);

    if (hit && (hit.type === 'screen' || hit.type === 'tasto')) {
      this.showButtonAt(event.clientX + 10, event.clientY + 10);

      if (this.intersectedObject !== hit.object) {
        if (this.intersectedObject) {
          const original = this.intersectedObject.userData['originalScale'];
          gsap.killTweensOf(this.intersectedObject.scale);
          gsap.to(this.intersectedObject.scale, { x: original.x, y: original.y, z: original.z, duration: 0.3, ease: 'power2.out' });
        }

        this.intersectedObject = hit.object;
        if (hit.type === 'screen') {
          gsap.to(hit.object.scale, { x: hit.object.scale.x * 1.01, y: hit.object.scale.y * 1.01, z: hit.object.scale.z * 1.01, duration: 0.4, ease: 'back.out(2)' });
        } else if (hit.type === 'tasto') {
          gsap.to(hit.object.scale, { x: hit.object.scale.x * 1.05, y: hit.object.scale.y * 1.55, z: hit.object.scale.z * 1.05, duration: 0.4, ease: 'back.out(2)' });
        }
      }
    } else {
      this.hideButton();
      if (this.intersectedObject) {
        const original = this.intersectedObject.userData['originalScale'];
        gsap.killTweensOf(this.intersectedObject.scale);
        gsap.to(this.intersectedObject.scale, { x: original.x, y: original.y, z: original.z, duration: 0.3, ease: 'power2.inOut' });
        this.intersectedObject = null;
      }
    }
  }

  showButtonAt(x: number, y: number) {
    const el = this.hoverButton.nativeElement;
    el.style.left = `${x}px`;
    el.style.top = `${y - 30}px`;

    if (this.isButtonVisible) return;

    this.isButtonVisible = true;
    // Applicazione istantanea degli stili senza animazioni
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
  }

  hideButton() {
    if (!this.isButtonVisible) return;

    this.isButtonVisible = false;
    const el = this.hoverButton.nativeElement;
    // Applicazione istantanea degli stili
    el.style.opacity = '0';
    el.style.transform = 'scale(0.8)';
  }

  private raycastHit(event: MouseEvent): { type: string, object: any } | null {
    const canvas = this.threeCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);

    // Ottimizzazione: Raycasting solo sugli oggetti interattivi
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, false);

    if (intersects.length > 0) {
      // Prendi il primo oggetto colpito
      const obj = intersects[0].object as any;

      // Logica di identificazione tipo
      if (obj.userData?.isScreen && obj.userData?.materialName === 'schermoGrande') return { type: 'screen', object: obj };
      if (obj.userData?.materialName === 'schermoPiccolo' || obj.material?.name === 'schermoPiccolo') return { type: 'screen', object: obj };

      // Per i tasti mouse, verifica se è un tasto o un figlio di un tasto (anche se con interactiveObjects dovrebbe essere diretto)
      if (obj.userData?.isTastoMice) return { type: 'tasto', object: obj };
    }

    return null;
  }
}
