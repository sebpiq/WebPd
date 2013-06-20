// Dummy Web Audio API context
module.exports.WAAContext = {
  createGain: function() {
    return {
      gain: {value: 1},
      connect: function() {}
    }
  },
  createOscillator: function() {
    return {
      frequency: {value: 0},
      connect: function() {}
    }
  },
  createChannelMerger: function() {
    return {
      connect: function() {}      
    }
  }  
}
