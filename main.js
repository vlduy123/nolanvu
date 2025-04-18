import * as THREE from "https://esm.sh/three";
import { OrbitControls } from "https://esm.sh/three/addons/controls/OrbitControls.js";
import { EffectComposer } from "https://esm.sh/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "https://esm.sh/three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://esm.sh/three/addons/postprocessing/UnrealBloomPass.js";

const canvas = document.getElementById("three-globe");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(window.devicePixelRatio); // Consider moving this to the resize function
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
const radius = 20.0;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const countryMeshes = [];
let lastMouseEvent = null;
let autoSpinSpeed = 0.0002;
let composer;
let bloomPass;
let previousHighlightedLine = null;
let previousHighlightedCountry = null;
let isDragging = false;

// Refined Tech Color Palette
const techPalette = {
    base: 0x0B132B,
    accent: 0x81D4FA,
    highlight: 0xFFD54F, // Amber - Default, and reset color
    particle: 0xA7FFEB,
    glow: 0x29ABE2,
    blueHighlight: 0x00FFFF, // Cyan for hover
    backgroundcolor: 0x111827
};

// Constants for pin design
const PIN_HEAD_RADIUS = 0.15;
const PIN_STICK_RADIUS = 0.04;
const PIN_STICK_HEIGHT = 0.6;
const PIN_COLOR = 0xFFD54F;
const PIN_HIGHLIGHT_COLOR = 0x00FFFF;

function latLonToVector3(lat, lon, r = radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
    );
}

// Set initial view
const initialLatLon = [14.0583, 108.2772];
const initialPos = latLonToVector3(...initialLatLon, radius + 0.1);
camera.position.copy(initialPos.clone().normalize().multiplyScalar(radius + 30));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableZoom = true;
controls.enableRotate = true;
controls.enablePan = false;

function setRendererSize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (!composer) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.6, 1.2);
        bloomPass.threshold = 0.1;
        bloomPass.strength = 1.5;
        bloomPass.radius = 0.8;
        composer.addPass(bloomPass);
    }
    composer.setSize(width, height);
}

window.addEventListener("resize", setRendererSize);
window.addEventListener("load", () => {
    setRendererSize();
    createCountryPins();
    startParticleSystem();
    addBackgroundSphere(); // Add the background sphere
    animate();
});

canvas.addEventListener('mousemove', event => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    lastMouseEvent = event;
});

// Add event listeners to detect start and end of dragging
controls.addEventListener('start', () => {
    isDragging = true;
    autoSpinSpeed = 0; // Stop auto-spin when dragging starts
});

controls.addEventListener('end', () => {
    isDragging = false;
    setTimeout(() => {
        autoSpinSpeed = 0.0005;
    }, 200);
});

let globe;

// Animation loop
const animateCallbacks = [];
let highlightedCountryName = null;
let glowingPins = new Set();
let tooltipTimeout; // Declare tooltipTimeout outside of animate

function animate() {
    if (globe && !isDragging) {
        globe.rotation.y += autoSpinSpeed;
    }
    controls.update();

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(countryMeshes, false);
    const tooltip = document.getElementById('tooltip');

    if (intersects.length > 0 && lastMouseEvent) {
        const intersect = intersects[0];
        const intersectedObject = intersect.object;

        if (highlightedCountries.hasOwnProperty(intersectedObject.userData.countryName)) {
            const countryName = intersectedObject.userData.countryName;
            const officeInfo = {
                "Vietnam": `<b>Vietnam - Hanoi (Head Office)</b><br>
                                            Address: 8F, MITEC Building, Duong Dinh Nghe Street, Yen Hoa, Cau Giay, Hanoi<br>
                                            Phone: (+84)24 3795 5813<br><br>
                                            <b>Vietnam - Ho Chi Minh City Office</b><br>
                                            Address: 7th Floor, Jea Building, 112 Ly Chinh Thang, Vo Thi Sau Ward, District 3, Ho Chi Minh City<br>
                                            Phone: (+84)24 3795 5813`,
                "Australia": `<b>Australia Office</b><br>
                                            Address: 6 Kingsborough Way, Zetland, 2017 Sydney<br>
                                            Phone: (+61) 413396603`,
                "Japan": `<b>Japan Office</b><br>
                                            Address: 1-1-7 Shibuya, Shibuya-ku, Tokyo, 150-0002 Japan<br>
                                            Phone: (+81) 03-6433-5840`,
                "United States of America": `<b>United States Office</b><br>
                                            Address: 7505 Tuscany Ln San Diego California 92126`,
                "Germany": `<b>Germany Office</b><br>
                                            Address: Prignitzstr. 6 15366 Hoppegarten, Deutschland<br>
                                            Phone: (+49)1515 9158888`
            };

            let tooltipText = `Country: ${countryName}`;
            if (officeInfo[countryName]) {
                tooltipText += `<br><br>${officeInfo[countryName]}`;
            }

            tooltip.innerHTML = tooltipText;
            tooltip.style.left = `${lastMouseEvent.clientX + 10}px`;
            tooltip.style.top = `${lastMouseEvent.clientY + 10}px`;
            tooltip.classList.add('show');

            // Clear any existing timeout
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
            }

            // Set a timeout to hide the tooltip after 2 seconds (2000 milliseconds)
            tooltipTimeout = setTimeout(() => {
                tooltip.classList.remove('show');
                tooltipTimeout = null; // Clear the variable
            }, 2000);

            const intersectedLine = intersectedObject;
            intersectedLine.material.color.set(techPalette.blueHighlight);
            intersectedLine.material.needsUpdate = true;

            if (previousHighlightedLine && previousHighlightedLine !== intersectedLine) {
                previousHighlightedLine.material.color.set(highlightedCountries[previousHighlightedLine.userData.countryName]?.color || techPalette.accent);
                previousHighlightedLine.material.needsUpdate = true;
            }
            previousHighlightedLine = intersectedLine;
            previousHighlightedCountry = countryName;

        } else {
            // If the mouse leaves the highlighted country, clear the timeout
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
            tooltip.classList.remove('show');
            if (previousHighlightedLine) {
                previousHighlightedLine.material.color.set(highlightedCountries[previousHighlightedLine.userData.countryName]?.color || techPalette.accent);
                previousHighlightedLine.material.needsUpdate = true;
                previousHighlightedLine = null;
            }
            highlightedCountryName = null;
        }
    } else {
        // If there are no intersections, clear the timeout
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = null;
        }
        tooltip.classList.remove('show');
        if (previousHighlightedLine) {
            previousHighlightedLine.material.color.set(highlightedCountries[previousHighlightedLine.userData.countryName]?.color || techPalette.accent);
            previousHighlightedLine.material.needsUpdate = true;
            previousHighlightedLine = null;
        }
        highlightedCountryName = null;
    }

    updateParticles();
    animateCallbacks.forEach(callback => callback());
    composer.render(); // Use composer.render()

    requestAnimationFrame(animate);
}

globe = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.MeshStandardMaterial({
        color: techPalette.base,
        metalness: 0.6,
        roughness: 0.7,
        emissive: techPalette.glow,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.7,
        wireframe: true,
        wireframeLinewidth: 0.4
    })
);
scene.add(globe);

// Add Ambient Light
const ambientLight = new THREE.AmbientLight(0xffffff, Math.PI * 0.5);
scene.add(ambientLight);

// ---- Country Outlines with Highlights ----
const highlightedCountries = {
    "Vietnam": { coords: [14.0583, 108.2772], color: techPalette.highlight }, // Amber
    "South Korea": { coords: [35.9078, 127.7669], color: techPalette.highlight },
    "Japan": { coords: [36.2048, 138.2529], color: techPalette.highlight },
    "Australia": { coords: [-25.2744, 133.7751], color: techPalette.highlight },
    "United States of America": { coords: [37.0902, -95.7129], color: techPalette.highlight },
    "Germany": { coords: [51.1657, 10.4515], color: techPalette.highlight },
    "Thailand": { coords: [15.87, 100.9925], color: techPalette.highlight },
    "Malaysia": { coords: [4.2105, 101.9758], color: techPalette.highlight },
    "Singapore": { coords: [1.3521, 103.8198] }
};

let countryLineMeshes = {};

fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
    })
    .then(geojson => {
        const countryFeatures = geojson.features; // Store features in a variable

        for (let i = 0; i < countryFeatures.length; i++) { // Use a standard for loop
            const feature = countryFeatures[i];
            const { type, coordinates } = feature.geometry;
            const name = feature.properties.name;

            const isHighlighted = highlightedCountries.hasOwnProperty(name);
            const lineColor = isHighlighted ? highlightedCountries[name].color : techPalette.accent;
            const opacity = isHighlighted ? 0.9 : 0.2;

            const addOutline = (polyCoords) => {
                const outlineOffset = radius + 0.01;
                const points = polyCoords.map(([lon, lat]) => latLonToVector3(lat, lon, outlineOffset));
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: lineColor,
                    transparent: true,
                    opacity: opacity
                });
                const line = new THREE.Line(geometry, material);
                line.userData = { countryName: name, isCountryOutline: true };
                countryMeshes.push(line);
                countryLineMeshes[name] = line;
                globe.add(line);
            };

            if (type === 'Polygon') {
                coordinates.forEach(addOutline);
            } else if (type === 'MultiPolygon') {
                coordinates.forEach(polygon => polygon.forEach(addOutline));
            }
        }
    })
    .catch(error => {
        console.error('Error fetching or processing country data:', error);
    });

// ---- Country Pins ----
let countryPins = {};
const countryLabels = {};
const countryCoordinates = {
    "Vietnam": [14.0583, 108.2772],
    "South Korea": [35.9078, 127.7669],
    "Japan": [36.2048, 138.2529],
    "Australia": [-25.2744, 133.7751],
    "United States of America": [37.0902, -95.7129],
    "Germany": [51.1657, 10.4515],
    "Thailand": [15.87, 100.9925],
    "Malaysia": [4.2105, 101.9758],
    "Singapore": [1.3521, 103.8198]
};

function createCountryPins() {
    const pinHeadGeometry = new THREE.SphereGeometry(PIN_HEAD_RADIUS, 24, 16);
    const pinStickGeometry = new THREE.CylinderGeometry(PIN_STICK_RADIUS, PIN_STICK_RADIUS, PIN_STICK_HEIGHT, 6);
    const pinMaterial = new THREE.MeshStandardMaterial({
        color: PIN_COLOR,
        metalness: 0.4,
        roughness: 0.5,
        transparent: true,
        opacity: 0.9,
    });

    for (const [name, [lat, lon]] of Object.entries(countryCoordinates)) { // Use for...of
        const position = latLonToVector3(lat, lon, radius);
        const normal = position.clone().normalize();

        const pinGroup = new THREE.Group();

        const pinHead = new THREE.Mesh(pinHeadGeometry, pinMaterial.clone());
        pinHead.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT);
        pinGroup.add(pinHead);

        const stickMaterial = new THREE.MeshStandardMaterial({
            color: techPalette.accent,
            metalness: 0.6,
            roughness: 0.4,
            transparent: true,
            opacity: 0.8
        });
        const pinStick = new THREE.Mesh(pinStickGeometry, stickMaterial);
        pinStick.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT / 2);
        pinStick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        pinGroup.add(pinStick);

        pinGroup.userData = { countryName: name, isPin: true };
        countryPins[name] = pinGroup;
        globe.add(pinGroup);

        // Create label for the pin
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 320;
        labelCanvas.height = 64;
        const labelCtx = labelCanvas.getContext('2d');
        labelCtx.font = ` 24px 'Inter', sans-serif`;
        labelCtx.fillStyle = '#FFFFFF';
        labelCtx.textAlign = 'center';
        labelCtx.fillText(name, 160, 40);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true }));
        labelSprite.position.copy(position.clone().normalize().multiplyScalar(radius + 1.8));
        labelSprite.scale.set(6, 1.8, 1);
        globe.add(labelSprite);

        countryLabels[name] = labelSprite;
    }
}

// ---- Particle System ----
const MAX_PARTICLES = 30;
const PARTICLE_SPEED = 0.006;
const TRAIL_LENGTH = 90;
const PARTICLE_COLOR = techPalette.particle;

let activeParticles = [];
let arcPairs = [];
let particleIntervalId;
let arcIndex = 0;

// ---Utility Functions---
const getArcMidpoint = (from, to) => {
    const direction = from.clone().add(to).normalize();
    const distance = from.distanceTo(to);
    let midFactor = 7 + distance * 0.3;
    if (distance > 50) {
        midFactor = 7 + distance * 0.4;
    }
    const mid = direction.multiplyScalar(radius + midFactor);
    return mid;
};

const createCurve = (from, to) => {
    const mid = getArcMidpoint(from, to);
    return new THREE.QuadraticBezierCurve3(from, mid, to);
};

const getAvailableTrailLine = () => {
    for (let i = 0; i < trailLines.length; i++) { // Use standard for loop
        const line = trailLines[i];
        if (!line.visible) {
            return line;
        }
    }
    return undefined;
};

// ---Trail Lines---
const trailLines = []; // Don't pre-allocate with a fixed size.

for (let i = 0; i < MAX_PARTICLES; i++) {
    const line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: PARTICLE_COLOR, transparent: true, opacity: 0.6 })
    );
    line.visible = false;
    globe.add(line);
    trailLines.push(line);
}
/**
 * Creates a particle and its associated trail.
 * @param from - The starting point of the particle.
 * @param to - The ending point of the particle.
 */
function createParticle(from, to) {
    if (activeParticles.length >= MAX_PARTICLES) return;

    const curve = createCurve(from, to);
    const trailLine = getAvailableTrailLine();

    if (!trailLine) return;

    const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.10, 24, 24),
        new THREE.MeshBasicMaterial({
            color: PARTICLE_COLOR,
            transparent: true,
            opacity: 0.8,
        })
    );
    particle.position.copy(from);
    globe.add(particle);

    trailLine.visible = true;

    activeParticles.push({
        particle,
        trailLine,
        curve,
        progress: 0,
        trail: [from.clone()],
        from: from,
        to: to,
        intersected: false,
        pinGlowTimeout: null,
    });
}

/**
 * Updates the position of each particle and its trail.  Removes particles
 * that have reached their destination.
 */
function updateParticles() {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.progress += PARTICLE_SPEED;

        if (p.progress >= 1) {
            globe.remove(p.particle);
            p.particle.geometry.dispose();
            p.particle.material.dispose();

            if (p.trail.length > 1) {
                p.trail.shift();
                p.trailLine.geometry.setFromPoints(p.trail);
            } else {
                p.trailLine.visible = false;
                activeParticles.splice(i, 1);
            }
            continue;
        }

        const point = p.curve.getPoint(p.progress);
        p.particle.position.copy(point);
        p.trail.push(point.clone());

        if (p.trail.length > TRAIL_LENGTH) {
            p.trail.shift();
        }

        p.trailLine.geometry.dispose();
        p.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(p.trail);

        // Particle glow based on proximity to start/end
        const startDistance = p.particle.position.distanceTo(p.from);
        const endDistance = p.particle.position.distanceTo(p.to);
        let glowIntensity = 0;

        if (startDistance < 3 || endDistance < 3) {
            glowIntensity = Math.max(0.4, 1.2 - (Math.min(startDistance, endDistance) / 3) * 0.8);
        }
        p.particle.material.emissiveIntensity = glowIntensity;

        // Check for intersection with pins
        if (!p.intersected) {
            for (let pinName in countryPins) {
                const pin = countryPins[pinName];
                if (pin.children && pin.children.length > 0) {
                    const head = pin.children[0];
                    const distance = p.particle.position.distanceTo(head.position);
                    if (distance < PIN_HEAD_RADIUS + 0.5) {
                        p.intersected = true;
                        if (p.pinGlowTimeout) {
                            clearTimeout(p.pinGlowTimeout);
                        }
                        pin.children.forEach(child => {
                            if (child.material) {
                                child.material.color.set(PIN_HIGHLIGHT_COLOR);
                            }
                        });
                        glowingPins.add(pinName);
                        p.pinGlowTimeout = setTimeout(() => {
                            pin.children.forEach(child => {
                                if (child.material) {
                                    child.material.color.set(PIN_COLOR);
                                }
                            });
                            glowingPins.delete(pinName);
                            p.pinGlowTimeout = null;
                        }, 1000);
                        break;
                    }
                }
            }
        }
    }
}

/**
 * Generates an array of unique country pairs.
 * @param count - The desired number of unique pairs.
 * @returns An array of country pairs (e.g., [['USA', 'Canada'], ['UK', 'France']]).
 */
const generateArcPairs = (count) => {
    const pairs = new Set();
    const countries = Object.keys(countryCoordinates);
    while (pairs.size < count && countries.length >= 2) {
        const index1 = Math.floor(Math.random() * countries.length);
        let index2 = Math.floor(Math.random() * countries.length);
        while (index2 === index1) {
            index2 = Math.floor(Math.random() * countries.length);
        }
        const country1 = countries[index1];
        const country2 = countries[index2];
        const sortedPair = [country1, country2].sort();
        pairs.add(sortedPair.join('-'));
    }
    return Array.from(pairs).map(pair => pair.split('-'));
};

/**
 * Starts the particle system animation.
 */
function startParticleSystem() {
    clearInterval(particleIntervalId);
    arcPairs = generateArcPairs(MAX_PARTICLES);
    arcIndex = 0;
    particleIntervalId = setInterval(() => {
        if (arcIndex < arcPairs.length) {
            const [fromName, toName] = arcPairs[arcIndex];
            const from = latLonToVector3(...countryCoordinates[fromName], radius + 0.1);
            const to = latLonToVector3(...countryCoordinates[toName], radius + 0.1);
            createParticle(from, to);
            arcIndex = (arcIndex + 1) % arcPairs.length;
        }
    }, 500);
}

document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        autoSpinSpeed = autoSpinSpeed === 0 ? 0.0005 : 0;
    }
});

// Function to add the background sphere
function addBackgroundSphere() {
    const backgroundSphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 10, 64, 64),
        new THREE.MeshBasicMaterial({
            color: techPalette.backgroundcolor,
            side: THREE.BackSide
        })
    );
    scene.add(backgroundSphere);
    backgroundSphere.position.set(0, 0, 0);
    backgroundSphere.frustumCulled = false;
}
