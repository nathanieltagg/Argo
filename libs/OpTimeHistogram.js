//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpTimeHistogram = null;
var gOpDetColorScaler = new ColorScaler("CurtColorPalette");
var gOpDetMode = {
  variable      : "peakTime",
  variableScale : 1/1000.,
  variableName  : "Time (µs)",
  cut           : {min: -1e99, max: 1e99},
  weight        : "pe",
  weightName    : "Photoelectrons",
  
}




// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpTimeHistogram').each(function(){
    gOpTimeHistogram = new OpTimeHistogram(this);
  });  
});


// Subclass of HistCanvas.
OpTimeHistogram.prototype = new HistCanvas();

function OpTimeHistogram( element  )
{
  this.element = element;
  var settings = {
    xlabel: "Time (µs)",
    ylabel: "Photoelectrons",
    tick_pixels_y: 80,
    margin_left: 60,
    log_y:false,
    min_u: 0,
    max_u: 500
  };
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  

  this.hist = new Histogram(10,0,5000);
  
  this.blandColorScale = new ColorScaleRGB(220,220,220);
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('hoverChange_opdet',this,"Draw");
  
}



OpTimeHistogram.prototype.NewRecord = function()
{
  this.hist = null;
  this.xlabel = gOpDetMode.variableName;
  this.ylabel = gOpDetMode.weightName;
  if(!gRecord.ophits) return;
  var ophits = gRecord.ophits[gOphitsListName];
  if(!ophits) return; // Zero-length.
  if(ophits.length==0) return;
  // First run through to get limits.
  var tmin = 1e99;
  var tmax = -1e99;
  for(var i=0;i<ophits.length;i++) {
    var oh = ophits[i];
    var t = oh[gOpDetMode.variable]*gOpDetMode.variableScale;
    if(t>tmax) tmax = t;
    if(t<tmin) tmin = t;
  }
  var width = tmax-tmin;
  tmin -= width*0.05;
  tmax += width*0.05;
  var nbins = Math.floor((tmax-tmin));
  while(nbins>100) nbins = Math.floor(nbins/2);
  
  this.hist = new Histogram(nbins,tmin,tmax);
  for(var i=0;i<ophits.length;i++) {
    var oh = ophits[i];
    if(gOpDetMode.weight != 1)
      this.hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale,oh[gOpDetMode.weight]);
    else  
      this.hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale);
  }
  
  this.SetHist(this.hist,gOpDetColorScaler);
  this.ResetToHist(this.hist);

  gOpDetColorScaler.min = tmin;
  gOpDetColorScaler.max = tmax;  
  gOpDetMode.cut.min = tmin;
  gOpDetMode.cut.max = tmax;
  
  this.Draw();
}


OpTimeHistogram.prototype.Draw = function( )
{
  if(this.hist) {
    if(gHoverState.type == "opdet") {
      var ophits = gRecord.ophits[gOphitsListName];
      this.SetHist(this.hist,this.blandColorScale);
      // new histogram 
      this.highlight_hist = new Histogram(this.hist.n,this.hist.min,this.hist.max);
      for(var i=0;i<ophits.length;i++) {
        var oh = ophits[i];
        if(oh.opDetChan == gHoverState.obj.chan) {
          if(gOpDetMode.weight != 1)
            this.highlight_hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale,oh[gOpDetMode.weight]);
          else  
            this.highlight_hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale);          
        }
      }
      this.AddHist(this.highlight_hist,gOpDetColorScaler);
      
    } else {
      this.SetHist(this.hist,gOpDetColorScaler);
    }
  }
  
  HistCanvas.prototype.Draw.call(this);
  
}

OpTimeHistogram.prototype.ChangeRange = function( minu,maxu )
{
  gOpDetColorScaler.min = minu;
  gOpDetColorScaler.max = maxu;  
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
}

OpTimeHistogram.prototype.FinishRangeChange = function()
{
  // console.debug("PhHistCanvas::FinishRangeChange");
  gOpDetMode.cut.min = this.min_u;
  gOpDetMode.cut.max = this.max_u;

  gStateMachine.Trigger('opHitScaleChange')
}



