// ==========================================
// Player
//
// This class contains the code that manages the local player.
// ==========================================

// Mouse event enumeration
MOUSE = {};
MOUSE.DOWN = 1;
MOUSE.UP = 2;
MOUSE.MOVE = 3;

// Game modes enumeration
const GAME_MODE = {
    BUILD: "build",
    PLAY: "play",
    TOURNEY: "tourney"
};

// Constructor()
//
// Creates a new local player manager.

function Player() {
    this.gamepadIndex = null; // Initialize gamepad index
    this.rightStickInUse = false; // Track if the right stick is in use
    this.rightStickInit = false; // Track if the right stick was initialized for camera movement
    this.triggerPressed = false; // Track if the triggers are pressed
    this.bumperPressed = false; // Track if the bumpers are pressed
    this.materials = []; // List of spawnable materials
    this.currentMaterialIndex = 0; // Current selected material index
    this.gravity = true; // Gravity enabled by default
    this.gameMode = GAME_MODE.BUILD; // Default game mode
}

// setWorld(world)
//
// Assign the local player to a world.

Player.prototype.setWorld = function (world) {
    this.world = world;
    this.world.localPlayer = this;
    this.pos = world.spawnPoint;
    this.velocity = new Vector(0, 0, 0);
    this.angles = [0, Math.PI, 0];
    this.falling = false;
    this.keys = {};
    this.buildMaterial = BLOCK.DIRT;
    this.eventHandlers = {};
}

// setClient(client)
//
// Assign the local player to a socket client.

Player.prototype.setClient = function (client) {
    this.client = client;
}

// setInputCanvas(id)
//
// Set the canvas the renderer uses for some input operations.

Player.prototype.setInputCanvas = function (id) {
    var canvas = this.canvas = document.getElementById(id);

    var t = this;
    document.onkeydown = function (e) { if (e.target.tagName != "INPUT") { t.onKeyEvent(e.keyCode, true); return false; } }
    document.onkeyup = function (e) { if (e.target.tagName != "INPUT") { t.onKeyEvent(e.keyCode, false); return false; } }
    canvas.onmousedown = function (e) { t.onMouseEvent(e.clientX, e.clientY, MOUSE.DOWN, e.which == 3); return false; }
    canvas.onmouseup = function (e) { t.onMouseEvent(e.clientX, e.clientY, MOUSE.UP, e.which == 3); return false; }
    canvas.onmousemove = function (e) { t.onMouseEvent(e.clientX, e.clientY, MOUSE.MOVE, e.which == 3); return false; }

    window.addEventListener("gamepadconnected", function (e) {
        t.gamepadIndex = e.gamepad.index;
        console.log("Gamepad connected at index " + t.gamepadIndex);
    });

    window.addEventListener("gamepaddisconnected", function (e) {
        if (t.gamepadIndex === e.gamepad.index) {
            t.gamepadIndex = null;
            console.log("Gamepad disconnected from index " + e.gamepad.index);
        }
    });
}

// setMaterialSelector(id)
//
// Sets the table with the material selectors.

Player.prototype.setMaterialSelector = function (id) {
    this.materialSelector = document.getElementById(id);
    var tableRow = this.materialSelector.getElementsByTagName("tr")[0];
    var texOffset = 0;

    for (var mat in BLOCK) {
        if (typeof (BLOCK[mat]) == "object" && BLOCK[mat].spawnable == true) {
            var selector = document.createElement("td");
            selector.style.backgroundPosition = texOffset + "px 0px";

            var pl = this;
            selector.material = BLOCK[mat];
            selector.onclick = function () {
                this.style.opacity = "1.0";

                pl.prevSelector.style.opacity = null;
                pl.prevSelector = this;

                pl.buildMaterial = this.material;
            }

            if (mat == "DIRT") {
                this.prevSelector = selector;
                selector.style.opacity = "1.0";
            }

            tableRow.appendChild(selector);
            texOffset -= 70;
            this.materials.push(selector); // Add selector to materials list
        }
    }
}

// on(event, callback)
//
// Hook a player event.

Player.prototype.on = function (event, callback) {
    this.eventHandlers[event] = callback;
}

// onKeyEvent(keyCode, down)
//
// Hook for keyboard input.

Player.prototype.onKeyEvent = function (keyCode, down) {
    var key = String.fromCharCode(keyCode).toLowerCase();
    this.keys[key] = down;
    this.keys[keyCode] = down;

    if (!down && key == "t" && this.eventHandlers["openChat"]) this.eventHandlers.openChat();
}

// onMouseEvent(x, y, type, rmb)
//
// Hook for mouse input.

Player.prototype.onMouseEvent = function (x, y, type, rmb) {
    if (type == MOUSE.DOWN) {
        this.dragStart = { x: x, y: y };
        this.mouseDown = true;
        this.yawStart = this.targetYaw = this.angles[1];
        this.pitchStart = this.targetPitch = this.angles[0];
    } else if (type == MOUSE.UP) {
        if (Math.abs(this.dragStart.x - x) + Math.abs(this.dragStart.y - y) < 4)
            this.doBlockAction(x, y, !rmb);

        this.dragging = false;
        this.mouseDown = false;
        this.canvas.style.cursor = "default";
    } else if (type == MOUSE.MOVE && this.mouseDown) {
        this.dragging = true;
        this.targetPitch = this.pitchStart - (y - this.dragStart.y) / 200;
        this.targetYaw = this.yawStart + (x - this.dragStart.x) / 200;

        this.canvas.style.cursor = "move";
    }
}

// doBlockAction(x, y, destroy)
//
// Called to perform an action based on the player's block selection and input.

Player.prototype.doBlockAction = function (x, y, destroy) {
    if (this.gameMode === GAME_MODE.TOURNEY || (this.gameMode === GAME_MODE.PLAY && !destroy)) {
        return;
    }
    
    var bPos = new Vector(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z));
    var block = this.canvas.renderer.pickAt(new Vector(bPos.x - 4, bPos.y - 4, bPos.z - 4), new Vector(bPos.x + 4, bPos.y + 4, bPos.z + 4), x, y);

    if (block != false) {
        var obj = this.client ? this.client : this.world;

        if (destroy)
            obj.setBlock(block.x, block.y, block.z, BLOCK.AIR);
        else
            obj.setBlock(block.x + block.n.x, block.y + block.n.y, block.z + block.n.z, this.buildMaterial);
    }
}

// getEyePos()
//
// Returns the position of the eyes of the player for rendering.

Player.prototype.getEyePos = function () {
    return this.pos.add(new Vector(0.0, 0.0, 1.7));
}

// update()
//
// Updates this local player (gravity, movement)

Player.prototype.update = function () {
    var world = this.world;
    var velocity = this.velocity;
    var pos = this.pos;
    var bPos = new Vector(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));

    if (this.lastUpdate != null) {
        var delta = (new Date().getTime() - this.lastUpdate) / 1000;

        // Handle gamepad input for camera movement
        if (this.gamepadIndex !== null) {
            var gamepad = navigator.getGamepads()[this.gamepadIndex];
            if (gamepad) {
                var rightStickX = gamepad.axes[2]; // Right stick horizontal
                var rightStickY = gamepad.axes[3]; // Right stick vertical

                // Apply a dead zone to avoid drift
                if (Math.abs(rightStickX) > 0.1 || Math.abs(rightStickY) > 0.1) {
                    if (!this.rightStickInit) {
                        this.yawStart = this.targetYaw = this.angles[1];
                        this.pitchStart = this.targetPitch = this.angles[0];
                        this.rightStickInit = true;
                    }
                    this.targetYaw += rightStickX * delta * 2; // Adjust sensitivity as needed
                    this.targetPitch -= rightStickY * delta * 2; // Adjust sensitivity as needed
                    this.rightStickInUse = true;
                } else {
                    this.rightStickInUse = false;
                }
            }
        }

        // Handle gamepad input for jumping (X button)
        if (this.gamepadIndex !== null) {
            var gamepad = navigator.getGamepads()[this.gamepadIndex];
            if (gamepad) {
                if (gamepad.buttons[2].pressed) {
                    this.keys[" "] = true;
                } else {
                    this.keys[" "] = false;
                }

                // Handle gamepad input for block actions (triggers)
                var canvasCenterX = this.canvas.width / 2;
                var canvasCenterY = this.canvas.height / 2;

                if (gamepad.buttons[7].pressed && !this.triggerPressed) { // Right trigger
                    this.doBlockAction(canvasCenterX, canvasCenterY, false);
                    this.triggerPressed = true;
                } else if (gamepad.buttons[6].pressed && !this.triggerPressed) { // Left trigger
                    this.doBlockAction(canvasCenterX, canvasCenterY, true);
                    this.triggerPressed = true;
                } else if (!gamepad.buttons[6].pressed && !gamepad.buttons[7].pressed) {
                    this.triggerPressed = false;
                }

                // Handle gamepad input for material selection (bumpers)
                if (gamepad.buttons[4].pressed && !this.bumperPressed) { // Left bumper
                    this.cycleMaterial(-1);
                    this.bumperPressed = true;
                } else if (gamepad.buttons[5].pressed && !this.bumperPressed) { // Right bumper
                    this.cycleMaterial(1);
                    this.bumperPressed = true;
                } else if (!gamepad.buttons[4].pressed && !gamepad.buttons[5].pressed) {
                    this.bumperPressed = false;
                }
            }
        }

        // Separate sections for handling movement
        if (!this.gravity) {
            // No gravity movement with pitch control
            this.handleNoGravityMovement(delta);
        } else {
            // Regular movement with gravity
            this.handleGravityMovement(delta);
        }

        // View
        if (this.dragging || (this.gamepadIndex !== null && this.rightStickInUse)) {
            this.angles[0] += (this.targetPitch - this.angles[0]) * 30 * delta;
            this.angles[1] += (this.targetYaw - this.angles[1]) * 30 * delta;
            if (this.angles[0] < -Math.PI / 2) this.angles[0] = -Math.PI / 2;
            if (this.angles[0] > Math.PI / 2) this.angles[0] = Math.PI / 2;
        }

        // Gravity
        if (this.gravity && this.falling) velocity.z += -0.5;

        // Jumping
        if (this.keys[" "] && !this.falling) velocity.z = 8;

        // Resolve collision
        this.pos = this.resolveCollision(pos, bPos, velocity.mul(delta));
    }

    this.lastUpdate = new Date().getTime();
}

Player.prototype.handleNoGravityMovement = function (delta) {
    var velocity = this.velocity;

    // Handle gamepad input for player movement
    if (this.gamepadIndex !== null) {
        var gamepad = navigator.getGamepads()[this.gamepadIndex];
        if (gamepad) {
            var leftStickY = gamepad.axes[1]; // Left stick vertical
            var leftStickX = gamepad.axes[0]; // Left stick horizontal

            if (Math.abs(leftStickY) > 0.1) {
                var forwardDirection = new Vector(
                    Math.cos(this.angles[0]) * Math.cos(Math.PI / 2 - this.angles[1]),
                    Math.cos(this.angles[0]) * Math.sin(Math.PI / 2 - this.angles[1]),
                    Math.sin(this.angles[0])
                );
                velocity.x -= forwardDirection.x * leftStickY * delta * 300;
                velocity.y -= forwardDirection.y * leftStickY * delta * 300;
                velocity.z -= forwardDirection.z * leftStickY * delta * 300;
            }
            if (Math.abs(leftStickX) > 0.1) {
                var rightDirection = new Vector(
                    Math.cos(Math.PI / 2 + Math.PI / 2 - this.angles[1]),
                    Math.sin(Math.PI / 2 + Math.PI / 2 - this.angles[1]),
                    0 // No vertical movement for strafing
                );
                velocity.x -= rightDirection.x * leftStickX * delta * 300;
                velocity.y -= rightDirection.y * leftStickX * delta * 300;
            }
        }
    }

    // Handle keyboard input for player movement
    var walkVelocity = new Vector(0, 0, 0);
    if (this.keys["w"]) {
        walkVelocity.x += Math.cos(Math.PI / 2 - this.angles[1]) * Math.cos(this.angles[0]);
        walkVelocity.y += Math.sin(Math.PI / 2 - this.angles[1]) * Math.cos(this.angles[0]);
        walkVelocity.z += Math.sin(this.angles[0]);
    }
    if (this.keys["s"]) {
        walkVelocity.x += Math.cos(Math.PI + Math.PI / 2 - this.angles[1]) * Math.cos(this.angles[0]);
        walkVelocity.y += Math.sin(Math.PI + Math.PI / 2 - this.angles[1]) * Math.cos(this.angles[0]);
        walkVelocity.z -= Math.sin(this.angles[0]);
    }
    if (this.keys["a"]) {
        walkVelocity.x += Math.cos(Math.PI / 2 + Math.PI / 2 - this.angles[1]);
        walkVelocity.y += Math.sin(Math.PI / 2 + Math.PI / 2 - this.angles[1]);
    }
    if (this.keys["d"]) {
        walkVelocity.x += Math.cos(-Math.PI / 2 + Math.PI / 2 - this.angles[1]);
        walkVelocity.y += Math.sin(-Math.PI / 2 + Math.PI / 2 - this.angles[1]);
    }

    if (walkVelocity.length() > 0) {
        walkVelocity = walkVelocity.normal();
        velocity.x = walkVelocity.x * 4;
        velocity.y = walkVelocity.y * 4;
        velocity.z = walkVelocity.z * 4;
    } else {
        velocity.x /= 2.5; // Increased damping factor
        velocity.y /= 2.5; // Increased damping factor
        velocity.z /= 2.5; // Increased damping factor
    }
};

Player.prototype.handleGravityMovement = function (delta) {
    var velocity = this.velocity;

    // Handle gamepad input for player movement
    if (this.gamepadIndex !== null) {
        var gamepad = navigator.getGamepads()[this.gamepadIndex];
        if (gamepad) {
            var leftStickY = gamepad.axes[1]; // Left stick vertical
            var leftStickX = gamepad.axes[0]; // Left stick horizontal

            if (!this.falling) {
                if (Math.abs(leftStickY) > 0.1) {
                    velocity.x -= Math.cos(Math.PI / 2 - this.angles[1]) * leftStickY * delta * 120;
                    velocity.y -= Math.sin(Math.PI / 2 - this.angles[1]) * leftStickY * delta * 120;
                }
                if (Math.abs(leftStickX) > 0.1) {
                    velocity.x -= Math.cos(Math.PI / 2 + Math.PI / 2 - this.angles[1]) * leftStickX * delta * 120;
                    velocity.y -= Math.sin(Math.PI / 2 + Math.PI / 2 - this.angles[1]) * leftStickX * delta * 120;
                }
            }
        }
    }

    // Handle keyboard input for player movement
    var walkVelocity = new Vector(0, 0, 0);
    if (!this.falling) {
        if (this.keys["w"]) {
            walkVelocity.x += Math.cos(Math.PI / 2 - this.angles[1]);
            walkVelocity.y += Math.sin(Math.PI / 2 - this.angles[1]);
        }
        if (this.keys["s"]) {
            walkVelocity.x += Math.cos(Math.PI + Math.PI / 2 - this.angles[1]);
            walkVelocity.y += Math.sin(Math.PI + Math.PI / 2 - this.angles[1]);
        }
        if (this.keys["a"]) {
            walkVelocity.x += Math.cos(Math.PI / 2 + Math.PI / 2 - this.angles[1]);
            walkVelocity.y += Math.sin(Math.PI / 2 + Math.PI / 2 - this.angles[1]);
        }
        if (this.keys["d"]) {
            walkVelocity.x += Math.cos(-Math.PI / 2 + Math.PI / 2 - this.angles[1]);
            walkVelocity.y += Math.sin(-Math.PI / 2 + Math.PI / 2 - this.angles[1]);
        }
    }

    if (walkVelocity.length() > 0) {
        walkVelocity = walkVelocity.normal();
        velocity.x = walkVelocity.x * 4;
        velocity.y = walkVelocity.y * 4;
    } else {
        velocity.x /= this.falling ? 1.01 : 1.5;
        velocity.y /= this.falling ? 1.01 : 1.5;
    }
};

// cycleMaterial(direction)
//
// Cycles through the materials list based on the direction.

Player.prototype.cycleMaterial = function (direction) {
    this.currentMaterialIndex += direction;
    if (this.currentMaterialIndex < 0) {
        this.currentMaterialIndex = this.materials.length - 1;
    } else if (this.currentMaterialIndex >= this.materials.length) {
        this.currentMaterialIndex = 0;
    }

    // Update material selection visually
    var selectedMaterial = this.materials[this.currentMaterialIndex];
    selectedMaterial.style.opacity = "1.0";
    if (this.prevSelector) {
        this.prevSelector.style.opacity = null;
    }
    this.prevSelector = selectedMaterial;
    this.buildMaterial = selectedMaterial.material;
}

// setGameMode(mode)
//
// Sets the game mode for the player.

Player.prototype.setGameMode = function (mode) {
    this.gameMode = mode;

    // Hide the material selector in play and tourney modes
    if (this.gameMode !== GAME_MODE.BUILD) {
        if (this.materialSelector) {
            this.materialSelector.style.display = "none";
        }
    } else {
        if (this.materialSelector) {
            this.materialSelector.style.display = "block";
        }
    }
}

// Save and Load world functions

Player.prototype.saveWorld = function () {
    var worldData = {
        mode: this.gameMode,
        // Add other world data to save here
    };

    // Save the world data to a file or server
}

Player.prototype.loadWorld = function (worldData) {
    this.setGameMode(worldData.mode);
    // Load other world data from the file or server
}

// resolveCollision(pos, bPos, velocity)
//
// Resolves collisions between the player and blocks on XY level for the next movement step.

Player.prototype.resolveCollision = function (pos, bPos, velocity) {
    var world = this.world;
    var playerRect = { x: pos.x + velocity.x, y: pos.y + velocity.y, size: 0.25 };

    // Collect XY collision sides
    var collisionCandidates = [];

    for (var x = bPos.x - 1; x <= bPos.x + 1; x++) {
        for (var y = bPos.y - 1; y <= bPos.y + 1; y++) {
            for (var z = bPos.z; z <= bPos.z + 1; z++) {
                if (world.getBlock(x, y, z) != BLOCK.AIR) {
                    if (world.getBlock(x - 1, y, z) == BLOCK.AIR) collisionCandidates.push({ x: x, dir: -1, y1: y, y2: y + 1 });
                    if (world.getBlock(x + 1, y, z) == BLOCK.AIR) collisionCandidates.push({ x: x + 1, dir: 1, y1: y, y2: y + 1 });
                    if (world.getBlock(x, y - 1, z) == BLOCK.AIR) collisionCandidates.push({ y: y, dir: -1, x1: x, x2: x + 1 });
                    if (world.getBlock(x, y + 1, z) == BLOCK.AIR) collisionCandidates.push({ y: y + 1, dir: 1, x1: x, x2: x + 1 });
                }
            }
        }
    }

    // Solve XY collisions
    for (var i in collisionCandidates) {
        var side = collisionCandidates[i];

        if (lineRectCollide(side, playerRect)) {
            if (side.x != null && velocity.x * side.dir < 0) {
                pos.x = side.x + playerRect.size / 2 * (velocity.x > 0 ? -1 : 1);
                velocity.x = 0;
            } else if (side.y != null && velocity.y * side.dir < 0) {
                pos.y = side.y + playerRect.size / 2 * (velocity.y > 0 ? -1 : 1);
                velocity.y = 0;
            }
        }
    }

    var playerFace = { x1: pos.x + velocity.x - 0.125, y1: pos.y + velocity.y - 0.125, x2: pos.x + velocity.x + 0.125, y2: pos.y + velocity.y + 0.125 };
    var newBZLower = Math.floor(pos.z + velocity.z);
    var newBZUpper = Math.floor(pos.z + 1.7 + velocity.z * 1.1);

    // Collect Z collision sides
    collisionCandidates = [];

    for (var x = bPos.x - 1; x <= bPos.x + 1; x++) {
        for (var y = bPos.y - 1; y <= bPos.y + 1; y++) {
            if (world.getBlock(x, y, newBZLower) != BLOCK.AIR)
                collisionCandidates.push({ z: newBZLower + 1, dir: 1, x1: x, y1: y, x2: x + 1, y2: y + 1 });
            if (world.getBlock(x, y, newBZUpper) != BLOCK.AIR)
                collisionCandidates.push({ z: newBZUpper, dir: -1, x1: x, y1: y, x2: x + 1, y2: y + 1 });
        }
    }

    // Solve Z collisions
    this.falling = true;
    for (var i in collisionCandidates) {
        var face = collisionCandidates[i];

        if (rectRectCollide(face, playerFace) && velocity.z * face.dir < 0) {
            if (velocity.z < 0) {
                this.falling = false;
                pos.z = face.z;
                velocity.z = 0;
                this.velocity.z = 0;
            } else {
                pos.z = face.z - 1.8;
                velocity.z = 0;
                this.velocity.z = 0;
            }

            break;
        }
    }

    // Return solution
    return pos.add(velocity);
}
