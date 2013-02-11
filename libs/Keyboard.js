///
/// Code that sets up keyboard key equivalents.
///
$(function() {
  $(window).keypress(function(event){
    if($(event.target).is(":input")) return true;
    if(event.ctrlKey || event.altKey || event.metaKey) return true; // Don't intercept control-N for new window.
    console.log("keypress",event.which);
    switch(event.which) {
      // case 44: // ',' key
      // case 60: // '<' key
      //   // DoPrevSliceAndGate(); return false;
      // case 46: // '.' key
      // case 62: // '>' key
      //   // DoNextSliceAndGate(); return false;
      // case 49: DoSlice(1); return false;  // number keys
      // case 50: DoSlice(2); return false;  // number keys
      // case 51: DoSlice(3); return false;  // number keys
      // case 52: DoSlice(4); return false;  // number keys
      // case 53: DoSlice(5); return false;  // number keys
      // case 54: DoSlice(6); return false;  // number keys
      // case 55: DoSlice(7); return false;  // number keys
      // case 56: DoSlice(8); return false;  // number keys
      // case 57: DoSlice(9); return false;  // number keys
      // case 111: // 'o' key
      // case 48:  // '0' key
      //   DoSlice(0); return false;  // '1' key
      // case 97: DoSlice(-1); return false;  // 'a' key
      // case 45: //'-'
      // case 95: //'_'
      //   DoSlicePrev(); return false;
      // case 43: //'+'
      // case 61: //'='
      //   DoSliceNext(); return false;
      case 112: // 'p'
        DoPrevEvent(); return false;
      case 110: // 'n'
        DoNextEvent(); return false;
      
      case 104: // 'h'
        $('#ctl-hitmap-show-hits').click(); gStateMachine.Trigger('phColorChange');
        return false;
      // case 98: // 'b'
      //   $('#ctl-show-hitmap-blobs').click(); gStateMachine.Trigger('phColorChange');
      //   return false;
      // case 99: // 'c'
      //   $('#ctl-show-hitmap-clusters').click(); gStateMachine.Trigger('phColorChange');
      //   return false;
      // case 118: // 'v'
      //   $('#ctl-show-hitmap-vertices').click(); gStateMachine.Trigger('phColorChange');
      //   return false;
      // case 116: // 't'
      //   $('#ctl-show-hitmap-tracks').click(); gStateMachine.Trigger('phColorChange');
      //   return false;
      // case 114: // 'r'
      //   $('#ctl-show-hitmap-regions').click(); gStateMachine.Trigger('phColorChange');
      //   return false;
      // case 109: // 'm'
      //   $('#ctl-show-hitmap-truth').click(); gStateMachine.Trigger('phColorChange');
      //   return false;
      // 
      // case 117: // 'u'
      //   $('#ctl-show-hitmap-hits-user-color').click();
      //   return false;
      // 
      // case 92: // '\'
      //   // Cycle through MC interactions
      //   var active = $('#mc-info .accordion').accordion('option', 'active');  
      //   var count = $('#mc-info .accordion h3').size();
      //   var next = (active+1)%count;
      //   // console.log("active accordion: ",active,count,next);
      //   $('#mc-info .accordion').accordion('activate', next);  
      //   return false;
      // 
      // 
      // case 105: // 'i'
      //   if($('#hit-info').is(":hidden")) {
      //     $('#hit-info').dialog('open').dialog('moveToTop').effect('highlight');
      //   } else {
      //     $('#hit-info').dialog('close');
      //   }
      //   return false;
      // 
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
