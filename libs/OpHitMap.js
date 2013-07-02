//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
var gOpHitMap = null;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpHitMap').each(function(){
    gOpHitMap = new OpHitMap(this);
  });  
});


// Subclass of HistCanvas.
OpHitMap.prototype = new ButtressedPad(null);

function OpHitMap( element  )
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
  gStateMachine.BindObj('opHitScaleChange',this,"Draw");
  
  this.ophits = [];
  this.drawn_flashes = [];

  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });

}



OpHitMap.prototype.NewRecord = function()
{
  this.ophits = [];
  if(!gOphitsListName) return;
  
  this.ophits = gRecord.ophits[gOphitsListName].slice(0); // Copy

  // Sort hits by time, earliest last. 
  this.ophits.sort(
    function(a,b){ return b.peakTime - a.peakTime;  }
  );
  
  this.Draw();
}

OpHitMap.prototype.Draw = function()
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
  
  // Draw Flashes.
  this.drawn_flashes = [];
  if(gRecord && gRecord.opflashes){
    for(var i=0;i<gRecord.opflashes.length;i++){
      var flash = gRecord.opflashes[i];
      var x = this.GetX(flash.zCenter);
      var y = this.GetY(flash.yCenter);
      var wx = Math.abs(this.GetX(flash.zCenter + flash.zWidth) - x);
      var wy = Math.abs(this.GetY(flash.yCenter + flash.yWidth) - y);
      var w = flash.time*gOpDetMode.variableScale;
      if(w<gOpDetMode.cut.min) continue;
      if(w>gOpDetMode.cut.max) continue;
      
      this.drawn_flashes.push(
        { flash: flash,
          x: x,
          y: y,
          wx: wx,
          wy: wy}
      );
      var c = gOpDetColorScaler.GetColor(w);
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
      this.ctx.restore()
    }
  }
  
  this.pmtRadius = 15.2; // Size of the TPB Coating, according to the root geometry file.
  var r = this.pmtRadius * this.span_x/(this.max_u-this.min_u); // Radius in screen pixels.
  
  
  
  // Draw OpHits
  for(var i=0;i<this.ophits.length;i++) {
    var oh = this.ophits[i];

    var w = oh[gOpDetMode.variable]*gOpDetMode.variableScale;
    if(w<gOpDetMode.cut.min) continue;
    if(w>gOpDetMode.cut.max) continue;
    
    var det = gGeo.opDets.OpDetByChannel(oh.opDetChan);
    if(!det) { 
      console.warn("Couldn't find optical detector geometry for hit",oh);
      continue;
    }
    var x = this.GetX(det.z);
    var y = this.GetY(det.y);
    var c = gOpDetColorScaler.GetColor(w);
    this.ctx.fillStyle = "rgb(" + c + ")";
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,Math.PI*1.999,false);
    this.ctx.fill();
  }
  
  // Draw PMTs
  
  var dets = gGeo.opDets.opticalDetectors;
  this.ctx.strokeStyle = "black";
  for(var i=0;i<dets.length;i++){
    var det = dets[i];
    if(det == gHoverState.obj) { this.ctx.lineWidth = 2;} 
    else                       { this.ctx.lineWidth = 1;} 
    var x = this.GetX(det.z);
    var y = this.GetY(det.y);
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,Math.PI*1.999,false);
    this.ctx.stroke();
  }
  
}

OpHitMap.prototype.DoMouse = function(ev)
{
  var offset = getAbsolutePosition(this.element);
  this.fMouseX = ev.pageX - offset.x;
  this.fMouseY = ev.pageY - offset.y; 
  this.fMouseU = this.GetU(this.fMouseX);
  this.fMouseV = this.GetV(this.fMouseY);
 
  var r2 = this.pmtRadius* this.pmtRadius;
  
  var dets = gGeo.opDets.opticalDetectors;
  var hoverdet = null;
  for(var i=0;i<dets.length;i++){
    var det = dets[i];
    var dx = (det.z - this.fMouseU);
    var dy = (det.y - this.fMouseV);
    var d2 = dx*dx + dy*dy;
    if(d2<r2) hoverdet = det;
  }
  if(hoverdet){
     ChangeHover(hoverdet,"opdet",gGeo.opDets.opticalDetectors);
  } else {
    var hoverflash = null;
    for(var i=0;i<this.drawn_flashes.length;i++) {
      var df = this.drawn_flashes[i];
      var dx = (df.x - this.fMouseX)/df.wx;
      var dy = (df.y - this.fMouseY)/df.wy;
      var dr2 = dx*dx + dy*dy;
      if(dr2<1) hoverflash = df.flash;
    }
    if(hoverflash) {
      ChangeHover(hoverflash,"opflash",gRecord.opflashes);
    } else {
      ClearHover();
    }
  } 
  this.Draw();
}