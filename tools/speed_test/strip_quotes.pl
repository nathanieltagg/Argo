#!/usr/bin/perl -w

open INFILE, "<clus.json";
while(<INFILE>) {
  s/\"([\-0-9\.]*)\"/$1/g;
  print $_;
}