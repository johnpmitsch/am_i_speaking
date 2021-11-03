const SMOOTHING_FACTOR = 0.9;

// Build an AudioWorkletProcessor that will be used by the worklet processing the stream
class AudioWorker extends AudioWorkletProcessor {
  constructor () {
    super();
    this.volume = 0;
    this.updateIntervalInMS = 25;
    this.nextUpdateFrame = this.updateIntervalInMS;
  }

  get intervalInFrames() {
    return this.updateIntervalInMS / 1000 * sampleRate;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // Note that the input will be down-mixed to mono; however, if no inputs are
    // connected then zero channels will be passed in.
    if (input.length > 0) {
      const samples = input[0];
      let sum = 0;
      let rms = 0;

      // Calculated the squared-sum.
      for (let i = 0; i < samples.length; ++i)
        sum += samples[i] * samples[i];

      // Calculate the RMS level and update the volume.
      rms = Math.sqrt(sum / samples.length);
      this.volume = Math.max(rms, this.volume * SMOOTHING_FACTOR);

      // Update and sync the volume property with the main thread.
      this.nextUpdateFrame -= samples.length;
      if (this.nextUpdateFrame < 0) {
        this.nextUpdateFrame += this.intervalInFrames;
        this.port.postMessage({volume: this.volume});
      }
    }
		// True to keep running
		return true;
	}
}

registerProcessor('audio-meter', AudioWorker)

export default AudioWorker;