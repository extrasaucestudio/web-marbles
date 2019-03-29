const Ammo = require("ammo")();
const config = require("../config");

const world = require("./world")(Ammo, config);
const marbles = require("./marbles")(Ammo, world, config);

module.exports = {
	world: world.physics,
	map: world.map,
	gateBody: world.gateBody,
	openGate: world.openGate,
	closeGate: world.closeGate,
	stopUpdateInterval: world.stopUpdateInterval,
	marbles
};