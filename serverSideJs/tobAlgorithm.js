'use strict';

let connectionManager = require('./connectionManager.js');
let PriorityQueue = require('./priorityQueue.js');

module.exports = {
	compareTimeStamps: compareTimeStamps,
	sendUpdate: sendUpdate
}

let Q = new PriorityQueue();

function sendUpdate(u){
	console.log("received this update:");
	console.log(u);
}



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
