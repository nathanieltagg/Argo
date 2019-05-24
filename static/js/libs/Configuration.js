//
// Setup callbacks for configuration controls
//

$(function(){
  // Magnifier
  $('#ctl-magnifier-mag-slider').slider(
    {
      value: parseFloat($('#ctl-magnifier-mag').val()),
      min: 1,
      max: 10,
      step: 0.1,
      slide: function(event, ui) {$("#ctl-magnifier-mag").val(ui.value);}
    }
  );
  $('#ctl-magnifier-size-slider').slider(
    {
      value: parseFloat($('#ctl-magnifier-size').val()),
      min: 10,
      max: 100,
      slide: function(event, ui) {$("#ctl-magnifier-size").val(ui.value);}
    }
  );
  
  
  // Hit summer
  $('#ctl-hitsum-size-slider').slider(
    {
      value: parseFloat($('#ctl-hitsum-circle-size').val()),
      min: 0.1,
      max: 20,
      step: 0.1,
      slide: function(event, ui) {$("#ctl-hitsum-circle-size").val(ui.value);}
    }
  );
  $('#ctl-hitsum-circle').change(function(ev) { $('#hitsum').hide(); });
  

  
  function SetHV(){
    var hv = parseFloat($('#ctl-high-voltage').val()) || 70;
    gGeo.SetHV(hv);
    gGeo3.setHV(hv);
    // gZoomRegion.setLimits(2,gZoomRegion.plane[2][0],gZoomRegion.plane[2][1]);
    gStateMachine.Trigger("driftChange");    
    gStateMachine.Trigger("zoomChange");    
  }
  $('#ctl-high-voltage').change(SetHV);  
  // set the hv right now, before we even start.
  var hv = parseFloat($('#ctl-high-voltage').val()) || 70; 
  gGeo.SetHV(hv);
  gGeo3.setHV(hv)
  

  // prevent controls from capturing the keyboard events.  Remove focus if gathereed.
  $('#config-port input:checkbox').on("focus",function(ev){this.blur();});
  $('#config-port input:text').on("change",function(ev){this.blur();});
  
  $('#config-port select').on("focus",function(ev){this.blur();});
  $('#config-port button').on("focus",function(ev){this.blur();});

  gStateMachine.Bind("newPiece",function(){
    var hints = (gRecord||{}).hints||{};
    if("shift_hit_ticks" in hints) $('#ctl-shift-hits').val(hints.shift_hit_ticks.value);

  })
  
  
});








