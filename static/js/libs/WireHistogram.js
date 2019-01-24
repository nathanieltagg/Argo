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
  var self=this;
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  
  this.hist = null;
  this.ctl_wireimg_type =  GetBestControl(this.element,"[name=show-wireimg-type]");

  this.ctl_histo_logscale= GetBestControl(this.element,".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.Draw(); }); 
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('zoomChange',this,"Change");
  gStateMachine.BindObj('zoomChangeFast',this,"Change");
}

WireHistogram.prototype.Change = function()
{  
  this.min_u = gZoomRegion.plane[this.plane][0];
  this.max_u = gZoomRegion.plane[this.plane][1];
  this.Draw();
};


WireHistogram.prototype.NewRecord = function()
{
  var hitsListName = $("#ctl-HitLists").val();
  this.show_image = $(this.ctl_wireimg_type).filter(":checked").val();  
  var wiredesc;
  if(hitsListName && gRecord.hit_hists && gRecord.hit_hists[hitsListName]) {
    
    wiredesc = gRecord.hit_hists[hitsListName]; // e.g. gRecord.raw."recob::rawwire"
    delete wiredesc._owner;
    this.hist = HistogramFrom(wiredesc.planeHists[this.plane]);
    this.SetHist(this.hist,new ColorScaleIndexed(0));
    this.ResetToHist(this.hist);
    this.bound_u_min = 0;
    this.bound_u_max = gGeo.numWires(this.plane);
    
  } 
  else  if(gRecord[this.show_image] && gRecord[this.show_image][gCurName[this.show_image]]) {    
    wiredesc = gRecord[this.show_image][gCurName[this.show_image]]; // e.g. gRecord.raw."recob::rawwire"
    this.hist = HistogramFrom(wiredesc.planeHists[this.plane]);
    this.SetHist(this.hist,new ColorScaleIndexed(0));
    this.ResetToHist(this.hist);
    this.bound_u_min = 0;
    this.bound_u_max = gGeo.numWires(this.plane);
  } else {
    this.hist = new Histogram(gGeo.numWires(this.plane),0,gGeo.numWires(this.plane));
    this.SetHist(this.hist,new ColorScaleIndexed(0));
    this.ResetToHist(this.hist);
  }
  
  this.Draw();
};

WireHistogram.prototype.FinishRangeChange = function()
{
  gZoomRegion.setLimits(this.plane,this.min_u,this.max_u);
  gStateMachine.Trigger("zoomChange");
};

WireHistogram.prototype.FastRangeChange = function()
{
  // Select our time window so it's compatible with the 
  // TDC bounds
  gZoomRegion.setLimits(this.plane,this.min_u,this.max_u);
  gStateMachine.Trigger("zoomChangeFast");
};

WireHistogram.prototype.Draw = function()
{
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  HistCanvas.prototype.Draw.call(this);
};
