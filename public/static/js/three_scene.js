/**
 * Smart City Traffic AI - 3D WebGL Digital Twin Engine
 * Map-Driven Procedural Road Network & Urban Infrastructure
 * 
 * Every road corridor, junction, zebra crossing, signal gantry, and streetlight
 * is dynamically generated from real-world OpenStreetMap GIS waypoints and nodes.
 * 
 * Features:
 * - 100% Map-Driven: Directly parses hotspot.corridors waypoints and hotspot.nodes
 * - Multi-lane carriageways with exact Indian Left-Hand Traffic (LHT) lane geometry
 * - Prominent high-contrast zebra crossings generated at every junction approach
 * - Realistic asphalt textures, beveled curbs, elevated sidewalks, and street lamps
 * - Forward-aligned vehicle models (+Z is front) matching velocity vectors
 * - Low-end hardware optimization with shared Flyweight geometry and material cache
 * - Zero NPCs, zero CCTV tracking overlays
 */

class Traffic3DDigitalTwin {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`[Traffic3D] Container #${containerId} not found`);
            return;
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentHotspot = null;
        this.centerLat = 12.91765;
        this.centerLng = 77.62350;

        // Visual collections
        this.vehicleMeshes = new Map(); // id -> { group, targetPos, targetRotY, speed, type, data }
        this.roadMeshes = [];
        this.flyoverMeshes = [];
        this.signalGantries = new Map();
        this.buildingMeshes = [];
        this.streetLights = [];
        this.lightPools = [];
        this.blinkingBeacons = [];
        this.speedMultiplier = 1.0;

        // Graphics & Performance (Locked at smooth, high-fidelity 60 FPS)
        this.qualityPreset = 'high';
        this.geoCache = {};
        this.matCache = {};
        this.sharedTextures = {};

        // Camera Modes
        this.cameraMode = 'junction';
        this.followVehicleId = null;
        this.isAutoOrbiting = false;
        this.orbitAngle = 0;
        this.targetCameraPos = new THREE.Vector3(0, 35, 45);
        this.targetCameraLookAt = new THREE.Vector3(0, 1.0, 0);
        this.isTransitioningCamera = false;

        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-999, -999);
        this.selectedVehicleId = null;
        this.selectionRing = null;

        this.clock = new THREE.Clock();

        this.init();
    }

    // ==========================================
    // 1. INITIALIZATION & SCENE SETUP
    // ==========================================
    init() {
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || (window.innerHeight - 150);

        // 1. Scene & Atmospheric Twilight Sky
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060914);
        this.scene.fog = new THREE.FogExp2(0x060914, 0.0016);

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1800);
        this.camera.position.set(0, 35, 45);

        // 3. Renderer (Ultra HD Graphics locked to solid 60 FPS)
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;
        if (THREE.sRGBEncoding) {
            this.renderer.outputEncoding = THREE.sRGBEncoding;
        }
        this.container.appendChild(this.renderer.domElement);

        // 4. Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 800;
        this.controls.target.set(0, 1.0, 0);

        // 5. Shared Asset Cache (Flyweight)
        this.initSharedAssetCache();

        // 6. Lighting Setup (Cinematic Moonlight & Fill)
        this.setupLighting();

        // 7. Ground Horizon Grid & Night Sky Starfield
        this.createGroundGrid();
        this.createStarfield();

        // 8. Selection Ring
        this.createSelectionRing();

        // 9. Immediate baseline road network generation (Zero blank screen)
        if (typeof window !== 'undefined' && window.INITIAL_SIM_STATE && window.INITIAL_SIM_STATE.hotspot) {
            this.loadHotspot(window.INITIAL_SIM_STATE.hotspot);
        } else {
            this.buildNightSkyline();
            this.setCameraPreset('junction');
        }

        // 10. Event Listeners
        window.addEventListener('resize', () => this.onResize());
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));

        // 11. Start 60 FPS Animation Loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        console.log("🚦 [Traffic3D] Ultra HD 60 FPS Digital Twin Engine Initialized");
    }

    createStarfield() {
        const starGeo = new THREE.BufferGeometry();
        const starCoords = [];
        for (let i = 0; i < 280; i++) {
            const radius = 350 + Math.random() * 450;
            const theta = Math.random() * Math.PI * 2;
            const phi = 0.2 + Math.random() * (Math.PI / 2 - 0.25);
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.cos(phi) + 40;
            const z = radius * Math.sin(theta) * Math.sin(phi);
            starCoords.push(x, y, z);
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
        const starMat = new THREE.PointsMaterial({
            color: 0x94b8e0,
            size: 1.6,
            transparent: true,
            opacity: 0.65,
            depthWrite: false
        });
        const stars = new THREE.Points(starGeo, starMat);
        this.scene.add(stars);
    }

    // ==========================================
    // 2. SHARED ASSET CACHE (FLYWEIGHT PATTERN)
    // ==========================================
    initSharedAssetCache() {
        const mc = this.matCache;
        const gc = this.geoCache;

        // 1. Radial light pool texture for warm streetlights
        const poolCanvas = document.createElement('canvas');
        poolCanvas.width = 128;
        poolCanvas.height = 128;
        const pctx = poolCanvas.getContext('2d');
        const grad = pctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255, 235, 175, 0.48)');
        grad.addColorStop(0.35, 'rgba(255, 220, 140, 0.22)');
        grad.addColorStop(0.7, 'rgba(255, 210, 110, 0.06)');
        grad.addColorStop(1, 'rgba(255, 200, 90, 0.0)');
        pctx.fillStyle = grad;
        pctx.fillRect(0, 0, 128, 128);
        const poolTexture = new THREE.CanvasTexture(poolCanvas);
        this.sharedTextures.lightPool = poolTexture;

        // 2. Headlight forward projection cone texture (additive beam)
        const beamCanvas = document.createElement('canvas');
        beamCanvas.width = 128;
        beamCanvas.height = 256;
        const bctx = beamCanvas.getContext('2d');
        const bGrad = bctx.createRadialGradient(64, 20, 4, 64, 140, 120);
        bGrad.addColorStop(0, 'rgba(255, 248, 220, 0.55)');
        bGrad.addColorStop(0.3, 'rgba(255, 235, 180, 0.28)');
        bGrad.addColorStop(0.7, 'rgba(255, 220, 140, 0.08)');
        bGrad.addColorStop(1, 'rgba(255, 200, 100, 0.0)');
        bctx.fillStyle = bGrad;
        bctx.fillRect(0, 0, 128, 256);
        const beamTexture = new THREE.CanvasTexture(beamCanvas);
        this.sharedTextures.headlightBeam = beamTexture;

        // 3. Procedural Asphalt Micro-Grain Bump Texture
        const asphaltCanvas = document.createElement('canvas');
        asphaltCanvas.width = 128;
        asphaltCanvas.height = 128;
        const actx = asphaltCanvas.getContext('2d');
        actx.fillStyle = '#808080';
        actx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 2200; i++) {
            const x = Math.random() * 128;
            const y = Math.random() * 128;
            const val = 100 + Math.floor(Math.random() * 60);
            actx.fillStyle = `rgb(${val},${val},${val})`;
            actx.fillRect(x, y, 1.5, 1.5);
        }
        const asphaltBump = new THREE.CanvasTexture(asphaltCanvas);
        asphaltBump.wrapS = THREE.RepeatWrapping;
        asphaltBump.wrapT = THREE.RepeatWrapping;
        asphaltBump.repeat.set(12, 12);
        this.sharedTextures.asphaltBump = asphaltBump;

        // 4. Procedural High-Tech Ground Grid Texture
        const gridCanvas = document.createElement('canvas');
        gridCanvas.width = 256;
        gridCanvas.height = 256;
        const gctx = gridCanvas.getContext('2d');
        gctx.fillStyle = '#070a12';
        gctx.fillRect(0, 0, 256, 256);
        gctx.strokeStyle = 'rgba(56, 85, 125, 0.22)';
        gctx.lineWidth = 1.5;
        gctx.strokeRect(0, 0, 256, 256);
        gctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
        gctx.fillRect(0, 0, 3, 3);
        gctx.fillRect(253, 0, 3, 3);
        gctx.fillRect(0, 253, 3, 3);
        gctx.fillRect(253, 253, 3, 3);
        const groundGridTexture = new THREE.CanvasTexture(gridCanvas);
        groundGridTexture.wrapS = THREE.RepeatWrapping;
        groundGridTexture.wrapT = THREE.RepeatWrapping;
        groundGridTexture.repeat.set(80, 80);
        this.sharedTextures.groundGrid = groundGridTexture;

        // 5. Procedural Skyscraper Facade Window Textures (Living Metropolis)
        const makeBuildingTexture = (primaryColorHex, warmChance) => {
            const bCanvas = document.createElement('canvas');
            bCanvas.width = 128;
            bCanvas.height = 256;
            const ctx = bCanvas.getContext('2d');
            ctx.fillStyle = '#060a12';
            ctx.fillRect(0, 0, 128, 256);

            const cols = 8;
            const rows = 24;
            const wW = 8;
            const wH = 6;
            const padX = 8;
            const padY = 4;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const isLit = Math.random() < 0.42;
                    if (isLit) {
                        const isWarm = Math.random() < warmChance;
                        ctx.fillStyle = isWarm ? '#ffe599' : primaryColorHex;
                        ctx.fillRect(padX + c * 14, padY + r * 10, wW, wH);
                    } else {
                        ctx.fillStyle = '#0e1726';
                        ctx.fillRect(padX + c * 14, padY + r * 10, wW, wH);
                    }
                }
            }
            const tex = new THREE.CanvasTexture(bCanvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2, 6);
            return tex;
        };

        const bTex1 = makeBuildingTexture('#67e8f9', 0.25);
        const bTex2 = makeBuildingTexture('#fde047', 0.75);
        const bTex3 = makeBuildingTexture('#38bdf8', 0.40);

        this.sharedTextures.buildingMaterials = [
            new THREE.MeshStandardMaterial({ color: 0x090e18, map: bTex1, roughness: 0.35, metalness: 0.8 }),
            new THREE.MeshStandardMaterial({ color: 0x0c121d, map: bTex2, roughness: 0.35, metalness: 0.75 }),
            new THREE.MeshStandardMaterial({ color: 0x080c14, map: bTex3, roughness: 0.40, metalness: 0.82 })
        ];

        // Indian Two-Tone Safety Curb Texture (Alternating Yellow & Black stripes)
        const curbCanvas = document.createElement('canvas');
        curbCanvas.width = 64;
        curbCanvas.height = 64;
        const cctx = curbCanvas.getContext('2d');
        cctx.fillStyle = '#f59e0b';
        cctx.fillRect(0, 0, 64, 64);
        cctx.fillStyle = '#18181b';
        for (let i = -64; i < 128; i += 32) {
            cctx.beginPath();
            cctx.moveTo(i, 0);
            cctx.lineTo(i + 16, 0);
            cctx.lineTo(i + 16 + 64, 64);
            cctx.lineTo(i + 64, 64);
            cctx.closePath();
            cctx.fill();
        }
        const curbTexture = new THREE.CanvasTexture(curbCanvas);
        curbTexture.wrapS = THREE.RepeatWrapping;
        curbTexture.wrapT = THREE.RepeatWrapping;
        curbTexture.repeat.set(1, 14);
        this.sharedTextures.curbStriped = curbTexture;

        // Interlocking Concrete Paver Sidewalk Texture
        const walkCanvas = document.createElement('canvas');
        walkCanvas.width = 128;
        walkCanvas.height = 128;
        const wctx = walkCanvas.getContext('2d');
        wctx.fillStyle = '#262d3d';
        wctx.fillRect(0, 0, 128, 128);
        wctx.strokeStyle = '#181f2c';
        wctx.lineWidth = 1.5;
        for (let x = 0; x <= 128; x += 32) {
            wctx.beginPath();
            wctx.moveTo(x, 0);
            wctx.lineTo(x, 128);
            wctx.stroke();
        }
        for (let y = 0; y <= 128; y += 32) {
            wctx.beginPath();
            wctx.moveTo(0, y);
            wctx.lineTo(128, y);
            wctx.stroke();
        }
        for (let i = 0; i < 300; i++) {
            wctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
            wctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
        }
        const walkTexture = new THREE.CanvasTexture(walkCanvas);
        walkTexture.wrapS = THREE.RepeatWrapping;
        walkTexture.wrapT = THREE.RepeatWrapping;
        walkTexture.repeat.set(2, 14);
        this.sharedTextures.sidewalk = walkTexture;

        // Directional Lane Arrow Textures
        const makeArrowTexture = (type) => {
            const aCan = document.createElement('canvas');
            aCan.width = 64;
            aCan.height = 128;
            const actx = aCan.getContext('2d');
            actx.fillStyle = '#f8fafc';
            if (type === 'straight') {
                actx.fillRect(27, 40, 10, 75);
                actx.beginPath();
                actx.moveTo(32, 10);
                actx.lineTo(12, 45);
                actx.lineTo(52, 45);
                actx.closePath();
                actx.fill();
            } else {
                actx.fillRect(27, 60, 10, 55);
                actx.beginPath();
                actx.moveTo(37, 60);
                actx.quadraticCurveTo(37, 35, 18, 35);
                actx.lineTo(18, 24);
                actx.lineTo(2, 40);
                actx.lineTo(18, 56);
                actx.lineTo(18, 45);
                actx.quadraticCurveTo(27, 45, 27, 60);
                actx.closePath();
                actx.fill();
            }
            return new THREE.CanvasTexture(aCan);
        };

        // Road Materials (PBR Matte Asphalt matching city pavement)
        mc.asphalt = new THREE.MeshStandardMaterial({
            color: 0x141822,
            roughness: 0.88,
            metalness: 0.06,
            bumpMap: asphaltBump,
            bumpScale: 0.02
        });
        mc.junctionAsphalt = mc.asphalt;

        mc.curb = new THREE.MeshStandardMaterial({
            color: 0x2e3646,
            roughness: 0.65,
            metalness: 0.28
        });

        mc.curbStriped = new THREE.MeshStandardMaterial({
            map: curbTexture,
            roughness: 0.65,
            metalness: 0.20
        });

        mc.sidewalk = new THREE.MeshStandardMaterial({
            map: walkTexture,
            roughness: 0.72,
            metalness: 0.18
        });

        mc.medianPlanter = new THREE.MeshStandardMaterial({ color: 0x1e271e, roughness: 0.9, metalness: 0.05 });
        mc.medianHedge = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.82, metalness: 0.08 });
        mc.treeTrunk = new THREE.MeshStandardMaterial({ color: 0x3d2714, roughness: 0.88, metalness: 0.08 });
        mc.treeFoliage1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75, metalness: 0.08 });
        mc.treeFoliage2 = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.80, metalness: 0.08 });
        mc.bollard = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });

        mc.arrowStraight = new THREE.MeshBasicMaterial({
            map: makeArrowTexture('straight'),
            transparent: true,
            opacity: 0.88,
            side: THREE.DoubleSide
        });
        mc.arrowTurn = new THREE.MeshBasicMaterial({
            map: makeArrowTexture('turn'),
            transparent: true,
            opacity: 0.88,
            side: THREE.DoubleSide
        });

        mc.whiteMarking = new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });
        mc.yellowMarking = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
        mc.zebraPad = new THREE.MeshBasicMaterial({ color: 0x090c12, side: THREE.DoubleSide });

        mc.lightPool = new THREE.MeshBasicMaterial({
            map: poolTexture,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        mc.headlightBeam = new THREE.MeshBasicMaterial({
            map: beamTexture,
            transparent: true,
            opacity: 0.60,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        // Vehicle Shared Common Materials (High-Gloss Automotive Finish)
        mc.rubberTire = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.90 });
        mc.alloyRim = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.88 });
        mc.glassTinted = new THREE.MeshStandardMaterial({
            color: 0x060c16,
            roughness: 0.08,
            metalness: 0.95,
            transparent: true,
            opacity: 0.88
        });
        mc.chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.96 });
        mc.plasticDark = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.70 });

        // Glowing Lights (Intense LED Emitters)
        mc.warmHeadlight = new THREE.MeshStandardMaterial({
            color: 0xfff6cf,
            emissive: 0xffe48a,
            emissiveIntensity: 5.5
        });

        mc.taillightRed = new THREE.MeshStandardMaterial({
            color: 0x330000,
            emissive: 0xff0025,
            emissiveIntensity: 4.2
        });

        mc.strobeRed = new THREE.MeshStandardMaterial({ color: 0xff0025, emissive: 0xff0025, emissiveIntensity: 5.0 });
        mc.strobeBlue = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x0077ff, emissiveIntensity: 5.0 });

        mc.autoCanopy = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.12 });
        mc.autoGreen = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.40, metalness: 0.30 });

        // Geometries
        gc.wheelSmall = new THREE.CylinderGeometry(0.26, 0.26, 0.15, 14);
        gc.wheelSmall.rotateZ(Math.PI / 2);

        gc.wheelStandard = new THREE.CylinderGeometry(0.34, 0.34, 0.20, 16);
        gc.wheelStandard.rotateZ(Math.PI / 2);

        gc.wheelHeavy = new THREE.CylinderGeometry(0.48, 0.48, 0.26, 16);
        gc.wheelHeavy.rotateZ(Math.PI / 2);
    }

    // ==========================================
    // 3. LIGHTING SYSTEM (CINEMATIC MOONLIGHT & ACCENT FILL)
    // ==========================================
    setupLighting() {
        this.lightsGroup = new THREE.Group();
        this.scene.add(this.lightsGroup);

        this.ambientLight = new THREE.AmbientLight(0x22354c, 1.25);
        this.lightsGroup.add(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0x426896, 0x0a1018, 0.90);
        this.lightsGroup.add(this.hemiLight);

        // Primary Directional Light (Moonlight & High-Detail Soft Shadows)
        this.dirLight = new THREE.DirectionalLight(0xb4d4f8, 1.45);
        this.dirLight.position.set(100, 175, 80);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 420;
        const b = 150;
        this.dirLight.shadow.camera.left = -b;
        this.dirLight.shadow.camera.right = b;
        this.dirLight.shadow.camera.top = b;
        this.dirLight.shadow.camera.bottom = -b;
        this.dirLight.shadow.bias = -0.0006;
        this.dirLight.shadow.normalBias = 0.02;
        this.lightsGroup.add(this.dirLight);

        // Subtle Secondary Rim Light (Brings out architectural contours & vehicle silhouettes)
        const fillLight = new THREE.DirectionalLight(0x355075, 0.55);
        fillLight.position.set(-110, 95, -85);
        this.lightsGroup.add(fillLight);
    }

    setQualityPreset(preset = 'high') {
        this.qualityPreset = 'high';
        if (!this.renderer) return;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        if (this.dirLight) {
            this.dirLight.castShadow = true;
            this.dirLight.shadow.mapSize.set(2048, 2048);
        }
        this.renderer.shadowMap.needsUpdate = true;
    }

    createGroundGrid() {
        const groundGeo = new THREE.PlaneGeometry(2400, 2400);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x090d16,
            roughness: 0.88,
            metalness: 0.15,
            map: this.sharedTextures.groundGrid || null
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.25;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    createSelectionRing() {
        const ringGeo = new THREE.RingGeometry(2.8, 3.4, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
        this.selectionRing.rotation.x = -Math.PI / 2;
        this.selectionRing.position.y = 0.15;
        this.selectionRing.visible = false;
        this.scene.add(this.selectionRing);
    }

    latLngTo3D(lat, lng, yElevation = 0) {
        const cosLat = Math.cos(this.centerLat * Math.PI / 180.0);
        const x = (lng - this.centerLng) * 111320.0 * cosLat;
        const z = -(lat - this.centerLat) * 110540.0;
        return new THREE.Vector3(x, yElevation, z);
    }

    // ==========================================
    // 4. MAP-DRIVEN HOTSPOT LOADER
    // ==========================================
    loadHotspot(hotspot) {
        if (!hotspot) return;
        if (this.currentHotspot && this.currentHotspot.id === hotspot.id && this.roadMeshes.length > 0) {
            return;
        }
        this.currentHotspot = hotspot;
        this.centerLat = hotspot.lat;
        this.centerLng = hotspot.lng;

        this.clearHotspotAssets();

        // 1. Procedurally generate road network following authentic OpenStreetMap corridor waypoints
        this.buildRoadNetworkFromMap(hotspot.corridors || [], hotspot.nodes || []);

        // 2. Procedurally generate junction plazas, IRC yellow conflict boxes & crosswalks
        this.buildJunctionPlazasAndCrosswalks(hotspot.nodes || [], hotspot.corridors || []);

        // 3. Continuous Elevated Expressway Viaduct for Silk Board
        if (hotspot.id === 'bengaluru_silkboard') {
            this.buildSilkBoardFlyover(hotspot.nodes || []);
        }

        // 4. Build distant skyline
        this.buildNightSkyline();

        // 5. Focus camera on primary junction
        this.setCameraPreset('junction');

        console.log(`🗺️ [Traffic3D] Loaded Authentic Map-Driven Infrastructure for ${hotspot.name} (${hotspot.city})`);
    }

    clearHotspotAssets() {
        this.roadMeshes.forEach(mesh => this.scene.remove(mesh));
        this.roadMeshes = [];

        this.flyoverMeshes.forEach(mesh => this.scene.remove(mesh));
        this.flyoverMeshes = [];

        this.signalGantries.forEach(gantry => this.scene.remove(gantry.group));
        this.signalGantries.clear();

        this.buildingMeshes.forEach(b => this.scene.remove(b));
        this.buildingMeshes = [];
        this.blinkingBeacons = [];

        this.streetLights.forEach(l => this.scene.remove(l));
        this.streetLights = [];

        this.lightPools.forEach(p => this.scene.remove(p));
        this.lightPools = [];

        this.vehicleMeshes.forEach(v => this.scene.remove(v.group));
        this.vehicleMeshes.clear();
    }

    // =========================================================================
    // 5. MAP-DRIVEN ROAD NETWORK (PARSING REAL OSM WAYPOINTS)
    // =========================================================================
    buildRoadNetworkFromMap(corridors, nodes = []) {
        const mc = this.matCache;
        const laneWidth = 3.6;     // Standard IRC lane width in meters
        const medianOffset = 1.2;  // Clearance from road centerline to inner lane edge

        corridors.forEach(corridor => {
            const waypoints = corridor.waypoints;
            if (!waypoints || waypoints.length < 2) return;

            const lanes = corridor.lanes || 3;
            // Carriageway asphalt width: lanes * 3.6m + 1.2m shoulder margin
            const carriageWidth = (lanes * laneWidth) + 1.2;
            const carriageCenterOffset = medianOffset + (carriageWidth / 2);

            // Convert all OSM lat/lng waypoints to 3D Cartesian coordinates
            const points3D = waypoints.map(pt => this.latLngTo3D(pt[0], pt[1], 0.05));

            for (let i = 0; i < points3D.length - 1; i++) {
                const p1 = points3D[i];
                const p2 = points3D[i + 1];

                const dir = new THREE.Vector3().subVectors(p2, p1);
                const segLen = dir.length();
                if (segLen < 0.5) continue;

                const angle = Math.atan2(dir.x, dir.z);
                const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

                // Perpendicular unit vector to the left (Left-Hand Traffic Carriageway)
                const leftNorm = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

                // 1. Directional Carriageway Asphalt Deck
                const carriageCenter = mid.clone().add(leftNorm.clone().multiplyScalar(carriageCenterOffset));
                const roadGeo = new THREE.PlaneGeometry(carriageWidth, segLen);
                const roadMesh = new THREE.Mesh(roadGeo, mc.asphalt);
                roadMesh.rotation.x = -Math.PI / 2;
                roadMesh.rotation.z = -angle;
                roadMesh.position.set(carriageCenter.x, 0.05, carriageCenter.z);
                roadMesh.receiveShadow = true;
                this.scene.add(roadMesh);
                this.roadMeshes.push(roadMesh);

                // 2. Yellow Median Boundary Line
                const yellowGeo = new THREE.PlaneGeometry(0.30, segLen);
                const yellowMesh = new THREE.Mesh(yellowGeo, mc.yellowMarking);
                yellowMesh.rotation.x = -Math.PI / 2;
                yellowMesh.rotation.z = -angle;
                const yellowPos = mid.clone().add(leftNorm.clone().multiplyScalar(medianOffset - 0.15));
                yellowMesh.position.set(yellowPos.x, 0.07, yellowPos.z);
                this.scene.add(yellowMesh);
                this.roadMeshes.push(yellowMesh);

                // 3. Dashed White Lane Dividers
                for (let l = 1; l < lanes; l++) {
                    const lOffset = medianOffset + (l * laneWidth);
                    const dashCount = Math.max(1, Math.floor(segLen / 7.2));
                    
                    for (let d = 0; d < dashCount; d++) {
                        const t = (d + 0.5) / dashCount;
                        const dashCenter = new THREE.Vector3().lerpVectors(p1, p2, t)
                            .add(leftNorm.clone().multiplyScalar(lOffset));
                        
                        const dashGeo = new THREE.PlaneGeometry(0.22, 3.6);
                        const dashMesh = new THREE.Mesh(dashGeo, mc.whiteMarking);
                        dashMesh.rotation.x = -Math.PI / 2;
                        dashMesh.rotation.z = -angle;
                        dashMesh.position.set(dashCenter.x, 0.07, dashCenter.z);
                        this.scene.add(dashMesh);
                        this.roadMeshes.push(dashMesh);
                    }
                }

                // 4. Solid White Shoulder Line (Outer Carriageway Border)
                const shoulderOffset = medianOffset + (lanes * laneWidth);
                const shoulderGeo = new THREE.PlaneGeometry(0.24, segLen);
                const shoulderMesh = new THREE.Mesh(shoulderGeo, mc.whiteMarking);
                shoulderMesh.rotation.x = -Math.PI / 2;
                shoulderMesh.rotation.z = -angle;
                const shoulderPos = mid.clone().add(leftNorm.clone().multiplyScalar(shoulderOffset));
                shoulderMesh.position.set(shoulderPos.x, 0.07, shoulderPos.z);
                this.scene.add(shoulderMesh);
                this.roadMeshes.push(shoulderMesh);

                // 5. Concrete Curb & Elevated Sidewalk along Outer Roadway Edge
                const totalRoadEdge = medianOffset + carriageWidth;
                const sidewalkWidth = 4.0;

                const curbGeo = new THREE.BoxGeometry(0.44, 0.30, segLen);
                const curbMesh = new THREE.Mesh(curbGeo, mc.curb);
                curbMesh.rotation.y = angle;
                const curbPos = mid.clone().add(leftNorm.clone().multiplyScalar(totalRoadEdge + 0.22));
                curbMesh.position.set(curbPos.x, 0.15, curbPos.z);
                this.scene.add(curbMesh);
                this.roadMeshes.push(curbMesh);

                const walkGeo = new THREE.BoxGeometry(sidewalkWidth, 0.22, segLen);
                const walkMesh = new THREE.Mesh(walkGeo, mc.sidewalk);
                walkMesh.rotation.y = angle;
                const walkPos = mid.clone().add(leftNorm.clone().multiplyScalar(totalRoadEdge + 0.44 + sidewalkWidth / 2));
                walkMesh.position.set(walkPos.x, 0.11, walkPos.z);
                walkMesh.receiveShadow = true;
                this.scene.add(walkMesh);
                this.roadMeshes.push(walkMesh);

                // 6. Street Lamps along outer sidewalk (Placed safely on sidewalk, facing road)
                if (segLen > 28) {
                    const lampCount = Math.floor(segLen / 38);
                    for (let lc = 0; lc < lampCount; lc++) {
                        const t = (lc + 0.5) / lampCount;
                        const lampBase = new THREE.Vector3().lerpVectors(p1, p2, t);
                        const polePos = lampBase.clone().add(leftNorm.clone().multiplyScalar(totalRoadEdge + 1.8));

                        const nearJunction = nodes.some(n => {
                            const nPos = this.latLngTo3D(n.lat, n.lng);
                            return polePos.distanceTo(nPos) < 32.0;
                        });
                        if (nearJunction) continue;

                        this.createStreetLamp(polePos, lampBase, leftNorm);
                    }
                }
            }
        });
    }

    // =========================================================================
    // 6. PROCEDURAL JUNCTION PLAZAS, IRC YELLOW BOX & CROSSWALKS
    // =========================================================================
    buildJunctionPlazasAndCrosswalks(nodes, corridors) {
        const mc = this.matCache;

        nodes.forEach(node => {
            const center3D = this.latLngTo3D(node.lat, node.lng, 0.05);
            const lanes = node.lanes || 4;
            const plazaRadius = Math.max(20, lanes * 5.2);

            // 1. Central Junction Core Apron (Matte dark asphalt plane seamlessly connecting road approaches)
            const boxSize = plazaRadius * 1.45;
            const plazaGeo = new THREE.PlaneGeometry(boxSize, boxSize);
            const plazaMesh = new THREE.Mesh(plazaGeo, mc.asphalt);
            plazaMesh.rotation.x = -Math.PI / 2;
            plazaMesh.position.set(center3D.x, 0.05, center3D.z);
            plazaMesh.receiveShadow = true;
            this.scene.add(plazaMesh);
            this.roadMeshes.push(plazaMesh);

            // 2. IRC Standard Yellow Box Junction Marking
            if (node.type === "signalized") {
                const boxSize = plazaRadius * 1.35;
                const yellowBoxGroup = new THREE.Group();
                yellowBoxGroup.position.set(center3D.x, 0.065, center3D.z);

                const borderMat = mc.yellowMarking;
                const bTop = new THREE.Mesh(new THREE.PlaneGeometry(boxSize, 0.40), borderMat);
                bTop.rotation.x = -Math.PI / 2;
                bTop.position.set(0, 0, -boxSize / 2);
                yellowBoxGroup.add(bTop);

                const bBot = new THREE.Mesh(new THREE.PlaneGeometry(boxSize, 0.40), borderMat);
                bBot.rotation.x = -Math.PI / 2;
                bBot.position.set(0, 0, boxSize / 2);
                yellowBoxGroup.add(bBot);

                const bLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.40, boxSize), borderMat);
                bLeft.rotation.x = -Math.PI / 2;
                bLeft.position.set(-boxSize / 2, 0, 0);
                yellowBoxGroup.add(bLeft);

                const bRight = new THREE.Mesh(new THREE.PlaneGeometry(0.40, boxSize), borderMat);
                bRight.rotation.x = -Math.PI / 2;
                bRight.position.set(boxSize / 2, 0, 0);
                yellowBoxGroup.add(bRight);

                const stripeSpacing = 2.4;
                for (let s = -boxSize * 0.7; s <= boxSize * 0.7; s += stripeSpacing) {
                    const stripeLen = Math.min(boxSize * 1.35, Math.max(3.0, (boxSize * 0.9 - Math.abs(s)) * 1.9));
                    const diagStripe = new THREE.Mesh(new THREE.PlaneGeometry(0.25, stripeLen), borderMat);
                    diagStripe.rotation.x = -Math.PI / 2;
                    diagStripe.rotation.z = Math.PI / 4;
                    diagStripe.position.set(s, 0, 0);
                    yellowBoxGroup.add(diagStripe);
                }
                this.scene.add(yellowBoxGroup);
                this.roadMeshes.push(yellowBoxGroup);
            }

            // 3. Full-Width Zebra Crossings & Overhead Signal Gantries
            const processedBearings = [];
            const connectedCorridors = corridors.filter(c => c.to === node.id || c.from === node.id);

            connectedCorridors.forEach(c => {
                const waypoints = c.waypoints;
                if (!waypoints || waypoints.length < 2) return;

                const isIncoming = (c.to === node.id);
                const w1 = isIncoming ? waypoints[waypoints.length - 2] : waypoints[0];
                const w2 = isIncoming ? waypoints[waypoints.length - 1] : waypoints[1];

                const p1 = this.latLngTo3D(w1[0], w1[1]);
                const p2 = this.latLngTo3D(w2[0], w2[1]);

                const outDir = isIncoming
                    ? new THREE.Vector3().subVectors(p1, p2).normalize()
                    : new THREE.Vector3().subVectors(p2, p1).normalize();

                if (outDir.lengthSq() < 0.1) return;

                const rawBearing = Math.atan2(outDir.x, outDir.z);

                const alreadyHandled = processedBearings.some(b => {
                    let diff = Math.abs(b - rawBearing);
                    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
                    return diff < 0.40;
                });
                if (alreadyHandled) return;
                processedBearings.push(rawBearing);

                const cLanes = c.lanes || 4;
                const fullRoadWidth = (cLanes * 3.6 + 1.2) * 2 + 1.6;

                const crossDist = plazaRadius + 4.5;
                const crossCenter = center3D.clone().add(outDir.clone().multiplyScalar(crossDist));
                const crossingAngle = Math.atan2(outDir.x, outDir.z);

                this.createFullWidthZebraCrossing(
                    crossCenter.x,
                    crossCenter.z,
                    fullRoadWidth,
                    5.5,
                    crossingAngle
                );

                if (node.type === "signalized") {
                    this.createSignalGantry(crossCenter.x, crossCenter.z, crossingAngle, `${node.id}_${c.id}`, fullRoadWidth, c.name || 'JUNCTION CORRIDOR');
                }
            });
        });
    }

    // =========================================================================
    // 6b. SILK BOARD CONTINUOUS ELEVATED VIADUCT FLYOVER
    // =========================================================================
    buildSilkBoardFlyover(nodes = []) {
        let focalCenter = new THREE.Vector3(0, 0, 0);
        if (nodes && nodes.length > 0) {
            focalCenter = this.latLngTo3D(nodes[0].lat, nodes[0].lng, 0);
        }

        const flyoverPiersZ = [-320, -260, -200, -140, -80, 80, 140, 200, 260, 320];
        const pierMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.3 });
        const flyDeckMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.2 });
        const parapetMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 });
        const barrierMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.4 });

        flyoverPiersZ.forEach(pz => {
            const pierPos = focalCenter.clone().add(new THREE.Vector3(0, 0, pz));
            const col = new THREE.Mesh(new THREE.BoxGeometry(2.4, 11.2, 2.4), pierMat);
            col.position.set(pierPos.x, 5.6, pierPos.z);
            col.castShadow = true;
            this.scene.add(col);
            this.flyoverMeshes.push(col);

            const beam = new THREE.Mesh(new THREE.BoxGeometry(15.2, 1.4, 3.2), pierMat);
            beam.position.set(pierPos.x, 11.7, pierPos.z);
            beam.castShadow = true;
            this.scene.add(beam);
            this.flyoverMeshes.push(beam);
        });

        // Continuous uninterrupted 680m elevated expressway deck at y = 12.8m spanning across the corridor
        const totalFlyoverLen = 680.0;
        const deck = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.85, totalFlyoverLen), flyDeckMat);
        deck.position.set(focalCenter.x, 12.8, focalCenter.z);
        deck.castShadow = true;
        deck.receiveShadow = true;
        this.scene.add(deck);
        this.flyoverMeshes.push(deck);

        // Center Jersey Barrier Divider on Flyover
        const medianFly = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, totalFlyoverLen), barrierMat);
        medianFly.position.set(focalCenter.x, 13.65, focalCenter.z);
        this.scene.add(medianFly);
        this.flyoverMeshes.push(medianFly);

        // Continuous Outer Safety Parapet Barriers with Hazard Reflectors
        [-7.1, 7.1].forEach(px => {
            const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.25, totalFlyoverLen), parapetMat);
            parapet.position.set(focalCenter.x + px, 13.85, focalCenter.z);
            this.scene.add(parapet);
            this.flyoverMeshes.push(parapet);
        });

        // Flyover Lane Markings
        [-3.6, 3.6].forEach(flyLaneOffset => {
            const flyDashSpacing = 8.0;
            const flyDashCount = Math.floor(totalFlyoverLen / flyDashSpacing);
            for (let d = 0; d < flyDashCount; d++) {
                const zPos = -totalFlyoverLen / 2 + (d + 0.5) * flyDashSpacing;
                const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 4.0), this.matCache.whiteMarking);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(focalCenter.x + flyLaneOffset, 13.25, focalCenter.z + zPos);
                this.scene.add(dash);
                this.flyoverMeshes.push(dash);
            }
        });
    }

    // =========================================================================
    // 7. FULL-WIDTH HIGH-CONTRAST ZEBRA CROSSING (CURB-TO-CURB COVERAGE)
    // =========================================================================
    createFullWidthZebraCrossing(centerX, centerZ, width, depth, angle) {
        const mc = this.matCache;
        const group = new THREE.Group();
        group.position.set(centerX, 0.07, centerZ);
        group.rotation.y = angle;

        // 1. Dark asphalt high-contrast underlay pad covering 100% of the road deck
        const padGeo = new THREE.PlaneGeometry(width + 0.8, depth + 0.8);
        const padMesh = new THREE.Mesh(padGeo, mc.zebraPad);
        padMesh.rotation.x = -Math.PI / 2;
        group.add(padMesh);

        // 2. Bold thermoplastic white stripes across the ENTIRE road width from left curb to right curb
        const stripeWidth = 0.65;
        const spacing = 1.30;
        const count = Math.floor(width / spacing);
        const startX = -(count - 1) * spacing / 2;

        for (let i = 0; i < count; i++) {
            const stripeGeo = new THREE.PlaneGeometry(stripeWidth, depth);
            const stripeMesh = new THREE.Mesh(stripeGeo, mc.whiteMarking);
            stripeMesh.rotation.x = -Math.PI / 2;
            stripeMesh.position.set(startX + (i * spacing), 0.02, 0);
            group.add(stripeMesh);
        }

        // 3. Transversal Solid Stop Line 2.0m before zebra crossing
        const stopLineGeo = new THREE.PlaneGeometry(width, 0.60);
        const stopLineMesh = new THREE.Mesh(stopLineGeo, mc.whiteMarking);
        stopLineMesh.rotation.x = -Math.PI / 2;
        stopLineMesh.position.set(0, 0.02, (depth / 2) + 2.0);
        group.add(stopLineMesh);

        // 4. Stainless steel pedestrian safety bollards with hazard rings at curb corners
        const bollardGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.95, 10);
        const b1 = new THREE.Mesh(bollardGeo, mc.bollard);
        b1.position.set(-width / 2 - 0.6, 0.47, 0);
        group.add(b1);
        const b2 = new THREE.Mesh(bollardGeo, mc.bollard);
        b2.position.set(width / 2 + 0.6, 0.47, 0);
        group.add(b2);

        this.scene.add(group);
        this.roadMeshes.push(group);
    }

    // =========================================================================
    // 8. TALL STREET LIGHTS (STRICTLY OUTSIDE ROAD ON SIDEWALK, ARM FACING ROAD)
    // =========================================================================
    createStreetLamp(polePos, roadCenterPos, leftNorm) {
        const group = new THREE.Group();
        group.position.set(polePos.x, 0, polePos.z);

        // Inward direction pointing from the sidewalk toward the road center
        const inwardDir = leftNorm.clone().negate().normalize();
        const armAngle = Math.atan2(inwardDir.x, inwardDir.z);
        group.rotation.y = armAngle;

        const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });

        // Slender tall pole (securely planted on the sidewalk)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 9.5, 8), poleMat);
        pole.position.y = 4.75;
        group.add(pole);

        // Cantilever arm reaching toward the road (along local +Z)
        const armLen = 2.4;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, armLen), poleMat);
        arm.position.set(0, 9.3, armLen / 2);
        group.add(arm);

        // Warm Golden Glowing Lamp Head hanging over the curb/outer road lane
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xfff0c2,
            emissive: 0xffe28a,
            emissiveIntensity: 3.5
        });
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.4), headMat);
        head.position.set(0, 9.2, armLen - 0.2);
        group.add(head);

        this.scene.add(group);
        this.streetLights.push(group);

        // Soft Warm Downward Light Pool on the asphalt road surface (directly under the lantern head!)
        const headWorldPos = new THREE.Vector3().copy(polePos).add(inwardDir.clone().multiplyScalar(armLen));
        const poolGeo = new THREE.PlaneGeometry(9.0, 9.0);
        const poolMesh = new THREE.Mesh(poolGeo, this.matCache.lightPool);
        poolMesh.rotation.x = -Math.PI / 2;
        poolMesh.position.set(headWorldPos.x, 0.06, headWorldPos.z);
        this.scene.add(poolMesh);
        this.lightPools.push(poolMesh);
    }

    // =========================================================================
    // 8b. ROADSIDE LANDSCAPING TREES (URBAN ARTERIAL BOULEVARD)
    // =========================================================================
    createRoadsideTree(x, z, scale = 1.0) {
        const mc = this.matCache;
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Tapered bark trunk
        const trunkGeo = new THREE.CylinderGeometry(0.20 * scale, 0.32 * scale, 3.8 * scale, 7);
        const trunk = new THREE.Mesh(trunkGeo, mc.treeTrunk);
        trunk.position.y = 1.9 * scale;
        trunk.castShadow = true;
        group.add(trunk);

        // Tiered lush foliage
        const foliageMat = Math.random() > 0.5 ? mc.treeFoliage1 : mc.treeFoliage2;

        const t1Geo = new THREE.DodecahedronGeometry(2.1 * scale, 1);
        const t1 = new THREE.Mesh(t1Geo, foliageMat);
        t1.position.y = 4.2 * scale;
        t1.scale.set(1.1, 0.85, 1.1);
        t1.castShadow = true;
        group.add(t1);

        const t2Geo = new THREE.DodecahedronGeometry(1.5 * scale, 1);
        const t2 = new THREE.Mesh(t2Geo, mc.treeFoliage1);
        t2.position.y = 5.6 * scale;
        t2.scale.set(0.95, 0.8, 0.95);
        t2.castShadow = true;
        group.add(t2);

        // Sidewalk planter base ring
        const planterGeo = new THREE.RingGeometry(0.35 * scale, 0.85 * scale, 16);
        const planter = new THREE.Mesh(planterGeo, mc.medianPlanter);
        planter.rotation.x = -Math.PI / 2;
        planter.position.y = 0.23;
        group.add(planter);

        this.scene.add(group);
        this.roadMeshes.push(group);
    }

    // =========================================================================
    // 9. OVERHEAD TRAFFIC SIGNAL GANTRIES (OUTER SHOULDER MOUNTED)
    // =========================================================================
    createSignalGantry(x, z, angle, nodeId, roadWidth = 24.0, signText = 'JUNCTION CORRIDOR') {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = angle;

        const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.35 });

        // Place support post on the outer curbside shoulder
        const shoulderOffset = (roadWidth / 2) + 1.4;

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 10.5, 10), frameMat);
        post.position.set(shoulderOffset, 5.25, 0);
        group.add(post);

        // Overhead arm extending inward over the incoming lanes
        const armLen = (roadWidth / 2) + 2.0;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.45, 0.45), frameMat);
        arm.position.set(shoulderOffset - (armLen / 2), 10.2, 0);
        group.add(arm);

        // Highway Direction Signboard on the overhead gantry
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256;
        signCanvas.height = 64;
        const sctx = signCanvas.getContext('2d');
        sctx.fillStyle = '#047857';
        sctx.fillRect(0, 0, 256, 64);
        sctx.strokeStyle = '#ffffff';
        sctx.lineWidth = 4;
        sctx.strokeRect(4, 4, 248, 56);
        sctx.fillStyle = '#ffffff';
        sctx.font = 'bold 16px sans-serif';
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.fillText(signText || 'JUNCTION CORRIDOR', 128, 24);
        sctx.font = '12px sans-serif';
        sctx.fillText('◀ ARTERIAL FLOW ▶', 128, 44);
        const signTex = new THREE.CanvasTexture(signCanvas);

        const signGeo = new THREE.PlaneGeometry(6.5, 1.8);
        const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
        const signMesh = new THREE.Mesh(signGeo, signMat);
        signMesh.position.set(shoulderOffset - (armLen * 0.22), 10.2, 0.28);
        group.add(signMesh);

        // Signal Box centered over the incoming carriageway
        const boxX = shoulderOffset - (armLen * 0.52);
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 0.75), new THREE.MeshStandardMaterial({ color: 0x090c12, roughness: 0.5 }));
        box.position.set(boxX, 9.2, 0);
        group.add(box);

        // Signal Bulbs
        const bulbGeo = new THREE.SphereGeometry(0.36, 12, 12);

        const redMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0022, emissiveIntensity: 0.2 });
        const redBulb = new THREE.Mesh(bulbGeo, redMat);
        redBulb.position.set(boxX, 10.0, 0.40);
        group.add(redBulb);

        const yellowMat = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffb700, emissiveIntensity: 0.2 });
        const yellowBulb = new THREE.Mesh(bulbGeo, yellowMat);
        yellowBulb.position.set(boxX, 9.2, 0.40);
        group.add(yellowBulb);

        const greenMat = new THREE.MeshStandardMaterial({ color: 0x003311, emissive: 0x00ff88, emissiveIntensity: 3.8 });
        const greenBulb = new THREE.Mesh(bulbGeo, greenMat);
        greenBulb.position.set(boxX, 8.4, 0.40);
        group.add(greenBulb);

        const pointLight = new THREE.PointLight(0x00ff88, 1.4, 22);
        pointLight.position.set(boxX, 8.4, 1.5);
        group.add(pointLight);

        this.scene.add(group);
        this.signalGantries.set(`${nodeId}_${Math.round(x)}_${Math.round(z)}`, {
            group: group,
            nodeId: nodeId,
            lights: { red: redBulb, yellow: yellowBulb, green: greenBulb },
            pointLight: pointLight
        });
    }

    // =========================================================================
    // 10. DISTANT CITY SKYLINE (CLEAN HORIZON, ZERO ROAD/JUNCTION OVERLAP)
    // =========================================================================
    buildNightSkyline() {
        this.blinkingBeacons = [];
        const mats = this.sharedTextures.buildingMaterials;
        const corridors = this.currentHotspot ? (this.currentHotspot.corridors || []) : [];
        const nodes = this.currentHotspot ? (this.currentHotspot.nodes || []) : [];

        // Pre-convert corridor waypoint segments to 3D for fast distance checks
        const corridorSegments3D = [];
        corridors.forEach(c => {
            if (!c.waypoints) return;
            const pts = c.waypoints.map(pt => this.latLngTo3D(pt[0], pt[1]));
            for (let i = 0; i < pts.length - 1; i++) {
                corridorSegments3D.push({ p1: pts[i], p2: pts[i + 1] });
            }
        });
        const nodes3D = nodes.map(n => this.latLngTo3D(n.lat, n.lng));

        const distToSegment = (px, pz, x1, z1, x2, z2) => {
            const dx = x2 - x1;
            const dz = z2 - z1;
            const l2 = dx * dx + dz * dz;
            if (l2 < 0.01) return Math.hypot(px - x1, pz - z1);
            let t = ((px - x1) * dx + (pz - z1) * dz) / l2;
            t = Math.max(0, Math.min(1, t));
            return Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz));
        };

        const targetCount = 20; // Clean, non-intrusive skyline; all unneeded clutter removed
        let placed = 0;
        let attempts = 0;

        while (placed < targetCount && attempts < 140) {
            attempts++;
            const angle = (placed / targetCount) * Math.PI * 2 + (Math.sin(attempts) * 0.12);
            // Place strictly on distant perimeter (350m to 580m) well beyond junction operations
            const dist = 350 + ((attempts * 47) % 230);
            const bx = Math.cos(angle) * dist;
            const bz = Math.sin(angle) * dist;

            // Reject if anywhere near any road corridor (minimum 90m buffer)
            const tooCloseToRoad = corridorSegments3D.some(seg => {
                return distToSegment(bx, bz, seg.p1.x, seg.p1.z, seg.p2.x, seg.p2.z) < 90;
            });
            if (tooCloseToRoad) continue;

            // Reject if near any junction node (minimum 140m buffer)
            const tooCloseToNode = nodes3D.some(n => Math.hypot(bx - n.x, bz - n.z) < 140);
            if (tooCloseToNode) continue;

            const width = 24 + (attempts % 22);
            const depth = 24 + ((attempts * 5) % 22);
            const height = 38 + ((attempts * 11) % 85);

            const bGroup = new THREE.Group();
            bGroup.position.set(bx, 0, bz);

            const bGeo = new THREE.BoxGeometry(width, height, depth);
            const bMat = (mats && mats.length > 0) ? mats[placed % mats.length] : new THREE.MeshStandardMaterial({ color: 0x080c14, roughness: 0.4 });
            const bMesh = new THREE.Mesh(bGeo, bMat);
            bMesh.position.y = height / 2;
            bMesh.receiveShadow = true;
            bGroup.add(bMesh);

            // Architectural Rooftop Spire & Pulsing Aviation Beacon for high-rise towers
            if (height > 62) {
                const roofGeo = new THREE.BoxGeometry(width * 0.65, 3.5, depth * 0.65);
                const roofMesh = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x141d2b, roughness: 0.5 }));
                roofMesh.position.y = height + 1.75;
                bGroup.add(roofMesh);

                const spireHeight = 10 + (attempts % 12);
                const spireGeo = new THREE.CylinderGeometry(0.12, 0.45, spireHeight, 6);
                const spireMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
                const spireMesh = new THREE.Mesh(spireGeo, spireMat);
                spireMesh.position.y = height + 3.5 + spireHeight / 2;
                bGroup.add(spireMesh);

                const beaconGeo = new THREE.SphereGeometry(0.55, 8, 8);
                const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
                const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
                beaconMesh.position.y = height + 3.5 + spireHeight;
                bGroup.add(beaconMesh);

                this.blinkingBeacons.push({
                    mat: beaconMat,
                    phase: Math.random() * Math.PI * 2
                });
            }

            this.scene.add(bGroup);
            this.buildingMeshes.push(bGroup);
            placed++;
        }
    }

    // =========================================================================
    // 11. HIGH-FIDELITY VEHICLE MODELS (+Z IS STRICTLY FORWARD)
    // Headlights at +Z, Taillights at -Z. ZERO BACKWARD MOVEMENT.
    // =========================================================================
    createVehicleModel(type, colorHex) {
        const mc = this.matCache;
        const gc = this.geoCache;
        const group = new THREE.Group();
        const baseColor = new THREE.Color(colorHex || 0x0070f3);

        // High-Gloss Metallic Automotive Lacquer Finish
        const paintMat = new THREE.MeshStandardMaterial({
            color: baseColor,
            metalness: 0.78,
            roughness: 0.22
        });

        if (type === 'two_wheeler') {
            // 🏍️ Two-Wheeler
            const bike = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.60, 2.0), paintMat);
            bike.position.y = 0.52;
            group.add(bike);

            // Front Fork (+Z)
            const fork = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.7, 0.12), mc.chrome);
            fork.rotation.x = 0.25;
            fork.position.set(0, 0.75, 0.75);
            group.add(fork);

            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.10), mc.plasticDark);
            bar.position.set(0, 1.05, 0.65);
            group.add(bar);

            // Wheels: Front (+Z), Rear (-Z)
            const fw = new THREE.Mesh(gc.wheelSmall, mc.rubberTire);
            fw.position.set(0, 0.26, 0.75);
            group.add(fw);

            const rw = new THREE.Mesh(gc.wheelSmall, mc.rubberTire);
            rw.position.set(0, 0.26, -0.75);
            group.add(rw);

            // Front Headlight (+Z)
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.08), mc.warmHeadlight);
            hl.position.set(0, 0.75, 1.02);
            group.add(hl);

            // Forward Light Projection Beam (+Z)
            const fwdBeam = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 5.5), mc.headlightBeam);
            fwdBeam.rotation.x = -Math.PI / 2;
            fwdBeam.position.set(0, 0.02, 3.2);
            group.add(fwdBeam);

            // Rear Taillight (-Z)
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), mc.taillightRed);
            tl.position.set(0, 0.75, -1.02);
            group.add(tl);

        } else if (type === 'auto_rickshaw') {
            // 🛺 Iconic Indian Auto Rickshaw
            const lower = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.65, 2.6), mc.autoGreen);
            lower.position.y = 0.52;
            group.add(lower);

            // Yellow Canopy (+Z is front)
            const roof = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.75, 2.3), mc.autoCanopy);
            roof.position.y = 1.22;
            group.add(roof);

            // Wheels: 1 front wheel (+Z), 2 rear wheels (-Z)
            const fw = new THREE.Mesh(gc.wheelSmall, mc.rubberTire);
            fw.position.set(0, 0.26, 1.05);
            group.add(fw);

            [-0.70, 0.70].forEach(x => {
                const rw = new THREE.Mesh(gc.wheelSmall, mc.rubberTire);
                rw.position.set(x, 0.26, -0.75);
                group.add(rw);
            });

            // Front Headlamp (+Z)
            const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.10, 12), mc.warmHeadlight);
            hl.rotation.x = Math.PI / 2;
            hl.position.set(0, 0.62, 1.32);
            group.add(hl);

            // Forward Light Projection Beam (+Z)
            const fwdBeam = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 6.0), mc.headlightBeam);
            fwdBeam.rotation.x = -Math.PI / 2;
            fwdBeam.position.set(0, 0.02, 3.8);
            group.add(fwdBeam);

            // Rear Taillights (-Z)
            [-0.52, 0.52].forEach(x => {
                const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), mc.taillightRed);
                tl.position.set(x, 0.62, -1.32);
                group.add(tl);
            });

        } else if (type === 'bus') {
            // 🚌 Modern City Transit Bus
            const busLen = 11.6;
            const busW = 2.7;

            const body = new THREE.Mesh(new THREE.BoxGeometry(busW, 2.9, busLen), new THREE.MeshStandardMaterial({
                color: 0xf97316,
                metalness: 0.55,
                roughness: 0.30
            }));
            body.position.y = 1.75;
            group.add(body);

            // Tinted Windows
            const win = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.05, 1.1, busLen - 1.2), mc.glassTinted);
            win.position.y = 2.15;
            group.add(win);

            // Wheels: Front (+Z), Dual Rear (-Z)
            [busLen / 2 - 1.8, -busLen / 2 + 2.6, -busLen / 2 + 1.2].forEach(z => {
                [-busW / 2 - 0.04, busW / 2 + 0.04].forEach(x => {
                    const wheel = new THREE.Mesh(gc.wheelHeavy, mc.rubberTire);
                    wheel.position.set(x, 0.48, z);
                    group.add(wheel);
                });
            });

            // Front Headlights (+Z)
            [-busW / 2 + 0.45, busW / 2 - 0.45].forEach(x => {
                const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.10), mc.warmHeadlight);
                hl.position.set(x, 0.82, busLen / 2 + 0.02);
                group.add(hl);
            });

            // Forward Dual Light Projection Beam (+Z)
            const fwdBeam = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 9.5), mc.headlightBeam);
            fwdBeam.rotation.x = -Math.PI / 2;
            fwdBeam.position.set(0, 0.02, busLen / 2 + 4.5);
            group.add(fwdBeam);

            // Rear Taillights (-Z)
            [-busW / 2 + 0.35, busW / 2 - 0.35].forEach(x => {
                const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.70, 0.10), mc.taillightRed);
                tl.position.set(x, 1.1, -busLen / 2 - 0.02);
                group.add(tl);
            });

        } else if (type === 'ambulance') {
            // 🚑 Priority Ambulance
            const ambLen = 5.4;
            const ambW = 2.2;

            const body = new THREE.Mesh(new THREE.BoxGeometry(ambW, 2.2, ambLen), new THREE.MeshStandardMaterial({
                color: 0xf8fafc,
                metalness: 0.60,
                roughness: 0.25
            }));
            body.position.y = 1.45;
            group.add(body);

            // Emergency Strobes
            const redS = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.35), mc.strobeRed);
            redS.position.set(-0.45, 2.65, 0.6);
            group.add(redS);

            const blueS = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.35), mc.strobeBlue);
            blueS.position.set(0.45, 2.65, 0.6);
            group.add(blueS);

            group.userData.strobes = { red: redS, blue: blueS };

            // Wheels: Front (+Z), Rear (-Z)
            [1.6, -1.6].forEach(z => {
                [-ambW / 2 - 0.04, ambW / 2 + 0.04].forEach(x => {
                    const wheel = new THREE.Mesh(gc.wheelStandard, mc.rubberTire);
                    wheel.position.set(x, 0.34, z);
                    group.add(wheel);
                });
            });

            // Front Headlights (+Z)
            [-0.75, 0.75].forEach(x => {
                const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.1), mc.warmHeadlight);
                hl.position.set(x, 0.72, ambLen / 2 + 0.02);
                group.add(hl);
            });

            // Forward Light Projection Beam (+Z)
            const fwdBeam = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 7.5), mc.headlightBeam);
            fwdBeam.rotation.x = -Math.PI / 2;
            fwdBeam.position.set(0, 0.02, ambLen / 2 + 3.5);
            group.add(fwdBeam);

            // Rear Taillights (-Z)
            [-0.75, 0.75].forEach(x => {
                const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.1), mc.taillightRed);
                tl.position.set(x, 0.72, -ambLen / 2 - 0.02);
                group.add(tl);
            });

        } else {
            // 🚗 Modern Car / Sedan (Front is +Z, Rear is -Z)
            const carLen = 4.6;
            const carW = 1.95;

            // Lower Chassis Body
            const body = new THREE.Mesh(new THREE.BoxGeometry(carW, 0.62, carLen), paintMat);
            body.position.y = 0.55;
            group.add(body);

            // Sloped Cabin
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(carW - 0.28, 0.50, carLen * 0.52), mc.glassTinted);
            cabin.position.set(0, 1.05, -0.15);
            group.add(cabin);

            // Roof
            const roof = new THREE.Mesh(new THREE.BoxGeometry(carW - 0.32, 0.08, carLen * 0.45), paintMat);
            roof.position.set(0, 1.32, -0.15);
            group.add(roof);

            // Wheels: Front (+Z), Rear (-Z)
            [1.35, -1.35].forEach(z => {
                [-carW / 2 - 0.04, carW / 2 + 0.04].forEach(x => {
                    const wheel = new THREE.Mesh(gc.wheelStandard, mc.rubberTire);
                    wheel.position.set(x, 0.34, z);
                    group.add(wheel);
                });
            });

            // FRONT HEADLIGHTS (+Z)
            [-carW / 2 + 0.38, carW / 2 - 0.38].forEach(x => {
                const hlGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 14);
                hlGeo.rotateX(Math.PI / 2);
                const hl = new THREE.Mesh(hlGeo, mc.warmHeadlight);
                hl.position.set(x, 0.56, carLen / 2 + 0.02);
                group.add(hl);
            });

            // Forward Light Projection Glow ahead of the car (+Z)
            const fwdGlowGeo = new THREE.PlaneGeometry(3.6, 7.5);
            const fwdGlow = new THREE.Mesh(fwdGlowGeo, this.matCache.headlightBeam);
            fwdGlow.rotation.x = -Math.PI / 2;
            fwdGlow.position.set(0, 0.02, carLen / 2 + 3.5);
            group.add(fwdGlow);

            // REAR TAILLIGHTS (-Z)
            [-carW / 2 + 0.35, carW / 2 - 0.35].forEach(x => {
                const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), mc.taillightRed);
                tl.position.set(x, 0.58, -carLen / 2 - 0.02);
                group.add(tl);
            });
        }

        // Enable crisp soft shadow casting and receiving on vehicle geometry
        group.traverse(child => {
            if (child.isMesh && child.material !== mc.lightPool && child.material !== mc.headlightBeam) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return group;
    }

    // ==========================================
    // 12. TELEMETRY SYNCHRONIZATION (AUTHENTIC GPS & FORWARD HEADING)
    // ==========================================
    updateTelemetry(state) {
        if (!state) return;

        if (state.hotspot && (!this.currentHotspot || this.currentHotspot.id !== state.hotspot.id)) {
            this.loadHotspot(state.hotspot);
        }

        // 1. Signal States for all gantries in this map
        const signals = state.signals || [];
        if (signals.length > 0) {
            this.setSignalState(signals[0]);
        }

        // 2. Synchronize Vehicles locked strictly to OpenStreetMap corridors & forward heading
        const incomingVehicles = state.vehicles || [];
        const seenIds = new Set();

        incomingVehicles.forEach(veh => {
            seenIds.add(veh.id);
            const targetPos = this.latLngTo3D(veh.lat, veh.lng, 0);

            // Forward orientation:
            // Since model front is +Z:
            // Heading is compass degrees from North clockwise (0=North=-Z, 90=East=+X, 180=South=+Z, 270=West=-X)
            // Vx = sin(heading), Vz = -cos(heading)
            // targetRotY = atan2(Vx, Vz)
            const headingRad = (veh.heading || 0) * (Math.PI / 180.0);
            const vx = Math.sin(headingRad);
            const vz = -Math.cos(headingRad);
            const targetRotY = Math.atan2(vx, vz);

            let vEntry = this.vehicleMeshes.get(veh.id);
            if (!vEntry) {
                const group = this.createVehicleModel(veh.type, veh.color);
                group.position.copy(targetPos);
                group.rotation.y = targetRotY;
                this.scene.add(group);

                vEntry = {
                    group: group,
                    targetPos: targetPos.clone(),
                    targetRotY: targetRotY,
                    speed: veh.speed_kmh || 0,
                    type: veh.type,
                    data: veh
                };
                this.vehicleMeshes.set(veh.id, vEntry);
            } else {
                vEntry.targetPos.copy(targetPos);
                vEntry.targetRotY = targetRotY;
                vEntry.speed = veh.speed_kmh || 0;
                vEntry.data = veh;
            }
        });

        // Clean up cleared vehicles (keeping local surges or emergency ambulances until reset)
        for (const [id, vEntry] of this.vehicleMeshes.entries()) {
            if (!seenIds.has(id)) {
                if (id.startsWith('SURGE-') || id.startsWith('AMB-')) {
                    continue;
                }
                this.scene.remove(vEntry.group);
                this.vehicleMeshes.delete(id);
                if (this.selectedVehicleId === id) {
                    this.selectedVehicleId = null;
                    if (this.selectionRing) this.selectionRing.visible = false;
                }
            }
        }
    }

    // ==========================================
    // 12b. INTERACTIVE CONTROL ACTIONS & HELPERS
    // ==========================================
    setSignalState(state) {
        if (!state) return;
        const currentPhase = (state.current_phase !== undefined) ? state.current_phase : 0;
        const isAllRed = !!state.in_all_red;
        const isYellow = !!state.in_yellow;

        this.signalGantries.forEach((gantry, key) => {
            const isEastWestArm = key.includes('West') || key.includes('East') || key.includes('BTM') || key.includes('HSR');
            let armState = 'red';

            if (isAllRed) {
                armState = 'red';
            } else if (currentPhase === 0) {
                // East-West Phase Active
                if (isEastWestArm) {
                    armState = isYellow ? 'yellow' : 'green';
                } else {
                    armState = 'red';
                }
            } else {
                // North-South Phase Active
                if (!isEastWestArm) {
                    armState = isYellow ? 'yellow' : 'green';
                } else {
                    armState = 'red';
                }
            }

            const lights = gantry.lights;
            if (!lights) return;

            if (armState === 'red') {
                lights.red.material.emissiveIntensity = 4.0;
                lights.yellow.material.emissiveIntensity = 0.1;
                lights.green.material.emissiveIntensity = 0.1;
                if (gantry.pointLight) gantry.pointLight.color.setHex(0xff0022);
            } else if (armState === 'yellow') {
                lights.red.material.emissiveIntensity = 0.1;
                lights.yellow.material.emissiveIntensity = 4.0;
                lights.green.material.emissiveIntensity = 0.1;
                if (gantry.pointLight) gantry.pointLight.color.setHex(0xffb700);
            } else {
                lights.red.material.emissiveIntensity = 0.1;
                lights.yellow.material.emissiveIntensity = 0.1;
                lights.green.material.emissiveIntensity = 4.0;
                if (gantry.pointLight) gantry.pointLight.color.setHex(0x00ff88);
            }
        });
    }

    setSpeedMultiplier(speed) {
        this.speedMultiplier = parseFloat(speed) || 1.0;
    }

    spawnEmergencyAmbulance() {
        const ambId = `AMB-${Math.floor(Date.now() % 10000)}`;
        const ambGroup = this.createVehicleModel('ambulance', '#ffffff');
        // Spawn on West inbound lane heading East towards the junction
        const spawnX = -120;
        const spawnZ = 4.4;
        ambGroup.position.set(spawnX, 0, spawnZ);
        const rotY = Math.PI / 2;
        ambGroup.rotation.y = rotY;
        this.scene.add(ambGroup);

        const vEntry = {
            group: ambGroup,
            targetPos: ambGroup.position.clone(),
            targetRotY: rotY,
            speed: 62.0,
            type: 'ambulance',
            data: { id: ambId, type: 'ambulance', is_emergency: true, speed_kmh: 62 }
        };
        this.vehicleMeshes.set(ambId, vEntry);
        this.followVehicleId = ambId;
        this.setCameraPreset('chase');

        // Immediate Green Corridor Priority for approaching emergency
        this.setSignalState({ in_all_red: false, in_yellow: false });
        return ambId;
    }

    spawnLocalSurge(count = 35) {
        const types = ['two_wheeler', 'two_wheeler', 'auto', 'car', 'car', 'bus'];
        const armConfigs = [
            { startX: -260, endX: -40, baseZ: 4.4, rotY: Math.PI / 2, isX: true },
            { startX: 260, endX: 40, baseZ: -4.4, rotY: -Math.PI / 2, isX: true },
            { startZ: -260, endZ: -40, baseX: -4.4, rotY: 0, isX: false },
            { startZ: 260, endZ: 40, baseX: 4.4, rotY: Math.PI, isX: false }
        ];

        for (let i = 0; i < count; i++) {
            const id = `SURGE-${Math.floor(Date.now() % 10000)}-${i}`;
            const type = types[Math.floor(Math.random() * types.length)];
            const cfg = armConfigs[i % armConfigs.length];
            const vehGroup = this.createVehicleModel(type);

            const t = Math.random();
            const laneJitter = (Math.random() < 0.5 ? 0 : 3.6);
            let posX = 0, posZ = 0;
            if (cfg.isX) {
                posX = cfg.startX + (cfg.endX - cfg.startX) * t;
                posZ = cfg.baseZ + (cfg.baseZ > 0 ? laneJitter : -laneJitter);
            } else {
                posZ = cfg.startZ + (cfg.endZ - cfg.startZ) * t;
                posX = cfg.baseX + (cfg.baseX > 0 ? laneJitter : -laneJitter);
            }

            vehGroup.position.set(posX, 0, posZ);
            vehGroup.rotation.y = cfg.rotY;
            this.scene.add(vehGroup);

            this.vehicleMeshes.set(id, {
                group: vehGroup,
                targetPos: vehGroup.position.clone(),
                targetRotY: cfg.rotY,
                speed: 24.0 + Math.random() * 20.0,
                type: type,
                data: { id: id, type: type, speed_kmh: 32 }
            });
        }
        return count;
    }

    getFleetCounts() {
        let bikes = 0, autos = 0, cars = 0, buses = 0;
        for (const v of this.vehicleMeshes.values()) {
            if (v.type === 'two_wheeler') bikes++;
            else if (v.type === 'auto') autos++;
            else if (v.type === 'bus') buses++;
            else cars++;
        }
        return { total: this.vehicleMeshes.size, bikes, autos, cars, buses };
    }

    resetLocalSimulation() {
        for (const [id, v] of this.vehicleMeshes.entries()) {
            if (id.startsWith('SURGE-') || id.startsWith('AMB-')) {
                this.scene.remove(v.group);
                this.vehicleMeshes.delete(id);
            }
        }
        this.speedMultiplier = 1.0;
        this.followVehicleId = null;
        this.setCameraPreset('junction');
        this.setSignalState({ in_all_red: false, in_yellow: false });
    }

    // ==========================================
    // 13. CAMERA PRESETS
    // ==========================================
    setCameraPreset(mode) {
        this.cameraMode = mode;
        this.isAutoOrbiting = (mode === 'orbit');

        // Center on primary junction node or world center
        let focalX = 0, focalZ = 0;
        if (this.currentHotspot && this.currentHotspot.nodes && this.currentHotspot.nodes.length > 0) {
            const p = this.latLngTo3D(this.currentHotspot.nodes[0].lat, this.currentHotspot.nodes[0].lng);
            focalX = p.x;
            focalZ = p.z;
        }

        if (mode === 'junction') {
            // Elevated 3/4 perspective overlooking the junction
            this.targetCameraPos.set(focalX - 42, 28, focalZ + 46);
            this.targetCameraLookAt.set(focalX, 1.2, focalZ);
        } else if (mode === 'street') {
            // Street perspective along the main arterial looking through zebra crossing
            this.targetCameraPos.set(focalX, 4.5, focalZ + 36);
            this.targetCameraLookAt.set(focalX, 1.5, focalZ - 20);
        } else if (mode === 'overview') {
            // High aerial overview framing the whole map network
            this.targetCameraPos.set(focalX, 180, focalZ + 150);
            this.targetCameraLookAt.set(focalX, 0, focalZ);
        } else if (mode === 'chase') {
            let targetId = null;
            for (const [id, v] of this.vehicleMeshes.entries()) {
                if (v.data && v.data.is_emergency) {
                    targetId = id;
                    break;
                }
            }
            if (!targetId && this.vehicleMeshes.size > 0) {
                targetId = this.vehicleMeshes.keys().next().value;
            }
            this.followVehicleId = targetId;
        }

        this.isTransitioningCamera = true;
    }

    // ==========================================
    // 14. 60 FPS RENDER LOOP
    // ==========================================
    animate() {
        requestAnimationFrame(this.animate);

        const delta = Math.min(this.clock.getDelta(), 0.05);
        const time = this.clock.getElapsedTime();

        // 1. Vehicle Position & Heading Interpolation Driven 100% by Simulation Engine Physics
        const lerpFactor = Math.min(1.0, delta * 12.0);
        for (const [id, vEntry] of this.vehicleMeshes.entries()) {
            vEntry.group.position.lerp(vEntry.targetPos, lerpFactor);

            let diff = vEntry.targetRotY - vEntry.group.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            vEntry.group.rotation.y += diff * lerpFactor;

            // Ambulance Strobes
            if (vEntry.group.userData && vEntry.group.userData.strobes) {
                const strobe = Math.sin(time * 26.0) > 0;
                vEntry.group.userData.strobes.red.material.emissiveIntensity = strobe ? 6.0 : 0.2;
                vEntry.group.userData.strobes.blue.material.emissiveIntensity = strobe ? 0.2 : 6.0;
            }
        }

        // 2. Skyscraper Aviation Hazard Safety Beacons
        if (this.blinkingBeacons && this.blinkingBeacons.length > 0) {
            for (let b = 0; b < this.blinkingBeacons.length; b++) {
                const item = this.blinkingBeacons[b];
                const active = Math.sin(time * 3.4 + item.phase) > 0.25;
                item.mat.color.setHex(active ? 0xff0033 : 0x220005);
            }
        }

        // 2. Camera Controls
        if (this.cameraMode === 'chase' && this.followVehicleId) {
            const vEntry = this.vehicleMeshes.get(this.followVehicleId);
            if (vEntry) {
                const vehPos = vEntry.group.position;
                // Forward is +Z in local model space
                const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), vEntry.group.rotation.y);
                const chasePos = new THREE.Vector3().copy(vehPos).sub(forward.clone().multiplyScalar(16)).add(new THREE.Vector3(0, 7.5, 0));
                this.camera.position.lerp(chasePos, delta * 4.0);
                this.controls.target.lerp(vehPos, delta * 5.0);
            }
        } else if (this.isAutoOrbiting) {
            this.orbitAngle += delta * 0.15;
            const radius = 130;
            this.camera.position.x = Math.sin(this.orbitAngle) * radius;
            this.camera.position.z = Math.cos(this.orbitAngle) * radius;
            this.camera.position.y = 70;
            this.controls.target.set(0, 0, 0);
        } else if (this.isTransitioningCamera) {
            this.camera.position.lerp(this.targetCameraPos, delta * 4.5);
            this.controls.target.lerp(this.targetCameraLookAt, delta * 5.0);
            if (this.camera.position.distanceTo(this.targetCameraPos) < 0.3) {
                this.isTransitioningCamera = false;
            }
        }

        // 3. Selection Ring
        if (this.selectedVehicleId) {
            const v = this.vehicleMeshes.get(this.selectedVehicleId);
            if (v) {
                this.selectionRing.position.set(v.group.position.x, 0.15, v.group.position.z);
                this.selectionRing.rotation.z += delta * 2.0;
                this.selectionRing.visible = true;
            } else {
                this.selectionRing.visible = false;
            }
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onMouseClick(event) {
        this.onMouseMove(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const vehicleGroups = Array.from(this.vehicleMeshes.values()).map(v => v.group);
        const intersects = this.raycaster.intersectObjects(vehicleGroups, true);

        if (intersects.length > 0) {
            let hitGroup = intersects[0].object;
            while (hitGroup.parent && hitGroup.parent !== this.scene) {
                hitGroup = hitGroup.parent;
            }

            for (const [id, v] of this.vehicleMeshes.entries()) {
                if (v.group === hitGroup) {
                    this.selectedVehicleId = id;
                    this.selectionRing.visible = true;
                    if (window.onVehicleSelected3D) {
                        window.onVehicleSelected3D(v.data);
                    }
                    break;
                }
            }
        }
    }

    onResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}

window.Traffic3DDigitalTwin = Traffic3DDigitalTwin;
