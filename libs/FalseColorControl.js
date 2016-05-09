//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
gWirePseudoColor = new PsuedoRainbow();
gWireCoherentNoiseFilter = true;
gWireColorPedestalWidthCut = 3; // Value used by GLEngine to determine "smoothing": 
                                // If this value is 1, all ADC values less than 1 sigma of the RMS for that wire will be smoothed away.


// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-FalseColorControl').each(function(){
    gFalseColorControl = new FalseColorControl(this);
  });  
});




// Subclass of HistCanvas.
FalseColorControl.prototype = new HistCanvas();

function FalseColorControl( element  )
{
  this.top_element = element;
  var settings = {
    label_font: "10pt",
    // xlabel: "ADC (Ped-subtracted)",
    // ylabel: "TPC Samples",
    xlabel: "",
    ylabel: "ADCs",
    draw_ticks_x: false,
    draw_ticks_y: false,
    draw_tick_labels_x: false,
    draw_grid_x: false,
    draw_grid_y: false,
    tick_pixels_y: 15,
    margin_left: 48,
    margin_bottom: 30,
    log_y:false,
    min_u: 0,
    max_u: 500
  };
  this.hist_element = $('div.hist-element',this.top_element).get(0);

  var self = this;
  $(this.top_element).tabs({
    collapsible: true,
    activate: self.ChangeScheme.bind(self)
  });
  //Callback on tab change
  
  HistCanvas.call(this, this.hist_element, settings); // Give settings to Pad contructor.
  
  this.cs =  gWirePseudoColor;
  this.currentTabDiv = null;

  this.temporary_offset = 0;
  this.final_offset = 0;
  this.MakeHist();
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");

  $('.falseColorPlus1' ).click(function(){ self.ChangeRange(gWirePseudoColor.AdcToColorDial(1)-gWirePseudoColor.AdcToColorDial(0)); self.FinishRangeChange(); });
  $('.falseColorMinus1').click(function(){ self.ChangeRange(gWirePseudoColor.AdcToColorDial(-1)-gWirePseudoColor.AdcToColorDial(0)); self.FinishRangeChange(); });
  $('input.psuedoDialOffset').change(function(){gWirePseudoColor.dialOffset = parseFloat($(this).val());  this.blur(); self.Draw();});
  $('input.psuedoAdcScale')  .change(function(){gWirePseudoColor.adcScale   = parseFloat($(this).val());  this.blur(); self.Draw();});
  $('input.psuedoDialScale') .change(function(){gWirePseudoColor.dialScale  = parseFloat($(this).val());  this.blur(); self.Draw();});
  $('input.psuedoSaturation').change(function(){gWirePseudoColor.saturation = parseFloat($(this).val());  this.blur(); self.Draw();});
  $('input.psuedoCutoffLow') .change(function(){gWirePseudoColor.cutoffLow  = parseFloat($(this).val());  this.blur(); self.Draw(); self.FinishRangeChange();});
  $('input.psuedoCutoffHigh').change(function(){gWirePseudoColor.cutoffHigh = parseFloat($(this).val());  this.blur(); self.Draw(); self.FinishRangeChange();});

  $('input.psuedoPedWidthCutoff').change(function(){gWireColorPedestalWidthCut = parseFloat($(this).val());  this.blur(); self.Draw(); });;
  $('input.ctl-coherent-noise-filter').change(function(){ gStateMachine.Trigger('ChangePsuedoColor'); });;


  $('div.psuedoDialOffsetSlider').each(function(){
    var p = $(this).parent();
    $(this).slider({
      value: -$('input.psuedoDialOffset',p).val(),
      min: -1.2,
      max:  1.2,
      step: 0.05,
      slide: function(ev,ui) { $('input.psuedoDialOffset',p).val(-ui.value).trigger('change'); return true;},
      stop:  function(ev,ui) { $('input.psuedoDialOffset',p).val(-ui.value).trigger('change'); self.FinishRangeChange();}
  })});

  $('div.psuedoAdcScaleSlider'   ).each(function(){
    var p = $(this).parent();    
    $(this).slider({
    value: $('input.psuedoAdcScale',p).val(),
    min: 0.5,
    max: 300,
    step: 1,
    slide: function(ev,ui) { $('input.psuedoAdcScale',p).val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input.psuedoAdcScale',p).val(ui.value).trigger('change'); self.FinishRangeChange();}
  })});
  
  $('div.psuedoDialScaleSlider').each(function(){
    var p = $(this).parent();    
    $(this).slider({
    value: $('input.psuedoDialScale',p).val(),
    min: -2,
    max: 2,
    step: 0.1,
    slide: function(ev,ui) { $('input.psuedoDialScale',p).val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input.psuedoDialScale',p).val(ui.value).trigger('change'); self.FinishRangeChange();}
  })});
  
  $('div.psuedoSaturationSlider').each(function(){
    var p = $(this).parent();    
    $(this).slider({
    value: $('input.psuedoSaturation',p).val(),
    min: 0,
    max: 1,
    step: 0.01,
    slide: function(ev,ui) { $('input.psuedoSaturation',p).val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input.psuedoSaturation',p).val(ui.value).trigger('change'); self.FinishRangeChange();}
  })});
  
  $('div.psuedoCutoffLowSlider').each(function(){
    var p = $(this).parent();
    $(this).slider({
    value: $('input.psuedoCutoffLow',p).val(),
    min: 0,
    max: 1,
    step: 0.01,
    slide: function(ev,ui) { $('input.psuedoCutoffLow',p).val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input.psuedoCutoffLow',p).val(ui.value).trigger('change'); self.FinishRangeChange();}
  })});
  
  $('div.psuedoCutoffHighSlider').each(function(){
    var p = $(this).parent();
    $(this).slider({
    value: $('input.psuedoCutoffHigh',p).val(),
    min: 0,
    max: 1,
    step: 0.01,
    slide: function(ev,ui) { $('input.psuedoCutoffHigh',p).val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input.psuedoCutoffHigh',p).val(ui.value).trigger('change'); self.FinishRangeChange();}
  })});
  
  $('div.psuedoCutoffHighSlider').each(function(){
    var p = $(this).parent();
    $(this).slider({
    value: $('input.psuedoCutoffHigh',p).val(),
    min: 0,
    max: 1,
    step: 0.01,
    slide: function(ev,ui) { $('input.psuedoCutoffHigh',p).val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input.psuedoCutoffHigh',p).val(ui.value).trigger('change'); self.FinishRangeChange();}
  })});
  
  
  $('div.psuedoPedWidthCutoffSlider').each(function(){
    var p = $(this).parent();
    $(this).slider({
    value: $('input.psuedoPedWidthCutoff',p).val(),
    min: 0,
    max: 6,
    step: 0.2,
    slide: function(ev,ui) { $('input.psuedoPedWidthCutoff',p).val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input.psuedoPedWidthCutoff',p).val(ui.value).trigger('change'); self.FinishRangeChange();}
  })});
  
  
  $('input.colorpicker',this.top_element).each(function(){
    // Index?
    var index = parseInt($(this).attr('data-index'));
    $(this).spectrum({
      move: function(color) {
        gWirePseudoColor.color_table[index] = color.toRgb(); 
        self.Draw(); self.FinishRangeChange();
      }
    });
    $(this).change(function(){
      $(this).spectrum("set",$(this).val());
    })
    
  });
  
  function forceTab(id) {
    var index = $('a[href="#'+id+'"]',self.top_element).parent().index();
    $(self.top_element).tabs('option', 'active', index);
  }
  // Set up initial tab.
  forceTab("falsecolor-Rainbow");
  
  // Set up initial tab, if changed by the save/restore routines.
  $('#falsecolor-scheme').change(function(){
    var nm = $(this).val();
    console.warn("changing to default scheme",nm);
    forceTab(nm);
  });
  
}

FalseColorControl.prototype.NewRecord = function()
{
  // Read saved values into the color.
  // This will happen before the images load, so it's safe.
  
  gWirePseudoColor.dialOffset = parseFloat($('input.psuedoDialOffset',this.currentTabDiv).val() );
  gWirePseudoColor.adcScale   = parseFloat($('input.psuedoAdcScale',this.currentTabDiv).val() );
  gWirePseudoColor.dialScale  = parseFloat($('input.psuedoDialScale',this.currentTabDiv).val() );
  gWirePseudoColor.saturation = parseFloat($('input.psuedoSaturation',this.currentTabDiv).val() );
  gWirePseudoColor.cutoffLow  = parseFloat($('input.psuedoCutoffLow',this.currentTabDiv).val());
  gWirePseudoColor.cutoffHigh = parseFloat($('input.psuedoCutoffHigh',this.currentTabDiv).val());
  $('input.psuedo-color',this.currentTabDiv).each(function(){
    var index = parseInt($(this).attr('data-index'));
    gWirePseudoColor.color_table[index] = $(this).spectrum("get").toRgb();        
  });
  
  gWireColorPedestalWidthCut  = parseFloat($('input.psuedoPedWidthCutoff',this.top_element).val());
  
  this.Draw();
  // gGLEngine.build_LUT_canvas(this.cs,-4066,4096,$('.checkCanvas').get(0));
};


FalseColorControl.prototype.ChangeScheme = function(event,ui)
{
  var newpanel = ui.newPanel.get(0);
  if(!newpanel) return; // Just hid the panel; no need for action.
  var id = newpanel.id;
  console.warn("FalseColorControl::ChangeScheme",id);
  $('#falsecolor-scheme').val(id);
  
  this.currentTabDiv = newpanel;
  
  if(id == 'falsecolor-Rainbow')          gWirePseudoColor = new PsuedoRainbow; 
  else if(id == 'falsecolor-Grayscale')   gWirePseudoColor = new PsuedoGrayscale; 
  else if(id == 'falsecolor-LOCS')        gWirePseudoColor = new PsuedoLOCS; 
  else if(id == 'falsecolor-Brightness')  gWirePseudoColor = new PsuedoBrightness; 
  else if(id == 'falsecolor-Blackbody')   gWirePseudoColor = new PsuedoBlackbody; 
  else if(id == 'falsecolor-RootRainbow') gWirePseudoColor = new PsuedoRootRainbow; 
  else if(id == 'falsecolor-Interp2')     gWirePseudoColor = new PsuedoInterpolator(2); 
  else if(id == 'falsecolor-Interp3')     gWirePseudoColor = new PsuedoInterpolator(3); 
  else if(id == 'falsecolor-Interp4')     gWirePseudoColor = new PsuedoInterpolator(4); 
  
  this.NewRecord();
  gStateMachine.Trigger('ChangePsuedoColor');
}



FalseColorControl.prototype.MakeHist = function( )
{
  var c1 = gWirePseudoColor.AdcToColorDial(-4096);
  var c2 = gWirePseudoColor.AdcToColorDial( 4096);
  var n = Math.floor((this.canvas.width)/2);
  this.hist = CreateGoodHistogram(n,c1,c2);
  for(var i =0;i<this.hist.n;i++) {
    this.hist.SetBinContent(i,gWirePseudoColor.ColorDialToAdc(this.hist.GetX(i)));
  }
  this.fNHist=1;
  this.fHists=[this.hist];
  this.fColorScales=[new ColorScaleIndexed(0)];
  this.fHistOptions=[{doFill:false,doLine:true}];
  this.min_u = this.hist.min;
  this.max_u = this.hist.max;
  this.min_v = this.hist.min_content;
  this.max_v = this.hist.max_content;
  this.log_y = false;
}

FalseColorControl.prototype.Draw = function( )
{
  // this.log_y = $(this.ctl_histo_logscale).is(":checked");
  
  this.Clear();
  this.DrawFrame();
  
  
  
  this.ctx.save();
  for(var i =0;i<this.hist.n;i++) {
    var u = this.hist.GetX(i);
    var u2 = this.hist.GetX(i+1);
    var cc = gWirePseudoColor.ColorDialToCtxColor(gWirePseudoColor.AdcToColorDial(gWirePseudoColor.ColorDialToAdc(u)));
    // var cc = gWirePseudoColor.ColorDialToCtxColor(u);
    this.ctx.fillStyle = cc;
    var x = this.GetX(u);
    var x2 = this.GetX(u2);
    this.ctx.fillRect(x,this.origin_y-this.span_y,x2-x,this.span_y);
    // Don't trust gradients: they lie.
  }
  this.ctx.restore();
  
  this.MakeHist();
  
  this.DrawHists();

  var lines=[-500,-50,-20,-5,0,5,20,50,500];
  var sx_last = -1e9;
  for(var i =0;i<lines.length;i++) {
    var u = gWirePseudoColor.AdcToColorDial(lines[i],true); // True signals no truncation.
      if(u>this.hist.min_x && u<this.hist.max_x) {
        var sx = this.GetX(u);
        this.ctx.beginPath();

        this.ctx.moveTo(sx,this.origin_y-this.span_y);
        this.ctx.lineTo(sx,this.origin_y+4);
        this.ctx.strokeStyle = 'black';
        this.ctx.stroke();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        if(sx-sx_last > 20) {
         this.ctx.fillText(String(lines[i]), sx, this.origin_y+4);
         sx_last = sx;
       }
    }
  }
  
};

FalseColorControl.prototype.ChangeRange = function( deltaDial )
{
  this.temporary_offset = -deltaDial;

  // this.cs.offset = this.temporary_offset+this.final_offset;
  var offset = this.temporary_offset+this.final_offset;
  $('.psuedoDialOffset').val(offset).trigger('change');

  // this.Draw();
};



FalseColorControl.prototype.FinishRangeChange = function()
{
  // Called on mouse-up.
  
  this.final_offset = this.temporary_offset + this.final_offset;
  this.temporary_offset = 0;
  
  gStateMachine.Trigger('ChangePsuedoColor');
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
    // Find the position of the drag start - is this in the horizontal scale or the body?
    this.fDragStartX = x;
    this.fDragStartT = (relx - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u; // colorDial coord.

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
      var T= (relx - this.origin_x)*(this.max_u-this.min_u)/this.span_x + this.min_u; // colorDial coord.
      var deltaDial = T-this.fDragStartT;
      this.ChangeRange(deltaDial);
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




