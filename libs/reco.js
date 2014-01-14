
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
  this.best_hough = null;
  this.houghpoints = [];
  this.houghlines = [];
}


Reco.prototype.Do3dMatchFinding = function(planes)
{
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

  if(this.houghpoints.length == 0) {
    this.houghpoints = [];
    for(var i=0;i<planes[2].length;i++){
      var hit = planes[2][i];
      var point = {
        hit: hit,
        h_wt: 1,
        h_pt: [hit.wire*0.300, gGeo.getXofTDC(hit.plane,hit.t)]
      };
      this.houghpoints.push(point);
    }
  }

  this.best_hough = Bifurcated_2d_Hough(this.houghpoints);
  function lines_from_houghstate(state)
  {
    function line_from_r_θ(x_cm,y_cm,r,θ) {
      var px = x_cm + r*Math.cos(θ);
      var py = y_cm + r*Math.sin(θ);
      var vx =  Math.sin(θ);
      var vy = -Math.cos(θ);
      var halflength = 1000*0.3;
      return [
              [ (px - halflength*vx)/0.3, gGeo.getTDCofX(state.points[0].hit.plane,py - halflength*vy) ],
              [ (px + halflength*vx)/0.3, gGeo.getTDCofX(state.points[0].hit.plane,py + halflength*vy) ],            
      ];      
    }
    var θ1 = state.θ1;
    var θ2 = state.θ2;
    var r1 = state.r1;
    var r2 = state.r2;
    var r = (r1+r2)*0.5;
    var θ = (θ1+θ2)*0.5;
    var vx =  Math.sin(θ);
    var vy = -Math.cos(θ);
    var halflength = 2000*0.3;
    return [
            line_from_r_θ(state.x_cm, state.y_cm, r,θ),
            line_from_r_θ(state.x_cm, state.y_cm, r1,θ1),
            line_from_r_θ(state.x_cm, state.y_cm, r2,θ1),
            line_from_r_θ(state.x_cm, state.y_cm, r1,θ2),
            line_from_r_θ(state.x_cm, state.y_cm, r2,θ2)            
            ];
  }
  this.houghlines = lines_from_houghstate(this.best_hough);
  
  this.houghpoints = this.best_hough.points_out.slice(0); // Set up for next iteration.
  // for(var n=2;n<20;n++) {
  //   console.log("run...",n);
  //   this.houghpoints = this.best_hough.points_out.slice(0);
  //   this.best_hough = Bifurcated_2d_Hough(this.houghpoints);  
  //   this.houghlines = this.houghlines.concat(lines_from_houghstate(this.best_hough));
  // }

  
  console.log("HOUGH COMPLETE:",this.best_hough);

  gStateMachine.Trigger("zoomChange");
}

function Bifurcated_2d_Hough( points )
{ 
  // input: array of spacepoints points = []
  //        Each object has to have element h_pt: [x,y]
  //        and a weight h_wt: value
  // output: object containing highest hough peak, plus list of objects in that peak

  // First, find (weighted) center of mass off all points to help reduce angle error.
  var x_cm = 0;
  var y_cm = 0;
  var mass = 0;
  var p;
  for(var i=0;i<points.length;i++) {
    var p = points[i];
    x_cm += p.h_wt*p.h_pt[0];
    y_cm += p.h_wt*p.h_pt[1];
    mass += p.h_wt;
  }
  x_cm /= mass;
  y_cm /= mass;
  x_cm = 0; // override
  y_cm = 0;
  console.log("CM position at ",x_cm,y_cm);
  
  // Next, let's construct the bounds for the search in. We'll search all angles between 0 and pi,
  // and for distance from origin, just use distance to the furthest point.  It's almost certainly too far, but what the hell.
  var rmax = 0;
  for(var i=0;i<points.length;i++) {
    p = points[i];
    p.h_pt_rx = p.h_pt[0]-x_cm;  // reduced x-coord
    p.h_pt_ry = p.h_pt[1]-y_cm;  // reduced y-coord
    var r = Math.sqrt(p.h_pt_rx*p.h_pt_rx + p.h_pt_ry*p.h_pt_ry);
    p.h_pt_rr = r; // reduced distance from CM 
    if(r>rmax) rmax=r;
  }

  var state = {
    x_cm: x_cm,
    y_cm: y_cm,
    r_resolution: 1,
    θ_resolution: 0.01,
    r1: -rmax,
    r2:  rmax,
    θ1: 0,
    θ2: Math.PI,
    points: points.slice(0), // copy the array
    points_out: []
  }
  // OK, we have our first setup to call the recursion.
  return Bifurcate_2d_Hough_Region(state);
  
}

function Bifurcate_2d_Hough_Region(state)
{
  // Seperate the input region into four quadrants. Find the quadrant with the best height and repeat until done.
  // Are we done?
  console.log("Bifurcate Hough",state.r1, state.r2, state.θ1, state.θ2, state.points.length, state);
  if(state.r2     - state.r1     < state.r_resolution    ) return(state);
  if(state.θ2 - state.θ1 < state.θ_resolution) return(state);
  
  // Split.
  var r_cut     = (state.r2     + state.r1    )*0.5;
  var θ_cut = (state.θ2 + state.θ1)*0.5;
  
  // Make copies of the input state.
  var quadrants = [];
  quadrants.push($.extend({},state,{tot:0, points:[], points_out: state.points_out.slice(0), r1: state.r1, r2: r_cut,    θ1: state.θ1, θ2: θ_cut   }));
  quadrants.push($.extend({},state,{tot:0, points:[], points_out: state.points_out.slice(0), r1: r_cut   , r2: state.r2, θ1: state.θ1, θ2: θ_cut   }));
  quadrants.push($.extend({},state,{tot:0, points:[], points_out: state.points_out.slice(0), r1: state.r1, r2: r_cut,    θ1: θ_cut,    θ2: state.θ2}));
  quadrants.push($.extend({},state,{tot:0, points:[], points_out: state.points_out.slice(0), r1: r_cut   , r2: state.r2, θ1: θ_cut,    θ2: state.θ2}));

  var best_quad = 0;
  var best_quad_weight = 0;
  for(var iq=0;iq<4;iq++) {
    var q = quadrants[iq];
    // compute some useful values:
    var sin1 = Math.sin(q.θ1);   var cos1 = Math.cos(q.θ1);
    var sin2 = Math.sin(q.θ2);   var cos2 = Math.cos(q.θ2);
    var rlow, rhigh;
    var pt,x,y,r1,r2;
    for(var i=0;i<state.points.length;i++) {
      pt = state.points[i];
      x = pt.h_pt_rx;
      y = pt.h_pt_ry;
      r1 = cos1*pt.h_pt_rx + sin1*pt.h_pt_ry;
      r2 = cos2*pt.h_pt_rx + sin2*pt.h_pt_ry;
      if(r1 < r2) {rlow = r1; rhigh = r2;}
      else        {rlow = r2; rhigh = r1;}
      // These are the r-values at endpoints of the domain (θ1,θ2). Check for an extremum point between.
      var tm = Math.atan2(y,x);   //Actually pretty inexpensive in javascript
      var rm = pt.h_pt_rr;
      if(tm<0) {tm += Math.PI; rm = -pt.h_pt_rr;} // Deal with negative signs.
      if((tm > q.θ1) && (tm< q.θ2)) {
        if(rm < rlow) rlow = rm;
        if(rm > rhigh) rhigh = rm;
      }
      // Do these values overlap our region?
      if( ( rhigh < q.r1 ) || ( rlow > q.r2 ) ) {
        // point nowhere in this quadrant.
        q.points_out.push(pt);
      } else {
        // Yup, add it to our total. 
        q.points.push(pt);
        q.tot += pt.h_wt;        
      }
    }// End loop over points.
    console.log("Quadrant",iq,"=",q.tot);
    if(q.tot > best_quad_weight) {
      best_quad_weight = q.tot;
      best_quad = iq;
    }
  }

  console.log("best quadrant: ",best_quad);
  // Pick the best quadrant and iterate.

  return Bifurcate_2d_Hough_Region(quadrants[best_quad]);

}


