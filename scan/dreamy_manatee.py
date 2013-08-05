#!/usr/bin/env python

## dremy.cgi
## A port of Sleepy Mongoose https://github.com/10gen-labs/sleepy.mongoose
## as a cgi script, to allow user authentication at the script level.

import cgi
import cgitb; cgitb.enable()  # for troubleshooting
import os
import urlparse
import sys

from handlers import MongoHandler
try:
    import json
except ImportError:
    import simplejson as json
try:
    urlparse.parse_qs
except AttributeError:
    urlparse.parse_qs = cgi.parse_qs


def write_callback(str):
    print str;
        

print "Content-type: text/html"
# print "Content-type: application/json"
print


MongoHandler.mh = MongoHandler("localhost")
form = cgi.FieldStorage()
#args = urlparse.parse_qs(os.environ['QUERY_STRING'])

# path=os.environ['REQUEST_URI']
# (uri,q,args)=path.partition('?')
# 
# if len(args) != 0:
#     args = urlparse.parse_qs(args)
# else:
#     args = {}

func_name= form.getvalue("func","_hello")
db       = form.getvalue("db","mydb")
col      = form.getvalue("col","testData")

# Create the argument list expected by sleepy mongoose.
if os.environ['REQUEST_METHOD'] == 'GET':
    path=os.environ['REQUEST_URI']
    (uri,q,args)=path.partition('?')
    if len(args) != 0:
        args = urlparse.parse_qs(args)
    else:
        args = {}
else:
    args = form
        
# print db + "<br/>\n"
# print col + "<br/>\n"
# print func_name + "<br/>\n"
# print form.getvalue("docs");

# for k, v in args.iteritems():
#     print k,"  ->  ",v,"<br/>\n"
#     # print "Extra arg: " + k + " -> " + v + "<br/>\n"
                
func = getattr(MongoHandler.mh, func_name, None)
if callable(func):
    # print "callable: " + func_name + "<br/>\n"
    func(args, write_callback, name = None, db = db, collection = col)
else:
    print "{\"ok\":0, \"errmsg\":\"bad func name -" + func_name + "\"}"

