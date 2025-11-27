import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Registra il plugin GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-demo',
  templateUrl: './demo.component.html',
})
export class DemoComponent implements OnInit {
  @ViewChild('canvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private tube!: THREE.Mesh;
  private wireframe!: THREE.LineSegments;
  private c!: THREE.Group;
  private light!: THREE.PointLight;
  private particleSystem1!: THREE.Points;
  private particleSystem2!: THREE.Points;
  private particleSystem3!: THREE.Points;

  private cameraRotationProxyX = 3.14159;
  private cameraRotationProxyY = 0;
  private cameraTargetPercentage = 0;
  private currentCameraPercentage = 0;

  private tubePerc = { percent: 0 };

  constructor() { }

  ngOnInit() {
    this.initScene();
  }

  private Mathutils = {
    normalize: function (value: number, min: number, max: number): number {
      return (value - min) / (max - min);
    },
    interpolate: function (normValue: number, min: number, max: number): number {
      return min + (max - min) * normValue;
    },
    map: function (value: number, min1: number, max1: number, min2: number, max2: number): number {
      if (value < min1) {
        value = min1;
      }
      if (value > max1) {
        value = max1;
      }
      return this.interpolate(this.normalize(value, min1, max1), min2, max2);
    }
  };

  /**
   * Inizializza la scena Three.js, la camera, il renderer e il post-processing.
   */
  private initScene(): void {
    const ww = window.innerWidth;
    const wh = window.innerHeight;

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasRef.nativeElement,
      antialias: true
    });
    this.renderer.setSize(ww, wh);
    this.renderer.setClearColor(0x194794);

    // 2. Scena
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x194794, 0, 100);

    // 3. Camera e Gruppo
    this.camera = new THREE.PerspectiveCamera(45, ww / wh, 0.001, 200);
    this.camera.rotation.y = this.cameraRotationProxyX;
    this.camera.rotation.z = this.cameraRotationProxyY;

    this.c = new THREE.Group();
    this.c.position.z = 400;
    this.c.add(this.camera);
    this.scene.add(this.c);

    // 4. Effect Composer e Bloom Pass
    const renderScene = new RenderPass(this.scene, this.camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(ww, wh),
      2.0, // Forza
      0.2, // Soglia
      1.0  // Raggio
    );
    bloomPass.renderToScreen = true;

    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(ww, wh);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);

    // 5. Crea Tubo Principale
    this.createTube();

    // 6. Crea Wireframe
    this.createWireframe();

    // 7. Luci
    this.createLights();

    // 8. Sistema di Particelle
    this.createParticleSystem();

    // 9. Animazione Scroll
    this.setupScrollAnimation();

    // 10. Avvia Loop di Rendering
    this.animate();

    // 11. Gestore Ridimensionamento
    this.setupResizeHandler();

    // 12. Crea Card
    this.createCards();
  }

  private createTube(): void {
    const points = [
      new Vector3(10, 89, 0),
      new Vector3(50, 88, 10),
      new Vector3(76, 139, 20),
      new Vector3(126, 141, 12),
      new Vector3(150, 112, 8),
      new Vector3(157, 73, 0),
      new Vector3(180, 44, 5),
      new Vector3(207, 35, 10),
      new Vector3(232, 36, 0)
    ];

    const path = new CatmullRomCurve3(points);
    path.tension = 0.5;

    const geometry = new TubeGeometry(path, 300, 4, 32, false);

    const texture = new THREE.TextureLoader().load(
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/68819/3d_space_5.jpg'
    );

    const mapHeight = new THREE.TextureLoader().load(
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/68819/waveform-bump3.jpg'
    );

    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 1);

    mapHeight.wrapS = mapHeight.wrapT = THREE.RepeatWrapping;
    mapHeight.repeat.set(15, 2);

    const material = new THREE.MeshPhongMaterial({
      side: THREE.BackSide,
      map: texture,
      shininess: 20,
      bumpMap: mapHeight,
      bumpScale: -0.03,
      specular: 0x0b2349
    });

    this.tube = new THREE.Mesh(geometry, material);
    this.scene.add(this.tube);
  }

  private createWireframe(): void {
    const points = [
      new Vector3(10, 89, 0),
      new Vector3(50, 88, 10),
      new Vector3(76, 139, 20),
      new Vector3(126, 141, 12),
      new Vector3(150, 112, 8),
      new Vector3(157, 73, 0),
      new Vector3(180, 44, 5),
      new Vector3(207, 35, 10),
      new Vector3(232, 36, 0)
    ];

    const path = new CatmullRomCurve3(points);
    path.tension = 0.5;

    const geometry = new TubeGeometry(path, 150, 3.4, 32, false);
    const edges = new THREE.EdgesGeometry(geometry);

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      opacity: 0.2,
      transparent: true
    });

    this.wireframe = new THREE.LineSegments(edges, material);
    this.scene.add(this.wireframe);
  }

  private createLights(): void {
    this.light = new THREE.PointLight(0xffffff, 1.5, 10, 0);
    this.light.position.set(50, 50, 50);
    this.scene.add(this.light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(100, 100, 50);
    this.scene.add(directionalLight);
  }

  private createParticleSystem(): void {
    const spikeyTexture = new THREE.TextureLoader().load(
      'https://s3-us-west-2.amazonaws.com/s.cdpn.io/68819/spikey.png'
    );

    const particleCount = 6800;
    const pMaterial = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 0.5,
      map: spikeyTexture,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    // Sistema di Particelle 1
    const particles1 = new THREE.BufferGeometry();
    const positions1 = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions1[i] = Math.random() * 500 - 250;
      positions1[i + 1] = Math.random() * 50 - 25;
      positions1[i + 2] = Math.random() * 500 - 250;
    }

    particles1.setAttribute('position', new THREE.BufferAttribute(positions1, 3));
    this.particleSystem1 = new THREE.Points(particles1, pMaterial);
    this.scene.add(this.particleSystem1);

    // Sistema di Particelle 2
    const particles2 = new THREE.BufferGeometry();
    const positions2 = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions2[i] = Math.random() * 500;
      positions2[i + 1] = Math.random() * 10 - 5;
      positions2[i + 2] = Math.random() * 500;
    }

    particles2.setAttribute('position', new THREE.BufferAttribute(positions2, 3));
    this.particleSystem2 = new THREE.Points(particles2, pMaterial);
    this.scene.add(this.particleSystem2);

    // Sistema di Particelle 3
    const particles3 = new THREE.BufferGeometry();
    const positions3 = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions3[i] = Math.random() * 500;
      positions3[i + 1] = Math.random() * 10 - 5;
      positions3[i + 2] = Math.random() * 500;
    }

    particles3.setAttribute('position', new THREE.BufferAttribute(positions3, 3));
    this.particleSystem3 = new THREE.Points(particles3, pMaterial);
    this.scene.add(this.particleSystem3);
  }

  private updateCameraPercentage(percentage: number): void {
    const path = new CatmullRomCurve3([
      new Vector3(10, 89, 0),
      new Vector3(50, 88, 10),
      new Vector3(76, 139, 20),
      new Vector3(126, 141, 12),
      new Vector3(150, 112, 8),
      new Vector3(157, 73, 0),
      new Vector3(180, 44, 5),
      new Vector3(207, 35, 10),
      new Vector3(232, 36, 0)
    ]);

    const p1 = path.getPointAt(percentage);
    const p2 = path.getPointAt(percentage + 0.03);

    this.c.position.set(p1.x, p1.y, p1.z);
    this.c.lookAt(p2);
    this.light.position.set(p2.x, p2.y, p2.z);
  }

  private setupScrollAnimation(): void {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".scrollTarget",
        start: "top top",
        end: "bottom 100%",
        scrub: 5,
        markers: false
      }
    });

    tl.to(this.tubePerc, {
      percent: 0.96,
      ease: "none",
      duration: 10,
      onUpdate: () => {
        this.cameraTargetPercentage = this.tubePerc.percent;
      }
    });
  }

  private animate = (): void => {
    this.currentCameraPercentage = this.cameraTargetPercentage;

    this.camera.rotation.y += (this.cameraRotationProxyX - this.camera.rotation.y) / 15;
    this.camera.rotation.x += (this.cameraRotationProxyY - this.camera.rotation.x) / 15;

    this.updateCameraPercentage(this.currentCameraPercentage);

    // Animazione particelle
    this.particleSystem1.rotation.y += 0.00002;
    this.particleSystem2.rotation.x += 0.00005;
    this.particleSystem3.rotation.z += 0.00001;

    this.composer.render();
    requestAnimationFrame(this.animate);
  }

  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);
    });
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.cameraRotationProxyX = this.Mathutils.map(
      event.clientX, 0, window.innerWidth, 3.24, 3.04
    );
    this.cameraRotationProxyY = this.Mathutils.map(
      event.clientY, 0, window.innerHeight, -0.1, 0.1
    );
  }

  private createCards(): void {
    const cardData = [
      { title: 'Card 1', description: 'Descrizione della prima card' },
      { title: 'Card 2', description: 'Descrizione della seconda card' },
      { title: 'Card 3', description: 'Descrizione della terza card' }
    ];

    const positions = [0.2, 0.5, 0.8]; // Percentuali lungo il tubo

    const path = new CatmullRomCurve3([
      new Vector3(10, 89, 0),
      new Vector3(50, 88, 10),
      new Vector3(76, 139, 20),
      new Vector3(126, 141, 12),
      new Vector3(150, 112, 8),
      new Vector3(157, 73, 0),
      new Vector3(180, 44, 5),
      new Vector3(207, 35, 10),
      new Vector3(232, 36, 0)
    ]);

    cardData.forEach((card, index) => {
      const position = path.getPointAt(positions[index]);
      const tangent = path.getTangentAt(positions[index]);

      // Mantieni le card all'interno del tunnel
      const offset = tangent.clone().cross(new Vector3(0, 1, 0)).normalize().multiplyScalar(2);
      position.add(offset);

      const cardGeometry = new THREE.BoxGeometry(6, 3, 0.5);
      const cardMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.5,
        roughness: 0.3,
        side: THREE.DoubleSide
      });

      const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
      cardMesh.position.set(position.x, position.y, position.z);

      // Orienta le card orizzontalmente
      cardMesh.rotation.x = 2;
      cardMesh.rotation.z = -4;

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#194794';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = '30px Arial';
        ctx.fillText(card.title, 20, 60);
        ctx.font = '20px Arial';
        ctx.fillText(card.description, 20, 120);
      }

      const texture = new THREE.CanvasTexture(canvas);
      cardMaterial.map = texture;
      cardMaterial.needsUpdate = true;

      this.scene.add(cardMesh);

      console.log(`Card ${index + 1} position:`, position);
    });
  }
}
