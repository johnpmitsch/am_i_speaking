const UPDATE_INTERVAL = 250 // How often (in ms) do we send this back to the main thread?
const VOLUME_MULTIPLIER = 100; // Multiply the volume so we can work with whole numbers
// UPDATE_INTERVAL * INDICATOR_BUFFER_SIZE of the audio worker is how long in ms the buffer update will stay around for
// This will determine how responsive the speaking indicator is to turn off. 
// Lower buffer means more "choppy" indicator and larger buffer means more "laggy" indicator
const INDICATOR_BUFFER_SIZE = 8;
// SPEAKING_BUFFER_SIZE is how many speaking volume records to keep to determine a running average.
// UPDATE_INTERVAL * SPEAKING_BUFFER_SIZE is how long in ms the buffer keeps volume values for.
const SPEAKING_BUFFER_SIZE = 1000;
// Volume has to be above this level to trigger the indicator. This will be recalculated with a running average to deal with
// microphones that are "noiser" by default, but won't drop below this value.
const STARTING_THRESHOLD = 1;
// Smooth out the running average, this can be helpful when someone is speaking for a long period of time.
const SMOOTHING_FACTOR = 0.8;

const average = list => list.reduce((prev, curr) => prev + curr) / list.length;

// Create a fixed size buffer that can be will be used to append volume levels and then evaluate if the
// buffer has any elements in this over the speaking threshold. In practice, this is useful for speaking since we can quickly react
// to speaking and turn on the indicator, but also not turn off the indicator as frequently, for instance when
// the user pauses or the natural gaps of volume in natural speech. By seeing of the buffer is truthy in total,
// we can evaluate the last N ms of speech only turn the indicator off if there has been no speech at all
// during that time.
class SpeakingBuffer {
  constructor() {
    this.buffer = [];
    this.threshold = STARTING_THRESHOLD;
  }

  push(volume) {
    this.calculateThreshold(volume)
    this.buffer.push(volume);
    if (this.buffer.length > SPEAKING_BUFFER_SIZE) {
      this.buffer.shift(); // Shift to remove the first "stale" volume of Array in the first index
    }
  }

  calculateThreshold(volume) {
    //console.log({ volume, threshold: this.threshold, bufferLength: this.buffer.length, first: this.threshold * this.buffer.length + volume })
    // let a handful of data points gather before calculating average, until then use starting threshold
    const currentAverage = this.buffer.length > 4 ? average(this.buffer) : STARTING_THRESHOLD;
    // calcuate the running average
    const runningAverage = (currentAverage * this.buffer.length + volume) / (this.buffer.length + 1)
    // Smooth out the running average to account for when someone starts speaking right away or for long periods of time
    const smoothedRunningAverage = runningAverage * SMOOTHING_FACTOR
    // We generally want to account for "noisier" microphones, so keep the threshold from dropping to too low of a level

    this.threshold = Math.max(STARTING_THRESHOLD, smoothedRunningAverage)
  }

  isSpeaking() {
    // Get the last INDICATOR_BUFFER_SIZE elements of array and detect if any are indicating speech based on threshold
    const indicatorBuffer = this.buffer.slice(-Math.abs(INDICATOR_BUFFER_SIZE))
    return indicatorBuffer.some(volume => volume > this.threshold);
  }
}


// Build an AudioWorkletProcessor that will be used by the worklet processing the stream
// This runs off the main thread in a separate worklet thread
// Influenced by https://stackoverflow.com/a/62732195
class AudioWorker extends AudioWorkletProcessor {
  constructor () {
    super();
    this.volume = 0;
    this.updateIntervalInMS = UPDATE_INTERVAL;
    this.nextUpdateFrame = this.updateIntervalInMS;
    this.allRmsForInterval = [];
    this.speakingBuffer = new SpeakingBuffer();
  }

  // This is the total interval in frame size, based on the inherited sampleRate (sampleRate samples per second)
  get intervalInFrames() {
    return this.updateIntervalInMS / 1000 * sampleRate;
  }

  process(inputs, outputs, parameters) {
    // inputs is an array of inputs connected to our node (which should just be the microphone in our case), so we
    // can assume the first input is the microphone and grab that
    const input = inputs[0];

    // Each input is an array of channels, if there are no inputs, there is nothing connected
    if (input.length > 0) {
      // The channels are downmixed to mono, so there will be two channels but they are identical. Grab 
      // one channel to evaluate to make it easy.
      const samples = input[0];
      let sum = 0;
      let rms = 0;

      // The channel is an array of samples. Calculated the squared-sum total of these. 
      for (let i = 0; i < samples.length; ++i) {
        sum += samples[i] * samples[i];
      }

      // Calculate the RMS level and update the volume. RMS stands for root mean square, is a metering 
      // tool that measures the average loudness of an audio track within a window
      rms = Math.sqrt(sum / samples.length);
      this.allRmsForInterval.push(rms) // push rms onto array keeping track of the interval's RMS
      this.nextUpdateFrame -= samples.length; // reduce this count by the sample size until it gets below zero

      if (this.nextUpdateFrame < 0) {
        this.nextUpdateFrame += this.intervalInFrames; // add the interval back to the next frame update
        this.volume = average(this.allRmsForInterval) // Get the average RMS for the interval
        this.speakingBuffer.push(this.volume * VOLUME_MULTIPLIER); // Push average speaking volume for interval on to the buffer

        // Send message back to main thread if speaking is detected or not
        this.port.postMessage({isSpeaking: this.speakingBuffer.isSpeaking() });
        this.allRmsForInterval = []; // reset the RMS for the current interval
      }
    }

    // True to keep running
    return true;
  }
}

registerProcessor('audio-meter', AudioWorker)

export default AudioWorker;