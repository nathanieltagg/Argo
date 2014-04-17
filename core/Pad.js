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

function scientific_notation(x)
{
  return x.toExponential();
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
  var defaults = {
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
    bg_color : "255,255,255",
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
    fMouseInContentArea : false
    
  };
  // override defaults with options.
  $.extend(true,defaults,options);
  
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
  
  // Look for an existing canvas, and build one if it's not there.
  if($('canvas',this.element).length<1) {
    this.canvas = document.createElement("canvas");
    this.element.appendChild(this.canvas);

    if (typeof FlashCanvas != "undefined") {
        FlashCanvas.initElement(this.canvas);
    }

  } else {
    this.canvas = $('canvas',this.element).get(0);    
  }
  $(this.canvas).css("height",0);

  // Build the drawing context.
  this.ctx = this.canvas.getContext('2d');
  if(initCanvas) this.ctx = initCanvas(this.canvas).getContext('2d');
  if(!this.ctx) console.log("Problem getting context!");
  
  console.warn("Pad created canvas with ", $(this.canvas).css("height"),$(this.canvas).height());
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
    
}


Pad.prototype.MouseCallBack = function(ev)
{
  // All mouse-related callbacks are routed through here.
  this.dirty = false;  // flag that tells us if we need a draw or not.

  // Set a redraw if we've moved inside the pad.
  if(ev.type === 'mousemove' || ev.type === 'touchenter') { 
    if(this.fMouseInContentArea) {
      if(this.fMagnifierOn) this.dirty=true;
    } else {
      if(!ev.which) return; // No reason the object needs to know about mouse moves when mouse is up.
    }
    // console.warn("Pad mousemove",this.fMouseInContentArea,this.plane);
    
  }
  // If the mouse enters or leaves (or element) then flag the correct thing to do.
  if(ev.type === 'mouseout' || ev.type == 'touchend')     { 
    this.fMouseInContentArea = false;
    if(this.fMagnifierOn) this.dirty=true; 
  }
  if(ev.type === 'mouseenter' || ev.type === 'touchenter') { 

    this.fMouseInContentArea = true;
    // Don't redraw unless there's a mousemove event. if(this.fMagnifierOn) this.dirty=true; 
  }

  // Do computations once for the subclass.
  var offset = getAbsolutePosition(this.element);
  this.fMousePos = {
    x: ev.pageX - offset.x,
    y: ev.pageY - offset.y,
  };
  this.fMousePos.u = this.GetU(this.fMousePos.x);
  this.fMousePos.v = this.GetV(this.fMousePos.y);
  
  var bubble = this.DoMouse(ev); // User callback.  User must set dirty=true to do a draw.
  // console.warn("Pad::MouseCallBack",ev,this.fMouseInContentArea,this.dirty);

  if(this.dirty) this.Draw();
  return bubble;
}


Pad.prototype.Resize = function()
{
  // Set this object and canvas properties.
  var width = this.width;
  var height = this.height;
  if( !$(this.element).is(":hidden") ) {
    width = $(this.element).width();
    height = $(this.element).height(); 
    console.log("Resize",this,width,height);
  }
  // console.log("Resize",$(this.element),width,height);

  this.canvas.width = this.width = width;
  this.canvas.height = this.height = height;
  this.padPixelScaling = 1;
  
  if(window.devicePixelRatio > 1) {
    // Retina display! Cool!
    this.padPixelScaling = window.devicePixelRatio;
  }
  // this.canvas.width = width * window.devicePixelRatio;
  // this.canvas.height = height * window.devicePixelRatio;
  this.canvas.setAttribute('width', width *  this.padPixelScaling);
  this.canvas.setAttribute('height', height *  this.padPixelScaling);
  $(this.canvas).css('width', width );
  $(this.canvas).css('height', height );
  this.ctx.scale(this.padPixelScaling,this.padPixelScaling);
    
  this.origin_x = this.margin_left;
  this.origin_y = height - this.margin_bottom;

  this.span_x = width-this.margin_right -this.origin_x;
  this.span_y = this.origin_y-this.margin_top;
}

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
      var retval = new Array(0);
      var i = 0;
      while (x < max) {
          retval[i] = ((x*10000).toFixed(0)/10000); // Limit to 4 decimal places, to keep from gettting things like 2.2000000001
          // console.log("goodticks " + i + " " + retval[i]);
          x += goodTickWidth;
          i++;
      }


      //cout << "Good width " << goodTickWidth << endl;
      return retval;
  } else {
      var low10 = Math.ceil(0.4342944 * Math.log(min));
      var high10 = Math.ceil(0.4342944 * Math.log(max));
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
      return retval;
  }
}

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
}




Pad.prototype.Clear = function()
{
  //console.log("Pad.Clear()");
  if (!this.ctx) return;
  this.ctx.fillStyle = "rgb("+this.bg_color+")";
  this.ctx.fillRect(0,0,this.width,this.height);
}

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
      this.ctx.lineTo(this.origin_x,             this.origin_y)
      this.ctx.stroke();      
    }
    
    // Draw labels
    this.ctx.font = this.label_font;
    this.ctx.textAlign = 'right';

    if(this.xlabel && $('#ctl-show-labels').is(':checked')) {
      this.ctx.save();
      this.ctx.translate(this.width-this.margin_right, this.height);
      this.ctx.textBaseline = 'bottom';
      this.ctx.fillText(this.xlabel, 0,0);
      this.ctx.restore();
    }
    
    if(this.ylabel && $('#ctl-show-labels').is(':checked')) {
      this.ctx.save();
      this.ctx.translate(0,this.margin_top);      
      this.ctx.rotate(-90*3.1416/180);
      //this.ctx.drawTextRight(font,fontsize,0,+asc,this.ylabel);
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(this.ylabel, 0, 0);    
      this.ctx.restore();
    }



    if(this.draw_ticks_x || this.draw_tick_labels_x || this.draw_grid_x)
    {
      // Do the X-axis.
      var tickLen = 8;
      this.ctx.font = this.tick_label_font;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      var ticks;
      if(this.time_on_x) {ticks = this.GetGoodTicksTime(this.min_u, this.max_u, Math.round(this.span_x/this.tick_pixels_x), false); }
      else               ticks = this.GetGoodTicks(this.min_u, this.max_u, Math.round(this.span_x/this.tick_pixels_x), false);
      // console.log(this.fName + " " + ticks + " " + this.min_u + " " + this.max_u);
      var nt = ticks.length;
      for( var i=0;i<nt;i++) {
        var ttick = ticks[i];
        var x = this.GetX(ttick);
        if(this.draw_grid_x) {
          this.ctx.fillStyle = "rgba(100,100,100,0.5)";
          this.ctx.fillRect(x,this.origin_y-this.span_y,0.5,this.span_y);          
        }
        if($('#ctl-show-tick-labels').prop('checked')) {
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
      var tickLen = 8;
      this.ctx.font = this.tick_label_font;
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      var ticks = this.GetGoodTicks(this.min_v, this.max_v, Math.round(this.span_y/this.tick_pixels_y), this.log_y);
      var nt = ticks.length;
      for( var i=0;i<nt;i++) {
        var ftick = ticks[i];
        var y = this.GetY(ftick);
        if($('#ctl-show-tick-labels').prop('checked')) {
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
}

Pad.prototype.Draw = function()
{
  this.Clear();
  this.DrawFrame();
}


Pad.prototype.GetX = function( u ) 
{
  return this.origin_x + this.span_x*(u-this.min_u)/(this.max_u-this.min_u);
}

Pad.prototype.GetY = function( v ) 
{
  return this.origin_y - this.span_y*(v-this.min_v)/(this.max_v-this.min_v);
}

Pad.prototype.GetU = function( x ) 
{
  return (x-this.origin_x)/this.span_x*(this.max_u-this.min_u) + this.min_u;
}

Pad.prototype.GetV = function( y ) 
{
  return (this.origin_y-y)/this.span_y*(this.max_v-this.min_v) + this.min_v;
}

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
  this.ctx = this.canvas.getContext("2d");
  if(initCanvas) this.ctx = initCanvas(this.canvas).getContext('2d');

  // Now do the actual draw
  // this.Resize();
  this.ctx.scale(gPrintScale,gPrintScale);
  this.Draw();
  
  // Save the print result
  gPrintBuffer = this.canvas.toDataURL('image/png');

  
  // Restore defaults.
  this.canvas = saveCanvas;
  this.ctx    = saveCtx;  
  
  
  // nuke buffer.
  // document.removeChild(canvas); // Doesn't work. Is this thing a memory leak? I don't think so - I htink the canvas vanishes when it goes out of scope.
}



Pad.prototype.MagnifierDraw = function(arg)
{
  // 
  // To use: call this from Draw()
  // or set the Draw() function to be this.
  // Calls DrawOne() to do the actual work.
  if($(this.element).is(":hidden")) return;
  // console.warn("Draw",this.plane);
  // console.trace();

  this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v, arg);
  this.magnifying = false;
  if((this.fMouseInContentArea) && ($('#ctl-magnifying-glass').is(':checked')) )
  {
    if(this.fMousePos.x < this.origin_x) return;
    if(this.fMousePos.y > this.origin_y) return;
    
    this.magnifying = true;
    // Cleverness:
    var mag_radius = parseFloat($('#ctl-magnifier-size').val());
    var mag_scale  = parseFloat($('#ctl-magnifier-mag').val());
    

    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "black";
    
    this.ctx.beginPath();
    this.ctx.arc(this.fMousePos.x,this.fMousePos.y, mag_radius+1, 0,1.9999*Math.PI,false);
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.fMousePos.x,this.fMousePos.y, mag_radius, 0,Math.PI*2,true);
    this.ctx.clip();

    this.ctx.translate((1-mag_scale)*this.fMousePos.x,(1-mag_scale)*this.fMousePos.y);
    this.ctx.scale(mag_scale,mag_scale);

    // Find new draw limits in u/v coords:
    var umin = this.GetU(this.fMousePos.x-mag_radius);
    var umax = this.GetU(this.fMousePos.x+mag_radius);
    var vmax = this.GetV(this.fMousePos.y-mag_radius);
    var vmin = this.GetV(this.fMousePos.y+mag_radius);

    this.DrawOne(umin,umax,vmin,vmax,arg);
    this.ctx.restore();
  } 
}

Pad.prototype.DoMouse = function(ev)
{
  // Override me to read the mouse position.
}


// utility to do text wrapping.
function getLines(ctx,phrase,maxPxLength,textStyle) {
    var wa=phrase.split(" "),
        phraseArray=[],
        lastPhrase=wa[0],
        l=maxPxLength,
        measure=0;
    ctx.font = textStyle;
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

