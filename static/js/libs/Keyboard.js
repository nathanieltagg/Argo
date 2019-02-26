
/// Code for cycling options in a drop-down <select> menu.

function myGrowlToggle(title,checkbox)
{
  
}
function myGrowl(title,msg)
{
  var msg = $('<div><h2>'+title+'</h2>'+msg+'</div>');
  $.blockUI({ 
      message: msg,
      fadeIn: 50, 
      fadeOut: 400, 
      timeout: 600, 
      showOverlay: false, 
      centerY: false, 
      centerX: false, 
      css: { 
          width: 'default', 
          top: '10px', 
          left: '', 
          right: '10px', 
          border: 'none', 
          padding: '5px', 
          backgroundColor: '#000', 
          '-webkit-border-radius': '10px', 
          '-moz-border-radius': '10px', 
          opacity: .6, 
          color: '#fff' 
      } 
  }); 
}

// (function( $ ) {
//     $.fn.cycle_dropdown = function(txtalert) {
//       var s = $("option:selected",this).last();
//       var n = $(s).next();
//       if(n.length === 0) n = $("option",this).first();
//       this.val(n.val());
//       if(txtalert) {
//         myGrowl(txtalert,this.val());
//       }
//       return this;
//     };
// }( jQuery ));

function cycle_new_dropdown(_type) {  
  var retrieved = $('input.retrieved[name="ctl-select-'+_type+'"]');
  if(retrieved.length == 0) return; // nothing loaded yet!    
  console.log("cycle_new_dropdown",_type,"retrieved:",retrieved.length);
  var j = 0;
  for(var i=0;i<retrieved.length;i++) {
    console.log(i,$(retrieved[i]).is(":checked"));
    if($(retrieved[i]).is(":checked")) {
      j = (i+1)%retrieved.length;
      console.log("cycle_new_dropdown",_type,"selected:",i,"new:",j);
      break;
    }
  }
  console.log("cycle_new_dropdown",_type,"new:",j);
  var new_item = $(retrieved[j])
  new_item.prop("checked",true).trigger("change");
  var type_label =  $("input.product-type").filter(function(){return $(this).data('product-type')==_type;}).siblings("label")[0];

  type_label.classList.remove("pulse");
  void type_label.offsetWidth;
  type_label.classList.add("pulse");
  myGrowl("Change "+_type,$(retrieved[j]).val());
  
}

(function( $ ) {
    $.fn.cycle_dropdown = function(txtalert) { 
      var s = $("option:selected",this).last();
      var n = $(s).next();
      if(n.length === 0) n = $("option",this).first();
      this.val(n.val());
      if(txtalert) {
        myGrowl(txtalert,this.val());
      }
      return this;
    }; 
}( jQuery ));


(function( $ ) {
    $.fn.checkbox_announce = function(txtalert) { 
      if(txtalert) {
        var msg = txtalert + " " + (this.is(":checked")?"On":"Off");
        console.log("checkbox_announce",this,txtalert,this.is(":checked"),msg);
        myGrowl("",msg);
      }
      return this;
    }; 
}( jQuery ));

///
/// Code that sets up keyboard key equivalents.
///
$(function() {

  $(window).keypress(function(event){
    // Don't fire on some special elements, where the keyboard is actually supposed to be used.
    // text, textarea, password
    if($(event.target).is("textarea,:text,:password")) { return true;} 

    //if($(event.target).is(":input")) return true; // Bad. Locks keyboard focus on checkboxes and buttons.
    if(event.ctrlKey || event.altKey || event.metaKey) return true; // Don't intercept control-N for new window.
    console.log("keypress",event.which);
    // var sound = document.getElementById("sound1");
    // sound.Play();

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
      case 61: //'='
        $('#ctl-hitsum-circle').click().checkbox_announce("Summing Hits Near Mouse:");
        return false;
        
        
      case 112: // 'p'
        DoPrevEvent(); return false;
      case 110: // 'n'
        DoNextEvent(); return false;
      
      case 119: // 'w'
        $('#ctl-show-wireimg').click().checkbox_announce("Show Wiredata:");
        return false;

      case 87: // 'W'
        cycle_new_dropdown("wireimg");
        // CycleWireRadios();
        return false;

      case 104: // 'h'
        $('#ctl-show-hits').click().checkbox_announce("Show Hits:");
        return false;

      case 72: // 'H'
        cycle_new_dropdown("hits");
        return false;

      case 99: // 'c'        
        $('#ctl-show-clusters').click().checkbox_announce("Show Clusters:");
        return false;

      case 67: // 'C'
        cycle_new_dropdown("clusters");        
        return false;

      case 101: // 'e'
        $('#ctl-show-endpoint2d').click().checkbox_announce("Show Endpoint2d:");
        return false;
        
      case 69: // 'E'
        cycle_new_dropdown("endpoint2d");        
        return false;
        
      case 115: // 's'
        $('#ctl-show-showers').click().checkbox_announce("Show Showers:");
        return false;

      case 83: // 'S'
        cycle_new_dropdown("showers");        
        return false;

      case 116: // 't' 
        $('#ctl-show-tracks').click().checkbox_announce("Show tracks:");
        return false;

      case 84: // 'T'
        cycle_new_dropdown("tracks");
        return false;

      case 102: // 'f' 
        $('#ctl-coherent-noise-filter').click().checkbox_announce("Coherent Noise Filter:");
        return false;

      case 70: // 'F'
        cycle_new_dropdown("opflashes");        
        return false;
        
      case 111: // 'o' 
        $('#ctl-track-shift-window').click().checkbox_announce("Shift tracks:");
        return false;
        

      case 79: // 'O'
        cycle_new_dropdown("ophits");        
        return false;
        
      case 109: // 'm'
        $('#ctl-show-mc').click().checkbox_announce("Monte Carlo Tracks:");
        return false;
      case 77: // 'M'
        $('#ctl-show-mc-neutrals').click().checkbox_announce("MC Neutral Particles:");
        return false;
        
      case 122: // 'z'
        $('#ctl-mc-move-tzero').click().checkbox_announce("MC Shift t0:");;
        return false;
      
      case 103: //'g'
        $('#ctl-magnifying-glass').click().checkbox_announce("Magnifying glass:");
        return false;
        

       case 114: // 'r'
         $('#ctl-show-reco').click().checkbox_announce("Reconstruction:");;
         return false;
   
        case 47: // '/'
         $('#ctl-gl-edge-finder').click().checkbox_announce("GL Edge Finder");;
         return false;


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
    case 108:
      // l: logscale
      return $('#ctl-histo-logscale').click().checkbox_announce("Log scale: ");;
            
    case 80:
        // console.log("P:",event);
        DoPrint(gPortletHover);
        break;
        
    case 76:
        // shift-L: print everything.
        return DoPrint($('body'),true);
        
    default:
        return true;
    }
  });
});
