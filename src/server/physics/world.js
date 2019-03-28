module.exports = function(Ammo, config) {
	let _collisionConfiguration,
		_dispatcher,
		_broadphase,
		_solver,
		physicsWorld;

	// Physics configuration
	_collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
	_dispatcher = new Ammo.btCollisionDispatcher(_collisionConfiguration );
	_broadphase = new Ammo.btDbvtBroadphase();
	_solver = new Ammo.btSequentialImpulseConstraintSolver();
	physicsWorld = new Ammo.btDiscreteDynamicsWorld(_dispatcher, _broadphase, _solver, _collisionConfiguration );
	physicsWorld.setGravity( new Ammo.btVector3( 0, config.physics.gravity, 0 ) );

	let _lastPhysicsUpdate = Date.now();

	function _updatePhysics( deltaTime ) {
		physicsWorld.stepSimulation( deltaTime, 10 );
	}

	let _updateInterval;
	let _startUpdateInterval = function() {
		_updateInterval = setInterval(function() {
			let now = Date.now();
			let deltaTime = (now - _lastPhysicsUpdate) / 1000;
			_lastPhysicsUpdate = now;
			_updatePhysics(deltaTime);
		}, 1000 / config.physics.steps);
	};

	_startUpdateInterval();

	return {
		map: undefined,
		physicsWorld,
		updateInterval: undefined,
		gates: [],

		toggleGates(override) {
			for (let gate of this.gates) {
				let offset;
				if (override === "close" || gate.state === "opened") {
					gate.state = "closed";
					offset = 0;
				} else {
					gate.state = "opened";
					offset = (gate.collider.colliderData.height + 2);
				}

				let origin = gate.rigidBody.getWorldTransform().getOrigin();

				origin.setY(
					gate.collider.position.y - offset
				);
				gate.rigidBody.activate();
			}
		},

		addStartGate(collider, transform) {
			let gate = this.addPrimitiveCollider(collider, transform);

			// Gates are closed by default
			gate.state = "closed";
			this.gates.push(gate);

			return gate;
		},

		addPrimitiveCollider(collider, transform) {
			let shape;

			switch (collider.colliderData.shape) {
			case "box":
			default:
				shape = new Ammo.btBoxShape(
					new Ammo.btVector3(
						collider.colliderData.width * .5,
						collider.colliderData.height * .5,
						collider.colliderData.depth * .5
					)
				);
				break;
			case "sphere":
				shape = new Ammo.btSphereShape( new Ammo.btScalar(collider.colliderData.radius) );
				break;
			}

			if (!transform) {
				transform = new Ammo.btTransform();
				transform.setIdentity();
				transform.setOrigin(
					new Ammo.btVector3(
						collider.position.x,
						collider.position.y,
						collider.position.z
					)
				);
				transform.setRotation(
					new Ammo.btQuaternion(
						collider.rotation.x,
						collider.rotation.y,
						collider.rotation.z,
						collider.rotation.w
					)
				);
			}

			let mass = 0;
			let localInertia = new Ammo.btVector3(0, 0, 0);

			shape.calculateLocalInertia(mass, localInertia);

			let motionState = new Ammo.btDefaultMotionState(transform);
			let rigidBodyInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
			let rigidBody = new Ammo.btRigidBody(rigidBodyInfo);

			switch (collider.functionality) {
			case "startGate":
			case "dynamic":
				rigidBody.setCollisionFlags(2);
				break;
			case "static":
			default:
				rigidBody.setCollisionFlags(1);
				break;
			}

			physicsWorld.addRigidBody(rigidBody);

			return {
				rigidBody,
				collider
			};
		},

		startUpdateInterval() {
			this.stopUpdateInterval();
			_startUpdateInterval();
		},

		stopUpdateInterval() {
			clearInterval(_updateInterval);
		},

		addTerrainShape() {
			function createTerrainShape() {
				// Up axis = 0 for X, 1 for Y, 2 for Z. Normally 1 = Y is used.
				let upAxis = 1;

				// hdt, height data type. "PHY_FLOAT" is used. Possible values are "PHY_FLOAT", "PHY_UCHAR", "PHY_SHORT"
				let hdt = "PHY_FLOAT";

				// Set this to your needs (inverts the triangles)
				let flipQuadEdges = false;

				// Creates height data buffer in Ammo heap
				let ammoHeightData = null;
				ammoHeightData = Ammo._malloc(4 * mapObj.width * mapObj.depth);

				// Copy the javascript height data array to the Ammo one.
				let p = 0,
					p2 = 0;

				for (let j = 0; j < mapObj.depth; j++) {
					for (let i = 0; i < mapObj.width; i++) {
						// write 32-bit float data to memory
						Ammo.HEAPF32[ammoHeightData + p2 >> 2] = mapObj.zArray[p];
						p++;

						// 4 bytes/float
						p2 += 4;
					}
				}

				// Creates the heightfield physics shape
				let heightFieldShape = new Ammo.btHeightfieldTerrainShape(
					mapObj.width,
					mapObj.depth,
					ammoHeightData,
					1,
					mapObj.minZ,
					mapObj.maxZ,
					upAxis,
					hdt,
					flipQuadEdges
				);

				// Set horizontal scale
				let scaleX = mapObj.gridDistance;
				let scaleZ = mapObj.gridDistance;
				heightFieldShape.setLocalScaling(new Ammo.btVector3(scaleX, 1, scaleZ));

				heightFieldShape.setMargin(0.05);

				return heightFieldShape;
			}

			// Load obj as heightfield
			let OBJHeightfield = require("../model-import/obj-heightfield");
			let fs = require("fs");
			let file = fs.readFileSync(config.marbles.resources + config.marbles.mapRotation[0].name, "utf-8");
			let mapObj = new OBJHeightfield(file); // X forward, Z up. Write normals & Objects as OBJ Objects.
			mapObj.centerOrigin("xyz");

			// Collision flags
			// BODYFLAG_STATIC_OBJECT: 1,
			// BODYFLAG_KINEMATIC_OBJECT: 2,
			// BODYFLAG_NORESPONSE_OBJECT: 4,

			/* Create the terrain body */
			let groundShape = createTerrainShape(mapObj);
			let groundTransform = new Ammo.btTransform();
			groundTransform.setIdentity();
			// Shifts the terrain, since bullet re-centers it on its bounding box.
			//groundTransform.setOrigin( new Ammo.btVector3( 0, ( mapObj.maxHeight + mapObj.minHeight ) / 2, 0 ) );
			let groundMass = 0;
			let groundLocalInertia = new Ammo.btVector3(0, 0, 0);
			let groundMotionState = new Ammo.btDefaultMotionState(groundTransform);
			let groundBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(groundMass, groundMotionState, groundShape, groundLocalInertia));
			groundBody.setCollisionFlags(1); // Set static

			physicsWorld.addRigidBody(groundBody);

			this.map = mapObj;
		}
	};
};
