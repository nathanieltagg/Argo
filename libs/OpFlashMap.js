//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpFlashMap = null;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpFlashMap').each(function(){
    gOpFlashMap = new OpFlashMap(this);
  });  
});


// Subclass of HistCanvas.
OpFlashMap.prototype = new ButtressedPad(null);

function OpFlashMap( element  )
{
  this.element = element;
  var settings = {
    log_y:false,
    buttress_min_u :     -50,    // cm
    buttress_max_u :  1090,
    buttress_min_v :  -150,
    buttress_max_v :   150
  };
  ButtressedPad.call(this, element, settings); // Give settings to Pad contructor.
    
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('opScaleChange',this,"Draw");
  
  this.opflashes = [];
  this.drawn_flashes = [];

  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });

}



OpFlashMap.prototype.NewRecord = function()
{
  this.OpFlashs = [];
  if(gOpflashesListName && gRecord.opflashes[gOpflashesListName] && gRecord.opflashes[gOpflashesListName].length>0) {
    this.opflashes = gRecord.opflashes[gOpflashesListName].slice(0); // Copy
  }
    // Sort hits by time, earliest last. 
   
  this.opflashes.sort(
    function(a,b){ return b.time - a.time;  }
  );
  
  this.Draw();
};

OpFlashMap.prototype.Draw = function()
{
  this.Clear();
  // this.DrawFrame();
  var x1 = this.GetX(0);
  var x2 = this.GetX(1040);
  var y1 = this.GetY(-118);
  var y2 = this.GetY(118);
  this.ctx.fillStyle = "rgba(0,0,0,0.2)";
  this.ctx.strokeStyle = "rgba(0,0,0,1)";
  this.ctx.beginPath();
  this.ctx.moveTo(x1,y1);
  this.ctx.lineTo(x1,y2);
  this.ctx.lineTo(x2,y2);
  this.ctx.lineTo(x2,y1);
  this.ctx.lineTo(x1,y1);
  this.ctx.stroke();
  
  var i, x,y,wx,wy,w,c, det;
  var w0,w1,w2;
  // Draw Flashes.
  this.drawn_flashes = [];
  for(i=0;i<this.opflashes.length;i++){
      var flash = this.opflashes[i];
      x = this.GetX(flash.zCenter);
      y = this.GetY(flash.yCenter);
      wx = Math.abs(this.GetX(flash.zCenter + flash.zWidth) - x);
      wy = Math.abs(this.GetY(flash.yCenter + flash.yWidth) - y);
      var t = flash[gOpMode.flashVariable]*gOpMode.flashVariableScale;
      if(t<gOpMode.cut.min) continue;
      if(t>gOpMode.cut.max) continue;

      w0 = flash.wireWidths[0];
      w1 = flash.wireWidths[1];
      w2 = flash.wireWidths[2];

      
      
      c = gOpColorScaler.GetColor(t);
      if(gHoverState.obj == flash) c = "0,0,0";
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.strokeStyle="rgba("+c+",1)";
      this.ctx.lineWidth = 2;
      this.ctx.moveTo(x,y);
      this.ctx.lineTo(this.GetX(flash.zCenter + gGeo.kU[0]*w0*0.3), this.GetY(flash.yCenter + gGeo.kU[1]*w0*0.3));
      this.ctx.moveTo(x,y);
      this.ctx.lineTo(this.GetX(flash.zCenter - gGeo.kU[0]*w0*0.3), this.GetY(flash.yCenter - gGeo.kU[1]*w0*0.3));

      this.ctx.moveTo(x,y);
      this.ctx.lineTo(this.GetX(flash.zCenter + gGeo.kV[0]*w1*0.3), this.GetY(flash.yCenter + gGeo.kV[1]*w1*0.3));
      this.ctx.moveTo(x,y);
      this.ctx.lineTo(this.GetX(flash.zCenter - gGeo.kV[0]*w1*0.3), this.GetY(flash.yCenter - gGeo.kV[1]*w1*0.3));

      this.ctx.moveTo(x,y);
      this.ctx.lineTo(this.GetX(flash.zCenter + w2*0.3), this.GetY(flash.yCenter));
      this.ctx.moveTo(x,y);
      this.ctx.lineTo(this.GetX(flash.zCenter - w2*0.3), this.GetY(flash.yCenter));

      this.ctx.stroke();
      this.ctx.restore();
      this.drawn_flashes.push(
        { flash: flash,
          x: x,
          y: y,
          wx: wx,
          wy: wy}
      );
      c = gOpColorScaler.GetColor(t);
      if(gHoverState.obj == flash) c = "0,0,0";
      var grad = this.ctx.createRadialGradient(0,0,0, 0,0,1);
      grad.addColorStop(0,   'rgba('+c+',1)'); // red
      grad.addColorStop(1,   'rgba('+c+',0)'); // Transparent
      this.ctx.save();
      this.ctx.translate(x,y);
      this.ctx.scale(wx,wy);
      this.ctx.beginPath();
      this.ctx.arc(0,0,1,0,Math.PI*1.999,false);
      this.ctx.fillStyle=grad;
      this.ctx.strokeStyle="#AAAAAA";
      this.ctx.lineWidth=1/wx;
      
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
      
  }
  
  this.pmtRadius = 15.2; // Size of the TPB Coating, according to the root geometry file.
  var r = this.pmtRadius * this.span_x/(this.max_u-this.min_u); // Radius in screen pixels.
  // Draw PMTs
  
  var dets = gGeo.opDets.opticalDetectors;
  this.ctx.strokeStyle = "black";
  for(i=0;i<dets.length;i++){
    det = dets[i];
    if(det == gHoverState.obj) { this.ctx.lineWidth = 2;} 
    else                       { this.ctx.lineWidth = 1;} 
    x = this.GetX(det.z);
    y = this.GetY(det.y);
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,Math.PI*1.999,false);
    this.ctx.stroke();
  }
  
};

OpFlashMap.prototype.DoMouse = function(ev)
{
  var offset = getAbsolutePosition(this.element);
  this.fMouseX = ev.pageX - offset.x;
  this.fMouseY = ev.pageY - offset.y; 
  this.fMouseU = this.GetU(this.fMouseX);
  this.fMouseV = this.GetV(this.fMouseY);
 
  var r2 = this.pmtRadius* this.pmtRadius;
  
  if(! this.fMouseInContentArea) return true; // keep bubbling, this isnt' for us.

  var dets = gGeo.opDets.opticalDetectors;
  var hoverdet = null;
  var i, det, dx,dy,d2, dr2;
  for(i=0;i<dets.length;i++){
    det = dets[i];
    dx = (det.z - this.fMouseU);
    dy = (det.y - this.fMouseV);
    d2 = dx*dx + dy*dy;
    if(d2<r2) hoverdet = det;
  }
  if(hoverdet){
     ChangeHover({obj: hoverdet, type: "opdet", collection: gGeo.opDets.opticalDetectors});
  } else {
    var hoverflash = null;
    for(i=0;i<this.drawn_flashes.length;i++) {
      var df = this.drawn_flashes[i];
      dx = (df.x - this.fMouseX)/df.wx;
      dy = (df.y - this.fMouseY)/df.wy;
      dr2 = dx*dx + dy*dy;
      if(dr2<1) hoverflash = df.flash;
    }
    if(hoverflash) {
      ChangeHover({obj: hoverflash, type: "opflash", collection: gRecord.opflashes});
    } else {
      ClearHover();
    }
  } 
  this.Draw();
};
