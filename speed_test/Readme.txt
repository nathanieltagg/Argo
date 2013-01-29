Tried to see what was faster in anger: xml or json for real-world application.

Tried at first to rewrite the XML engine, but that's too hard.
Tried converting whole MINERvA gate to json, but that was problematic.  (e.g. https://dl.dropbox.com/u/10964419/xml2json/transform.html)

So, took my standard event, and just ripped out 'clus' objects. Rawhit objects are of course more complex, but a cluster object is sufficiently complex to suit my ends.  

Got clus.json and clus.xml.
Load with speed_test.xml. Results under chrome:

xml: 22.818ms 
xml-add: 74.862ms 
json: 0.897ms 
json-add: 50.846ms

..with identical floating-point result summing PEs in all clusters. 

Results were consistent within 30% or so when reloading.  This gives a speedup factor of about x20 for the XML parse, and a speedup factor of about ~20% when doing a loop over elements.  

Note that these results are pessimistic, because the lame-ass converter software treated numerical values as strings!  Removing all the parseFloat()s will probably hugely increase speed again!

Let's try ("strip-quotes.pl"):
xml: 22.836ms 
xml-add: 73.433ms 
json: 0.908ms 
json-add: 6.529ms

Yup.  Addition of all the pe values (x100 times) is about 10 times faster. 

OK, this decides me: gotta move to JSON.
