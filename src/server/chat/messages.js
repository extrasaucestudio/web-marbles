const game = require("../game");

const parse = function(messageContent, id, username, member) {
	let isDeveloper = false;

	if (member) {
		isDeveloper = member.roles.some(role => role.name === "Developers");
	} else {
		isDeveloper = id == "112621040487702528" || id == "133988602530103298";
	}

	if (messageContent.startsWith("!marble")) {
		let colorRegEx = /#(?:[0-9a-fA-F]{3}){1,2}$/g;
		let match = messageContent.match(colorRegEx);
		let color = (match === null ? undefined : match[0]);

		game.addPlayerEntry(
			id,
			username,
			color
		);
	}

	else if (messageContent.startsWith("!end") && isDeveloper) {
		game.end();
	}

	else if (messageContent.startsWith("!lotsofbots") && isDeveloper) {
		let amount = Math.min(100, parseInt(messageContent.substr(11)) || 10);
		for (let i = 0; i < amount; i++) {
			game.spawnMarble();
		}
	}
};

module.exports = {
	parse
};