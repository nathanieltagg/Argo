//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpHit2dMap = null;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpHit2dMap').each(function(){
    gOpHit2dMap = new OpHit2dMap(this);
  });  
});


// Subclass of HistCanvas.
OpHit2dMap.prototype = new Pad(null);

function OpHit2dMap( element  )
{
  this.element = element;
  var settings = {
    log_y:false,
    min_u: 0,
    max_u: 32,
    min_v: 0,
    max_v: 24,
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 50,
    xlabel : "PMT Number",
    ylabel : "Time (us)",
  };
  Pad.call(this, element, settings); // Give settings to Pad contructor.
    
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('opScaleChange',this,"Draw");
  gStateMachine.BindObj('hoverChange',this,"HoverChange");
  
  this.ophits = [];
  this.drawn_flashes = [];

  $('#ctl-OpHitLists').change(function(ev) { return self.NewRecord(); });
  
  this.SetMagnify(true);
}



OpHit2dMap.prototype.NewRecord = function()
{
  this.ophits = [];
  var listname = $('#ctl-OpHitLists').val();
  if(gRecord.ophits && gRecord.ophits[listname]) {
    this.input = "ophits";
    this.ophits = gRecord.ophits[listname].slice(0); // Copy
  }
  this.ophits.sort(
    function(a,b){ return b.peakTime - a.peakTime;  }
  );
  
  if(this.ophits.length>0) {
    var t1 = this.ophits[this.ophits.length-1].peakTime*1e-3;
    var t2 = this.ophits[0].peakTime*1e-3;
    if(t2<24) t2=24;
    var dt = (t2-t1);
  
  
    this.min_v = t1 - dt*0.1
    this.max_v = t2;    
  }
  this.Draw();
};

OpHit2dMap.prototype.HoverChange = function()
{
  if(  (gHoverState.type == "opdet") ||
       (gHoverState.type == "opflash")||
       (gLastHoverState.type == "opdet") ||
       (gLastHoverState.type == "opflash") ) this.Draw();
};


OpHit2dMap.prototype.DrawOne = function()
{
  this.Clear();
  this.DrawFrame();
  
  // Draw OpHits
  for(i=0;i<this.ophits.length;i++) {
    var oh = this.ophits[i];
    w = oh[gOpMode.hitVariable]*gOpMode.hitVariableScale;
    if(w<gOpMode.cut.min) continue;
    if(w>gOpMode.cut.max) continue;
    if(oh.opDetChan<0) continue; // Bad channel number
    
    // det = gGeo.opDets.OpDetByChannel(oh.opDetChan);
    // if(!det) {
    //   console.warn("Couldn't find optical detector geometry for hit",oh);
    //   continue;
    // }
    x1 = this.GetX(oh.opDetChan%100);
    x2 = this.GetX((oh.opDetChan%100)+1);
    y1 = this.GetY(oh.peakTime * 1e-3);
    c = gOpColorScaler.GetColor(w);

    this.ctx.fillStyle= "rgba(" + c + ",0.5)";
    if(gHoverState.obj == gGeo.opDets.opticalDetectors[oh.opDetChan%100]) {
      this.ctx.fillStyle= "rgba(" + c + ",1)";
      
    }
    this.ctx.fillRect(x1,y1-2,x2-x1,4);
  }
  
  
};

OpHit2dMap.prototype.DoMouse = function(ev)
{
    if(! this.fMouseInContentArea) return true; // keep bubbling, this isnt' for us.
    
    var hoverdet = null;
    var opdet = Math.floor( this.fMousePos.u);
    if(opdet>=0 && opdet<this.max_u &&  this.fMousePos.v >= this.min_v) {
      var hoverdet = gGeo.opDets.opticalDetectors[opdet];
    }
    if(hoverdet) {
      ChangeHover({obj: hoverdet, type: "opdet", collection: gGeo.opDets.opticalDetectors});
    } else {
      ClearHover();      
    }

    return false;
};

//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpHit2dMapProjection = null;


// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpHit2dMapProjection').each(function(){
   gOpHit2dMapProjection = new OpHit2dMapProjection(this);
  });  
});


// Subclass of HistCanvas.
OpHit2dMapProjection.prototype = new HistCanvas();

function OpHit2dMapProjection( element  )
{
  this.element = element;
  var settings = {
    xlabel: "",
    ylabel: "",
    tick_pixels_y: 40,
    margin_left: 60,
    log_y:false,
    min_u: 0,
    max_u: 24,
    margin_left: 40,
    margin_bottom: 20,
    rotate_90: true
  };
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  
  var self = this;
  this.hist = new Histogram(50,0,24);
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  $('#ctl-OpFlashLists').change(function(ev) { return self.NewRecord(); });
  
  this.ctl_histo_logscale= GetBestControl(this.element,".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.ResetAndDraw(); }); 
}



OpHit2dMapProjection.prototype.NewRecord = function()
{
  
  this.ophits = [];
  var listname = $('#ctl-OpHitLists').val();
  if(gRecord.ophits && gRecord.ophits[listname]) {
    this.input = "ophits";
    this.ophits = gRecord.ophits[listname].slice(0); // Copy
  }
  this.ophits.sort(
    function(a,b){ return b.peakTime - a.peakTime;  }
  );
  
  if(this.ophits.length>0) {
    var t1 = this.ophits[this.ophits.length-1].peakTime*1e-3;
    var t2 = this.ophits[0].peakTime*1e-3;
    if(t2<24) t2=24;
    var dt = (t2-t1);
  
  
    this.min_u = t1 - dt*0.1
    this.max_u = t2;    
    this.hist = new Histogram(50,this.min_u,this.max_u);
    for(var i=0;i<this.ophits.length;i++) {
      var hit = this.ophits[i];
      this.hist.Fill(hit.peakTime*1e-3,hit.pe);
    }
    this.cs = new ColorScaleRGB(0,0,0);
    this.SetHist(this.hist,this.cs);
    this.ResetToHist(this.hist);
  }
  
  this.Draw();

};

OpHit2dMapProjection.prototype.ResetAndDraw = function( )
{
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  this.Draw()
};



