/*
 * Copyright (c) 2011-2013 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 *  This file is part of WebPd. See https://github.com/sebpiq/WebPd for documentation
 *
 *  WebPd is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  WebPd is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with WebPd.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

var _ = require('underscore')
  , inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , portlets = require('./portlets')
  , utils = require('./utils')
  , BaseNode = require('./BaseNode')

var PdObject = module.exports = function() {
  BaseNode.apply(this, arguments)

  // Because our inheritance system needs to instantiate
  // a dummy object of the parent class, we need to make sure that
  // this dummy object is not registered 
  if (this.type !== 'abstract' && !this.patch)
    require('../index').getDefaultPatch().register(this)
}
PdObject.extend = utils.chainExtend

_.extend(PdObject.prototype, BaseNode.prototype, {
  type: 'abstract'
})
