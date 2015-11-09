webPdExamples = {
  
  init: function() {
    // starting in iOS9, audio will only be unmuted if the context is created on "touchend".
    // see : https://github.com/sebpiq/WebPd/issues/81  
    var is_iOS = /iPad|iPhone|iPod/.test(navigator.platform)
      , eventType = is_iOS ? 'touchend' : 'click'

    $('#startButton').on(eventType, function() {
      $(this).fadeOut(200, function() { $('#controls').fadeIn(200) })
      Pd.start()
    })
  },

  patchLoaded: function(mainStr) {
    // Rendering the patch as SVG
    $('#svg').html(pdfu.renderSvg(pdfu.parse(mainStr), {svgFile: false, ratio: 1.5}))

    // Show start button
    $('#loading').fadeOut(200, function() { $('#startButton').fadeIn() })
  }

}