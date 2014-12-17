

// Hover Info box, which appears as a regular Portlet.
var gAssociations = null;

$(function(){
  $('div.A-Associations').each(function(){
     gAssociations = new Associations(this);
  });  
});

Associations.prototype = new ABoundObject(null);           

function Associations( element, options )
{
  if(!element) return;
  var defaults = {};
  // override defaults with options.
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
  
  // console.debug("MCInfo::ctor",element);
  gStateMachine.BindObj("hoverChange",this,"Draw");
}

Associations.prototype.Draw = function ()
{
  var h = "";  
  var state;
  var sel = false;
  if(gSelectState.obj) {
    state = gSelectState;
    sel = true;
    console.log("sel state:",state);
  } else if(gHoverState.obj) {
    state = gHoverState;
    console.log("hov state:",state);
  } else {
    $(this.element).html("");
    return;
  }

  h="<span>" + state.collection + "<span><br/>";
  switch(state.type) {
    case "mcparticle": h+=ComposeMCParticleInfo(state); break;
    case "track":      h+=ComposeTrackInfo(state); break;
    
    default:
      if(sel) 
        h += "<h3>Selected:" + state.type + "</h3>";
      else 
        h += "<h3>Hover:" + state.type + "</h3>";
      h += "<table class='.hoverinfo'>";
      var a = "<tr><td class='hoverinfo-key'>";
      var b = "</td><td class='hoverinfo-val'>";
      var c = "</td></tr>";  
      for(var k in state.obj) {
        if( Object.prototype.toString.call( state.obj[k] ) === '[object Array]' ) {
          h+= a + k + b + state.obj[k].length + " items" + c;
        } else {
          h+= a + k + b + state.obj[k] + c;          
        }
      }
      h+= "</table>";
  }
  
  h+= "</table>";
  console.warn("Associations",h);
  $(this.element).html(h);
  
};

