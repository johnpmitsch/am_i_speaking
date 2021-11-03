const threshold = 0.5;
navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
	var audioContext = new AudioContext();
	audioContext.audioWorklet.addModule('./audio.worker.js').then(() => {
		let microphone = audioContext.createMediaStreamSource(stream)
		const worklet = new AudioWorkletNode(audioContext, 'audio-meter')
		microphone.connect(worklet).connect(audioContext.destination)

		worklet.port.onmessage  = event => {
			let volume = 0
			let sensibility = 5 // Just to add any sensibility to our ecuation
			if (event.data.volume)
					volume = event.data.volume;
			const total = (volume * 100) / sensibility
			document.querySelector("#speaking-indicator").innerHTML = (total > threshold) ? "yes" : "no"
		}
	});
});