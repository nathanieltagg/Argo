//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
gTimeHistogram = null;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-TimeHistogram').each(function(){
    gTimeHistogram = new TimeHistogram(this);
  });  
});


// Subclass of HistCanvas.
TimeHistogram.prototype = new HistCanvas();

function TimeHistogram( element  )
{
  this.element = element;
  var settings = {
    xlabel: "Time (TDC)",
    ylabel: "ADCs/tick",
    tick_pixels_y: 20,
    margin_left: 60,
    log_y:true
  };
  var self=this;
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  

  this.hist = null;
  this.ctl_wireimg_type =  this.GetBestControl("[name=show-wireimg-type]");
  
  this.ctl_histo_logscale= this.GetBestControl(".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.Draw(); }); 
    
  gStateMachine.Bind('change-hits',  this.NewRecord.bind(this) ); 
  gStateMachine.Bind('zoomChange'    ,this.Change.bind(this) );
  gStateMachine.Bind('zoomChangeFast',this.Change.bind(this) );
  gStateMachine.Bind("TimeCutChange" ,this.Change.bind(this) );
  
}

TimeHistogram.prototype.Change = function()
{
  this.min_u = gZoomRegion.tdc[0];
  this.max_u = gZoomRegion.tdc[1];
  this.Draw();
};


TimeHistogram.prototype.NewRecord = function()
{
  var hitsListName = GetSelectedName("hits");
  var wiredec;
  var cs = new ColorScaleIndexed(0);
  
  this.show_image = $(this.ctl_wireimg_type).filter(":checked").val();  
  if(hitsListName && gRecord.hit_hists && gRecord.hit_hists[hitsListName]) {
    wiredesc = gRecord.hit_hists[hitsListName].timeHist; 
    this.hist = HistogramFrom(wiredesc);
    this.SetHist(this.hist,new ColorScaleIndexed(0));
    this.bound_u_min = this.hist.min;
    this.bound_u_max = this.hist.max;
    gZoomRegion.changeTimeRange(0,9600);
     
  } 
  else if(gRecord[this.show_image] && gRecord[this.show_image][gCurName[this.show_image]]) {
    wiredesc = gRecord[this.show_image][gCurName[this.show_image]]; // e.g. gRecord.raw."recob::rawwire"
    this.hist = HistogramFrom(wiredesc.timeHist);

    // Use this for testing out color schemes.
    // cs.colorScale = new HueColorScale(1.0,0.15);
    // cs.min = this.hist.min;
    // cs.max = this.hist.max;
    this.SetHist(this.hist,cs);
    this.ResetToHist(this.hist);
    this.bound_u_min = this.hist.min;
    this.bound_u_max = this.hist.max;
    gZoomRegion.changeTimeRange(0,9600);
  } else {
    this.hist = new Histogram(32,0,9600);
    this.SetHist(this.hist,cs);
    this.ResetToHist(this.hist);      
  }  
  this.Draw();
};

TimeHistogram.prototype.FinishRangeChange = function()
{
  // Select our time window so it's compatible with the 
  // TDC bounds
  gZoomRegion.changeTimeRange(
              this.min_u, 
              this.max_u
          );
  gStateMachine.Trigger("TimeCutChange");
};

TimeHistogram.prototype.FastRangeChange = function()
{
  // Select our time window so it's compatible with the 
  // TDC bounds
  gZoomRegion.changeTimeRange(
              this.min_u,
              this.max_u
          );
  gStateMachine.Trigger("zoomChangeFast");
};


TimeHistogram.prototype.Draw = function()
{
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  HistCanvas.prototype.Draw.call(this);
};