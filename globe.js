import * as THREE from "https://esm.sh/three";
import { OrbitControls } from "https://esm.sh/three/addons/controls/OrbitControls.js";
import { EffectComposer, RenderPass, BloomEffect, EffectPass } from "https://esm.sh/postprocessing";

// --- 1. Scene Setup ---
const canvas = document.getElementById("three-globe");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

// --- 2. Constants and Variables ---
const radius = 20.0;
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const countryMeshes = [];
let lastMouseEvent = null;
let autoSpinSpeed = 0.0005;
let composer;
let bloomEffect;
let previousHighlightedLine = null;
let isDragging = false;
let clock = new THREE.Clock();
let globe; // Declare globe
const animateCallbacks = [];
let highlightedCountryName = null;
let tooltipTimeout;
let animateId;
let isHovered = false;

// --- 3. Color Palette ---
const techPalette = {
    base: 0x162035,
    accent: 0x81D4FA,
    highlight: 0xFFD54F,
    particle: 0xA7FFEB,
    glow: 0x29ABE2,
    blueHighlight: 0x00FFFF,
    backgroundColor: 0x111827,
    white: 0xFFFFFF
};

// --- 4. Pin Design Constants ---
const PIN_HEAD_RADIUS = 0.15;
const PIN_STICK_RADIUS = 0.04;
const PIN_STICK_HEIGHT = 0.4;
const PIN_COLOR = 0x00FFFF;
const officeInfo = {
    "Vietnam": 
      `<span class="office-title">Vietnam - Hanoi (Head Office)</span><br>
      <p class="office-desc">
        8F, MITEC Building, Duong Dinh Nghe Street, Yen Hoa, Cau Giay, Hanoi<br>
        Phone: (+84)24 3795 5813
      </p>
      <span class="office-title">Vietnam - Ho Chi Minh City Office</span><br>
      <p class="office-desc">
        7th Floor, Jea Building, 112 Ly Chinh Thang, Vo Thi Sau Ward, District 3, Ho Chi Minh City<br>
        Phone: (+84)24 3795 5813
      </p>`,
    "Australia": 
      `<span class="office-title">Australia Office</span><br>
      <p class="office-desc">
        6 Kingsborough Way, Zetland, 2017 Sydney<br>
        Phone: (+61) 413396603
      </p>`,
    "Japan": 
      `<span class="office-title">Japan Office</span><br>
      <p class="office-desc">
        1-1-7 Shibuya, Shibuya-ku, Tokyo, 150-0002 Japan<br>
        Phone: (+81) 03-6433-5840
      </p>`,
    "United States of America": 
      `<span class="office-title">United States Office</span><br>
      <p class="office-desc">
        7505 Tuscany Ln, San Diego, California 92126
      </p>`,
    "Germany": 
      `<span class="office-title">Germany Office</span><br>
      <p class="office-desc">
        Prignitzstr. 6, 15366 Hoppegarten, Deutschland<br>
        Phone: (+49)1515 9158888
      </p>`,
    "Malaysia": 
      `<span class="office-title">Malaysia Office</span><br>
      <p class="office-desc">
        Suite 0525, Level 5, Wisma S P Setia, Jalan Indah 15, Bukit Indah, 79100 Iskandar Puteri, Johor<br>
        Phone: (+60) 7460 0364
      </p>`,
    "South Korea": 
      `<span class="office-title">South Korea Office</span>`,
    "Thailand": 
      `<span class="office-title">ThaiLand Office</span>`,
  };
  
  
  


// --- 5. Helper Functions ---

/**
 * Converts latitude and longitude to a 3D point on a sphere.
 * @param {number} lat Latitude in degrees.
 * @param {number} lon Longitude in degrees.
 * @param {number} r Radius of the sphere.
 * @returns {THREE.Vector3} 3D coordinates.
 */
function latLonToVector3(lat, lon, r = radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
    );
}

/**
 * Sets the renderer size and updates camera aspect ratio.
 */
function setRendererSize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (width === 0 || height === 0) return;

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (!composer) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        bloomEffect = new BloomEffect({
            intensity: 0.3,
            radius: 1.0,
            luminanceThreshold: 0.5,
            luminanceSmoothing: 0.2,
        });
        const effectPass = new EffectPass(camera, bloomEffect);
        composer.addPass(effectPass);
    }
    composer.setSize(width, height);
}

/**
 * Displays a tooltip with country information.
 * @param {string} countryName Name of the country.
 * @param {MouseEvent} mouseEvent Mouse event object.
 */
function showTooltip(countryName, mouseEvent) {
    const tooltip = document.getElementById('tooltip');
    let tooltipText = ``;

    if (officeInfo[countryName]) {
        tooltipText += `${officeInfo[countryName]}`;
    }

    tooltip.innerHTML = tooltipText;
    tooltip.style.left = `${mouseEvent.clientX + 10}px`;
    tooltip.style.top = `${mouseEvent.clientY + 10}px`;
    tooltip.classList.add('show');

    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }
    tooltipTimeout = setTimeout(() => {
        tooltip.classList.remove('show');
        tooltipTimeout = null;
    }, 5000);
}

/**
 * Hides the tooltip.
 */
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    tooltip.classList.remove('show');
}

/**
 * Highlights a country mesh.
 * @param {THREE.Mesh} mesh The country mesh to highlight.
 */
function highlightCountry(mesh) {
    if (previousHighlightedLine && previousHighlightedLine !== mesh) {
        const prevCountryName = previousHighlightedLine.userData.countryName;
        previousHighlightedLine.material.color.set(highlightedCountries[prevCountryName]?.color || techPalette.accent);
        previousHighlightedLine.material.needsUpdate = true;
    }

    mesh.material.color.set(techPalette.blueHighlight);
    mesh.material.needsUpdate = true;

    previousHighlightedLine = mesh;
    highlightedCountryName = mesh.userData.countryName;
    isHovered = true;
}

/**
 * Unhighlights the previously highlighted country.
 */
function unhighlightCountry() {
    if (previousHighlightedLine) {
        const prevCountryName = previousHighlightedLine.userData.countryName;
        previousHighlightedLine.material.color.set(highlightedCountries[prevCountryName]?.color || techPalette.accent);
        previousHighlightedLine.material.needsUpdate = true;
        previousHighlightedLine = null;
        highlightedCountryName = null;
    }
    isHovered = false;
}

// --- 6. Initial Setup ---

// Initial camera position
const initialLatLon = [14.0583, 108.2772]; // Vietnam
const initialPos = latLonToVector3(...initialLatLon, radius + 0.1);
camera.position.copy(initialPos.clone().normalize().multiplyScalar(radius + 30));

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.enableZoom = true;
controls.enableRotate = true;
controls.enablePan = false;

// --- 7. Event Listeners ---

// Set initial size and handle resizes
window.addEventListener("resize", setRendererSize);
window.addEventListener("load", () => {
    setRendererSize();
    createCountryPins();
    animate();
});

// Mouse move for raycasting
canvas.addEventListener('mousemove', event => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    lastMouseEvent = event;
});

// Dragging start/end
controls.addEventListener('start', () => {
    isDragging = true;
    autoSpinSpeed = 0;
});

controls.addEventListener('end', () => {
    isDragging = false;
    setTimeout(() => {
        autoSpinSpeed = 0.0005;
    }, 200);
});

// --- 8. Globe Creation ---
globe = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.MeshStandardMaterial({
        color: techPalette.base,
        metalness: 0.2,
        roughness: 0.2,
        emissive: techPalette.base,
        transparent: true,
        opacity: 0.3,
        wireframe: true,
    })
);
scene.add(globe);

// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, Math.PI * 0.5);
scene.add(ambientLight);

// --- 9. Country Outlines ---
const highlightedCountries = {
    "Vietnam": { coords: [14.0583, 108.2772], color: techPalette.highlight },
    "South Korea": { coords: [35.9078, 127.7669], color: techPalette.highlight },
    "Japan": { coords: [36.2048, 138.2529], color: techPalette.highlight },
    "Australia": { coords: [-25.2744, 133.7751], color: techPalette.highlight },
    "United States of America": { coords: [37.0902, -95.7129], color: techPalette.highlight },
    "Germany": { coords: [51.1657, 10.4515], color: techPalette.highlight },
    "Thailand": { coords: [15.87, 100.9925], color: techPalette.highlight },
    "Malaysia": { coords: [2.5, 112.5], color: techPalette.highlight },
    "Singapore": { coords: [1.3521, 103.8198], color: techPalette.highlight }
};

let countryLineMeshes = {};

fetch('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/custom.geomap.json')
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
    })
    .then(geojson => {
        const countryFeatures = geojson.features;

        for (let i = 0; i < countryFeatures.length; i++) {
            const feature = countryFeatures[i];
            const { type, coordinates } = feature.geometry;
            const name = feature.properties.name;

            const isHighlighted = highlightedCountries.hasOwnProperty(name);
            const lineColor = isHighlighted ? highlightedCountries[name].color : techPalette.accent;
            const opacity = isHighlighted ? 1 : 0.1;

            const addOutline = (polyCoords) => {
                const outlineOffset = radius + 0.02;
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

// --- 10. Country Pins ---
let countryPins = {};
const countryCoordinates = {
    "Vietnam": [14.0583, 108.2772],
    "South Korea": [35.9078, 127.7669],
    "Japan": [36.2048, 138.2529],
    "Australia": [-25.2744, 133.7751],
    "United States of America": [37.0902, -95.7129],
    "Germany": [51.1657, 10.4515],
    "Thailand": [15.87, 100.9925],
    "Malaysia": [2.5, 112.5],
    "Singapore": [1.3521, 103.8198]
};

function createCountryPins() {
    const pinHeadGeometry = new THREE.SphereGeometry(PIN_HEAD_RADIUS, 24, 16);
    const pinStickGeometry = new THREE.CylinderGeometry(PIN_STICK_RADIUS, PIN_STICK_RADIUS, PIN_STICK_HEIGHT, 3);
    const pinMaterial = new THREE.MeshStandardMaterial({
        color: PIN_COLOR,
        transparent: true,
        opacity: 0.9,
        emissive: techPalette.highlight,
        emissiveIntensity: 0.5,
    });

    for (const [name, [lat, lon]] of Object.entries(countryCoordinates)) {
        const position = latLonToVector3(lat, lon, radius);
        const normal = position.clone().normalize();

        const pinGroup = new THREE.Group();

        const pinHead = new THREE.Mesh(pinHeadGeometry, pinMaterial.clone());
        pinHead.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT);
        pinGroup.add(pinHead);

        const stickMaterial = new THREE.MeshStandardMaterial({
            color: techPalette.accent,
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

        // Label
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 320;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.font = '20px Verdana';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(name, 160, 40);

        const labelTex = new THREE.CanvasTexture(labelCanvas);
        const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true }));

        // compute tangent for horizontal shift
        const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
        const north = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), normal).normalize();
        const OUT_OFFSET = PIN_STICK_HEIGHT + 0.5;      // outwards from globe/pin
        const HORIZONTAL_SHIFT = 0.0;        // left/right
        const VERTICAL_SHIFT = 0.5;          // up/down

        labelSprite.position.copy(
            position.clone()
                .addScaledVector(normal, OUT_OFFSET)
                .addScaledVector(east, HORIZONTAL_SHIFT)
                .addScaledVector(north, VERTICAL_SHIFT)
        );
        labelSprite.scale.set(6, 1.8, 1);
        globe.add(labelSprite);
    }
}

// --- 11. Shooting Stars ---
class ShootingStar {
    constructor(startCountry, endCountry, scene, globeGroup) {
        this.start = startCountry;
        this.end = endCountry;
        this.scene = scene;
        this.group = globeGroup;

        const a = countryCoordinates[startCountry];
        const b = countryCoordinates[endCountry];
        if (!a || !b) { this.isFinished = true; return; }

        this.startPos = latLonToVector3(...a, radius);
        this.endPos = latLonToVector3(...b, radius);
        this.path = new THREE.CatmullRomCurve3([
            this.startPos,
            this.startPos.clone().lerp(this.endPos, 0.5).normalize().multiplyScalar(radius + 2),
            this.endPos
        ]);
        this.length = this.path.getLength();
        this.speed = 15;
        this.progress = 0;

        // head
        const HEAD_RADIUS = 0.1;
        const headGeo = new THREE.SphereGeometry(HEAD_RADIUS, 12, 8);
        const headMat = new THREE.MeshStandardMaterial({
            color: techPalette.white,
            emissiveIntensity: 0.5,
        });
        this.headMesh = new THREE.Mesh(headGeo, headMat);
        this.group.add(this.headMesh);

        // tail
        this.trailLength = 40;
        this.trailGeo = new THREE.BufferGeometry();
        this.trailPts = new Float32Array(this.trailLength * 3);
        this.trailCols = new Float32Array(this.trailLength * 3);
        this.trailAlps = new Float32Array(this.trailLength);
        this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPts, 3));
        this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailCols, 3));
        this.trailGeo.setAttribute('alpha', new THREE.BufferAttribute(this.trailAlps, 1));
        const trailMat = new THREE.ShaderMaterial({
            uniforms: { color: { value: new THREE.Color(techPalette.white) } },
            vertexShader: `
                    attribute vec3 color;
                    attribute float alpha;
                    varying vec3 vColor;
                    varying float vAlpha;
                    void main(){
                        vColor = color; 
                        vAlpha = alpha;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                        gl_PointSize = 1.5;
                    }
                `,
            fragmentShader: `
                    varying vec3 vColor;
                    varying float vAlpha;
                    void main(){
                        gl_FragColor = vec4(vColor, vAlpha);
                    }
                `,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });
        this.trailMesh = new THREE.Points(this.trailGeo, trailMat);
        this.group.add(this.trailMesh);

        this.points = [];
        this.hasArrived = false;
        this.isFinished = false;
    }

    _addTailPoint(pos) {
        this.points.push({ pos: pos.clone(), age: 0 });
        while (this.points.length > this.trailLength) this.points.shift();
    }

    update(delta) {
        if (this.isFinished) return;

        // move head until arrival
        if (!this.hasArrived) {
            this.progress += (this.speed / this.length) * delta;
            if (this.progress >= 1.0) {
                this.hasArrived = true;
                // remove head immediately
                this.group.remove(this.headMesh);
                this.headMesh.geometry.dispose();
                this.headMesh.material.dispose();
                this.headMesh = null;
            } else {
                const p = this.path.getPointAt(this.progress);
                this.headMesh.position.copy(p);
                this._addTailPoint(p);
            }
        }

        // always update tail
        let pi = 0, ci = 0, ai = 0;
        const col = this.trailMesh.material.uniforms.color.value;
        for (let i = 0; i < this.points.length; i++) {
            const pt = this.points[i];
            pt.age += delta;
            const alpha = 1.0 - Math.min(1.0, pt.age / 1);
            this.trailPts[pi++] = pt.pos.x;
            this.trailPts[pi++] = pt.pos.y;
            this.trailPts[pi++] = pt.pos.z;
            this.trailCols[ci++] = col.r;
            this.trailCols[ci++] = col.g;
            this.trailCols[ci++] = col.b;
            this.trailAlps[ai++] = alpha;
        }
        // zero out remainder
        for (let i = this.points.length; i < this.trailLength; i++) {
            this.trailPts[pi++] = 0; this.trailPts[pi++] = 0; this.trailPts[pi++] = 0;
            this.trailCols[ci++] = 0; this.trailCols[ci++] = 0; this.trailCols[ci++] = 0;
            this.trailAlps[ai++] = 0;
        }
        this.trailGeo.attributes.position.needsUpdate = true;
        this.trailGeo.attributes.color.needsUpdate = true;
        this.trailGeo.attributes.alpha.needsUpdate = true;
        this.trailGeo.setDrawRange(0, this.points.length);

        // once arrived, wait until oldest tail point at endPos
        if (this.hasArrived && this.points.length > 0) {
            const oldest = this.points[0].pos;
            if (oldest.distanceTo(this.endPos) < 0.1) {
                this.group.remove(this.trailMesh);
                this.trailGeo.dispose();
                this.trailMesh.material.dispose();
                this.isFinished = true;
            }
        }
    }

    dispose() {
        // nothing left
    }
}

class ShootingStarManager {
    constructor(scene, globe) {
        this.scene = scene;
        this.globe = globe;
        this.stars = [];
        this.interval = 0.7;
        this.elapsed = 0;
        this.countries = Object.keys(countryCoordinates);
    }

    update(dt) {
        // update existing stars
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const s = this.stars[i];
            s.update(dt);
            if (s.isFinished) this.stars.splice(i, 1);
        }
        // maybe spawn new one
        this.elapsed += dt;
        if (this.elapsed >= this.interval) {
            this.elapsed = 0;
            const names = this.countries;
            let a = Math.floor(Math.random() * names.length);
            let b = Math.floor(Math.random() * names.length);
            while (b === a) b = Math.floor(Math.random() * names.length);
            const star = new ShootingStar(names[a], names[b], this.scene, this.globe);
            if (!star.isFinished) this.stars.push(star);
        }
    }
}

const shootingStarManager = new ShootingStarManager(scene, globe);

// --- 12. Animation Loop ---
function animate() {
    if (globe && !isDragging && !isHovered) { // Only spin if not dragging and not hovering
        globe.rotation.y += autoSpinSpeed;
    }

    controls.update();

    const delta = clock.getDelta();

    shootingStarManager.update(delta);

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(countryMeshes, false);

    if (intersects.length > 0 && lastMouseEvent) {
        const intersectedObject = intersects[0].object;
        const countryName = intersectedObject.userData.countryName;

        if (highlightedCountries.hasOwnProperty(countryName)) {
            if (highlightedCountryName !== countryName) {
                showTooltip(countryName, lastMouseEvent);
                highlightCountry(intersectedObject);
            } else {
                showTooltip(countryName, lastMouseEvent);
                highlightCountry(intersectedObject);
            }
        } else {
            hideTooltip();
            unhighlightCountry();
        }
    } else {
        hideTooltip();
        unhighlightCountry();
    }

    animateCallbacks.forEach(callback => callback());

    composer.render();
    animateId = requestAnimationFrame(animate);
}
