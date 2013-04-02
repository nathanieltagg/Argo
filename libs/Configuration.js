//
// Setup callbacks for configuration controls
//

$(function(){
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
  
  gStateMachine.Bind('recordChange',CheckWireData);


  $('#ctl-lock-aspect-ratio').change(function() {
    // Force the zoom system to acknowledge the change, by 
    // making a null zoom.
    if($(this).is(":checked")) {
      gZoomRegion.setLimits(2,gZoomRegion.plane[2][0],gZoomRegion.plane[2][1]);
      gStateMachine.Trigger("zoomChange");
    }
  });

});

function CheckWireData()
{
  if(!gRecord) return;
  if(gRecord.cal && gRecord.cal.wireimg_url) {
    $('#ctl-show-wireimg-cal').prop('disabled', false);
  } else {
    $('#ctl-show-wireimg-cal').prop('disabled', true);
  }

  if(gRecord.raw && gRecord.raw.wireimg_url) {
    $('#ctl-show-wireimg-raw').prop('disabled', false);
  } else {
    $('#ctl-show-wireimg-raw').prop('disabled', true);
  }

}