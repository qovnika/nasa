// Import necessary libraries
import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
//import sunTexture from "./assets/images/sun.jpg";
//import starsTexture from ".ssets/images/stars/a.jpg";

// Constants
const G = 39.478;  // Gravitational constant in AU^3 / year^2 / solar mass
const M_sun = 1;   // Mass of the sun in solar masses
let neos = [];

let animation = true;
let orbiter = true;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//Add background to the scene
const cubeTextureLoader = new THREE.CubeTextureLoader();
scene.background = cubeTextureLoader.load([
  "./assets/images/stars.jpg",
  "./assets/images/stars.jpg",
  "./assets/images/stars.jpg",
  "./assets/images/stars.jpg",
  "./assets/images/stars.jpg",
  "./assets/images/stars.jpg"
]);

// Sun (represented as a simple sphere)
const textureLoader = new THREE.TextureLoader();
const sunGeometry = new THREE.SphereGeometry(0.2, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ map: textureLoader.load("./assets/images/sun.jpg") });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

// Function to create a 3D orbit curve for a NEO
function createOrbit(neo) {
  const points = [];
  for (let theta = 0; theta < 2 * Math.PI; theta += 2 * Math.PI / 500) {
    // Radius based on the true anomaly
    const r = (neo.q_au_2 * (1 - neo.e * neo.e)) / (1 + neo.e * Math.cos(theta));
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    points.push(new THREE.Vector3(x, y, 0)); // Orbit in the orbital plane
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: Math.random() * 0xffffff });
  const orbitLine = new THREE.LineLoop(geometry, material);

  // Rotate orbit to match the inclination, ascending node, and periapsis
  orbitLine.rotation.x = neo.i_deg; // Inclination
  orbitLine.rotation.z = neo.node_deg; // Longitude of ascending node

  scene.add(orbitLine);
  return orbitLine;
}

// Function to create the NEO object (small sphere)
function createNEO() {
  const geometry = new THREE.SphereGeometry(0.05, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
  return new THREE.Mesh(geometry, material);
}

// Apply the orbital rotation (inclination, Omega, and periapsis) to the NEO position
function applyOrbitRotation(position, neo) {
  // Rotate around Z-axis for Omega (longitude of the ascending node)
  const x_omega = position.x * Math.cos(neo.node_deg) - position.y * Math.sin(neo.node_deg);
  const y_omega = position.x * Math.sin(neo.node_deg) + position.y * Math.cos(neo.node_deg);

  // Rotate around X-axis for inclination
  const z_incl = position.z * Math.cos(neo.i_deg) - y_omega * Math.sin(neo.i_deg);
  const y_incl = position.z * Math.sin(neo.i_deg) + y_omega * Math.cos(neo.i_deg);

  // Apply argument of periapsis (omega)
  const x_periapsis = x_omega * Math.cos(neo.w_deg) - y_incl * Math.sin(neo.w_deg);
  const y_periapsis = x_omega * Math.sin(neo.w_deg) + y_incl * Math.cos(neo.w_deg);

  return new THREE.Vector3(x_periapsis, y_periapsis, z_incl);
}

// Newton's method to solve Kepler's Equation (E - e*sin(E) = M)
function solveKeplersEquation(M, e, tolerance = 1e-6) {
  let E = M;  // Initial guess
  let deltaE = 1;
  while (Math.abs(deltaE) > tolerance) {
    deltaE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += deltaE;
  }
  return E;
}

// Function to calculate position of the NEO using the true anomaly
function getPositionAtTime(time, neo) {
  const n = Math.sqrt(G * M_sun / Math.pow(neo.q_au_2, 3)); // Mean motion (rad/year)
  const M = n * time; // Mean anomaly increases linearly with time

  // Solve Kepler's equation for Eccentric anomaly (E)
  const E = solveKeplersEquation(M, neo.e);

  // Calculate the True Anomaly (ν)
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + neo.e) * Math.sin(E / 2),
    Math.sqrt(1 - neo.e) * Math.cos(E / 2)
  );

  // Calculate distance r
  const r = neo.q_au_2 * (1 - neo.e * neo.e) / (1 + neo.e * Math.cos(trueAnomaly));

  // Position in the plane of the orbit
  const x = r * Math.cos(trueAnomaly);
  const y = r * Math.sin(trueAnomaly);

  // Return position vector in 3D space (initially in the plane of the orbit)
  return applyOrbitRotation(new THREE.Vector3(x, y, 0), neo);
}

function getData() {
  const xhttp = new XMLHttpRequest();
  xhttp.onload = function () {
    neos = JSON.parse(this.responseText);
    neos.forEach(neo => {
      // Create NEO and its orbit

      const orbit = createOrbit(neo);
      const neoObject = createNEO();

      // Set initial position of the NEO
      neoObject.position.copy(getPositionAtTime(0, neo));

      // Add the NEO to the scene
      scene.add(neoObject);

      // Store both NEO and its parameters
      neoObjects.push({ mesh: neoObject, params: neo });
      orbits.push(orbit);
    });

    animate();
  }
  xhttp.open("GET", "https://data.nasa.gov/resource/b67r-rgxc.json", true);
  xhttp.send();
}

// Create orbits and NEOs
const neoObjects = [];
const orbits = [];

// Set camera position
const pan = new OrbitControls(camera, renderer.domElement);
camera.position.z = 5;
pan.update()

// Animation loop to move all NEOs along their orbits
let time = 0;
function animate() {
  if (animation) {
    requestAnimationFrame(animate);
  } else {
    return;
  }

  neoObjects.forEach(neoObj => {
    // Get the position of the NEO at the current time
    const position = getPositionAtTime(time, neoObj.params);

    // Update NEO position in 3D space
    neoObj.mesh.position.copy(position);
  });

  // Increment time (arbitrary time step, adjust for smoother or faster animation)
  time += 0.01;

  // Render the scene
  renderer.render(scene, camera);
}

getData();

// Handle window resizing
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

function toggleAnimation() {
  if (animation) {
    animation = false;
  } else {
    animation = true;
  }
  animate();
}

function removeOrbit () {
  if (orbiter) {
    scene.remove(orbitLine);
    orbiter = !orbiter;
  } else {
    scene.add(orbitLine);
    orbiter = !orbiter;
  }
}