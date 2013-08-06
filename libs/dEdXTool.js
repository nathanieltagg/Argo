//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Global used by this.

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-dEdXTool').each(function(){
    gdEdX = new dEdXTool(this);
  });  
});


function UserTrackPoint()
{
  this[0] = 0;
  this[1] = 0;
  this[2] = 0;
  this.tdc = 0;
  this.r = 10;
  this.lasttouch = [0,1]; // Last two unique planes touched by user, [older, recent]
  this.set_to_zoom_center();
}

UserTrackPoint.prototype.set_to_zoom_center = function ()
{
  // use the current zoom to suggest point coordinates.
  var zoomCenter = gZoomRegion.getCenter();
  var tdc = (gZoomRegion.tdc[0] + gZoomRegion.tdc[1])/2;
  this[0] = zoomCenter[0];
  this[1] = zoomCenter[1];
  this[2] = zoomCenter[2];
  this.tdc= tdc;
}


UserTrackPoint.prototype.set_view = function (plane, wire, tdc)
{
  // Move the view to suggest the zoom point.
  
  // TDC is easy.
  this.tdc = tdc;

  if(this.lasttouch==null || this.lasttouch.length < 2) {
    // Easiest: adjust the other two views to match this one.
    var deltaWire = wire - this[plane];
    var dwire = [0,0,0];
    switch(plane) {
      case 0: dwire = [ deltaWire        ,-deltaWire*kcos60, deltaWire*kcos60 ]; break;
      case 1: dwire = [-deltaWire*kcos60 , deltaWire       , deltaWire*kcos60 ]; break;
      case 2: dwire = [ deltaWire*kcos60 , deltaWire*kcos60, deltaWire        ]; break;
    }
 
    this[0] += dwire[0];
    this[1] += dwire[1];
    this[2] += dwire[2];
  } else {
    // Attempt to keep this view consistent with the last view we worked in.
    // Find wire crossing point for this wire and the last touched.
    var lastplane = this.lasttouch[1];
    if(lastplane == plane) lastplane = this.lasttouch[0];

    var gw1 = gGeo.getWire(plane,wire);
    var gw2 = gGeo.getWire(lastplane, this[lastplane]);
    var xing = gGeo.wireCrossing(gw1,gw2);
    var thirdplane = 0;
    while(thirdplane==plane || thirdplane== lastplane) thirdplane++;
    console.warn(plane,wire);
    console.warn(lastplane, this[lastplane]);
    console.warn(gw2,xing);
    var newwire = gGeo.yzToWire(thirdplane,xing.y,xing.z);
    console.warn(thirdplane,newwire);
    this[plane] = wire;
    this[thirdplane] = newwire;
  }
  
  if(this.lasttouch[1] != plane) {
    this.lasttouch[0] = this.lasttouch[1];
    this.lasttouch[1] = plane;
  }
}


// Track object for user drawings
function UserTrack()
{
  this.points=[];
  
  // Default.  
}

UserTrack.prototype.set_default = function()
{
  var a = new UserTrackPoint();
  var b = new UserTrackPoint();
  // Width of Y-view:
  var y_width = gZoomRegion.plane[2][1] - gZoomRegion.plane[2][0];
  b.set_view(2, a[2]+y_width/3, a.tdc);
  this.points = [a,b];
}





// Subclass of ABoundObject.
dEdXTool.prototype = new Pad(null);           

gUserTrack = new UserTrack();

function dEdXTool( element, options  )
{
  ///
  /// Constructor.
  ///
  if(!element) return;

  // Options - defaults. Sensible for a wide range of stuff.  
  var defaults = {
    log_y : false,
    draw_grid_y : true,
    draw_grid_x : false,
    margin_left : 30,
    margin_bottom : 40,
    draw_box : false,    
    margin_right : 10,
    margin_top : 10,
    xlabel : "Wire",
    ylabel : "Charge",
    
  };
  // override defaults with options.
  $.extend(true,defaults,options);

  // Override with configuration from the element
  Pad.call(this, element, defaults); // Give settings to ABoundObject contructor.
  
  gUserTrack.set_default();
  
  gStateMachine.Bind('recordChange', this.NewRecord.bind(this) );  
  gStateMachine.Bind('userTrackChange', this.Draw.bind(this) );  
  this.ctl_dedx_path    =  GetBestControl(this.element,".dEdX-Path");
  $(this.ctl_dedx_path).change(this.Draw.bind(this));
  this.hists=[];
}

dEdXTool.prototype.NewRecord = function()
{
  gUserTrack.set_default();
  this.hists=[];
}


dEdXTool.prototype.Draw = function()
{
  if(!$(this.ctl_dedx_path).is(":checked")) {
    $(this.element).hide();
    return;
  } 
  $(this.element).show();

  // Find all hits that intersect and plot them.
  if(!gHitsListName) return;
  var hits = gRecord.hits[gHitsListName];
  
  this.hists = [];
  this.starts = [];

  var nsegments = gUserTrack.points.length-1;
  console.warn("nsegments",nsegments);
  for(var p=0;p<3;p++) {
    var nbins = Math.ceil(gUserTrack.points[nsegments][p] - gUserTrack.points[0][p]);
    if(p==2) console.warn("binning:", gUserTrack.points[nsegments][p] , gUserTrack.points[0][p], nbins);
    this.hists[p] = new Histogram(nbins+1,0,nbins+1);
    this.starts[p] = gUserTrack.points[0][p];
  }
   
  var n = 0; 
  // Go through gHits, and find hits that match our view.
  for(var i=0;i<hits.length;i++) {
    var h = hits[i];
    var p = h.plane;
    var w = h.wire;
    // See if hit falls on a segment.
    for(var s=0;s<nsegments;s++) {
      var w1 = gUserTrack.points[s][p];
      if(w < w1) continue;
      var w2   = gUserTrack.points[s+1][p];
      if(w > w2) continue;
      var t1 = gUserTrack.points[s  ].tdc;
      var t2 = gUserTrack.points[s+1].tdc;
      var r1 = gUserTrack.points[s  ].r;
      var r2 = gUserTrack.points[s+1].r;
      // It's in this segment range. Now see if it matches the line.
      var t = t1 + (t2-t1)/(w2-w1)*(w-w1);
      var r = r1 + (r2-r1)/(w2-w1)*(w-w1);
      // overlap?
      if(h.t2 < t-r) continue; // hit is too early
      if(h.t1 > t+r) continue; // hit is too late.
      // throw it on the pile!
      this.hists[p].Fill(w-this.starts[p],h.q);
      n++;
    }
  }
  console.warn("Built dEdX map, ",n,"hits match");

  var hist = this.hists[2]; // Just do induction plane for now.
  
  this.min_u = hist.min; // Minimum value shown on x-axis  FIXME - make adjustable.
  this.max_u = hist.max; // Maximum value shown on y-axis
  this.min_v = hist.min_content;                // minimum value shown on Y-axis
  this.max_v=  hist.max_content*1.02;  // maximum value shown on Y-axis
  if(this.min_v == this.max_v) this.max_v = this.min_v + 1.02; // If min and max are both 0, adjust the max to be 1 unit bigger
  
  this.Clear();
  this.DrawFrame();

  // Width of a single vertical histogram bar.
  var barwidth = (hist.max-hist.min)/(hist.n)*this.span_x/(this.max_u-this.min_u) ;
  if(barwidth>2) barwidth -= 1;
  this.ctx.strokeStyle = "black";
  this.ctx.fillStyle   = "black";
  this.ctx.lineWidth = 1;
  for (var i = 0; i < hist.n; i++) {
    var t = hist.GetX(i);
    var t2 = hist.GetX(i+1);
    var f = hist.data[i];
    var x1 = this.GetX(t);
    var x2 = this.GetX(t2);
    var y = this.GetY(f);
    if(x2<this.origin_x) continue;
    if(x1>(this.origin_x + this.span_x)) continue;
    if(x1<this.origin_x) x1 = this.origin_x;
    if(x2>(this.origin_x + this.span_x)) x2 = this.origin_x+this.span_x;
    
    this.ctx.fillRect(x1, y-3, x2-x1, 6);
  }
}


