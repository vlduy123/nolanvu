import * as THREE from "https://esm.sh/three";
import { OrbitControls } from "https://esm.sh/three/addons/controls/OrbitControls.js";
import {
    EffectComposer,
    RenderPass,
    SelectiveBloomEffect,
    EffectPass,
} from "https://esm.sh/postprocessing";
import { RGBELoader } from 'https://esm.sh/three/addons/loaders/RGBELoader.js';

// --- 1. Scene Setup Variables ---
let canvas, renderer, scene, camera, controls;
let composer;
let selectiveBloom;
let raycaster;
let mouse;
let clock;

// --- 2. Constants and Configuration ---

// Core Globe Properties
const RADIUS = 20.0;
const TECH_PALETTE = {
    base: 0x204A8F,
    accent: 0x85E2FB,
    highlight: 0xFFC93C,
    blueHighlight: 0x00FFFF,
    white: 0xFFFFFF,
};

// Pin Properties
const PIN_HEAD_RADIUS = 0.15;
const PIN_STICK_RADIUS = 0.04;
const PIN_STICK_HEIGHT = 0.4;
const PIN_COLOR = 0x00FFFF;

// Animation and Interaction State
let globe;
let autoSpinSpeed = 0.0005;
let isDragging = false;
let lastMouseEvent = null;
let highlightedCountryName = null; // Keep track of the currently highlighted country name
let tooltipTimeout;
let animateId;
let isHovered = false; // Flag to track if ANY interactive element (highlighted country element or globe) is hovered
const targetHoverColor = new THREE.Color(TECH_PALETTE.blueHighlight);

// Globe scaling variables for hover effect
let targetGlobeScale = 1.0;
let currentGlobeScale = 1.0;
const HOVER_SCALE_FACTOR = 1.025; // How much to scale up on hover
const SCALE_ANIMATION_SPEED = 0.05; // Speed of the scale animation

// Meshes and Sprites Storage
let countryMeshes = []; // Stores all country outline lines
let countryLineMeshes = {}; // Maps country name to its line meshes for quick access
let pinLabelSprites = []; // Stores all pin label sprites
let countryPinMeshes = {}; // Maps country name to its pin group (head and stick)
let labelSprites = {}; // Maps country name to its label sprite

// Data (Placeholder - replace with your actual data)
const officeInfo = {
    "Vietnam": `<span class="office-title">Vietnam - Hanoi (Head Office)</span><br>
        <p class="office-desc">
        8F, MITEC Building, Duong Dinh Nghe Street, Yen Hoa, Cau Giay, Hanoi<br>
        Phone: (+84)24 3795 5813
        </p>
        <span class="office-title">Vietnam - Ho Chi Minh City Office</span><br>
        <p class="office-desc">
        7th Floor, Jea Building, 112 Ly Chinh Thang, Vo Thi Sau Ward, District 3, Ho Chi Minh City<br>
        Phone: (+84)24 3795 5813
        </p>`,
    "Australia": `<span class="office-title">Australia Office</span><br>
        <p class="office-desc">
        6 Kingsborough Way, Zetland, 2017 Sydney<br>
        Phone: (+61) 413396603
        </p>`,
    "Japan": `<span class="office-title">Japan Office</span><br>
        <p class="office-desc">
        1-1-7 Shibuya, Shibuya-ku, Tokyo, 150-0002 Japan<br>
        Phone: (+81) 03-6433-5840
        </p>`,
    "United States of America": `<span class="office-title">United States Office</span><br>
        <p class="office-desc">
        7505 Tuscany Ln, San Diego, California 92126
        </p>`,
    "Germany": `<span class="office-title">Germany Office</span><br>
        <p class="office-desc">
        R308.M, Dong Xuan Haus, Herzbergstr. 128-139, 10365 Berlin<br>
        Phone: (+49)1515 9158888
        </p>`,
    "Malaysia": `<span class="office-title">Malaysia Office</span><br>
        <p class="office-desc">
        Suite 0525, Level 5, Wisma S P Setia, Jalan Indah 15, Bukit Indah, 79100 Iskandar Puteri, Johor<br>
        Phone: (+60) 7460 0364
        </p>`,
    "Thailand": `<span class="office-title">Thailand Office</span><br>
        <p class="office-desc">
        142 Sukhumvit Road, Two Pacific Place 23rd floor, Klongteoy, Bangkok, ​Thailand 10110<br>
        Phone: (+66) 2684 6819
        </p>`,
    "Singapore": `<span class="office-title">Singapore Office</span><br>
        <p class="office-desc">
        26A Hillview Terrace, Singapore S669238<br>
        Phone: (+65) 6769 6888
        </p>`,
    "South Korea": `<span class="office-title">Korea Office</span><br>
`,
};

// Placeholder country coordinates - replace with your actual data
const countryCoordinates = {
    "Vietnam": [14.0583, 108.2772],
    "South Korea": [35.9078, 127.7669],
    "Japan": [36.2048, 138.2529],
    "Australia": [-25.2744, 133.7751],
    "United States of America": [37.0902, -95.7129],
    "Germany": [51.1657, 10.4515],
    "Thailand": [15.87, 100.9925],
    "Malaysia": [2.5, 112.5],
    "Singapore": [1.3521, 103.8198],
};

// Countries to be highlighted initially and on hover
const highlightedCountries = {
    "Vietnam": { coords: [14.0583, 108.2772], color: TECH_PALETTE.highlight },
    "South Korea": { coords: [35.9078, 127.7669], color: TECH_PALETTE.highlight },
    "Japan": { coords: [36.2048, 138.2529], color: TECH_PALETTE.highlight },
    "Australia": { coords: [-25.2744, 133.7751],  color: TECH_PALETTE.highlight },
    "United States of America": { coords: [37.0902, -95.7129], color: TECH_PALETTE.highlight },
    "Germany": { coords: [51.1657, 10.4515], color: TECH_PALETTE.highlight },
    "Thailand": { coords: [15.87, 100.9925], color: TECH_PALETTE.highlight },
    "Malaysia": { coords: [2.5, 112.5], color: TECH_PALETTE.highlight },
    "Singapore": { coords: [1.3521, 103.8198], color: TECH_PALETTE.highlight },
};
 // Ensure all highlightedCountries have a color property or handle the default
 for (const country in highlightedCountries) {
    // If the value is an array (just coords), convert it to an object with default color
    if (Array.isArray(highlightedCountries[country])) {
        highlightedCountries[country] = {
            coords: highlightedCountries[country],
            color: TECH_PALETTE.accent // Default color
        };
    } else if (highlightedCountries[country].color === undefined) {
        highlightedCountries[country].color = TECH_PALETTE.accent; // Default color
    }
}


let animateCallbacks = []; // Not used in the provided code, kept for compatibility

// --- 3. Helper Functions ---

/**
 * Converts latitude and longitude to a 3D point on a sphere.
 * @param {number} lat Latitude in degrees.
 * @param {number} lon Longitude in degrees.
 * @param {number} r Radius of the sphere.
 * @returns {THREE.Vector3} 3D coordinates.
 */
function latLonToVector3(lat, lon, r = RADIUS) {
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

    // Initialize composer or update its size
    if (!composer) {
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        selectiveBloom = new SelectiveBloomEffect(scene, camera, {
            intensity: 0.4,
            radius: 0.2,
            luminanceThreshold: 0.4,
            luminanceSmoothing: 0.1,
        });
        const selectiveBloomPass = new EffectPass(camera, selectiveBloom);
        selectiveBloomPass.renderToScreen = true;
        composer.addPass(selectiveBloomPass);
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
    } else {
        // Fallback for countries with no specific office info
        tooltipText += `<span class="office-title">${countryName}</span><br><p class="office-desc">No office information available.</p>`;
    }


    tooltip.innerHTML = tooltipText;
    tooltip.style.left = `${mouseEvent.clientX + 10}px`;
    tooltip.style.top = `${mouseEvent.clientY + 10}px`;
    tooltip.classList.add('show');

    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }
    // Keep tooltip visible while hovered, hide after a short delay if not hovered
    tooltipTimeout = setTimeout(() => {
        // Hide tooltip only if the mouse is no longer over the tooltip or a highlighted country element
        const tooltipRect = tooltip.getBoundingClientRect();
        const isMouseOverTooltip = mouseEvent.clientX >= tooltipRect.left && mouseEvent.clientX <= tooltipRect.right &&
                                   mouseEvent.clientY >= tooltipRect.top && mouseEvent.clientY <= tooltipRect.bottom;

        if (!isMouseOverTooltip && (!isHovered || highlightedCountryName !== countryName)) {
            tooltip.classList.remove('show');
            tooltipTimeout = null;
        }
    }, 100); // Short delay to prevent flickering
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
 * Highlights a country mesh and its associated pin.
 * @param {string} countryName Name of the country.
 */
function highlightCountry(countryName) {
    // Only highlight if the country is in the highlightedCountries list
    if (!highlightedCountries.hasOwnProperty(countryName)) {
        return;
    }

    // Set new highlight for lines
    if (countryLineMeshes[countryName]) {
        countryLineMeshes[countryName].forEach(line => {
            line.material.color.set(targetHoverColor);
            line.material.needsUpdate = true;
        });
    }
    // Change pin color and add to bloom selection
    if (countryPinMeshes[countryName]) {
        countryPinMeshes[countryName].children.forEach(child => {
            if (child.geometry.type === 'SphereGeometry') { // Identify pin head
                child.material.emissiveIntensity = 0.7;
                selectiveBloom.selection.add(child);
            }
        });
    }
     // Add label sprite to bloom selection
     if (labelSprites[countryName]) {
         selectiveBloom.selection.add(labelSprites[countryName]);
     }
}

/**
 * Removes highlight from a country mesh and its associated pin.
 * @param {string} countryName Name of the country.
 */
function unhighlightCountry(countryName) {
     // Only unhighlight if the country is in the highlightedCountries list
    if (!highlightedCountries.hasOwnProperty(countryName)) {
        return;
    }

     // Reset highlight for lines
    if (countryLineMeshes[countryName]) {
        countryLineMeshes[countryName].forEach(line => {
            // Use the color from the highlightedCountries list
            const originalColor = highlightedCountries[countryName].color;
            line.material.color.set(originalColor);
            line.material.needsUpdate = true;
        });
    }

    // Reset pin color and remove from bloom selection
    if (countryPinMeshes[countryName]) {
        countryPinMeshes[countryName].children.forEach(child => {
            if (child.geometry.type === 'SphereGeometry') {
                child.material.emissiveIntensity = 0;
                selectiveBloom.selection.delete(child);
            }
        });
    }
     // Remove label sprite from bloom selection
     if (labelSprites[countryName]) {
         selectiveBloom.selection.delete(labelSprites[countryName]);
     }
}

// --- 4. Shaders ---
// Vertex Shader
const GlobeVertexShader = `
    varying vec2 vUv;
    varying vec3 vReflectLand;
    varying vec3 vReflectWater;
    varying vec3 vPosition;
    varying float vNoiseQualityFresnel;
    varying vec2 vNoiseQualityBounds;
    // Removed vLightDirection

    // Adjusted roughness values for potentially different reflection characteristics
    const float uRoughness = 0.8;
    const float uRoughness2 = 0.9;
    uniform float uNoiseQuality;
    uniform mat3 envMapRotation;
    // Removed uLightDirection uniform


    vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
        return normalize((vec4(dir, 0.0) * matrix).xyz);
    }

    vec3 calculateReflection(vec3 viewDir, vec3 n, float rough) {
        vec3 reflectVec = reflect(-viewDir, n);
        // Slightly adjust the mix factor for roughness influence
        reflectVec = normalize(mix(reflectVec, n, rough * rough * 0.5));

        reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
        reflectVec = (viewMatrix * vec4(envMapRotation * reflectVec, 0.0)).xyz;
        return reflectVec;
    }

    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1);

        vec3 viewNormal = normalize(normalMatrix * normal);
        vec3 viewDir = normalize(-mvPosition.xyz);

        vUv = uv;
        vPosition = mvPosition.xyz;

        gl_Position = projectionMatrix * mvPosition;

        vReflectLand = calculateReflection(viewDir, viewNormal, uRoughness2);
        vReflectWater = calculateReflection(viewDir, viewNormal, uRoughness);

        // Removed passing light direction to fragment shader


        // Noise quality stuff - Keep the core logic but potentially adjust mix values
        float lower = mix(0.5, 0.1, uNoiseQuality);
        float higher = mix(0.7, 1.0, uNoiseQuality);
        vNoiseQualityBounds = vec2(lower, higher);

        vNoiseQualityFresnel = 1.0 - dot(viewNormal, viewDir);
        // Adjusted power for Fresnel effect falloff
        vNoiseQualityFresnel = 1.0 - pow(vNoiseQualityFresnel, mix(0.5, 4.0, uNoiseQuality)) * 1.2;
        vNoiseQualityFresnel = clamp(vNoiseQualityFresnel, 0.0, 1.0);
    }
`;

// Fragment Shader
const GlobeFragmentShader = `
    #include <common>
    #include <cube_uv_reflection_fragment>

    const float uShoreThreshold = 0.9; // Slightly adjusted shore threshold

    // Water - Adjusted parameters for ethereal look
    const float uRoughness = 0.55;
    const float uEnvMapIntensity = 0.03; // Increased reflection intensity for water
    const float uNoiseScale = 1200.0;
    const float uNoiseStrength = 0.9;
    const float uBloomIntensity = 3.0;

    // Land - Adjusted parameters for ethereal look
    const float uRoughness2 = 0.9; //
    const float uEnvMapIntensity2 = 0.4; // Increased reflection intensity for land
    const float uNoiseScale2 = 1800.0;
    const float uNoiseStrength2 = 1.2;
    const float uBloomIntensity2 = 1.5;

    const float uNoiseScaleMultiplier = 1.0;
    const float uNoisePower = 1.5;

    varying vec2 vUv;
    varying vec3 vReflectLand;
    varying vec3 vReflectWater;
    varying vec3 vPosition; // Position in view space

    varying vec2 vNoiseQualityBounds;
    varying float vNoiseQualityFresnel;
    // Removed vLightDirection

    uniform sampler2D uEquirectangularMap;
    uniform sampler2D uWaterColors;
    uniform sampler2D uLandColors;

    uniform float uNoiseQuality;
    uniform float uTime;
    uniform sampler2D envMap;
    uniform float uLandEnvMultiplier; // Multiplier also affects land reflection
    // Removed uAmbientStrength uniform


    float psrdnoise(vec2 x, float alpha, out vec2 gradient) {

        // Transform to simplex space (axis-aligned hexagonal grid)
        vec2 uv = vec2(x.x + x.y * 0.5, x.y);

        // Determine which simplex we're in, with i0 being the "base"
        vec2 i0 = floor(uv);
        vec2 f0 = fract(uv);
        // o1 is the offset in simplex space to the second corner
        float cmp = step(f0.y, f0.x);
        vec2 o1 = vec2(cmp, 1.0 - cmp);

        // Enumerate the remaining simplex corners
        vec2 i1 = i0 + o1;
        vec2 i2 = i0 + vec2(1.0, 1.0);

        // Transform corners back to texture space
        vec2 v0 = vec2(i0.x - i0.y * 0.5, i0.y);
        vec2 v1 = vec2(v0.x + o1.x - o1.y * 0.5, v0.y + o1.y);
        vec2 v2 = vec2(v0.x + 0.5, v0.y + 1.0);

        // Compute vectors from v to each of the simplex corners
        vec2 x0 = x - v0;
        vec2 x1 = x - v1;
        vec2 x2 = x - v2;

        vec3 iu, iv;

        // Shortcut if neither x nor y periods are specified
        iu = vec3(i0.x, i1.x, i2.x);
        iv = vec3(i0.y, i1.y, i2.y);

        // Compute one pseudo-random hash value for each corner
        vec3 hash = mod(iu, 289.0);
        hash = mod((hash * 51.0 + 2.0) * hash + iv, 289.0);
        hash = mod((hash * 34.0 + 10.0) * hash, 289.0);

        // Pick a pseudo-random angle and add the desired rotation
        vec3 psi = hash * 0.07482 + alpha;
        vec3 gx = cos(psi);
        vec3 gy = sin(psi);

        // Reorganize for dot products below
        vec2 g0 = vec2(gx.x, gy.x);
        vec2 g1 = vec2(gx.y, gy.y);
        vec2 g2 = vec2(gx.z, gy.z);

        // Radial decay with distance from each simplex corner
        vec3 w = 0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2));
        w = max(w, 0.0);
        vec3 w2 = w * w;
        vec3 w4 = w2 * w2;

        // The value of the linear ramp from each of the corners
        vec3 gdotx = vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2));

        // Multiply by the radial decay and sum up the noise value
        float n = dot(w4, gdotx);

        // Compute the first order partial derivatives
        vec3 w3 = w2 * w;
        vec3 dw = -8.0 * w3 * gdotx;
        vec2 dn0 = w4.x * g0 + dw.x * x0;
        vec2 dn1 = w4.y * g1 + dw.y * x1;
        vec2 dn2 = w4.z * g2 + dw.z * x2;
        gradient = 10.9 * (dn0 + dn1 + dn2);

        // Scale the return value to fit nicely into the range [-1,1]
        return 10.9 * n;
    }

    float luma(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
    }

    // Map a value from a range to 0 to 1 - Keep utility function
    float mapValue(float value, float minInput, float maxInput) {
        return (value - minInput) / (maxInput - minInput);
    }

    vec2 rotate2d(vec2 v, float a) { // Keep utility function
        float s = sin(a);
        float c = cos(a);
        mat2 m = mat2(c, s, -s, c);
        return m * v;
    }

    void main() {
        vec4 equirectangularMapColor = texture(uEquirectangularMap, vUv); // Corrected from texture2D
        float mixFactor = step(uShoreThreshold, equirectangularMapColor.r);
        float roughnessFactor = mix(uRoughness2, uRoughness, mixFactor);
        // Increased base intensity and applied multiplier
        float customEnvMapIntensity = mix(uEnvMapIntensity2 * uLandEnvMultiplier * 1.5, uEnvMapIntensity * 1.5, mixFactor); // Increased base intensity
        float bloomIntensity = mix(uBloomIntensity2, uBloomIntensity, mixFactor);

        vec4 envMapColor = vec4(customEnvMapIntensity);

        if (equirectangularMapColor.r > uShoreThreshold) {
            envMapColor *= textureCubeUV(envMap, vReflectWater, roughnessFactor);
        } else {
            envMapColor *= textureCubeUV(envMap, vReflectLand, roughnessFactor);
        }

        vec3 outgoingLight = envMapColor.rgb;

        // --- Noise Generation for Ethereal Look ---
        // Use two layers of noise for a more complex pattern
        vec2 v1 = vec2(uNoiseScale * uNoiseScaleMultiplier * vUv);
        vec2 g1;
        float noise1 = 0.5 + 0.4 * psrdnoise(v1, 2.0 * uTime, g1); // First noise layer

        vec2 v2 = vec2(uNoiseScale * uNoiseScaleMultiplier * vUv * 2.5); // Higher frequency
        vec2 g2;
        float noise2 = 0.5 + 0.3 * psrdnoise(v2 + vec2(uTime * 0.5), g2.y, g2); // Second noise layer, slightly offset time

        // Combine noise layers
        float combinedNoise = mix(noise1, noise2, 0.4); // Weighted mix of the two noise layers

        // Apply noise strength
        combinedNoise *= mix(uNoiseStrength2, uNoiseStrength, mixFactor); // Apply strength based on land/water

        // Apply noise quality bounds and Fresnel influence from vertex shader
        combinedNoise = mix(vNoiseQualityBounds.x, vNoiseQualityBounds.y, combinedNoise);
        combinedNoise = mix(0.5, combinedNoise, vNoiseQualityFresnel);


        // Brightness - Keep luma calculation
        float adjustedBrightness = luma(outgoingLight);

        // --- Color Ramp Mixing for Ethereal Look ---
        // Modify lerp factor calculation to use powered noise and brightness
        float lerpFactor = clamp(pow(combinedNoise, uNoisePower) * adjustedBrightness, 0.0, 1.0); // Use powered noise

        vec3 finalColor;
        if (equirectangularMapColor.r > uShoreThreshold) {
            finalColor = texture(uWaterColors, vec2(lerpFactor, 0.5)).rgb; // Corrected from texture2D
        } else {
            finalColor = texture(uLandColors, vec2(lerpFactor, 0.5)).rgb; // Corrected from texture2d
        }

        // --- Removed Lighting Calculation for Day/Night ---
        // The final color is now solely based on the environment map, noise, and color ramps.

        // Apply bloom intensity
        finalColor *= bloomIntensity;

        gl_FragColor = vec4(finalColor, 1.0); // Set final color and alpha
    }
`;

// --- 5. Initial Setup ---
async function initialize() {
    canvas = document.getElementById("three-globe");
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.75;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    const initialLatLon = [14.0583, 108.2772];
    const initialPos = latLonToVector3(...initialLatLon, RADIUS + 0.1);
    camera.position.copy(initialPos.clone().normalize().multiplyScalar(RADIUS + 30));

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enablePan = false;

    // Event Listeners
    window.addEventListener("resize", setRendererSize);
    window.addEventListener("load", async () => {
        setRendererSize();
        await createGlobe(); // Ensure globe is created before pins and outlines
        addLights(scene, renderer); // Add ambient light
        createCountryPins();
        loadCountryOutlines();
        // Initialize shooting star manager here after globe is created
        shootingStarManager = new ShootingStarManager(scene, globe);

        // Mouse event listeners for interaction handling
        canvas.addEventListener('mousemove', event => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            lastMouseEvent = event;
        });

        controls.addEventListener('start', () => {
            isDragging = true;
            autoSpinSpeed = 0; // Pause auto-spin when dragging starts
        });

        controls.addEventListener('end', () => {
            isDragging = false;
            // Resume auto-spin after a short delay if not currently hovered
            setTimeout(() => {
                if (!isHovered) { // Only resume if not hovered over an interactive element
                    autoSpinSpeed = 0.0005;
                }
            }, 200);
        });

        animate(); // Start the animation loop
    });
}

// --- 6. Globe Creation ---
async function createGlobe() {
    // Load textures
    const textureLoader = new THREE.TextureLoader();
    const rgbeLoader = new RGBELoader();

    const [
        equirectangularMap, // The main map for land/water/shadows
        actualWaterRamp,    // Texture for water colors
        actualLandRamp,     // Texture for land colors
        globeEnvMap         // HDR Environment map
    ] = await Promise.all([
        textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/earthmap.png'), // Your equirectangular map
        textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/Rectangle%205702.png'), // Assuming this is your WATER color ramp
        textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/Rectangle%205701.png'), // Assuming this is your LAND color ramp
        rgbeLoader.loadAsync('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr') // environment map
    ]);

    // Set texture filters
    equirectangularMap.minFilter = THREE.LinearMipmapLinearFilter;
    equirectangularMap.magFilter = THREE.LinearFilter;
    actualWaterRamp.minFilter = THREE.LinearFilter;
    actualWaterRamp.magFilter = THREE.LinearFilter;
    actualLandRamp.minFilter = THREE.LinearFilter;
    actualLandRamp.magFilter = THREE.LinearFilter;

    // Create environment map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromEquirectangular(globeEnvMap).texture;
    globeEnvMap.dispose(); // Dispose of the HDR texture as it's no longer needed
    pmremGenerator.dispose(); // Dispose of the generator

    scene.environment = envMap;

    // Create custom material
    const globeMaterial = new THREE.MeshStandardMaterial({
        depthWrite: true,
        depthTest: true,
    });

    globeMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uEquirectangularMap = { value: equirectangularMap };
        shader.uniforms.uWaterColors = { value: actualWaterRamp };
        shader.uniforms.uLandColors = { value: actualLandRamp };
        shader.uniforms.uNoiseQuality = { value: 1 };
        shader.uniforms.uLandEnvMultiplier = { value: 1 };
        shader.uniforms.envMap = { value: envMap };
        // Removed uLightDirection uniform
        // Removed uAmbientStrength uniform

        shader.vertexShader = GlobeVertexShader;
        shader.fragmentShader = GlobeFragmentShader;

        globe.userData.shader = shader;
    };

    globe = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS, 64, 64),
        globeMaterial
    );
    // Add userData to the globe mesh itself for raycasting
    globe.userData = { isGlobe: true };
    scene.add(globe);
}

// --- 7. Lighting ---
// Removed directionalLight variable

function addLights(scene, renderer) {
    // Remove existing lights to prevent duplicates on re-initialization
    scene.traverse(object => {
        if (object.isLight) {
            scene.remove(object);
        }
    });

    // Only add ambient light
    const ambientLight = new THREE.AmbientLight(TECH_PALETTE.white, 0.9);
    scene.add(ambientLight);

    // Removed directional light creation and positioning
    // Removed storing worldLightDirection in globe.userData
}


// --- 8. Country Outlines ---
function loadCountryOutlines() {
    fetch('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/custom.geo.map.json')
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
                // Ensure lineColor is defined even if highlightedCountries[name] exists but has no color property
                const lineColor = (isHighlighted && highlightedCountries[name].color !== undefined) ? highlightedCountries[name].color : TECH_PALETTE.accent;
                const opacity = isHighlighted ? 1 : 0.1;

                const addOutline = (polyCoords) => {
                    const outlineOffset = RADIUS + 0.05;
                    const points = polyCoords.map(([lon, lat]) => latLonToVector3(lat, lon, outlineOffset));
                    // Avoid creating lines with less than 2 points
                    if (points.length < 2) return;

                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({
                        color: lineColor,
                        transparent: true,
                        opacity: opacity,
                        depthTest: true,
                        depthWrite: true,
                    });
                    const line = new THREE.Line(geometry, material);
                    line.userData = { countryName: name, isCountryOutline: true };
                    countryMeshes.push(line); // Add to the general list
                    if (!countryLineMeshes[name]) {
                        countryLineMeshes[name] = [];
                    }
                    countryLineMeshes[name].push(line); // Add to the map for quick access
                    globe.add(line);
                    // Only add initially highlighted countries to bloom selection
                    if (isHighlighted) {
                        selectiveBloom.selection.add(line);
                    }
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
}

// --- 9. Country Pins ---
let countryPins = {}; // Not used directly in logic, but kept for potential future use

function createCountryPins() {
    const pinHeadGeometry = new THREE.SphereGeometry(PIN_HEAD_RADIUS, 24, 16);
    const pinStickGeometry = new THREE.CylinderGeometry(PIN_STICK_RADIUS, PIN_STICK_RADIUS, PIN_STICK_HEIGHT, 20);
    const pinMaterial = new THREE.MeshStandardMaterial({
        color: PIN_COLOR,
        roughness: 0,
        metalness: 0,
        transparent: true,
        opacity: 0.9,
        emissive: TECH_PALETTE.highlight,
        emissiveIntensity: 0.0, // Start with 0
        depthTest: true,
        depthWrite: true,
    });

    for (const [name, [lat, lon]] of Object.entries(countryCoordinates)) {
        const position = latLonToVector3(lat, lon, RADIUS);
        const normal = position.clone().normalize();

        const pinGroup = new THREE.Group();

        // Pin Head
        const pinHead = new THREE.Mesh(pinHeadGeometry, pinMaterial.clone());
        pinHead.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT);
        pinHead.userData = { countryName: name, isPinHead: true };
        pinGroup.add(pinHead);

        // Pin Stick
        const stickMaterial = new THREE.MeshStandardMaterial({
            color: TECH_PALETTE.accent,
            transparent: true,
            opacity: 0.8,
            roughness: 0.5,
            metalness: 0.2,
            depthTest: true,
            depthWrite: true,
        });
        const pinStick = new THREE.Mesh(pinStickGeometry, stickMaterial);
        pinStick.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT / 2);
        pinStick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        pinStick.userData = { countryName: name, isPinStick: true };
        pinGroup.add(pinStick);

        pinGroup.userData = { countryName: name, isPin: true };
        countryPins[name] = pinGroup; // Store in countryPins (optional)
        countryPinMeshes[name] = pinGroup; // Store in map for quick access
        globe.add(pinGroup); // Add the group to the globe

        // Label Sprite
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.font = 'bold 18px Verdana';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(name, labelCanvas.width / 2, labelCanvas.height / 2);

        const labelTex = new THREE.CanvasTexture(labelCanvas);
        const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: true, depthWrite: true, transparent: true, color: 0xFFFFFF }));

        // Position the label slightly above and outwards from the pin head
        const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
        const north = new THREE.Vector3().crossVectors(normal, east).normalize(); // Corrected calculation for 'north' vector
        const OUT_OFFSET = PIN_STICK_HEIGHT + 0.5;
        const HORIZONTAL_SHIFT = 0.0; // Adjust for horizontal positioning relative to pin
        const VERTICAL_SHIFT = 0.6;  // Adjust for vertical positioning relative to pin

        labelSprite.position.copy(
            position.clone()
                .addScaledVector(normal, OUT_OFFSET)
                .addScaledVector(east, HORIZONTAL_SHIFT)
                .addScaledVector(north, VERTICAL_SHIFT)
        );
        labelSprite.scale.set(6, 1.8, 1); // Adjust scale as needed
        labelSprite.userData = { countryName: name, isLabel: true };
        pinLabelSprites.push(labelSprite); // Add to the general list
        labelSprites[name] = labelSprite; // Store in map for quick access
        globe.add(labelSprite); // Add the sprite to the globe
    }
}

// --- 10. Shooting Stars ---
class ShootingStar {
    constructor(startCountry, endCountry, scene, globeGroup) {
        this.start = startCountry;
        this.end = endCountry;
        this.scene = scene;
        this.group = globeGroup;

        const a = countryCoordinates[startCountry];
        const b = countryCoordinates[endCountry];
        if (!a || !b) { this.isFinished = true; return; } // Exit if coordinates are missing

        const startBase = latLonToVector3(...a, RADIUS);
        const startNormal = startBase.clone().normalize();
        this.startPos = startBase.clone().addScaledVector(startNormal, PIN_STICK_HEIGHT);

        const endBase = latLonToVector3(...b, RADIUS);
        const endNormal = endBase.clone().normalize();
        this.endPos = endBase.clone().addScaledVector(endNormal, PIN_STICK_HEIGHT);

        const distance = this.startPos.distanceTo(this.endPos);

        // Calculate a control point for the Bezier curve
        // It's positioned outwards from the midpoint between start and end normals
        const midSphereNormal = startNormal.clone().add(endNormal).normalize();
        const heightOffset = 1.5 + distance * 0.4; // Adjust height based on distance
        const controlPoint = midSphereNormal.multiplyScalar(RADIUS + 1 + heightOffset);

        this.path = new THREE.QuadraticBezierCurve3(
            this.startPos,
            controlPoint,
            this.endPos
        );

        this.length = this.path.getLength();
        this.speed = 18; // Speed of the star along the path
        this.progress = 0; // Current progress along the path (0 to 1)

        // Trail properties
        this.trailLength = 150; // Max number of points in the trail
        this.trailGeo = new THREE.BufferGeometry();
        this.trailPts = new Float32Array(this.trailLength * 3); // Positions
        this.trailCols = new Float32Array(this.trailLength * 3); // Colors
        this.trailAlps = new Float32Array(this.trailLength);     // Alphas
        this.trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPts, 3));
        this.trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailCols, 3));
        this.trailGeo.setAttribute('alpha', new THREE.BufferAttribute(this.trailAlps, 1));

        const trailMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                bloomIntensity: { value: 0.5 },
                bloomFalloff: { value: 18.0 },
                noiseScale: { value: new THREE.Vector2(10.0, 100.0) },
                color: { value: new THREE.Color(TECH_PALETTE.white) },
            },
            vertexShader: `
                attribute vec3 color;
                attribute float alpha;
                varying   vec3 vColor;
                varying   float vAlpha;

                void main(){
                    vColor = color;
                    vAlpha = alpha;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = 2.0; // Size of each point in the trail
                }
            `,
            fragmentShader: `
                varying vec3  vColor;
                varying float vAlpha;
                uniform float uTime;
                uniform float bloomIntensity;
                uniform float bloomFalloff;
                uniform vec2  noiseScale;

                // Simple random function
                float rand(vec2 n) {
                    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
                }
                // Simple noise function
                float noise(vec2 n) {
                    vec2 d = vec2(0.0, 1.0);
                    vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
                    return mix(
                        mix(rand(b),      rand(b + d.yx), f.x),
                        mix(rand(b + d.xy), rand(b + d.yy), f.x),
                        f.y
                    );
                }
                void main() {
                    vec2 uv = gl_PointCoord;
                    float n  = noise(uv * noiseScale + vec2(uTime * 0.5)); // Add some noise to the point
                    float threshold = mix(0.2, 0.8, vAlpha); // Discard based on alpha
                    if(n > threshold) discard;

                    float bloom = bloomIntensity * pow(vAlpha, bloomFalloff); // Calculate bloom effect
                    vec3  col  = vColor + vColor * bloom; // Apply bloom to color

                    gl_FragColor = vec4(col, vAlpha); // Set final color and alpha
                }
            `,
            blending: THREE.AdditiveBlending, // Additive blending for a brighter effect
            depthTest: true, // Enable depth testing
            depthWrite: false, // Disable depth writing to prevent occluding other transparent objects
            transparent: true, // Material is transparent
        });
        this.trailMesh = new THREE.Points(this.trailGeo, trailMat);
        this.group.add(this.trailMesh); // Add to the globe group so it rotates with the globe

        this.points = []; // Array to store trail points {pos, age}
        this.hasArrived = false;
        this.isFinished = false; // Flag to indicate if the star has completed its journey and faded
    }

    // Adds a new point to the star's trail
    _addTailPoint(pos) {
        this.points.push({ pos: pos.clone(), age: 0 });
        // Remove oldest point if trail exceeds max length
        while (this.points.length > this.trailLength) this.points.shift();
    }

    // Updates the star's position and trail
    update(delta) {
        if (this.isFinished) return; // Do nothing if finished

        const stepSize = (this.speed / this.length) * delta; // Calculate movement step
        const oldProg = this.progress;
        this.progress = Math.min(1, this.progress + stepSize); // Increment progress

        // If star hasn't arrived at its destination
        if (!this.hasArrived) {
            if (this.progress >= 1.0) {
                this.hasArrived = true; // Mark as arrived
            } else {
                // Add multiple points along the step for a smoother trail
                const STEPS = 3; // Number of points to add per update frame
                for (let i = 1; i <= STEPS; i++) {
                    const t = oldProg + (this.progress - oldProg) * (i / STEPS);
                    const p = this.path.getPointAt(t);
                    this._addTailPoint(p);
                }
            }
        }

        // Update trail points (age, alpha, position, color)
        let pi = 0, ci = 0, ai = 0; // Indices for position, color, alpha arrays
        const color = this.trailMesh.material.uniforms.color.value;
        for (let i = 0; i < this.points.length; i++) {
            const pt = this.points[i];
            pt.age += delta; // Increment age of the point
            const alpha = 1.0 - Math.min(1.0, pt.age / 1); // Calculate alpha based on age (fades out over 1 second)

            this.trailPts[pi++] = pt.pos.x;
            this.trailPts[pi++] = pt.pos.y;
            this.trailPts[pi++] = pt.pos.z;
            this.trailCols[ci++] = color.r;
            this.trailCols[ci++] = color.g;
            this.trailCols[ci++] = color.b;
            this.trailAlps[ai++] = alpha;
        }
        // Fill remaining buffer with zeros if trail is shorter than max length
        for (let i = this.points.length; i < this.trailLength; i++) {
            this.trailPts[pi++] = 0; this.trailPts[pi++] = 0; this.trailPts[pi++] = 0;
            this.trailCols[ci++] = 0; this.trailCols[ci++] = 0; this.trailCols[ci++] = 0;
            this.trailAlps[ai++] = 0;
        }

        // Mark buffers as needing update
        this.trailGeo.attributes.position.needsUpdate = true;
        this.trailGeo.attributes.color.needsUpdate = true;
        this.trailGeo.attributes.alpha.needsUpdate = true;
        this.trailGeo.setDrawRange(0, this.points.length); // Only draw active points

        // If star has arrived and trail points are still fading
        if (this.hasArrived && this.points.length > 0) {
            // Check if the oldest point has fully faded
            const oldestPointAge = this.points[0].age;
            if (oldestPointAge > 1.0) { // If the oldest point has fully faded
                 this.points.shift(); // Remove it
                 if (this.points.length === 0) { // If all points have faded
                     this.group.remove(this.trailMesh);
                     this.trailGeo.dispose();
                     this.trailMesh.material.dispose();
                     this.isFinished = true;
                 }
            }
        } else if (this.hasArrived && this.points.length === 0) {
             // If arrived and no points left (e.g., very short trails or immediate fade)
             this.group.remove(this.trailMesh);
             this.trailGeo.dispose();
             this.trailMesh.material.dispose();
             this.isFinished = true;
        }
    }

    // Clean up resources (not strictly necessary here as it's handled in update)
    dispose() {
        if (this.trailMesh && this.trailMesh.parent) {
            this.trailMesh.parent.remove(this.trailMesh);
        }
        if (this.trailGeo) this.trailGeo.dispose();
        if (this.trailMesh && this.trailMesh.material) this.trailMesh.material.dispose();
    }
}


class ShootingStarManager {
    constructor(scene, globe) {
        this.scene = scene;
        this.globe = globe; // The group to add stars to (so they rotate with the globe)
        this.stars = [];
        this.interval = 0.5; // Time in seconds between new stars
        this.elapsed = 0;
        this.countries = Object.keys(countryCoordinates); // Use countryCoordinates for star paths
    }

    update(dt) {
        // Update existing stars and remove finished ones
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const s = this.stars[i];
            s.update(dt);
            if (s.isFinished) {
                s.dispose(); // Ensure cleanup
                this.stars.splice(i, 1);
            }
        }
        // Add new stars periodically
        this.elapsed += dt;
        if (this.elapsed >= this.interval) {
            this.elapsed = 0;
            const names = this.countries;
            if (names.length < 2) return; // Need at least two countries to make a star

            let a = Math.floor(Math.random() * names.length);
            let b = Math.floor(Math.random() * names.length);
            while (b === a) b = Math.floor(Math.random() * names.length); // Ensure different start and end

            const star = new ShootingStar(names[a], names[b], this.scene, this.globe);
             if (!star.isFinished) { // Check if star was successfully initialized
                 this.stars.push(star);
             }
        }
    }
}

let shootingStarManager; // Declare the manager variable

// --- 11. Interaction Handling ---
function handleInteractions() {
    raycaster.setFromCamera(mouse, camera);

    // Collect ALL potentially interactive objects (outlines, pins, labels, and the globe itself)
    const interactiveObjects = [];
    // Iterate through all countries that have pins/outlines/labels created
    for (const countryName in countryCoordinates) { // Use countryCoordinates or check existence in maps
        // Add country outline lines if they exist
        if (countryLineMeshes[countryName]) {
            interactiveObjects.push(...countryLineMeshes[countryName]);
        }
        // Add pin parts (head and stick) if they exist
        if (countryPinMeshes[countryName]) {
            interactiveObjects.push(...countryPinMeshes[countryName].children);
        }
        // Add label sprite if it exists
        if (labelSprites[countryName]) {
            interactiveObjects.push(labelSprites[countryName]);
        }
    }

    // Add the globe itself to interactive objects for hover scaling
    if (globe) {
        interactiveObjects.push(globe);
    }


    // Only intersect with potentially interactive objects
    // Set recursive to true to check children of groups (like pin heads/sticks)
    const intersects = raycaster.intersectObjects(interactiveObjects, true);

    let hoveredCountryElement = null; // Tracks if a highlighted country outline, pin, or label is hovered
    let hoveredGlobeSurface = false; // Tracks if the general globe surface is hovered

    if (intersects.length > 0 && lastMouseEvent) {
        // Find the first intersected object that is a highlighted country element OR the globe
        for (let i = 0; i < intersects.length; i++) {
            const object = intersects[i].object;
            // Check if the intersected object or its parent is a highlighted country element
            if ((object.userData && object.userData.countryName && highlightedCountries.hasOwnProperty(object.userData.countryName)) ||
                (object.parent && object.parent.userData && object.parent.userData.countryName && highlightedCountries.hasOwnProperty(object.parent.userData.countryName))) {
                 // Get the country name from either the object or its parent
                 hoveredCountryElement = object.userData.countryName || object.parent.userData.countryName;
                 break; // Found a highlighted country element, stop searching
            } else if (object === globe) {
                // Check if the intersected object is the globe itself
                hoveredGlobeSurface = true;
            }
        }
    }

    // Determine the overall 'isHovered' state: true if any interactive element is hovered
    isHovered = hoveredCountryElement !== null || hoveredGlobeSurface;

    // --- Highlighting Logic (Country) ---
    // Only update highlighting if the hovered country element has changed
    if (hoveredCountryElement !== highlightedCountryName) {
        // Unhighlight the previously highlighted country if any
        if (highlightedCountryName) {
            unhighlightCountry(highlightedCountryName);
        }
        // Highlight the new hovered country element if any
        if (hoveredCountryElement) {
            showTooltip(hoveredCountryElement, lastMouseEvent);
            highlightCountry(hoveredCountryElement);
        } else {
            // No highlighted country element is hovered, hide tooltip
            hideTooltip();
        }
        // Update the currently highlighted country name
        highlightedCountryName = hoveredCountryElement;
    } else if (hoveredCountryElement) {
         // If still hovering over the same HIGHLIGHTED country element, update tooltip position
         showTooltip(hoveredCountryElement, lastMouseEvent);
    } else if (!hoveredCountryElement) {
         // If no highlighted country element is hovered, ensure tooltip is hidden
         hideTooltip();
    }


    // --- Globe Scaling Logic (Hover) ---
    // Scale up if any interactive element (highlighted country element or globe) is hovered
    if (isHovered) {
        targetGlobeScale = HOVER_SCALE_FACTOR;
    } else {
        targetGlobeScale = 1.0;
    }

     // Resume auto-spin if not hovered or dragging
     // This condition is now simplified because isHovered covers both highlighted elements and globe surface
     if (!isHovered && !isDragging && autoSpinSpeed === 0) {
         autoSpinSpeed = 0.0005;
     }
}


// --- 12. Animation Loop ---
function animate() {
    animateId = requestAnimationFrame(animate); // Request next frame

    // Auto-spin the globe if not dragging and not hovered over any interactive element
    if (globe && !isDragging && !isHovered) {
        globe.rotation.y += autoSpinSpeed;
    }

    controls.update(); // Update OrbitControls

    const delta = clock.getDelta(); // Get time elapsed since last frame

    // Update uTime uniform in the globe shader for animations
    if (globe && globe.userData.shader) {
        globe.userData.shader.uniforms.uTime.value += delta;

        // Removed update for uLightDirection uniform
    }

    // Animate globe scale
    if (globe) {
        currentGlobeScale = THREE.MathUtils.lerp(currentGlobeScale, targetGlobeScale, SCALE_ANIMATION_SPEED);
        globe.scale.set(currentGlobeScale, currentGlobeScale, currentGlobeScale);
    }

    // Update shooting stars animation
    if (shootingStarManager) {
        shootingStarManager.update(delta);
    }

    // Handle mouse interactions and highlighting (now also handles globe hover)
    handleInteractions();

    // Call any registered animation callbacks (if any were added)
    animateCallbacks.forEach(callback => callback());

    // Render the scene using the composer for post-processing effects
    if (composer) {
        composer.render();
    } else {
        // Fallback render if composer isn't ready (shouldn't happen with current load logic)
        renderer.render(scene, camera);
    }
}

// --- 13. Initialization Call ---
initialize(); // Start the setup process
