webPdExamples = {
  
  init: function() {
    $('#startButton').click(function() {
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