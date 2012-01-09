#!/bin/bash

ssh mccormick.cx "cd web/projects/WebPd; bzr up"
bzr push https://mccormix@web-pure-data.googlecode.com/svn/trunk
bzr dpush git+ssh://git@github.com/chr15m/WebPd.git
