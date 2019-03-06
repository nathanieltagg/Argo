//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

///
/// Boilerplate:  Javascript utilities for MINERvA event display, codenamed "Arachne"
/// Nathaniel Tagg  - NTagg@otterbein.edu - June 2009
///


// Utility functions
function isIOS()
{
    return (
        //Detect iPhone
        (navigator.platform.indexOf("iPhone") != -1) ||
        //Detect iPad
        (navigator.platform.indexOf("iPad") != -1) ||
        //Detect iPod
        (navigator.platform.indexOf("iPod") != -1)
    );
}


// zero-pad strings.
function zeropad(n, width) {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

function smart_sigfig(x,n)
{
  // Return an intelligent string with n sigfigs, using scientific where appropriate.
  if(isNaN(x)) return x;
  var s= parseFloat(x).toExponential().split('e');
  // a x 10^b;
  var a = parseFloat(s[0]).toFixed(n-1);
  var b = parseInt(s[1]);
  // Numbers close to 1: don't bother with sci. not.
  if(b>=0 && b<3) return "" + (x).toFixed(n-1-b);
  if(b<0 && b>-3)  return "" + (x).toFixed(n-1-b);
  b = s[1].replace("-","⁻")
         .replace("+","") //"⁺"
         .replace("1","¹")
         .replace("2","²")
         .replace("3","³")
         .replace("4","⁴")
         .replace("5","⁵")
         .replace("6","⁶")
         .replace("7","⁷")
         .replace("8","⁸")
         .replace("9","⁹")
         .replace("0","⁰");
  return a+"×10"+b;
  
}

function scientific_notation(x)
{
  // Cleverness: Use unicode for superscript! Drawn correctly by the program.
  // 2e-6 becomes 2×10⁻⁶
  // 1e+9 becomes 10⁹
  //³⁴⁵⁶⁷⁸⁹⁰⁻⁺
  if(x==0) return 0;
  var s= x.toExponential().split('e');
  // s[1].replace("e","×10")
  var s0;
  if(s[0] === "1") s0 = "";
  else s0 = s[0]+ "×";
  var s1 = s[1].replace("-","⁻")
               .replace("+","") //"⁺"
               .replace("1","¹")
               .replace("2","²")
               .replace("3","³")
               .replace("4","⁴")
               .replace("5","⁵")
               .replace("6","⁶")
               .replace("7","⁷")
               .replace("8","⁸")
               .replace("9","⁹")
               .replace("0","⁰");
  return s0+"10"+s1;
  
}

///
/// Base class: Pad.
/// This forms a 2-d drawing canvas with support for axes and things.
/// The base inElement should be something simple, ideally a div
///

// Subclass of ABoundObject.
Pad.prototype = new ABoundObject(null);           


function Pad( element, options )
{
  ///
  /// Constructor.
  ///
  if(!element) return;

  // Options - defaults. Sensible for a wide range of stuff. 
  var bgcolor_obj =  new RGBColor($(element).css('background-color')); 
  bgcolor_str = "255,255,255";
  if(bgcolor_obj.ok) bgcolor_str = bgcolor_obj.r+","+bgcolor_obj.g+','+bgcolor_obj.b;
  // if(bgcolor_obj.r == bgcolor_obj.g == bgcolor_obj.b == 0) debugger;
  var defaults = {
    nlayers: 1,
    create_2dcontext : true,
    
    width: 10,
    height: 10,
    margin_bottom : 5,
    margin_top : 5,
    margin_right : 5,
    margin_left : 5,
    min_u : 0, // x-coordinate, natural units.
    max_u : 1,
    min_v : 0, // y-coordinate, natural units.
    max_v : 1,
    bg_color : bgcolor_str,
    draw_box : true,
    draw_axes : true,
    draw_ticks_x:true,
    draw_grid_x:true,
    draw_tick_labels_x:true,
    draw_ticks_y:true,
    draw_grid_y:true,
    draw_tick_labels_y:true,
    tick_label_font: "12px sans-serif",
    time_on_x: false,
    tick_pixels_x : 40,
    tick_pixels_y : 40,
    log_y:false,  
    xlabel : null,
    ylabel : null,
    label_font : "16px sans-serif",
    fMagnifierOn: false,
    fMousePos : {x:-1e99,y:-1e99,u:-1e99,v:-1e99},
    fMouseStart: {},
    fMouseLast: {},
    fMouseInContentArea : false,
    mag_scale: 1,
    magnify_pass: 1,
    rotate_90: false,
    // control the DoMousePanAndScale() function;
    mouse_scale_max_u  : false,
    mouse_scale_min_u  : false,
    mouse_scale_max_v  : false,
    mouse_scale_min_v  : false,
    mouse_pan_u        : false,
    mouse_pan_v        : false,
  };
  // override defaults with options.
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.


  this.layers = [];
  this.ctxs = [];
  this.layer0 = this.canvas;
  this.layers[0] = this.canvas;
  $(this.element).css("position","relative");
  $(this.canvas).attr("style","position: absolute; left: 0; top: 0; z-index: 0;");

  // Look for an existing canvas, and build one if it's not there.
  for(var i=0;i<this.nlayers;i++) {
    var layername = "layer"+i;
    if($('canvas.'+layername,this.element).length<1) {
      var c = document.createElement("canvas");      
      $(c).addClass(layername);
      $(c).css("height",0);
      if(i>0)
        $(c).attr("style","position: absolute; left: 0; top: 0; z-index: "+i+";");
      this.element.appendChild(c);
      this[layername] = c; 
      this.layers[i] = c;

      // Build the drawing context.
      if(this.create_2dcontext){
        var ctx = c.getContext('2d');
        if(initCanvas) ctx = initCanvas(c).getContext('2d');
        if(!ctx) console.error("Problem getting context!");
        if(typeof ctx == 'undefined') console.error("Problem getting context!");
        this.ctxs[i] = ctx;      
      }
    } else {
      this[layername] = this.layers[i] = $('canvas.'+layername,this.element).get(0);
    }      
  }
  this.canvas = this.layers[0];
  this.ctx    = this.ctxs[0];
  
  // console.warn("Pad created canvas with ", $(this.canvas).css("height"),$(this.canvas).height());
  // Resize the canvas to the coordinates specified, either in html, the css, or options provided.
  this.Resize();
   
  // Bind resizing to a sensible closure.
  var self = this;
  $(this.element).resize(function(ev){
                         self.Resize(); 
                         self.Draw();
                         });         
                                                            
   // Printing support. Make sure that our element has type 'pad'.
  $(this.element).addClass('pad');
  $(this.element).bind('PrintHQ',function(ev){
                        self.PrintHQ(); 
                        });                                               

  // mouse callbacks.
  var fn = this.MouseCallBack.bind(this);
  if(!isIOS()){
    $(this.element).on('click.'     +this.NameSpace, fn);
    $(this.element).on('mousedown.' +this.NameSpace, fn);
    $(this.element).on('mouseenter.'+this.NameSpace, fn);
    $(this.element).on('mouseout.'  +this.NameSpace, fn);
    $(window)      .on('mousemove.' +this.NameSpace, fn);
    $(window)      .on('mouseup.'   +this.NameSpace, fn);
    $(this.element).on('mousewheel.'+this.NameSpace, function(ev,d){if (ev.ctrlKey){return fn(ev,d);} else return true;});
  }

  $(this.element).on('touchstart.'+this.NameSpace, fn);
  $(this.element).on('touchend.'  +this.NameSpace, fn);
  $(this.element).on('touchmove.' +this.NameSpace, fn);
  $(this.element).on('touchenter.'+this.NameSpace, fn);
  $(this.element).on('touchout.'  +this.NameSpace, fn);


  // Bind the magnifier draw commands.
  this.Clear();
}

Pad.prototype.SetMagnify = function()
{
  // Turns on magnifying glass effect.
  // Can't be turned off.
  this.Draw = this.MagnifierDraw;
  this.fMagnifierOn = true;
  // var self = this;
  // $(this.element).mouseout(function(ev) { 
  //   self.fMouseInContentArea = false; 
  //   self.DoMouse(ev);
  //   self.Draw(); 
  // });
  // $(this.element).mousemove(function(ev) { 
  //     self.fMouseInContentArea = true; 
  //     var offset = getAbsolutePosition(self.element);
  //     self.fMagMouseX = ev.pageX - offset.x;
  //     self.fMagMouseY = ev.pageY - offset.y; 
  //     self.DoMouse(ev);
  //     self.Draw();
  // });
    
};


Pad.prototype.MouseCallBack = function(ev,scrollDist)
{
  var profname = "mousecallback"+this.UniqueId;
  // All mouse-related callbacks are routed through here.
  this.dirty = false;  // flag that tells us if we need a draw or not.


  if( (ev.type === 'mousemove' || ev.type === 'touchenter') &&
      ( ! this.fMouseInContentArea ) &&
      ( ! ev.which ) ) {
    // mouse move without buttons outside the content area. This is not relevant.
    return;  
  } 


  if(ev.type === 'mouseenter' || ev.type === 'touchenter') { 
    this.fMouseInContentArea = true;
    // Don't redraw unless there's a mousemove event. if(this.fMagnifierOn) this.dirty=true; 
  }


  // Set a redraw if we've moved inside the pad.
  if(ev.type === 'mousemove' || ev.type === 'touchenter') { 
    if(this.fMouseInContentArea && this.fMagnifierOn) { this.dirty=true; }
  }
  
  // If the mouse enters or leaves (or element) then flag the correct thing to do.
  if(ev.type === 'mouseout' || ev.type == 'touchend')     { 
    this.fMouseInContentArea = false;
    if(this.fMagnifierOn) this.dirty=true; 
  }


  // Do computations once for the subclass.
  var offset = getAbsolutePosition(this.element);
  this.fMousePos = {
    x: ev.pageX - offset.x,
    y: ev.pageY - offset.y,
  };
  if(this.rotate_90) {
    this.fMousePos.x = (this.span_x)-(ev.pageY-offset.y);
    this.fMousePos.y = ev.pageX-offset.x;
  }    
  
  this.fMousePos.u = this.GetU(this.fMousePos.x);
  this.fMousePos.v = this.GetV(this.fMousePos.y);

  // console.profile(profname);

  var bubble = true;
  if(ev.type === 'mousewheel') bubble=this.DoMouseWheel(ev,scrollDist);
  else                         bubble = this.DoMouse(ev); // User callback.  User must set dirty=true to do a draw.
  // console.warn("Pad::MouseCallBack",ev,this.fMouseInContentArea,this.dirty);


  if(this.dirty) this.Draw();
  // console.profileEnd();
  return bubble;
};


Pad.prototype.Resize = function()
{
  // Set this object and canvas properties.
  
  var width = this.width;
  var height = this.height;
  if( !$(this.element).is(":hidden") ) {
    width = $(this.element).width();
    height = $(this.element).height(); 
    // console.log("Resize",this,width,height);
  }
  this.width = width;
  this.height = height;

  this.padPixelScaling = 1;
  if(window.devicePixelRatio > 1) {
    // Retina display! Cool!
    this.padPixelScaling = window.devicePixelRatio;
  }

  console.log("Resize",$(this.element),width,height);
  for(var i=0;i<this.nlayers;i++) {
  
    this.layers[i].width = width;
    this.layers[i].height = height;
    this.layers[i].setAttribute('width', width *  this.padPixelScaling);
    this.layers[i].setAttribute('height', height *  this.padPixelScaling);
    $(this.layers[i]).css('width', width );
    $(this.layers[i]).css('height', height );
    if(this.create_2dcontext){
      this.ctxs[i].setTransform(1, 0, 0, 1, 0, 0);  // Reset all transforms
      this.ctxs[i].scale(this.padPixelScaling,this.padPixelScaling);
      if(this.rotate_90){
           this.ctx.translate(0,this.height);
           this.ctx.rotate(-Math.PI/2);       
      }
    }
  }

  if(this.rotate_90) {
    width    = this.canvas.height/  this.padPixelScaling;
    this.width   = this.canvas.height/  this.padPixelScaling;
    height   = this.canvas.width/  this.padPixelScaling;
    this.height  = this.canvas.width/  this.padPixelScaling;    
  }  


    
  this.origin_x = this.margin_left;
  this.origin_y = height - this.margin_bottom;
  
  this.span_x = width-this.margin_right -this.origin_x;
  this.span_y = this.origin_y-this.margin_top;
  
  // Protect against the crazy.
  if(this.span_x < 10) this.span_x = 10;
  if(this.span_y < 10) this.span_y = 10;
};

Pad.prototype.GetGoodTicks = function( min, max, maxticks, logscale ) 
{
  // console.warn("GetGoodTicks:",min,max,maxticks,logscale);
  var dumbTickWidth = (max - min) / maxticks;
  var thelog = 0.4342944 * Math.log(dumbTickWidth);  // ie. log10(dumbTickWidth)
  var multiplier = Math.pow(10, Math.floor(thelog));
  var abcissa = Math.pow(10, thelog) / multiplier;
  // Gives a number between 1 and 9.999
  var sigfigs = 1;
  var goodTickWidth = dumbTickWidth;
  var i,retval;
  if(maxticks<=0) maxticks = 1;
  
  if (logscale === false)
   {
      if (abcissa < 2.5) {
          goodTickWidth = 2 * multiplier;
          // sigfigs = 2;
      } else if (abcissa < 7.0) {
          goodTickWidth = 5.0 * multiplier;
      } else {
          goodTickWidth = 10.0 * multiplier;
      }

      var x = Math.ceil(min / goodTickWidth) * goodTickWidth;
      // console.warn("goodticks: goodTickWidth = ",goodTickWidth,multiplier);
      retval = new Array(0);
      i = 0;
      while (x < max) {
          retval[i] = ((x*10000).toFixed(0)/10000); // Limit to 4 decimal places, to keep from gettting things like 2.2000000001
          // console.log("goodticks " + i + " " + retval[i]);
          x += goodTickWidth;
          i++;
      }


      //cout << "Good width " << goodTickWidth << endl;
      return retval;
      
  } else { // Logscale == true

      var low10 = Math.ceil(Math.LOG10E * Math.log(min));
      var high10 = Math.ceil(Math.LOG10E * Math.log(max));
      var width = 1;
      // console.log(low10,high10,width,maxticks,width);
      while (((high10 - low10) / width) > maxticks) width += 1;
      var retval = [];
      var p = low10;
      var i = 0;
      while (p < high10) {
          retval[i++] = Math.pow(10, p);
          p += width;
      }
      if(retval.length<2) {
        // there wasn't a whole factof of 10 in there.
        return this.GetGoodTicks( min, max, 2, false ); // Find 2 regular ticks
      }
      
      return retval;
  }
};

Pad.prototype.GetGoodTicksTime = function( min, max, maxticks, logscale ) 
{
  // Find good tick mark positions for a time axis.  
  var dumbTickWidth = (max - min) / maxticks;
  
  // Round up to the nearest real time unit.  
  var scale = 1;
  if(dumbTickWidth>31536000)   scale = 31536000;
  else if(dumbTickWidth>86400) scale = 86400; 
  else if(dumbTickWidth>3600)  scale = 3600;
  else if(dumbTickWidth>60)    scale = 60;
  var ticks = this.GetGoodTicks(min/scale,max/scale,maxticks,logscale);
  for(var i=0;i<ticks.length;i++) ticks[i]*=scale;
  return ticks;
};




Pad.prototype.Clear = function()
{
  //console.log("Pad.Clear()");
  if (!this.ctx) return;
  this.ctx.fillStyle = "rgb("+this.bg_color+")";
  this.ctx.fillRect(0,0,this.width,this.height);
  // Clear overlays too if you clear everything.
  this.ClearOverlays();
};

Pad.prototype.ClearOverlays = function()
{
  for(var i = 1; i<this.nlayers; i++) this.ClearLayer(i);
  
}

Pad.prototype.ClearLayer = function(lay)
{
  //console.log("Pad.Clear()");
  if (!this.ctxs[lay]) return;
  this.ctxs[lay].clearRect(0,0,this.width,this.height);
};


Pad.prototype.DrawFrame = function()
{
  if (!this.ctx) return;
    this.ctx.fillStyle = "rgb(0,0,0)";
    this.ctx.strokeStyle = "rgb(0,0,0)";

    // Sanity.
    if(this.log_y && this.min_v <=0) {      
      this.min_v = Math.min(this.max_v/100 , 0.5);
      
    } 
    
    if(this.draw_axes) {
    // Draw the axes.
    this.ctx.fillRect(this.origin_x-2,this.origin_y,this.width-this.margin_right-this.origin_x,2);
    //ctx.fillStyle = "rgb(0,200,0)";
    this.ctx.fillRect(this.origin_x-2,this.margin_top,2,this.origin_y-this.margin_top);
    }
    if(this.draw_box) {
      // Draw the box.
      this.ctx.strokeStyle = "rgba(0,0,0,0.75)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(this.origin_x,             this.origin_y);
      this.ctx.lineTo(this.origin_x+this.span_x, this.origin_y);
      this.ctx.lineTo(this.origin_x+this.span_x, this.origin_y-this.span_y);
      this.ctx.lineTo(this.origin_x,             this.origin_y-this.span_y);
      this.ctx.lineTo(this.origin_x,             this.origin_y);
      this.ctx.stroke();      
    }
    
    // Draw labels
    this.ctx.font = this.label_font;
    this.ctx.textAlign = 'right';

    if(this.xlabel && $('#ctl-show-labels').is(':checked')) {
      this.ctx.save();
      this.ctx.translate(this.width-this.margin_right, this.height);
      this.ctx.textBaseline = 'bottom';
      // scale to fit.
      var scale = (this.span_x+1) / (this.ctx.measureText(this.xlabel)+1);
      if(scale < 1) this.ctx.scale(scale,scale);
      this.ctx.fillText(this.xlabel, 0,0);
      this.ctx.restore();
    }
    
    if(this.ylabel && $('#ctl-show-labels').is(':checked')) {
      this.ctx.save();
      this.ctx.translate(0,this.margin_top);      
      this.ctx.rotate(-90*3.1416/180);
      //this.ctx.drawTextRight(font,fontsize,0,+asc,this.ylabel);
      var scale = (this.span_y+1) / (this.ctx.measureText(this.ylabel)+1);
      if(scale < 1) this.ctx.scale(scale,scale);
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(this.ylabel, 0, 0);    
      this.ctx.restore();
    }


    var tickLen = 8;
    var ticks, nt, i;
    
    if(this.draw_ticks_x || this.draw_tick_labels_x || this.draw_grid_x)
    {
      // Do the X-axis.
      this.ctx.font = this.tick_label_font;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      if(this.time_on_x) {ticks = this.GetGoodTicksTime(this.min_u, this.max_u, Math.round(this.span_x/this.tick_pixels_x), false); }
      else               ticks = this.GetGoodTicks(this.min_u, this.max_u, Math.round(this.span_x/this.tick_pixels_x), false);
      //console.log(this.fName + " " + ticks + " " + this.min_u + " " + this.max_u);
      nt = ticks.length;
      for(i=0;i<nt;i++) {
        var ttick = ticks[i];
        var x = this.GetX(ttick);
        if(this.draw_grid_x) {
          this.ctx.fillStyle = "rgba(100,100,100,0.5)";
          this.ctx.fillRect(x,this.origin_y-this.span_y,0.5,this.span_y);          
        }
        if($('#ctl-show-tick-labels').is(':checked')) {
          if(this.draw_ticks_x) {
            this.ctx.fillStyle = "rgba(0,0,0,1.0)";
            this.ctx.fillRect(x,this.origin_y,1,tickLen);
          }
          if(this.draw_tick_labels_x){
            this.ctx.fillStyle = "rgba(20,20,20,1.0)";
            //this.ctx.drawTextCenter(font,fontsize,x,this.origin_y+tickLen+asc,String(ttick));
            if(this.time_on_x) {
              var timetick = new Date(ttick*1000);
              var timetext = timetick.getHours() + ":" + zeropad(timetick.getMinutes(),2) + ":" + zeropad(timetick.getSeconds(),2);
              this.ctx.fillText(timetext, x, this.origin_y+tickLen);
              var datetext = timetick.getDate() + "/" + (timetick.getMonth()+1) + "/" + (timetick.getFullYear()-2000);
              this.ctx.fillText(datetext, x, this.origin_y+tickLen+12);
            } else {
              this.ctx.fillText(String(ttick), x, this.origin_y+tickLen);
            }
          } // draw_tick_labels_x
        }
      }
    }
    
    if(this.draw_ticks_y || this.draw_tick_labels_y || this.draw_grid_y)
    {
      // Draw Y ticks
      this.ctx.font = this.tick_label_font;
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      ticks = this.GetGoodTicks(this.min_v, this.max_v, Math.round(this.span_y/this.tick_pixels_y), this.log_y);
      nt = ticks.length;
      for( i=0;i<nt;i++) {
        var ftick = ticks[i];
        var y = this.GetY(ftick);
        if($('#ctl-show-tick-labels').is(':checked')) {
          if(this.draw_ticks_y) {
            this.ctx.fillStyle = "rgba(0,0,0,1.0)";
            this.ctx.fillRect(this.origin_x-tickLen,y,tickLen,1);
          }
          if(this.draw_tick_labels_y) {
            this.ctx.fillStyle = "rgba(20,20,20,1.0)";
            //this.ctx.drawTextRight(font,fontsize,this.origin_x-tickLen,y+asc/2,String(ftick));
            var stick = String(ftick);
            if(stick.length>5) stick = scientific_notation(ftick);
            this.ctx.fillText(stick, this.origin_x-tickLen-1, y);
          }
        }
        if(this.draw_grid_y) {
          this.ctx.fillStyle = "rgba(100,100,100,1.0)";         
          this.ctx.fillRect(this.origin_x,y,this.span_x,0.5); // Draw across fill area, too       
          this.ctx.fillStyle = "rgba(100,100,100,1.0)";         
          this.ctx.fillRect(this.origin_x,y,this.span_x,0.5); // Draw across fill area, too       
        }        
     }
  }  
};

Pad.prototype.Draw = function()
{
  this.Clear();
  this.DrawFrame();
  this.DrawOverlays();
};

Pad.prototype.DrawOverlays = function()
{
  
}

Pad.prototype.GetX = function( u ) 
{
  return this.origin_x + this.span_x*(u-this.min_u)/(this.max_u-this.min_u);
};

Pad.prototype.GetY = function( v ) 
{
  return this.origin_y - this.span_y*(v-this.min_v)/(this.max_v-this.min_v);
};

Pad.prototype.GetU = function( x ) 
{
  return (x-this.origin_x)/this.span_x*(this.max_u-this.min_u) + this.min_u;
};

Pad.prototype.GetV = function( y ) 
{
  return (this.origin_y-y)/this.span_y*(this.max_v-this.min_v) + this.min_v;
};

Pad.prototype.PrintHQ = function()
{
  // First, save our current state.
  var saveCanvas = this.canvas;
  var saveCtx    = this.ctx;
  var saveWidth  = this.width;
  var saveHeight = this.height;
  
  // Second, create an offscreen drawing context.   
  var canvas = document.createElement("canvas");
  this.canvas = canvas;
  canvas.width = saveWidth * gPrintScale;
  canvas.height = saveHeight * gPrintScale;
  // this.width  = saveWidth * gPrintScale;
  // this.height = saveHeight * gPrintScale;
  this.ctx = this.canvas.getContext("2d",{alpha:false}); // canvas is not transparent - may speed up some engines.  
  this.ctx.imageSmoothingEnabled= false
  this.ctx.mozImageSmoothingEnabled= false

  // Now do the actual draw
  // this.Resize();
  this.ctx.scale(gPrintScale,gPrintScale);
  this.Draw();
  
  // Save the print result
  gPrintBuffer = this.canvas.toDataURL('image/png');

  
  // Restore defaults.
  this.canvas = saveCanvas;
  this.ctx    = saveCtx;  
};



Pad.prototype.MagnifierDraw = function(arg)
{
  // 
  // To use: call this from Draw()
  // or set the Draw() function to be this.
  // Calls DrawOne() to do the actual work.
  if($(this.element).is(":hidden")) return;
  // console.warn("Draw",this.plane);
  // console.trace();
  
  // pop all saves. I want the top.
  // this.ctx.restore();
  // this.ctx.restore();
  // this.ctx.restore();
  // this.ctx.restore();
  // this.ctx.restore();

  this.mag_scale = 1.0;
  this.magnifying = false;
  this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v, arg);
  if((this.fMouseInContentArea) && ($('#ctl-magnifying-glass').is(':checked')) )
  {
    if(this.fMousePos.x < this.origin_x) return;
    if(this.fMousePos.y > this.origin_y) return;
    
    this.magnifying = true;
    
    // Cleverness:
    this.mag_radius = parseFloat($('#ctl-magnifier-size').val());
    this.mag_scale  = parseFloat($('#ctl-magnifier-mag').val());
    

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "black";
    
    this.ctx.beginPath();
    this.ctx.arc(this.fMousePos.x,this.fMousePos.y, this.mag_radius+1, 0,1.9999*Math.PI,false);
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.fMousePos.x,this.fMousePos.y, this.mag_radius, 0,Math.PI*2,true);
    this.ctx.clip();

    this.ctx.translate((1-this.mag_scale)*this.fMousePos.x,(1-this.mag_scale)*this.fMousePos.y);
    this.ctx.scale(this.mag_scale,this.mag_scale);

    // Find new draw limits in u/v coords:
    var umin = this.GetU(this.fMousePos.x-this.mag_radius);
    var umax = this.GetU(this.fMousePos.x+this.mag_radius);
    var vmax = this.GetV(this.fMousePos.y-this.mag_radius);
    var vmin = this.GetV(this.fMousePos.y+this.mag_radius);

    this.DrawOne(umin,umax,vmin,vmax,arg);
    this.ctx.restore();
  } 
  this.mag_scale = 1.0;
  
};

Pad.prototype.DoMouse = function(ev)
{
  // Override me to read the mouse position.
};

Pad.prototype.DoMouseWheel = function(ev,dist)
{
  // Override me to read the mouse position.
  return true;
};


Pad.prototype.DoMousePanAndScale = function(ev)
{
  // First, deal with mouse-ups that are probably outside my region.
  if(ev.type === 'mouseenter') return; // dont need to deal with this.
  if(ev.type === 'mouseout') return;   // dont need to deal with this.

  // This is a mouse-up
  if(ev.type === 'mouseup') {
    if( this.fDragging) {
      this.fDragging = false;
      // Update thorough
      this.MouseChangedUV({},true);
      this.dirty = false;
      // Draw gets issued by the trigger.
    }
    return;
  }
  ev.originalEvent.preventDefault();
  
  // Which area is mouse start in?
  var mouse_area;
  if(this.fMousePos.y > this.origin_y ) {
    if(this.mouse_scale_min_u) mouse_area = "xscale_left";
    if(this.mouse_scale_max_u) mouse_area = "xscale-right";
    if(this.mouse_scale_max_u && this.mouse_scale_min_u && this.fMousePos.x< (this.origin_x + this.span_x/2)) mouse_area = "xscale-left";  
  } else if(this.fMousePos.x < this.origin_x) {
    if(this.mouse_scale_min_v) mouse_area = "yscale_down";
    if(this.mouse_scale_max_v) mouse_area = "yscale-up";
    if(this.mouse_scale_max_v && this.mouse_scale_min_u && this.fMousePos.y > (this.origin_y - this.span_y/2)) mouse_area = "yscale-down";  
  } else {
    if(this.mouse_pan_u || this.mouse_pan_v)
      mouse_area = "body-pan";
  }
  // Change cursor.
  switch(mouse_area) {
    case "body-pan":     this.canvas.style.cursor = "move"; break;
    case "xscale-right": this.canvas.style.cursor = "e-resize";  break;
    case "xscale-left":  this.canvas.style.cursor = "w-resize";  break;
    case "yscale-up":    this.canvas.style.cursor = "n-resize"; break;
    case "yscale-down":  this.canvas.style.cursor = "s-resize"; break;
  }
  
  
  var relx, rely;  
  var new_limits = {};
  if(this.fDragging) {
      // Update new zoom position or extent...
    if(this.fMouseStart.area == "body-pan"){
      var dx = this.fMousePos.x - this.fMouseLast.x;
      var du = dx * (this.max_u-this.min_u)/(this.span_x);

      var dy = this.fMousePos.y - this.fMouseLast.y;
      var dv = -dy * (this.max_v-this.min_v)/(this.span_y);
      
      this.fMouseLast = $.extend({},this.fMousePos); // copy.
      
      if(this.mouse_pan_u) { new_limits.min_u = this.min_u -du; 
                             new_limits.max_u = this.max_u -du; 
                             };
      if(this.mouse_pan_v) { new_limits.min_v = this.min_v -dv; 
                             new_limits.max_v = this.max_v -dv; 
                            };
      return this.MouseChangedUV( new_limits, false );
      
    } else if(this.fMouseStart.area == "xscale-right") {
      relx = this.fMousePos.x - this.origin_x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      // Want the T I started at to move to the current posistion by scaling.
      var new_max_u = this.span_x * (this.fMouseStart.u-this.min_u)/relx + this.min_u;
      new_limits.max_u = new_max_u;
      return this.MouseChangedUV( new_limits, false );
            
    } else if(this.fMouseStart.area == "xscale-left") {
      relx = this.origin_x + this.span_x - this.fMousePos.x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      var new_min_u = this.max_u - this.span_x * (this.max_u - this.fMouseStart.u)/relx;
      new_limits.min_u = new_min_u;
      return this.MouseChangedUV( new_limits, false );
      
    } else if(this.fMouseStart.area == "yscale-up") {
      rely =  this.origin_y - this.fMousePos.y;
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      var new_max_v = this.span_y * (this.fMouseStart.v-this.min_v)/rely + this.min_v;
      new_limits.max_v = new_max_v;
      return this.MouseChangedUV( new_limits, false );
    
    }else if(this.fMouseStart.area == "yscale-down") {
      rely =  this.fMousePos.y - (this.origin_y - this.span_y);
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      var new_min_v = this.max_v - this.span_y * (this.max_v-this.fMouseStart.v)/rely;
      new_limits.min_v = new_min_v;
      return this.MouseChangedUV( new_limits, false );      
    }
  }
    
  if(ev.type === 'mousedown' && this.fMouseInContentArea) {
    // Check to see if object is draggable, instead of the view.
    this.fMouseStart= $.extend({},this.fMousePos); // copy.
    this.fMouseLast = $.extend({},this.fMousePos); // copy.
    this.fMouseStart.area = mouse_area;

    this.fDragging = true;
  }
  


  
}

Pad.prototype.MouseChangedUV = function( new_limits, finished ) 
{
  // Override this function to do things when the limits change.
  // example newlimits = { min_v: 90, max_v: 45  } means u coordinates haven't changed, but min and max have
  // 'finished' is true if user has finished dragging the mouse and the mouseup has fired; otherwise she's in the middle of a drag operation.
  $.extend(this,new_limits);
  this.Draw();
}



// utility to do text wrapping.
function getLines(ctx,phrase,maxPxLength,textStyle) {
    var wa=phrase.split(" "),
        phraseArray=[],
        lastPhrase=wa[0],
        l=maxPxLength,
        measure=0;
    ctx.font = textStyle;
    if(wa.length==1) return wa;
    for (var i=1;i<wa.length;i++) {
        var w=wa[i];
        measure=ctx.measureText(lastPhrase+w).width;
        if (measure<l) {
            lastPhrase+=(" "+w);
        }else {
            phraseArray.push(lastPhrase);
            lastPhrase=w;
        }
        if (i===wa.length-1) {
            phraseArray.push(lastPhrase);
            break;
        }
    }
    return phraseArray;
}


// Utility to map css to rgb colors.
function RGBColor(color_string)
{
    this.ok = false;

    // strip any leading #
    if (color_string.charAt(0) == '#') { // remove # if any
        color_string = color_string.substr(1,6);
    }

    color_string = color_string.replace(/ /g,'');
    color_string = color_string.toLowerCase();

    // before getting into regexps, try simple matches
    // and overwrite the input
    var simple_colors = {
        aliceblue: 'f0f8ff',
        antiquewhite: 'faebd7',
        aqua: '00ffff',
        aquamarine: '7fffd4',
        azure: 'f0ffff',
        beige: 'f5f5dc',
        bisque: 'ffe4c4',
        black: '000000',
        blanchedalmond: 'ffebcd',
        blue: '0000ff',
        blueviolet: '8a2be2',
        brown: 'a52a2a',
        burlywood: 'deb887',
        cadetblue: '5f9ea0',
        chartreuse: '7fff00',
        chocolate: 'd2691e',
        coral: 'ff7f50',
        cornflowerblue: '6495ed',
        cornsilk: 'fff8dc',
        crimson: 'dc143c',
        cyan: '00ffff',
        darkblue: '00008b',
        darkcyan: '008b8b',
        darkgoldenrod: 'b8860b',
        darkgray: 'a9a9a9',
        darkgreen: '006400',
        darkkhaki: 'bdb76b',
        darkmagenta: '8b008b',
        darkolivegreen: '556b2f',
        darkorange: 'ff8c00',
        darkorchid: '9932cc',
        darkred: '8b0000',
        darksalmon: 'e9967a',
        darkseagreen: '8fbc8f',
        darkslateblue: '483d8b',
        darkslategray: '2f4f4f',
        darkturquoise: '00ced1',
        darkviolet: '9400d3',
        deeppink: 'ff1493',
        deepskyblue: '00bfff',
        dimgray: '696969',
        dodgerblue: '1e90ff',
        feldspar: 'd19275',
        firebrick: 'b22222',
        floralwhite: 'fffaf0',
        forestgreen: '228b22',
        fuchsia: 'ff00ff',
        gainsboro: 'dcdcdc',
        ghostwhite: 'f8f8ff',
        gold: 'ffd700',
        goldenrod: 'daa520',
        gray: '808080',
        green: '008000',
        greenyellow: 'adff2f',
        honeydew: 'f0fff0',
        hotpink: 'ff69b4',
        indianred : 'cd5c5c',
        indigo : '4b0082',
        ivory: 'fffff0',
        khaki: 'f0e68c',
        lavender: 'e6e6fa',
        lavenderblush: 'fff0f5',
        lawngreen: '7cfc00',
        lemonchiffon: 'fffacd',
        lightblue: 'add8e6',
        lightcoral: 'f08080',
        lightcyan: 'e0ffff',
        lightgoldenrodyellow: 'fafad2',
        lightgrey: 'd3d3d3',
        lightgreen: '90ee90',
        lightpink: 'ffb6c1',
        lightsalmon: 'ffa07a',
        lightseagreen: '20b2aa',
        lightskyblue: '87cefa',
        lightslateblue: '8470ff',
        lightslategray: '778899',
        lightsteelblue: 'b0c4de',
        lightyellow: 'ffffe0',
        lime: '00ff00',
        limegreen: '32cd32',
        linen: 'faf0e6',
        magenta: 'ff00ff',
        maroon: '800000',
        mediumaquamarine: '66cdaa',
        mediumblue: '0000cd',
        mediumorchid: 'ba55d3',
        mediumpurple: '9370d8',
        mediumseagreen: '3cb371',
        mediumslateblue: '7b68ee',
        mediumspringgreen: '00fa9a',
        mediumturquoise: '48d1cc',
        mediumvioletred: 'c71585',
        midnightblue: '191970',
        mintcream: 'f5fffa',
        mistyrose: 'ffe4e1',
        moccasin: 'ffe4b5',
        navajowhite: 'ffdead',
        navy: '000080',
        oldlace: 'fdf5e6',
        olive: '808000',
        olivedrab: '6b8e23',
        orange: 'ffa500',
        orangered: 'ff4500',
        orchid: 'da70d6',
        palegoldenrod: 'eee8aa',
        palegreen: '98fb98',
        paleturquoise: 'afeeee',
        palevioletred: 'd87093',
        papayawhip: 'ffefd5',
        peachpuff: 'ffdab9',
        peru: 'cd853f',
        pink: 'ffc0cb',
        plum: 'dda0dd',
        powderblue: 'b0e0e6',
        purple: '800080',
        red: 'ff0000',
        rosybrown: 'bc8f8f',
        royalblue: '4169e1',
        saddlebrown: '8b4513',
        salmon: 'fa8072',
        sandybrown: 'f4a460',
        seagreen: '2e8b57',
        seashell: 'fff5ee',
        sienna: 'a0522d',
        silver: 'c0c0c0',
        skyblue: '87ceeb',
        slateblue: '6a5acd',
        slategray: '708090',
        snow: 'fffafa',
        springgreen: '00ff7f',
        steelblue: '4682b4',
        tan: 'd2b48c',
        teal: '008080',
        thistle: 'd8bfd8',
        tomato: 'ff6347',
        turquoise: '40e0d0',
        violet: 'ee82ee',
        violetred: 'd02090',
        wheat: 'f5deb3',
        white: 'ffffff',
        whitesmoke: 'f5f5f5',
        yellow: 'ffff00',
        yellowgreen: '9acd32'
    };
    for (var key in simple_colors) {
        if (color_string == key) {
            color_string = simple_colors[key];
        }
    }
    // emd of simple type-in colors

    // array of color definition objects
    var color_defs = [
        {
            re: /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/,
            example: ['rgb(123, 234, 45)', 'rgb(255,234,245)'],
            process: function (bits){
                return [
                    parseInt(bits[1]),
                    parseInt(bits[2]),
                    parseInt(bits[3])
                ];
            }
        },
        {
            re: /^(\w{2})(\w{2})(\w{2})$/,
            example: ['#00ff00', '336699'],
            process: function (bits){
                return [
                    parseInt(bits[1], 16),
                    parseInt(bits[2], 16),
                    parseInt(bits[3], 16)
                ];
            }
        },
        {
            re: /^(\w{1})(\w{1})(\w{1})$/,
            example: ['#fb0', 'f0f'],
            process: function (bits){
                return [
                    parseInt(bits[1] + bits[1], 16),
                    parseInt(bits[2] + bits[2], 16),
                    parseInt(bits[3] + bits[3], 16)
                ];
            }
        }
    ];

    // search through the definitions to find a match
    for (var i = 0; i < color_defs.length; i++) {
        var re = color_defs[i].re;
        var processor = color_defs[i].process;
        var bits = re.exec(color_string);
        if (bits) {
            channels = processor(bits);
            this.r = channels[0];
            this.g = channels[1];
            this.b = channels[2];
            this.ok = true;
        }

    }

    // validate/cleanup values
    this.r = (this.r < 0 || isNaN(this.r)) ? 0 : ((this.r > 255) ? 255 : this.r);
    this.g = (this.g < 0 || isNaN(this.g)) ? 0 : ((this.g > 255) ? 255 : this.g);
    this.b = (this.b < 0 || isNaN(this.b)) ? 0 : ((this.b > 255) ? 255 : this.b);

    // some getters
    this.toRGB = function () {
        return 'rgb(' + this.r + ', ' + this.g + ', ' + this.b + ')';
    }
    this.toHex = function () {
        var r = this.r.toString(16);
        var g = this.g.toString(16);
        var b = this.b.toString(16);
        if (r.length == 1) r = '0' + r;
        if (g.length == 1) g = '0' + g;
        if (b.length == 1) b = '0' + b;
        return '#' + r + g + b;
    }

    // help
    this.getHelpXML = function () {

        var examples = new Array();
        // add regexps
        for (var i = 0; i < color_defs.length; i++) {
            var example = color_defs[i].example;
            for (var j = 0; j < example.length; j++) {
                examples[examples.length] = example[j];
            }
        }
        // add type-in colors
        for (var sc in simple_colors) {
            examples[examples.length] = sc;
        }

        var xml = document.createElement('ul');
        xml.setAttribute('id', 'rgbcolor-examples');
        for (var i = 0; i < examples.length; i++) {
            try {
                var list_item = document.createElement('li');
                var list_color = new RGBColor(examples[i]);
                var example_div = document.createElement('div');
                example_div.style.cssText =
                        'margin: 3px; '
                        + 'border: 1px solid black; '
                        + 'background:' + list_color.toHex() + '; '
                        + 'color:' + list_color.toHex()
                ;
                example_div.appendChild(document.createTextNode('test'));
                var list_item_value = document.createTextNode(
                    ' ' + examples[i] + ' -> ' + list_color.toRGB() + ' -> ' + list_color.toHex()
                );
                list_item.appendChild(example_div);
                list_item.appendChild(list_item_value);
                xml.appendChild(list_item);

            } catch(e){}
        }
        return xml;

    }

}
