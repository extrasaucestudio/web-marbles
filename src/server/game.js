const log = require("../log");
const config = require("./config");
const physics = require("./physics/manager");
const maps = require("./maps/manager");
const db = require("./database/manager");

let game = function() {
	let _startDelay = 2825, // length in ms of audio
		_socketManager = null,

		_playersEnteredList = [],
		_marblesFinished = 0,
		_isWaitingForEntry = true,
		_firstMarbleHasFinished = false,
		_checkFinishedInterval = null,

		_gameplayParameters = null,

		_mapName = null,

		_round = null;

	maps.currentMapData.then((map) => {
		_gameplayParameters = map.gameplay;
	});

	maps.currentMapName.then((mapName) => {
		_mapName = mapName;
	});

	let _generateNewRoundData = function() {
		return {
			mapId: _mapName,
			start: null,
			end: null,
			duration: null,
			pointsAwarded: 0,
			playersEntered: 0,
			playersFinished: 0,
			playersNotFinished: 0,
			marblesEntered: 0,
			marblesFinished: 0,
			marblesNotFinished: 0
		};
	};

	let _checkFinished = function() {
		let finishTime = Date.now();

		// Request newly finished marbles since the last check
		let finished = physics.marbles.getFinishedMarbles();

		// For each finished marble, set their rank and final time
		for (let i = 0; i < finished.length; i++) {
			let rank = physics.marbles.list[finished[i]].meta.rank = _marblesFinished++,
				time = physics.marbles.list[finished[i]].meta.time = finishTime - this.startTime;

			// Get playerEntry that belongs to this marble
			let playerEntry = _playersEnteredList.find((playerEntry) => {
				return physics.marbles.list[finished[i]].meta.id === playerEntry.id;
			});

			// Mark them as finished
			playerEntry.finished = true;
			playerEntry.marblesFinished++;

			// Award points based on rank
			let points = _awardPoints(rank);
			playerEntry.pointsEarned += points;

			// Also add them to the round total
			_round.pointsAwarded += points;

			// Increment the amount of marbles that finished this round
			_round.marblesFinished++;

			// Send client info on finished marble
			_socketManager.emit(JSON.stringify({
				id: finished[i],
				rank,
				time
			}), "finished_marble");

			// If this is the first marble that finished, set a timeout to end the game soon
			if (_firstMarbleHasFinished === false) {
				_firstMarbleHasFinished = true;

				// Set round time
				_round.duration = time;

				this.gameplayFinishTimeout = _setTrackableTimeout(
					this.end.bind(this),
					_gameplayParameters.timeUntilDnf * 1000
				);
			}

			// If all marbles have finished, end the game
			if (_marblesFinished === physics.marbles.list.length) {
				setTimeout(this.end.bind(this), 2000);
			}
		}
	};

	let _awardPoints = function(rank) {
		let P = _playersEnteredList.length; // Amount of human marbles
		let G = 1.5; // The first 66% of marbles that finish will receive more than 1 points for finishing

		return Math.max(

			Math.ceil(
				P / ( P ** (G / P) ) ** rank
			),

			// Finishing always gives you at least 1 additional point
			1
		);
	};

	return {
		currentGameState: "started", // "waiting", "enter", "starting", "started"
		startTime: null,
		limitReached: false,
		enterTimeout: null,

		// Sets currentGameState and informs all connected clients about the state change
		setCurrentGameState(newState) {
			_socketManager.emit(newState, "state");
			this.currentGameState = newState;
			log.info("Current state: ".magenta, this.currentGameState);
		},

		// Enters the player into the race if allowed
		addPlayerEntry(id, name, color) {
			if (
				// Only allow marbles during entering phase
				( this.currentGameState === "waiting" || this.currentGameState === "enter" )

				// Make sure this person hasn't entered in this round yet
				&& typeof _playersEnteredList.find((playerEntry) => { return id === playerEntry.id; }) !== "undefined"

				// Check whether we have reached the maximum player limit
				&& _playersEnteredList.length < config.marbles.rules.maxPlayerCount
			) {
				// Add the player to the list of entries and award a single point for entering
				_playersEnteredList.push({
					id,
					pointsEarned: 1,
					finished: false,
					marblesEntered: 1,
					marblesFinished: 0
				});

				// Spawn a single marble using the player's data
				this.spawnMarble(id, name, color);

				// Wait for a human entering the round before starting it
				if (_isWaitingForEntry) {
					_isWaitingForEntry = false;
					this.setCurrentGameState("enter");

					// Start the game after the entering period is over
					clearTimeout(this.enterTimeout);
					this.enterTimeout = _setTrackableTimeout(
						this.start.bind(this),
						_gameplayParameters.defaultEnterPeriod * 1000
					);
				}
			}
		},

		// Spawns marble unless the maximum amount of marbles has been hit
		spawnMarble(id, name, color) {
			// Check whether we have reached the maximum marble limit
			if (physics.marbles.list.length < config.marbles.rules.maxMarbleCount) {
				let meta = {
					id,
					useFancy: (Math.random() > .99),
					color: color || _randomHexColor(),
					name: name || "Nightbot"
				};

				let body = physics.marbles.createMarble(meta);

				// Send client info on new marble
				_socketManager.emit(JSON.stringify(body.meta), "new_marble");

				// Check for player / marble limits
				if (
					(
						physics.marbles.list.length >= config.marbles.rules.maxMarbleCount
						|| _playersEnteredList.length >= config.marbles.rules.maxPlayerCount
					)
					&& !this.limitReached
				) {
					this.limitReached = true;
					_socketManager.emit(JSON.stringify({
						content: "The maximum amount of marbles has been hit! No more marbles can be entered for this round."
					}), "notification");
					this.start();
					log.info(`We reached the marble limit! (${config.marbles.rules.maxMarbleCount})`);
				}
			}
		},

		end() {
			if (this.currentGameState === "started") {
				// Set the last few round parameters and store it in the database
				_round.end = Date.now();
				_round.playersEntered = _playersEnteredList.length;
				_round.playersFinished = _playersEnteredList.filter((playerEntry) => { return playerEntry.finished; }).length;
				_round.playersNotFinished = _round.playersEntered - _round.playersFinished;
				_round.marblesEntered = physics.marbles.list.length;
				_round.marblesNotFinished = _round.marblesEntered - _round.marblesFinished;

				db.rounds.insertNewRound(_round);

				db.users.batchUpdateStatistics(_playersEnteredList);

				// Stop checking for finished marbles
				clearInterval(_checkFinishedInterval);

				// Clear any remaining timeouts
				clearTimeout(this.gameplayMaxTimeout);
				clearTimeout(this.gameplayFinishTimeout);

				// Finishing variables back to default
				_marblesFinished = 0;
				_firstMarbleHasFinished = false;
				this.startTime = undefined;

				// Close the gate
				physics.world.setAllGatesState("close");

				// Remove all marbles
				physics.marbles.destroyAllMarbles();

				// Clear the array of people that entered
				_playersEnteredList = [];

				// If we had hit the marble limit on the previous round, that's no longer true
				this.limitReached = false;

				// Create new round data
				_round = _generateNewRoundData();

				// Wait for a human to start the next round
				_isWaitingForEntry = true;

				// Set state and inform the client
				this.setCurrentGameState("waiting");

				return true;
			} else {
				return false;
			}
		},

		start() {
			if (this.currentGameState === "enter" || this.currentGameState === "waiting") {
				this.setCurrentGameState("starting");

				setTimeout(() => {
					this.setCurrentGameState("started");

					_round.start = this.startTime = Date.now();

					physics.world.setAllGatesState("open");
					for(let i = 0; i < physics.marbles.list.length; i++) {
						physics.marbles.list[i].ammoBody.activate();
					}
				}, _startDelay);

				_checkFinishedInterval = setInterval(_checkFinished.bind(this), 50);

				// Set timeout that ends the game if the round takes too long to end (e.g. all marbles getting stuck)
				this.gameplayMaxTimeout = _setTrackableTimeout(
					this.end.bind(this),
					_gameplayParameters.roundLength * 1000
				);

				return true;
			} else {
				return false;
			}
		},

		getEnterPeriodTimeRemaining() {
			return _getTimeout(this.enterTimeout) || _gameplayParameters.defaultEnterPeriod;
		},

		setSocketManager(socketManager) {
			_socketManager = socketManager;
		}
	};
}();

// Based on https://stackoverflow.com/questions/3144711/find-the-time-left-in-a-settimeout/36389263#36389263
let _timeoutMap = {};
function _setTrackableTimeout(callback, delay) {
	// Run the original, and store the id
	let id = setTimeout(callback, delay);

	// Store the start date and delay
	_timeoutMap[id] = [Date.now(), delay];

	// Return the id
	return id;
}

// The actual getTimeLeft function
function _getTimeout(id) {
	let m = _timeoutMap[id]; // Find the timeout in map

	// If there was no timeout with that id, return NaN, otherwise, return the time left clamped to 0
	return m ? Math.max(m[1] + m[0] - Date.now(), 0) : NaN;
}

// Generates a random color in the HEX format
function _randomHexColor() {
	let color = (Math.random() * 0xffffff | 0).toString(16);
	if (color.length !== 6) {
		color = (`00000${color}`).slice(-6);
	}
	return `#${color}`;
}

module.exports = game;
