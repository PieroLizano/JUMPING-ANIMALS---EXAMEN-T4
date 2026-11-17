import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Escena, cámara y luces
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

// Materiales y geometrías 
const ROW = 2;                                    // alto de cada fila = tamaño del paso
const mat = (color) => new THREE.MeshStandardMaterial({ color });
const M = { grass: mat(0x66bb6a), road: mat(0x424242), water: mat(0x1e88e5), log: mat(0x8d6e63), glass: mat(0xcfe8ff) };
const carColors = [0xe53935, 0x1e88e5, 0xfdd835, 0x8e24aa, 0xff7043].map(mat);

const stripGeo = new THREE.PlaneGeometry(80, ROW).rotateX(-Math.PI / 2);
const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 1);
const cabinGeo = new THREE.BoxGeometry(0.9, 0.4, 0.85);
const logGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 12).rotateZ(Math.PI / 2);
const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12).rotateX(Math.PI / 2);   // eje en Z
const wheelMat = mat(0x111111);  

const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), M.grass);
ground.position.y = -0.5;
scene.add(ground);

// Estado del juego 
const world = new THREE.Group();                  
scene.add(world);

let level = 1;
let state = 'menu';                               // 'menu' | 'playing'
let rows = [];
let score = 0;                                    // fila más lejana alcanzada
const best = { 1: 0, 2: 0 };

// Jugador 
const player = new THREE.Group();
scene.add(player);
const target = new THREE.Vector3();               


async function loadCharacter(url, rotationY) {
    const model = (await new GLTFLoader().loadAsync(url)).scene;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(0.9 / Math.max(size.x, size.y, size.z));

    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.y -= box.min.y;
    model.position.z -= c.z;

    const holder = new THREE.Group();
    holder.rotation.y = rotationY;                // orientación propia de cada modelo
    holder.add(model);
    player.add(holder);
    return holder;
}

const chicken = await loadCharacter('models/gallina.glb', -Math.PI/2);
const frog = await loadCharacter('models/rana.glb', Math.PI);



function makeCar(dir) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, carColors[Math.floor(Math.random() * carColors.length)]);
    body.position.y = 0.45;
    const cabin = new THREE.Mesh(cabinGeo, M.glass);
    cabin.position.set(-0.1, 0.9, 0);
    car.add(body, cabin);

    
    for (const x of [-0.6, 0.6]) {
        for (const z of [-0.5, 0.5]) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.position.set(x, 0.22, z);
            car.add(wheel);
        }
    }

    car.rotation.y = dir === 1 ? 0 : Math.PI;     
    return car;
}

function makeLog(length) {
    const log = new THREE.Mesh(logGeo, M.log);
    log.scale.x = length;
    log.position.y = -0.45;
    return log;
}

function makeRow(i) {
    const group = new THREE.Group();
    group.position.z = -i * ROW;
    world.add(group);

    // Las 2 primeras filas son seguras
    const safe = i < 2 || (!rows[i - 1].safe && Math.random() < 0.3);
    const row = { group, safe, things: [] };

    group.add(new THREE.Mesh(stripGeo, safe ? M.grass : level === 1 ? M.road : M.water));
    if (safe) return row;

    // Carros (nivel 1) o troncos (nivel 2) se mueven y reaparecen por el otro lado
    const river = level === 2;
    row.dir = i % 2 ? 1 : -1;
    row.speed = river
    ? 2 + Math.random() * 2 + Math.min(i * 0.04, 3)        // troncos 
    : 5 + Math.random() * 3 + Math.min(i * 0.06, 5);         // carros 
    row.width = river ? 2 + Math.floor(Math.random() * 3) : 1.8;                    
    const spacing = row.width + (river ? 2.5 + Math.random() : 6 + Math.random() * 6);
    const count = Math.ceil(50 / spacing);
    row.period = count * spacing;
    const offset = Math.random() * spacing;

    for (let k = 0; k < count; k++) {
        const thing = river ? makeLog(row.width) : makeCar(row.dir);
        thing.position.x = -row.period / 2 + k * spacing + offset;
        group.add(thing);
        row.things.push(thing);
    }
    return row;
}

function reset() {
    world.clear();
    rows = [];
    score = 0;
    while (rows.length < 20) rows.push(makeRow(rows.length));

    target.set(0, 0, 0);
    player.position.set(0, 0, 0);
    player.rotation.y = 0;
    chicken.visible = level === 1;
    frog.visible = level === 2;

    scoreEl.textContent = 0;
    bestEl.textContent = best[level];
}

// Tamaño del movimiento y del mapa 
const STEP_X = 2;         
const SIDE = 10;          
const KILL_X = SIDE + 2;  // en el río, la corriente te saca si pasas de aquí

// Lógica de cada nivel 
function hitCar(row) {                            
    return row.things.some((car) => Math.abs(player.position.x - car.position.x) < row.width / 2 + 0.3);
}

function hitWater(row, dt) {                     
    if (Math.abs(player.position.z - row.group.position.z) > 0.3) return false;

    const log = row.things.find((l) => Math.abs(player.position.x - l.position.x) < row.width / 2 + 0.1);
    if (log) {
        const dx = row.dir * row.speed * dt;      
        player.position.x += dx;
        target.x += dx;
        return Math.abs(player.position.x) > KILL_X;   
    }
    return player.position.distanceTo(target) < 0.3;   
}

// Actualización por frame 
function update(dt) {
    // Mover carros / troncos
    for (const row of rows) {
        for (const t of row.things) {
            t.position.x += row.dir * row.speed * dt;
            if (t.position.x > row.period / 2) t.position.x -= row.period;
            if (t.position.x < -row.period / 2) t.position.x += row.period;
        }
    }

    // Puntaje y generación de filas nuevas por delante
    const pr = Math.round(-player.position.z / ROW);
    if (pr > score) {
        score = pr;
        scoreEl.textContent = score;
    }
    while (rows.length < score + 20) rows.push(makeRow(rows.length));

    // Colisión en la fila donde está el jugador
    const row = rows[pr];
    if (row && !row.safe && Math.abs(player.position.z - row.group.position.z) < 0.6) {
        const dead = level === 1 ? hitCar(row) : hitWater(row, dt);
        if (dead) gameOver();
    }
}

// Controles 
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
    if (state !== 'playing' || e.repeat) return;

    const nx = target.x + d[0] * STEP_X;          
    const nz = target.z + d[1] * ROW;             


    if (d[0] && Math.abs(nx) > SIDE && Math.abs(nx) >= Math.abs(target.x)) return;

    if (d[1] && nz > -Math.max(0, score - 3) * ROW) return;

    target.x = nx;
    target.z = nz;
    player.rotation.y = Math.atan2(-d[0], -d[1]);
});

// Menú y Game over 
const menu = document.getElementById('menu');
const gameoverEl = document.getElementById('gameover');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const finalScoreEl = document.getElementById('finalScore');
const recordMsgEl = document.getElementById('recordMsg');

function startLevel(n) {
    document.activeElement?.blur();               
    level = n;
    reset();
    menu.classList.add('hidden');
    gameoverEl.classList.add('hidden');
    hud.classList.remove('hidden');
    state = 'playing';
}

function gameOver() {
    const previous = best[level];
    best[level] = Math.max(previous, score);
    state = 'gameover';

    let msg, isRecord = false;
    if (score > previous) {
        msg = '¡Nuevo récord!';
        isRecord = true;
    } else if (score > 0 && score === previous) {
        msg = 'Igualaste tu récord';

    } else {
        msg = '¡Intenta avanzar más!';
    }

    finalScoreEl.textContent = `Puntaje: ${score} · Récord: ${best[level]}`;
    recordMsgEl.textContent = msg;
    recordMsgEl.classList.toggle('record', isRecord);
    bestEl.textContent = best[level];
    gameoverEl.classList.remove('hidden');
}

function showMenu() {
    state = 'menu';
    menu.classList.remove('hidden');
    gameoverEl.classList.add('hidden');
    hud.classList.add('hidden');
}

document.querySelectorAll('#menu button').forEach((btn) => {
    btn.onclick = () => startLevel(Number(btn.dataset.level));
});
document.getElementById('retry').onclick = () => startLevel(level);
document.getElementById('toMenu').onclick = showMenu;

// Bucle principal 
const clock = new THREE.Clock();
reset();                                          

renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);

    player.position.lerp(target, 1 - Math.exp(-20 * dt));
    if (state === 'playing') update(dt);

    ground.position.z = player.position.z;
    camera.position.lerp(new THREE.Vector3(player.position.x, 10, player.position.z + 8), 1 - Math.exp(-5 * dt));
    camera.lookAt(player.position.x, 0, player.position.z - 1);

    renderer.render(scene, camera);
});