#!/bin/sh

set -e
set -x

srcdir=`dirname $0`/..

# run unit tests
node $srcdir/test/unit/index.js

# run functional tests
$srcdir/test/cmdline.sh
