
/// Code for cycling options in a drop-down <select> menu.

(function( $ ) {
    $.fn.cycle_dropdown = function() { 
      var s = $("option:selected",this).last();
      var n = $(s).next();
      if(n.length == 0) n = $("option",this).first();
      this.val(n.val());
      return this;
    }; 
}( jQuery ));

///
/// Code that sets up keyboard key equivalents.
///
$(function() {

  // crappy hotkey plugin doesn't work.
  // $(document).on('keypress',null,'Shift+T',function(){  });
  // $(document).bind('keydown','shift+s',function(){ $('#ctl-SpacepointLists').cycle_dropdown(); });

  $(document).keypress(function(event){
    if($(event.target).is(":input")) return true;
    if(event.ctrlKey || event.altKey || event.metaKey) return true; // Don't intercept control-N for new window.
    console.log("keypress",event.which);
    switch(event.which) {
      case 102:
        // f: fill
        return $('.ctl-histo-fill').click();
        break;
        
     case 108:
      // l: logscale
      return $('.ctl-histo-logscale').click();
      break;
      
    case 114: 
    // r: reset
      return $('.ctl-histo-reset').click();
      break;

    case 98: 
    // b: flip
      return $('.ctl-histo-flip').click();
      break;
      
    case 80:
      // console.log("P:",event);
      DoPrint(gPortletHover);
      break;
        
    case 76:
      // shift-L: print everything.
      return DoPrint($('body'),true);
      break;
      
    default:
      return true;
    }
  });
});
