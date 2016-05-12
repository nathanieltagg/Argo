#!/usr/bin/env python
import json
import urllib2
import urllib
import sys
import re
import os
import io

def build_default_event(url):
    
    files_to_delete = os.listdir("../server/defaultimg/")
    for f in files_to_delete:
        os.remove("../server/defaultimg/"+f)
    
    urlbase = re.search("(.*)\/.*",url).group(1)
    urlbase = re.search("(.*)\/.*",urlbase).group(1) # again!
    print urlbase
    data = urllib2.urlopen(url).read()
    
    result = json.loads(data)
    for typ in ('raw','cal','raw_lowres','cal_lowres'):
        if typ in result['record']:
            map = result['record'][typ]
            print typ
            for nm in map:
                for row in map[nm]['wireimg_encoded_tiles']:
                    print "entry"
                    
                    for col in row:
                        img = col['url']
                        img2 = re.sub(r'.*\/','server/defaultimg/',img)
                    
                        imgurl = urlbase + "/" + img;
                        urllib.urlretrieve(imgurl,"../"+img2)
                    
                    
                        print img
                        print img2
                        col['url'] = img2
    
    f = open('default_event.json', 'w')
    json.dump(result,f)
    f.close()
    
                    
        
    



if __name__ == "__main__":
    url = sys.argv[1]
    build_default_event(url)