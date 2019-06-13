import { network as config } from "../config";
import ReconnectingWebSocket from "reconnecting-websocket";
import { TypedSocketHelper } from "./typed-socket-helper";
import { HUDNotification } from "./hud-notification";
import { game } from "./game";
import { marbleManager } from "../marble-manager";
import * as msgPack from "msgpack-lite";

let networking = function() {
	let _wsUri = `ws${config.ssl ? "s" : ""}://${window.location.hostname}${config.websockets.localReroute ? "" : `:${config.websockets.port}`}/ws/gameplay`;
	let _ws = null;
	let _helper = null;
	let _marblePositions = new Float32Array(0);
	let _marbleRotations = new Float32Array(0);
	let _lastUpdate = 0;
	let _ready = 0;
	//let _requestsSkipped = 0; // Helps detect network issues
	let _updateBuffer = [];

	let _processMessageEvent = function(event) {
		if(typeof event.data !== "string") {
			//console.log(event.data);
			let contents = msgPack.decode(new Uint8Array(event.data));
			//console.log(contents);
			_updateBuffer.push(contents);
			//console.log(`Timestamp: ${contents.t}`);
			//console.log(`CurrentGameTime: ${contents.c}`);
			return;
		}
		function byteLength(str) {
			// returns the byte length of an utf8 string
			let s = str.length;
			for (let i = str.length - 1; i >= 0; i--) {
				let code = str.charCodeAt(i);
				if (code > 0x7f && code <= 0x7ff) s++;
				else if (code > 0x7ff && code <= 0xffff) s += 2;
				if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
			}
			return s;
		}
		//console.log(`request_physics byteLength: ${byteLength(event.data)}`);
		//console.log(event.data);

		return;

		game.initialize().then( () => { // Wait for game to be ready before processing events
			let { type, message } = _helper.extractSocketMessageType(event.data);
			message = JSON.parse(message);

			switch(type) {
			case "initial_data":
				game.initializeGameState(message);
				_requestPhysics(); // Start the request physics loop
				break;
			case "request_physics":
				if (message) { // False if there is no data to process
					_marblePositions = new Float32Array(Object.values(message.pos));
					_marbleRotations = new Float32Array(Object.values(message.rot));
				}
				_lastUpdate = 0;
				_ready--;
				break;
			case "new_marble":
				game.spawnMarble(message);
				break;
			case "finished_marble":
				game.finishMarble(message);
				break;
			case "state":
				game.setCurrentGameState(message);
				break;
			case "notification":
				new HUDNotification(message.content, message.duration, message.style);
				break;
			default:
				console.warn(`Received unknown network message of type "${type}".`, message);
				break;
			}
		});
	};

	let _requestPhysics = function() {
		if (_ready < config.tickrate && networking.websocketOpen) {
			_ready++;
			_ws.send(
				_helper.addMessageType(Date.now().toString(), "request_physics")
			);
		} else if (networking.websocketOpen) {
			//_requestsSkipped++;
		}
		setTimeout(_requestPhysics, 1000 / config.tickrate);
	};

	return {
		websocketOpen: false,

		initialize: function() {
			_ws = new ReconnectingWebSocket(_wsUri, [], {
				minReconnectionDelay: 1000,
				maxReconnectionDelay: 30000,
				reconnectionDelayGrowFactor: 2
			});
			_ws.binaryType = "arraybuffer";

			_ws.addEventListener("open", () => {
				this.websocketOpen = true;
				_ready = 0;
			});

			_ws.addEventListener("close", () => {
				this.websocketOpen = false;
			});

			_ws.addEventListener("message", (event) => {
				_processMessageEvent(event);
			});

			_helper = new TypedSocketHelper("/gameplay");
		},

		update: function(deltaTime) {
			// Currently a non-buffer implementation for testing purposes!
			while(_updateBuffer.length > 0) {
				let thisUpdate = _updateBuffer[0];

				// Update server constants
				if(thisUpdate.s !== undefined) {
					game.setServerConstants(thisUpdate.s[0], thisUpdate.s[1]);
				}

				// Update level ID
				if(thisUpdate.l !== undefined) {
					game.setLevel(thisUpdate.l);
				}

				// Update game state
				if(thisUpdate.g !== undefined) {
					console.log(thisUpdate);
					game.setGameState(thisUpdate.g, thisUpdate.c);
				}

				// Add new marbles
				if(thisUpdate.n !== undefined) {
					for(let i = 0; i < thisUpdate.n.length; i += 5) {
						let marble = {
							entryId: thisUpdate.n[i],
							userId: thisUpdate.n[i + 1],
							name: thisUpdate.n[i + 2],
							size: thisUpdate.n[i + 3],
							color: thisUpdate.n[i + 4]
						};
						game.spawnMarble(marble);
					}
				}

				// Update finished marbles
				if(thisUpdate.f !== undefined) {
					for(let i = 0; i < thisUpdate.f.length; i += 2) {
						let marble = {
							entryId: thisUpdate.f[i],
							time: thisUpdate.f[i + 1]
						};
						game.finishMarble(marble);
					}
				}

				//Just get marble transforms directly for now
				if(thisUpdate.p !== undefined) {
					marbleManager.interpolateMarbles(
						thisUpdate.p,
						thisUpdate.r,
						1
					);
				}

				_updateBuffer.splice(0, 1);
			}

			// // Placeholder update code until network buffer is implemented
			// marbleManager.interpolateMarbles(
			// 	_marblePositions,
			// 	_marbleRotations,
			// 	_lastUpdate
			// );

			// if (_lastUpdate < 1.5) {
			// 	// FPS assumed to be 60, replace with fps when possible, or better: base it on real time.
			// 	_lastUpdate += (config.tickrate / 60 / config.ticksToLerp);
			// }
		}
	};
}();

export { networking };
