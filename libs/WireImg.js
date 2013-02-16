// Subclass of Pad.
WireImg.prototype = new Pad;           
WireImg.prototype.constructor = HitMap;

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireImg').each(function(){
    var o = new WireImg(this);
    console.log("Creating WireImg ",o);
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
    margin_bottom : 10,
    margin_top    : 10,
    margin_right  : 10,
    margin_left   : 10
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
}


WireImg.prototype.NewRecord = function()
{
  // ofscreen image.
  this.wireimg = new Image();
  
  // $(this.element).html("<img/>");
  // var myimg = $('img',this.element)[0];
  // $(myimg).attr("style","width:100%; height: auto;");

  this.wireimg.src = gRecord.wireimg_url;
  // Callback when the png is actually there...
  var self = this;
  this.wireimg.onload = function() {
      self.Draw();
  }
  
}

WireImg.prototype.Draw = function()
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
    
    this.DrawOne(umin,umax,vmin,vmax);
    this.ctx.restore();
  } else {
    this.magnifying = false;
    this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v);
  }  
  
}

WireImg.prototype.DrawOne = function(min_u,max_u,min_v,max_v)
{
  if(!this.wireimg) return;
  // Called when image is loaded.
  var swath = {};
  switch(this.view) {
    case 0: swath={y: 4797, h: 8254-4797}; break;
    case 1: swath={y: 2399, h: 4798-2399}; break;
    case 2: swath={y: 0,    h: 2398-0}; break; 
  }
  console.log(this.view,swath);
  
  // rows:
  // 4798 to 8253 is view 0 (U) (plane 2)  total 3456 -> Collection plane
  // 2399 to 4797 is view 1 (V) (plane 1) total 2398 ->Induction plane
  // 0 to 2398 is view 2 (W)    (plane 0) total 2398 ->Induction plane.q
  // copy these subsets to 3 views.

  // console.log(this.wireimg);
  // this.bigCanvas = document.createElement("canvas");
  // console.log(this.bigCanvas);
  // this.bigCanvas.width  = this.wireimg.width;
  // this.bigCanvas.height = this.wireimg.height;
  // var ctx = this.bigCanvas.getContext("2d");
  // ctx.drawImage(this.wireimg,0,0);

  // this.ctx.width = this.wireimg.width;
  // this.ctx.height = swath.h;

  // Let's look at some raw data.
  // var imgdata = ctx.getImageData(0,0,this.bigCanvas.width,this.bigCanvas.height);
  // for(var x = 0; x<this.bigCanvas.width; x++ ){
  //   for(var y = 0; y<this.bigCanvas.height; y++ ){
  //     var i = (x+y*this.bigCanvas.width) * 4;
  //     if(i<10) console.log(imgdata.data[i],imgdata.data[i+1],imgdata.data[i+2],imgdata.data[i+3]);
  //   }
  // }
  
  this.Clear();

  this.ctx.save();
  this.ctx.translate(this.GetX(this.min_u),this.GetY(this.min_v));
  this.ctx.rotate(-Math.PI/2);
  
  this.ctx.drawImage(this.wireimg
    , 0, swath.y
    , this.wireimg.width, swath.h // Source width, height
    ,0,0
    // ,this.GetX(this.min_u), this.GetY(this.max_v) // destination coord, upper left
      
     ,this.span_y //,this.GetY(this.min_v)-this.GetY(this.max_v) // destination, 
     ,this.span_x //,this.GetX(this.max_u)-this.GetX(this.min_u)// width and height
    );
  console.log(      0, swath.y // Source x,y
      ,this.wireimg.width,swath.h // Source width, height
      ,this.GetX(this.min_u), this.GetY(this.max_v) // destination coord, upper left
             ,this.GetX(this.max_u)-this.GetX(this.min_u)
       ,this.GetY(this.min_v)-this.GetY(this.max_v) // destination, 

    );
  this.ctx.restore();
     

}

WireImg.prototype.DoMouse = function(ev)
{
  if(ev.type === 'mouseout' || ev.type == 'touchend') {
    this.fMousing = false;
    // TODO: clear hovered objects
  } else {
    this.fMousing = true;
    var offset = getAbsolutePosition(this.element);
    this.fMouseX = ev.pageX - offset.x;
    this.fMouseY = ev.pageY - offset.y; 
  }
  this.Draw();
}