'use strict';

let tobAlgorithm = require('./tobAlgorithm.js');
 
module.exports = class PriorityQueue 
{ 
	constructor() 
	{
		this._array = [];
	}

	print(){
		console.log(this._array);
	}

	head()
	{
		if(this._array.length == 0)
			return -1;
		else
			return this._array[0];
	}

	enqueue(update)
	{
		this._array.push(update);
		this._array.sort(tobAlgorithm.compareTimeStamps)
	}

	dequeue()
	{
		let u = this._array[0];
		this._array = this._array.slice(1);
		return u;
	}

}