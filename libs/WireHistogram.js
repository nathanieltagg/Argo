//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

gWireHistograms = [];

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireHistogram').each(function(){
    gWireHistograms.push(new WireHistogram(this));
  });  
});


// Subclass of HistCanvas.
WireHistogram.prototype = new HistCanvas();

function WireHistogram( element  )
{
  this.element = element;
  var settings = {
    xlabel: "Wire",
    ylabel: "ADCs",    
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 30,
    label_font    : "10px sans-serif",

    tick_pixels_y: 20,
    log_y:true
  };
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  
  this.hist = null;
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('zoomChange',this,"Change");
  gStateMachine.BindObj('zoomChangeFast',this,"Change");
}

WireHistogram.prototype.Change = function()
{
  
  this.min_u = gZoomRegion.plane[this.plane][0];
  this.max_u = gZoomRegion.plane[this.plane][1];
  this.Draw();
}


WireHistogram.prototype.NewRecord = function()
{
  if(gRecord.cal && gRecord.cal.planeHists)
    this.hist = $.extend(true,new Histogram(1,0,1), gRecord.cal.planeHists[this.plane]);
  else if(gRecord.raw && gRecord.raw.planeHists)
    this.hist = $.extend(true,new Histogram(1,0,1), gRecord.raw.planeHists[this.plane]);
  this.SetHist(this.hist,new ColorScaleIndexed(0));
  this.ResetToHist(this.hist);
  this.bound_u_min = 0;
  this.bound_u_max = gGeo.numWires(this.plane);
  
  this.Draw();
}

WireHistogram.prototype.FinishRangeChange = function()
{
  gZoomRegion.setLimits(this.plane,this.min_u,this.max_u);
  gStateMachine.Trigger("zoomChange");
}

WireHistogram.prototype.FastRangeChange = function()
{
  // Select our time window so it's compatible with the 
  // TDC bounds
  gZoomRegion.setLimits(this.plane,this.min_u,this.max_u);
  gStateMachine.Trigger("zoomChangeFast");
}
