const UPDATE_INTERVAL = 50 // How often (in ms) do we send this back to the main thread?
const VOLUME_MULTIPLIER = 100; // Multiply the volume so we can work with whole numbers

const average = list => list.reduce((prev, curr) => prev + curr) / list.length;

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
  }

  // This is the total interval in frame size, based on the sampleRate (samples per second)
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
      this.allRmsForInterval.push(rms) // push onto array keeping track of the interval's RMS

      this.nextUpdateFrame -= samples.length; // reduce this count by the sample size until it gets below zero
      if (this.nextUpdateFrame < 0) {
        this.nextUpdateFrame += this.intervalInFrames; // add the interval back to the frame update
        this.volume = average(this.allRmsForInterval) // Get the average RMS for the interval
        // Update and sync the volume property with the main thread.
        this.port.postMessage({volume: this.volume * VOLUME_MULTIPLIER});
        this.allRmsForInterval = []; // reset this
      }
    }
    // True to keep running
    return true;
  }
}

registerProcessor('audio-meter', AudioWorker)

export default AudioWorker;