const detectSpeaking = (event) => {
  // Grab the isSpeaking indicator from the worker process message
  const { data: { isSpeaking=false } } = event
  document.querySelector("#speaking-indicator").innerHTML = isSpeaking ? "yes" : "no";
}

// Get user input from microphone
navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
  // Create an AudioContext, which is what creates our audio processing graph. 
  // This is a "framework" of sorts that we are using to manage our audio
  var audioContext = new AudioContext();
  // Within the AudioContext, create an AudioWorklet, which is a focused lightweight web worker that can
  // be used to process audio on a separate thread. Then add a module (basically a script) that will be run on that
  // worklet.
  audioContext.audioWorklet.addModule('./audio.worker.js').then(() => {
    // Create a stream source from the audio input and return as a type of AudioNode "MediaStreamAudioSourceNode"
    // that will represent the user microphone
    let microphone = audioContext.createMediaStreamSource(stream)
    // Create a new AudioNode that runs on a separate thread as a worklet
    // AudioNodes are the building blocks that the AudioContext uses to manage and process audio, and this specific 
    // AudioWorkletNode uses an AudioWorkletProcessor to run on the Web Audio rendering thread separate from 
    // the main thread
    const worklet = new AudioWorkletNode(audioContext, 'audio-meter')
    // Connect the AudioNode that represents our microphone audio stream to the worklet AudioNode that 
    // is doing the stream processing. Then, connect back to the AudioContext object's destination, which is
    // the final destination of all audio in the context
    microphone.connect(worklet).connect(audioContext.destination)
    // Open up a port between the worklet processor and it's associated AudioNode. The worklet consists of both an AudioNode
    // and an AudioWorkletProcessor, this allows communication between them. "onmessage" is called when the port receives a
    // message. This will be sent back at a certain interval for the main thread to handle
    worklet.port.onmessage = detectSpeaking
  });
});