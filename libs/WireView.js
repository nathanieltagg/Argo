// Subclass of Pad.
WireView.prototype = new Pad;           

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireView').each(function(){
    var o = new WireView(this);
    // console.log("Creating WireView ",o);
  });  
});

function WireView( element, options )
{
  if(!element) {
    return;
  }
  if($(element).length<1) { 
    return;
  }
  
  var settings = {
    plane: 0, // default, override this
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 30,
    xlabel : "Wire",
    ylabel : "TDC",
    zooming: true, // set false to lock view on starting coordinates
    tick_pixels_x: 50,
    tick_pixels_y: 30,
    show_image:   false, // can be false, 'raw', or 'cal'
    show_hits:    false,
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  
  
  var self = this;
  
  this.fMousing = false;
  this.fDragging = false;
  this.hasContent = false;
  this.myHits = [];
  this.visHits = [];
  
  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mousedown',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });
  $(document    ).bind('mouseup' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('resize' ,function(ev) { if(self.hasContent == false) self.NewRecord(); });
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('TimeCutChange',this,"Draw");
  
  gStateMachine.BindObj('phCutChange',this,"TrimHits");
  gStateMachine.BindObj('timeCutChange',this,"TrimHits");
  
  if(this.zooming) gStateMachine.BindObj('zoomChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChangeFast',this,"DrawFast");
}


WireView.prototype.NewRecord = function()
{
  //
  // called on new record available.
  //
  if(!gRecord) return;
  if(this.show_hits) this.NewRecord_hits();
  if(this.show_image) this.NewRecord_image();
}

WireView.prototype.NewRecord_hits = function()
{
  this.myHits = [];
  this.visHits = [];
  this.hasContent = false;
  
  // Go through gHits, and find hits that match our view.
  for(var i=0;i<gHits.length;i++) {
    if(gHits[i].plane == this.plane) this.myHits.push(gHits[i]);
  }
  this.TrimHits();
}

WireView.prototype.NewRecord_image = function()
{
  // Build offscreen image(s)
  this.wireimg = new Image();
  this.wireimg_thumb = new Image();
  
  this.wireimg.src       = gRecord[this.show_image].wireimg_url;
  this.wireimg_thumb.src = gRecord[this.show_image].wireimg_url_thumb;
  // Callback when the png is actually there...
  var self = this;
  this.wireimg.onload = function() {
      self.Draw();
  }  
}


WireView.prototype.TrimHits = function()
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




WireView.prototype.DrawFast = function()
{
  this.Draw(true);
}

WireView.prototype.Draw = function(fast)
{
  // Reset bounds if appropriate
  if(this.zooming) {
    if(gTimeCut) {
      this.min_v = gTimeCut[0];
      this.max_v = gTimeCut[1];
    }
    this.min_u = gZoomRegion.plane[this.plane][0];
    this.max_u = gZoomRegion.plane[this.plane][1];
  }
  
  

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


WireView.prototype.DrawOne = function(min_u,max_u,min_v,max_v,fast)
{
  this.Clear();
  
  this.DrawFrame();

  if (this.show_image) {
    this.DrawImage(min_u,max_u, min_v, max_v, fast);
  }

  if (this.show_hits && $('#ctl-hitmap-show-hits').is(':checked')) {
    this.DrawHits(min_u,max_u, min_v, max_v, fast);
  }
  
    
}


WireView.prototype.DrawHits = function(min_u, max_u, min_v, max_v)
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


WireView.prototype.DrawImage = function(min_u,max_u,min_v,max_v,fast)
{
  if(!this.wireimg) return;
  if(fast)
     if(!this.wireimg_thumb) return;

  this.ctx.fillStyle = "rgb(0,0,0)";
  this.ctx.fillRect(this.origin_x , this.origin_y-this.span_y, this.span_x,this.span_y);


   var min_tdc     = Math.max(0,this.min_v);
   var max_tdc     = Math.min(this.wireimg.width,this.max_v); 
   var min_wire    = Math.max(this.min_u,0);
   var max_wire    = Math.min(this.max_u,gGeo.numWires(this.plane));
   var min_channel = gGeo.channelOfWire(this.plane, min_wire);
   var max_channel = gGeo.channelOfWire(this.plane, max_wire);
   
   var source_x = Math.floor(min_tdc);
   var source_y = Math.floor(min_channel);
   var source_w = Math.floor(max_tdc-min_tdc);
   var source_h = Math.floor(max_channel-min_channel);
  
   // Find position and height of destination in screen coordinates. Note we'll 
   // have to rotate these for final picture insertion.
   var dest_x = Math.floor(this.GetX(min_wire));
   var dest_w = Math.floor(this.GetX(max_wire) - dest_x);
   var dest_y = Math.floor(this.GetY(min_tdc));
   var dest_h = Math.floor(dest_y - this.GetY(max_tdc));
  
   // Now, the above values are good, but we need to 
   // rotate our image.
   this.ctx.save();
   this.ctx.translate(dest_x,dest_y);
   this.ctx.rotate(-Math.PI/2);

   var rot_dest_x = 0;
   var rot_dest_y = 0;
   var rot_dest_w = dest_h;
   var rot_dest_h = dest_w;
  
   // console.log("drawImg source",source_x,source_y,source_w,source_h);
   // console.log("drawImg dest", dest_x,   dest_y,  dest_w, dest_h);
   // console.log("drawImg rot ", rot_dest_x,   rot_dest_y,  rot_dest_w, rot_dest_h);
  
  if(fast) {
    // Draw from the thumbnail, which is resolution-reduced by a factor of 5.
    this.ctx.drawImage(
      this.wireimg_thumb      // Source image.
      ,source_x/5
      ,source_y/5
      ,source_w/5
      ,source_h/5
      ,rot_dest_x
      ,rot_dest_y
      ,rot_dest_w
      ,rot_dest_h
       );
    
  } else {
    this.ctx.drawImage(
      this.wireimg      // Source image.
      ,source_x
      ,source_y
      ,source_w
      ,source_h
      ,rot_dest_x
      ,rot_dest_y
      ,rot_dest_w
      ,rot_dest_h
    );
    
  }
  this.ctx.restore();
     

}

WireView.prototype.DoMouse = function(ev)
{
  // First, deal with mouse-ups that are probably outside my region.
  if(ev.type === 'mouseup') {
    if( this.fDragging) {
      this.fDragging = false;
      // Update thorough
      gStateMachine.Trigger("zoomChange"); 
      // Draw gets issued by the trigger.
    }
    return;
  }
  
  ev.originalEvent.preventDefault();
  
  if(ev.type === 'mouseout' || ev.type == 'touchend') {
    this.fMousing = false;
    gHoverWire = null;
    // gStateMachine.Trigger('hoverWireChange');    
    this.Draw();
    return;
  }
  
  /// Mousedown, mouseup OR mousemove
    
  this.fMousing = true;
  var offset = getAbsolutePosition(this.element);
  this.fMouseX = ev.pageX - offset.x;
  this.fMouseY = ev.pageY - offset.y; 
  this.fMouseU = this.GetU(this.fMouseX);
  this.fMouseV = this.GetV(this.fMouseY);

  // Which area is mouse start in?
  var mouse_area;
  if(this.fMouseY > this.origin_y ) {
    mouse_area = "xscale";
  } else if(this.fMouseX < this.origin_x) {
    mouse_area = "yscale";
  } else {
    mouse_area = "body";
  }
  if(!this.fDragging) {
    // Change cursor.
    switch(mouse_area) {
      case "body":         this.canvas.style.cursor = "move";      break;
      case "xscale":       this.canvas.style.cursor = "e-resize";  break;
      case "yscale":       this.canvas.style.cursor = "n-resize"; break;
    }
  }
  

  if(this.fDragging) {
      // Update new zoom position or extent...
    if(this.fMouseStartArea == "body"){
      var dx = this.fMouseX - this.fMouseLastX;
      var du = dx * (this.max_u-this.min_u)/(this.span_x);
      
      gZoomRegion.setLimits(this.plane,this.min_u - du, this.max_u - du);
      
      var dy = this.fMouseY - this.fMouseLastY;
      var dv = dy * (this.max_v-this.min_v)/(this.span_y);
      gTimeCut[0] += dv;
      gTimeCut[1] += dv;
      
      this.fMouseLastX = this.fMouseX;
      this.fMouseLastY = this.fMouseY;
    } else if(this.fMouseStartArea == "xscale") {
      var relx = this.fMouseX - this.origin_x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      // Want the T I started at to move to the current posistion by scaling.
      var new_max_u = this.span_x * (this.fMouseStartU-this.min_u)/relx + this.min_u;
      gZoomRegion.setLimits(this.plane,this.min_u, new_max_u);
      
    } else if(this.fMouseStartArea == "yscale") {
      var rely =  this.origin_y - this.fMouseY;
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      var new_max_v = this.span_y * (this.fMouseStartV-this.min_v)/rely + this.min_v;
      gTimeCut[1] = new_max_v;
    
    }
    
  } else {
        gHoverWire = {channel: gGeo.channelOfWire(this.plane,this.fMouseU)};
        gHoverWireSample = this.fMouseV;
        gStateMachine.Trigger('hoverWireChange');
  }

    
  if(ev.type === 'mousedown') {
      this.fDragging = true;
      this.fMouseStartX = this.fMouseX;
      this.fMouseStartY = this.fMouseY;
      this.fMouseStartU = this.fMouseU;
      this.fMouseStartV = this.fMouseV;
      this.fMouseLastX = this.fMouseX;
      this.fMouseLastY = this.fMouseY;
      // Which area is mouse start in?
      this.fMouseStartArea = mouse_area;
  } else if(ev.type === 'mousemove' ) {
    // Update quick.
    if(this.fDragging){
      gStateMachine.Trigger("zoomChangeFast"); 
    }
    this.Draw(false); // Do a slow draw in this view.    
  } 
  
}
