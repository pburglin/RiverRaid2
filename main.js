import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10); // Initial camera position
// camera.lookAt is handled dynamically now

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// River Width Management
let currentRiverWidth = 10; // Starting width
const minRiverWidth = 5;
const maxRiverWidth = 15;
const widthChangeFrequency = 0.01; // How quickly the width changes relative to Z distance

// Basic lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Player Aircraft
const jetGeometry = new THREE.ConeGeometry(0.5, 2, 8); // Radius, height, segments
const jetMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red color
const playerJet = new THREE.Mesh(jetGeometry, jetMaterial);
playerJet.rotation.x = Math.PI / 2; // Point the cone forward
playerJet.position.set(0, 0.01, 5); // Position it slightly above the 'ground' and forward
scene.add(playerJet);

// River
const riverGeometry = new THREE.PlaneGeometry(20, 1000); // Width, Length
const riverMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff, side: THREE.DoubleSide }); // Blue color
const riverPlane = new THREE.Mesh(riverGeometry, riverMaterial);
riverPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
riverPlane.position.y = 0; // Position at y=0
scene.add(riverPlane);

// River Bank Management
const banks = [];
const bankWidth = 1;
const bankHeight = 2;
const bankDepth = 5; // Length along the river
const bankSpacing = 10; // Distance between bank segments along the river
let nextBankZ = -20; // Position where the next bank pair should be generated
const bankMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green color

// Fuel Management
let playerFuel = 100;
const fuelConsumptionRate = 2; // Units per second
const fuelReplenishAmount = 25;
const fuelDisplay = document.getElementById('info');
const scoreDisplay = document.getElementById('score');
let score = 0;
const enemyScoreValue = 50; // Points per enemy destroyed
let distanceTraveled = 0;
const scoreMultiplier = 0.1; // Adjust for desired score increase rate

// Projectile Management
const projectiles = [];
const projectileSpeed = 25;
const projectileRadius = 0.1;
const projectileHeight = 0.5;
const projectileMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // Yellow

// Fuel Depot Management
const fuelDepots = [];
const depotRadius = 0.8;
const depotHeight = 0.5;
const depotSpacing = 50; // How often fuel depots appear along the river
let nextDepotZ = -40; // Position for the next fuel depot
const depotMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500 }); // Orange color

// Enemy Management
const enemies = [];
const enemyTurretRadius = 0.4;
const enemyTurretHeight = 0.8;
const enemySpacing = 10; // How often enemies appear
let nextEnemyZ = -30;
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 }); // Grey color

// Helicopter Enemy Specifics
const helicopterSpeed = 10; // Horizontal speed
const helicopterBodySize = { x: 1.5, y: 0.01, z: 0.8 };
const helicopterRotorRadius = 1;
const helicopterMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa }); // Lighter grey
const helicopterScoreValue = 100; // Points for destroying a helicopter

// Bridge Management
const bridges = [];
const bridgeHeight = 1;
const bridgeDepth = 2; // Thickness of the bridge along the river
const bridgeSpacing = 150; // How often bridges appear
let nextBridgeZ = -100;
const bridgeMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // SaddleBrown
const bridgeScoreValue = 50;

// Enemy Projectile Management
const enemyProjectiles = [];
const enemyProjectileSpeed = 15;
const enemyProjectileRadius = 0.15; // Slightly larger than player's
const enemyProjectileHeight = 0.6;
const enemyProjectileMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff }); // Magenta
const enemyFireRate = 1.5; // Seconds between shots per enemy

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// Player Controls
const keyboardState = {};
let playerSpeed = 22; // Units per second
const accelerationSpeed = 2; // Units per second
const decelerationRate = 1; // Units per second
const movementBounds = 4.5; // Initial movement bounds, will be updated dynamically

// Animation loop
let gameOver = false;
const clock = new THREE.Clock(); // Add clock for delta time calculation
let gameTime = 0; // Time elapsed since game start
const scrollSpeed = 5; // Units per second

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta(); // Time since last frame

    // --- Update Distance Traveled ---
    distanceTraveled += scrollSpeed * delta; // Assuming scrollSpeed is the forward speed

    // --- Camera and Player Forward Movement ---
    if (keyboardState['ArrowUp']) {
        camera.position.z -= (scrollSpeed + playerSpeed) * delta;
    } else {
        camera.position.z -= scrollSpeed * delta;
    }
    playerJet.position.z = camera.position.z - 5; // Keep player fixed distance in front of camera
    camera.lookAt(playerJet.position.x, playerJet.position.y, playerJet.position.z - 10); // Look ahead of the player

    // --- River Width Calculation (using sine wave for simplicity) ---
    // Use absolute Z position for consistent width change
    const widthFactor = (Math.sin(camera.position.z * widthChangeFrequency) + 1) / 2; // Normalize sine output to 0-1
    currentRiverWidth = minRiverWidth + widthFactor * (maxRiverWidth - minRiverWidth);

    // Update river plane width (optional, could just use banks to define width visually)
    // riverPlane.scale.x = currentRiverWidth / 10; // Assuming initial geometry width was 10

    // Update player movement bounds based on current width
    const currentMovementBounds = currentRiverWidth / 2 - 0.5; // Half width minus buffer

    // Keep river plane centered under the camera view
    riverPlane.position.z = camera.position.z - 50; // Adjust offset as needed

    // Player Horizontal Movement Logic
    if (keyboardState['ArrowLeft'] || keyboardState['KeyA']) {
        playerJet.position.x -= 5 * delta;
    }
    if (keyboardState['ArrowRight'] || keyboardState['KeyD']) {
        playerJet.position.x += 5 * delta;
    }
    if (keyboardState['ArrowUp']) {
        playerSpeed += accelerationSpeed * delta;
        //playerJet.position.y += 0.2 * delta;
    } else {
        playerSpeed -= decelerationRate * delta;
        playerSpeed = Math.max(20, playerSpeed);
    }

    playerJet.position.z -= playerSpeed * delta;

    // Clamp player position within bounds
    playerJet.position.x = Math.max(-currentMovementBounds, Math.min(currentMovementBounds, playerJet.position.x));

    // Bank Generation and Management
    // Generate new banks if needed (ahead of the camera's Z position)
    if (camera.position.z < nextBankZ + 50) { // Generate banks when camera approaches the next spawn point
        createBankPair(nextBankZ, currentRiverWidth); // Pass current width
        nextBankZ -= bankSpacing; // Set Z for the *next* pair further down the river
    }

    // Remove old banks
    for (let i = banks.length - 1; i >= 0; i--) {
        const bank = banks[i];
        // No need to move banks anymore, camera moves past them

        // Remove banks that are far behind the camera
        if (bank.position.z > camera.position.z + 20) { // If bank Z is greater (behind) camera Z + buffer
            scene.remove(bank);
            bank.geometry.dispose(); // Dispose geometry to free memory
            // bank.material.dispose(); // Dispose material if not shared (we share bankMaterial)
            banks.splice(i, 1);
        }
    }

    // Fuel Depot Generation and Management
    // Generate new depots if needed
    if (camera.position.z < nextDepotZ + 50) { // Generate depots when camera approaches the next spawn point
        createFuelDepot(nextDepotZ);
        nextDepotZ -= depotSpacing; // Set Z for the *next* depot further down the river
    }

    // Remove old depots
    for (let i = fuelDepots.length - 1; i >= 0; i--) {
        const depot = fuelDepots[i];

        // Remove depots that are far behind the camera
        if (depot.position.z > camera.position.z + 20) { // If depot Z is greater (behind) camera Z + buffer
            scene.remove(depot);
            depot.geometry.dispose(); // Dispose geometry
            // depot.material.dispose(); // Dispose material if not shared
            fuelDepots.splice(i, 1);
        }
    }

    // Enemy Generation and Management
    // Generate new enemies if needed
    if (camera.position.z < nextEnemyZ + 50) { // Generate enemies when camera approaches
        // Randomly choose enemy type
        if (Math.random() < 0.7) { // 70% chance for turret
            createEnemyTurret(nextEnemyZ);
        } else { // 30% chance for helicopter
            createHelicopter(nextEnemyZ);
        }
        nextEnemyZ -= enemySpacing;
    }

    // Move and Remove old enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Helicopter specific logic
        if (enemy.userData.type === 'helicopter') {
            // Move horizontally
            enemy.position.x += enemy.userData.direction * helicopterSpeed * delta;

            // Check boundaries and reverse direction
            const helicopterBounds = riverGeometry.parameters.width / 2; // Move within river width
            if (enemy.position.x > helicopterBounds || enemy.position.x < -helicopterBounds) {
                enemy.userData.direction *= -1; // Reverse direction
                enemy.position.x = Math.max(-helicopterBounds, Math.min(helicopterBounds, enemy.position.x)); // Clamp position
            }

            // Simple rotor animation (optional)
            const rotor = enemy.children.find(child => child.geometry.type === 'CylinderGeometry');
            if (rotor) {
                rotor.rotation.y += 15 * delta; // Spin the rotor
            }
        }

        // Remove enemies that are far behind the camera
        if (enemy.position.z > camera.position.z + 20) {
            // If it's a group (helicopter), dispose children geometries too
            if (enemy instanceof THREE.Group) {
                enemy.traverse(child => {
                    if (child.geometry) child.geometry.dispose();
                    // Materials are shared, so don't dispose them here
                });
            } else if (enemy.geometry) { // Turret
                enemy.geometry.dispose();
            }
            scene.remove(enemy);
            enemies.splice(i, 1);
        }
    }

    // Bridge Generation and Management
    if (camera.position.z < nextBridgeZ + 50) {
        createBridge(nextBridgeZ, currentRiverWidth);
        nextBridgeZ -= bridgeSpacing;
    }

    // Remove old bridges
    for (let i = bridges.length - 1; i >= 0; i--) {
        const bridge = bridges[i];
        if (bridge.position.z > camera.position.z + 20) {
            scene.remove(bridge);
            bridge.geometry.dispose();
            bridges.splice(i, 1);
        }
    }

    // --- Collision Detection ---
    const playerBox = new THREE.Box3().setFromObject(playerJet);

    // Check collision with Banks
    for (const bank of banks) {
        const bankBox = new THREE.Box3().setFromObject(bank);
        if (playerBox.intersectsBox(bankBox)) {
            console.log("Game Over - Hit Bank!");
            fuelDisplay.textContent = "Game Over - Hit Bank!";
            clock.stop(); // Stop the game loop
            // TODO: Add a more formal game over screen/state
            return; // Stop further processing in this frame
        }
    }

    // Check collision with Enemies
    for (const enemy of enemies) {
        const enemyBox = new THREE.Box3().setFromObject(enemy);
        if (playerBox.intersectsBox(enemyBox) && scene.children.includes(enemy)) {
            console.log("Game Over - Hit Enemy!");
            fuelDisplay.textContent = "Game Over - Hit Enemy!"; // Use fuel display for game over message
            clock.stop(); // Stop the game loop
            return; // Stop further processing in this frame

        }
    }

    // Check collision with Bridges
    for (const bridge of bridges) {
        const bridgeBox = new THREE.Box3().setFromObject(bridge);
        if (playerBox.intersectsBox(bridgeBox)) {
            console.log("Game Over - Hit Bridge!");
            fuelDisplay.textContent = "Game Over - Hit Bridge!"; // Use fuel display for game over message
            clock.stop(); // Stop the game loop
            return; // Stop further processing in this frame
        }
    }

    // Check collision with Fuel Depots
    for (let i = fuelDepots.length - 1; i >= 0; i--) {
        const depot = fuelDepots[i];
        const depotBox = new THREE.Box3().setFromObject(depot);

        if (playerBox.intersectsBox(depotBox)) {
            console.log("Collected fuel!");
            playerFuel += fuelReplenishAmount;
            playerFuel = Math.min(100, playerFuel); // Cap fuel at 100
            // Fuel display is updated later in the loop
            scene.remove(depot);
            depot.geometry.dispose();
            fuelDepots.splice(i, 1);
            // No need to check further depots if one is hit in a frame
            break;
        }
    }

    // --- Fuel Consumption & Display ---
    playerFuel -= fuelConsumptionRate * delta;
    playerFuel = Math.max(0, playerFuel); // Prevent fuel going below 0
    fuelDisplay.textContent = `Fuel: ${Math.floor(playerFuel)}`;

    // --- Score Calculation & Display ---
    if (!gameOver) {
        gameTime += delta;
        score += Math.floor(gameTime / 100); // Score increases by 10 per second
        scoreDisplay.textContent = `Score: ${score}`;
    }

    // Check for game over (out of fuel)
    if (playerFuel <= 0) {
        console.log("Game Over - Out of Fuel!");
        fuelDisplay.textContent = "Game Over - Out of Fuel!";
        clock.stop(); // Stop the game loop
        gameOver = true;
        // TODO: Add a more formal game over screen/state
        return; // Stop further processing in this frame
    }

    // Other game logic updates will go here

    // --- Projectile Movement, Collision & Removal ---
    projectileLoop: for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.position.z -= projectileSpeed * delta;

        // Check Projectile-Enemy Collision
        const projectileBox = new THREE.Box3().setFromObject(projectile);
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const enemyBox = new THREE.Box3().setFromObject(enemy);

            if (projectileBox.intersectsBox(enemyBox)) {
                console.log("Enemy hit!");
                // Remove projectile
                scene.remove(projectile);
                projectile.geometry.dispose();
                projectiles.splice(i, 1);

                // Remove enemy
                scene.remove(enemy);
                enemy.geometry.dispose();
                // Check if it's a group (helicopter) and dispose children geometries too
                if (enemy instanceof THREE.Group) {
                    enemy.traverse(child => {
                        if (child.geometry) child.geometry.dispose();
                    });
                } else if (enemy.geometry) { // Turret
                    // Geometry disposed above is fine for single mesh
                }
                enemies.splice(j, 1);

                // Add score based on enemy type
                if (enemy.userData.type === 'helicopter') {
                    score += helicopterScoreValue;
                } else { // Assume turret otherwise
                    score += enemyScoreValue;
                }
                scoreDisplay.textContent = `Score: ${score}`;

                // Since projectile is gone, continue to next projectile
                continue projectileLoop;
            }
        }

        // Check Projectile-Bridge Collision
        for (let k = bridges.length - 1; k >= 0; k--) {
            const bridge = bridges[k];
            const bridgeBox = new THREE.Box3().setFromObject(bridge);

            if (projectileBox.intersectsBox(bridgeBox)) {
                console.log("Bridge hit!");
                // Remove projectile
                scene.remove(projectile);
                projectile.geometry.dispose();
                projectiles.splice(i, 1);

                // Remove bridge
                scene.remove(bridge);
                bridge.geometry.dispose();
                bridges.splice(k, 1);

                // Add score
                score += bridgeScoreValue;
                scoreDisplay.textContent = `Score: ${score}`;
                // Since projectile is gone, continue to next projectile
                continue projectileLoop;
            }
        }

        // Remove projectiles that go far off-screen (ahead of the camera)
        if (projectile.position.z < camera.position.z - 100 || gameOver) { // Adjust threshold as needed
            scene.remove(projectile);
            projectile.geometry.dispose();
            projectiles.splice(i, 1);
            continue projectileLoop; // Skip further checks for this projectile
        }
    }


    renderer.render(scene, camera);
}

animate();

console.log("Three.js scene initialized.");

// Function to create a pair of river banks with a specific width
function createBankPair(zPos, currentRiverWidth) {
    const bankGeometry = new THREE.BoxGeometry(bankWidth, bankHeight, bankDepth);

    // Calculate a curve offset using a sine wave
    const curveAmplitude = 2; // Adjust for the intensity of the curve
    const curveFrequency = 0.1; // Adjust for the frequency of the curve
    const xOffset = Math.sin(zPos * curveFrequency) * curveAmplitude;

    // Left bank
    const leftBank = new THREE.Mesh(bankGeometry, bankMaterial);
    leftBank.position.set(-(currentRiverWidth / 2 + bankWidth / 2) + xOffset, bankHeight / 2, zPos); // Corrected bank position
    scene.add(leftBank);
    banks.push(leftBank);

    // Right bank
    const rightBank = new THREE.Mesh(bankGeometry, bankMaterial);
    rightBank.position.set((currentRiverWidth / 2 + bankWidth / 2) - xOffset, bankHeight / 2, zPos); // Corrected bank position
    scene.add(rightBank);
    banks.push(rightBank);
}

// Function to create a fuel depot
function createFuelDepot(zPos) {
    const depotGeometry = new THREE.CylinderGeometry(depotRadius, depotRadius, depotHeight, 16); // TopRadius, bottomRadius, height, radialSegments
    const fuelDepot = new THREE.Mesh(depotGeometry, depotMaterial);

    // Randomly place it left or right within the river bounds (avoiding edges)
    const xPos = (Math.random() * (riverGeometry.parameters.width - 2 * depotRadius)) - (riverGeometry.parameters.width / 2 - depotRadius);
    fuelDepot.position.set(xPos, depotHeight / 2, zPos); // Place on the river surface
    scene.add(fuelDepot);
    fuelDepots.push(fuelDepot);
}

// Function to create an enemy turret
function createEnemyTurret(zPos) {
    const enemyGeometry = new THREE.CylinderGeometry(enemyTurretRadius, enemyTurretRadius, enemyTurretHeight, 12);
    const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);

    // Place on left or right bank
    const side = Math.random() < 0.5 ? -1 : 1;
    const xPos = side * (riverGeometry.parameters.width / 2 + bankWidth / 2); // Position on the bank edge
    enemy.position.set(xPos, bankHeight + enemyTurretHeight / 2, zPos); // Place on top of the bank height
    enemy.userData = { speed: Math.random() * 5 + 2 }; // Random speed between 2 and 7
    scene.add(enemy);
    enemies.push(enemy);
}
// Function to create a helicopter enemy
function createHelicopter(zPos) {
    const helicopterGroup = new THREE.Group(); // Use a group to hold body and rotor

    // Body
    const bodyGeometry = new THREE.BoxGeometry(helicopterBodySize.x, helicopterBodySize.y, helicopterBodySize.z);
    const body = new THREE.Mesh(bodyGeometry, helicopterMaterial);
    body.position.y = 0.25; // Raise body slightly
    helicopterGroup.add(body);

    // Rotor (simple cylinder)
    const rotorGeometry = new THREE.CylinderGeometry(helicopterRotorRadius, helicopterRotorRadius, 0.1, 16);
    const rotor = new THREE.Mesh(rotorGeometry, enemyMaterial); // Use darker material for rotor
    rotor.position.y = helicopterBodySize.y + 0.1; // Position above body
    helicopterGroup.add(rotor);

    // Position the group
    const startX = (Math.random() * (riverGeometry.parameters.width - helicopterBodySize.x)) - (riverGeometry.parameters.width / 2 - helicopterBodySize.x / 2);
    helicopterGroup.position.set(startX, 0.01, zPos); // Start at a certain height above river

    // Add custom data for movement and type
    helicopterGroup.userData = {
        type: 'helicopter',
        direction: Math.random() < 0.5 ? 1 : -1, // Start moving left or right
        speed: Math.random() * 4 + 2 // Random speed between 2 and 6
    };

    scene.add(helicopterGroup);
    enemies.push(helicopterGroup); // Add the group to the enemies array
}

// Function to create a bridge
function createBridge(zPos, currentRiverWidth) {
    const bridgeGeometry = new THREE.BoxGeometry(currentRiverWidth, bridgeHeight, bridgeDepth);
    const bridge = new THREE.Mesh(bridgeGeometry, bridgeMaterial);

    bridge.position.set(0, bridgeHeight / 2, zPos); // Center the bridge over the river
    scene.add(bridge);
    bridges.push(bridge);
}


window.addEventListener('keydown', (event) => {
    keyboardState[event.code] = true;
});

window.addEventListener('keyup', (event) => {
    keyboardState[event.code] = false;
});

// Add listener for firing projectiles
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && clock.running && !gameOver && projectiles.length === 0) { // Only fire if game is running and no projectile exists
        createProjectile();
    }
});

// Function to create a projectile
function createProjectile() {
    const projectileGeometry = new THREE.CylinderGeometry(projectileRadius, projectileRadius, projectileHeight, 8);
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    // Start projectile at the player's jet position
    projectile.position.copy(playerJet.position);
    // Adjust slightly forward if needed
    projectile.position.z -= 1; // Start slightly in front of the jet nose
    scene.add(projectile);
    projectiles.push(projectile);
}