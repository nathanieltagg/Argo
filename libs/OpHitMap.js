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
}



OpHitMap.prototype.NewRecord = function()
{
  this.ophits = [];

  if(!gRecord) return;
  if(!gRecord.ophits) return;
  
  this.ophits = gRecord.ophits.slice(0); // Copy

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
  
  var pmtRadius = 15.2; // Size of the TPB Coating, according to the root geometry file.
  var r = pmtRadius * this.span_x/(this.max_u-this.min_u); // Radius in screen pixels.
  
  var dets = gGeo.opDets.opticalDetectors;
  this.ctx.strokeStyle = "black";
  for(var i=0;i<dets.length;i++){
    var det = dets[i];
    var x = this.GetX(det.z);
    var y = this.GetY(det.y);
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,Math.PI*2);
    this.ctx.stroke();
  }
  
  for(var i=0;i<this.ophits.length;i++) {
    var oh = this.ophits[i];

    var w = oh[gOpDetMode.variable]*gOpDetMode.variableScale;
    if(w<gOpDetMode.cut.min) continue;
    if(w>gOpDetMode.cut.max) continue;
    
    var det = gGeo.opDets.OpDetByChannel(oh.opDetChan);
    if(!det) { 
      console.warn("Couldn't find optical detector geometry for hit",oh);
    }
    var x = this.GetX(det.z);
    var y = this.GetY(det.y);
    c = gOpDetColorScaler.GetColor(w);
    this.ctx.fillStyle = "rgb(" + c + ")";
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,Math.PI*2);
    this.ctx.fill();
  }
}
