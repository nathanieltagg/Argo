//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:


// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('#false-color-type').addClass("saveable").change(ChangeFalseColorScale);

  gWirePseudoColor = new LogColor();
  // ChangeFalseColorScale();

  $('div.A-FalseColorControl').each(function(){
    gFalseColorControl = new FalseColorControl(this);
  });  
});


function ChangeFalseColorScale()
{
    var sel = $('#ctl-false-color-scale option:selected').val();
}



// Subclass of HistCanvas.
FalseColorControl.prototype = new HistCanvas();

function FalseColorControl( element  )
{
  this.element = element;
  var settings = {
    label_font: "10pt",
    // xlabel: "ADC (Ped-subtracted)",
    // ylabel: "TPC Samples",
    ylabel: "ADCs",
    draw_ticks_x: false,
    tick_pixels_y: 15,
    margin_left: 42,
    margin_bottom: 30,
    log_y:false,
    min_u: 0,
    max_u: 500
  };
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  
  // this.hist = new Histogram(10,-4096,4096);
  this.cs =  gWirePseudoColor;

  this.temporary_offset = 0;
  this.final_offset = 0;
  
  var c1 = gWirePseudoColor.AdcToColorDial(-2096);
  var c2 = gWirePseudoColor.AdcToColorDial( 2096);
  this.hist = new Histogram(1000,c1,c2);
  for(var i =0;i<this.hist.n;i++) {
    this.hist.SetBinContent(i,gWirePseudoColor.ColorDialToAdc(this.hist.GetX(i)));
  }
  this.SetHist(this.hist,new ColorScaleIndexed(0),{doFill:false,doLine:true});
  this.log_y = false;
  

  
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
    
  this.ctl_histo_logscale= GetBestControl(this.element,".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.Draw(); });

  $('.falseColorPlus1' ).click(function(){ self.ChangeRange(+1); self.FinishRangeChange(); });
  $('.falseColorMinus1').click(function(){ self.ChangeRange(-1); self.FinishRangeChange(); });
}

FalseColorControl.prototype.NewRecord = function()
{
  this.Draw();
  // if(gRecord && gRecord.raw && gCurName.raw && gRecord.raw[gCurName.raw] && gRecord.raw[gCurName.raw].h_adc) {
  //   this.vhist = HistogramFrom(gRecord.raw[gCurName.raw].h_adc);
  //   var nh = $.extend({},gRecord.raw[gCurName.raw].h_adc);
  //
  //   // Hack the histogram. Make the draw-er believe it's not a variable-width histo, but add labels that are right.
  //   nh.binlabelsx = [];
  //   for(var b = 0;b<nh.n; b++) nh.binlabelsx.push("");
  //   var l = [-100,-10,0,10,100];
  //   for(var i = 0;i<l.length; i++) nh.binlabelsx[this.vhist.GetBin(l[i])]= l[i].toString() ;
  //   for(var i = 0;i<nh.data.length-1; i++) nh.data[i] = Math.max(nh.data[i]/(nh.x_bins[i+1]-nh.x_bins[i]),1);
  //   nh.x_bins=null;
  //   this.hist = HistogramFrom(nh);
  //   this.SetHist(this.hist,this.cs,{});
  //   this.Draw();
  // }
  // $(this.element).prepend(gGLEngine.build_LUT_canvas(this.cs,-4065,4096));
};


FalseColorControl.prototype.Draw = function( )
{
  // this.log_y = $(this.ctl_histo_logscale).is(":checked");
  
  this.Clear();
  this.DrawFrame();
  this.ctx.save();
  var my_gradient=this.ctx.createLinearGradient(0,0,this.span_x,0);
  for(var i =0;i<this.hist.n;i++) {
    var u = this.hist.GetX(i);
    var c = gWirePseudoColor.ColorDialToColor(u);
    my_gradient.addColorStop(i/this.hist.n,
                             "rgba("+
    parseInt(c.r)+","+
    parseInt(c.g)+","+
    parseInt(c.b)+","+0.5+")"
                            );
    this.ctx.fillStyle=my_gradient;
    this.ctx.fillRect(this.origin_x,this.origin_y-this.span_y,this.span_x,this.span_y);
  }
  this.ctx.restore();
  this.DrawHists();
  
};

FalseColorControl.prototype.ChangeRange = function( deltaAdc )
{
  this.temporary_offset = deltaAdc;
  console.error("new offsets:",this.temporary_offset,this.final_offset);

  // this.cs.offset = this.temporary_offset+this.final_offset;
  var offset = this.temporary_offset+this.final_offset;

  gWirePseudoColor = new LogColor((offset)/100.);
  this.Draw();
};



FalseColorControl.prototype.FinishRangeChange = function()
{
  // console.warn("FalseColorControl::FinishRangeChange");
  this.final_offset = this.temporary_offset + this.final_offset;
  this.temporary_offset = 0;
  console.error("new offsets:",this.temporary_offset,this.final_offset);
  
  // Do the GLEngine re-burn.
  UpdateColoredWireMap("_raw");
};

FalseColorControl.prototype.DoMouse = function( ev )
{
  var x = ev.pageX;
  var y = ev.pageY;
  var offset = getAbsolutePosition(this.canvas);
  var relx = x - offset.x;
  var rely = y - offset.y;    

  if(ev.type === 'mousedown') {
    //logclear();
    //console.log("begin drag");
    // Find the position of the drag start - is this in the horizontal scale or the body?
    this.fDragStartX = x;
    this.fDragStartT = (relx - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u;
    this.fDragStartBin = (relx - this.origin_x)/this.span_x*this.vhist.n;

    if(relx > this.origin_x) {
      this.fIsBeingDragged = true;
      this.fDragMode = "colorShift";
    } 
  } else {
    // Either mousemove or mouseup.
    if(this.fIsBeingDragged !== true) {
      if(relx>this.origin_x && rely<this.origin_y
        && relx<this.width && rely> 0) this.DoMouseOverContent(this.GetU(relx),this.GetV(rely));
      else  this.DoMouseOverContent(null,null);
    }
    if(this.fDragMode === "colorShift") {
      // find current magnitude of the shift.
      var T= (relx - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u;
      var newBin = (relx - this.origin_x)/this.span_x*this.vhist.n;
      console.warn(newBin,this.vhist.GetX(newBin),this.fDragStartBin,this.vhist.GetX(this.fDragStartBin))
      var deltaAdc = this.vhist.GetX(newBin) - this.vhist.GetX(this.fDragStartBin);
      this.ChangeRange(deltaAdc);
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
}; 




