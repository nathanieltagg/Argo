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


// Subclass of Pad.
HistCanvas.prototype = new Pad(null);           

function HistCanvas( element, options )
{
  // console.log('HistCanvas ctor');
  if(!element){
      // console.log("HistCanvas: NULL element supplied."); 
      return;
  }

  var settings = {
    // default settings:
    log_y : false,
    suppress_zero: false,
    draw_grid_y : true,
    draw_grid_x : false,
    margin_left : 30,
    margin_bottom : 40,
    draw_box : false,    
    margin_right : 10,
    margin_top : 10,
    xlabel : "X",
    ylabel : "Y",
    marker: null,
  	adjuct_display: false,
  	adjunct_height: 0,
		adunct_label: null,
    mouse_scale_max_u  : true,
    mouse_pan_u        : true,
    
    default_options : {
      doFill: true,
      doLine: false,
      doGraph: false,
      doDots: false,
      lineWidth: 1,
      strokeStyle: "black",
      composite: 'source-over',
      error_stroke: "#EEEEEE",
      error_lineWidth: '2',
      alpha: 1.0
    },
  };
  $.extend(true,settings,options); // Change defaults
  
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  this.SetLogy(this.log_y);

  // Now our own (non-customizable) setup.
  //data storage
  this.fNHist = 0;
  this.fHists = [];
  this.fColorScales = [];
  this.fHistOptions = []; // transparency settings
  
  this.fAdjunctData = [];

  // State model:
  this.fIsBeingDragged = false;
  this.fMouseInContent = false;
  this.fDragMode = "none";
  this.fDragStartX = 0; // start drag X coordinate, absolute, in pixels
  this.fDragStartT = 0; // start drag X coordinate, in display units.
  this.fDragStartY = 0; // in pixels
  this.fDragStartF = 0; // in display units

  if(!this.element) { return; }
  // This should work to rebind the event handler to this particular instance of the HistCanvas.
  // This gives us a mousedown in our region, mousemove or mouseup anywhere.
  var self = this;
  
  $(".reset-button"     ,$(this.element).parent(".portlet-content:first"))
    // .button({icons: {primary: 'ui-icon-seek-first'},text: false})          
    .click(function(ev){self.ResetDefaultRange();self.Draw();self.FinishRangeChange();});
  
}

HistCanvas.prototype.Resize = function()
{
  // console.log("HistCanvas::Resize",this);
  Pad.prototype.Resize.call(this);
  // console.warn("Resizing, rotate_90 = ", this.rotate_90, this.);
  
}

HistCanvas.prototype.ResetDefaultRange = function()
{
  this.ResetToHist(this.fHists[0]);
};


HistCanvas.prototype.Draw = function()
{
  // console.log("HistCanvas::Draw",this);
  this.ctx.save();


  this.Clear();
  this.DrawFrame();
  this.DrawRegions();
  // Clip region.
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.clip();
    
  this.DrawHists();
  
  this.ctx.restore();
  if(this.adjunct_display) this.DrawAdjunct();
  this.DrawMarker();
  this.ctx.restore();
};

HistCanvas.prototype.DrawRegions = function()
{
};

HistCanvas.prototype.DrawAdjunct = function()
{
  // First, Draw the dividing line.	
  this.ctx.strokeStyle = "rgba(0,0,0,1.0)";
  this.ctx.lineWidth = 1;
  this.ctx.beginPath();
  this.ctx.moveTo(this.origin_x,             this.origin_y - this.adjunct_height);
	this.ctx.lineTo(this.origin_x+this.span_x, this.origin_y - this.adjunct_height);
	this.ctx.stroke();
	
	// Draw the label
  if(this.adjunct_label) {
    this.ctx.font = "12px sans-serif";
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = "rgba(20,20,20,1.0)";
    //this.ctx.drawTextRight(font,fontsize,this.origin_x-tickLen,y+asc/2,String(ftick));
    this.ctx.fillText(this.adjunct_label, this.origin_x-2, this.origin_y - (this.adjunct_height/2));
	}
	
	// Draw the adjunct regions.
	
	// Debug line: create an adjunct element you can see: this.fAdjunctData.push ({ustart: 2000,	uend:   2500,	color:  "rgba(0,0,255,1.0)"});
	
  for(var i=0;i<this.fAdjunctData.length;i++) {
		var datum = this.fAdjunctData[i];
		this.ctx.fillStyle = datum.color;
		var x1 = this.GetX(datum.ustart);
		var x2 = this.GetX(datum.uend);
		this.ctx.fillRect(x1,this.origin_y-this.adjunct_height,x2-x1,this.adjunct_height);
	}
};

HistCanvas.prototype.DrawMarker = function()
{
  if(this.marker!==null) {
    this.ctx.fillStyle = "rgba(0,0,0,1)";
    var x1 = this.GetX(this.marker)-1;
    var dx = 2;
    var y1 = this.GetY(this.max_v);
    var dy = (this.origin_y) - y1;
    this.ctx.fillRect( x1, y1, dx, dy );    
  }
};

HistCanvas.prototype.SetMarker = function(t)
{
  if(t !== this.marker) {
    this.marker = t;
    this.Draw();    
  }
};

HistCanvas.prototype.SetAdjunctData = function ( inAdjunct )
{
	this.fAdjunctData = inAdjunct;
};

HistCanvas.prototype.ClearHists = function(  )
{
  this.fNHist = 0;
  this.fHists = [];
  this.fColorScales = [];
  this.fHistOptions = []; // transparency settings
}

HistCanvas.prototype.AddHist = function( inHist, inColorScale, options )
{
  if(this.fNHist === 0 ){ this.ResetToHist(inHist); }
  if(typeof alpha === 'undefined' || alpha === null) alpha = 1;  
  this.fHists[this.fNHist] = inHist;
  this.fColorScales[this.fNHist] = inColorScale;
  this.fHistOptions[this.fNHist] = $.extend({},this.default_options, options);
  this.fNHist++;
  if(inHist.binlabelsx) 
    this.draw_tick_labels_x = false; // Don't draw numeric tick labels.
  
  // Adjust scales.
  this.ResetScales();
};

HistCanvas.prototype.SetHist = function( inHist, inColorScale, options )
{
  this.fNHist = 1;
  delete this.fHists;
  this.fHists = [inHist];
  this.fColorScales = [inColorScale];
  this.fHistOptions = [$.extend({},this.default_options,options)];
  
  this.ResetScales();

  if(inHist.binlabelsx) 
    this.draw_tick_labels_x = false; // Don't draw numeric tick labels.
  this.FinishRangeChange();
};

HistCanvas.prototype.ResetScales = function ( inHist )
{
  // Ok, just one place to do all the scale setting.
  // If inHist is not defined, it sets scales to ALL histograms.
  // Subclasses are free to override this.
  //   HistCanvas.call(this,inHist); 
  //   this.min_u = ...

  var hists = this.fHists;
  if(inHist) hists = [inHist]; 
  // First, get the max and min values for all hists. 
  this.min_u = hists[0].min;
  this.max_u = hists[0].max;
  this.min_v = hists[0].min_content;                // minimum value shown on Y-axis
  this.max_v=  hists[0].max_content;  // maximum value shown on Y-axis
  for(var i=0;i<hists.length;i++) {
    this.min_u = Math.min(this.min_u,hists[i].min);
    this.max_u = Math.max(this.max_u,hists[i].max);
    this.min_v = Math.min(this.min_v,hists[i].min_content)
    this.max_v = Math.max(this.max_v,hists[i].max_content)
    
   
    // For histograms with error bars:
    if("min_content_with_err" in hists[i])  this.min_v = Math.min(this.min_v,hists[i].min_content_with_err); 
    if("max_content_with_err" in hists[i])  this.max_v = Math.max(this.max_v,hists[i].max_content_with_err);
  }
  
  // For unsupressed zero:
  if(!this.suppress_zero) this.min_v = Math.min(0,this.min_v);
  
  
  var du = (this.max_u-this.min_u);
  if(du<=0) this.max_u = this.min_u + 1; // Make sure we have SOME dynamic range.

  // Give us a little elbow room on the top side.
  var dv = (this.max_v-this.min_v);
  if(dv<=0) dv =1;
  this.max_v += (dv*0.02);  // maximum value shown on Y-axis
  if(this.min_v !==0 ) this.min_v -=(dv*0.02); // A little more, if not at zero exactly.
}


HistCanvas.prototype.ResetToHist = function( inHist ) {
  
  this.ResetScales(inHist);
  this.SetLogy(this.log_y);
};

HistCanvas.prototype.SetLogy = function( inOn )
{
  if(inOn) {
    this.log_y=true;
    if(this.min_v <=0) this.min_v = 0.5;
  } else {
    this.log_y=false;
  }
};



HistCanvas.prototype.GetY = function( f ) 
{
  if(this.log_y === false) {  
    return this.origin_y - this.adjunct_height - this.span_y*(f-this.min_v)/(this.max_v-this.min_v);
  }
  if(f<=0) f = this.min_v; // Protect against floating point errors
  return this.origin_y - this.adjunct_height - this.span_y*(Math.log(f)-Math.log(this.min_v))/(Math.log(this.max_v)-Math.log(this.min_v));
};

HistCanvas.prototype.GetF = function( y ) 
{
  if(this.log_y === false) {
    return (- y + this.origin_y - this.adjunct_height)/this.span_y*(this.max_v-this.min_v) + this.min_v; 
  }
  return Math.exp( 
    (- y + this.origin_y - this.adjunct_height)/this.span_y*(Math.log(this.max_v)-Math.log(this.min_v)) + Math.log(this.min_v)
  );
}



HistCanvas.prototype.DrawHists = function( ) 
{
  //log(this.fName + "::DrawHists");
  // Draw the data.
  if (!this.ctx) return;
  for(var iHist = 0; iHist< this.fNHist; iHist++){
     this.DrawHist(iHist);
  }
}
   
HistCanvas.prototype.DrawHist = function( iHist ) 
{
   //log("  drawing hist "+iHist);
   var hist = this.fHists[iHist];
   var colorscale = this.fColorScales[iHist];
   var alpha = 1.0;
   var do_fill = true;
   var do_line = false;
   var o = this.fHistOptions[iHist];
   this.ctx.strokeStyle = o.strokeStyle;
   this.ctx.lineWidth = o.lineWidth;
   
   // Width of a single vertical histogram bar.
   // var barwidth = (hist.max-hist.min)/(hist.n)*this.span_x/(this.max_u-this.min_u) ;
   // if(barwidth>2) barwidth -= 1;
   
   var i,t,t2,f,x1,x2,y;
   var xoff = o.xoffset || 0;
   var yoff = o.yoffset || 0;
   
   
   if(o.doLine || o.doGraph) {
     this.ctx.save();
     this.ctx.globalCompositeOperation=o.composite;     
     this.ctx.lineWidth = o.lineWidth;
     this.ctx.strokeStyle = o.strokeStyle;
     this.ctx.beginPath();
     if(!o.doGraph) this.ctx.moveTo(this.origin_x+xoff, this.origin_y+yoff);
     else           this.ctx.moveTo(this.GetX(hist.GetX(0))+xoff, this.GetY(hist.data[0])+xoff);
     for (i = 0; i < hist.n; i++) {
       t = hist.GetX(i);
       t2 = hist.GetX(i+1);
       f = hist.data[i];
       x1 = this.GetX(t)  +xoff;
       x2 = this.GetX(t2) +xoff;
       y = this.GetY(f)   +yoff;
       if(x2<this.origin_x) continue;
       if(x1>(this.origin_x + this.span_x)) continue;
       if(x1<this.origin_x) x1 = this.origin_x;
       if(x2>(this.origin_x + this.span_x)) x2 = this.origin_x+this.span_x;
       this.ctx.lineTo(x1,y);
       if(!o.doGraph) this.ctx.lineTo(x2,y);       
     }
     this.ctx.stroke();
     this.ctx.restore();
   }
   
   if(o.doDots) {
     var r = this.span_x/hist.n/2;
     r = Math.min(r,6); // max 6 pixels
     r = Math.max(r,2); // minimum 6 pixels
     
     this.ctx.save();
     this.ctx.globalCompositeOperation=o.composite;     
     for (i = 0; i < hist.n; i++) {
       t = hist.GetX(i);
       f = hist.data[i];
       x = this.GetX(t);
       y = this.GetY(f);
       if(x<this.origin_x) continue;
       if(x>(this.origin_x + this.span_x)) continue;
       this.ctx.beginPath();
       var c = colorscale.GetColor(t,f);
       this.ctx.fillStyle = "rgba(" + c + "," +o.alpha+ ")";
       this.ctx.arc(x,y,r,0,1.999*Math.PI);
       this.ctx.fill();
     }
     this.ctx.stroke();
     this.ctx.restore();
   } 
   
   if(o.doFill) {
     this.ctx.save();
     this.ctx.globalCompositeOperation=o.composite;          
     for (i = 0; i < hist.n; i++) {       
       if(hist.data[i]===0) continue;
       t = hist.GetX(i);
       t2 = hist.GetX(i+1);
       f = hist.data[i];
       x = this.GetX(t);
       x2= this.GetX(t2);
       y = this.GetY(f);
       if(x2<this.origin_x) continue;
       if(x>this.origin_x+this.span_x) continue;
       if(x<this.origin_x) x = this.origin_x;
       if(x2>this.origin_x+this.span_x) x2 = this.origin_x+this.span_x;
       var bw = x2-x;
       var c = colorscale.GetColor(t,f);
       this.ctx.fillStyle = "rgba(" + c + "," +o.alpha+ ")";
       this.ctx.fillRect(x, y, bw, (this.origin_y-this.adjunct_height-y));
     }
     this.ctx.restore();
   }
   if(o.doErrors && hist.errs) {
     this.ctx.save();
     this.ctx.beginPath();     
     this.ctx.globalCompositeOperation='xor';
     this.ctx.strokeStyle=o.error_stroke;
     this.ctx.lineWidth=o.error_lineWidth;
     for (i = 0; i < hist.n; i++) {
       t1 = hist.GetX(i);
       t2 = hist.GetX(i+1);
       var t = (t1+t2)/2;
       f = hist.data[i];
       f1 = f + hist.errs[i];
       f2 = f - hist.errs[i];
       x1 = this.GetX(t);
       var y1 = this.GetY(f1);
       var y2 = this.GetY(f2);
       if(x1<this.origin_x) continue;
       if(x1>(this.origin_x + this.span_x)) continue;
       if(y2>this.origin_y) y2 = this.origin_y;
       this.ctx.moveTo(x1,y1);
       this.ctx.lineTo(x1,y2);
     }
     this.ctx.stroke();
     this.ctx.restore();
   }
   
   if(hist.binlabelsx) {
     this.ctx.font = this.tick_label_font;
     this.ctx.textAlign = 'center';
     this.ctx.textBaseline = 'top';
     
      for (var i = 0; i < hist.n; i++) {
        var t1 = hist.GetX(i);
        var t2 = hist.GetX(i+1);
        var x1 = this.GetX(t1);
        var x2 = this.GetX(t2);
        var x = (x1+x2)/2;
        var arr = getLines(this.ctx,hist.binlabelsx[i],x2-x1,this.ctx.font);
        // console.warn("getLines",arr);
        var y = this.origin_y+8;
        for(var j=0;j<arr.length;j++) {
          // console.warn(x,y,arr[j]);
          this.ctx.fillText(arr[j], x, y);
          y += 10;
        }
      }
     
   }   
};    






HistCanvas.prototype.ChangeRange = function( minu,maxu )
{
  // Check to see if we're bounding.
  // If we are, prevent user from dragging the bounds.
  if(this.bound_u_min!== undefined) this.min_u = Math.max(this.bound_u_min,minu);
  else                              this.min_u = minu;

  if(this.bound_u_max!== undefined) this.max_u = Math.min(this.bound_u_max,maxu);
  else                              this.max_u = maxu;

  this.Draw();  
  this.FastRangeChange();
};

HistCanvas.prototype.FinishRangeChange = function()
{};

HistCanvas.prototype.FastRangeChange = function()
{};

HistCanvas.prototype.DoMouseOverContent = function( u, v )
{}

HistCanvas.prototype.DoMouse = function( ev )
{
  this.DoMousePanAndScale(ev);
  
  
}; 

HistCanvas.prototype.MouseChangedUV = function( new_limits, finished ) 
{
  var minu = this.min_u;
  var maxu = this.max_u;
  if('min_u' in new_limits) minu = new_limits.min_u;
  if('max_u' in new_limits) maxu = new_limits.max_u;
  this.ChangeRange(minu,maxu);
  if(finished) this.FinishRangeChange();
}

// HistCanvas.prototype.DoTouch = function( ev )
// {
//   var tt = new Date().getTime();
//   console.log(ev.type + " " + (tt-this.touchtime));
//   this.touchtime = tt;
//   if(ev.type === 'touchend' && this.fIsBeingDragged) {
//     // Mouseup - finish what you're doing.
//
//     this.fIsBeingDragged = false;
//     this.fDragMode = "none";
//     this.fDragStart = 0; // X coordinate.
//
//     // FIXME: emit event indicating possibly changed selection.
//     this.FinishRangeChange();
//     return true;
//   }
//   // ev.originalEvent.preventDefault();
//
//   // Find touches. Limit to two fingers.
//   var touch = [];
//   var offset = getAbsolutePosition(this.canvas);
//   for(var i=0;i<ev.originalEvent.touches.length;i++) {
//     touch.push(
//       {
//         x: ev.originalEvent.touches[i].pageX- offset.x,
//         y: ev.originalEvent.touches[i].pageY- offset.y
//         // ,t: (ev.originalEvent.touches[i].pageX- offset.x - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u
//       }
//     );
//   }
//   console.log("touches: "+touch.length);
//   if(ev.type === 'touchstart') {
//     this.fIsBeingDragged = true;
//     this.lastTouch = touch;
//     return false;
//   } else if(ev.type === 'touchmove')  {
//     console.log('doing touchmove');
//     if(this.fIsBeingDragged !== true) return true; // Not a handled event.
//     ev.originalEvent.preventDefault();
//
//     console.log("lasttouch: "+this.lastTouch.length);
//     // Find best movement.
//     if(this.lastTouch.length>1 && touch.length>1){
//       console.log("doing 2-touch");
//       var x1 = touch[0].x;
//       var x2 = touch[1].x;
//       var t1 = (this.lastTouch[0].x - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u;
//       var t2 = (this.lastTouch[1].x - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u;
//
//       // moving and scaling. Want to move original t0,t1 u-values to new x0,x1 pixel locations.
//       var del = (x2 - this.origin_x) / (x1 - this.origin_x);
//       console.log('del'+ del);
//       var newmin = (t2-t1*del)/(1.0 - del);
//       console.log('newmin'+ newmin);
//       var newmax = this.span_x * (t1 -newmin)/(x1 - this.origin_x) + newmin;
//       console.log('newmax'+ newmax);
//       this.ChangeRange(newmin,newmax);
//     } else {
//       console.log("doing 1-touch");
//       // Anything else, find smallest shift.
//       var deltaX = 99999;
//       for(var i=0;i<this.lastTouch.length;i++) {
//         for(var j=0;j<touch.length;j++) {
//           dx = touch[j].x - this.lastTouch[i].x;
//           if(Math.abs(dx) < Math.abs(deltaX)) deltaX = dx;
//         }
//       }
//       if(deltaX < 99999){
//         var deltaT = deltaX * (this.max_u-this.min_u)/(this.span_x)
//         console.log("delta t:"+deltaT);
//         this.ChangeRange(this.min_u-deltaT, this.max_u-deltaT);
//       }
//     }
//   }
//
//   this.lastTouch = touch;
//   return true;
//
// };


