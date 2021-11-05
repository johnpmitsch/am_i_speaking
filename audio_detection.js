 // Volume has to be above this level to trigger the indicator
const THRESHOLD = 1;
 // Queue size * Update interval of the audio worker is how long in ms the queue update will stay around for
 // This will determine how responsive the speaking indicator is to turn off. Larger queue means the indicator
 // will turn off quicker. Lower queue means more "choppy" indicator and larger queue means more "laggy"
 // indicator
const QUEUE_SIZE = 8;

// Create a fixed size queue that can be will be used to append booleans onto and then evaluate if the
// queue has any truthy elements in this. In practice, this is useful for speaking since we can quickly react
// to speaking and turn on the indicator, but also not turn off the indicator as frequently, for instance when
// the user pauses or the natural gaps of volume in natural speech. By seeing of the queue is truthy in total,
// we can evaluate the last N ms of speech only turn the indicator off if there has been no speech at all
// during that time.
class Queue {
  constructor(size) {
    this.queue = new Array(size); // Initialize new array, defaults to empty/falsey values
  }

  push(element) {
    this.queue.push(element); // Push element on to end of array
    this.queue.shift(); // Shift to remove the first "stale" element of Array in the first index
  }

  isTruthy() {
    return this.queue.some(element => element); // Is anything in the queue truthy?
  }
}

speakingQueue = new Queue(QUEUE_SIZE); // initialize queue

let runningAverage = 0;

const detectSpeaking = (event) => {
  // Grab the volume level from our message sent from the audio worker 
  const { data: { volume=0 } } = event
  if (volume) {
    console.log(volume)
    speakingQueue.push(volume > THRESHOLD); // push speaking boolean on to the queue
    // Update the DOM based on any presence of speaking in the queue
    document.querySelector("#speaking-indicator").innerHTML = speakingQueue.isTruthy() ? "yes" : "no";
  }
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
    // message. This will be sent back at a certain interval for the main thread to process
    worklet.port.onmessage = detectSpeaking
  });
});