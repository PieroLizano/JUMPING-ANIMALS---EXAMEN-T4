//  Este archivo es el "director" del juego: crea la escena, carga los
//  personajes, maneja las pantallas, los controles y el bucle principal.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ROW, SIDE, HOP_TIME, HOP_HEIGHT, player, target, hop, grassMat } from './shared.js';
import { level1 } from './levels/level1.js';
import { level2 } from './levels/level2.js';



//  1. AJUSTES 

const STEP_X = 1;         
const ROWS_AHEAD = 20;    
const BACK_LIMIT = 3;     



//  2. ELEMENTOS DE LA PÁGINA (index.html)

const menu = document.getElementById('menu');               
const gameoverEl = document.getElementById('gameover');     
const hud = document.getElementById('hud');                 
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const finalScoreEl = document.getElementById('finalScore'); 
const recordMsgEl = document.getElementById('recordMsg');   
const menuBest = {                                          
    1: document.getElementById('menuBest1'),
    2: document.getElementById('menuBest2'),
};



//  3. ESCENA, CÁMARA Y LUCES

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);               

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 10, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));           
const sun = new THREE.DirectionalLight(0xffffff, 1.2);      
sun.position.set(5, 10, 5);
scene.add(sun);


addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});


const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), grassMat);
ground.position.y = -0.5;
scene.add(ground);

const world = new THREE.Group();    
scene.add(world);
scene.add(player);                  



//  4. ESTADO DEL JUEGO

const levels = { 1: level1, 2: level2 };
let level = 1;              
let current = level1;       
let state = 'menu';         
let rows = [];              
let score = 0;              
let rideY = 0;              

// Récord guardado en el navegador  
const SAVE_KEY = 'jumpingAnimals.best';

function loadBest() {
    try {
        return { 1: 0, 2: 0, ...JSON.parse(localStorage.getItem(SAVE_KEY)) };
    } catch {
        return { 1: 0, 2: 0 };      
    }
}

function saveBest() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(best)); } catch { /* sin almacenamiento */ }
}

const best = loadBest();            



//  5. PERSONAJES (modelos .glb)

async function loadCharacter(url, rotationY) {
    const model = (await new GLTFLoader().loadAsync(url)).scene;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(0.9 / Math.max(size.x, size.y, size.z));      // tamaño

    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;                                            // centrado
    model.position.y -= box.min.y;                                      // pies en el suelo
    model.position.z -= c.z;

    const holder = new THREE.Group();
    holder.rotation.y = rotationY;
    holder.add(model);
    player.add(holder);
    return holder;
}      

//Animales disponibles
const ANIMALS = [
    { id: 'gallina', file: 'models/gallina.glb', rot: -Math.PI / 2},
    { id: 'rana',    file: 'models/rana.glb',    rot: -Math.PI },
    { id: 'cerdo',   file: 'models/cerdo.glb',   rot: Math.PI },
    { id: 'llama',   file: 'models/llama.glb',   rot: Math.PI },
    { id: 'conejo',  file: 'models/conejo.glb',  rot: Math.PI },
];

const holders = {};                     // id → modelo ya cargado
await Promise.all(ANIMALS.map(async (a) => {
    try {
        holders[a.id] = await loadCharacter(a.file, a.rot);
        holders[a.id].visible = false;
    } catch (err) {
        console.warn('No se pudo cargar', a.file, err);
    }
}));

// --- Animal elegido (se recuerda en el navegador) ---
const ANIMAL_KEY = 'jumpingAnimals.animal';

function loadAnimal() {
    try {
        const id = localStorage.getItem(ANIMAL_KEY);
        if (holders[id]) return id;
    } catch { /* sin almacenamiento */ }
    return holders.gallina ? 'gallina' : Object.keys(holders)[0];
}

let animal = loadAnimal();              // id del animal elegido

// Muestra solo el animal elegido
function showAnimal() {
    for (const id in holders) holders[id].visible = id === animal;
}

// Cambia el animal, lo guarda y marca su botón en el menú
function selectAnimal(id) {
    if (!holders[id]) return;
    animal = id;
    try { localStorage.setItem(ANIMAL_KEY, id); } catch { /* sin almacenamiento */ }
    showAnimal();
    document.querySelectorAll('.animal').forEach((b) => b.classList.toggle('selected', b.dataset.animal === id));
}


//  6. MUNDO: CREAR FILAS Y EMPEZAR PARTIDA

function addRow() {
    const i = rows.length;
    const row = current.makeRow(i, rows[i - 1]);        
    row.group.position.z = -i * ROW;
    world.add(row.group);
    rows.push(row);
}

// Empieza una partida nueva
function reset() {
    world.clear();
    rows = [];
    score = 0;
    current.reset();
    while (rows.length < ROWS_AHEAD) addRow();

    player.position.set(0, 0, 0);
    target.set(0, 0, 0);
    player.rotation.y = 0;
    hop.t = 1;
    hop.time = HOP_TIME;
    hop.height = HOP_HEIGHT;
    rideY = 0;
    showAnimal();                                       

    scoreEl.textContent = 0;
    bestEl.textContent = best[level];
}


//  7. ACTUALIZACIÓN EN CADA FOTOGRAMA
// Lógica principal del juego 

function update(dt) {
    current.update(dt, rows);                           

    
    const playerRow = Math.round(-player.position.z / ROW);
    if (playerRow > score) {
        score = playerRow;
        scoreEl.textContent = score;
    }

    
    while (rows.length < score + ROWS_AHEAD) addRow();

    
    const row = rows[playerRow];
    if (row && !row.safe && Math.abs(player.position.z - row.group.position.z) < 0.6) {
        if (current.checkLoss(row)) return gameOver();
    }
}

// Animación de salto
function animateHop(dt) {
    const who = holders[animal];                       
    if (!who) return;
    if (hop.t < 1) hop.t = Math.min(hop.t + dt / hop.time, 1);

    // Altura de apoyo: sobre un tronco se eleva (y baja con él si se hunde)
    const support = current.riding;
    const goal = support ? support.position.y + support.top : (hop.t < 1 ? rideY : 0);
    rideY += (goal - rideY) * (1 - Math.exp(-15 * dt));

    const s = Math.sin(hop.t * Math.PI);               
    const stretch = 1 + 0.2 * s;                       
    const squash = 1 / Math.sqrt(stretch);             

    who.position.y = rideY + s * hop.height;
    who.scale.set(squash, stretch, squash);
}



//  8. PANTALLAS: MENÚ Y GAME OVER
// Empieza el nivel y oculta el menú y el Game over
function startLevel(n) {
    document.activeElement?.blur();                     // evita que Enter/Espacio vuelvan a pulsar un botón
    level = n;
    current = levels[n];
    reset();
    menu.classList.add('hidden');
    gameoverEl.classList.add('hidden');
    hud.classList.remove('hidden');
    state = 'playing';
}

// Termina la partida: actualiza el récord y muestra el Game over con un mensaje
function gameOver() {
    const previous = best[level];
    best[level] = Math.max(previous, score);
    saveBest();                                         // guarda el récord en el navegador
    state = 'gameover';

    let msg, isRecord = false;
    if (score > previous) {
        msg = '🏆 ¡Superaste tu récord!';
        isRecord = true;
    } else if (score > 0 && score === previous) {
        msg = 'Igualaste tu récord';
    } else if (previous > 0) {
        msg = `Te faltaron ${previous - score + 1} filas para superar tu récord`;
    } else {
        msg = '¡Intenta avanzar más!';
    }

    finalScoreEl.textContent = `Puntaje: ${score} · Récord: ${best[level]}`;
    recordMsgEl.textContent = msg;
    recordMsgEl.classList.toggle('record', isRecord);   // el mensaje de récord sale en dorado
    bestEl.textContent = best[level];
    gameoverEl.classList.remove('hidden');
}

// Muestra en las tarjetas del menú el mejor récord de cada nivel
function updateMenuRecords() {
    menuBest[1].textContent = best[1];
    menuBest[2].textContent = best[2];
}

// Vuelve al menú de niveles
function showMenu() {
    updateMenuRecords();
    state = 'menu';
    menu.classList.remove('hidden');
    gameoverEl.classList.add('hidden');
    hud.classList.add('hidden');
}

// Botones de las pantallas
document.querySelectorAll('#menu [data-level]').forEach((btn) => {
    btn.onclick = () => startLevel(Number(btn.dataset.level));   
});
document.querySelectorAll('.animal').forEach((btn) => {
    if (!holders[btn.dataset.animal]) btn.classList.add('hidden');  
    btn.onclick = () => selectAnimal(btn.dataset.animal);           
});
selectAnimal(animal);                                               
document.getElementById('retry').onclick = () => startLevel(level);   
document.getElementById('toMenu').onclick = showMenu;                         



//  9. CONTROLES
const KEYS = {
    ArrowUp: [0, -1],    KeyW: [0, -1],
    ArrowDown: [0, 1],   KeyS: [0, 1],
    ArrowLeft: [-1, 0],  KeyA: [-1, 0],
    ArrowRight: [1, 0],  KeyD: [1, 0],
};

addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return showMenu();                  

    if ((e.code === 'Enter' || e.code === 'Space') && state === 'gameover') {
        e.preventDefault();
        return startLevel(level);                                
    }

    const d = KEYS[e.code];
    if (!d) return;
    e.preventDefault();
    if (state !== 'playing' || e.repeat || current.jump) return; 

    
    const row = rows[Math.round(-player.position.z / ROW)];
    if (d[0] && current.tryJump(d[0], row)) {
        player.rotation.y = Math.atan2(-d[0], 0);
        return;
    }

    const nx = target.x + d[0] * STEP_X;                         
    const nz = target.z + d[1] * ROW;                          

    // Límite lateral (si la corriente te sacó, solo puedes volver hacia adentro)
    if (d[0] && Math.abs(nx) > SIDE && Math.abs(nx) >= Math.abs(target.x)) return;
    // Solo se puede retroceder unas pocas filas desde la mejor fila
    if (d[1] && nz > -Math.max(0, score - BACK_LIMIT) * ROW) return;

    target.x = nx;
    target.z = nz;
    player.rotation.y = Math.atan2(-d[0], -d[1]);                
    hop.time = HOP_TIME;
    hop.height = HOP_HEIGHT;
    hop.t = 0;                                                  
});


//  10. BUCLE PRINCIPAL 
const clock = new THREE.Clock();
const camGoal = new THREE.Vector3();    

updateMenuRecords();                    
reset();                                

renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);                 

    
    player.position.lerp(target, 1 - Math.exp(-(current.jump ? 10 : 20) * dt));
    if (state === 'playing') update(dt);                         
    animateHop(dt);                                              

    
    ground.position.z = player.position.z;
    camGoal.set(player.position.x, 10, player.position.z + 8);
    camera.position.lerp(camGoal, 1 - Math.exp(-5 * dt));
    camera.lookAt(player.position.x, 0, player.position.z - 1);

    renderer.render(scene, camera);
});