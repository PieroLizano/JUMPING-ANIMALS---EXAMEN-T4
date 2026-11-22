//  Lo que usan el juego (main.js) y los dos niveles:
//  ajustes comunes, el personaje, materiales y una función de movimiento.
import * as THREE from 'three';


//  1. AJUSTES COMPARTIDOS
export const ROW = 2;           // alto de cada fila (y lo que avanza el personaje de una vez)
export const SIDE = 10;         // límite lateral: el jugador no puede pasar de aquí
export const HOP_TIME = 0.22;   // cuánto dura un salto normal (segundos)
export const HOP_HEIGHT = 0.6;  // qué tan alto es un salto normal


//  2. OBJETOS COMPARTIDOS
export const player = new THREE.Group();    // el personaje (gallina o rana)
export const target = new THREE.Vector3();  // casilla a la que se dirige el personaje

// Estado del salto actual (lo usan main.js y el salto largo del nivel 2)
export const hop = {
    t: 1,                   // avance: 0 = empieza, 1 = terminado
    time: HOP_TIME,         // duración del salto actual
    height: HOP_HEIGHT,     // altura del salto actual
};


//  3. MATERIALES Y FORMAS
export const mat = (color) => new THREE.MeshStandardMaterial({ color });
export const grassMat = mat(0x66bb6a);                                     // césped
export const stripGeo = new THREE.PlaneGeometry(80, ROW).rotateX(-Math.PI / 2);   // franja plana de una fila


//  4. MOVIMIENTO
// Mueve un objeto de la fila; al salir por un lado reaparece por el otro
export function slide(obj, row, dt, speedFactor = 1) {
    obj.position.x += row.dir * row.speed * speedFactor * dt;
    if (obj.position.x > row.period / 2) obj.position.x -= row.period;
    if (obj.position.x < -row.period / 2) obj.position.x += row.period;
}