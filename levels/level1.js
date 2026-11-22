//  NIVEL 1: LA CARRETERA
//  Una gallina cruza calles con carros y camiones.
import * as THREE from 'three';
import { ROW, player, mat, grassMat, stripGeo, slide } from '../shared.js';

//  1. AJUSTES
const EDGE = 12;    // los árboles se colocan más lejos que esto (fuera de la zona de juego)

//  2. MATERIALES Y FORMAS
//  Se crean una sola vez y se reutilizan en todas las filas.

const roadMat = mat(0x424242);                                               // calle
const glassMat = mat(0xcfe8ff);                                              // cabina
const carColors = [0xe53935, 0x1e88e5, 0xfdd835, 0x8e24aa, 0xff7043].map(mat);

// Carros y camiones
const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 1);                          // carrocería
const cabinGeo = new THREE.BoxGeometry(0.9, 0.4, 0.85);                      // cabina
const tireGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 12).rotateX(Math.PI / 2);   // rueda
const tireMat = mat(0x111111);
const lampGeo = new THREE.BoxGeometry(0.05, 0.12, 0.2);                      // faro
const lampMat = new THREE.MeshBasicMaterial({ color: 0xffff99 });
const cargoMat = mat(0xeeeeee);                                              // caja del camión

// Decoración 
const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 6);
const crownGeo = new THREE.ConeGeometry(0.8, 1.8, 7);
const flowerGeo = new THREE.SphereGeometry(0.08, 6, 6);
const trunkMat = mat(0x6d4c41);
const crownMats = [0x2e7d32, 0x388e3c, 0x1b5e20].map(mat);
const flowerMats = [0xffffff, 0xffeb3b, 0xf06292, 0xba68c8].map(mat);
const dashGeo = new THREE.PlaneGeometry(0.9, 0.12).rotateX(-Math.PI / 2);
const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });



//  3. CONSTRUCCIÓN DE OBJETOS
// Carros y camiones
function makeCar(dir, length = 1.8) {
    const truck = length > 2;
    const car = new THREE.Group();

    const body = new THREE.Mesh(bodyGeo, carColors[Math.floor(Math.random() * carColors.length)]);
    body.scale.x = length / 1.8;
    body.position.y = 0.45;
    car.add(body);

    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(truck ? length / 2 - 0.6 : -0.1, 0.9, 0);
    car.add(cabin);

    if (truck) {
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(length - 1.5, 0.8, 0.95), cargoMat);
        cargo.position.set(-length / 2 + (length - 1.5) / 2, 1.1, 0);
        car.add(cargo);
    }

    const wheelXs = truck ? [-length / 2 + 0.4, 0, length / 2 - 0.4] : [-0.6, 0.6];
    for (const x of wheelXs) {                          
        for (const z of [-0.5, 0.5]) {
            const wheel = new THREE.Mesh(tireGeo, tireMat);
            wheel.position.set(x, 0.22, z);
            car.add(wheel);
        }
    }

    for (const z of [-0.3, 0.3]) {                      
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(length / 2 + 0.01, 0.5, z);
        car.add(lamp);
    }

    car.rotation.y = dir === 1 ? 0 : Math.PI;           
    return car;
}

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


//  4. GENERACIÓN DE FILAS
// Crea la fila i: césped (zona segura) o calle con carros y camiones
function makeRow(i, prev) {
    const group = new THREE.Group();

    // Las 2 primeras filas son seguras
    const safe = i < 2 || (!prev.safe && Math.random() < 0.3);
    const row = { group, safe, things: [] };

    group.add(new THREE.Mesh(stripGeo, safe ? grassMat : roadMat));

    if (safe) {
        decorate(group);
        return row;
    }
    if (!prev.safe) group.add(makeDashes());            // línea entre dos calles seguidas

    // Calle: vehículos que van de lado a lado
    row.dir = i % 2 ? 1 : -1;                           // alterna el sentido en cada fila
    row.speed = 5 + Math.random() * 3 + Math.min(i * 0.06, 5);   // más rápido con la distancia
    const len = Math.random() < 0.3 ? 3.2 : 1.8;        
    const spacing = len + 6 + Math.random() * 6;        // separación entre vehículos
    const count = Math.ceil(50 / spacing);
    row.period = count * spacing;                       
    const offset = Math.random() * spacing;

    for (let k = 0; k < count; k++) {
        const car = makeCar(row.dir, len);
        car.w = len;                                    
        car.position.x = -row.period / 2 + k * spacing + offset;
        group.add(car);
        row.things.push(car);
    }
    return row;
}


//  5. MOVIMIENTO Y REGLAS

// Mueve todos los vehículos
function update(dt, rows) {
    for (const row of rows) {
        for (const car of row.things) slide(car, row, dt);
    }
}

// Pierde si un vehículo de su fila lo toca
function checkLoss(row) {
    return row.things.some((car) => Math.abs(player.position.x - car.position.x) < car.w / 2 + 0.3);
}


//  6. LO QUE OFRECE ESTE NIVEL A main.js
export const level1 = {
    riding: null,               
    jump: null,                
    reset() {},                
    makeRow,
    update,
    checkLoss,
    tryJump() { return false; },
    lateUpdate() {},
    clearWarnings() {},
};