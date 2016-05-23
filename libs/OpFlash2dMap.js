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

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-OpFlash2dMap').each(function(){
    gOpFlash2dMap = new OpFlash2dMap(this);
  });  
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
    xlabel : "PMT Number",
    ylabel : "Time (us)",
  };
  Pad.call(this, element, settings); // Give settings to Pad contructor.
    
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('opScaleChange',this,"Draw");
  
  this.opflashes = [];
  this.drawn_flashes = [];

  $('#ctl-OpHitLists').change(function(ev) { return self.NewRecord(); });
  this.SetMagnify(true);

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
  }
  this.Draw();
 };

OpFlash2dMap.prototype.DrawOne = function()
{
  this.Clear();
  this.DrawFrame();


  var listname = $('#ctl-OpFlashLists').val();
  
  if(gRecord && gRecord.opflashes && gRecord.opflashes[listname] && gRecord.opflashes[listname].length>0) {
    var flashes = gRecord.opflashes[listname].slice(0);
  
    flashes.sort(
      function(a,b){ return a.totPe - b.totPe;  }
    );
  
    for(i=0;i<flashes.length;i++){
        var flash = flashes[i];
        var x0 = this.GetX(flash.zCenter);
        var x1 = this.GetX(flash.zCenter - flash.zWidth);
        var x2 = this.GetX(flash.zCenter + flash.zWidth);
        var y1 = this.GetY(flash.time);
        // if(t<gOpMode.cut.min) continue;
        // if(t>gOpMode.cut.max) continue;

        c = gOpFlashColorScaler.GetColor(flash.totPe);
        if(gHoverState.obj == flash) c = "0,0,0";
        this.ctx.fillStyle="rgba("+c+",1)";
        
        this.ctx.fillRect(x1,y1-2,x2-x1,4)
    }
  }
};

OpFlash2dMap.prototype.DoMouse = function(ev)
{

};
