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
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  

  this.hist = null;
  this.ctl_wireimg_type =  GetBestControl(this.element,"[name=show-wireimg-type]");
    
  var self=this;
  gStateMachine.Bind('recordChange',  this.NewRecord.bind(this) ); 
  gStateMachine.Bind('zoomChange'    ,this.Change.bind(this) );
  gStateMachine.Bind('zoomChangeFast',this.Change.bind(this) );
  gStateMachine.Bind("TimeCutChange" ,this.Change.bind(this) );
  
}

TimeHistogram.prototype.Change = function()
{
  this.min_u = gZoomRegion.tdc[0];
  this.max_u = gZoomRegion.tdc[1];
  this.Draw();
}


TimeHistogram.prototype.NewRecord = function()
{
  this.show_image = $(this.ctl_wireimg_type).filter(":checked").val();  
  if(gRecord[this.show_image] && gRecord[this.show_image][gCurName[this.show_image]]) {
    var wiredesc = gRecord[this.show_image][gCurName[this.show_image]]; // e.g. gRecord.raw."recob::rawwire"
    this.hist = $.extend(true,new Histogram(1,0,1), wiredesc.timeHist);

    var cs = new ColorScaleIndexed(0);
    // Use this for testing out color schemes.
    // cs.colorScale = new HueColorScale(1.0,0.15);
    // cs.min = this.hist.min;
    // cs.max = this.hist.max;
    this.SetHist(this.hist,cs);
    this.ResetToHist(this.hist);
    this.bound_u_min = gRecord.header.TDCStart;
    this.bound_u_max = gRecord.header.TDCEnd;
    gZoomRegion.changeTimeRange(gRecord.header.TDCStart, gRecord.header.TDCEnd);
  } else {
    this.hist = new Histogram(32,0,3200);
    this.SetHist(this.hist,cs);
    this.ResetToHist(this.hist);      
  }  
  this.Draw();
}

TimeHistogram.prototype.FinishRangeChange = function()
{
  // Select our time window so it's compatible with the 
  // TDC bounds
  gZoomRegion.changeTimeRange( 
              Math.max(this.min_u, gRecord.header.TDCStart)
            , Math.min(this.max_u, gRecord.header.TDCEnd )
          );
  gStateMachine.Trigger("TimeCutChange");
}

TimeHistogram.prototype.FastRangeChange = function()
{
  // Select our time window so it's compatible with the 
  // TDC bounds
  gZoomRegion.changeTimeRange(
              Math.max(this.min_u, gRecord.header.TDCStart)
            , Math.min(this.max_u, gRecord.header.TDCEnd )
          );
  gStateMachine.Trigger("zoomChangeFast");
}
