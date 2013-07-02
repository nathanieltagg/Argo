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
  gStateMachine.Bind('recordChange',SetListNames);


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
  if(gCurName.cal && gRecord.cal[gCurName.cal].wireimg_url) {
    $('#ctl-show-wireimg-cal').prop('disabled', false);
  } else {
    $('#ctl-show-wireimg-cal').prop('disabled', true);
  }    

  if(gCurName.raw && gRecord.raw[gCurName.raw].wireimg_url) {
    $('#ctl-show-wireimg-raw').prop('disabled', false);
  } else {
    $('#ctl-show-wireimg-raw').prop('disabled', true);
  }

  // Select the correct one.
  if(gCurName.raw && !gCurName.cal && $('#ctl-show-wireimg-cal').is(":checked")) {
    $('#ctl-show-wireimg-raw').prop("checked",true);
  }

  if(gCurName.cal && !gCurName.raw &&  $('#ctl-show-wireimg-raw').is(":checked")) {
    $('#ctl-show-wireimg-cal').prop("checked",true);
  }
}

function SetListNames()
{
  
 }



$.widget( "argo.shiftspinner", {
  // state:
  which: 0,
  n: 0,
  
  // default options
  options: {
    duration: 500,      
    easing: 'easeOutBounce',
    // callbacks
    change: null
  },

  // the constructor
  _create: function() {
    this.element
      // add a class for theming
      .addClass( "shiftspinner" )
      // prevent double click to select text
      .disableSelection();
    this.selected = 0;
    this._refresh();
  },

  // called when created, and later when changing options
  _refresh: function() {
    this.width =  this.element.width();
    this.n = $('li',this.element).length;
    this.ul = $('ul',this.element);
    this.lis = $('li',this.element);
    $(this.lis.get(0)).clone().appendTo(this.ul);
    this.lis = $('li',this.element);

    this.ul.width(this.width*(this.n+1)+"px");
    this.lis.width(this.width+"px");

    this._on( this.lis, { click: "_doclick" });
    // trigger a callback/event
    this._trigger( "change" );
  },
  
  _doclick: function( event ) {
      this.which = (this.which+1);
      var left = this.which * (-this.width) + "px";
      console.log("click",this.which);
      console.log("click",this.which,left,this.options.easing);
      var fn = function(){console.log("noreset")};
      if(this.which == this.n) { this.which = 0; fn = function(){console.log("reset");$(this).css('left',0);};}
      $(this.ul).stop().animate({left: left, top: "0px"}, 
                                {easing: this.options.easing, duration: this.options.duration, complete: fn}
                              );
      this._trigger("change", event, {selected: this.lis.get(this.which), val: this.which});
  },

  // a public method to change the color to a random value
  // can be called directly via .colorize( "val" )
  val: function() {
    return this.selected;
    return $('li',this.element).get(selected);
  },

  // events bound via _on are removed automatically
  // revert other modifications here
  _destroy: function() {
    // remove generated elements
    this.element
      .removeClass( "shiftspinner" )
      .enableSelection();
    },

  // _setOptions is called with a hash of all options that are changing
  // always refresh when changing options
  _setOptions: function() {
    // _super and _superApply handle keeping the right this-context
    this._superApply( arguments );
    this._refresh();
  },

  // _setOption is called for each individual option that is changing
  _setOption: function( key, value ) {
    this._super( key, value );
  }
});


