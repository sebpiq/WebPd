/*
 * Copyright (c) 2011-2017 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
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

// Error thrown when Pd.loadPatch failed
var PatchLoadError = exports.PatchLoadError = function PatchLoadError(errorList) {
  this.name = 'PatchLoadError'
  this.errorList = errorList
  this.message = _.map(errorList, function(errPair) {
    return errPair[0] + '\n\t' + errPair[1].message
  }).join('\n')
  this.stack = (new Error()).stack
}
PatchLoadError.prototype = Object.create(Error.prototype)
PatchLoadError.prototype.constructor = PatchLoadError


// Error thrown when trying to create an unknown object
var UnknownObjectError = exports.UnknownObjectError = function UnknownObjectError(type) {
  this.name = 'UnknownObjectError'
  this.message = 'unknown object ' + type
  this.objectType = type
  this.stack = (new Error()).stack
}
UnknownObjectError.prototype = Object.create(Error.prototype)
UnknownObjectError.prototype.constructor = UnknownObjectError


// Error thrown when trying to access an invalid portlet with `.i` or `.o`
var InvalidPortletError = exports.InvalidPortletError = function InvalidPortletError(message) {
  this.name = 'InvalidPortletError'
  this.message = message
  this.stack = (new Error()).stack
}
InvalidPortletError.prototype = Object.create(Error.prototype)
InvalidPortletError.prototype.constructor = InvalidPortletError