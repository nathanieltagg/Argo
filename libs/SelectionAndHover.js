var gHoverState = {
  obj:  null,
  type: "none",
  collection: null
};

var gSelectState = {
  obj:  null,
  type: "none",
  collection: null
};


function ChangeHover( arg )
{
  if(arg.obj!=gHoverState.obj) {
    gHoverState = $.extend({},arg);
    gStateMachine.Trigger("hoverChange_"+arg.type);
    gStateMachine.Trigger("hoverChange");
    
  }
}

function ClearHover()
{
  // console.trace();
  if(gHoverState.obj != null) {
    var type = gHoverState.type;
    gHoverState.obj = null;
    gHoverState.type = "none";
    gHoverState.collection = null;
    gStateMachine.Trigger("hoverChange_"+type);
    gStateMachine.Trigger("hoverChange");
    
  }
}

function ClearSelection( )
{
  gSelectState = {obj:  null, type: "none", collection: null};
  gStateMachine.Trigger("selectChange");
  
}

function ChangeSelection( arg )
{
  if(arg.obj && arg.obj==gSelectState.obj) {
    // Untoggle.
    gSelectState = {obj:  null, type: "none", collection: null};
  } else {
    gSelectState = $.extend({},arg);
    console.warn("Selecting new object",gSelectState.obj,gSelectState.type," gHover is ",gHoverState.type);
  }
  
  gStateMachine.Trigger("selectChange");
  
}






var gHoverInfo = null;

$(function(){
  $('div.A-HoverInfo').each(function(){
     gHoverInfo = new HoverInfo(this);
  });  
});

function HoverInfo( element )
{
  // console.debug("MCInfo::ctor",element);
  this.element = element;
  gStateMachine.BindObj("hoverChange",this,"Draw");
}

HoverInfo.prototype.Draw = function ()
{
  var h = "";  
  var state;
  if(gSelectState.obj) {
    state = gSelectState;
    h = "<h3>Selected:" + state.type + "</h3>";
  } else if(gHoverState.obj) {
    state = gHoverState;
    h = "<h3>Hover:" + state.type + "</h3>";    
  } else {
    $(this.element).html("");
    return;
  }
  
  h += "<table class='.hoverinfo'>";
  var a = "<tr><td class='hoverinfo-key'>";
  var b = "</td><td class='hoverinfo-val'>";
  var c = "</td></tr>";  

  
  switch(gHoverState.type) {
    default:    
      for(var k in state.obj) {
        h+= a + k + b + state.obj[k] + c;
      }
  }
  
  h+= "</table>";
  $(this.element).html(h);
  
}

