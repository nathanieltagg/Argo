


function hitTimesMatch(a,b)
{
  // Returns -1 if hit 'a' is early
  // returns +1 if hit 'b' is early
  // returns 0 if they match.
  var t0a = gGeo.getTDCofX(a.plane,0)*2;
  var t0b = gGeo.getTDCofX(b.plane,0)*2;
  
  if((a.t2-t0a) < (b.t1-t0b)) return -1;
  if((a.t1-t0a) > (b.t2-t0b)) return +1;
  
  return 0;
};

function verboseCompare(a,b)
{
  // Returns -1 if hit 'a' is early
  // returns +1 if hit 'b' is early
  // returns 0 if they match.
  var t0a = gGeo.getTDCofX(a.plane,0);
  var t0b = gGeo.getTDCofX(b.plane,0);
  console.log("a.t1",a.t1-t0a);
  console.log("a.t2",a.t2-t0a);
  console.log("b.t1",b.t1-t0b);
  console.log("b.t2",b.t2-t0b);
  if((a.t2-t0a) < (b.t1-t0b)) console.log("first is early by ",(a.t2-t0a) - (b.t1-t0b));
  if((a.t1-t0a) > (b.t2-t0b)) console.log("first is late  by ",(a.t1-t0a) - (b.t2-t0b));
  console.log("match");
  return 0;
};

function compareHitTimes(a,b)
{
  return a.t - b.t;
}

function findMatchingHitsInTime( sortedHitList, trialHit, startindex ) 
{
  var retobj={list:[], index:startindex};

  for(var i=startindex;i<sortedHitList.length;i++) {
    var comparehit = sortedHitList[i]
    var match = hitTimesMatch(comparehit, trialHit);
    if(match > 0) { // too late, stop advancing
      return retobj;
    } else if(match < 0 ) {
      retobj.index = i; // We should advance our index: skip this hit in later trials.
    } else {// if(match==0) 
      retobj.list.push(comparehit);    
    }
  }
  return retobj;
}

function RecoSortHistlistsByPlane(hitlist)
{
  var planes = [[],[],[]];
  for(var i =0; i<hitlist.length;i++) {
    var h = hitlist[i];
    planes[h.plane].push(h);
  }
  planes[0].sort(compareHitTimes);
  planes[1].sort(compareHitTimes);
  planes[2].sort(compareHitTimes);
  
  console.log("sorted hit lists:",planes[0],planes[1],planes[2]);
  
  return planes;
}

function Reco3dSpacepoints(hitlist)
{
  console.time("Reco3dSpacepoints");
  var tolerance = 0.2;
  
  var spacepoints = [];
  var spid = 0;
  
  // store some offsets.
  var t0 = [gGeo.getTDCofX(0,0),gGeo.getTDCofX(1,0),gGeo.getTDCofX(2,0)];
 
  // Make time-sorted lists of hits in each plane.
  var planes = RecoSortHistlistsByPlane(hitlist);

  var i0 =0; // Start index for plane 0
  var i1 =0; // start index for plane 1
    
    
  var avg_dt02 = 0;
  var avg_dt12 = 0;
  
  // Walk through hits in plane 2, and look for hits that overlap in time and space with other planes.  
  var matches = [];
  for(var i2=0;i2<planes[2].length;i2++) {
    var hit2 = planes[2][i2];
    gwire2 = gGeo.getWire(2,hit2.wire);
    
    var match0 = findMatchingHitsInTime(planes[0], hit2, i0);
    var match1 = findMatchingHitsInTime(planes[1], hit2, i1);
    
    i0 = match0.index; // Saves time - don't go through entire list again, start at this spot next time.
    i1 = match1.index;
    
    // console.log("consider plane 2 hit ", i2, " has matches in plane 0: " , match0.list.length , " and in plane 1 " , match1.list.length);
    
    if(match0.list.length ==0 || match1.list.length==0) continue; // We need at least one in each of 3 views!
    
    // OK, now look for geometrical match.
    
    toOuterLoop:
    for(var j0=0;j0<match0.list.length;j0++) {
      // Loop through potential matches in plane 0.
      var hit0 = match0.list[j0];
      var gwire0 = gGeo.getWire(0,hit0.wire);
      // Find the matching YZ location.
      var cross02 = gGeo.wireCrossing(gwire0,gwire2);
      if(cross02) {
        // These two cross sensibly. How about the third?
        
        for(var j1=0;j1<match1.list.length;j1++) {
          var hit1 = match1.list[j1];
          var gwire1 = gGeo.getWire(1,hit1.wire);
          var cross12 = gGeo.wireCrossing(gwire0,gwire1);
        
          if(cross12) {
            // We have three in-time hits. Do they cross in the same place?
            var dy = Math.abs(cross02.y - cross12.y);
            var z = cross02.z;
            var y = 0.5*(cross02.y + cross12.y);
            var x = gGeo.getXofTDC(2,hit2.t);
            var x2 = gGeo.getXofTDC(2,hit2.t2);
            
            if(dy < tolerance) { 
              var spacepoint = {id: spid++, xyz: [x,y,z], errXyz: [x2-x,dy,tolerance] };
              spacepoints.push(spacepoint);
              avg_dt02 += hit2.t-hit0.t;
              avg_dt12 += hit2.t-hit1.t;
              break toOuterLoop; // OK, we've used this hit in plane 2. Continue on. 
            }
            
          }
        }
      }
    }
    
    // finished considering this hit.
  }
  var nsp = spacepoints.length;
  avg_dt02 /= nsp;
  avg_dt12 /= nsp;
  console.log("Offset plane 2 - plane 0: ",avg_dt02);
  console.log("Offset plane 2 - plane 1: ",avg_dt12);
  console.timeEnd("Reco3dSpacepoints");

  return spacepoints;
  
};



