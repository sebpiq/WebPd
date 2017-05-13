webPdExamples = {

  init: function() {
    var startButton = $('#startButton')
    Pd.startOnClick(startButton.get(0), function() {
      startButton.fadeOut(200, function() { $('#controls').fadeIn(200) })
    })
  },

  patchLoaded: function(mainStr) {
    // Rendering the patch as SVG
    $('#svg').html(pdfu.renderSvg(pdfu.parse(mainStr), {svgFile: false, ratio: 1.5}))

    // Show start button
    $('#loading').fadeOut(200, function() { $('#startButton').fadeIn() })
  }

}
