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
		adunct_label: null
  };
  $.extend(true,settings,options); // Change defaults
  
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  this.SetLogy(this.log_y);

  // Now our own (non-customizable) setup.
  //data storage
  this.fNHist = 0;
  this.fHists = [];
  this.fColorScales = [];
  
  this.fAdjunctData = [];

  // State model:
  this.fIsBeingDragged = false;
  this.fDragMode = "none";
  this.fDragStartX = 0; // start drag X coordinate, absolute, in pixels
  this.fDragStartT = 0; // start drag X coordinate, in display units.

  if(!this.element) { return; }
  // This should work to rebind the event handler to this particular instance of the HistCanvas.
  // This gives us a mousedown in our region, mousemove or mouseup anywhere.
  var self = this;
  
  $(".reset-button"     ,$(this.element).parent(".portlet-content:first"))
    // .button({icons: {primary: 'ui-icon-seek-first'},text: false})          
    .click(function(ev){self.ResetDefaultRange();self.Draw();self.FinishRangeChange();});
  
}

HistCanvas.prototype.ResetDefaultRange = function()
{
  this.ResetToHist(this.fHists[0]);
}


HistCanvas.prototype.Draw = function()
{
  // console.log("HistCanvas::Draw",this);
  this.Clear();
  this.DrawFrame();
  this.DrawRegions();
  this.DrawHists();
  if(this.adjunct_display) this.DrawAdjunct();
  this.DrawMarker();
}

HistCanvas.prototype.DrawRegions = function()
{
}

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
}

HistCanvas.prototype.DrawMarker = function()
{
  if(this.marker!=null) {
    this.ctx.fillStyle = "rgba(0,0,0,1)";
    var x1 = this.GetX(this.marker)-1;
    var dx = 2;
    var y1 = this.GetY(this.max_v);
    var dy = (this.origin_y) - y1;
    this.ctx.fillRect( x1, y1, dx, dy );    
  }
}

HistCanvas.prototype.SetMarker = function(t)
{
  if(t !== this.marker) {
    this.marker = t;
    this.Draw();    
  }
}


HistCanvas.prototype.AddHist = function( inHist, inColorScale, reset )
{
  if(this.fNHist === 0 ){ this.ResetToHist(inHist); }
  this.fHists[this.fNHist] = inHist;
  this.fColorScales[this.fNHist] = inColorScale;
  this.fNHist++;
  // Adjust scales.
  if(inHist.min < this.min_u) this.min_u = inHist.min;
  if(inHist.max > this.max_u) this.max_u = inHist.max;
  if(inHist.min_content < this.min_v) this.min_v = inHist.min_content;
  if(inHist.max_content > this.max_v) this.max_v = inHist.max_content;
  //console.log(this.fName + ".AddHist " + this.min_u + " " + this.max_u);
}

HistCanvas.prototype.SetHist = function( inHist, inColorScale )
{
  this.fNHist = 1;
  delete this.fHists;
  this.fHists = [inHist];
  this.fColorScales = [inColorScale];
  this.min_v =inHist.min_content;                // minimum value shown on Y-axis
  this.max_v= inHist.max_content;  // maximum value shown on Y-axis
  this.FinishRangeChange();
}

HistCanvas.prototype.SetAdjunctData = function ( inAdjunct )
{
	this.fAdjunctData = inAdjunct;
}

HistCanvas.prototype.ResetToHist = function( inHist ) {
  this.min_u = inHist.min; // Minimum value shown on x-axis  FIXME - make adjustable.
  this.max_u = inHist.max; // Maximum value shown on y-axis
  this.min_v =inHist.min_content;                // minimum value shown on Y-axis
  this.max_v= inHist.max_content*1.02;  // maximum value shown on Y-axis
  if(this.min_v == this.max_v) this.max_v = this.min_v + 1.02; // If min and max are both 0, adjust the max to be 1 unit bigger
  this.SetLogy(this.log_y);
}

HistCanvas.prototype.SetLogy = function( inOn )
{
  if(inOn) {
    this.log_y=true;
    if(this.min_v <=0) this.min_v = 0.5;
  } else {
    this.log_y=false;
  }
}



HistCanvas.prototype.GetY = function( f ) 
{
  if(this.log_y === false) {  
    return this.origin_y - this.adjunct_height - this.span_y*(f-this.min_v)/(this.max_v-this.min_v);
  }
  return this.origin_y - this.adjunct_height - this.span_y*(Math.log(f)-Math.log(this.min_v))/(Math.log(this.max_v)-Math.log(this.min_v));
}




HistCanvas.prototype.DrawHists = function( ) 
{
  //log(this.fName + "::DrawHists");
  // Draw the data.
  if (!this.ctx) return;
   for(var iHist = 0; iHist< this.fNHist; iHist++){
     //log("  drawing hist "+iHist);
     var hist = this.fHists[iHist];
     var colorscale = this.fColorScales[iHist];
     // Width of a single vertical histogram bar.
     var barwidth = (hist.max-hist.min)/(hist.n)*this.span_x/(this.max_u-this.min_u) ;
     if(barwidth>2) barwidth -= 1;
     
     for (var i = 0; i < hist.n; i++) {
       if(hist.data[i]!==0) {
         var t = hist.GetX(i);
         var t2 = hist.GetX(i+1);
         var f = hist.data[i];
         var x = this.GetX(t);
         var y = this.GetY(f);
         if(x+barwidth<this.origin_x) continue;
         if(x+barwidth>this.origin_x+this.span_x) continue;
         var bw = barwidth;
         if(x<this.origin_x) {// partial-width bar at front.
           bw = barwidth-this.origin_x+x; 
           x = this.origin_x; } 
         var c = colorscale.GetColor((t+t2)/2);
         this.ctx.fillStyle = "rgba(" + c + ",1.0)";
         //log(t + " " + c);
         this.ctx.fillRect(x, y, bw, (this.origin_y-this.adjunct_height-y));          
       }
   }
 }
   
}    

function getAbsolutePosition(element) {
   var r = { x: element.offsetLeft, y: element.offsetTop };
   if (element.offsetParent) {
     var tmp = getAbsolutePosition(element.offsetParent);
     r.x += tmp.x;
     r.y += tmp.y;
   }
   return r;
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
}

HistCanvas.prototype.FinishRangeChange = function()
{}

HistCanvas.prototype.FastRangeChange = function()
{}

HistCanvas.prototype.DoMouse = function( ev )
{
  if(ev.type === 'mousedown') {
    //logclear();
    //console.log("begin drag");
    // Find the position of the drag start - is this in the horizontal scale or the body?
    var x = ev.pageX;
    var y = ev.pageY;
    var offset = getAbsolutePosition(this.canvas);
    var relx = x - offset.x;
    var rely = y - offset.y;    
    this.fDragStartX = x;
    this.fDragStartT = (relx - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u;
    if(rely < this.origin_y && relx > this.origin_x) {
      this.fIsBeingDragged = true;
      this.fDragMode = "shiftX";
      console.log("body drag")      
    } else if(relx > this.origin_x + 5 ) {
      // Note that this is capped at 5 pixels from the origin, for saftey. 
      this.fIsBeingDragged = true;
      this.fDragMode = "scaleX";
      console.log("scale drag" + this.fDragStartT)
    } 
  } else {
    // Either mousemove or mouseup.
    if(this.fIsBeingDragged !== true) return true; // Not a handled event.
    if(this.fDragMode === "shiftX") {
      // find current magnitude of the shift.
      var x = ev.pageX;
      var deltaX = x - this.fDragStartX;
      var deltaT = deltaX * (this.max_u-this.min_u)/(this.span_x);
      this.fDragStartX = x;
      this.ChangeRange(this.min_u-deltaT, this.max_u-deltaT);
    }
    if(this.fDragMode === "scaleX") {
      // Find the new scale factor.
      var x = ev.pageX;
      var offset = getAbsolutePosition(this.canvas);
      var relx = x - offset.x - this.origin_x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      // Want the T I started at to move to the current posistion by scaling.
      var maxu = this.span_x * (this.fDragStartT-this.min_u)/relx + this.min_u;
      this.ChangeRange(this.min_u,maxu);
    }
  }
  
  if(ev.type === 'mouseup' && this.fIsBeingDragged ) {
    // Mouseup - finish what you're doing.
    
    this.fIsBeingDragged = false;
    this.fDragMode = "none";
    this.fDragStart = 0; // X coordinate.    

    // FIXME: emit event indicating possibly changed selection.
    this.FinishRangeChange();
  }  
  return false; // Handled.
} 

HistCanvas.prototype.DoTouch = function( ev )
{
  var t1 = new Date().getTime();
  console.log(ev.type + " " + (t1-this.touchtime));
  this.touchtime = t1;
  if(ev.type === 'touchend' && this.fIsBeingDragged) {
    // Mouseup - finish what you're doing.
    
    this.fIsBeingDragged = false;
    this.fDragMode = "none";
    this.fDragStart = 0; // X coordinate.    

    // FIXME: emit event indicating possibly changed selection.
    this.FinishRangeChange();
    return true;
  }  
  // ev.originalEvent.preventDefault();
  
  // Find touches. Limit to two fingers.
  var touch = [];
  var offset = getAbsolutePosition(this.canvas);
  for(var i=0;i<ev.originalEvent.touches.length;i++) {
    touch.push(
      {
        x: ev.originalEvent.touches[i].pageX- offset.x,
        y: ev.originalEvent.touches[i].pageY- offset.y
        // ,t: (ev.originalEvent.touches[i].pageX- offset.x - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u     
      }
    );
  }
  console.log("touches: "+touch.length);
  if(ev.type === 'touchstart') {
    this.fIsBeingDragged = true;
    this.lastTouch = touch;    
    return false;
  } else if(ev.type === 'touchmove')  {
    console.log('doing touchmove');
    if(this.fIsBeingDragged !== true) return true; // Not a handled event.
    ev.originalEvent.preventDefault();
      
    console.log("lasttouch: "+this.lastTouch.length);
    // Find best movement.
    if(this.lastTouch.length>1 && touch.length>1){
      console.log("doing 2-touch");
      var x1 = touch[0].x;
      var x2 = touch[1].x;
      var t1 = (this.lastTouch[0].x - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u;
      var t2 = (this.lastTouch[1].x - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u;

      // moving and scaling. Want to move original t0,t1 u-values to new x0,x1 pixel locations.
      var del = (x2 - this.origin_x) / (x1 - this.origin_x);
      console.log('del'+ del);
      var newmin = (t2-t1*del)/(1.0 - del);
      console.log('newmin'+ newmin);
      var newmax = this.span_x * (t1 -newmin)/(x1 - this.origin_x) + newmin;
      console.log('newmax'+ newmax);
      this.ChangeRange(newmin,newmax);
    } else { 
      console.log("doing 1-touch");
      // Anything else, find smallest shift.
      var deltaX = 99999;
      for(var i=0;i<this.lastTouch.length;i++) {
        for(var j=0;j<touch.length;j++) {
          dx = touch[j].x - this.lastTouch[i].x;
          if(Math.abs(dx) < Math.abs(deltaX)) deltaX = dx;
        }
      }
      if(deltaX < 99999){
        var deltaT = deltaX * (this.max_u-this.min_u)/(this.span_x)
        console.log("delta t:"+deltaT);
        this.ChangeRange(this.min_u-deltaT, this.max_u-deltaT);
      }
    }
  }

  this.lastTouch = touch;
  return true;

}


