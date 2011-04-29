package {
    // Originally from the projects "dynamic audio" and "jasmid" on github.
    // (BSD licensed code)
    // https://github.com/bfirsh/dynamicaudio.js
    // https://github.com/gasman/jasmid
    
    import flash.display.Sprite;
    import flash.events.SampleDataEvent;
    import flash.external.ExternalInterface;
    import flash.media.Sound;
    import flash.media.SoundChannel;
    
    public class dynamicaudio extends Sprite {
        public var bufferSize:Number = 2048; // In samples
        public var sound:Sound;
        public var buffer:Array = [];
        public var channel:SoundChannel;
        public var writtenSampleCount:Number = 0;
        
        public function dynamicaudio() {
            ExternalInterface.addCallback('write', write);
            ExternalInterface.addCallback('stop', stop);
            ExternalInterface.addCallback('bufferedDuration', bufferedDuration);
            this.sound = new Sound(); 
            this.sound.addEventListener(
                SampleDataEvent.SAMPLE_DATA,
                soundGenerator
            );
            this.channel = this.sound.play();
        }
        
        // Called from JavaScript to add samples to the buffer
        // Note we are using a space separated string of samples instead of an 
        // array. Flash's stupid ExternalInterface passes every sample as XML, 
        // which is incredibly expensive to encode/decode
        public function write(s:String):Number {
            var multiplier:Number = 1/32768;
            var alreadyBufferedDuration:Number = (this.writtenSampleCount + this.buffer.length/2) / 44.1;
            for each (var sample:String in s.split(" ")) {
                this.buffer.push(Number(sample)*multiplier);
            }
            return (this.channel ? alreadyBufferedDuration - this.channel.position : 0);
        }
        
        public function bufferedDuration():Number {
            // duration (in ms) of audio written to Flash so far = (writtenSampleCount * 1000 / sampleRate)
            // number of ms in Flash's buffer = (writtenSampleCount * 1000 / sampleRate) - this.channel.position
            // number of ms in our buffer = (this.buffer.length/2 * 1000 / sampleRate)
            // (/2 because buffer stores stereo data => 2 elements per sample)
            // for 44100Hz, x * 1000 / sampleRate => x / 44.1
            return (this.writtenSampleCount + this.buffer.length/2) / 44.1 - this.channel.position;
        }
        
        public function stop():void {
            this.channel.stop();
            this.buffer = [];
            this.writtenSampleCount = 0;
            this.channel = this.sound.play();
        }

        public function soundGenerator(event:SampleDataEvent):void {
            var i:int;
            
            // If we haven't got enough data, write 2048 samples of silence to 
            // both channels, the minimum Flash allows
            if (this.buffer.length < this.bufferSize*2) {
                for (i = 0; i < 4096; i++) {
                    event.data.writeFloat(0.0);
                }
                this.writtenSampleCount += 2048;
                return;
            }
            
            var count:Number = Math.min(this.buffer.length, 16384);
            
            for each (var sample:Number in this.buffer.slice(0, count)) {
                event.data.writeFloat(sample);
            }
            
            this.writtenSampleCount += count/2;
            this.buffer = this.buffer.slice(count, this.buffer.length);
        }
    }
}

