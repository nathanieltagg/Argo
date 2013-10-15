
// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...

$(function(){
  $('div.A-reco-pad').each(function(){
    gReco = new Reco(this);
  });  
});


// Subclass of Pad.
Reco.prototype = new Pad;           

function Reco( element )
{
  if(element === undefined) return; // null function call.
  
  var settings = {
  };
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  this.text_element = $(this.element).siblings(".A-reco-text");
  
  var self = this;

  $(this.element).siblings(".reco-go-button").click( this.DoReco.bind(this) );
  $(this.element).siblings("#ctl-show-reco").click( this.DoReco.bind(this) );
 
  gStateMachine.Bind('recordChange',  this.NewRecord.bind(this));
}

var nd = 0;

hitTimesMatch = function(a,b,t0a,t0b)
{
  var sig2 = a.σt*a.σt + b.σt*b.σt;
  var diff = (a.t-gGeo.getTDCofX(a.plane,0))- (b.t-gGeo.getTDCofX(b.plane,0))
  return (diff*diff < sig2*16);
  
  // var sig = Math.sqrt(sig2);
  // var match =true;
  // if(a.t2-t0a < b.t1-t0b) return false;
  // if(a.t1-t0a > b.t2-t0b) return false;
  // return true;
  // if(match)
  //   if(nd<100) {
  //     nd++;
  //     console.log("hitTimesMatch",match,a.t1,a.t2,b.t1,b.t2,diff,sig,diff/sig2);
  // }
  // return match;
  // var sig2 = a.σt*a.σt + b.σt*b.σt;
  // var diff = (a.t-gGeo.getTDCofX(a.plane,0))- (b.t-gGeo.getTDCofX(b.plane,0))
  // return (diff*diff < sig2 * 5);
}

Reco.prototype.NewRecord = function()
{
  this.matches = [];
}

Reco.prototype.DoReco = function()
{
  // Sort by hit start time.
  if(!gHitsListName) return;
  var inhits = gRecord.hits[gHitsListName];
  if(inhits.length==0) return;
  
  // sort by plane.
  var planes = [[],[],[]];
  for(var i=0;i<inhits.length;i++){
    var hit = inhits[i];
    hit.idx = i; // Cheat and add our own info.
    if(hit.plane >=0 && hit.plane <3) planes[hit.plane].push(hit);
  }
  var txt = planes[0].length + "," + planes[1].length + "," + planes[2].length;

  // store some offsets.
  var t0 = [gGeo.getTDCofX(0,0),gGeo.getTDCofX(1,0),gGeo.getTDCofX(2,0)];
  
  // Walk through hits in plane 2, and look for hits that overlap in time and space with other planes.
  var matches = [];
  for(var i2=0;i2<planes[2].length;i2++) {
    var hit2 = planes[2][i2];
    gwire2 = gGeo.getWire(2,hit2.wire);

    for(i0=0;i0<planes[0].length;i0++) {
      var hit0 = planes[0][i0];
      if(hitTimesMatch(hit2,hit0,t0[2],t0[0])){
        gwire0 = gGeo.getWire(0,hit0.wire);
        
        // Find the matching YZ location.
        var cross02 = gGeo.wireCrossing(gwire0,gwire2);
        if(cross02) {
          for(i1=0;i1<planes[1].length;i1++) {
            var hit1 = planes[1][i1];
            gwire1 = gGeo.getWire(1,hit1.wire);
            if(hitTimesMatch(hit2,hit1,t0[2],t0[1])){
              var cross12 = gGeo.wireCrossing(gwire0,gwire1);
              if(cross12) {
                // We have three in-time hits. Do they cross in the same place?
                dy = Math.abs(cross02.y - cross12.y);
                if(dy<0.035) {
                  // possible match.
                  var tsum = (hit0.t-gGeo.getTDCofX(0,0))/(hit0.σt*hit0.σt)
                           + (hit1.t-gGeo.getTDCofX(1,0))/(hit1.σt*hit1.σt)
                           + (hit2.t-gGeo.getTDCofX(2,0))/(hit1.σt*hit1.σt);
                  var ttot = 1/(hit0.σt*hit0.σt)
                           + 1/(hit1.σt*hit1.σt)
                           + 1/(hit1.σt*hit1.σt);
                           
                  
                  var match = {
                    hit0: hit0,
                    hit1: hit1,
                    hit2: hit2,
                    cross02: cross02,
                    cross12: cross12,
                    y: (cross02.y+cross12.y)/2,
                    z: (cross02.z+cross12.z)/2,
                    t: tsum/ttot,
                  };
                  matches.push(match);
                }
              }
            }
          }
        }
      } 
    }
  }
  txt += "<br/>" + matches.length;
  $(this.text_element).html(txt);
  console.log("matches:",matches);
  this.matches = matches;
  
  
}


