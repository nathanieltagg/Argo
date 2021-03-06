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
};




// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('#ctl-hit-color-scale').addClass("saveable").change(ChangeHitColorScale);
  gHitColorScaler = new ColorScaler("CurtColorPalette");    

  $('div.A-HitHistogram').each(function(){
    gHitHistogram = new HitHistogram(this);
  });  
});


function ChangeHitColorScale()
{
    var sel = $('#ctl-hit-color-scale option:selected').val();
    gHitColorScaler.SetScale(sel);
    gStateMachine.Trigger('hitChange');
}



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
  gStateMachine.Bind('newRecord',this.ResetAndBuild.bind(this));
  gStateMachine.Bind('hoverChange',this.HoverChange.bind(this));
  gStateMachine.Bind('hitChange',this.Draw.bind(this));
  
  // this.ctl_show_hits    =  this.GetBestControl(".show-hits");
  this.ctl_hit_field    =  this.GetBestControl(".hit-hist-field");
  this.ctl_cut_max      =  this.GetBestControl(".hit-cut-max");
  this.ctl_cut_min      =  this.GetBestControl(".hit-cut-min");
  
  gStateMachine.Bind('toggle-hits',this.Draw.bind(this)); //  $(this.ctl_show_hits   ).change(function(ev) { self.Draw(); });
  $(this.ctl_hit_field   ).change(function(ev) { this.blur(); return self.BuildHistogram(); });
  $(this.ctl_cut_max     ).change(function(ev) { this.blur(); return self.FinishRangeChange(); });
  $(this.ctl_cut_min     ).change(function(ev) { this.blur(); return self.FinishRangeChange(); });
  gStateMachine.Bind('change-hits',this.ResetAndBuild.bind(this));
  
  
  this.ctl_histo_logscale= this.GetBestControl(".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.Draw(); });
}

HitHistogram.prototype.ResetAndBuild = function()
{
  var sel = $('#ctl-hit-color-scale option:selected').val();
  gHitColorScaler.SetScale(sel);
  
  var hits = GetSelected('hits');

  // Get unique fields of an array.
  function unique(list) {
      var o = {}, i,j, l = list.length;
      for(i=0; i<l;i+=1) 
        for(j in list[i]) o[j] = j;
      return o;
  }

  var fields = unique(hits);
  $(this.ctl_hit_field ).empty();
  for(var i in fields) { 
    var name = i;
    $(this.ctl_hit_field ).append("<option value='"+i+"'>"+name+"</option>");
  }
 $(this.ctl_hit_field ).val("q");
 this.BuildHistogram();
};

HitHistogram.prototype.BuildHistogram = function()
{
  this.hist = null;
  var hits = GetSelected('hits');
  
  // Get list of 
  
  var field = $(this.ctl_hit_field).val();
  switch(field) {
    case "q":  this.hist = new Histogram(100,0,1000);  break;
    case "t":  this.hist = new Histogram(32,0,9600);  break;
    case "??t": this.hist = new Histogram(50,0,2);  break;
    case "??t": this.hist = new Histogram(50,0,50);  break;
    case "view": this.hist = new Histogram(3,0,3);  break;
    case "plane": this.hist = new Histogram(3,0,3);  break;
    case "wire": this.hist = new Histogram(100,0,4200);  break;
    case "m": this.hist = new Histogram(5,0,5);  break;
    default: 
     this.hist = new Histogram(5,0,5);  
  }
  
  var default_min = this.hist.min;
  var default_max = this.hist.max;
  
  for(var i=0;i<hits.length;i++) {
    var w = hits[i][field];
    this.hist.TwoSideExpandFill(w);
  }
  this.bound_u_min = this.hist.min;
  this.bound_u_max = this.hist.max;
  
  this.xlabel = $(this.ctl_hit_field).find(":selected").text();
  
  this.SetHist(this.hist,gHitColorScaler);
  this.ResetToHist(this.hist);
  this.min_u = default_min;
  this.max_u = default_max;

  gHitColorScaler.min = this.min_u;
  gHitColorScaler.max = this.max_u;    
  // gHitCut.min = this.min_u;
  // gHitCut.max = this.max_u;
  this.Draw();
  // gStateMachine.Trigger("hitChange");
};

HitHistogram.prototype.HoverChange = function( )
{
  if(gHoverState.type == "hit" || gLastHoverState.type == "hit") this.Draw();
};

HitHistogram.prototype.Draw = function( )
{
  // console.warn("HitHistogram::Draw()");
  var cs = gHitColorScaler;
  if(!$(this.GetBestControl('.show-hits')).is(":checked")) cs = this.blandColorScale;
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  
  if(this.hist) {
    if(gHoverState.type== "hit") {
      var hit = gHoverState.obj; 
      // new histogram 
      var val = hit[$(this.ctl_hit_field).val()];
      val = this.hist.GetX(this.hist.GetBin(val));
      this.highlight_hist = new Histogram(1,val,val + (this.hist.max-this.hist.min)/this.hist.n);
      this.highlight_hist.Fill(val);
      
      this.fNHist = 2;
      this.fHists = [this.hist,this.highlight_hist];
      this.fColorScales = [this.blandColorScale,cs];
      this.fHistOptions = [$.extend({},this.default_options),$.extend({},this.default_options)];       
    } else {
      this.fNHist = 1;
      this.fHists = [this.hist];
      this.fColorScales = [cs];
      this.fHistOptions = [$.extend({},this.default_options)];       
    }
  }
  
  HistCanvas.prototype.Draw.call(this);
  
};

HitHistogram.prototype.ChangeRange = function( minu,maxu )
{
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
  gHitColorScaler.min = this.min_u;
  gHitColorScaler.max = this.max_u;    
};


HitHistogram.prototype.FastRangeChange = function()
{
  gHitColorScaler.min = this.min_u;
  gHitColorScaler.max = this.max_u;    
};

HitHistogram.prototype.FinishRangeChange = function()
{
  // console.warn("HitHistogram::FinishRangeChange");
  gHitCut.field = $(this.ctl_hit_field).val();
  if($(this.ctl_cut_max).is(":checked"))   gHitCut.max = this.max_u;
  else gHitCut.max = 1e99;

  if($(this.ctl_cut_min).is(":checked"))   gHitCut.min = this.min_u;
  else gHitCut.min = -1e99;

  gStateMachine.Trigger('hitChange');
};




