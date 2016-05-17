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
  
  this.ophits = [];
  this.drawn_flashes = [];

  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
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
  
  var t1 = this.ophits[this.ophits.length-1].peakTime*1e-3;
  var t2 = this.ophits[0].peakTime*1e-3;
  if(t2<24) t2=24;
  var dt = (t2-t1);
  
  
  this.min_v = t1 - dt*0.1
  this.max_v = t2;
  this.Draw();
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
    x1 = this.GetX(oh.opDetChan);
    x2 = this.GetX(oh.opDetChan+1);
    y1 = this.GetY(oh.peakTime * 1e-3);
    c = gOpColorScaler.GetColor(w);

    this.ctx.fillStyle= "rgba(" + c + ",0.5)";;
    this.ctx.fillRect(x1,y1,x2-x1,4);
    
  }
  
  
};

OpHit2dMap.prototype.DoMouse = function(ev)
{
  // var offset = getAbsolutePosition(this.element);
 //  this.fMouseX = ev.pageX - offset.x;
 //  this.fMouseY = ev.pageY - offset.y;
 //  this.fMouseU = this.GetU(this.fMouseX);
 //  this.fMouseV = this.GetV(this.fMouseY);
 //
 //  var r2 = this.pmtRadius* this.pmtRadius;
 //
 //  if(! this.fMouseInContentArea) return true; // keep bubbling, this isnt' for us.
 //
 //  var dets = gGeo.opDets.opticalDetectors;
 //  var hoverdet = null;
 //  var i, det, dx,dy,d2, dr2;
 //  for(i=0;i<dets.length;i++){
 //    det = dets[i];
 //    dx = (det.z - this.fMouseU);
 //    dy = (det.y - this.fMouseV);
 //    d2 = dx*dx + dy*dy;
 //    if(d2<r2) hoverdet = det;
 //  }
 //  if(hoverdet){
 //     ChangeHover({obj: hoverdet, type: "opdet", collection: gGeo.opDets.opticalDetectors});
 //  } else {
 //    var hoverflash = null;
 //    for(i=0;i<this.drawn_flashes.length;i++) {
 //      var df = this.drawn_flashes[i];
 //      dx = (df.x - this.fMouseX)/df.wx;
 //      dy = (df.y - this.fMouseY)/df.wy;
 //      dr2 = dx*dx + dy*dy;
 //      if(dr2<1) hoverflash = df.flash;
 //    }
 //    if(hoverflash) {
 //      ChangeHover({obj: hoverflash, type: "opflash", collection: gRecord.opflashes});
 //    } else {
 //      ClearHover();
 //    }
 //  }
 //  this.Draw();
};
