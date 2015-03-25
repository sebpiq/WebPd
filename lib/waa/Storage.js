var WebStorage = module.exports = function() {}

// Gets an array buffer through an ajax request, then calls `done(err, arrayBuffer)`
WebStorage.prototype.get = function(url, done) {
  var req = new XMLHttpRequest()

  req.onload = function(e) {
    if (this.status === 200)
      done(null, this.response)
    else done(new Error('HTTP ' + this.status + ': ' + this.statusText))
  }

  req.onerror = function(e) {
    done(e)
  }

  req.open('GET', url, true)
  req.responseType = 'arraybuffer'
  req.send()
}