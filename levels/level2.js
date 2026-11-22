
//  NIVEL 2: EL RÍO
//  Una rana salta de tronco en tronco y de nenúfar en nenúfar.
import * as THREE from 'three';
import { ROW, SIDE, player, target, hop, mat, grassMat, stripGeo, slide } from '../shared.js';


//  1. AJUSTES 

const KILL_X = SIDE + 2;  // si la corriente te lleva más allá de esto, pierdes
const WARN_X = KILL_X - 4;// desde aquí empieza el aviso rojo en el costado de la pantalla

// Salto largo de la rana hacia el tronco o nenúfar del costado
const LONG_HOP_TIME = 0.32;     
const LONG_HOP_HEIGHT = 1.0;    
const MAX_REACH = 3;            

// Troncos que se hunden (los troncos oscuros)
const WARN_TIME = 0.9;    
const SINK_TIME = 1.0;    
const SINK_DEPTH = 0.5;   
const DOWN_TIME = 3;      
const RISE_TIME = 1.5;    



//  2. MATERIALES Y FORMAS
//  Se crean una sola vez y se reutilizan en todas las filas.

const waterMat = mat(0x1976d2);     // agua
const logMat = mat(0x8d6e63);       // tronco normal (aguanta)
const rotLogMat = mat(0x4e342e);    // tronco oscuro (se hunde)

// Troncos
const LOG_Y = -0.2;      // altura del centro del tronco 
const LOG_R = 0.55;      // radio del tronco
const logGeos = {};      // un cilindro por cada largo de tronco 
const getLogGeo = (len) => (logGeos[len] ||= new THREE.CylinderGeometry(LOG_R, LOG_R, len, 12).rotateZ(Math.PI / 2));
const foamGeos = {};     // espuma que rodea al tronco
const getFoamGeo = (len) => (foamGeos[len] ||= new THREE.PlaneGeometry(len + 0.8, 1.5).rotateX(-Math.PI / 2));
const endGeo = new THREE.CircleGeometry(0.5, 12).rotateY(Math.PI / 2);       // punta clara
const knotGeo = new THREE.SphereGeometry(0.12, 8, 8);                        // nudo
const endMat = new THREE.MeshStandardMaterial({ color: 0xd7b98e, side: THREE.DoubleSide });
const knotMat = mat(0x5d4037);
const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

// Nenúfar: disco verde con una muesca, a veces con una flor
const lilyGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16, 1, false, 0.5, Math.PI * 2 - 0.5);
const lilyMat = mat(0x43a047);
const lilyFlowerGeo = new THREE.SphereGeometry(0.16, 8, 6);
const lilyFlowerMat = mat(0xf48fb1);

// Agua y orillas
const stripeGeo = new THREE.PlaneGeometry(1, 0.07).rotateX(-Math.PI / 2);    // franja de corriente
const stripeMat = new THREE.MeshBasicMaterial({ color: 0x90caf9, transparent: true, opacity: 0.55 });
const edgeGeo = new THREE.PlaneGeometry(80, 0.4).rotateX(-Math.PI / 2);      // arena de la orilla
const sandMat = mat(0xd9c28f);
const rockGeo = new THREE.DodecahedronGeometry(0.25);                        // roca
const rockMat = mat(0x8d8d8d);
const reedGeo = new THREE.CylinderGeometry(0.025, 0.03, 1, 5).translate(0, 0.5, 0);      // junco
const reedMat = mat(0x7cb342);

// Marcas del límite del río: franja roja translúcida y una boya
const dangerGeo = new THREE.PlaneGeometry(10, ROW).rotateX(-Math.PI / 2);
const dangerMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.3 });
const buoyGeo = new THREE.SphereGeometry(0.2, 10, 8);
const buoyMat = mat(0xe53935);

// Avisos rojos en los costados de la pantalla (vienen de index.html)
const dangerL = document.getElementById('dangerL');
const dangerR = document.getElementById('dangerR');



//  3. ESTADO DEL NIVEL

let riding = null;      // tronco o nenúfar sobre el que está el jugador 
let jump = null;        // salto largo en curso



//  4. CONSTRUCCIÓN DE OBJETOS
// Tronco: cilindro con puntas claras, dos nudos y espuma. Si sinks es true, es oscuro y se hunde.
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

// Nenúfar: plataforma pequeña de una sola casilla
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

// Orillas : franja de arena donde toca el agua, juncos y rocas
function decorateBank(group, i) {
    for (const s of i >= 2 ? [-1, 1] : i === 1 ? [-1] : []) {   
        const edge = new THREE.Mesh(edgeGeo, sandMat);
        edge.position.set(0, 0.01, s * 0.8);
        group.add(edge);
    }
    for (let k = 0; k < 14; k++) {                     
        const reed = new THREE.Mesh(reedGeo, reedMat);
        reed.position.set((Math.random() - 0.5) * 30, 0, (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.2));
        reed.scale.y = 0.7 + Math.random() * 0.8;
        group.add(reed);
    }
    for (let k = 0; k < 5; k++) {                       
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set((Math.random() - 0.5) * 30, 0.1, (Math.random() - 0.5) * 1.2);
        rock.scale.setScalar(0.5 + Math.random());
        rock.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        group.add(rock);
    }
}

// Franjas claras sobre el agua 
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

// Marcas del límite del río: a cada lado hay una boya y una franja roja.
// Más allá de ahí la corriente pierdes.
function addLimitMarks(group) {
    for (const s of [-1, 1]) {
        const zone = new THREE.Mesh(dangerGeo, dangerMat);
        zone.position.set(s * (KILL_X + 5), 0.015, 0);
        group.add(zone);

        const buoy = new THREE.Mesh(buoyGeo, buoyMat);
        buoy.position.set(s * KILL_X, 0.1, 0);
        group.add(buoy);
    }
}



//  5. GENERACIÓN DE FILAS
// Velocidad propia de cada tronco o nenúfar: un poco más lenta o más rápida que la de su fila
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
    const pads = Math.random() < 0.35;                 
    row.dir = i % 2 ? 1 : -1;                          
    row.speed = 1.5 + Math.random() * 2 + Math.min(i * 0.04, 3);   
    if (pads) row.speed *= 0.85;                        

    // Largo de cada plataforma y separación entre ellas
    const len = pads ? 1.6 : 2 + Math.floor(Math.random() * 3);    
    const gap = pads ? 1.5 + Math.random() * 1.5 : 2.5 + Math.random();
    const spacing = len + gap;
    const count = Math.ceil(50 / spacing);
    row.period = count * spacing;                       
    const offset = Math.random() * spacing;
    const sinkChance = Math.min(0.15 + i * 0.005, 0.4); 

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
    addLimitMarks(group);
    return row;
}



//  6. MOVIMIENTO DEL RÍO
// Hundimiento de un tronco oscuro: aguanta un rato, se tambalea, se hunde, espera y vuelve a salir
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

    // Se tambalea antes y durante el hundimiento (es el aviso)
    const shake = t.mode === 0 ? t.stand / WARN_TIME : t.mode === 1 ? 1 : 0;
    t.rotation.z = Math.sin(performance.now() / 40) * 0.07 * shake;
}

// Mueve los troncos y nenúfares de una fila. Cada uno tiene su velocidad:
// si uno alcanza al que va delante, se frena detrás de él (así no se atraviesan).
function moveRiverRow(row, dt) {
    const list = row.things;
    const n = list.length;

    for (const t of list) {
        t.startX = t.position.x;
        t.position.x += row.dir * t.speed * dt;
    }

    for (let k = 0; k < n; k++) {
        const t = list[k];
        const lead = list[(k + row.dir + n) % n];       
        let gap = ((lead.position.x - t.position.x) * row.dir) % row.period;
        if (gap < 0) gap += row.period;
        const minGap = (t.w + lead.w) / 2 + 1;          // distancia mínima entre centros
        if (gap < minGap) t.position.x = lead.position.x - row.dir * minGap;
    }

    for (const t of list) {
        t.dx = t.position.x - t.startX;                 
        updateSink(t, dt);
        // Al salir por un lado reaparece por el otro, con otra velocidad
        if (t.position.x > row.period / 2) { t.position.x -= row.period; t.speed = thingSpeed(row); }
        else if (t.position.x < -row.period / 2) { t.position.x += row.period; t.speed = thingSpeed(row); }
    }
}

// Mueve el río (troncos, nenúfares y franjas de agua) y sigue el salto largo
function update(dt, rows) {
    riding = null;
    for (const row of rows) {
        if (!row.safe) moveRiverRow(row, dt);
        for (const stripe of row.stripes || []) slide(stripe, row, dt, 0.5);   
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

// Busca el tronco o nenúfar más cercano hacia un lado.
// Devuelve la plataforma y el punto de ella donde aterrizará, o null si no hay ninguna al alcance.
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

// Salto largo: estando sobre una plataforma, salta a la más cercana del costado
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



//  8. AVISO DE PELIGRO
// Aviso rojo en el costado de la pantalla cuando la corriente te acerca al límite
function updateDanger() {
    const d = riding
        ? Math.min(Math.max((Math.abs(player.position.x) - WARN_X) / (KILL_X - WARN_X), 0), 1)
        : 0;
    const right = player.position.x > 0;
    dangerR.style.opacity = right ? d : 0;
    dangerL.style.opacity = right ? 0 : d;
}

function clearDanger() {
    dangerL.style.opacity = 0;
    dangerR.style.opacity = 0;
}



//  9. LO QUE OFRECE ESTE NIVEL A main.js
export const level2 = {
    get riding() { return riding; },        // plataforma sobre la que está el jugador
    get jump() { return jump; },            // salto largo en curso (o null)
    reset() {                               // empieza el nivel
        riding = null;
        jump = null;
        clearDanger();
    },
    makeRow,
    update,
    checkLoss,
    tryJump,
    lateUpdate: updateDanger,
    clearWarnings: clearDanger,
};