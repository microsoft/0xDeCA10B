#!/bin/bash

# Start the production front-end.

set -ex

if [ -z ${PORT+x} ]; then
    PORT=3000
fi

serve --single --listen ${PORT} build
