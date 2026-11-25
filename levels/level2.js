import * as THREE from 'three';
import { ROW, SIDE, player, target, hop, mat, grassMat, stripGeo, slide } from '../shared.js';


//  1. AJUSTES 

const KILL_X = SIDE + 6;  // si la corriente te lleva más allá de esto, pierdes

// Salto largo de la rana hacia el tronco o nenúfar del costado
const LONG_HOP_TIME = 0.32;     
const LONG_HOP_HEIGHT = 1.0;    
const MAX_REACH = 6;            

// Troncos que se hunden 
const WARN_TIME = 0.9;    
const SINK_TIME = 1.0;    
const SINK_DEPTH = 0.5;   
const DOWN_TIME = 3;      
const RISE_TIME = 1.5;    



//  2. MATERIALES Y FORMAS
//  Se crean una sola vez y se reutilizan en todas las filas.

const waterMat = mat(0x1976d2);     
const logMat = mat(0x8d6e63);       
const rotLogMat = mat(0x4e342e);    

// Troncos
const LOG_Y = -0.2;      
const LOG_R = 0.55;      
const logGeos = {};      
const getLogGeo = (len) => (logGeos[len] ||= new THREE.CylinderGeometry(LOG_R, LOG_R, len, 12).rotateZ(Math.PI / 2));
const foamGeos = {};    
const getFoamGeo = (len) => (foamGeos[len] ||= new THREE.PlaneGeometry(len + 0.8, 1.5).rotateX(-Math.PI / 2));
const endGeo = new THREE.CircleGeometry(0.5, 12).rotateY(Math.PI / 2);       
const knotGeo = new THREE.SphereGeometry(0.12, 8, 8);                        
const endMat = new THREE.MeshStandardMaterial({ color: 0xd7b98e, side: THREE.DoubleSide });
const knotMat = mat(0x5d4037);
const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

// Nenúfar
const lilyGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16, 1, false, 0.5, Math.PI * 2 - 0.5);
const lilyMat = mat(0x43a047);
const lilyFlowerGeo = new THREE.SphereGeometry(0.16, 8, 6);
const lilyFlowerMat = mat(0xf48fb1);

// Agua y orillas
const stripeGeo = new THREE.PlaneGeometry(1, 0.07).rotateX(-Math.PI / 2);    
const stripeMat = new THREE.MeshBasicMaterial({ color: 0x90caf9, transparent: true, opacity: 0.55 });
const edgeGeo = new THREE.PlaneGeometry(80, 0.4).rotateX(-Math.PI / 2);      
const sandMat = mat(0xd9c28f);
const rockGeo = new THREE.DodecahedronGeometry(0.25);                        
const rockMat = mat(0x8d8d8d);
const reedGeo = new THREE.CylinderGeometry(0.025, 0.03, 1, 5).translate(0, 0.5, 0);      
const reedMat = mat(0x7cb342);

// Cascada del borde
const fallZoneGeo = new THREE.PlaneGeometry(10, ROW).rotateX(-Math.PI / 2);          
const fallZoneMat = new THREE.MeshBasicMaterial({ color: 0xb3e5fc });                
const lipGeo = new THREE.PlaneGeometry(1.2, ROW).rotateX(-Math.PI / 2);              
const lipMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const streakGeo = new THREE.PlaneGeometry(1.6, 0.1).rotateX(-Math.PI / 2);           
const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
const puffGeo = new THREE.SphereGeometry(0.5, 8, 6);                                 
const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });



//  3. ESTADO DEL NIVEL

let riding = null;      
let jump = null;        


//  4. CONSTRUCCIÓN DE OBJETOS

// Tronco
function makeLog(length, sinks) {
    const log = new THREE.Group();
    log.add(new THREE.Mesh(getLogGeo(length), sinks ? rotLogMat : logMat));

    for (const s of [-1, 1]) {                          
        const end = new THREE.Mesh(endGeo, endMat);
        end.position.x = s * (length / 2 + 0.005);
        log.add(end);
    }
    for (let k = 0; k < 2; k++) {                       
        const knot = new THREE.Mesh(knotGeo, knotMat);
        knot.position.set((Math.random() - 0.5) * (length - 1), 0.5, (Math.random() < 0.5 ? -1 : 1) * 0.25);
        knot.scale.set(1, 0.6, 1);
        log.add(knot);
    }
    log.foam = new THREE.Mesh(getFoamGeo(length), foamMat);     
    log.foam.position.y = 0.02 - LOG_Y;
    log.add(log.foam);

    log.position.y = LOG_Y;
    log.top = LOG_R;                                    
    log.sinks = sinks;                                  
    return log;
}

// Nenúfar
function makeLily() {
    const pad = new THREE.Group();
    const disc = new THREE.Mesh(lilyGeo, lilyMat);
    disc.rotation.y = Math.random() * Math.PI * 2;     
    pad.add(disc);
    if (Math.random() < 0.4) {                          
        const flower = new THREE.Mesh(lilyFlowerGeo, lilyFlowerMat);
        flower.position.set(0.25, 0.12, 0.1);
        pad.add(flower);
    }
    pad.position.y = 0.02;
    pad.top = 0.04;
    return pad;
}

// Orillas 
function decorateBank(group, i) {
    for (const s of i >= 2 ? [-1, 1] : i === 1 ? [-1] : []) {  
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

// Cascada del borde
function addWaterfall(group, row) {
    row.falls = [];
    row.puffs = [];
    for (const s of [-1, 1]) {
        const zone = new THREE.Mesh(fallZoneGeo, fallZoneMat);          
        zone.position.set(s * (KILL_X + 5), 0.015, 0);
        group.add(zone);

        const lip = new THREE.Mesh(lipGeo, lipMat);                    
        lip.position.set(s * (KILL_X + 0.6), 0.02, 0);
        group.add(lip);

        for (let k = 0; k < 3; k++) {                                   
            const streak = new THREE.Mesh(streakGeo, streakMat);
            streak.side = s;
            streak.position.set(s * (KILL_X + 0.9 + Math.random() * 8), 0.025, (Math.random() - 0.5) * 1.6);
            group.add(streak);
            row.falls.push(streak);
        }

        const puff = new THREE.Mesh(puffGeo, puffMat);                  
        puff.position.set(s * (KILL_X + 1.5 + Math.random() * 2), 0.35, (Math.random() - 0.5));
        puff.scale.set(1.8, 0.8, 1.2);
        puff.phase = Math.random() * 6.28;
        group.add(puff);
        row.puffs.push(puff);
    }
}



//  5. GENERACIÓN DE FILAS

// Velocidad propia de cada tronco o nenúfar
function thingSpeed(row) {
    return row.speed * (0.65 + Math.random() * 0.7);
}

function makeRow(i, prev) {
    const group = new THREE.Group();


    const safe = i < 2 || (!prev.safe && Math.random() < 0.3);
    const row = { group, safe, things: [] };

    group.add(new THREE.Mesh(stripGeo, safe ? grassMat : waterMat));


    if (safe) {
        decorateBank(group, i);
        return row;
    }

    // Río: troncos o nenúfares que se mueven de lado a lado
    const pads = Math.random() < 0.2;                  
    row.dir = i % 2 ? 1 : -1;                           
    row.speed = 1.5 + Math.random() * 2 + Math.min(i * 0.04, 3);   
    if (pads) row.speed *= 0.85;                       


    const len = pads ? 1.6 : 2 + Math.floor(Math.random() * 3);    
    const gap = pads ? 2.5 + Math.random() * 1.5 : 3.5 + Math.random();
    const spacing = len + gap;
    const count = Math.ceil(50 / spacing);
    row.period = count * spacing;                       
    const offset = Math.random() * spacing;
    const sinkChance = Math.min(0.08 + i * 0.003, 0.25); 

    for (let k = 0; k < count; k++) {
        const thing = pads ? makeLily() : makeLog(len, Math.random() < sinkChance);
        thing.w = len;                                  
        thing.position.x = -row.period / 2 + k * spacing + offset;
        thing.speed = thingSpeed(row);                  
        thing.depth = 0;                                
        thing.mode = 0;                                
        thing.stand = 0;                                
        thing.timer = 0;
        thing.dx = 0;                                  
        thing.occupied = false;
        group.add(thing);
        row.things.push(thing);
    }

    addFlow(group, row);
    addWaterfall(group, row);
    return row;
}



//  6. MOVIMIENTO DEL RÍO

// Hundimiento de un tronco oscuro
function updateSink(t, dt) {
    if (!t.sinks) return;

    if (t.mode === 0) {                                
        t.stand = t.occupied ? t.stand + dt : Math.max(0, t.stand - dt);
        if (t.stand > WARN_TIME) t.mode = 1;
    } else if (t.mode === 1) {                         
        t.depth = Math.min(t.depth + dt / SINK_TIME, 1);
        if (t.depth >= 1) { t.mode = 2; t.timer = DOWN_TIME; }
    } else if (t.mode === 2) {                          
        t.timer -= dt;
        if (t.timer <= 0) t.mode = 3;
    } else {                                            
        t.depth = Math.max(t.depth - dt / RISE_TIME, 0);
        if (t.depth <= 0) { t.mode = 0; t.stand = 0; }
    }
    t.occupied = false;

    t.position.y = LOG_Y - t.depth * SINK_DEPTH;        
    t.foam.position.y = 0.02 - t.position.y;            
    t.foam.visible = t.depth < 0.6;


    const shake = t.mode === 0 ? t.stand / WARN_TIME : t.mode === 1 ? 1 : 0;
    t.rotation.z = Math.sin(performance.now() / 40) * 0.07 * shake;
}

// Mueve los troncos y nenúfares de una fila. 
function moveRiverRow(row, dt) {
    const list = row.things;
    const n = list.length;

    for (const t of list) {
        t.startX = t.position.x;
        t.position.x += row.dir * t.speed * dt;
    }

    for (let k = 0; k < n; k++) {
        const t = list[k];
        const lead = list[(k + row.dir + n) % n];       // el que va justo delante
        let gap = ((lead.position.x - t.position.x) * row.dir) % row.period;
        if (gap < 0) gap += row.period;
        const minGap = (t.w + lead.w) / 2 + 1;          // distancia mínima entre centros
        if (gap < minGap) t.position.x = lead.position.x - row.dir * minGap;
    }

    for (const t of list) {
        t.dx = t.position.x - t.startX;                 // cuánto se movió (arrastra al jugador)
        updateSink(t, dt);
        // Al salir por un lado reaparece por el otro, con otra velocidad
        if (t.position.x > row.period / 2) { t.position.x -= row.period; t.speed = thingSpeed(row); }
        else if (t.position.x < -row.period / 2) { t.position.x += row.period; t.speed = thingSpeed(row); }
    }
}

// Mueve la cascada: los hilos de agua aceleran al alejarse del borde (como si cayeran)
// y la bruma sube y baja suavemente
function moveWaterfall(row, dt, time) {
    for (const f of row.falls) {
        let out = Math.abs(f.position.x) - KILL_X;      // distancia al borde
        out += (3 + out) * dt;                          // acelera al alejarse
        if (out > 9) out = 0.9;                         // vuelve a empezar en el borde
        f.position.x = f.side * (KILL_X + out);
    }
    for (const p of row.puffs) {
        p.position.y = 0.35 + Math.sin(time * 2 + p.phase) * 0.12;
    }
}


function update(dt, rows) {
    riding = null;
    const time = performance.now() / 1000;
    for (const row of rows) {
        if (!row.safe) moveRiverRow(row, dt);
        for (const stripe of row.stripes || []) slide(stripe, row, dt, 0.5);   
        if (row.falls) moveWaterfall(row, dt, time);                            
    }

    if (jump) {
        target.x = jump.thing.position.x + jump.offset;
        if (hop.t >= 1) {
            player.position.x = target.x;               
            jump = null;
        }
    }
}



//  7. REGLAS Y SALTO LARGO
// Pierde si cae al agua o si la corriente lo saca de la zona
function checkLoss(row) {
    
    if (Math.abs(player.position.z - row.group.position.z) > 0.3) return false;


    const base = row.things.find((t) => Math.abs(player.position.x - t.position.x) < t.w / 2 + 0.1 && t.depth < 0.6);
    if (base) {
        riding = base;
        base.occupied = true;                           
        player.position.x += base.dx;                   
        target.x += base.dx;
        return Math.abs(player.position.x) > KILL_X;    
    }
    return player.position.distanceTo(target) < 0.3;    
}


function findPlatform(row, dirX) {
    let found = null;
    let bestDist = MAX_REACH;
    for (const t of row.things) {
        if (t === riding || t.depth >= 0.6) continue;                
        const toward = (t.position.x - player.position.x) * dirX;   
        if (toward <= 0) continue;
        const dist = toward - t.w / 2;                              
        const landing = THREE.MathUtils.clamp(player.position.x, t.position.x - t.w / 2 + 0.4, t.position.x + t.w / 2 - 0.4);
        if (dist < bestDist && Math.abs(landing) <= SIDE) {          
            found = { thing: t, offset: landing - t.position.x };
            bestDist = dist;
        }
    }
    return found;
}

// Salto largo
function tryJump(dirX, row) {
    if (!riding || !row) return false;
    const dest = findPlatform(row, dirX);
    if (!dest) return false;                            

    jump = dest;
    hop.t = 0;
    hop.time = LONG_HOP_TIME;
    hop.height = LONG_HOP_HEIGHT;
    return true;
}



//  8. LO QUE OFRECE ESTE NIVEL A main.js
export const level2 = {
    get riding() { return riding; },        
    get jump() { return jump; },            
    reset() {                               
        riding = null;
        jump = null;
    },
    makeRow,
    update,
    checkLoss,
    tryJump,
};