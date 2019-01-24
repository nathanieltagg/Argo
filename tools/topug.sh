#!/bin/bash

mkdir -p node3/pugified/inc

for f in *.html ; do
  n="node3/pugified/$(basename "$f" .html).pug"
  t="node3/pugified/tmp.pug"
  echo "$f -> $t"
  html2pug < $f > $t
  echo "$t -> $n"
  perl -pe 's/\/\/#include virtual\="html\/(.*).inc"/include inc\/$1/g' $t > $n
  # search and replace line by line
  #   //#include virtual="html/ZoomControl.inc"
  # should become:
  #   include inc/ZoomControl
  
done


for f in html/*.inc ; do
  n="node3/pugified/inc/$(basename "$f" .inc).pug"
  echo "$f -> $n"
  html2pug -f < $f > $n
done