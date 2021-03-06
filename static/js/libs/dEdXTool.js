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
  this.lasttouch = [0,1]; // Last two unique views touched by user, [older, recent]
  this.set_to_zoom_center();
}

UserTrackPoint.prototype.set_to_zoom_center = function ()
{
  // use the current zoom to suggest point coordinates.
  var zoomCenter = gZoomRegion.getCenterWires();
  var tdc        = gZoomRegion.getCenterTdc(2);
  // var tdc = (gZoomRegion.tdc[0] + gZoomRegion.tdc[1])/2;
  this[0] = zoomCenter[0];
  this[1] = zoomCenter[1];
  this[2] = zoomCenter[2];
  this.tdc= tdc;
};

UserTrackPoint.prototype.set_view_zoomhint = function (view, wire, tdc)
{
  // Move this point, using the global view as the hint.
  // Easiest: adjust the other two views to match this one.
  this.tdc = tdc;
  var deltaWire = wire - this[view];
  var dwire = [0,0,0];
  switch(view) {
    case 0: dwire = [ deltaWire        ,-deltaWire*kcos60, deltaWire*kcos60 ]; break;
    case 1: dwire = [-deltaWire*kcos60 , deltaWire       , deltaWire*kcos60 ]; break;
    case 2: dwire = [ deltaWire*kcos60 , deltaWire*kcos60, deltaWire        ]; break;
  }

  this[0] += dwire[0];
  this[1] += dwire[1];
  this[2] += dwire[2];  
};

UserTrackPoint.prototype.set_view = function (view, wire, tdc)
{
  // Move the view to suggest the zoom point.
  
  // TDC is easy.
  this.tdc = tdc;

  // Attempt to keep this view consistent with the last view we worked in.
  // Find wire crossing point for this wire and the last touched.
  var lastview = this.lasttouch[1];
  if(lastview == view) lastview = this.lasttouch[0];

  var gw1 = gGeo.getWire(view,wire);
  var gw2 = gGeo.getWire(lastview, this[lastview]);
  var xing = gGeo.wireCrossing(gw1,gw2);
  var thirdview = 0;
  while(thirdview==view || thirdview== lastview) thirdview++;
  // console.warn(view,wire);
  // console.warn(lastview, this[lastview]);
  // console.warn(gw2,xing);
  var newwire = gGeo.yzToWire(thirdview,xing.y,xing.z);
  // console.warn(thirdview,newwire);
  this[view] = wire;
  this[thirdview] = newwire;
  
  if(this.lasttouch[1] != view) {
    this.lasttouch[0] = this.lasttouch[1];
    this.lasttouch[1] = view;
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
  var y_width = gZoomRegion.getWidth();
  b.set_view_zoomhint(2, a[2]+y_width/3, a.tdc);
  this.points = [a,b];
}

UserTrack.prototype.get_costheta_z = function(wire)
{
  // find theta_z in this segment.
  var xyz = [];
  for(var i = 0; i< this.points.length; i++) {
    var ywire = gGeo.getWire(2,this.points[i][2]);
    var vwire = gGeo.getWire(1,this.points[i][1]);
    var p = gGeo.wireCrossing(ywire,vwire);
    p.x = gGeo.getXofTDC(0,this.points[i].tdc);
    xyz[i]=p;    
  }
  // FIXME: relies on only 2 points. Could use wire to find the right segment.
  var dx = xyz[1].x - xyz[0].x;
  var dy = xyz[1].y - xyz[0].y;
  var dz = xyz[1].z - xyz[0].z;  
  // console.warn("Getting XYZ of usertrack",xyz[0],xyz[1]);
  var cosz = dz/Math.sqrt(dx*dx + dy*dy + dz*dz);
  return cosz;
}


////////////////////////////////////////////////////////////////////////////////////////////////
// dEdX tool
////////////////////////////////////////////////////////////////////////////////////////////////


// Subclass of Pad.
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
    margin_left : 50,
    margin_bottom : 30,
    draw_box : false,    
    margin_right : 10,
    margin_top : 10,
    xlabel : "Wire Num",
    ylabel : "Hit Charge (Collection view)",
    label_font : "10px sans-serif",    
  };
  // override defaults with options.
  $.extend(true,defaults,options);

  // Override with configuration from the element
  Pad.call(this, element, defaults); // Give settings to ABoundObject contructor.
  
  gUserTrack.set_default();
  var self = this;
  
  gStateMachine.Bind('newRecord', this.NewRecord.bind(this) );  
  gStateMachine.Bind('userTrackChange', this.Draw.bind(this) );  
  this.ctl_dedx_path    =  this.GetBestControl(".dEdX-Path");
  this.ctl_dedx_width_slider = this.GetBestControl(".dEdX-width-slider");
  this.ctl_dedx_width_text   = this.GetBestControl(".dEdX-width-text");

  $(this.ctl_dedx_width_slider).slider({
    min:1, max:100, step: 1, value:10,
    slide: function(e,ui){ $("input.dEdX-width-text").val(ui.value).change(); }
  });
  $(this.ctl_dedx_width_text).change(function(){
    for(var i=0;i<gUserTrack.points.length;i++) { 
      gUserTrack.points[i].r = parseFloat($(this).val());
    }
    gStateMachine.Trigger("zoomChange");    
    gStateMachine.Trigger("userTrackChange");    
  });
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
  var hits = GetSelected("hits");


  
  this.hists = [];
  this.starts = [];

  var nsegments = gUserTrack.points.length-1;
  // console.warn("nsegments",nsegments);
  for(var p=0;p<3;p++) {
    var w2 = Math.ceil(gUserTrack.points[nsegments][p])-1;
    var w1 = Math.ceil(gUserTrack.points[0][p]);
    var nbins = Math.abs(w2-w1);
    // console.warn("binning:", w1,w2, nbins);
    this.hists[p] = new Histogram(nbins,w1,w2);
    this.starts[p] = gUserTrack.points[0][p];
  }
   
  var n = 0; 
  // Go through gHits, and find hits that match our view.
  for(var i=0;i<hits.length;i++) {
    var h = hits[i];
    var p = h.view;
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
      this.hists[p].Fill(w,h.q);
      n++;
    }
  }
  // console.warn("Built dEdX map, ",n,"hits match");

  var hist = this.hists[2]; // Just do induction view for now.
  
  this.min_u = hist.min; // Minimum value shown on x-axis  FIXME - make adjustable.
  this.max_u = hist.max; // Maximum value shown on y-axis
  this.min_v = hist.min_content;                // minimum value shown on Y-axis
  this.max_v=  hist.max_content*1.02;  // maximum value shown on Y-axis
  if(this.min_v == this.max_v) this.max_v = this.min_v + 1.02; // If min and max are both 0, adjust the max to be 1 unit bigger
  
  this.Clear();
  this.DrawFrame();
  
  // Set clipping region for all further calls, just to make things simpler.
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.clip();
  
  
  this.DrawReferenceCurves();

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
  this.ctx.restore();
}

dEdXTool.prototype.MuonCurve = function(x,cosz,top)
{
  var par0 =  cosz;
  var par1 =  6.68361e+01/cosz;
  var par2 = -9.82047e+01;
  var par3 = -6.05256e-05;
  var par4 =  5.76619e-07;
  var par5 =  3.37519e+01;

  if(top) {
    par0 =  cosz;
    par1 =  1.36442e+02/cosz;
    par2 = -2.08950e+01;
    par3 =  1.40347e-03;
    par4 = -4.88850e-07;
    par5 =  2.10392e+01;	    
  }
  
  var f= par1*(1+par2/(1+par0*x)+par3*par0*x+par4*par0*x*par0*x+par5/Math.log(1+par0*x));
  // console.log(x,f,cosz);
  return f;
}


// KE in GeV, range in g/cm2 of argon, which has density of 1.396.
// Copied number for lAr from Groom, et al
var kMuonRangeTable = [
{ke:10.0e-3, range:  0.9937},
{ke:14.0e-3, range:  1.795 },
{ke:20.0e-3, range:  3.329 },
{ke:30.0e-3, range:  6.605 },
{ke:40.0e-3, range:  1.058 },
{ke:80.0e-3, range:  3.084e1},
{ke:100.e-3, range:  4.250e1},
{ke:140.e-3, range:  6.732e1},
{ke:200.e-3, range:  1.063e2},
{ke:300.e-3, range:  1.725e2},
{ke:400.e-3, range:  2.384e2},
{ke:800.e-3, range:  4.934e2},
{ke:1.00   , range:  6.163e2},
{ke:1.40   , range:  8.552e2},
{ke:2.00   , range:  1.202e3},
{ke:3.00   , range:  1.758e3},
{ke:4.00   , range:  2.297e3},
{ke:8.00   , range:  4.359e3},
{ke:10.0   , range:  5.354e3},
{ke:14.0   , range:  7.298e3},
{ke:20.0   , range:  1.013e4 }];


dEdXTool.prototype.ProtonCurve = function(x,cosz,top)
{
  var par0 =  cosz;
  var par1 =  1.12129e+03/cosz;
  var par2 =  3.09683e+00;
  var par3 = -1.76300e-03;
  var par4 = -2.61339e-06;


  if(top) {
    par1 =  2.13886e+03/cosz;
    par2 =  2.46808e+00;
    par3 = -8.69560e-03;
    par4 =  3.90683e-05;
  }
  
  var f= par1*(1+par2/(1+par0*x)+par3*par0*x+par4*par0*x*par0*x);
  // console.log(x,f,cosz);
  return f;
}


dEdXTool.prototype.DrawReferenceCurves = function()
{
  var hist = this.hists[2]; // Just do induction view for now.
  
  // Estimate theta from the track.
  var cosz = gUserTrack.get_costheta_z(hist.GetX(0)); // FIXME: do per-wire or per-segment

  this.ctx.fillStyle = "rgba(0,0,255,0.5)";
  this.ctx.strokeStyle = "rgba(0,0,255,0.9)";
  this.ctx.beginPath();
  this.ctx.moveTo( this.GetX(this.min_u), this.GetY( this.MuonCurve(hist.n-1,cosz,true)) );

  for(var i=0;i<hist.n;i++) {
    var x = hist.n-i;
    this.ctx.lineTo( this.GetX( hist.GetX(i) ), this.GetY( this.MuonCurve(x,cosz,true)) );
  }
  for(var i=hist.n-1;i>=0;i--) {
    var x = hist.n-i;
    this.ctx.lineTo( this.GetX( hist.GetX(i) ), this.GetY( this.MuonCurve(x,cosz,false)) );
  }
  this.ctx.closePath();
  this.ctx.fill();
  
  var y_avg = (this.MuonCurve(1,cosz,true) + this.MuonCurve(1,cosz,false))/2;
  this.ctx.fillText("Muon",this.GetX(this.max_u), this.GetY(y_avg));
  
  // put another scale on.
  this.ctx.font = "10px sans-serif";
  this.ctx.textAlign = 'center';
  this.ctx.textBaseline = 'top';
  var lasttick_x = this.span_x+this.origin_x;
  var density = 1.396;
  for(var itick=0;itick<kMuonRangeTable.length;itick++)
  {    
    // Walk from right to left, putting in KE markings.
    var e = kMuonRangeTable[itick];

    // Find the position to put this tick in wires.
    var L = (e.range/density); // cm
    var wires = L*0.3; // wires
    var x = this.GetX(this.max_u-wires);
    var tickLen = 5;
    this.ctx.fillRect(x,this.origin_y-this.span_y,1,tickLen);
    
    var delta_x = Math.abs(x-lasttick_x);
    if(delta_x > 20)  {
      // If enough room, put in the label.
      this.ctx.fillText(String(e.ke)+" GeV", x, this.origin_y-this.span_y+tickLen);
    }
    lasttick_x = x;
  }
  
  
  
  
  
  
  
  
  this.ctx.fillStyle = "rgba(255,0,0,0.5)";
  this.ctx.beginPath();
  this.ctx.moveTo( this.GetX(this.min_u), this.GetY( this.ProtonCurve(hist.n-1,cosz,true)) );

  for(var i=0;i<hist.n;i++) {
    var x = hist.n-i;
    this.ctx.lineTo( this.GetX( hist.GetX(i) ), this.GetY( this.ProtonCurve(x,cosz,true)) );
  }
  for(var i=hist.n-1;i>=0;i--) {
    var x = hist.n-i;
    this.ctx.lineTo( this.GetX( hist.GetX(i) ), this.GetY( this.ProtonCurve(x,cosz,false)) );
  }
  this.ctx.closePath();
  this.ctx.fill();
  
  var y_avg = (this.ProtonCurve(1,cosz,true) + this.ProtonCurve(1,cosz,false))/2;
  // console.warn("Proton",y_avg);
  this.ctx.fillText("Proton",this.GetX(this.max_u), this.GetY(y_avg));
  
}
