// Subclass of Pad.
RgbWireView.prototype = new WireView();

gRgbWireView = null;
// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-RgbWireView').each(function(){
    var o = new RgbWireView(this);
    gRgbWireView = o;
  });  
});




function RgbWireView( element, options )
{
  if(!element) {
    return;
  }
  if($(element).length<1) { 
    return;
  }  
  var settings = {
    rgb_mode:     true,
    plane:       2,
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  WireView.call(this, element, settings); // Give settings to Pad contructor.
}


RgbWireView.prototype.MagnifierDraw = function(fast)
{
  // Reset bounds if appropriate
  if(this.zooming) {
    this.min_v = gZoomRegion.tdc[0];
    this.max_v = gZoomRegion.tdc[1];
    this.min_u = gZoomRegion.plane[2][0];
    this.max_u = gZoomRegion.plane[2][1];
    this.wire_shift[0] = gZoomRegion.plane[2][0]-gZoomRegion.plane[0][0];
    this.wire_shift[1] = gZoomRegion.plane[2][0]-gZoomRegion.plane[1][0];
    this.wire_shift[2] = 0;
    
    
  } else {
    this.min_v = 0;
    this.max_v = 3200;
    this.min_u = 0;
    this.max_u = gGeo.numWires(2);
  }
  
  this.Clear();
  Pad.prototype.MagnifierDraw.call(this,fast);
}


RgbWireView.prototype.NewRecord_hits = function()
{
  this.myHits = [];
  this.visHits = [];
  this.hasContent = false;

  this.myHits = GetSelected("hits");
  this.TrimHits();
};

RgbWireView.prototype.DrawImage = function(min_u, max_u, min_v, max_v)
{}

RgbWireView.prototype.DrawHits = function(min_u, max_u, min_v, max_v)
{
  // Temp:
  this.cellWidth = this.span_x/this.num_u;
  this.cellHeight = this.span_y/this.num_v;
  
  // console.warn("DrawHits",this.plane,min_u,max_u,min_v,max_v, gHoverState.obj);
  this.fShiftRect.u1 = this.GetU(this.fShiftRect.x1);
  this.fShiftRect.u2 = this.GetU(this.fShiftRect.x2);
  this.fShiftRect.v1 = this.GetV(this.fShiftRect.y2);
  this.fShiftRect.v2 = this.GetV(this.fShiftRect.y1);
  var hoverVisHit = null;
  var h,u,v,x,dx,y,dy,c;
  
  
  for(var i=0;i<this.visHits.length;i++) {
    h = this.visHits[i];
    u = h.u-this.wire_shift[h.hit.plane];
    if(u<min_u) continue;
    if(u>max_u) continue;
    v = h.v;         
    if(v<min_v) continue;
    if(v>max_v) continue;
    x = this.GetX(u);
    dx = this.GetX(u+1) - x;
    
    y = this.GetY(h.v2 );
    dy = this.GetY(h.v1) - y;    
    if(dx<1.5) dx = 1.5;  //exaggerate
    if(dy<1.5) dy = 1.5; 
    c = "0,0,0";
    if(h.hit.plane == 0) c = "255,0,0";
    if(h.hit.plane == 1) c = "0,255,0";
    if(h.hit.plane == 2) c = "0,0,255";
    
    this.ctx.fillStyle = "rgb(" + c + ")";
    this.ctx.fillRect(x,y,dx,dy);      
  
    if(gHoverState.obj == h.hit) hoverVisHit = h;
    this.mouseable.push({type:"hit", coords:[[x,y],[x,y+dy]], r:dx, obj: h.hit});
  }
  
  if(hoverVisHit) {
    // console.warn("hoverhit!",hoverVisHit);
      h = hoverVisHit;
      u = h.u-this.wire_shift[h.hit.plane];;
      v = h.v;         
      x = this.GetX(u);
      dx = this.GetX(u) - x;
    
      y = this.GetY(h.v2);
      dy = this.GetY(h.v1) - y;    
      if(dx<1.5) dx = 1.5;  //exaggerate
      if(dy<1.5) dy = 1.5; 
      
      c = gHitColorScaler.GetColor(h.c);
      console.log("color",gHitColorScaler,c);
      this.ctx.fillStyle = "black";

      this.ctx.fillStyle = "rgb(" + c + ")";
      this.ctx.fillRect(x,y,dx,dy);      
      
      // // Hovering this hit.
      this.ctx.strokeStyle = "black";
      var w = 1.5;
      this.ctx.lineWidth = w;
      this.ctx.strokeRect(x-w,y-w,dx+2*w,dy+2*w);          
      
    }
};

RgbWireView.prototype.DrawTracks = function(min_u, max_u, min_v, max_v)
{
  this.plane=0;
  this.track_color = "rgb(255,0,0)";
  
  WireView.prototype.DrawTracks.call(this,min_u,max_u,min_v,max_v);
  this.plane=1;
  this.track_color = "rgb(0,255,0)";
  WireView.prototype.DrawTracks.call(this,min_u,max_u,min_v,max_v);
  this.plane=2;
  this.track_color = "rgb(0,0,255)";
  WireView.prototype.DrawTracks.call(this,min_u,max_u,min_v,max_v);
}