// Subclass of Pad.

HitMap.prototype = new Pad;           
HitMap.prototype.constructor = HitMap;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-hitmap').each(function(){
    new HitMap(this,{});
  });  
});

function HitMap( element, options )
{
  console.log('HitMap ctor');
  if(!element) {
    // console.log("HitMap: NULL element supplied.");
    return;
  }
  if($(element).length<1) { 
    // console.log("HitMap: Zero-length jquery selector provided."); 
    return;
  }
  
  var settings = {
    view: 1,              // ID hits in the X-view.
    draw_axes : false,
    xlabel: null,
    ylabel: null,
    margin_left : 30,
    margin_bottom : 30,
    tick_pixels_x: 50,
    tick_pixels_y: 30,
    // ,margin_right: 50,
    // paint_colorscale: true
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  
  // NB X and Y are screen coordinates
  // U and V are 'natural' coordinates, like plane/strip or x,z positions
  this.fMousing = false;
  this.hasContent = false;
  this.myHits = [];
  this.visHits = [];
  
  var self = this;
  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('click'    ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('resize' ,function(ev) { if(self.hasContent == false) self.NewRecord(); });
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('phCutChange',this,"TrimData");
  gStateMachine.BindObj('timeCutChange',this,"TrimData");
  gStateMachine.BindObj('phColorChange',this,"Draw");
  gStateMachine.BindObj('TimeCutChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChangeFast',this,"Draw");
}


HitMap.prototype.NewRecord = function()
{
  // called on new record available.
  this.myHits = [];
  this.visHits = [];
  this.hasContent = false;
  
  // Go through gHits, and find hits that match our view.
  for(var i=0;i<gHits.length;i++) {
    if(gHits[i].plane == this.plane) this.myHits.push(gHits[i]);
  }
  this.TrimData();
}

HitMap.prototype.TrimData = function()
{
  // Called when a cut is changed; go through data and trim visible hit list.
  
  // For now, no cuts, but I am going to add wrapper objects to hold extracted data.
  this.visHits = [];
  for(var i = 0;i<this.myHits.length;i++) {
    var h= this.myHits[i];
    var vishit = {hit:h,
      u:h.wire,  // horizontal coord
      v:h.t,     // vertical coord
      v1:h.t1,
      v2:h.t2,
      c: h.q     // Color coord
    }
    this.visHits.push(vishit);
  }

  this.Draw();
}


HitMap.prototype.Draw = function()
{
  if($(this.element).is(":hidden")) return;

  // Reset bounds if appropriate
  if(this.zooming) {
    if(gTimeCut) {
      this.min_v = gTimeCut[0];
      this.max_v = gTimeCut[1];
    }
    this.min_u = gZoomRegion.plane[this.plane][0];
    this.max_u = gZoomRegion.plane[this.plane][1];
  }
  

  if((this.fMousing) && ($('#ctl-magnifying-glass').is(':checked')) )
  {
    this.magnifying = true;
    // Cleverness:
    var mag_radius = parseFloat($('#ctl-magnifier-size').val());
    var mag_scale  = parseFloat($('#ctl-magnifier-mag').val());
    
    this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v);
    this.ctx.strokeStyle = "rgba(0,0,0,0.75)";
    this.ctx.beginPath();
    this.ctx.arc(this.fMouseX,this.fMouseY, mag_radius+1, 0,Math.PI*2,true);
    this.ctx.stroke();
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.fMouseX,this.fMouseY, mag_radius, 0,Math.PI*2,true);
    this.ctx.clip();
    
    this.ctx.translate((1-mag_scale)*this.fMouseX,(1-mag_scale)*this.fMouseY);
    this.ctx.scale(mag_scale,mag_scale);
    
    // Find new draw limits in u/v coords:
    var umin = this.GetU(this.fMouseX-mag_radius);
    var umax = this.GetU(this.fMouseX+mag_radius);
    var vmax = this.GetV(this.fMouseY-mag_radius);
    var vmin = this.GetV(this.fMouseY+mag_radius);
    
    this.DrawOne(umin,umax,vmin,vmax);
    this.ctx.restore();
  } else {
    this.magnifying = false;
    this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v);
  }  
  
}

HitMap.prototype.DrawOne = function(min_u,max_u, min_v, max_v)
{
  this.Clear();
  
  this.DrawFrame();
  if ($('#ctl-hitmap-show-hits').is(':checked')) {
    this.DrawHits(min_u,max_u, min_v, max_v);
  }
}

HitMap.prototype.DrawHits = function(min_u, max_u, min_v, max_v)
{
  // Temp:
  var cs = new ColorScaler();
  cs.max = 2000;

  this.cellWidth = this.span_x/this.num_u;
  this.cellHeight = this.span_y/this.num_v;

  for(var i=0;i<this.visHits.length;i++) {
    var h = this.visHits[i];
    var u = h.u;
    if(u<min_u) continue;
    if(u>max_u) continue;
    var v = h.v;         
    if(v<min_v) continue;
    if(v>max_v) continue;
    var x = this.GetX(u);
    var dx = this.GetX(u+1) - x;
    
    var y = this.GetY(h.v1);
    var dy = this.GetY(h.v2) - y;    
    var c = cs.GetColor(h.c);
    this.ctx.fillStyle = "rgb(" + c + ")";;
    this.ctx.fillRect(x,y,dx,dy);      
  }
}


HitMap.prototype.DoMouse = function(ev)
{
  if(ev.type === 'mouseout' || ev.type == 'touchend') {
    this.fMousing = false;
    // TODO: clear hovered objects
  } else {
    this.fMousing = true;
    var offset = getAbsolutePosition(this.canvas);
    this.fMouseX = ev.pageX - offset.x;
    this.fMouseY = ev.pageY - offset.y; 
    this.fMouseU = this.GetU(this.fMouseX);
    this.fMouseV = this.GetV(this.fMouseY);

    // TODO: find objects under mouse
    
    if(ev.type === 'click') {
      // TODO: add selection mecahnism
    } else {
      // TODO: add objects under mouse to 'hover' list.
    }
  }
  this.Draw();
  
  
}