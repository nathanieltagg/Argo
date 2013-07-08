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
  console.warn(arg);
  if(!arg) {ClearHover(); return;}
  
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
  if(gSelectState.obj) {
    gSelectState = {obj:  null, type: "none", collection: null};
    gStateMachine.Trigger("selectChange");
  }
}

function ChangeSelection( arg )
{
  if(!arg.obj) { ClearSelection(); return; }
  if(arg.obj && arg.obj==gSelectState.obj) {
    // Untoggle.
    gSelectState = {obj:  null, type: "none", collection: null};
  } else {
    gSelectState = $.extend({},arg);
    console.warn("Selecting new object",gSelectState.obj,gSelectState.type," gHover is ",gHoverState.type);
  }
  
  gStateMachine.Trigger("selectChange");
  
}



// Hover info box which appears as overlay.
function SetOverlayPosition(x,y)
{
  $('#selected-object-info.floating').css({
    position: 'absolute',
    zIndex : 2000,
    left: x, top: y-60
  });
}


////////// Initialization
$(function(){
  gStateMachine.Bind("selectChange",DrawObjectInfo);
  $('#selected-object-info.floating').hide();
  // $('#selected-object-info .unit-ctl').buttonset();
  // $('#selected-object-info .unit-ctl input').click(DrawObjectInfo);

  // $('#selected-object-info.dialog').dialog({
  //     autoOpen: false,
  //     position: 'right',
  //     width: 200,
  //     // dragStop: function(event,ui) {
  //     //   if(clip_muon)   clip_muon.reposition();  // Fix floating copy boxes
  //     //   if(clip_proton) clip_proton.reposition();
  //     // },
  //     // resizeStop: function(event,ui) {
  //     //   if(clip_muon)   clip_muon.reposition();  // Fix floating copy boxes
  //     //   if(clip_proton) clip_proton.reposition();
  //     // }
  // });
});

function DrawObjectInfo() 
{
  var e = $('#selected-object-info');
  if(!gSelectState.obj) {
    // don't draw anything
    txt = "<span class='track_id'>No Object Selected</span><br/>";
    $(".selected-object-info",e).html(txt);
    $('#selected-object-info').stop(true,true).fadeOut();
    return;
  }

  var h = "";  

  switch(gSelectState.type) {
    default:
      h = "<h3>Selected:" + gSelectState.type + "</h3>";
      h += "<table class='.hoverinfo'>";
      var a = "<tr><td class='hoverinfo-key'>";
      var b = "</td><td class='hoverinfo-val'>";
      var c = "</td></tr>";  
      for(var k in gSelectState.obj) {
        if( Object.prototype.toString.call( gSelectState.obj[k] ) === '[object Array]' ) {
          h+= a + k + b + gSelectState.obj[k].length + " items" + c;
        } else {
          h+= a + k + b + gSelectState.obj[k] + c;          
        }
      }
      h+= "</table>";
  }

  $(".selected-object-info",e).html(h);      
  $('#selected-object-info').stop(true,true).fadeIn();
}

// Hover Info box, which appears as a regular Portlet.
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

  
  switch(state.type) {
    default:    
      for(var k in state.obj) {
        h+= a + k + b + state.obj[k] + c;
      }
  }
  
  h+= "</table>";
  $(this.element).html(h);
  
}

