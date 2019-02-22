//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpFlash2dMap = null;

var gOpTimeLimits = {min:0, max:0};

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpFlash2dMap').each(function(){
    gOpFlash2dMap = new OpFlash2dMap(this);
  });  
  
  
  $('#flashflex').resize(function(){
    console.warn("flashflex resizing");
    return true;
  })
});


// Subclass of HistCanvas.
OpFlash2dMap.prototype = new Pad(null);

function OpFlash2dMap( element  )
{
  this.element = element;
  var settings = {
    log_y:false,
    min_u: 0,
    max_u: 1050,
    min_v: 0,
    max_v: 24,
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 50,
    xlabel : "Reconstructed Z Position (cm)",
    ylabel : "Time (us)",
    mouse_scale_max_u  : true,
    mouse_scale_min_u  : true,
    mouse_scale_max_v  : true,
    mouse_scale_min_v  : true,
    mouse_pan_u        : true,
    mouse_pan_v        : true,
    
  };
  Pad.call(this, element, settings); // Give settings to Pad contructor.
    
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.Bind('opScaleChange',function(){self.min_v = gOpTimeLimits.min; self.max_v = gOpTimeLimits.max; self.Draw(); });
  
  this.opflashes = [];
  this.drawn_flashes = [];

  gStateMachine.Bind('change-opflashes', this.NewRecord.bind(this) );
  this.SetMagnify(true);
  
  this.hist = null;
  this.fMouseStart ={};

}



OpFlash2dMap.prototype.NewRecord = function()
{
  var listname = GetSelectedName("opflashes");
  
  if(gRecord && gRecord.opflashes && gRecord.opflashes[listname] && gRecord.opflashes[listname].length>0) {
    var flashes = gRecord.opflashes[listname];

    var t0 = 0;
    var t1 = 24;
    for(var i=0;i<flashes.length;i++) {
      var flash = flashes[i];
      if(flash.time<t0) t0 = flash.time;
      if(flash.time>t1) t1 = flash.time;
    }
    var dt = t1-t0;

    this.min_v = t0-0.1*dt;
    this.max_v = t1;
    gOpTimeLimits.min = this.min_v;
    gOpTimeLimits.max = this.max_v;    
  }
  this.Draw();
 };

OpFlash2dMap.prototype.DrawOne = function()
{
  this.Clear();
  this.DrawFrame();
  // Set clipping region for all further calls, just to make things simpler.
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.clip();


  var listname = GetSelectedName("opflashes");
  
  if(gRecord && gRecord.opflashes && gRecord.opflashes[listname] && gRecord.opflashes[listname].length>0) {
    var flashes = gRecord.opflashes[listname].slice(0);
  
    flashes.sort(
      function(a,b){ return a.totPe - b.totPe;  }
    );
    this.drawn_flashes = [];
    for(i=0;i<flashes.length;i++){
        var flash = flashes[i];
        var x0 = this.GetX(flash.zCenter);
        var dz = flash.zWidth;
        if(dz<25) dz = 25;
        var x1 = this.GetX(flash.zCenter - dz);
        var x2 = this.GetX(flash.zCenter + dz);
        var y1 = this.GetY(flash.time);
        var dy = y1-this.GetY(flash.timeWidth + flash.time);
        if(dy<4) dy = 4;
        var y2 = y1+dy;
        
        if(flash.totPe<gOpFlashCut.min) continue;
        if(flash.totPe>gOpFlashCut.max) continue;

        c = gOpFlashColorScaler.GetColor(flash.totPe);
        if(gHoverState.obj == flash) c = "0,0,0";
        this.ctx.fillStyle="rgba("+c+",1)";
        
        this.drawn_flashes.push({
          flash: flash,
          x1: x1,
          x2: x2,
          y1: y1,
          y2: y2          
        });
        this.ctx.fillRect(x1,y1,x2-x1,dy)
    }
  }
  this.ctx.restore();
};

OpFlash2dMap.prototype.DoMouse = function(ev)
{
  
  
  this.DoMousePanAndScale(ev);

  if(this.fMouseInContentArea) {
    var hoverflash = null;
    for(i=0;i<this.drawn_flashes.length;i++) {
      var df = this.drawn_flashes[i];
      if(this.fMousePos.x >= df.x1 && this.fMousePos.x <= df.x2 && this.fMousePos.y >= df.y1 && this.fMousePos.y <= df.y2) {
        hoverflash = df.flash;
      }
    }
    if(hoverflash) {
      ChangeHover({obj: hoverflash, type: "opflash", collection: gRecord.opflashes});
      if(ev.type=="click") {
        // zoom to area this flash might be good:
        var tf = hoverflash.time;
        // The event could be at this time, or come up to one detector-width later.
        var t1 = tf * 2; // 2 TDC = 1 us
        var dx = 128.175*2;  // detector width in cm
        var t2 = t1+dx/gGeo.drift_cm_per_tick;
          
        var dz = hoverflash.zWidth;
        if(dz<100) dz = 100;
        var z1 = hoverflash.zCenter - dz;
        var z2 = hoverflash.zCenter + dz;
        var w1 = gGeo.yzToWire(2,0,z1);
        var w2 = gGeo.yzToWire(2,0,z2);

        console.warn("Attempting to zoom to flash",hoverflash,"in TPC at tdc=",t1,t2,"wire=",(w2+w1)*0.5);
        gZoomRegion.setLimits(2,w1,w2);
        gZoomRegion.changeTimeRange(t1,t2);
        gStateMachine.Trigger("zoomChange");
               
      }
    } else {
      ClearHover();
    }
  }




};

OpFlash2dMap.prototype.MouseChangedUV = function( new_limits, finished ) 
{
  // Override this function to do things when the limits change.
  // example newlimits = { min_v: 90, max_v: 45  } means u coordinates haven't changed, but min and max have
  // 'finished' is true if user has finished dragging the mouse and the mouseup has fired; otherwise she's in the middle of a drag operation.
  $.extend(this,new_limits);
  if(finished) {
    gOpTimeLimits.min = this.min_v;
    gOpTimeLimits.max = this.max_v;
    gStateMachine.Trigger("opScaleChange");    
  }
  this.Draw();
}


//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpFlash2dMapProjection = null;


// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpFlash2dMapProjection').each(function(){
   gOpFlash2dMapProjection = new OpFlash2dMapProjection(this);
  });  
});


// Subclass of HistCanvas.
OpFlash2dMapProjection.prototype = new HistCanvas();

function OpFlash2dMapProjection( element  )
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
    rotate_90: true,
    log_y: true
  };
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  

  this.hist = new Histogram(50,0,24);
  var self= this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.Bind('opScaleChange',function(){self.ChangeRange(gOpTimeLimits.min,gOpTimeLimits.max); });
  gStateMachine.Bind('change-opflashes', this.NewRecord.bind(this) );
}



OpFlash2dMapProjection.prototype.NewRecord = function()
{
  
  var listname = GetSelectedName("opflashes");
  
  if(gRecord && gRecord.opflashes && gRecord.opflashes[listname] && gRecord.opflashes[listname].length>0) {
    var flashes = gRecord.opflashes[listname];

    var t0 = 0;
    var t1 = 24;
    for(var i=0;i<flashes.length;i++) {
      var flash = flashes[i];
      if(flash.time<t0) t0 = flash.time;
      if(flash.time>t1) t1 = flash.time;
    }
    var dt = t1-t0;

    this.min_u = t0-0.1*dt;
    this.max_u = t1;
    this.hist = new Histogram(50,this.min_u,this.max_u); // Make sure this matches code above.

    for(var i=0;i<flashes.length;i++) {
      var flash = flashes[i];
      this.hist.Fill(flash.time,flash.totPe);
    }
    this.cs = new ColorScaleRGB(0,0,0);
    this.SetHist(this.hist,this.cs);
    this.ResetToHist(this.hist);
  }
  
  this.Draw();

};

OpFlash2dMapProjection.prototype.ResetAndDraw = function( )
{
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
  this.Draw()
};

OpFlash2dMapProjection.prototype.ChangeRange = function( minu,maxu )
{
  gOpTimeLimits.min = minu;
  gOpTimeLimits.max = maxu;
   
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
};

OpFlash2dMapProjection.prototype.FinishRangeChange = function()
{
  gOpTimeLimits.min = this.min_u;
  gOpTimeLimits.max = this.max_u;

  gStateMachine.Trigger('opScaleChange');
};



