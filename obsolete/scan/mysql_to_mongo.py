import MySQLdb
from pymongo import MongoClient
import json
import datetime

db = MySQLdb.connect(host="localhost", # your host, usually localhost
                     user="tagg", # your username
                      # passwd="megajonhy", # your password
                     db="arachne") # name of the data base

client = MongoClient('localhost', 27017)
mydb = client.mydb
mydb.tscans.drop()
collection = mydb.tscans


# you must create a Cursor object. It will let
#  you execute all the query you need
cur = db.cursor() 

# Use all the SQL you like
cur.execute("SELECT * FROM tscans;")

# print cur.description
# print all the first cell of all the rows

# three sub-collections:
event_id_tags = [ "recoVer", "det", "run", "subrun", "gate", "slice", "filename" ]
scan_id_tags = [ "user_name", "modification_date" ]
checksum_tags = [ "idhits", "odhits", "tmean", "calpe"]

adate = datetime.datetime.utcnow();

for row in cur.fetchall() :
    event_id = {}
    scan_id = {}
    checksum = {}
    scan = {}
    for icol,col in enumerate(cur.description) :
        colname = col[0]
        val = row[icol]
        if type(val) == type(adate) :
          val = val.isoformat()
        #   print colname + " is a datetime"
        if colname in event_id_tags :
          event_id[colname] = val
        elif  colname in scan_id_tags :
          scan_id[colname] = val
        elif  colname in checksum_tags :
          checksum[colname] = val
        else :
          scan[colname] = val
        
    doc = { 'type'    : 'scan',
            'event_id': event_id, 
            'scan_id' : scan_id,
            'checksum': checksum,
            'scan'    : scan }
        
    collection.insert(doc)
    collection.ensure_index('type')
    collection.ensure_index('event_id')