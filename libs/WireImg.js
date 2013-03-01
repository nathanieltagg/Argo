// Subclass of Pad.
WireImg.prototype = new Pad;           

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireImg').each(function(){
    var o = new WireImg(this);
    // console.log("Creating WireImg ",o);
  });  
});

function WireImg( element, options )
{
  if(!element) {
    // console.log("HitMap: NULL element supplied.");
    return;
  }
  if($(element).length<1) { 
    // console.log("HitMap: Zero-length jquery selector provided."); 
    return;
  }
  
  var settings = {
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 40,
    xlabel : "Wire",
    ylabel : "TDC",
    zooming: true
    
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  
  
  var self = this;
  this.fMousing = false;
  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('click'    ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('resize' ,function(ev) { if(self.hasContent == false) self.NewRecord(); });
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('TimeCutChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChangeFast',this,"DrawFast");
}


WireImg.prototype.NewRecord = function()
{
  // ofscreen image.
  this.wireimg = new Image();
  this.wireimg_thumb = new Image();
  
  // $(this.element).html("<img/>");
  // var myimg = $('img',this.element)[0];
  // $(myimg).attr("style","width:100%; height: auto;");

  this.wireimg.src       = gRecord[this.obj].wireimg_url;
  this.wireimg_thumb.src = gRecord[this.obj].wireimg_url_thumb;
  // Callback when the png is actually there...
  var self = this;
  this.wireimg.onload = function() {
      self.Draw();
  }
  
}

WireImg.prototype.DrawFast = function()
{
  this.Draw(true);
}

WireImg.prototype.Draw = function(fast)
{
  if($(this.element).is(":hidden")) return;

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
    
    this.DrawOne(umin,umax,vmin,vmax,fast);
    this.ctx.restore();
  } else {
    this.magnifying = false;
    this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v,fast);
  }  
  
}

WireImg.prototype.DrawOne = function(min_u,max_u,min_v,max_v,fast)
{
  if(!this.wireimg) return;
  if(fast)
     if(!this.wireimg_thumb) return;
  
  this.Clear();
  
  // Top and bottom determined by TDC bounds.
  this.min_v = 0;
  this.max_v = this.wireimg.width;
  if(gTimeCut) {
    this.min_v = gTimeCut[0];
    this.max_v = gTimeCut[1];
  }
  
  // Left and right determined either by number of wires, or by zoom region.
  
  // FIXME: The problem with this solution is that aspect ratio is NOT maintained between 
  // the three views, since single views crop the range. Better would be to honor the gZoomRegion limits,
  // and paste the image into the right place, then put a 'gray zone' in the area that isn't actually instrumented.
  if(this.zooming) {
    this.min_u = Math.max(gZoomRegion.plane[this.plane][0],0); 
    this.max_u = Math.min(gZoomRegion.plane[this.plane][1],gGeo.numWires(this.plane)); 
  } else {
    this.min_u = 0;
    this.max_u = gGeo.numWires(this.plane);    
  }
  this.DrawFrame();

  this.ctx.save();
  this.ctx.translate(this.GetX(this.min_u),this.GetY(this.min_v));
  this.ctx.rotate(-Math.PI/2);
  
  var min_channel = gGeo.channelOfWire(this.plane,this.min_u);
  var max_channel = gGeo.channelOfWire(this.plane,this.max_u);
  
  if(fast) {
    // Draw from the thumbnail, which is reduced by a factor of 5.
    this.ctx.drawImage(
      this.wireimg_thumb      // Source image.
      ,Math.floor(this.min_v/5), Math.floor(min_channel/5)     // Source x, y
      ,Math.floor(this.max_v-this.min_v)/5, Math.floor(this.max_u-this.min_u)/5 // Source width, height
      ,0,0 // Destination corner coordinates (taken care of by translate above)
      ,this.span_y  // destination width (Swap due to rotation, above)
      ,this.span_x //  destination height (swap due to rotation, above)
      );
    
  } else {
    this.ctx.drawImage(
      this.wireimg      // Source image.
      , Math.floor(this.min_v), Math.floor(min_channel)     // Source x, y
      ,Math.floor(this.max_v-this.min_v), Math.floor(this.max_u-this.min_u) // Source width, height
      ,0,0 // Destination corner coordinates (taken care of by translate above)
      ,this.span_y  // destination width (Swap due to rotation, above)
      ,this.span_x //  destination height (swap due to rotation, above)
      );
    
  }
    
    
    // this.ctx.drawImage(
    //   // Source image.
    //   this.wireimg 
    //   // Source x, 
    //   // ,Math.floor(this.min_v), this.swath.y
    // //   ,Math.floor(this.max_v), this.swath.h // Source width, height
    //   ,Math.floor(this.min_v), this.swath.y
    //   ,Math.floor(this.max_v-this.min_v), this.swath.h // Source width, height
    //   ,0,0
    //   ,this.span_y //,this.GetY(this.min_v)-this.GetY(this.max_v) // destination, 
    //   ,this.span_x //,this.GetX(this.max_u)-this.GetX(this.min_u)// width and height
    //   );
  this.ctx.restore();
     

}

WireImg.prototype.DoMouse = function(ev)
{
  if(ev.type === 'mouseout' || ev.type == 'touchend') {
    this.fMousing = false;
    
    gHoverWire = null;

  } else {
    this.fMousing = true;
    var offset = getAbsolutePosition(this.element);
    this.fMouseX = ev.pageX - offset.x;
    this.fMouseY = ev.pageY - offset.y; 
    this.fMouseU = this.GetU(this.fMouseX);
    this.fMouseV = this.GetV(this.fMouseY);
    gHoverWire = {channel: gGeo.channelOfWire(this.plane,this.fMouseU)};
    gHoverWireSample = this.fMouseV;
    
  }
  gStateMachine.Trigger('hoverWireChange');
  this.Draw();
  
}