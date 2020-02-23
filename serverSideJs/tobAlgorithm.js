'use strict';

let connectionManager = require('./connectionManager.js');

module.exports = {
	compareTimeStamps: compareTimeStamps
}

let TS = [0, 0, 0, 0];

function compareTimeStamps(a, b){
	if(a.time != b.time)
		return a.time - b.time;
	else{
		if (a.machineIdentifier < b.machineIdentifier)
			return -1;
		else if (a.machineIdentifier > b.machineIdentifier)
			return 1;
		else
			return 0;
	}
}
