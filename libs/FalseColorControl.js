//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:
gWirePseudoColor = new LogColor();


// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('#false-color-type').addClass("saveable").change(ChangeFalseColorScale);


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
  HistCanvas.call(this, element, settings); // Give settings to Pad contructor.
  
  // this.hist = new Histogram(10,-4096,4096);
  this.cs =  gWirePseudoColor;

  this.temporary_offset = 0;
  this.final_offset = 0;
  
  this.MakeHist();
  
  
  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
    
  this.ctl_histo_logscale= GetBestControl(this.element,".ctl-histo-logscale");
  $(this.ctl_histo_logscale).change(function(ev) { self.Draw(); });

  $('.falseColorPlus1' ).click(function(){ self.ChangeRange(gWirePseudoColor.AdcToColorDial(1)-gWirePseudoColor.AdcToColorDial(0)); self.FinishRangeChange(); });
  $('.falseColorMinus1').click(function(){ self.ChangeRange(gWirePseudoColor.AdcToColorDial(-1)-gWirePseudoColor.AdcToColorDial(0)); self.FinishRangeChange(); });

  $('input#psuedoDialOffset').change(function(){gWirePseudoColor.dialOffset = parseFloat($(this).val());  self.Draw();});
  $('input#psuedoAdcScale')  .change(function(){gWirePseudoColor.adcScale   = parseFloat($(this).val());  self.Draw();});
  $('input#psuedoDialScale') .change(function(){gWirePseudoColor.dialScale  = parseFloat($(this).val());  self.Draw();});
  $('input#psuedoSaturation') .change(function(){gWirePseudoColor.saturation= parseFloat($(this).val());  self.Draw();});


  $('div#psuedoDialOffsetSlider').slider({
    value: -$('input#psuedoDialOffset').val(),
    min: -1.2,
    max:  1.2,
    step: 0.05,
    slide: function(ev,ui) { $('input#psuedoDialOffset').val(-ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input#psuedoDialOffset').val(-ui.value).trigger('change'); self.FinishRangeChange();}
  });

  $('div#psuedoAdcScaleSlider'   ).slider({
    value: $('input#psuedoAdcScale').val(),
    min: 1,
    max: 500,
    step: 1,
    slide: function(ev,ui) { $('input#psuedoAdcScale').val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input#psuedoAdcScale').val(ui.value).trigger('change'); self.FinishRangeChange();}
  });
  
  $('div#psuedoDialScaleSlider').slider({
    value: $('input#psuedoDialScale').val(),
    min: 0.05,
    max: 2,
    step: 0.1,
    slide: function(ev,ui) { $('input#psuedoDialScale').val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input#psuedoDialScale').val(ui.value).trigger('change'); self.FinishRangeChange();}
  });

  $('div#psuedoSaturationSlider').slider({
    value: $('input#psuedoSaturation').val(),
    min: 0,
    max: 1,
    step: 0.01,
    slide: function(ev,ui) { $('input#psuedoSaturation').val(ui.value).trigger('change'); return true;},
    stop:  function(ev,ui) { $('input#psuedoSaturation').val(ui.value).trigger('change'); self.FinishRangeChange();}
  });
}

FalseColorControl.prototype.NewRecord = function()
{
  // Read saved values into the color.
  // This will happen before the images load, so it's safe.
  
  gWirePseudoColor.dialOffset = parseFloat($('input#psuedoDialOffset').val() );
  gWirePseudoColor.adcScale   = parseFloat($('input#psuedoAdcScale').val() );
  gWirePseudoColor.dialScale  = parseFloat($('input#psuedoDialScale').val() );
  gWirePseudoColor.saturation = parseFloat($('input#psuedoSaturation').val() );
  
  this.Draw();
  // gGLEngine.build_LUT_canvas(this.cs,-4066,4096,$('#checkCanvas').get(0));
};


FalseColorControl.prototype.MakeHist = function( )
{
  var c1 = gWirePseudoColor.AdcToColorDial(-4096);
  var c2 = gWirePseudoColor.AdcToColorDial( 4096);
  this.hist = CreateGoodHistogram(300,c1,c2);
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
    var cc = gWirePseudoColor.ColorDialToCtxColor(u);
    this.ctx.fillStyle = cc;
    this.ctx.fillRect(this.GetX(u),this.origin_y-this.span_y,1,this.span_y);
    // Don't trust gradients: they lie.
  }
  this.ctx.restore();
  
  this.MakeHist();
  
  this.DrawHists();

  var lines=[-500,-50,-20,-5,0,5,20,50,500,gWirePseudoColor.adcScale,-gWirePseudoColor.adcScale];
  for(var i =0;i<lines.length;i++) {
    var u = gWirePseudoColor.AdcToColorDial(lines[i]);
      if(u>this.hist.min_x && u<this.hist.max_x) {
        var sx = this.GetX(u);
        this.ctx.beginPath();

        this.ctx.moveTo(sx,this.origin_y-this.span_y);
        this.ctx.lineTo(sx,this.origin_y+4);
        this.ctx.strokeStyle = 'black';
        this.ctx.stroke();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(String(lines[i]), sx, this.origin_y+4);
    }
  }
  
};

FalseColorControl.prototype.ChangeRange = function( deltaDial )
{
  this.temporary_offset = -deltaDial;

  // this.cs.offset = this.temporary_offset+this.final_offset;
  var offset = this.temporary_offset+this.final_offset;
  $('#psuedoDialOffset').val(offset).trigger('change');

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




