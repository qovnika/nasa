// Import necessary libraries
import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.126.1/examples/jsm/controls/OrbitControls.js';
//import { toastController } from "https://cdn.jsdelivr.net/npm/@ionic/core/dist/ionic/ionic.esm.js";
//import { TextGeometry } from 'https://unpkg.com/three@0.126.1/addons/geometries/TextGeometry.js';

// Constants
const G = 39.478;  // Gravitational constant in AU^3 / year^2 / solar mass
const M_sun = 1;   // Mass of the sun in solar masses
let n = 0;
let e = 0.8482682514; // Eccentricity - e
let a = 4.09; // Semi-major axis in AU - q_au_2
let i = 11.77999525 * Math.PI / 180; // Inclination in radians - i_deg
let omega = 186.5403463 * Math.PI / 180; // Argument of periapsis in radians - w_deg
let Omega = 334.5698056 * Math.PI / 180; // Longitude of ascending node in radians - node_deg
let period = 365 * 3.3; // Orbital period in days - p_yr
let neo = [];
let data = [];
let l = 0;
let orbitLine = [];
let pha = null;

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Sun (represented as a simple sphere)
const sunGeometry = new THREE.SphereGeometry(0.2, 32, 32);
const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sun);

function addNEO() {
    console.log(data);
    data.forEach(element => {
        const axis = element.q_au_2; // Semi-major axis in AU - q_au_2
        const ecc = element.e; // Eccentricity - e
        const inclination = element.i_deg * Math.PI / 180; // Inclination in radians - i_deg
        const omega_ = element.w_deg * Math.PI / 180; // Argument of periapsis in radians - w_deg
        const Omega_ = element.node_deg * Math.PI / 180; // Longitude of ascending node in radians - node_deg
        const period_ = 365 * element.p_yr; // Orbital period in days - p_yr
        e = ecc;
        a = axis;
        i = inclination;
        omega = omega_;
        Omega = Omega_;
        period = period_;

        const mean = Math.sqrt(G * M_sun / Math.pow(a, 3)); // Mean motion (rad/year)
        n = mean;
        // NEO representation (a small sphere)
        const neoGeometry = new THREE.SphereGeometry(0.05, 32, 32);
        const neoMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const neo_ = new THREE.Mesh(neoGeometry, neoMaterial);
        neo.push(neo_);
        scene.add(neo[l]);

        // Create the orbit curve and apply transformations
        const orbitPoints = calculate3DOrbitPoints();
        const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        orbitLine[l] = new THREE.LineLoop(orbitGeometry, orbitMaterial);
        //        scene.add(orbitLine[l]);

        // Rotate orbit to match the inclination, ascending node, and periapsis
        orbitLine[l].rotation.x = i; // Inclination
        orbitLine[l].rotation.z = Omega; // Longitude of ascending node
        //orbitLine.rotation.y = omega;
        neo[l].rotation.z = omega; // Argument of periapsis
        l++;
    });
    renderer.setAnimationLoop(animate());
}

// Create the elliptical orbit as a 3D curve
function calculate3DOrbitPoints(steps = 500) {
    const points = [];
    for (let theta = 0; theta < 2 * Math.PI; theta += 2 * Math.PI / steps) {
        // Radius based on the true anomaly
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        points.push(new THREE.Vector3(x, y, 0)); // Orbit in the orbital plane
    }
    return points;
}

// Apply the same rotation to the NEO
function applyOrbitRotation(position) {
    // Rotate around Z-axis for Omega (longitude of the ascending node)
    const x_omega = position.x * Math.cos(Omega) - position.y * Math.sin(Omega);
    const y_omega = position.x * Math.sin(Omega) + position.y * Math.cos(Omega);

    // Rotate around X-axis for inclination
    const z_incl = position.z * Math.cos(i) - y_omega * Math.sin(i);
    const y_incl = position.z * Math.sin(i) + y_omega * Math.cos(i);

    // Apply argument of periapsis (omega)
    const x_periapsis = x_omega * Math.cos(omega) - y_incl * Math.sin(omega);
    const y_periapsis = x_omega * Math.sin(omega) + y_incl * Math.cos(omega);

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
function getPositionAtTime(time) {
    // Mean anomaly (M)
    const M = n * time; // Mean anomaly increases linearly with time

    // Solve Kepler's equation for Eccentric anomaly (E)
    const E = solveKeplersEquation(M, e);

    // Calculate the True Anomaly (ν)
    const trueAnomaly = 2 * Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2)
    );

    // Calculate distance r
    const r = a * (1 - e * e) / (1 + e * Math.cos(trueAnomaly));

    // Position in the plane of the orbit
    const x = r * Math.cos(trueAnomaly);
    const y = r * Math.sin(trueAnomaly);

    // Return position vector in 3D space (initially in the plane of the orbit)
    return applyOrbitRotation(new THREE.Vector3(x, y, 0));
}

function getData() {
    const xhttp = new XMLHttpRequest();
    xhttp.onload = function () {
        data = JSON.parse(this.responseText);
        addNEO();
    }
    xhttp.open("GET", "https://data.nasa.gov/resource/b67r-rgxc.json", true);
    xhttp.send();
}

// Animation loop to move the NEO along its orbit
let time = [];
function animate() {
    //    requestAnimationFrame(animate());
    //    time = 0;
    neo.forEach(element => {
        // Get the position of the NEO at the current time
        const position = getPositionAtTime(time);

        // Update NEO position in 3D space
        element.position.copy(position);
    });

    // Increment time (arbitrary time step, adjust for smoother or faster animation)
    time += 0.01;

    // Render the scene
    renderer.render(scene, camera);
}

const pan = new OrbitControls(camera, renderer.domElement);
// Set camera position
camera.position.z = 10;
pan.update()

getData();

// Handle window resizing
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});