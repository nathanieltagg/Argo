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

var gOpFlashTimeLimits = {min:0, max:0};

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
  gStateMachine.Bind('opScaleChange',function(){self.min_v = gOpFlashTimeLimits.min; self.max_v = gOpFlashTimeLimits.max; self.Draw(); });
  
  this.opflashes = [];
  this.drawn_flashes = [];

  $('#ctl-OpFlashLists').change(function(ev) { return self.NewRecord(); });
  this.SetMagnify(true);
  
  this.hist = null;
  this.fMouseStart ={};

}



OpFlash2dMap.prototype.NewRecord = function()
{
  // var listname = $('#ctl-OpFlashLists').val();
  //
  // if(gRecord.opflashes && gRecord.opflashes[listname] && gRecord.opflashes[listname].length>0) {
  //   this.opflashes = gRecord.opflashes[listname].slice(0)
  // }
  //
  // // Sort to draw the good ones on top
  // this.opflashes.sort(
  //   function(a,b){ return a.totPe - b.totPe;  }
  // );
  //
  var listname = $('#ctl-OpFlashLists').val();
  
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
    gOpFlashTimeLimits.min = this.min_v;
    gOpFlashTimeLimits.max = this.max_v;    
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


  var listname = $('#ctl-OpFlashLists').val();
  
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
  
  //
  //
  // // First, deal with mouse-ups that are probably outside my region.
  // if(ev.type === 'mouseenter') return; // dont need to deal with this.
  // if(ev.type === 'mouseout') return;   // dont need to deal with this.
  //
  // if(ev.type === 'mouseup') {
  //   if( this.fDragging) {
  //     this.fDragging = false;
  //     // Update thorough
  //     gOpFlashTimeLimits.min = this.min_v;
  //     gOpFlashTimeLimits.max = this.max_v;
  //     gStateMachine.Trigger("opScaleChange");
  //     this.dirty = false;
  //     // Draw gets issued by the trigger.
  //   }
  //   return;
  // }
  //
  // ev.originalEvent.preventDefault();
  //
  // // Which area is mouse start in?
  // var mouse_area;
  // if(this.fMousePos.y > this.origin_y ) {
  //   if(this.fMousePos.x> (this.origin_x + this.span_x/2)) mouse_area = "xscale-right";
  //   else                                                 mouse_area = "xscale-left";
  // } else if(this.fMousePos.x < this.origin_x) {
  //   if(this.fMousePos.y < (this.origin_y - this.span_y/2)) mouse_area = "yscale-up";
  //   else                                                   mouse_area = "yscale-down";
  // } else {
  //   mouse_area = "body";
  // }
  // // Change cursor.
  // switch(mouse_area) {
  //   case "body":         this.canvas.style.cursor = "move";      break;
  //   case "xscale-right": this.canvas.style.cursor = "e-resize";  break;
  //   case "xscale-left":  this.canvas.style.cursor = "w-resize";  break;
  //   case "yscale-up":    this.canvas.style.cursor = "n-resize"; break;
  //   case "yscale-down":  this.canvas.style.cursor = "s-resize"; break;
  // }
  //
  // var relx, rely;
  // if(this.fDragging) {
  //     // Update new zoom position or extent...
  //   if(this.fMouseStart.area == "body"){
  //     var dx = this.fMousePos.x - this.fMouseLast.x;
  //     var du = dx * (this.max_u-this.min_u)/(this.span_x);
  //
  //     // Set limits.
  //     this.min_u -= du;
  //     this.max_u -= du;
  //
  //     var dy = this.fMousePos.y - this.fMouseLast.y;
  //     var dv = dy * (this.max_v-this.min_v)/(this.span_y);
  //
  //     this.min_v += dv;
  //     this.max_v += dv;
  //
  //     this.fMouseLast = {};
  //     $.extend(this.fMouseLast,this.fMousePos); // copy.
  //
  //   } else if(this.fMouseStart.area == "xscale-right") {
  //     relx = this.fMousePos.x - this.origin_x;
  //     if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
  //     // Want the T I started at to move to the current posistion by scaling.
  //     var new_max_u = this.span_x * (this.fMouseStart.u-this.min_u)/relx + this.min_u;
  //     this.max_u = new_max_u;
  //
  //   } else if(this.fMouseStart.area == "xscale-left") {
  //     relx = this.origin_x + this.span_x - this.fMousePos.x;
  //     if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
  //     var new_min_u = this.max_u - this.span_x * (this.max_u - this.fMouseStart.u)/relx;
  //     this.min_u = new_min_u;
  //
  //   } else if(this.fMouseStart.area == "yscale-up") {
  //     rely =  this.origin_y - this.fMousePos.y;
  //     if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
  //     var new_max_v = this.span_y * (this.fMouseStart.v-this.min_v)/rely + this.min_v;
  //     this.max_v = new_max_v;
  //
  //   }else if(this.fMouseStart.area == "yscale-down") {
  //     rely =  this.fMousePos.y - (this.origin_y - this.span_y);
  //     if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
  //     var new_min_v = this.max_v - this.span_y * (this.max_v-this.fMouseStart.v)/rely;
  //     this.min_v = new_min_v;
  //   }
  //   this.dirty = true;
  // }
  //
  // if(ev.type === 'mousedown' && this.fMouseInContentArea) {
  //   // Check to see if object is draggable, instead of the view.
  //   this.fMouseStart= $.extend({},this.fMousePos); // copy.
  //   this.fMouseLast = $.extend({},this.fMousePos); // copy.
  //   this.fMouseStart.area = mouse_area;
  //
  //   this.fDragging = true;
  // }
  //
  //
  //
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
    gOpFlashTimeLimits.min = this.min_v;
    gOpFlashTimeLimits.max = this.max_v;
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
  gStateMachine.Bind('opScaleChange',function(){self.ChangeRange(gOpFlashTimeLimits.min,gOpFlashTimeLimits.max); });
  $('#ctl-OpFlashLists').change(function(ev) { return self.NewRecord(); });
}



OpFlash2dMapProjection.prototype.NewRecord = function()
{
  
  var listname = $('#ctl-OpFlashLists').val();
  
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
  gOpFlashTimeLimits.min = minu;
  gOpFlashTimeLimits.max = maxu;
   
  HistCanvas.prototype.ChangeRange.call(this,minu,maxu);
};

OpFlash2dMapProjection.prototype.FinishRangeChange = function()
{
  gOpFlashTimeLimits.min = this.min_u;
  gOpFlashTimeLimits.max = this.max_u;

  gStateMachine.Trigger('opScaleChange');
};



