//  JUMPING ANIMALS
//  Nivel 1: una gallina cruza calles (levels/level1.js).
//  Nivel 2: una rana cruza un río (levels/level2.js).
//  Este archivo es el "director" del juego: crea la escena, carga los
//  personajes, maneja las pantallas, los controles y el bucle principal.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ROW, SIDE, HOP_TIME, HOP_HEIGHT, player, target, hop, grassMat } from './shared.js';
import { level1 } from './levels/level1.js';
import { level2 } from './levels/level2.js';


//  1. AJUSTES 
const STEP_X = 1;         // lo que se mueve hacia los lados en cada pulsación
const ROWS_AHEAD = 20;    // filas que siempre hay creadas por delante del jugador
const BACK_LIMIT = 3;     // cuántas filas se puede retroceder



//  2. ELEMENTOS DE LA PÁGINA (index.html)
const menu = document.getElementById('menu');               // menú de niveles
const gameoverEl = document.getElementById('gameover');     // pantalla de Game over
const hud = document.getElementById('hud');                 // puntaje y récord
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const finalScoreEl = document.getElementById('finalScore'); // puntaje final en Game over
const recordMsgEl = document.getElementById('recordMsg');   // mensaje de récord
const menuBest = {                                          // récord que se ve en cada tarjeta del menú
    1: document.getElementById('menuBest1'),
    2: document.getElementById('menuBest2'),
};



//  3. ESCENA, CÁMARA Y LUCES
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);               // cielo celeste

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 10, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));           // luz general
const sun = new THREE.DirectionalLight(0xffffff, 1.2);      // luz con dirección 
sun.position.set(5, 10, 5);
scene.add(sun);

// Si cambia el tamaño de la ventana, ajusta la cámara y el lienzo
addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

// Suelo verde grande que sigue al jugador 
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), grassMat);
ground.position.y = -0.5;
scene.add(ground);

const world = new THREE.Group();    // aquí viven todas las filas
scene.add(world);
scene.add(player);                  // el personaje (viene de shared.js)



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

const best = loadBest();            // récord de cada nivel



//  5. PERSONAJES (modelos .glb)
// Carga un modelo, lo ajusta al tamaño de una casilla y lo apoya en el suelo.
// rotationY gira el modelo para que mire hacia adelante.

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

const chicken = await loadCharacter('models/gallina.glb', -Math.PI /2);     // nivel 1
const frog = await loadCharacter('models/rana.glb', -Math.PI );       // nivel 2



//  6. MUNDO: CREAR FILAS Y EMPEZAR PARTIDA
// Crea la siguiente fila con el nivel actual y la coloca al final
function addRow() {
    const i = rows.length;
    const row = current.makeRow(i, rows[i - 1]);        
    row.group.position.z = -i * ROW;
    world.add(row.group);
    rows.push(row);
}

// Empieza una partida nueva: borra el mundo, crea filas y coloca al jugador al inicio
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
    chicken.visible = level === 1;                      // gallina en el nivel 1
    frog.visible = level === 2;                         // rana en el nivel 2

    scoreEl.textContent = 0;
    bestEl.textContent = best[level];
}



//  7. ACTUALIZACIÓN EN CADA FOTOGRAMA
// Lógica principal del juego 
function update(dt) {
    current.update(dt, rows);                           // el nivel mueve lo suyo

    // Puntaje: la fila más lejana que ha alcanzado el jugador
    const playerRow = Math.round(-player.position.z / ROW);
    if (playerRow > score) {
        score = playerRow;
        scoreEl.textContent = score;
    }

    // Crea filas nuevas por delante
    while (rows.length < score + ROWS_AHEAD) addRow();

    // Pregunta al nivel si el jugador pierde en la fila donde está
    const row = rows[playerRow];
    if (row && !row.safe && Math.abs(player.position.z - row.group.position.z) < 0.6) {
        if (current.checkLoss(row)) return gameOver();
    }

    current.lateUpdate();                               // avisos del nivel (por ejemplo, el borde del río)
}

// Animación de salto: el personaje sube y baja, se estira un poco en el aire
// y se apoya a la altura del tronco o nenúfar donde está
function animateHop(dt) {
    const who = level === 1 ? chicken : frog;          // el personaje visible
    if (hop.t < 1) hop.t = Math.min(hop.t + dt / hop.time, 1);

    // Altura de apoyo: sobre un tronco se eleva (y baja con él si se hunde)
    const support = current.riding;
    const goal = support ? support.position.y + support.top : (hop.t < 1 ? rideY : 0);
    rideY += (goal - rideY) * (1 - Math.exp(-15 * dt));

    const s = Math.sin(hop.t * Math.PI);               // 0 → 1 → 0 durante el salto
    const stretch = 1 + 0.2 * s;                       // más alto en el aire
    const squash = 1 / Math.sqrt(stretch);             // y más angosto, para conservar el volumen

    who.position.y = rideY + s * hop.height;
    who.scale.set(squash, stretch, squash);
}



//  8. PANTALLAS: MENÚ Y GAME OVER
// Empieza el nivel n y oculta el menú y el Game over
function startLevel(n) {
    document.activeElement?.blur();                     
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
    current.clearWarnings();

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
    current.clearWarnings();
    state = 'menu';
    menu.classList.remove('hidden');
    gameoverEl.classList.add('hidden');
    hud.classList.add('hidden');
}

// Botones de las pantallas
document.querySelectorAll('#menu button').forEach((btn) => {
    btn.onclick = () => startLevel(Number(btn.dataset.level));  
});
document.getElementById('retry').onclick = () => startLevel(level);   
document.getElementById('toMenu').onclick = showMenu;                  



//  9. CONTROLES
// Cada tecla da una dirección: [lado, avance]
const KEYS = {
    ArrowUp: [0, -1],    KeyW: [0, -1],
    ArrowDown: [0, 1],   KeyS: [0, 1],
    ArrowLeft: [-1, 0],  KeyA: [-1, 0],
    ArrowRight: [1, 0],  KeyD: [1, 0],
};

addEventListener('keydown', (e) => {
    if (e.code === 'Escape') return showMenu();                  // Esc: volver al menú

    if ((e.code === 'Enter' || e.code === 'Space') && state === 'gameover') {
        e.preventDefault();
        return startLevel(level);                                // Enter o Espacio: reintentar
    }

    const d = KEYS[e.code];
    if (!d) return;
    e.preventDefault();
    if (state !== 'playing' || e.repeat || current.jump) return; 

    // Salto especial del nivel (la rana salta a la plataforma del costado)
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
const camGoal = new THREE.Vector3();    // posición a la que debe ir la cámara

updateMenuRecords();                    // muestra los récords guardados al abrir el juego
reset();                                // crea el nivel 1 para verlo detrás del menú

renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);                

    // Desliza al personaje hacia su casilla (más despacio durante el salto largo)
    player.position.lerp(target, 1 - Math.exp(-(current.jump ? 10 : 20) * dt));
    if (state === 'playing') update(dt);                        
    animateHop(dt);                                             

    // El suelo y la cámara siguen al jugador
    ground.position.z = player.position.z;
    camGoal.set(player.position.x, 10, player.position.z + 8);
    camera.position.lerp(camGoal, 1 - Math.exp(-5 * dt));
    camera.lookAt(player.position.x, 0, player.position.z - 1);

    renderer.render(scene, camera);
});