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
let tooltipElement; // Cached tooltip DOM element

// --- 2. Constants and Configuration ---
const RADIUS = 20.0;
const TECH_PALETTE = {
    base: 0x204A8F,
    accent: 0x85E2FB,
    highlight: 0xFFC93C,
    blueHighlight: 0x00FFFF,
    white: 0xFFFFFF,
};

const PIN_HEAD_RADIUS = 0.15;
const PIN_STICK_RADIUS = 0.04;
const PIN_STICK_HEIGHT = 0.4;
const PIN_COLOR = 0x00FFFF;

let globe;
let autoSpinSpeed = 0.0005;
let isDragging = false;
let lastMouseEvent = null;
let highlightedCountryName = null;
let tooltipTimeout;
let animateId;
let isHovered = false;
const targetHoverColor = new THREE.Color(TECH_PALETTE.blueHighlight);

let targetGlobeScale = 1.0;
let currentGlobeScale = 1.0;
const HOVER_SCALE_FACTOR = 1.025;
const SCALE_ANIMATION_SPEED = 0.05;

let countryMeshes = [];
let countryLineMeshes = {};
let pinLabelSprites = [];
let countryPinMeshes = {};
let labelSprites = {};

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

for (const country in highlightedCountries) {
    if (Array.isArray(highlightedCountries[country])) {
        highlightedCountries[country] = {
            coords: highlightedCountries[country],
            color: TECH_PALETTE.accent
        };
    } else if (highlightedCountries[country].color === undefined) {
        highlightedCountries[country].color = TECH_PALETTE.accent;
    }
}

let animateCallbacks = [];

// --- 3. Helper Functions ---
function latLonToVector3(lat, lon, r = RADIUS) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
    );
}

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

function showTooltip(countryName, mouseEvent) {
    if (!tooltipElement) return;
    let tooltipText = ``;

    if (officeInfo[countryName]) {
        tooltipText += `${officeInfo[countryName]}`;
    } else {
        tooltipText += `<span class="office-title">${countryName}</span><br><p class="office-desc">No office information available.</p>`;
    }

    tooltipElement.innerHTML = tooltipText;
    tooltipElement.style.left = `${mouseEvent.clientX + 10}px`;
    tooltipElement.style.top = `${mouseEvent.clientY + 10}px`;
    tooltipElement.classList.add('show');

    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
    }
    tooltipTimeout = setTimeout(() => {
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const isMouseOverTooltip = mouseEvent.clientX >= tooltipRect.left && mouseEvent.clientX <= tooltipRect.right &&
                                   mouseEvent.clientY >= tooltipRect.top && mouseEvent.clientY <= tooltipRect.bottom;

        if (!isMouseOverTooltip && (!isHovered || highlightedCountryName !== countryName)) {
            tooltipElement.classList.remove('show');
            tooltipTimeout = null;
        }
    }, 100);
}

function hideTooltip() {
    if (!tooltipElement) return;
    if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }
    tooltipElement.classList.remove('show');
}

function highlightCountry(countryName) {
    if (!highlightedCountries.hasOwnProperty(countryName)) {
        return;
    }

    if (countryLineMeshes[countryName]) {
        countryLineMeshes[countryName].forEach(line => {
            line.material.color.set(targetHoverColor);
            line.material.needsUpdate = true;
        });
    }
    if (countryPinMeshes[countryName]) {
        countryPinMeshes[countryName].children.forEach(child => {
            if (child.geometry.type === 'SphereGeometry') {
                child.material.emissiveIntensity = 0.7;
                selectiveBloom.selection.add(child);
            }
        });
    }
     if (labelSprites[countryName]) {
         selectiveBloom.selection.add(labelSprites[countryName]);
     }
}

function unhighlightCountry(countryName) {
    if (!highlightedCountries.hasOwnProperty(countryName)) {
        return;
    }

    if (countryLineMeshes[countryName]) {
        countryLineMeshes[countryName].forEach(line => {
            const originalColor = highlightedCountries[countryName].color;
            line.material.color.set(originalColor);
            line.material.needsUpdate = true;
        });
    }

    if (countryPinMeshes[countryName]) {
        countryPinMeshes[countryName].children.forEach(child => {
            if (child.geometry.type === 'SphereGeometry') {
                child.material.emissiveIntensity = 0;
                selectiveBloom.selection.delete(child);
            }
        });
    }
     if (labelSprites[countryName]) {
         selectiveBloom.selection.delete(labelSprites[countryName]);
     }
}

// --- 4. Shaders ---
const GlobeVertexShader = `
    varying vec2 vUv;
    varying vec3 vReflectLand;
    varying vec3 vReflectWater;
    varying vec3 vPosition;
    varying float vNoiseQualityFresnel;
    varying vec2 vNoiseQualityBounds;

    const float uRoughness = 0.8;
    const float uRoughness2 = 0.9;
    uniform float uNoiseQuality;
    uniform mat3 envMapRotation;


    vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
        return normalize((vec4(dir, 0.0) * matrix).xyz);
    }

    vec3 calculateReflection(vec3 viewDir, vec3 n, float rough) {
        vec3 reflectVec = reflect(-viewDir, n);
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


        float lower = mix(0.5, 0.1, uNoiseQuality);
        float higher = mix(0.7, 1.0, uNoiseQuality);
        vNoiseQualityBounds = vec2(lower, higher);

        vNoiseQualityFresnel = 1.0 - dot(viewNormal, viewDir);
        vNoiseQualityFresnel = 1.0 - pow(vNoiseQualityFresnel, mix(0.5, 4.0, uNoiseQuality)) * 1.2;
        vNoiseQualityFresnel = clamp(vNoiseQualityFresnel, 0.0, 1.0);
    }
`;

const GlobeFragmentShader = `
    #include <common>
    #include <cube_uv_reflection_fragment>

    const float uShoreThreshold = 0.9;

    const float uRoughness = 0.55;
    const float uEnvMapIntensity = 0.03;
    const float uNoiseScale = 1200.0;
    const float uNoiseStrength = 0.9;
    const float uBloomIntensity = 3.0;

    const float uRoughness2 = 0.9;
    const float uEnvMapIntensity2 = 0.4;
    const float uNoiseScale2 = 1800.0;
    const float uNoiseStrength2 = 1.2;
    const float uBloomIntensity2 = 1.5;

    const float uNoiseScaleMultiplier = 1.0;
    const float uNoisePower = 1.5;

    varying vec2 vUv;
    varying vec3 vReflectLand;
    varying vec3 vReflectWater;
    varying vec3 vPosition;

    varying vec2 vNoiseQualityBounds;
    varying float vNoiseQualityFresnel;

    uniform sampler2D uEquirectangularMap;
    uniform sampler2D uWaterColors;
    uniform sampler2D uLandColors;

    uniform float uNoiseQuality;
    uniform float uTime;
    uniform sampler2D envMap;
    uniform float uLandEnvMultiplier;


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

    float luma(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
    }

    float mapValue(float value, float minInput, float maxInput) {
        return (value - minInput) / (maxInput - minInput);
    }

    vec2 rotate2d(vec2 v, float a) {
        float s = sin(a);
        float c = cos(a);
        mat2 m = mat2(c, s, -s, c);
        return m * v;
    }

    void main() {
        vec4 equirectangularMapColor = texture(uEquirectangularMap, vUv);
        float mixFactor = step(uShoreThreshold, equirectangularMapColor.r);
        float roughnessFactor = mix(uRoughness2, uRoughness, mixFactor);
        float customEnvMapIntensity = mix(uEnvMapIntensity2 * uLandEnvMultiplier * 1.5, uEnvMapIntensity * 1.5, mixFactor);
        float bloomIntensity = mix(uBloomIntensity2, uBloomIntensity, mixFactor);

        vec4 envMapColor = vec4(customEnvMapIntensity);

        if (equirectangularMapColor.r > uShoreThreshold) {
            envMapColor *= textureCubeUV(envMap, vReflectWater, roughnessFactor);
        } else {
            envMapColor *= textureCubeUV(envMap, vReflectLand, roughnessFactor);
        }

        vec3 outgoingLight = envMapColor.rgb;

        vec2 v1 = vec2(uNoiseScale * uNoiseScaleMultiplier * vUv);
        vec2 g1;
        float noise1 = 0.5 + 0.4 * psrdnoise(v1, 2.0 * uTime, g1);

        vec2 v2 = vec2(uNoiseScale * uNoiseScaleMultiplier * vUv * 2.5);
        vec2 g2;
        float noise2 = 0.5 + 0.3 * psrdnoise(v2 + vec2(uTime * 0.5), g2.y, g2);

        float combinedNoise = mix(noise1, noise2, 0.4);
        combinedNoise *= mix(uNoiseStrength2, uNoiseStrength, mixFactor);
        combinedNoise = mix(vNoiseQualityBounds.x, vNoiseQualityBounds.y, combinedNoise);
        combinedNoise = mix(0.5, combinedNoise, vNoiseQualityFresnel);

        float adjustedBrightness = luma(outgoingLight);
        float lerpFactor = clamp(pow(combinedNoise, uNoisePower) * adjustedBrightness, 0.0, 1.0);

        vec3 finalColor;
        if (equirectangularMapColor.r > uShoreThreshold) {
            finalColor = texture(uWaterColors, vec2(lerpFactor, 0.5)).rgb;
        } else {
            finalColor = texture(uLandColors, vec2(lerpFactor, 0.5)).rgb;
        }

        finalColor *= bloomIntensity;
        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// --- 5. Initial Setup ---
async function initialize() {
    canvas = document.querySelector(".three-globe");
    tooltipElement = document.querySelector(".tooltip"); // Cache tooltip element
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
    controls.enableZoom = false;
    controls.enableRotate = true;
    controls.enablePan = false;

    const canvasElement = renderer.domElement; 
    let isDragging = false;
    
    // --- initialize default ---
    canvasElement.style.cursor = 'default';
    
    // --- hover: show “grab” ---
    canvasElement.addEventListener('mouseover', () => {
      if (!isDragging) {
        canvasElement.style.cursor = 'grab';
      }
    });
    
    // --- leave: back to default ---
    canvasElement.addEventListener('mouseout', () => {
      if (!isDragging) {
        canvasElement.style.cursor = 'default';
      }
    });
    
    // --- hold/drag start: “grabbing” ---
    canvasElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      canvasElement.style.cursor = 'grabbing';
    });
    
    // --- drag end: back to grab (if still over canvas) or default ---
    canvasElement.addEventListener('mouseup', (e) => {
      isDragging = false;
      // if pointer is still inside canvas, go back to grab; otherwise default
      const { left, top, width, height } = canvasElement.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      const inside = x >= left && x <= left + width && y >= top && y <= top + height;
      canvasElement.style.cursor = inside ? 'grab' : 'default';
    });
    

    // ***** END: Cursor Change Integration *****

    window.addEventListener("resize", setRendererSize);
    window.addEventListener("load", async () => {
        setRendererSize();
        await createGlobe();
        addLights(scene, renderer);
        createCountryPins();
        loadCountryOutlines();
        shootingStarManager = new ShootingStarManager(scene, globe);

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
            setTimeout(() => {
                if (!isHovered) {
                    autoSpinSpeed = 0.0005;
                }
            }, 200);
        });

        animate();
    });
}

// --- 6. Globe Creation ---
async function createGlobe() {
    const textureLoader = new THREE.TextureLoader();
    const rgbeLoader = new RGBELoader();

    const [
        equirectangularMap,
        actualWaterRamp,
        actualLandRamp,
        globeEnvMap
    ] = await Promise.all([
        textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/earthmap.png'),
        textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/Rectangle%205702.png'),
        textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/vlduy123/nolanvu@main/Rectangle%205701.png'),
        rgbeLoader.loadAsync('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/potsdamer_platz_1k.hdr')
    ]);

    equirectangularMap.minFilter = THREE.LinearMipmapLinearFilter;
    equirectangularMap.magFilter = THREE.LinearFilter;
    actualWaterRamp.minFilter = THREE.LinearFilter;
    actualWaterRamp.magFilter = THREE.LinearFilter;
    actualLandRamp.minFilter = THREE.LinearFilter;
    actualLandRamp.magFilter = THREE.LinearFilter;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envMap = pmremGenerator.fromEquirectangular(globeEnvMap).texture;
    globeEnvMap.dispose();
    pmremGenerator.dispose();

    scene.environment = envMap;

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

        shader.vertexShader = GlobeVertexShader;
        shader.fragmentShader = GlobeFragmentShader;

        globe.userData.shader = shader;
    };

    globe = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS, 64, 64),
        globeMaterial
    );
    globe.userData = { isGlobe: true };
    scene.add(globe);
}

// --- 7. Lighting ---
function addLights(scene, renderer) {
    scene.traverse(object => {
        if (object.isLight) {
            scene.remove(object);
        }
    });

    const ambientLight = new THREE.AmbientLight(TECH_PALETTE.white, 0.9);
    scene.add(ambientLight);
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
                const lineColor = (isHighlighted && highlightedCountries[name].color !== undefined) ? highlightedCountries[name].color : TECH_PALETTE.accent;
                const opacity = isHighlighted ? 1 : 0.1;

                const addOutline = (polyCoords) => {
                    const outlineOffset = RADIUS + 0.05;
                    const points = polyCoords.map(([lon, lat]) => latLonToVector3(lat, lon, outlineOffset));
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

// --- 9. Country Pins ---
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
        emissiveIntensity: 0.0,
        depthTest: true,
        depthWrite: true,
    });

    for (const [name, [lat, lon]] of Object.entries(countryCoordinates)) {
        const position = latLonToVector3(lat, lon, RADIUS);
        const normal = position.clone().normalize();

        const pinGroup = new THREE.Group();

        const pinHead = new THREE.Mesh(pinHeadGeometry, pinMaterial.clone());
        pinHead.position.copy(position).addScaledVector(normal, PIN_STICK_HEIGHT);
        pinHead.userData = { countryName: name, isPinHead: true };
        pinGroup.add(pinHead);

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
        countryPins[name] = pinGroup;
        countryPinMeshes[name] = pinGroup;
        globe.add(pinGroup);

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

        const east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
        const north = new THREE.Vector3().crossVectors(normal, east).normalize();
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
        labelSprite.userData = { countryName: name, isLabel: true };
        pinLabelSprites.push(labelSprite);
        labelSprites[name] = labelSprite;
        globe.add(labelSprite);
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
        if (!a || !b) { this.isFinished = true; return; }

        this.startPos = latLonToVector3(a[0], a[1], RADIUS + PIN_STICK_HEIGHT);
        this.endPos = latLonToVector3(b[0], b[1], RADIUS + PIN_STICK_HEIGHT);

        const distance = this.startPos.distanceTo(this.endPos);

        const startNormal = this.startPos.clone().normalize();
        const endNormal = this.endPos.clone().normalize();
        const midSphereNormal = startNormal.clone().add(endNormal).normalize();
        const heightOffset = 1.5 + distance * 0.4;
        const controlPoint = midSphereNormal.multiplyScalar(RADIUS + 1 + heightOffset);


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
                        mix(rand(b),      rand(b + d.yx), f.x),
                        mix(rand(b + d.xy), rand(b + d.yy), f.x),
                        f.y
                    );
                }
                void main() {
                    vec2 uv = gl_PointCoord;
                    float n  = noise(uv * noiseScale + vec2(uTime * 0.5));
                    float threshold = mix(0.2, 0.8, vAlpha);
                    if(n > threshold) discard;

                    float bloom = bloomIntensity * pow(vAlpha, bloomFalloff);
                    vec3  col  = vColor + vColor * bloom;

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
        this.hasArrived = false;
        this.isFinished = false;
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
            const oldestPointAge = this.points[0].age;
            if (oldestPointAge > 1.0) {
                 this.points.shift();
                 if (this.points.length === 0) {
                     this.group.remove(this.trailMesh);
                     this.trailGeo.dispose();
                     this.trailMesh.material.dispose();
                     this.isFinished = true;
                 }
            }
        } else if (this.hasArrived && this.points.length === 0) {
             this.group.remove(this.trailMesh);
             this.trailGeo.dispose();
             this.trailMesh.material.dispose();
             this.isFinished = true;
        }
    }

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
            if (s.isFinished) {
                s.dispose();
                this.stars.splice(i, 1);
            }
        }
        this.elapsed += dt;
        if (this.elapsed >= this.interval) {
            this.elapsed = 0;
            const names = this.countries;
            if (names.length < 2) return;

            let a = Math.floor(Math.random() * names.length);
            let b = Math.floor(Math.random() * names.length);
            while (b === a) b = Math.floor(Math.random() * names.length);

            const star = new ShootingStar(names[a], names[b], this.scene, this.globe);
             if (!star.isFinished) {
                 this.stars.push(star);
             }
        }
    }
}

let shootingStarManager;

// --- 11. Interaction Handling ---
function handleInteractions() {
    raycaster.setFromCamera(mouse, camera);

    const interactiveObjects = [];
    for (const countryName in countryCoordinates) {
        if (countryLineMeshes[countryName]) {
            interactiveObjects.push(...countryLineMeshes[countryName]);
        }
        if (countryPinMeshes[countryName]) {
            interactiveObjects.push(...countryPinMeshes[countryName].children);
        }
        if (labelSprites[countryName]) {
            interactiveObjects.push(labelSprites[countryName]);
        }
    }

    if (globe) {
        interactiveObjects.push(globe);
    }

    const intersects = raycaster.intersectObjects(interactiveObjects, true);

    let hoveredCountryElement = null;
    let hoveredGlobeSurface = false;

    if (intersects.length > 0 && lastMouseEvent) {
        for (let i = 0; i < intersects.length; i++) {
            const object = intersects[i].object;
            if ((object.userData && object.userData.countryName && highlightedCountries.hasOwnProperty(object.userData.countryName)) ||
                (object.parent && object.parent.userData && object.parent.userData.countryName && highlightedCountries.hasOwnProperty(object.parent.userData.countryName))) {
                 hoveredCountryElement = object.userData.countryName || object.parent.userData.countryName;
                 break;
            } else if (object === globe) {
                hoveredGlobeSurface = true;
            }
        }
    }

    isHovered = hoveredCountryElement !== null || hoveredGlobeSurface;

    if (hoveredCountryElement !== highlightedCountryName) {
        if (highlightedCountryName) {
            unhighlightCountry(highlightedCountryName);
        }
        if (hoveredCountryElement) {
            showTooltip(hoveredCountryElement, lastMouseEvent);
            highlightCountry(hoveredCountryElement);
        } else {
            hideTooltip();
        }
        highlightedCountryName = hoveredCountryElement;
    } else if (hoveredCountryElement) {
         showTooltip(hoveredCountryElement, lastMouseEvent);
    } else if (!hoveredCountryElement) {
         hideTooltip();
    }

    if (isHovered) {
        targetGlobeScale = HOVER_SCALE_FACTOR;
    } else {
        targetGlobeScale = 1.0;
    }

     if (!isHovered && !isDragging && autoSpinSpeed === 0) {
         autoSpinSpeed = 0.0005;
     }
}

// --- 12. Animation Loop ---
function animate() {
    animateId = requestAnimationFrame(animate);

    if (globe && !isDragging && !isHovered) {
        globe.rotation.y += autoSpinSpeed;
    }

    controls.update();

    const delta = clock.getDelta();

    if (globe && globe.userData.shader) {
        globe.userData.shader.uniforms.uTime.value += delta;
    }

    if (globe) {
        currentGlobeScale = THREE.MathUtils.lerp(currentGlobeScale, targetGlobeScale, SCALE_ANIMATION_SPEED);
        globe.scale.set(currentGlobeScale, currentGlobeScale, currentGlobeScale);
    }

    if (shootingStarManager) {
        shootingStarManager.update(delta);
    }

    handleInteractions();

    animateCallbacks.forEach(callback => callback());

    if (composer) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// --- 13. Initialization Call ---
initialize();
