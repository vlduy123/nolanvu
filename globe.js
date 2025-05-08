import * as THREE from "https://esm.sh/three";
import { OrbitControls } from "https://esm.sh/three/addons/controls/OrbitControls.js";
import {
    EffectComposer,
    RenderPass,
    SelectiveBloomEffect,
    EffectPass,
} from "https://esm.sh/postprocessing";
import { RGBELoader } from 'https://esm.sh/three/addons/loaders/RGBELoader.js';

// --- 1. Scene Setup ---
let canvas, renderer, scene, camera, controls;
let composer;
let selectiveBloom;
let raycaster;
let mouse;
let clock;

// --- 2. Constants and Variables ---
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
let isHovered = false;
const targetHoverColor = new THREE.Color(TECH_PALETTE.blueHighlight);

// Meshes and Sprites
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
    "Australia": { coords: [-25.2744, 133.7751], color: TECH_PALETTE.highlight },
    "United States of America": { coords: [37.0902, -95.7129], color: TECH_PALETTE.highlight },
    "Germany": { coords: [51.1657, 10.4515], color: TECH_PALETTE.highlight },
    "Thailand": { coords: [15.87, 100.9925], color: TECH_PALETTE.highlight },
    "Malaysia": { coords: [2.5, 112.5], color: TECH_PALETTE.highlight },
    "Singapore": { coords: [1.3521, 103.8198], color: TECH_PALETTE.highlight },
};


let animateCallbacks = [];

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

    if (!composer) {
        composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        selectiveBloom = new SelectiveBloomEffect(scene, camera, {
            intensity: 0.2,
            radius: 0.2,
            luminanceThreshold: 0.5,
            luminanceSmoothing: 0.2,
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
    const tooltip = document.getElementByClassName('tooltip');
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
    // Keep tooltip visible while hovered, hide after a short delay if not hovered
    tooltipTimeout = setTimeout(() => {
         if (!isHovered || highlightedCountryName !== countryName) {
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
     // Reset highlight for lines
    if (countryLineMeshes[countryName]) {
        countryLineMeshes[countryName].forEach(line => {
            const originalColor = highlightedCountries[countryName] ? highlightedCountries[countryName].color : TECH_PALETTE.accent;
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

// --- Shaders ---
const GlobeVertexShader = `
// Refactored Globe Vertex Shader
// Calculates position, UVs, and reflection vectors for land and water.

varying vec2 vUv;
varying vec3 vReflectLand;
varying vec3 vReflectWater;
varying vec3 vPosition;

// Constants for reflection roughness
const float uRoughness = 0.45; // Roughness for water reflection
const float uRoughness2 = 1.0; // Roughness for land reflection

// Uniform for environment map rotation
uniform mat3 envMapRotation;

// Helper function to transform direction from view space to world space
vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
    return normalize((vec4(dir, 0.0) * matrix).xyz);
}

// Helper function to calculate reflection vector with roughness
vec3 calculateReflection(vec3 viewDir, vec3 n, float rough) {
    // Standard reflection calculation
    vec3 reflectVec = reflect(-viewDir, n);
    // Mix with normal based on roughness for blurred reflections
    reflectVec = normalize(mix(reflectVec, n, rough * rough));

    // Transform reflection vector from view space to world space
    reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
    // Apply environment map rotation and transform back to view space for sampling
    reflectVec = (viewMatrix * vec4(envMapRotation * reflectVec, 0.0)).xyz;
    return reflectVec;
}

void main() {
    // Calculate model-view position
    vec4 mvPosition = modelViewMatrix * vec4(position, 1);

    // Calculate view space normal and view direction
    vec3 viewNormal = normalize(normalMatrix * normal);
    vec3 viewDir = normalize(-mvPosition.xyz);

    // Pass UVs and view space position to fragment shader
    vUv = uv;
    vPosition = mvPosition.xyz;

    // Calculate final vertex position
    gl_Position = projectionMatrix * mvPosition;

    // Calculate reflection vectors for land and water with different roughness
    vReflectLand = calculateReflection(viewDir, viewNormal, uRoughness2);
    vReflectWater = calculateReflection(viewDir, viewNormal, uRoughness);

    // Removed noise quality calculations as they were commented out in fragment shader usage.
}

`;

const GlobeFragmentShader = `
// Refactored Globe Fragment Shader
// Determines land/water, applies environment map, adds noise, and samples color maps.

#include <common> // Includes standard Three.js uniforms and functions
#include <cube_uv_reflection_fragment> // Includes textureCubeUV for roughness-based sampling

// Constant for determining land vs water based on equirectangular map red channel
const float uShoreThreshold = 0.39;

// Water properties
const float uWaterShadowMultiplier = 1.2; // Multiplier for water shadow intensity
const float uRoughness = 0.45;          // Roughness for water reflection (matches vertex shader)
const float uEnvMapIntensity = 0.02;    // Environment map intensity for water
const float uNoiseScale = 1500.0;       // Scale of the noise pattern for water
const float uNoiseStrength = 0.75;      // Strength/amplitude of the noise for water
const float uBloomIntensity = 2.6;      // Bloom intensity for water

// Land properties
const float uRoughness2 = 1.0;          // Roughness for land reflection (matches vertex shader)
const float uEnvMapIntensity2 = 0.19;   // Environment map intensity for land
const float uNoiseScale2 = 2000.0;      // Scale of the noise pattern for land (Note: not currently used, uNoiseScale is used for both)
const float uNoiseStrength2 = 1.0;      // Strength/amplitude of the noise for land (Note: not currently used, uNoiseStrength is used for both)
const float uBloomIntensity2 = 1.28;    // Bloom intensity for land

// Global noise scale multiplier (Note: not currently used, uNoiseScale is used directly)
const float uNoiseScaleMultiplier = 1.0;

// Varying variables from vertex shader
varying vec2 vUv;
varying vec3 vReflectLand;
varying vec3 vReflectWater;
varying vec3 vPosition; // View space position

// Removed noise quality varyings as they were unused.
// varying vec2 vNoiseQualityBounds;
// varying float vNoiseQualityFresnel;

// Uniform textures
uniform sampler2D uEquirectangularMap; // Map defining land/water and shadow (red channel for land/water, blue for shadow)
uniform sampler2D uWaterColors;        // Color ramp for water based on noise/brightness
uniform sampler2D uLandColors;         // Color ramp for land based on noise/brightness
uniform sampler2D envMap;              // Environment map for reflections

// Uniform time for noise animation
uniform float uTime;
// Uniform multiplier for land environment map intensity
uniform float uLandEnvMultiplier;

//
// psrdnoise2.glsl - Perlin Simplex Rotationally invariant Distributed noise
// (Included directly in the shader)
// Authors: Stefan Gustavson (stefan.gustavson@gmail.com)
// and Ian McEwan (ijm567@gmail.com)
// Version 2021-12-02, published under the MIT license
//
// Computes 2D noise and its gradient.
float psrdnoise(vec2 x, float alpha, out vec2 gradient) {
    vec2 uv = vec2(x.x + x.y * 0.5, x.y);
    vec2 i0 = floor(uv);
    vec2 f0 = fract(uv);
    float cmp = step(f0.y, f0.x);
    vec2 o1 = vec2(cmp, 1.0 - cmp);
    vec2 i1 = i0 + o1;
    vec2 i2 = i0 + vec2(1.0, 1.0);
    vec2 v0 = vec2(i0.x - i0.y * 0.5, i0.y);
    vec2 v1 = vec2(v0.x + o1.x - o1.y * 0.5, v0.y + o1.y);
    vec2 v2 = vec2(v0.x + 0.5, v0.y + 1.0);
    vec2 x0 = x - v0;
    vec2 x1 = x - v1;
    vec2 x2 = x - v2;
    vec3 iu, iv;
    iu = vec3(i0.x, i1.x, i2.x);
    iv = vec3(i0.y, i1.y, i2.y);
    vec3 hash = mod(iu, 289.0);
    hash = mod((hash * 51.0 + 2.0) * hash + iv, 289.0);
    hash = mod((hash * 34.0 + 10.0) * hash, 289.0);
    vec3 psi = hash * 0.07482 + alpha;
    vec3 gx = cos(psi);
    vec3 gy = sin(psi);
    vec2 g0 = vec2(gx.x, gy.x);
    vec2 g1 = vec2(gx.y, gy.y);
    vec2 g2 = vec2(gx.z, gy.z);
    vec3 w = 0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2));
    w = max(w, 0.0);
    vec3 w2 = w * w;
    vec3 w4 = w2 * w2;
    vec3 gdotx = vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2));
    float n = dot(w4, gdotx);
    vec3 w3 = w2 * w;
    vec3 dw = -8.0 * w3 * gdotx;
    vec2 dn0 = w4.x * g0 + dw.x * x0;
    vec2 dn1 = w4.y * g1 + dw.y * x1;
    vec2 dn2 = w4.z * g2 + dw.z * x2;
    gradient = 10.9 * (dn0 + dn1 + dn2);
    return 10.9 * n;
}

// Helper function to calculate luminance (brightness) of a color
float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

// Removed mapValue and rotate2d as they were only used in commented-out code.
// float mapValue(float value, float minInput, float maxInput) { ... }
// vec2 rotate2d(vec2 v, float a) { ... }

void main() {
    // Sample the equirectangular map to determine land/water and shadow
    vec4 equirectangularMapColor = texture2D(uEquirectangularMap, vUv);

    // Determine if the current fragment is land or water based on the red channel
    float isLand = step(uShoreThreshold, equirectangularMapColor.r); // 1.0 for land, 0.0 for water

    // Select roughness, env map intensity, and bloom intensity based on land/water
    float roughnessFactor = mix(uRoughness2, uRoughness, isLand); // uRoughness2 for land, uRoughness for water
    float customEnvMapIntensity = mix(uEnvMapIntensity2 * uLandEnvMultiplier, uEnvMapIntensity, isLand); // Adjusted intensity for land/water
    float bloomIntensity = mix(uBloomIntensity2, uBloomIntensity, isLand); // Bloom intensity for land/water

    // Sample the environment map based on the reflection vector and roughness
    vec4 envMapColor;
    if (isLand > 0.5) { // Land
        envMapColor = textureCubeUV(envMap, vReflectLand, roughnessFactor);
    } else { // Water
        envMapColor = textureCubeUV(envMap, vReflectWater, roughnessFactor);
    }

    // Apply environment map intensity
    vec3 outgoingLight = envMapColor.rgb * customEnvMapIntensity;

    // Add noise for surface variation
    vec2 noiseCoord = vec2(uNoiseScale * vUv); // Use UVs for noise coordinates
    vec2 g; // Gradient output from noise function
    float noise = 0.5 + 0.4 * psrdnoise(noiseCoord, 2.0 * uTime, g); // Calculate noise, animated by time
    // Removed noise quality mixing as it was commented out.

    // Apply noise strength
    noise *= uNoiseStrength; // Use uNoiseStrength for both land and water noise amplitude

    // Calculate brightness based on the environment map sample
    float adjustedBrightness = luma(outgoingLight);

    // Apply shadow based on the blue channel of the equirectangular map
    // Assumes blue channel contains shadow information (0.0 for full shadow, 1.0 for no shadow)
    float shadowIntensity = (1.0 - equirectangularMapColor.b * uWaterShadowMultiplier);
    adjustedBrightness *= shadowIntensity;

    // Combine noise and brightness to get a factor for color lookup
    float lerpFactor = clamp(noise * adjustedBrightness, 0.0, 1.0);

    // Sample the appropriate color map (land or water) based on the lerp factor
    if (isLand > 0.5) { // Land
        gl_FragColor.rgb = texture2D(uLandColors, vec2(lerpFactor, 0.5)).rgb;
    } else { // Water
        gl_FragColor.rgb = texture2D(uWaterColors, vec2(lerpFactor, 0.5)).rgb;
    }

    // Apply bloom intensity
    gl_FragColor.rgb *= bloomIntensity;
    gl_FragColor.a = 1.0; // Fully opaque

}

`;

// --- 4. Initial Setup ---
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

    window.addEventListener("resize", setRendererSize);
    window.addEventListener("load", async () => { // Made the load callback async
        setRendererSize();
        await createGlobe(); // Ensure globe is created before pins and outlines
        createCountryPins();
        loadCountryOutlines();
        animate();
    });

    canvas.addEventListener('mousemove', event => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        lastMouseEvent = event;
    });

    controls.addEventListener('start', () => {
        isDragging = true;
        autoSpinSpeed = 0;
    });

    controls.addEventListener('end', () => {
        isDragging = false;
        // Resume auto-spin after a short delay if not currently hovered
        setTimeout(() => {
            if (!isHovered) {
                 autoSpinSpeed = 0.0005;
            }
        }, 200);
    });

    addLights();
    // shootingStarManager is initialized after globe is created in window.load
}

async function createGlobe() {
    // Load textures from example URLs - REPLACE WITH YOUR OWN ASSETS
    const textureLoader = new THREE.TextureLoader();
    const rgbeLoader = new RGBELoader();

    const [equirectangularMap, landColors, waterColors, globeEnvMap] = await Promise.all([
         // Replace with your actual texture URLs
        textureLoader.loadAsync('https://cdn.shopify.com/b/shopify-brochure2-assets/b23e66b0a6882935f23e3edf11266cb8.png'), // Example equirectangular map
        textureLoader.loadAsync('https://cdn.shopify.com/b/shopify-brochure2-assets/411a922121572cb3cc3cffd92d5fd822.png'), // Example water colors
        textureLoader.loadAsync('https://cdn.shopify.com/b/shopify-brochure2-assets/5128bbc7b2487e1051a19d99fd3e82fb.png'), // Example land colors
        rgbeLoader.loadAsync('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr') // Example environment map
    ]);


    // Set texture filters
    equirectangularMap.minFilter = THREE.LinearMipmapLinearFilter;
    equirectangularMap.magFilter = THREE.LinearFilter;
    waterColors.minFilter = THREE.LinearFilter;
    waterColors.magFilter = THREE.LinearFilter;
    landColors.minFilter = THREE.LinearFilter;
    landColors.magFilter = THREE.LinearFilter;

    // Create environment map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromEquirectangular(globeEnvMap).texture;
    globeEnvMap.dispose();
    pmremGenerator.dispose();

    scene.environment = envMap;
    scene.environmentRotation = new THREE.Euler(0, -1.13, 0); // Example rotation


    // Create custom material
    const globeMaterial = new THREE.MeshStandardMaterial({
        // Set depthWrite and depthTest to false
        depthWrite:  true,
        depthTest: true,
    });

    globeMaterial.onBeforeCompile = (shader) => {
        // Pass textures and uniforms to the shader
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uEquirectangularMap = { value: equirectangularMap };
        shader.uniforms.uWaterColors = { value: waterColors };
        shader.uniforms.uLandColors = { value: landColors };
        shader.uniforms.uNoiseQuality = { value: 1 }; // You might need to control this based on camera distance
        shader.uniforms.uLandEnvMultiplier = { value: 1 }; // For highlighting land
        shader.uniforms.envMap = { value: envMap }; // Pass the environment map

        // Inject custom vertex and fragment shaders
        shader.vertexShader = GlobeVertexShader;
        shader.fragmentShader = GlobeFragmentShader;

        // Store the shader for updating uniforms in the animate loop
        globe.userData.shader = shader;
    };


    globe = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS, 64, 64),
        globeMaterial
    );
    globe.rotation.set(0, Math.PI, 0); // Example rotation
    scene.add(globe);

    // Add a simple inner sphere for shadow/depth if needed (optional)
    const innerSphereMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.01,
        side: THREE.BackSide,
    });
    const innerSphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS - 0.1, 64, 64), innerSphereMaterial);
    globe.add(innerSphere);

     // Initialize shooting star manager here after globe is created
    shootingStarManager = new ShootingStarManager(scene, globe);
}

function addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, Math.PI * 0.5);
    scene.add(ambientLight);
}

// --- 5. Country Outlines ---
function loadCountryOutlines() {
    // Keeping the existing geojson source
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
                const lineColor = isHighlighted ? highlightedCountries[name].color : TECH_PALETTE.accent;
                const opacity = isHighlighted ? 1 : 0.1;

                const addOutline = (polyCoords) => {
                    const outlineOffset = RADIUS + 0.05;
                    const points = polyCoords.map(([lon, lat]) => latLonToVector3(lat, lon, outlineOffset));
                    const geometry = new THREE.BufferGeometry().setFromPoints(points);
                    const material = new THREE.LineBasicMaterial({
                        color: lineColor,
                        transparent: true,
                        opacity: opacity,
                        depthTest: true, // Set depthTest to false for outlines
                        depthWrite:  true, // Set depthWrite to false for outlines
                    });
                    const line = new THREE.Line(geometry, material);
                    line.userData = { countryName: name, isCountryOutline: true };
                    countryMeshes.push(line);
                    if (!countryLineMeshes[name]) {
                        countryLineMeshes[name] = [];

                    }
                    countryLineMeshes[name].push(line);
                    globe.add(line);
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
// --- 6. Country Pins ---
let countryPins = {};

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
        depthTest: true, // Set depthTest to false for pins
        depthWrite:  true, // Set depthWrite to false for pins
    });


    for (const [name, [lat, lon]] of Object.entries(countryCoordinates)) {
        const position = latLonToVector3(lat, lon, RADIUS);
        const normal = position.clone().normalize();

        const pinGroup = new THREE.Group();

        const pinHead = new THREE.Mesh(pinHeadGeometry, pinMaterial.clone());
        pinHead.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT);
        pinHead.userData = { countryName: name, isPinHead: true }; // Add userData for raycasting
        pinGroup.add(pinHead);

        const stickMaterial = new THREE.MeshStandardMaterial({
            color: TECH_PALETTE.accent,
            transparent: true,
            opacity: 0.8,
            roughness: 0.5,
            metalness: 0.2,
            depthTest: true, // Set depthTest to false for pin sticks
            depthWrite:  true, // Set depthWrite to false for pin sticks
        });
        const pinStick = new THREE.Mesh(pinStickGeometry, stickMaterial);
        pinStick.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT / 2);
        pinStick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        pinStick.userData = { countryName: name, isPinStick: true }; // Add userData for raycasting
        pinGroup.add(pinStick);

        pinGroup.userData = { countryName: name, isPin: true };
        countryPins[name] = pinGroup;
        countryPinMeshes[name] = pinGroup; // Store the pinGroup
        globe.add(pinGroup); // This line should now work as globe is defined

        // Label
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.font = 'bold 18px Verdana';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(name, labelCanvas.width / 2, labelCanvas.height / 2);

        const labelTex = new THREE.CanvasTexture(labelCanvas);
        const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex,    depthTest: true, depthWrite:  true, transparent: true, color: 0xFFFFFF }));

        const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
        const north = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), normal).normalize();
        const OUT_OFFSET = PIN_STICK_HEIGHT + 0.5;
        const HORIZONTAL_SHIFT = 0.0;
        const VERTICAL_SHIFT = 0.6;

        labelSprite.position.copy(
            position.clone()
                .addScaledVector(normal, OUT_OFFSET)
                .addScaledVector(east, HORIZONTAL_SHIFT)
                .addScaledVector(north, VERTICAL_SHIFT)
        );
        labelSprite.scale.set(6, 1.8, 1);
        labelSprite.userData = { countryName: name, isLabel: true }; // Add userData for raycasting
        pinLabelSprites.push(labelSprite);
        labelSprites[name] = labelSprite; // Store label sprite
        globe.add(labelSprite);
    }
}

// --- 7. Shooting Stars ---
class ShootingStar {
    constructor(startCountry, endCountry, scene, globeGroup) {
      this.start = startCountry;
      this.end = endCountry;
      this.scene = scene;
      this.group = globeGroup;

      const a = countryCoordinates[startCountry];
      const b = countryCoordinates[endCountry];
      if (!a || !b) { this.isFinished = true; return; }

      const startBase = latLonToVector3(...a, RADIUS);
      const startNormal = startBase.clone().normalize();
      this.startPos = startBase.clone().addScaledVector(startNormal, PIN_STICK_HEIGHT);

      const endBase = latLonToVector3(...b, RADIUS);
      const endNormal = endBase.clone().normalize();
      this.endPos = endBase.clone().addScaledVector(endNormal, PIN_STICK_HEIGHT);

      const distance = this.startPos.distanceTo(this.endPos);

      const midSphereNormal = startNormal.clone().add(endNormal).normalize();

      const heightOffset = 1.5 + distance * 0.4;

      const controlPoint = midSphereNormal.multiplyScalar(RADIUS + 0.8 + heightOffset);

      this.path = new THREE.QuadraticBezierCurve3(
        this.startPos,
        controlPoint,
        this.endPos
      );
  
      this.length = this.path.getLength();
      this.speed = 18;
      this.progress = 0;
  
      this.trailLength = 150;
      this.trailGeo = new THREE.BufferGeometry();
      this.trailPts = new Float32Array(this.trailLength * 3);
      this.trailCols = new Float32Array(this.trailLength * 3);
      this.trailAlps = new Float32Array(this.trailLength);
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
  
            gl_PointSize = 2.0;
          }
        `,
        fragmentShader: `
          varying vec3  vColor;
          varying float vAlpha;
          uniform float uTime;
          uniform float bloomIntensity;
          uniform float bloomFalloff;
          uniform vec2  noiseScale;
  
          float rand(vec2 n) {
            return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
          }
          float noise(vec2 n) {
            vec2 d = vec2(0.0, 1.0);
            vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
            return mix(
              mix(rand(b),       rand(b + d.yx), f.x),
              mix(rand(b + d.xy), rand(b + d.yy), f.x),
              f.y
            );
          }void main() {
            vec2 uv = gl_PointCoord;       
            float n  = noise(uv * noiseScale + vec2(uTime * 0.5));
            float threshold = mix(0.2, 0.8, vAlpha);
            if(n > threshold) discard;
  
            float bloom = bloomIntensity * pow(vAlpha, bloomFalloff);
            vec3  col  = vColor + vColor *bloom;
  
            gl_FragColor = vec4(col, vAlpha);
          }
        `,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
      });
      this.trailMesh = new THREE.Points(this.trailGeo, trailMat);
      this.group.add(this.trailMesh);
  
      this.points = [];
      this.hasArrived = false; this.isFinished = false;
    }
  
    _addTailPoint(pos) {
      this.points.push({ pos: pos.clone(), age: 0 });
      while (this.points.length > this.trailLength) this.points.shift();
    }
  
    update(delta) {
      if (this.isFinished) return;
      const stepSize = (this.speed / this.length) * delta;
      const oldProg = this.progress;
      this.progress = Math.min(1, this.progress + stepSize);
  
      if (!this.hasArrived) {
        if (this.progress >= 1.0) {
          this.hasArrived = true;
        } else {
          const STEPS = 3;
          for (let i = 1; i <= STEPS; i++) {
            const t = oldProg + (this.progress - oldProg) * (i / STEPS);
            const p = this.path.getPointAt(t);
            this._addTailPoint(p);
          }
        }
      }
  
      let pi = 0, ci = 0, ai = 0;
      const color = this.trailMesh.material.uniforms.color.value;
      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i];
        pt.age += delta;
        const alpha = 1.0 - Math.min(1.0, pt.age / 1);
        this.trailPts[pi++] = pt.pos.x;
        this.trailPts[pi++] = pt.pos.y;
        this.trailPts[pi++] = pt.pos.z;
        this.trailCols[ci++] = color.r;
        this.trailCols[ci++] = color.g;
        this.trailCols[ci++] = color.b;
        this.trailAlps[ai++] = alpha;
      }
      for (let i = this.points.length; i < this.trailLength; i++) {
        this.trailPts[pi++] = 0; this.trailPts[pi++] = 0; this.trailPts[pi++] = 0;
        this.trailCols[ci++] = 0; this.trailCols[ci++] = 0; this.trailCols[ci++] = 0;
        this.trailAlps[ai++] = 0;
      }
      this.trailGeo.attributes.position.needsUpdate = true;
      this.trailGeo.attributes.color.needsUpdate = true;
      this.trailGeo.attributes.alpha.needsUpdate = true;
      this.trailGeo.setDrawRange(0, this.points.length);
  
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
    }
  }



class ShootingStarManager {
    constructor(scene, globe) {
        this.scene = scene;
        this.globe = globe;
        this.stars = [];
        this.interval = 0.5;
        this.elapsed = 0;
        this.countries = Object.keys(countryCoordinates);
    }

    update(dt) {
        for (let i = this.stars.length - 1; i >= 0; i--) {
            const s = this.stars[i];
            s.update(dt);
            if (s.isFinished) this.stars.splice(i, 1);
        }
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

let shootingStarManager;

// --- 8. Interaction Handling ---
function handleInteractions() {
    raycaster.setFromCamera(mouse, camera);

    // Collect all interactive objects for highlighted countries
    const interactiveObjects = [];
    for (const countryName in highlightedCountries) {
        // Add country outline lines
        if (countryLineMeshes[countryName]) {
            interactiveObjects.push(...countryLineMeshes[countryName]);
        }
        // Add pin parts (head and stick)
        if (countryPinMeshes[countryName]) {
            interactiveObjects.push(...countryPinMeshes[countryName].children);
        }
        // Add label sprite
        if (labelSprites[countryName]) {
            interactiveObjects.push(labelSprites[countryName]);
        }
    }

    const intersects = raycaster.intersectObjects(interactiveObjects, true); // Use recursive true

    let hoveredCountry = null;
    if (intersects.length > 0 && lastMouseEvent) {
        // Find the closest intersected object that belongs to a highlighted country
        for (let i = 0; i < intersects.length; i++) {
            const object = intersects[i].object;
            // Check if the object or its parent has a countryName and is in highlightedCountries
            if (object.userData && object.userData.countryName && highlightedCountries.hasOwnProperty(object.userData.countryName)) {
                hoveredCountry = object.userData.countryName;
                break; // Found a highlighted country object, stop searching
            }
            if (object.parent && object.parent.userData && object.parent.userData.countryName && highlightedCountries.hasOwnProperty(object.parent.userData.countryName)) {
                hoveredCountry = object.parent.userData.countryName;
                break; // Found a highlighted country pin group, stop searching
            }
        }
    }

    // --- Highlighting Logic ---
    if (hoveredCountry !== highlightedCountryName) {
        // If there was a previously highlighted country, unhighlight it
        if (highlightedCountryName) {
            unhighlightCountry(highlightedCountryName);
        }

        // If there is a new hovered country, highlight it
        if (hoveredCountry) {
            showTooltip(hoveredCountry, lastMouseEvent);
            highlightCountry(hoveredCountry);
            isHovered = true; // Keep isHovered true while a country is hovered
        } else {
            // No country is hovered
            hideTooltip();
            isHovered = false; // Set isHovered to false when no country is hovered
        }

        // Update the currently highlighted country name
        highlightedCountryName = hoveredCountry;
    } else if (hoveredCountry) {
        // If the same country is still hovered, just update the tooltip position
         showTooltip(hoveredCountry, lastMouseEvent);
    }

     // If not hovered, resume auto-spin
     if (!isHovered && !isDragging && autoSpinSpeed === 0) {
         autoSpinSpeed = 0.0005;
     }
}


// --- 9. Animation Loop ---
function animate() {
    if (globe && !isDragging && !isHovered) {
        globe.rotation.y += autoSpinSpeed;
    }

    controls.update();

    const delta = clock.getDelta();

    // Update uTime uniform in the globe shader
    if (globe && globe.userData.shader) {
        globe.userData.shader.uniforms.uTime.value += delta;
        // You might also want to update uNoiseQuality based on camera distance here
        // const distance = camera.position.distanceTo(globe.position);
        // globe.userData.shader.uniforms.uNoiseQuality.value = someFunctionOfDistance(distance);
    }

    // Ensure shootingStarManager is initialized before updating
    if (shootingStarManager) {
         shootingStarManager.update(delta);
    }

    // Handle mouse interactions and highlighting
    handleInteractions();


    animateCallbacks.forEach(callback => callback());

    composer.render();
    animateId = requestAnimationFrame(animate);
}

// --- 10. Initialization ---
initialize();
