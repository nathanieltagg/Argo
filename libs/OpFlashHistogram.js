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
  

  this.hist = new Histogram(10,0,5000);
  
  this.blandColorScale = new ColorScaleRGB(220,220,220);
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('hoverChange',this,"HoverChange");
  gStateMachine.BindObj('opScaleChange',this,"Draw");

  this.input = "ophits"; 

  
  this.ctl_histo_logscale= GetBestControl(this.element,".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.ResetAndDraw(); }); 
}



OpFlashHistogram.prototype.NewRecord = function()
{
  var tmin = 1e99;
  var tmax = -1e99;
  var flash;
  if(gOphitsListName && gRecord.opflashes[gOpflashesListName] && gRecord.opflashes[gOpflashesListName].length>0) {
    var flashes = gRecord.opflashes[gOpflashesListName];
    console.warn("flashes",flashes);

    this.xlabel = gOpMode.variableName;
    this.ylabel = gOpMode.flashWeightName;
    for(var i=0;i<flashes.length;i++) {
      flash = flashes[i];
      var totpe = 0;
      for(var j=0;j<flash.pePerOpDet.length;j++) totpe+= flash.pePerOpDet[j];
      flash.pe = totpe;
      var t = flash[gOpMode.flashVariable]*gOpMode.flashVariableScale;
      if(t>tmax) tmax = t;
      if(t<tmin) tmin = t;
    }
    var width = tmax-tmin;
    tmin -= width*0.05;
    tmax += width*0.05;
    var nbins = Math.floor((tmax-tmin),500);
    // console.error(nbins,tmin,tmax);
    while(nbins>800) nbins = Math.floor(nbins/2);
   
    this.hist = new Histogram(nbins,tmin,tmax);
    for(i=0;i<flashes.length;i++) {
      flash = flashes[i];
      if(gOpMode.flashWeight != 1)
        this.hist.Fill(flash[gOpMode.flashVariable]*gOpMode.flashVariableScale,flash[gOpMode.flashWeight]);
      else  
        this.hist.Fill(flash[gOpMode.flashVariable]*gOpMode.flashVariableScale);
    }    

  } 
  
  
  this.SetHist(this.hist,gOpColorScaler);
  this.ResetToHist(this.hist);

  gOpColorScaler.min = tmin;
  gOpColorScaler.max = tmax;  
  gOpMode.cut.min = tmin;
  gOpMode.cut.max = tmax;
  
  this.Draw();
};


OpFlashHistogram.prototype.HoverChange = function()
{
  if(  (gHoverState.type == "opdet") ||
       (gHoverState.type == "opflash")||
       (gHoverState.last.type == "opdet") ||
       (gHoverState.last.type == "opflash") ) this.ResetAndDraw();
};


OpFlashHistogram.prototype.ResetAndDraw = function( )
{
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  this.min_u = gOpMode.cut.min;
  this.max_u = gOpMode.cut.max;
  /*
  
  if(this.hist) {
    if(gHoverState.type == "opdet") {
      this.SetHist(this.hist,this.blandColorScale);
      // new histogram 
      this.highlight_hist = new Histogram(this.hist.n,this.hist.min,this.hist.max);
      
      if(this.input == "ophits") {
        var ophits = gRecord.ophits[gOphitsListName];
        for(var i=0;i<ophits.length;i++) {
          var oh = ophits[i];
          if(oh.opDetChan == gHoverState.obj.chan) {
            if(gOpMode.flashWeight != 1)
              this.highlight_hist.Fill(oh[gOpMode.flashVariable]*gOpMode.flashVariableScale,oh[gOpMode.flashWeight]);
            else  
              this.highlight_hist.Fill(oh[gOpMode.flashVariable]*gOpMode.flashVariableScale);          
          }
        }
      } else { // pulses
        
        var oppulses = gRecord.oppulses[gOpPulsesListName];      
        for(var i=0;i<oppulses.length;i++) {
          var p = oppulses[i];
          if(p.opDetChan == gHoverState.obj.chan) {
            for(var s = 0; s<p.waveform.length; s++) {
              var adc = p.waveform[s];
              if(adc>0) this.highlight_hist.Fill ( p.tdc + s, adc );
            }
          }
        }    
        
      
      }
      
      this.AddHist(this.highlight_hist,gOpColorScaler);        
      
    } else {
      this.SetHist(this.hist,gOpColorScaler);
    }
  }
    */
  this.Draw()
};

OpFlashHistogram.prototype.Draw = function()
{
  this.min_u = gOpMode.cut.min;
  this.max_u = gOpMode.cut.max;
  if(this.log_y) {
    this.min_v = 0.2;
    if(this.max_v<10) this.max_v = 10.1;
  }
  HistCanvas.prototype.Draw.call(this);  
}


OpFlashHistogram.prototype.ChangeRange = function( minu,maxu )
{
  gOpColorScaler.min = minu;
  gOpColorScaler.max = maxu;  
  gOpMode.cut.min = minu;
  gOpMode.cut.max = maxu;
  
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
};

OpFlashHistogram.prototype.FinishRangeChange = function()
{
  // console.debug("PhHistCanvas::FinishRangeChange");
  gOpMode.cut.min = this.min_u;
  gOpMode.cut.max = this.max_u;

  gStateMachine.Trigger('opScaleChange');
};




