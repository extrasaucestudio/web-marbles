import { network as config } from "../../config";
import ReconnectingWebSocket from "reconnecting-websocket";
import { TypedSocketHelper } from "./typed-socket-helper";
import * as game from "./game";

let ws = new ReconnectingWebSocket("ws://localhost:3014/gameplay", [], {
	minReconnectionDelay: 1000,
	maxReconnectionDelay: 30000,
	reconnectionDelayGrowFactor: 2
});

ws.addEventListener("open", function() {
	net.websocketOpen = true;
	net.ready = 0;
});

ws.addEventListener("close", function() {
	net.websocketOpen = false;
});

let helper = new TypedSocketHelper("/gameplay");

let net = { // Initialize, do not configure these values.
	marbleData: undefined,
	marblePositions: new Float32Array(0),
	marbleRotations: new Float32Array(0),
	lastUpdate: 0,
	ready: 0,
	requestsSkipped: 0, // Helps detect network issues
	websocketOpen: false
};

// Socket data promise
net.socketReady = new Promise((resolve) => {
	// Once connected, client receives initial data
	ws.addEventListener("message", function(event) {
		let { type, message } = helper.extractSocketMessageType(event.data);

		switch(type) {
		case "initial_data":
			net.marbleData = JSON.parse(message);
			resolve(true);
			break;
		case "request_physics":
			message = JSON.parse(message);
			if (message) {
				net.marblePositions = new Float32Array(Object.values(message.pos));
				net.marbleRotations = new Float32Array(Object.values(message.rot));
			}
			net.lastUpdate = 0;
			net.ready--;
			break;
		case "new_marble":
			game.spawnMarble(JSON.parse(message));
			break;
		case "start":
			game.start();
			break;
		case "clear":
			game.end();
			break;
		}
	});
}).then(() => {
	/* Physics syncing */
	// Once connection is acknowledged, start requesting physics updates
	let getServerData = function() {
		if (net.ready < config.tickrate && net.websocketOpen) {
			net.ready++;
			ws.send(
				helper.addMessageType(Date.now().toString(), "request_physics")
			);
		} else if (net.websocketOpen) {
			net.requestsSkipped++;
		}
		setTimeout(getServerData, 1000 / config.tickrate);
	};
	getServerData();

	return true;
});

export { net, ws };