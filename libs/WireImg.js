// Subclass of Pad.

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireImg').each(function(){
    var o = new WireImg(this);
    console.log("Creating WireImg ",o);
  });  
});

function WireImg( element, options )
{
  if(!element) {
    // console.log("HitMap: NULL element supplied.");
    return;
  }
  if($(element).length<1) { 
    // console.log("HitMap: Zero-length jquery selector provided."); 
    return;
  }
  
  this.element=element;
  var settings = {
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  
  var self = this;
  this.fMousing = false;
  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('click'    ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('resize' ,function(ev) { if(self.hasContent == false) self.NewRecord(); });
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");
}


WireImg.prototype.NewRecord = function()
{
  $(this.element).html("<img/>");
  $('img',this.element).attr('src',gRecord.wireimg);
}

WireImg.prototype.Draw = function()
{
  
}

WireImg.prototype.DoMouse = function(ev)
{
  if(ev.type === 'mouseout' || ev.type == 'touchend') {
    this.fMousing = false;
    // TODO: clear hovered objects
  } else {
    this.fMousing = true;
    var offset = getAbsolutePosition(this.element);
    this.fMouseX = ev.pageX - offset.x;
    this.fMouseY = ev.pageY - offset.y; 

  this.Draw();
  }
}