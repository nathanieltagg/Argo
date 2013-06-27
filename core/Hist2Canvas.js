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

//
// Two-dimensional canvas.
//

// Subclass of Pad.
Hist2Canvas.prototype = new Pad(null);           

function Hist2Canvas( element, options )
{
  // console.log('Hist2Canvas ctor');
  if(!element){
      // console.log("Hist2Canvas: NULL element supplied."); 
      return;
  }

  var settings = {
    // default settings:
    log_y : false,
    draw_grid_y : true,
    draw_grid_x : true,
    margin_left : 40,
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
  // This should work to rebind the event handler to this particular instance of the Hist2Canvas.
  // This gives us a mousedown in our region, mousemove or mouseup anywhere.
  var self = this;
  if(!isIOS()){
    $(this.element).bind('mousedown',function(ev) { return self.DoMouse(ev); });
    $(window)    .bind('mousemove',function(ev) { return self.DoMouse(ev); });
    $(window)    .bind('mouseup',  function(ev) { return self.DoMouse(ev); });
  }
   
  $(this.element).bind('touchstart', function(ev)   { return self.DoTouch(ev); });
  $(this.element).bind('touchend',   function(ev)   { return self.DoTouch(ev); });
  $(this.element).bind('touchmove',  function(ev)   { return self.DoTouch(ev); });
  $(this.element).unbind('click');
  
  $(".reset-button"     ,$(this.element).parent(".portlet-content:first"))
    // .button({icons: {primary: 'ui-icon-seek-first'},text: false})          
    .click(function(ev){self.ResetDefaultRange();self.Draw();self.FinishRangeChange();});
  
}

Hist2Canvas.prototype.ResetDefaultRange = function()
{
  this.ResetToHist(this.fHists[0]);
}


Hist2Canvas.prototype.Draw = function()
{
  console.log("Hist2Canvas::Draw",this);
  this.Clear();
  this.DrawFrame();
  this.DrawRegions();
  this.DrawHists();
}

Hist2Canvas.prototype.DrawRegions = function()
{
}


Hist2Canvas.prototype.SetHist = function( inHist, inColorScale )
{
  this.fNHist = 1;
  delete this.fHists;
  this.fHists = [inHist];
  this.fColorScales = [inColorScale];
  this.min_v =inHist.min_content;                // minimum value shown on Y-axis
  this.max_v= inHist.max_content;  // maximum value shown on Y-axis
  this.FinishRangeChange();
}

Hist2Canvas.prototype.ResetToHist = function( inHist ) {
  this.min_u = inHist.min_x;
  this.max_u = inHist.max_x;
  this.min_v = inHist.min_y;
  this.max_v = inHist.max_y;
}


Hist2Canvas.prototype.GetY = function( f ) 
{
  if(this.log_y === false) {  
    return this.origin_y - this.adjunct_height - this.span_y*(f-this.min_v)/(this.max_v-this.min_v);
  }
  return this.origin_y - this.adjunct_height - this.span_y*(Math.log(f)-Math.log(this.min_v))/(Math.log(this.max_v)-Math.log(this.min_v));
}




Hist2Canvas.prototype.DrawHists = function( ) 
{
  //log(this.fName + "::DrawHists");
  // Draw the data.
  if (!this.ctx) return;
   for(var iHist = 0; iHist< this.fNHist; iHist++){
     //log("  drawing hist "+iHist);
     var hist = this.fHists[iHist];
     var colorscale = this.fColorScales[iHist];
     
     // Box size for a single cell
     var boxwidth = (hist.max_x-hist.min_x)/(hist.n_x)*this.span_x/(this.max_u-this.min_u) ;
     if(boxwidth>2) boxwidth -= 1;
     var boxheight = (hist.max_y-hist.min_y)/(hist.n_y)*this.span_y/(this.max_v-this.min_v) ;
     if(boxheight>2) boxheight -= 1;
     
     for (var i = 0; i < hist.n_x; i++) {
       for (var j =0; j< hist.n_y; j++) {
         var z = hist.data[i][j];
         if(z!==0) {
           var u = (i/hist.n_x)*(hist.max_x-hist.min_x) + hist.min_x;
           var v = (j/hist.n_y)*(hist.max_y-hist.min_y) + hist.min_y;           
           var x = this.GetX(u);
           var y = this.GetY(v);
           var c = colorscale.GetColor(z);
           console.log(u,v,z,colorscale.min,colorscale.max,c);
           if(x+boxwidth<this.origin_x) continue;
           if(x>this.origin_x+this.span_x) continue;
           // FIXME if(y+boxheight>this.origin_y) continue;
           // if(y<this.origin_y+this.span_y) continue;

           // Fixme - partial boxes.

           this.ctx.fillStyle = "rgba(" + c + ",1.0)";
           this.ctx.fillRect(x, y-boxheight, boxwidth, boxheight);          
         }
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


Hist2Canvas.prototype.ChangeRange = function( minu,maxu )
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

Hist2Canvas.prototype.FinishRangeChange = function()
{}

Hist2Canvas.prototype.FastRangeChange = function()
{}

Hist2Canvas.prototype.DoMouse = function( ev )
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

Hist2Canvas.prototype.DoTouch = function( ev )
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


