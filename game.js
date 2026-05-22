// ============================================================================
// game.js - "The Vanishing of William" (Psychological Retro Horror Game)
// Overhauled Version: Upgraded Schoolboy Model & Hospital Twist Ending Climax
// ============================================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// --- System Variables ---
const GAME_SETTINGS = { walkSpeed: 6.0, runSpeed: 10.5, friction: 0.85, reachDistance: 4.5 };
let scene, camera, renderer, flashlight;
let inputKeys = {};
let gameObjects = [];
let brotherGhost = null;
let footstepTracker = 0, torchSwayTime = 0, itemGlowTime = 0;

let driveVector = new THREE.Vector3();
let playerVelocity = new THREE.Vector3();
let cameraYaw = 0, cameraPitch = 0;

// --- Gameplay Tracking States ---
let gameState = {
    hasHouseKey: false,
    isHouseUnlocked: false,
    notesDiscovered: new Set(),
    tapesCollected: new Set(),
    unlockedLogIds: [], 
    activeMenuPanel: true,
    isGamePaused: false,
    isInspectingItem: false, 
    isJournalOpen: false,
    storyClimaxTriggered: false
};

// --- Updated Psychological Lore Database Structures ---
const GAME_LORE_DATABASE = {
    "note_toy": {
        tabLabel: "[📄] Scrap: Scorched Toy",
        title: "CHARRED SCRAP FOUND BY AN OLD TOY SOLDIER",
        text: "OCTOBER 10, 1897:\n\nWilliam left his lead soldier on the staircase again. I hid it from him to play a trick, but when he cried, I told him the house swallowed it up. He screamed that the walls were full of smoke. There is no smoke. Why do I keep remembering smoke? The doctor tells me to stop looking at the soldier. He says the lead paint peeled off seventy years ago."
    },
    "note_diary1": {
        tabLabel: "[📄] Patient Chart: Board 4",
        title: "CLINICAL OBSERVATION - LOG entry #402",
        text: "NOVEMBER 12, 1968:\n\nThe patient remains uncooperative. He spends hours scratching at the radiator safety locks until his fingers bleed, claiming he needs to unlock the parlor door to let William out of the cellar. He refuses to accept that there is no cellar here. He keeps repeating: 'I am the only survivor. I am the one who ran out.'\n\n- Dr. J. Mercer, Ward B"
    },
    "note_diary2": {
        tabLabel: "[📄] Incident Report: The Closet",
        title: "COUNTY FIRE MARSHAL ARCHIVE METADATA",
        text: "NOVEMBER 15, 1897:\n\nCase Summary: The residential structure collapsed entirely within twenty minutes. One survivor recovered from the front lawn: a young boy, suffering from severe smoke inhalation and shock. When questioned about his younger brother, William, the surviving boy collapsed, repeating that it was his own fault for locking the closet door during their game."
    },
    "tape_kitchen": {
        tabLabel: "[📼] Tape: Ward B Audio Log",
        title: "PSYCHIATRIC AUDIO REEL - RECORDED SEVENTY YEARS LATER",
        text: "[HEAVY TAPE HISS / HOSPITAL MONITOR BEEPING]\n\nDoctor: 'Do you know where you are right now?'\nPatient (Sobbing): 'I'm in the hallway. The door handles are too hot. William is counting inside the room... he reached one thousand but I can't open the latch! Why did I run out? Why did I leave him to burn?! I told you, Doctor, William died years ago! I'm the only survivor! Why won't you let me sleep?!'"
    }
};

// --- Procedural Canvas Material Generation Scripts ---
const TextureGenerator = {
    buildWood() {
        const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#221813'; ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = '#160f0c';
        for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * 512, 0, Math.random() * 12, 512);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },
    buildWall() {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#2c2724'; ctx.fillRect(0, 0, 256, 256);
        for(let i = 0; i < 1500; i++) {
            let val = Math.random() * 15; ctx.fillStyle = `rgba(${val},${val},${val},0.15)`;
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
        }
        return new THREE.CanvasTexture(canvas);
    },
    buildFabric() {
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#1b1d22'; ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#0e1013';
        for(let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 128, 0, Math.random() * 6, 128);
        return new THREE.CanvasTexture(canvas);
    },
    buildBricks() {
        const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#422820'; ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#2b1a15';
        for (let y = 0; y < 256; y += 16) {
            ctx.fillRect(0, y, 256, 2);
            const offset = (y / 16) % 2 === 0 ? 0 : 24;
            for (let x = offset; x < 256; x += 48) {
                ctx.fillRect(x, y, 2, 16);
            }
        }
        return new THREE.CanvasTexture(canvas);
    }
};

// --- Audio Oscillator Engine ---
const GameAudio = {
    ctx: null,
    wake() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playTone(frequency, duration, type = 'sine', volume = 0.1) {
        this.wake();
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    playAmbientPulse() {
        setInterval(() => {
            if(!gameState.activeMenuPanel && !gameState.isGamePaused && !gameState.isJournalOpen && !gameState.storyClimaxTriggered) {
                this.playTone(gameState.isHouseUnlocked ? 55 : 78, 1.2, 'sawtooth', 0.02);
            }
        }, 2500);
    }
};

// --- Entry Initialize Engine ---
function initGame() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020204);
    scene.fog = new THREE.FogExp2(0x020204, 0.09);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 22); 

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const ambientGlow = new THREE.AmbientLight(0x020205);
    scene.add(ambientGlow);

    flashlight = new THREE.SpotLight(0xfff2d6, 12, 38, Math.PI / 7.5, 0.4, 1.2);
    flashlight.castShadow = true;
    flashlight.position.set(0, 0, 0); 
    flashlight.target.position.set(0, 0, -1);
    camera.add(flashlight);
    camera.add(flashlight.target);
    scene.add(camera);

    generateHouseEnvironment();
    buildWilliamGhost();

    window.addEventListener('keydown', captureKeyDown);
    window.addEventListener('keyup', captureKeyUp);
    window.addEventListener('resize', adaptWindowDisplay);
    document.addEventListener('mousemove', processMouseLook);
    document.addEventListener('mousedown', clickInteractRaycast);
    document.addEventListener('pointerlockchange', synchronizePointerLockState);

    document.getElementById('start-btn').addEventListener('click', launchGameLoop);
    document.getElementById('resume-btn').addEventListener('click', unpauseGamePlay);
    document.getElementById('close-document-btn').addEventListener('click', () => { closeUIOverlay('document-modal'); });
    document.getElementById('close-tv-btn').addEventListener('click', () => { closeUIOverlay('tv-modal'); });

    GameAudio.playAmbientPulse();
    runGameEngine(0);
}

// --- Environment Generator ---
function generateHouseEnvironment() {
    const woodTexture = TextureGenerator.buildWood();
    const wallTexture = TextureGenerator.buildWall();
    const brickTexture = TextureGenerator.buildBricks();

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x030403, roughness: 1.0 });
    const floorMat = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.85 });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.9 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.95 });
    const brickMat = new THREE.MeshStandardMaterial({ map: brickTexture, roughness: 0.95 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222225, metalness: 0.7, roughness: 0.4 });

    const yardGeo = new THREE.PlaneGeometry(160, 160);
    const yardMesh = new THREE.Mesh(yardGeo, grassMat);
    yardMesh.rotation.x = -Math.PI / 2;
    scene.add(yardMesh);

    const floorGeo = new THREE.PlaneGeometry(24, 32);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, 0.01, 0);
    scene.add(floorMesh);

    const ceilingMesh = new THREE.Mesh(floorGeo, ceilingMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(0, 3.8, 0);
    scene.add(ceilingMesh);

    const placeWall = (w, h, d, x, y, z, customMat = wallMat) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), customMat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
    };

    // Architecture Boundaries
    placeWall(24, 3.8, 0.4, 0, 1.9, -16); 
    placeWall(0.4, 3.8, 32, -12, 1.9, 0);  
    placeWall(0.4, 3.8, 32, 12, 1.9, 0);   
    placeWall(10, 3.8, 0.4, -7, 1.9, 16);  
    placeWall(10, 3.8, 0.4, 7, 1.9, 16);   
    placeWall(4, 1.0, 0.4, 0, 3.3, 16);    

    placeWall(0.3, 3.8, 14, -3, 1.9, 5);   
    placeWall(0.3, 3.8, 20, 3, 1.9, 2);    
    placeWall(9, 3.8, 0.3, 7.5, 1.9, -4);  
    placeWall(9, 3.8, 0.3, -7.5, 1.9, -6); 
    placeWall(9, 3.8, 0.3, -7.5, 1.9, 4);   
    placeWall(0.3, 3.8, 10, -3, 1.9, -1);   
    placeWall(2.2, 3.8, 0.3, -4.1, 1.9, 4); 

    // Kitchen Assets
    placeWall(2.5, 2.8, 1.2, -10.5, 1.4, -1, brickMat);
    const stoveTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.0), metalMat);
    stoveTop.position.set(-10.5, 0.6, -0.9);
    scene.add(stoveTop);

    const counterGroup = new THREE.Group();
    const counterBase = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.9, 1.2), new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x3d2a1f }));
    counterBase.position.y = 0.45;
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.08, 1.3), new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x5c4033 }));
    counterTop.position.y = 0.94;
    counterGroup.add(counterBase, counterTop);
    counterGroup.position.set(-5, 0, -1);
    scene.add(counterGroup);

    // Victorian Door Upgrade
    const doorGroup = new THREE.Group();
    const doorCoreMat = new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x2e1f17, roughness: 0.7 });
    const doorBevelMat = new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x1f150f, roughness: 0.6 });
    const handleBrassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1 });

    const mainSlab = new THREE.Mesh(new THREE.BoxGeometry(4, 2.8, 0.15), doorCoreMat);
    mainSlab.position.y = 1.4;
    doorGroup.add(mainSlab);

    const pGeo = new THREE.BoxGeometry(1.4, 0.9, 0.04);
    const panelTopLeft = new THREE.Mesh(pGeo, doorBevelMat); panelTopLeft.position.set(-0.8, 1.95, 0.06);
    const panelTopRight = new THREE.Mesh(pGeo, doorBevelMat); panelTopRight.position.set(0.8, 1.95, 0.06);
    const panelBotLeft = new THREE.Mesh(pGeo, doorBevelMat); panelBotLeft.position.set(-0.8, 0.75, 0.06);
    const panelBotRight = new THREE.Mesh(pGeo, doorBevelMat); panelBotRight.position.set(0.8, 0.75, 0.06);
    doorGroup.add(panelTopLeft, panelTopRight, panelBotLeft, panelBotRight);

    const doorHandlePlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.02), handleBrassMat);
    doorHandlePlate.position.set(1.6, 1.2, 0.09);
    const doorHandleRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16), handleBrassMat);
    doorHandleRing.position.set(1.6, 1.15, 0.12);
    doorGroup.add(doorHandlePlate, doorHandleRing);

    doorGroup.position.set(0, 0, 16);
    scene.add(doorGroup);
    gameObjects.push({ type: 'front_door', mesh: mainSlab, rootGroup: doorGroup });

    // Console TV Set Upgrade
    const tvGroup = new THREE.Group();
    const screenGlowMat = new THREE.MeshStandardMaterial({ color: 0x05090f, emissive: 0x030508, roughness: 0.1 });

    const mainBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.1, 1.4), new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x1c120c, roughness: 0.8 }));
    mainBox.position.y = 1.05;
    tvGroup.add(mainBox);

    const frontFacia = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 0.05), new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x120a06 }));
    frontFacia.position.set(0, 1.05, 0.69);
    tvGroup.add(frontFacia);

    const glassScreen = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16, 0, Math.PI*2, 0, Math.PI/3), screenGlowMat);
    glassScreen.rotation.x = Math.PI / 2;
    glassScreen.scale.set(1.1, 0.1, 0.9);
    glassScreen.position.set(-0.35, 1.25, 0.71);
    tvGroup.add(glassScreen);

    const playerDeckTrunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.45), metalMat);
    playerDeckTrunk.position.set(0.6, 0.7, 0.71);
    const deckHoleInlet = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    deckHoleInlet.position.set(0.6, 0.7, 0.94);
    tvGroup.add(playerDeckTrunk, deckHoleInlet);

    const dialControl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), handleBrassMat);
    dialControl1.rotation.x = Math.PI / 2; dialControl1.position.set(0.6, 1.5, 0.71);
    const dialControl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10), handleBrassMat);
    dialControl2.rotation.x = Math.PI / 2; dialControl2.position.set(0.6, 1.3, 0.71);
    tvGroup.add(dialControl1, dialControl2);

    tvGroup.position.set(7.5, 0, -14);
    tvGroup.rotation.y = -0.3;
    scene.add(tvGroup);
    gameObjects.push({ type: 'tv', mesh: mainBox, rootGroup: tvGroup });

    // Item 1: Brass Key
    const keyGroup = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.1, emissive: 0x3d3000 });
    const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 24), brassMat);
    const keyShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), brassMat);
    keyShaft.rotation.x = Math.PI / 2; keyShaft.position.z = -0.2;
    const keyBit1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.08), brassMat);
    keyBit1.position.set(0, -0.04, -0.36);
    keyGroup.add(keyRing, keyShaft, keyBit1);
    keyGroup.position.set(-6.5, 0.15, 18.5);
    const keyLight = new THREE.PointLight(0xd4af37, 2, 3);
    keyGroup.add(keyLight);
    scene.add(keyGroup);
    gameObjects.push({ type: 'key', id: 'house_key', mesh: keyShaft, rootGroup: keyGroup, auraLight: keyLight });

    // Item 2: Toy Soldier
    const soldierGroup = new THREE.Group();
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x991111, roughness: 0.5, emissive: 0x220000 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x111166, roughness: 0.5 });
    const faceMat = new THREE.MeshStandardMaterial({ color: 0xddaa88, roughness: 0.7 });
    const sBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12), pantsMat);
    const sLegs = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 12), pantsMat); sLegs.position.y = 0.14;
    const sTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.3, 12), coatMat); sTorso.position.y = 0.4;
    const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), faceMat); sHead.position.y = 0.57;
    const sHat = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), new THREE.MeshStandardMaterial({color: 0x111111})); sHat.position.y = 0.65;
    soldierGroup.add(sBase, sLegs, sTorso, sHead, sHat);
    soldierGroup.position.set(-1.5, 0.05, 7.5);
    const soldierLight = new THREE.PointLight(0xff3333, 2, 3);
    soldierGroup.add(soldierLight);
    scene.add(soldierGroup);
    gameObjects.push({ type: 'note', id: 'note_toy', mesh: sTorso, rootGroup: soldierGroup, auraLight: soldierLight });

    // Item 3: Diary Page
    const diaryGroup = new THREE.Group();
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xfaf4e8, roughness: 1.0, emissive: 0x221f18 });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.8 });
    const bookCover = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.7), coverMat);
    const pageLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.64), paperMat); pageLeft.position.set(-0.12, 0.015, 0);
    const pageRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.64), paperMat); pageRight.position.set(0.12, 0.015, 0);
    diaryGroup.add(bookCover, pageLeft, pageRight);
    diaryGroup.position.set(7, 0.05, -8);
    const diaryLight = new THREE.PointLight(0xffffff, 2, 3);
    diaryGroup.add(diaryLight);
    scene.add(diaryGroup);
    gameObjects.push({ type: 'note', id: 'note_diary1', mesh: pageLeft, rootGroup: diaryGroup, auraLight: diaryLight });

    // Item 4: Wardrobe Note
    const wardrobeNoteGroup = new THREE.Group();
    const scrapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.01, 0.45), paperMat);
    wardrobeNoteGroup.add(scrapMesh);
    wardrobeNoteGroup.position.set(-8, 0.05, -12);
    const scrapLight = new THREE.PointLight(0xffffff, 2, 3);
    wardrobeNoteGroup.add(scrapLight);
    scene.add(wardrobeNoteGroup);
    gameObjects.push({ type: 'note', id: 'note_diary2', mesh: scrapMesh, rootGroup: wardrobeNoteGroup, auraLight: scrapLight });

    // Item 5: Upgraded Cassette Tape
    const tapeGroup = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.5, emissive: 0x020204 });
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xab2b2b, roughness: 0.8 });
    const gearWheelMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e6, roughness: 0.3 });
    const clearWindowMat = new THREE.MeshStandardMaterial({ color: 0x111111, transparent: true, opacity: 0.4, roughness: 0.1 });

    const bodyShell = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.3), shellMat);
    tapeGroup.add(bodyShell);
    const stickerLabel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.063, 0.14), labelMat);
    stickerLabel.position.set(0, 0, -0.04);
    tapeGroup.add(stickerLabel);
    const viewingWindow = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.063, 0.06), clearWindowMat);
    viewingWindow.position.set(0, 0, 0.07);
    tapeGroup.add(viewingWindow);

    const gearLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 12), gearWheelMat); gearLeft.position.set(-0.09, 0, 0.01);
    const gearRight = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 12), gearWheelMat); gearRight.position.set(0.09, 0, 0.01);
    const corePinL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.072, 6), shellMat); corePinL.position.set(-0.09, 0, 0.01);
    const corePinR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.072, 6), shellMat); corePinR.position.set(0.09, 0, 0.01);
    tapeGroup.add(gearLeft, gearRight, corePinL, corePinR);

    tapeGroup.position.set(-5, 0.98, -1);
    const tapeLight = new THREE.PointLight(0x00ff88, 2.5, 3.5); 
    tapeGroup.add(tapeLight);
    scene.add(tapeGroup);
    gameObjects.push({ type: 'tape', id: 'tape_kitchen', mesh: bodyShell, rootGroup: tapeGroup, auraLight: tapeLight });
}

// --- 🎖️ ADVANCED MODEL UPGRADE: HIGH DETAIL GHOST BOY (WILLIAM) ---
function buildWilliamGhost() {
    brotherGhost = new THREE.Group();

    // Ghostly blue-tinted materials with physical transparency properties initialized
    const ghostFabricMat = new THREE.MeshStandardMaterial({ 
        color: 0x223355, roughness: 0.6, transparent: true, opacity: 0.0, emissive: 0x051122 
    });
    const ghostSkinMat = new THREE.MeshStandardMaterial({ 
        color: 0x445577, roughness: 0.8, transparent: true, opacity: 0.0, emissive: 0x0a152d 
    });
    const brassButtonMat = new THREE.MeshStandardMaterial({ 
        color: 0x887744, metalness: 0.8, transparent: true, opacity: 0.0 
    });

    // 1. Structured Head and Detailed Features
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), ghostSkinMat);
    head.position.y = 1.35;
    brotherGhost.add(head);

    // 2. Vintage Schoolboy Newsboy Cap
    const capGroup = new THREE.Group();
    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 16), ghostFabricMat);
    capCrown.position.y = 1.5;
    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), ghostFabricMat);
    capBrim.position.set(0, 1.47, 0.16);
    capBrim.rotation.x = 0.2;
    capGroup.add(capCrown, capBrim);
    brotherGhost.add(capGroup);

    // 3. Flared 1890s Tailored Button-up Torso Jacket
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.6, 16), ghostFabricMat);
    torso.position.y = 0.9;
    brotherGhost.add(torso);

    // 4. Physical Row of Brass Buttons running down uniform center seam
    for (let i = 0; i < 4; i++) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), brassButtonMat);
        button.position.set(0, 1.1 - (i * 0.12), 0.17);
        brotherGhost.add(button);
    }

    // 5. Individual Left and Right Pant Leg Slits
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 12), ghostFabricMat);
    legL.position.set(-0.08, 0.4, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 12), ghostFabricMat);
    legR.position.set(0.08, 0.4, 0);
    brotherGhost.add(legL, legR);

    // 6. Rigid Standing Shoes Footbed bases
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.14), ghostFabricMat);
    shoeL.position.set(-0.08, 0.13, 0.04);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.14), ghostFabricMat);
    shoeR.position.set(0.08, 0.13, 0.04);
    brotherGhost.add(shoeL, shoeR);

    brotherGhost.position.set(0, -10, 0); 
    scene.add(brotherGhost);
}

// --- Menu Actions Router ---
function launchGameLoop() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('hud-container').classList.remove('hidden');
    gameState.activeMenuPanel = false;
    GameAudio.playTone(90, 0.8, 'sine', 0.2);
    document.body.requestPointerLock();
}

function unpauseGamePlay() {
    document.getElementById('pause-menu').classList.add('hidden');
    gameState.isGamePaused = false;
    document.body.requestPointerLock();
}

function synchronizePointerLockState() {
    if (gameState.activeMenuPanel || gameState.isInspectingItem || gameState.isJournalOpen) return;
    const lockActive = document.pointerLockElement === document.body;
    gameState.isGamePaused = !lockActive;
    document.getElementById('pause-menu').classList.toggle('hidden', lockActive);
}

function closeUIOverlay(modalId) {
    document.getElementById(modalId).style.display = 'none';
    gameState.isInspectingItem = false;
    
    // Custom Intercept Hook: If the twist has triggered, closing the modal starts the final crash event
    if (gameState.storyClimaxTriggered) {
        executeHospitalAwakeningFader();
    } else {
        document.body.requestPointerLock();
    }
}

// --- Journal Deck Mechanics ---
function toggleStoryJournal() {
    if (gameState.activeMenuPanel || gameState.isGamePaused || gameState.isInspectingItem || gameState.storyClimaxTriggered) return;

    gameState.isJournalOpen = !gameState.isJournalOpen;
    const overlay = document.getElementById('journal-overlay');

    if (gameState.isJournalOpen) {
        document.exitPointerLock();
        overlay.classList.remove('hidden');
        renderJournalTabs();
        GameAudio.playTone(330, 0.15, 'triangle', 0.1);
    } else {
        overlay.classList.add('hidden');
        document.body.requestPointerLock();
        GameAudio.playTone(220, 0.1, 'triangle', 0.1);
    }
}

function unlockJournalLogEntry(id) {
    if (!gameState.unlockedLogIds.includes(id)) {
        gameState.unlockedLogIds.push(id);
    }
}

function renderJournalTabs() {
    const listContainer = document.getElementById('journal-tabs-list');
    listContainer.innerHTML = ""; 

    if (gameState.unlockedLogIds.length === 0) {
        listContainer.innerHTML = `<div style="font-size:11px; color:#4a443c; font-style:italic;">No files found yet. Search the layout.</div>`;
        return;
    }

    gameState.unlockedLogIds.forEach(id => {
        const logData = GAME_LORE_DATABASE[id];
        const btn = document.createElement('button');
        btn.className = 'lore-entry-tab';
        btn.innerText = logData.tabLabel;
        btn.onclick = () => {
            document.querySelectorAll('.lore-entry-tab').forEach(t => t.classList.remove('active-tab'));
            btn.classList.add('active-tab');
            document.getElementById('journal-view-title').innerText = logData.title;
            document.getElementById('journal-view-body').innerText = logData.text;
            GameAudio.playTone(440, 0.05, 'sine', 0.05);
        };
        listContainer.appendChild(btn);
    });
}

// --- Raycaster Engine ---
function clickInteractRaycast(e) {
    if (gameState.activeMenuPanel || gameState.isGamePaused || gameState.isInspectingItem || gameState.isJournalOpen || e.button !== 0) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
    const clickTargets = gameObjects.map(obj => obj.mesh);
    const intersects = raycaster.intersectObjects(clickTargets);

    if (intersects.length > 0 && intersects[0].distance < GAME_SETTINGS.reachDistance) {
        const foundObject = gameObjects.find(obj => obj.mesh === intersects[0].object);
        if (foundObject) fireGameplayInteractionLogic(foundObject);
    }
}

// --- Narrative Interaction Core ---
function fireGameplayInteractionLogic(item) {
    switch (item.type) {
        case 'key':
            GameAudio.playTone(880, 0.1, 'sine', 0.3);
            gameState.hasHouseKey = true;
            if(item.rootGroup) scene.remove(item.rootGroup);
            gameObjects = gameObjects.filter(i => i !== item);
            document.getElementById('objective-tracker').innerText = "OBJECTIVE: Entrance key found. Open the front door.";
            break;

        case 'front_door':
            if (gameState.hasHouseKey) {
                GameAudio.playTone(180, 0.4, 'triangle', 0.25);
                gameState.isHouseUnlocked = true;
                if(item.rootGroup) {
                    item.rootGroup.position.set(-2.2, 0, 17.2);
                    item.rootGroup.rotation.y = Math.PI / 2;
                }
                gameObjects = gameObjects.filter(i => i !== item);
                refreshObjectiveTracker();
            } else {
                GameAudio.playTone(120, 0.25, 'sawtooth', 0.3);
                document.getElementById('objective-tracker').innerText = "OBJECTIVE: Locked. Search the porch stairs layout for the family key.";
            }
            break;

        case 'note':
            gameState.isInspectingItem = true;
            document.exitPointerLock();
            GameAudio.playTone(600, 0.15, 'triangle', 0.15);
            
            const noteData = GAME_LORE_DATABASE[item.id];
            document.getElementById('document-title').innerText = noteData.title;
            document.getElementById('document-text').innerText = noteData.text;
            document.getElementById('document-modal').style.display = 'flex';

            gameState.notesDiscovered.add(item.id);
            unlockJournalLogEntry(item.id); 
            
            if(item.rootGroup) scene.remove(item.rootGroup);
            gameObjects = gameObjects.filter(i => i !== item);
            refreshObjectiveTracker();
            break;

        case 'tape':
            GameAudio.playTone(520, 0.2, 'sine', 0.25);
            gameState.tapesCollected.add(item.id);
            unlockJournalLogEntry(item.id); 
            if(item.rootGroup) scene.remove(item.rootGroup);
            gameObjects = gameObjects.filter(i => i !== item);
            refreshObjectiveTracker();
            break;

        case 'tv':
            gameState.isInspectingItem = true;
            document.exitPointerLock();

            if (gameState.tapesCollected.size > 0) {
                const activeId = Array.from(gameState.tapesCollected)[0];
                const tapeData = GAME_LORE_DATABASE[activeId];

                GameAudio.playTone(200, 0.5, 'sawtooth', 0.2);
                document.getElementById('tv-title').innerText = tapeData.title;
                document.getElementById('tv-story-text').innerText = tapeData.text;
                document.getElementById('tv-modal').style.display = 'flex';

                gameState.tapesCollected.delete(activeId);

                // Check condition: If player uncovered all notes, tape playback triggers the asylum breakdown encounter
                if (gameState.notesDiscovered.size >= 3) {
                    gameState.storyClimaxTriggered = true;
                } else {
                    refreshObjectiveTracker();
                }
            } else {
                GameAudio.playTone(90, 0.6, 'sawtooth', 0.4); 
                document.getElementById('tv-title').innerText = "RECEIVER ERROR";
                document.getElementById('tv-story-text').innerText = "SYSTEM FEED: Deck slot empty.\n\nSearch the dark kitchen counter surfaces for the missing November 14 VHS tape record cassette. Tracked records can be viewed at any time inside your Log Journal menu screen [TAB].";
                document.getElementById('tv-modal').style.display = 'flex';
            }
            break;
    }
}

function refreshObjectiveTracker() {
    if (gameState.storyClimaxTriggered) return;
    if (!gameState.isHouseUnlocked) return;

    const remainingNotes = 3 - gameState.notesDiscovered.size;
    const trackerText = document.getElementById('objective-tracker');

    if (remainingNotes > 0) {
        trackerText.innerText = `OBJECTIVE: Search rooms for lost papers outlining the events of Nov 14, 1897 (${gameState.notesDiscovered.size}/3 Discovered). View collected items with [TAB].`;
    } else if (gameState.tapesCollected.size > 0) {
        trackerText.innerText = `OBJECTIVE: Insert the recovered kitchen tape into the parlor console television receiver deck.`;
    } else {
        trackerText.innerText = `OBJECTIVE: Uncover the missing VHS recording tape left behind in the kitchen workspace table counter.`;
    }
}

// --- 🏥 CLINICAL TWIST REVEAL FINALE SEQUENCE ---
function executeHospitalAwakeningFader() {
    document.getElementById('objective-tracker').innerText = "CRITICAL COGNITIVE REJECTION: DETACHING FROM SIMULATION.";
    
    // 1. Play jarring medical hardware flatline tone pattern
    GameAudio.playTone(440, 4.0, 'sine', 0.4);
    
    // 2. Build full-screen HTML black fader on the fly to block the 3D scene
    const asylumScreen = document.createElement('div');
    asylumScreen.id = 'asylum-fader';
    asylumScreen.style = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000000; z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:monospace; color:#8b0000; padding:40px; text-align:center; box-sizing:border-box; opacity:0; transition:opacity 2.5s ease-in-out;';
    
    asylumScreen.innerHTML = `
        <h1 style="font-size:24px; letter-spacing:4px; margin-bottom:30px; color:#d6d6d6;">ARKHAM MEDICAL FACILITY - WARD B</h1>
        <div style="max-width:650px; font-size:14px; line-height:1.8; color:#a2a8b5; text-align:left; border-left: 3px solid #8b0000; padding-left:20px;">
            <p><strong>CASE PROFILE:</strong> Patient #1897 (Catatonic Trauma Loop)</p>
            <p><strong>DIAGNOSIS:</strong> Severe Survivor's Guilt. For seventy years, the patient has refused to leave his hospital bed, locked inside a phantom architecture of the childhood house that burned down in 1897.</p>
            <p><strong>TRANSCRIPT RECORD:</strong> The patient keeps screaming at his primary care physician that William died in the bedroom closet decades ago, yelling over and over that he was the only one who made it out alive into the winter cold, putting the entire blame of the fire onto himself.</p>
            <p style="color:#8b0000; margin-top:20px; font-style:italic;">"He cannot move on. He will never leave the house because he thinks he is the one who locked the door."</p>
        </div>
        <button id="restart-loop-btn" style="margin-top:40px; background:none; border:1px solid #444; color:#666; padding:10px 20px; cursor:pointer; font-family:monospace; font-size:11px; transition:0.3s;">RE-INITIALIZE RECOLLECTION LOOP</button>
    `;
    
    document.body.appendChild(asylumScreen);
    
    // Trigger transition fade in
    setTimeout(() => {
        asylumScreen.style.opacity = '1';
        document.getElementById('hud-container').classList.add('hidden');
    }, 100);

    // Bind clean restart function to lock them right back inside the memory loop
    document.getElementById('restart-loop-btn').onclick = () => {
        window.location.reload();
    };
}

// --- Input Captures ---
function captureKeyDown(e) {
    if (e.key === 'Tab') {
        e.preventDefault();
        toggleStoryJournal();
        return;
    }
    if (e.key === 'Escape' && gameState.isJournalOpen) {
        toggleStoryJournal();
        return;
    }
    if (e.key === 'Shift') { inputKeys['run'] = true; return; }
    inputKeys[e.key.toLowerCase()] = true;
}

function captureKeyUp(e) {
    if (e.key === 'Shift') { inputKeys['run'] = false; return; }
    inputKeys[e.key.toLowerCase()] = false;
}

function processMouseLook(e) {
    if (document.pointerLockElement !== document.body || gameState.isGamePaused || gameState.isJournalOpen || gameState.isInspectingItem) return;

    cameraYaw -= e.movementX * 0.0022;
    cameraPitch -= e.movementY * 0.0022;
    cameraPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraPitch));
    camera.quaternion.setFromEuler(new THREE.Euler(cameraPitch, cameraYaw, 0, 'YXZ'));
}

// --- Locomotion Engine ---
function processPlayerLocomotion(delta) {
    if (gameState.isGamePaused || gameState.activeMenuPanel || gameState.isInspectingItem || gameState.isJournalOpen || gameState.storyClimaxTriggered) return;

    driveVector.set(0, 0, 0);
    if (inputKeys['w']) driveVector.z -= 1;
    if (inputKeys['s']) driveVector.z += 1;
    if (inputKeys['a']) driveVector.x -= 1;
    if (inputKeys['d']) driveVector.x += 1;

    if (driveVector.lengthSq() > 0) {
        driveVector.normalize();
        driveVector.applyEuler(new THREE.Euler(0, cameraYaw, 0, 'YXZ'));

        const sprintActive = inputKeys['run'] === true;
        const targetVelocityLimit = sprintActive ? GAME_SETTINGS.runSpeed : GAME_SETTINGS.walkSpeed;
        playerVelocity.copy(driveVector).multiplyScalar(targetVelocityLimit);

        footstepTracker += delta;
        if (footstepTracker > (sprintActive ? 0.24 : 0.42)) {
            GameAudio.playTone(130, 0.06, 'triangle', 0.08); 
            footstepTracker = 0;
        }
        torchSwayTime += delta * (sprintActive ? 3.0 : 1.8);
    } else {
        playerVelocity.multiplyScalar(GAME_SETTINGS.friction);
        torchSwayTime += delta * 0.4;
    }

    camera.position.addScaledVector(playerVelocity, delta);

    camera.position.x = Math.max(-11.5, Math.min(11.5, camera.position.x));
    camera.position.z = Math.max(-15.5, Math.min(21.5, camera.position.z));
}

// --- Core App Loop Cycle Update ---
function runGameEngine() {
    requestAnimationFrame(runGameEngine);
    const deltaTick = 0.016;

    processPlayerLocomotion(deltaTick);

    itemGlowTime += deltaTick;
    const basePulse = Math.sin(itemGlowTime * 3.5);
    const scalingFactor = 1.0 + basePulse * 0.08;

    // Item animations loop runs only if twist has not anchored
    gameObjects.forEach(obj => {
        if (obj.rootGroup && obj.type !== 'front_door' && obj.type !== 'tv') {
            obj.rootGroup.rotation.y += deltaTick * 0.6;
            if (obj.auraLight) {
                obj.auraLight.intensity = (obj.type === 'tape' ? 2.5 : 2.0) + basePulse * 0.8;
            }
            obj.rootGroup.scale.set(scalingFactor, scalingFactor, scalingFactor);
            const restHeight = (obj.id === 'tape_kitchen' ? 0.98 : (obj.id === 'house_key' ? 0.15 : 0.05));
            obj.rootGroup.position.y = restHeight + Math.sin(itemGlowTime * 2.0) * 0.03;
        }
    });

    // Special Climax Encounter Track Animation
    if (gameState.storyClimaxTriggered && brotherGhost && brotherGhost.position.y > -5) {
        // Slowly increase opacity and pulse body sizes as William stands behind the player
        brotherGhost.traverse(child => {
            if (child.isMesh && child.material.opacity < 0.85) {
                child.material.opacity += deltaTick * 0.25;
            }
        });
        // Make William face the player dynamically during the scene standstill
        brotherGhost.lookAt(camera.position.x, brotherGhost.position.y, camera.position.z);
    }

    if (!gameState.isGamePaused && !gameState.isJournalOpen && !gameState.isInspectingItem && !gameState.storyClimaxTriggered) {
        flashlight.position.set(
            Math.sin(torchSwayTime * 0.8) * 0.02,
            Math.cos(torchSwayTime * 1.2) * 0.015,
            0
        );
    }
    renderer.render(scene, camera);
}

function adaptWindowDisplay() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = initGame;