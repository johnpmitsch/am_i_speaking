class AudioWorker extends window.AudioWorkletProcessor {
	constructor() {
			console.log('Constructing myworkletprocessor');
			super();
	}

	process(inputs, outputs, parameters) {
			console.log(`current time: ${currentTime}`);
			// True to keep running
			return true;
	}
}

AudioWorkletGlobalScope.registerProcessor('audio-meter', AudioWorker)

export default AudioWorker;