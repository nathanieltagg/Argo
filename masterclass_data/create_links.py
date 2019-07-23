#!/bin/env/python

filepath = 'crossing_muons_run1_eventnumber.txt'
with open(filepath) as fp:
   line = fp.readline()
   while line:        
        line = fp.readline()
        spec=line.rstrip().split('/')
        print spec