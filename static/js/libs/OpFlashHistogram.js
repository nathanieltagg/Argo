//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpFlashHistogram = null;

var gOpFlashColorScaler = new ColorScaler("CurtColorPalette");
var gOpFlashCut = {min:-1e9, max:1e9};


// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpFlashHistogram').each(function(){
    gOpFlashHistogram = new OpFlashHistogram(this);
  });  
});


// Subclass of HistCanvas.
OpFlashHistogram.prototype = new HistCanvas();

function OpFlashHistogram( element  )
{
  this.element = element;
  var settings = {
    xlabel: "Time (µs)",
    ylabel: "Photoelectrons",
    tick_pixels_y: 40,
    margin_left: 60,
    log_y:false,
    min_u: 0,
    max_u: 500
  };
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  

  this.hist = new Histogram(10,0,100);
  
  this.blandColorScale = new ColorScaleRGB(220,220,220);
  
  var self=this;
  gStateMachine.BindObj('hoverChange',this,"HoverChange");
  gStateMachine.BindObj('opScaleChange',this,"Draw");

  this.input = "ophits"; 

  gStateMachine.Bind('change-ophits', this.NewRecord.bind(this) );
  
  this.ctl_histo_logscale= this.GetBestControl(".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.ResetAndDraw(); }); 
  
  gStateMachine.Bind('change-opflashes', this.NewRecord.bind(this) );
  
  
}



OpFlashHistogram.prototype.NewRecord = function()
{
  var tmin = 0;
  var tmax = -1e99;
  var flash;
  var listname = GetSelectedName("opflashes");
  
  if(gRecord.opflashes && gRecord.opflashes[listname] && gRecord.opflashes[listname].length>0) {
    var flashes = gRecord.opflashes[listname];

    this.xlabel = "PE";
    this.ylabel = "Flashes";
    for(var i=0;i<flashes.length;i++) {
      flash = flashes[i];
      if(flash.totPe>tmax) tmax = flash.totPe;
      if(flash.totPe<tmin) tmin = flash.totPe;
    }
    var width = tmax-tmin;
    // tmin -= width*0.05;
    tmax += width*0.05;
    var nbins = Math.floor(Math.min((tmax-tmin),100));
   
    this.hist = new Histogram(nbins,tmin,tmax);
    for(i=0;i<flashes.length;i++) {
      flash = flashes[i];
      this.hist.Fill(flash.totPe);
    }    
    // this.cs = new ColorScaleRGB(220,220,220);
    this.SetHist(this.hist,gOpFlashColorScaler);
    this.ResetToHist(this.hist);

    gOpFlashColorScaler.min = tmin;
    gOpFlashColorScaler.max = tmax;  
    gOpFlashCut.min = tmin;
    gOpFlashCut.max = tmax;
  
  } 
  this.Draw();

};


OpFlashHistogram.prototype.HoverChange = function()
{
  if(  (gHoverState.type == "opdet") ||
       (gHoverState.type == "opflash")||
       (gLastHoverState.type == "opdet") ||
       (gLastHoverState.type == "opflash") ) this.ResetAndDraw();
};


OpFlashHistogram.prototype.ResetAndDraw = function( )
{
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  // this.min_u = gOpFlashCut.min;
  // this.max_u = gOpFlashCut.max;

  this.Draw()
};

OpFlashHistogram.prototype.Draw = function()
{
  // this.min_u = gOpFlashCut.min;
  // this.max_u = gOpFlashCut.max;
  if(this.log_y) {
    this.min_v = 0.2;
    if(this.max_v<1) this.max_v = 1.1;
  }
  HistCanvas.prototype.Draw.call(this);  
}


OpFlashHistogram.prototype.ChangeRange = function( minu,maxu )
{
  gOpFlashColorScaler.min = minu;
  gOpFlashColorScaler.max = maxu;  
  
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
};

OpFlashHistogram.prototype.FinishRangeChange = function()
{
  // console.debug("PhHistCanvas::FinishRangeChange");
  gOpFlashCut.min = this.min_u;
  gOpFlashCut.max = this.max_u;

  gStateMachine.Trigger('opScaleChange');
};




