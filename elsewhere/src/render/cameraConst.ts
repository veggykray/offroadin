import * as THREE from 'three';
/** Fixed isometric view direction (from target toward camera) and its screen basis. */
export const CAM_DIR = new THREE.Vector3(1, 1.05, 1).normalize();
export const CAM_DIST = 70;
export const CAM_RIGHT = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), CAM_DIR).normalize().negate();
export const CAM_UP = new THREE.Vector3().crossVectors(CAM_DIR, CAM_RIGHT).normalize();
