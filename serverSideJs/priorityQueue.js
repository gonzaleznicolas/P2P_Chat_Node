'use strict';
 
module.exports = class PriorityQueue 
{ 
	constructor() 
	{
		this._array = [];
	}

	head()
	{
		if(this._array.length === 0)
			return -1;
		else
			return this._array[0];
	}

	enqueue(update)
	{
		this._array.push(update);
		this._array.sort(compareTimeStamps)
	}

	dequeue()
	{
		let u = this._array[0];
		this._array = this._array.slice(1);
		return u;
	}

};

function compareTimeStamps(a, b){
	if(a.time !== b.time)
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
