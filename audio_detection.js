console.log("init")

navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
	console.log(stream)
	var audioCtx = new AudioContext();
	var source = audioCtx.createMediaStreamSource(stream);
	audioCtx.audioWorklet.addModule('./audio.worker.js').then(() => {
		console.log("Added module")
	})

	console.log(source);
});