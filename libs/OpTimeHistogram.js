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
  variableScale : 1,
  variableName  : "Time (µs)",
  cut           : {min: -1e99, max: 1e99},
  weight        : "pe",
  weightName    : "Photoelectrons",
  
};




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
    tick_pixels_y: 40,
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
  gStateMachine.BindObj('hoverChange',this,"HoverChange");
  this.input = "ophits"; 

  
  this.ctl_histo_logscale= GetBestControl(this.element,".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.Draw(); }); 
}



OpTimeHistogram.prototype.NewRecord = function()
{
  var tmin = 1e99;
  var tmax = -1e99;
  var i, width, nbins, p;
  if(gOphitsListName && gRecord.ophits[gOphitsListName] && gRecord.ophits[gOphitsListName].length>0) {
    this.input = "ophits"; 

    this.xlabel = gOpDetMode.variableName;
    this.ylabel = gOpDetMode.weightName;
    var ophits = gRecord.ophits[gOphitsListName];
    if(!ophits) return; // Zero-length.
    if(ophits.length===0) return;
    // First run through to get limits.
    var  oh;
    tmin = 1e99;
    tmax = -1e99;
    for(i=0;i<ophits.length;i++) {
      oh = ophits[i];
      var t = oh[gOpDetMode.variable]*gOpDetMode.variableScale;
      if(t>tmax) tmax = t;
      if(t<tmin) tmin = t;
    }
    width = tmax-tmin;
    tmin -= width*0.05;
    tmax += width*0.05;
    nbins = Math.floor((tmax-tmin));
    // console.error(nbins,tmin,tmax);
    while(nbins>100) nbins = Math.floor(nbins/2);
  
    this.hist = new Histogram(nbins,tmin,tmax);
    for(i=0;i<ophits.length;i++) {
      oh = ophits[i];
      if(gOpDetMode.weight !== 1)
        this.hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale,oh[gOpDetMode.weight]);
      else  
        this.hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale);
    }    

  } else if (gOpPulsesListName) {
    this.input = "oppulses"; 
    
    this.xlabel = "TDC";
    this.ylabel = "Pulse";
    var oppulses = gRecord.oppulses[gOpPulsesListName];
    if(!oppulses) return; // Zero-length.
    if(oppulses.length===0) return;
    gOpDetMode.variable = "peakTime";
    gOpDetMode.variableScale = 1;
    // First run through to get limits.
    tmin = 1e99;
    tmax = -1e99;
    for(i=0;i<oppulses.length;i++) {
      p = oppulses[i];
      var t1 = p.tdc;
      if(t1<tmin) tmin = t1;
      var t2 = t1 + p.samples;
      if(t2 > tmax) tmax = t2;
    }
    width = tmax-tmin;
    tmin -= width*0.05;
    tmax += width*0.05;
    nbins = Math.floor((tmax-tmin));
    while(nbins>200) nbins = Math.floor(nbins/2);
    this.hist = new Histogram(nbins,tmin,tmax);
    for(i=0;i<oppulses.length;i++) {
      p = oppulses[i];
      for(var s = 0; s<p.waveform.length; s++) {
        var adc = p.waveform[s];
        if(adc>0) this.hist.Fill ( p.tdc + s, adc );
      }
    }    
    
  }
  
  
  this.SetHist(this.hist,gOpDetColorScaler);
  this.ResetToHist(this.hist);

  gOpDetColorScaler.min = tmin;
  gOpDetColorScaler.max = tmax;  
  gOpDetMode.cut.min = tmin;
  gOpDetMode.cut.max = tmax;
  
  this.Draw();
};

OpTimeHistogram.prototype.HoverChange = function()
{
  if(  (gHoverState.type == "opdet")  ||
       (gHoverState.type == "opflash") ||
       (gHoverState.last.type == "opdet")  ||
       (gHoverState.last.type == "opflash") ) this.Draw();
};


OpTimeHistogram.prototype.Draw = function( )
{
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  
  var i;
  if(this.hist) {
    if(gHoverState.type == "opdet") {
      this.SetHist(this.hist,this.blandColorScale);
      // new histogram 
      this.highlight_hist = new Histogram(this.hist.n,this.hist.min,this.hist.max);
      
      if(this.input == "ophits" && gRecord.ophits && gRecord.ophits[gOphitsListName] && gRecord.ophits[gOphitsListName].length) {
        var ophits = gRecord.ophits[gOphitsListName];
        for(i=0;i<ophits.length;i++) {
          var oh = ophits[i];
          if(oh.opDetChan == gHoverState.obj.chan) {
            if(gOpDetMode.weight != 1)
              this.highlight_hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale,oh[gOpDetMode.weight]);
            else  
              this.highlight_hist.Fill(oh[gOpDetMode.variable]*gOpDetMode.variableScale);          
          }
        }
      } else { // pulses
        
        var oppulses = gRecord.oppulses[gOpPulsesListName];      
        if(oppulses && oppulses.length) {
          for(i=0;i<oppulses.length;i++) {
            var p = oppulses[i];
            if(p.opDetChan == gHoverState.obj.chan) {
              for(var s = 0; s<p.waveform.length; s++) {
                var adc = p.waveform[s];
                if(adc>0) this.highlight_hist.Fill ( p.tdc + s, adc );
              }
            }
          }    
        }
      }
      
      this.AddHist(this.highlight_hist,gOpDetColorScaler);        
      
    } else {
      this.SetHist(this.hist,gOpDetColorScaler);
    }
  }
  
  HistCanvas.prototype.Draw.call(this);
  
};

OpTimeHistogram.prototype.ChangeRange = function( minu,maxu )
{
  gOpDetColorScaler.min = minu;
  gOpDetColorScaler.max = maxu;  
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
};

OpTimeHistogram.prototype.FinishRangeChange = function()
{
  // console.debug("PhHistCanvas::FinishRangeChange");
  gOpDetMode.cut.min = this.min_u;
  gOpDetMode.cut.max = this.max_u;

  gStateMachine.Trigger('opHitScaleChange');
};




