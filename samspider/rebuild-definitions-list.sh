#!/bin/bash


DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
source /grid/fermiapp/products/uboone/setup_uboone.sh
setup sam_web_client
cd $DIR
samweb list-definitions > defs.txt
LC_ALL=C sort defs.txt > defs_sorted.txt
