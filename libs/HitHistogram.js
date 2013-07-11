//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gHitHistogram = null;
var gHitColorScaler = new ColorScaler("CurtColorPalette");
var gHitCut = {
  field: "q",
  min: -1e99,
  max: 1e99
}




// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-HitHistogram').each(function(){
    gHitHistogram = new HitHistogram(this);
  });  
});


// Subclass of HistCanvas.
HitHistogram.prototype = new HistCanvas();

function HitHistogram( element  )
{
  this.element = element;
  var settings = {
    label_font: "10pt",
    xlabel: "Charge",
    ylabel: "Hits",
    tick_pixels_y: 15,
    margin_left: 42,
    margin_bottom: 30,
    log_y:true,
    min_u: 0,
    max_u: 500
  };
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  
  this.blandColorScale = new ColorScaleRGB(220,220,220);

  this.hist = new Histogram(10,0,5000);  
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('hoverChange',this,"HoverChange");
  
  this.ctl_show_hits    =  GetBestControl(this.element,".show-hits");
  this.ctl_hit_field    =  GetBestControl(this.element,".hit-hist-field");
  
  $(this.ctl_show_hits   ).change(function(ev) { self.Draw(); });
  $(this.ctl_hit_field   ).change(function(ev) { this.blur(); return self.NewRecord(); });
  
}



HitHistogram.prototype.NewRecord = function()
{
  this.hist = null;
  if(!gHitsListName) return;
  var hits = gRecord.hits[gHitsListName];
  var field = $(this.ctl_hit_field).val();
  switch(field) {
    case "q":  this.hist = new Histogram(20,0,2000);  break;
    case "t":  this.hist = new Histogram(32,0,3200);  break;
    case "σt": this.hist = new Histogram(50,0,2);  break;
    case "σt": this.hist = new Histogram(50,0,50);  break;
    case "view": this.hist = new Histogram(3,0,3);  break;
    case "plane": this.hist = new Histogram(3,0,3);  break;
    case "wire": this.hist = new Histogram(100,0,4200);  break;
    case "m": this.hist = new Histogram(5,0,5);  break;
    default: 
     this.hist = new Histogram(50,0,5000);  
  }
  
  for(var i=0;i<hits.length;i++) {
    var w = hits[i][field];
    this.hist.ExpandFill(w);
  }
  
  this.xlabel = $(this.ctl_hit_field).find(":selected").text();
  
  this.SetHist(this.hist,gHitColorScaler);
  this.ResetToHist(this.hist);

  gHitColorScaler.min = this.hist.min;
  gHitColorScaler.max = this.hist.max;  
  
  this.Draw();
}

HitHistogram.prototype.HoverChange = function( )
{
  if(gHoverState.type == "hit" || gHoverState.last.type == "hit") this.Draw();
}

HitHistogram.prototype.Draw = function( )
{
  var cs = gHitColorScaler;
  if(!$(this.ctl_show_hits).is(":checked")) cs = this.blandColorScale;
  if(this.hist) {
    if(gHoverState.type == "hit") {
      var hit = gHoverState.obj; 
      this.SetHist(this.hist,this.blandColorScale);
      // new histogram 
      var val = hit[$(this.ctl_hit_field).val()];
      val = this.hist.GetX(this.hist.GetBin(val));
      this.highlight_hist = new Histogram(1,val,val + (this.hist.max-this.hist.min)/this.hist.n);
      this.highlight_hist.Fill(val);
      this.AddHist(this.highlight_hist,cs);     
       
    } else {
      this.SetHist(this.hist,cs);
    }
  }
  
  HistCanvas.prototype.Draw.call(this);
  
}

HitHistogram.prototype.ChangeRange = function( minu,maxu )
{
  gHitColorScaler.min = minu;
  gHitColorScaler.max = maxu;  
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
}

HitHistogram.prototype.FinishRangeChange = function()
{
  // console.debug("PhHistCanvas::FinishRangeChange");
  gHitCut.field = $(this.ctl_hit_field).val();
  gHitCut.min = this.min_u;
  gHitCut.max = this.max_u;

  gStateMachine.Trigger('hitChange')
}




