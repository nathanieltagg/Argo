//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
gTimeCut = [0,3200];
gTimeHistogram = null;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-TimeHistogram').each(function(){
    var o = new TimeHistogram(this);
  });  
});


// Subclass of HistCanvas.
TimeHistogram.prototype = new HistCanvas();

function TimeHistogram( element  )
{
  gTimeHistogram = this;
  gWireInfo = this;
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
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj("hoverWireChange",this,"Draw");
  gStateMachine.BindObj('zoomChange',this,"Change");
  gStateMachine.BindObj('zoomChangeFast',this,"Change");
  gStateMachine.BindObj("TimeCutChange",this,"Change");
  
}

TimeHistogram.prototype.Change = function()
{
  this.min_u = gTimeCut[0];
  this.max_u = gTimeCut[1];
  this.Draw();
}


TimeHistogram.prototype.NewRecord = function()
{
  if(gRecord.cal && gRecord.cal.timeHist)
    this.hist = $.extend(true,new Histogram(1,0,1), gRecord.cal.timeHist);
  else if(gRecord.raw && gRecord.raw.timeHist)
    this.hist = $.extend(true,new Histogram(1,0,1), gRecord.raw.timeHist);
  this.SetHist(this.hist,new ColorScaleIndexed(0));
  this.ResetToHist(this.hist);
  this.bound_u_min = gRecord.header.TDCStart;
  this.bound_u_max = gRecord.header.TDCEnd;
  gTimeCut = [ gRecord.header.TDCStart, gRecord.header.TDCEnd ];
  
  this.Draw();
}

TimeHistogram.prototype.FinishRangeChange = function()
{
  // Select our time window so it's compatible with the 
  // TDC bounds
  gTimeCut = [ 
              Math.max(this.min_u, gRecord.header.TDCStart)
            , Math.min(this.max_u, gRecord.header.TDCEnd )
            ];
  gStateMachine.Trigger("TimeCutChange");
}
