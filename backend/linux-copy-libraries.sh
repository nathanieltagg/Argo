#!/bin/bash

# This script (linux only, not mac) finds all the libraries the binary is dependent on and moves them all to the ../lib directory
# This both puts everything on local disk, AND it allows a single LD_LIBRARY_PATH=../lib to set up everything!  Isn't that cool?
# Can be run from the makefile

ldd argo-backend-new > tmp/ldddump.txt
re='(/[^[:space:]]*)'
arr=( )
while IFS= read -r line; do
  if [[ $line =~ $re ]] ; then
    ll=${BASH_REMATCH[1]}
    echo $ll
    cp $ll ../lib
  fi
done <tmp/ldddump.txt
