import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

//  1. ESCENA, CÁMARA Y LUCES
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);               

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

//  2. AJUSTES 
const ROW = 2;            // alto de cada fila 
const STEP_X = 2;         // lo que se mueve hacia los lados en cada pulsación
const SIDE = 10;          // límite lateral
const KILL_X = SIDE + 2;  // en el río, si la corriente te lleva más allá de esto, pierdes
const ROWS_AHEAD = 20;    // filas que siempre hay creadas por delante del jugador
const BACK_LIMIT = 3;     // cuántas filas se puede retroceder
const EDGE = 12;          // los árboles se colocan más lejos que esto 
const HOP_HEIGHT = 0.6;   // qué tan alto salta el personaje
const HOP_TIME = 0.22;    // cuánto dura cada salto 


//  3. ELEMENTOS DE LA PÁGINA (index.html)
const menu = document.getElementById('menu');               // menú de niveles
const gameoverEl = document.getElementById('gameover');     // pantalla de Game over
const hud = document.getElementById('hud');                 // puntaje y récord
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const finalScoreEl = document.getElementById('finalScore'); // puntaje final en Game over
const recordMsgEl = document.getElementById('recordMsg');   // mensaje de récord



//  4. MATERIALES Y FORMAS
//  Se crean una sola vez y se reutilizan en todas las filas.
const mat = (color) => new THREE.MeshStandardMaterial({ color });

// Materiales principales
const M = {
    grass: mat(0x66bb6a),   // césped
    road: mat(0x424242),    // calle
    water: mat(0x1976d2),   // agua
    log: mat(0x8d6e63),     // madera del tronco
    glass: mat(0xcfe8ff),   // cabina de los carros
};
const carColors = [0xe53935, 0x1e88e5, 0xfdd835, 0x8e24aa, 0xff7043].map(mat);

// Suelo verde grande que sigue al jugador 
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), M.grass);
ground.position.y = -0.5;
scene.add(ground);

// Franja plana de una fila
const stripGeo = new THREE.PlaneGeometry(80, ROW).rotateX(-Math.PI / 2);

// Carros y camiones 
const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 1);                          // carrocería
const cabinGeo = new THREE.BoxGeometry(0.9, 0.4, 0.85);                      // cabina
const tireGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12).rotateX(Math.PI / 2);   // rueda
const tireMat = mat(0x111111);
const lampGeo = new THREE.BoxGeometry(0.05, 0.12, 0.2);                      // faro
const lampMat = new THREE.MeshBasicMaterial({ color: 0xffff99 });
const cargoMat = mat(0xeeeeee);                                              // caja del camión

// Decoración del nivel 1 
const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6);
const crownGeo = new THREE.ConeGeometry(0.8, 1.8, 7);
const flowerGeo = new THREE.SphereGeometry(0.08, 6, 6);
const trunkMat = mat(0x6d4c41);
const crownMats = [0x2e7d32, 0x388e3c, 0x1b5e20].map(mat);
const flowerMats = [0xffffff, 0xffeb3b, 0xf06292, 0xba68c8].map(mat);
const dashGeo = new THREE.PlaneGeometry(0.9, 0.12).rotateX(-Math.PI / 2);
const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Troncos, agua y orillas del nivel 2 
const logGeos = {};      // un cilindro por cada largo de tronco (se guarda para reutilizarlo)
const getLogGeo = (len) => (logGeos[len] ||= new THREE.CylinderGeometry(0.55, 0.55, len, 12).rotateZ(Math.PI / 2));
const foamGeos = {};     // espuma que rodea al tronco
const getFoamGeo = (len) => (foamGeos[len] ||= new THREE.PlaneGeometry(len + 0.8, 1.5).rotateX(-Math.PI / 2));
const endGeo = new THREE.CircleGeometry(0.5, 12).rotateY(Math.PI / 2);       // punta clara del tronco
const knotGeo = new THREE.SphereGeometry(0.12, 8, 8);                        // nudo
const endMat = new THREE.MeshStandardMaterial({ color: 0xd7b98e, side: THREE.DoubleSide });
const knotMat = mat(0x5d4037);
const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

const stripeGeo = new THREE.PlaneGeometry(1, 0.07).rotateX(-Math.PI / 2);    // franja de corriente
const stripeMat = new THREE.MeshBasicMaterial({ color: 0x90caf9, transparent: true, opacity: 0.55 });

const edgeGeo = new THREE.PlaneGeometry(80, 0.4).rotateX(-Math.PI / 2);      // arena de la orilla
const sandMat = mat(0xd9c28f);
const rockGeo = new THREE.DodecahedronGeometry(0.25);                        // roca
const rockMat = mat(0x8d8d8d);
const reedGeo = new THREE.CylinderGeometry(0.025, 0.03, 1, 5).translate(0, 0.5, 0);      // junco
const reedMat = mat(0x7cb342);



//  5. ESTADO DEL JUEGO

let level = 1;              // nivel actual 
let state = 'menu';         // 'menu' | 'playing' | 'gameover'
let rows = [];              // filas creadas hasta ahora
let score = 0;              // fila más lejana alcanzada
let hopT = 1;             // avance del salto: 0 = empieza, 1 = terminado
const best = { 1: 0, 2: 0 };    // récord de cada nivel 

const world = new THREE.Group();    // aquí viven todas las filas
scene.add(world);

const player = new THREE.Group();   // personaje 
scene.add(player);
const target = new THREE.Vector3(); // casilla a la que se dirige el personaje


//  6. PERSONAJES (modelos .glb)
// Carga un modelo, lo ajusta al tamaño de una casilla y lo apoya en el suelo.
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

const chicken = await loadCharacter('models/gallina.glb', -Math.PI / 2);     // nivel 1
const frog = await loadCharacter('models/rana.glb', -Math.PI);       // nivel 2


//  7. CONSTRUCCIÓN DE OBJETOS

// Nivel 1: carros y camiones 
function makeCar(dir, length = 1.8) {
    const truck = length > 2;
    const car = new THREE.Group();

    const body = new THREE.Mesh(bodyGeo, carColors[Math.floor(Math.random() * carColors.length)]);
    body.scale.x = length / 1.8;
    body.position.y = 0.45;
    car.add(body);

    const cabin = new THREE.Mesh(cabinGeo, M.glass);
    cabin.position.set(truck ? length / 2 - 0.6 : -0.1, 0.9, 0);
    car.add(cabin);

    if (truck) {
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(length - 1.5, 0.8, 0.95), cargoMat);
        cargo.position.set(-length / 2 + (length - 1.5) / 2, 1.1, 0);
        car.add(cargo);
    }

    const wheelXs = truck ? [-length / 2 + 0.4, 0, length / 2 - 0.4] : [-0.6, 0.6];
    for (const x of wheelXs) {                          // ruedas
        for (const z of [-0.5, 0.5]) {
            const wheel = new THREE.Mesh(tireGeo, tireMat);
            wheel.position.set(x, 0.22, z);
            car.add(wheel);
        }
    }

    for (const z of [-0.3, 0.3]) {                      // faros delanteros
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(length / 2 + 0.01, 0.5, z);
        car.add(lamp);
    }

    car.rotation.y = dir === 1 ? 0 : Math.PI;           // el frente apunta hacia donde va
    return car;
}

// Nivel 1: decoración 
// Un árbol de tamaño aleatorio
function makeTree() {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.4;
    const crown = new THREE.Mesh(crownGeo, crownMats[Math.floor(Math.random() * crownMats.length)]);
    crown.position.y = 1.7;
    tree.add(trunk, crown);
    tree.scale.setScalar(0.8 + Math.random() * 0.7);
    return tree;
}

// Árboles a los lados y flores en el césped
function decorate(group) {
    for (const side of [-1, 1]) {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let k = 0; k < n; k++) {
            const tree = makeTree();
            tree.position.set(side * (EDGE + Math.random() * 12), 0, (Math.random() - 0.5) * 1.4);
            group.add(tree);
        }
    }
    for (let k = 0; k < 10; k++) {
        const flower = new THREE.Mesh(flowerGeo, flowerMats[Math.floor(Math.random() * flowerMats.length)]);
        flower.position.set((Math.random() - 0.5) * 20, 0.08, (Math.random() - 0.5) * 1.6);
        group.add(flower);
    }
}

// Línea blanca discontinua entre dos calles seguidas
function makeDashes() {
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 30);
    const m = new THREE.Matrix4();
    for (let k = 0; k < 30; k++) {
        dashes.setMatrixAt(k, m.makeTranslation(-29 + k * 2, 0.02, ROW / 2));
    }
    dashes.frustumCulled = false;
    return dashes;
}

// Nivel 2: troncos 
// Cilindro con puntas claras, dos nudos y espuma alrededor
function makeLog(length) {
    const log = new THREE.Group();
    log.add(new THREE.Mesh(getLogGeo(length), M.log));

    for (const s of [-1, 1]) {                          // puntas
        const end = new THREE.Mesh(endGeo, endMat);
        end.position.x = s * (length / 2 + 0.005);
        log.add(end);
    }
    for (let k = 0; k < 2; k++) {                       // nudos
        const knot = new THREE.Mesh(knotGeo, knotMat);
        knot.position.set((Math.random() - 0.5) * (length - 1), 0.5, (Math.random() < 0.5 ? -1 : 1) * 0.25);
        knot.scale.set(1, 0.6, 1);
        log.add(knot);
    }
    const foam = new THREE.Mesh(getFoamGeo(length), foamMat);   // espuma
    foam.position.y = 0.47;
    log.add(foam);

    log.position.y = -0.45;                             // el tronco queda medio hundido
    return log;
}

// Nivel 2: orillas (césped junto al río) 
// Franja de arena donde toca el agua, juncos y rocas
function decorateBank(group, i) {
    for (const s of i >= 2 ? [-1, 1] : i === 1 ? [-1] : []) {   // solo los lados que tocan el agua
        const edge = new THREE.Mesh(edgeGeo, sandMat);
        edge.position.set(0, 0.01, s * 0.8);
        group.add(edge);
    }
    for (let k = 0; k < 14; k++) {                      // juncos
        const reed = new THREE.Mesh(reedGeo, reedMat);
        reed.position.set((Math.random() - 0.5) * 30, 0, (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.2));
        reed.scale.y = 0.7 + Math.random() * 0.8;
        group.add(reed);
    }
    for (let k = 0; k < 5; k++) {                       // rocas
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set((Math.random() - 0.5) * 30, 0.1, (Math.random() - 0.5) * 1.2);
        rock.scale.setScalar(0.5 + Math.random());
        rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        group.add(rock);
    }
}

// Nivel 2: franjas claras sobre el agua (se mueven con la corriente) 
function addFlow(group, row) {
    row.stripes = [];
    const n = Math.ceil(row.period / 6);
    for (let k = 0; k < n; k++) {
        const s = new THREE.Mesh(stripeGeo, stripeMat);
        s.scale.x = 1 + Math.random() * 1.5;
        s.position.set(-row.period / 2 + k * 6 + Math.random() * 3, 0.011, (Math.random() - 0.5) * 1.5);
        group.add(s);
        row.stripes.push(s);
    }
}


//  8. GENERACIÓN DEL MUNDO

// Crea la fila número i: césped (zona segura), calle con vehículos o río con troncos
function makeRow(i) {
    const group = new THREE.Group();
    group.position.z = -i * ROW;
    world.add(group);

    // Las 2 primeras filas son seguras; luego el césped sale al azar (nunca 2 seguidas)
    const safe = i < 2 || (!rows[i - 1].safe && Math.random() < 0.3);
    const row = { group, safe, things: [] };

    // Franja de la fila: césped, calle o agua según el nivel
    group.add(new THREE.Mesh(stripGeo, safe ? M.grass : level === 1 ? M.road : M.water));

    // Filas seguras: solo decoración
    if (safe) {
        if (level === 1) decorate(group);
        else decorateBank(group, i);
        return row;
    }
    if (level === 1 && !rows[i - 1].safe) group.add(makeDashes());

    // Filas peligrosas: carros o troncos que se mueven de lado a lado
    const river = level === 2;
    row.dir = i % 2 ? 1 : -1;                           // alterna el sentido en cada fila
    row.speed = river
        ? 1.5 + Math.random() * 2 + Math.min(i * 0.04, 3)       // troncos
        : 5 + Math.random() * 3 + Math.min(i * 0.06, 5);        // carros 
    row.width = river ? 2 + Math.floor(Math.random() * 3)       // tronco de largo 
        : Math.random() < 0.3 ? 3.2 : 1.8;                      // camión  o carro

    const spacing = row.width + (river ? 2.5 + Math.random() : 6 + Math.random() * 6);   // separación
    const count = Math.ceil(50 / spacing);
    row.period = count * spacing;                       // recorrido total antes de reaparecer
    const offset = Math.random() * spacing;

    for (let k = 0; k < count; k++) {
        const thing = river ? makeLog(row.width) : makeCar(row.dir, row.width);
        thing.position.x = -row.period / 2 + k * spacing + offset;
        group.add(thing);
        row.things.push(thing);
    }

    if (river) addFlow(group, row);
    return row;
}

// Empieza una partida nueva: borra el mundo, crea filas y coloca al jugador al inicio
function reset() {
    world.clear();
    rows = [];
    score = 0;
    while (rows.length < ROWS_AHEAD) rows.push(makeRow(rows.length));

    player.position.set(0, 0, 0);
    target.set(0, 0, 0);
    player.rotation.y = 0;
    chicken.visible = level === 1;                      // gallina en el nivel 1
    frog.visible = level === 2;
    
    hopT = 1;// rana en el nivel 2

    scoreEl.textContent = 0;
    bestEl.textContent = best[level];
}


//  9. REGLAS DE PÉRDIDA 

// Nivel 1: pierde si un vehículo de su fila lo toca
function hitCar(row) {
    return row.things.some((car) => Math.abs(player.position.x - car.position.x) < row.width / 2 + 0.3);
}

// Nivel 2: pierde si cae al agua o si la corriente lo saca de la zona
function hitWater(row, dt) {
    // Si todavía está saltando hacia o desde esta fila, no cuenta
    if (Math.abs(player.position.z - row.group.position.z) > 0.3) return false;

    const log = row.things.find((l) => Math.abs(player.position.x - l.position.x) < row.width / 2 + 0.1);
    if (log) {
        const dx = row.dir * row.speed * dt;            // el tronco lo arrastra
        player.position.x += dx;
        target.x += dx;
        return Math.abs(player.position.x) > KILL_X;    // la corriente lo saca de la zona
    }
    return player.position.distanceTo(target) < 0.3;    // sin tronco: cae al agua (si ya terminó de moverse)
}

//  10. ACTUALIZACIÓN EN CADA FOTOGRAMA

// Mueve un objeto de la fila; al salir por un lado reaparece por el otro
function slide(obj, row, dt, speedFactor = 1) {
    obj.position.x += row.dir * row.speed * speedFactor * dt;
    if (obj.position.x > row.period / 2) obj.position.x -= row.period;
    if (obj.position.x < -row.period / 2) obj.position.x += row.period;
}

// Mueve vehículos, troncos y franjas de agua
function moveObjects(dt) {
    for (const row of rows) {
        for (const thing of row.things) slide(thing, row, dt);
        for (const stripe of row.stripes || []) slide(stripe, row, dt, 0.5);   // el agua va más lenta
    }
}

// Lógica principal del juego (solo corre mientras se juega)
function update(dt) {
    moveObjects(dt);

    // Puntaje: la fila más lejana que ha alcanzado el jugador
    const playerRow = Math.round(-player.position.z / ROW);
    if (playerRow > score) {
        score = playerRow;
        scoreEl.textContent = score;
    }

    // Crea filas nuevas por delante
    while (rows.length < score + ROWS_AHEAD) rows.push(makeRow(rows.length));

    // Revisa si el jugador pierde en la fila donde está
    const row = rows[playerRow];
    if (row && !row.safe && Math.abs(player.position.z - row.group.position.z) < 0.6) {
        const dead = level === 1 ? hitCar(row) : hitWater(row, dt);
        if (dead) gameOver();
    }
}

// Animación de salto: el personaje sube y baja, y se estira un poco en el aire
function animateHop(dt) {
    const who = level === 1 ? chicken : frog;       // el personaje visible
    if (hopT < 1) hopT = Math.min(hopT + dt / HOP_TIME, 1);

    const s = Math.sin(hopT * Math.PI);             // 0 → 1 → 0 durante el salto
    const stretch = 1 + 0.2 * s;                    // más alto en el aire
    const squash = 1 / Math.sqrt(stretch);          // y más angosto, para conservar el volumen

    who.position.y = s * HOP_HEIGHT;
    who.scale.set(squash, stretch, squash);
}

//  11. PANTALLAS: MENÚ Y GAME OVER

// Empieza el nivel n y oculta el menú y el Game over
function startLevel(n) {
    document.activeElement?.blur();                     // evita que Enter/Espacio vuelvan a pulsar un botón
    level = n;
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
    state = 'gameover';

    let msg, isRecord = false;
    if (score > previous) {
        msg = ' ¡Superaste tu récord!';
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

// Vuelve al menú de niveles
function showMenu() {
    state = 'menu';
    menu.classList.remove('hidden');
    gameoverEl.classList.add('hidden');
    hud.classList.add('hidden');
}

// Botones de las pantallas
document.querySelectorAll('#menu button').forEach((btn) => {
    btn.onclick = () => startLevel(Number(btn.dataset.level));   // elegir nivel
});
document.getElementById('retry').onclick = () => startLevel(level);   // jugar de nuevo
document.getElementById('toMenu').onclick = showMenu;                  // volver al menú



//  12. CONTROLES
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
    if (state !== 'playing' || e.repeat) return;                 // un paso por pulsación

    const nx = target.x + d[0] * STEP_X;                         // lateral: paso corto
    const nz = target.z + d[1] * ROW;                            // adelante / atrás: una fila

    // Límite lateral (si la corriente te sacó, solo puedes volver hacia adentro)
    if (d[0] && Math.abs(nx) > SIDE && Math.abs(nx) >= Math.abs(target.x)) return;
    // Solo se puede retroceder unas pocas filas desde la mejor fila
    if (d[1] && nz > -Math.max(0, score - BACK_LIMIT) * ROW) return;

    target.x = nx;
    target.z = nz;
    player.rotation.y = Math.atan2(-d[0], -d[1]);                // mira hacia donde va
    hopT = 0;                                                    // empieza un salto
});


//  13. BUCLE PRINCIPAL 
const clock = new THREE.Clock();
const camGoal = new THREE.Vector3();    // posición a la que debe ir la cámara

reset();                                // crea el nivel 1 para verlo detrás del menú

renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);                 // tiempo desde el último fotograma

    player.position.lerp(target, 1 - Math.exp(-20 * dt));        // desliza al personaje hacia su casilla
    animateHop(dt);
    if (state === 'playing') update(dt);                         // la lógica solo corre al jugar

    // El suelo y la cámara siguen al jugador
    ground.position.z = player.position.z;
    camGoal.set(player.position.x, 10, player.position.z + 8);
    camera.position.lerp(camGoal, 1 - Math.exp(-5 * dt));
    camera.lookAt(player.position.x, 0, player.position.z - 1);

    renderer.render(scene, camera);
});