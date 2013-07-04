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


function ChangeHover( obj, type, collection )
{
  if(obj!=gHoverState.obj) {
    gHoverState.obj = obj;
    gHoverState.type = type;
    gHoverState.collection = collection;

    console.log("Hover: ",obj);
    gStateMachine.Trigger("hoverChange_"+type);
    gStateMachine.Trigger("hoverChange");
    
  }
}

function ClearHover()
{
  if(gHoverState.obj != null) {
    var type = gHoverState.type;
    gHoverState.obj = null;
    gHoverState.type = "none";
    gHoverState.collection = null;
    gStateMachine.Trigger("hoverChange_"+type);
    gStateMachine.Trigger("hoverChange");
    
  }
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
  if(!gHoverState.obj) {
    $(this.element).html("");
    return;
  }

  function HTMLEncode(str){
    var i = str.length,
        aRet = [];

    while (i--) {
      var iC = str[i].charCodeAt();
      if (iC < 65 || iC > 127 || (iC>90 && iC<97)) {
        aRet[i] = '&#'+iC+';';
      } else {
        aRet[i] = str[i];
      }
     }
    return aRet.join('');    
  }

  
  var h = "";
  h += "<h3>"+gHoverState.type+"</h3>";
  h += "<table class='.hoverinfo'>";
  var a = "<tr><td class='hoverinfo-key'>";
  var b = "</td><td class='hoverinfo-val'>";
  var c = "</td></tr>";  

  
  switch(gHoverState.type) {
    default:    
      for(var k in gHoverState.obj) {
        h+= a + HTMLEncode(k) + b + gHoverState.obj[k] + c;
      }
  }
  
  h+= "</table>";
  $(this.element).html(h);
  
}

